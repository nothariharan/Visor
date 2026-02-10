#!/usr/bin/env node
const express = require('express');
const cors = require('cors');
const fs = require('fs-extra');
const path = require('path');
const chokidar = require('chokidar');
const { generateGraph, getCachedGraph } = require('./graph');
const { getGitMetadata } = require('./git');
const { ProjectDetector } = require('./project/ProjectDetector');
const { ProcessRunner } = require('./runner/ProcessRunner');

const app = express();
const PORT = process.env.PORT || 3000;
const ROOT_DIR = process.cwd(); // Run on current directory

let config = {};
try {
    const configPath = path.join(ROOT_DIR, 'visor.config.js');
    if (fs.existsSync(configPath)) {
        config = require(configPath);
        console.log('Loaded visor.config.js');
    }
} catch (e) {
    console.warn('Failed to load config:', e.message);
}


app.use(cors());
app.use(express.json());

// Serve static frontend files (for production/CLI usage)
const clientBuildPath = path.join(__dirname, '../client/dist');
if (fs.existsSync(clientBuildPath)) {
    app.use(express.static(clientBuildPath));
}

// Basic health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Graph Endpoint
app.post('/api/graph', async (req, res) => {
    try {
        const { expandedFolders } = req.body; // Array of paths
        const data = await generateGraph(ROOT_DIR, expandedFolders || [], config);
        res.json(data);

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// File Content Endpoint for Code Editor
app.get('/api/files/content', async (req, res) => {
    try {
        const { path: filePath } = req.query;
        if (!filePath) return res.status(400).json({ error: 'Missing file path' });

        // Resolve relative paths if needed, but usually we get full paths.
        // If absolute, ensure it's inside ROOT_DIR for basic safety?
        // For local dev tool, trust is implied, but let's check.
        // Actually, node graph uses absolute paths. Let's trust it for now as it's a dev tool.

        const content = await fs.readFile(filePath, 'utf-8');
        res.json({ content });
    } catch (error) {
        console.error('Error reading file:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/files/content', async (req, res) => {
    try {
        const { path: filePath, content } = req.body;
        if (!filePath || content === undefined) return res.status(400).json({ error: 'Missing file path or content' });

        await fs.writeFile(filePath, content, 'utf-8');
        console.log(`File saved: ${filePath}`);

        // No need to manually trigger refresh, chokidar will catch it
        res.json({ success: true });
    } catch (error) {
        console.error('Error writing file:', error);
        res.status(500).json({ error: error.message });
    }
});


// Git Metadata Endpoint
app.get('/api/git', async (req, res) => {
    const filePath = req.query.path;
    if (!filePath) return res.status(400).json({ error: 'Path required' });

    // Ensure path is absolute and safe
    const absolutePath = path.resolve(ROOT_DIR, filePath);
    if (!absolutePath.startsWith(ROOT_DIR)) {
        return res.status(403).json({ error: 'Access denied' });
    }

    const metadata = await getGitMetadata(absolutePath);
    res.json(metadata);
});

// Search Endpoint
app.post('/api/search', async (req, res) => {
    const { query } = req.body;
    if (!query) return res.json({ expandedFolders: [] });

    try {
        const matches = [];
        const expandedFolders = new Set();

        // Recursive search helper
        async function searchDir(dir) {
            const dirents = await fs.readdir(dir, { withFileTypes: true });
            for (const dirent of dirents) {
                const fullPath = path.join(dir, dirent.name);
                if (dirent.name.startsWith('.') || dirent.name === 'node_modules' || dirent.name === 'dist' || dirent.name === 'build' || dirent.name === 'coverage') continue;

                if (dirent.name.toLowerCase().includes(query.toLowerCase())) {
                    matches.push(fullPath);
                    // Add parent directory to expandedFolders
                    let parent = path.dirname(fullPath);
                    // Add all ancestors up to root
                    while (parent.length >= ROOT_DIR.length && parent.startsWith(ROOT_DIR)) {
                        expandedFolders.add(parent);
                        const next = path.dirname(parent);
                        if (next === parent) break;
                        parent = next;
                    }
                }

                if (dirent.isDirectory()) {
                    await searchDir(fullPath);
                }
            }
        }

        await searchDir(ROOT_DIR);
        res.json({ expandedFolders: Array.from(expandedFolders), matchCount: matches.length });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- Process Runner, Socket.IO & APIs ---
const server = require('http').createServer(app);
const { Server } = require('socket.io');
const io = new Server(server, { cors: { origin: '*' } });

const processRunner = new ProcessRunner();

// Forward process output to WebSocket clients
processRunner.on('output', (data) => io.emit('process:output', data));
processRunner.on('exit', (data) => io.emit('process:exit', data));
processRunner.on('error', (data) => io.emit('process:error', data));

// API: Detect project
app.get('/api/project/detect', async (req, res) => {
    try {
        const detector = new ProjectDetector(ROOT_DIR);
        const result = await detector.detect();
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// API: Process Control
app.post('/api/process/start', async (req, res) => {
    const { id, command } = req.body;
    try {
        const result = processRunner.start(id || 'default', command, ROOT_DIR);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/process/stop', async (req, res) => {
    const { id } = req.body;
    const stopped = processRunner.stop(id || 'default');
    res.json({ success: stopped });
});

app.post('/api/process/restart', async (req, res) => {
    const { id } = req.body;
    const restarted = processRunner.restart(id || 'default');
    res.json({ success: restarted });
});

app.get('/api/process/status/:id?', (req, res) => {
    const id = req.params.id || 'default';
    const status = processRunner.getStatus(id);
    res.json(status);
});

app.get('/api/process/list', (req, res) => {
    res.json(processRunner.listProcesses());
});

// SPA Catch-all (for client-side routing)
// Express 5 requires regex or named parameters for catch-all
app.get(/.*/, (req, res) => {
    if (!req.path.startsWith('/api') && fs.existsSync(path.join(__dirname, '../client/dist/index.html'))) {
        res.sendFile(path.join(__dirname, '../client/dist/index.html'));
    } else if (!req.path.startsWith('/api')) {
        res.status(404).send('Visor client build not found. Run "npm run build" in client directory.');
    }
});

// Start server
server.listen(PORT, async () => {

    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Analyzing project at ${ROOT_DIR}...`);
    // Initial analysis on startup
    try {
        await generateGraph(ROOT_DIR);
        console.log('Initial graph analysis complete.');
    } catch (e) {
        console.error('Initial graph analysis failed:', e);
    }
});
