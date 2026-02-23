#!/usr/bin/env node
const express = require('express');
const cors = require('cors');
const fs = require('fs-extra');
const path = require('path');
const chokidar = require('chokidar');
const { generateGraph, getCachedGraph } = require('./graph');
const { getGitMetadata } = require('./git');
// const { ProjectDetector } = require('./project/ProjectDetector');
const { MultiRuntimeDetector } = require('./project/detection/MultiRuntimeDetector');
const { ProcessRunner } = require('./runner/ProcessRunner');

const app = express();
const PORT = process.env.PORT || 3000;
const ROOT_DIR = process.cwd(); // Run on current directory
const VISOR_DIR = path.join(ROOT_DIR, '.visor'); // Define .visor directory path

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
app.use(express.json({ limit: '10mb' })); // Increased limit for potentially large layouts

// Serve static frontend files (for production/CLI usage)
const clientBuildPath = path.join(__dirname, '../client/dist');
if (fs.existsSync(clientBuildPath)) {
    app.use(express.static(clientBuildPath));
}

// --- New Visor Layout Endpoints ---

// GET /api/visor/load-layout
app.get('/api/visor/load-layout', async (req, res) => {
    const layoutPath = path.join(VISOR_DIR, 'layout.json');
    try {
        if (await fs.exists(layoutPath)) {
            const content = await fs.readFile(layoutPath, 'utf-8');
            // Basic corruption check
            if (content.trim() === '') {
                 return res.json({ exists: false, reason: 'empty' });
            }
            const data = JSON.parse(content);
            res.json({ exists: true, ...data });
        } else {
            res.json({ exists: false });
        }
    } catch (error) {
        console.error('Error loading layout.json:', error);
        // If file is corrupted, return a default state
        res.status(500).json({
            exists: false,
            error: 'File may be corrupted.',
            // Return a default structure the frontend can handle
            data: { nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } }
        });
    }
});

// POST /api/visor/save-layout
app.post('/api/visor/save-layout', async (req, res) => {
    const layoutPath = path.join(VISOR_DIR, 'layout.json');
    try {
        const layoutData = req.body;
        if (!layoutData || !layoutData.nodes) {
            return res.status(400).json({ error: 'Invalid layout data provided.' });
        }

        // Add versioning and timestamp as per the plan
        const saveData = {
            version: "1.0.0", // Using a simple version for now
            savedAt: new Date().toISOString(),
            data: layoutData
        };

        await fs.ensureDir(VISOR_DIR); // Ensure directory exists before writing
        await fs.writeJson(layoutPath, saveData, { spaces: 2 });

        res.json({ success: true, savedAt: saveData.savedAt });
    } catch (error) {
        console.error('Error saving layout.json:', error);
        res.status(500).json({ error: 'Failed to save layout file.' });
    }
});

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
    if (!query) return res.json({ matches: [] });

    try {
        const matches = [];
        const ignoreDirs = new Set(['.git', 'node_modules', 'dist', 'build', 'coverage']);

        async function searchDir(dir) {
            try {
                const dirents = await fs.readdir(dir, { withFileTypes: true });
                for (const dirent of dirents) {
                    if (ignoreDirs.has(dirent.name)) continue;

                    const fullPath = path.join(dir, dirent.name);

                    if (dirent.name.toLowerCase().includes(query.toLowerCase())) {
                        matches.push({
                            path: fullPath,
                            name: dirent.name,
                            isDirectory: dirent.isDirectory(),
                            relativePath: path.relative(ROOT_DIR, dir)
                        });
                    }

                    if (dirent.isDirectory()) {
                        await searchDir(fullPath);
                    }
                }
            } catch (e) {
                // Ignore permission errors etc.
            }
        }

        await searchDir(ROOT_DIR);
        res.json({ matches });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- Process Runner, Socket.IO & APIs ---
const server = require('http').createServer(app);
const { Server } = require('socket.io');
const io = new Server(server, { cors: { origin: '*' } });

const processRunner = new ProcessRunner(ROOT_DIR);

// Forward process output to WebSocket clients
processRunner.on('output', (data) => io.emit('process:output', data));
processRunner.on('exit', (data) => io.emit('process:exit', data));
processRunner.on('error', (data) => io.emit('process:error', data));
processRunner.on('execution:error', (data) => io.emit('execution:error', data));
processRunner.on('execution:warning', (data) => io.emit('execution:warning', data));
processRunner.on('execution:trace', (data) => io.emit('execution:trace', data));

// --- Browser Error Handling ---
app.get('/error-reporter.js', (req, res) => {
    try {
        const scriptPath = path.join(__dirname, 'injector/error-reporter.js');
        if (fs.existsSync(scriptPath)) {
            let script = fs.readFileSync(scriptPath, 'utf-8');
            const workingDir = req.query.cwd || '';
            if (workingDir) {
                script = script.replace(
                    'const WORKING_DIR = "";',
                    `const WORKING_DIR = "${workingDir.replace(/\\/g, '\\\\')}";`
                );
            }
            res.type('application/javascript').send(script);
        } else {
            res.status(404).send('// Error reporter script not found');
        }
    } catch (error) {
        res.status(500).send('// Error loading script');
    }
});

app.post('/api/browser-error', (req, res) => {
    const { message, filename, line, column, stack, type } = req.body;
    processRunner.handleBrowserError({ message, filename, line, column, stack, type });
    res.json({ received: true });
});

// API: Detect project
app.get('/api/project/detect', async (req, res) => {
    try {
        const targetDir = req.query.path || ROOT_DIR;
        const detector = new MultiRuntimeDetector(targetDir);
        const runtimes = await detector.detectAll();
        let legacyResponse = { runtimes };
        if (runtimes.length > 0) {
            const primary = runtimes[0];
            legacyResponse = { ...legacyResponse, type: primary.category || 'custom', framework: primary.name, defaultPort: primary.port, commands: runtimes.map(r => ({ name: r.name, command: r.command, icon: r.icon, primary: r === primary })) };
        } else {
            legacyResponse = { ...legacyResponse, type: 'unknown', framework: 'unknown', commands: [], message: 'Could not auto-detect project type' };
        }
        res.json(legacyResponse);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/runtimes/detect', async (req, res) => {
    try {
        const targetDir = req.query.path || ROOT_DIR;
        const detector = new MultiRuntimeDetector(targetDir);
        const runtimes = await detector.detectAll();
        res.json({ runtimes });
    } catch (error) {
        console.error("Detection error:", error);
        res.status(500).json({ error: error.message });
    }
});

// API: Process Control
app.post('/api/process/start', async (req, res) => {
    const { id, command, cwd } = req.body;
    try {
        const result = processRunner.start(id || 'default', command, cwd || ROOT_DIR);
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

const statusHandler = (req, res) => {
    const id = req.params.id || 'default';
    const status = processRunner.getStatus(id);
    res.json(status);
};

app.get('/api/process/status/:id', statusHandler);
app.get('/api/process/status', statusHandler);

app.get('/api/process/list', (req, res) => {
    res.json(processRunner.listProcesses());
});

// API: Get current execution states
app.get('/api/execution/states', (req, res) => {
    const states = processRunner.getExecutionStates();
    res.json(states);
});

// API: Clear errors
app.post('/api/execution/clear-errors', (req, res) => {
    processRunner.clearErrors();
    res.json({ success: true });
});

// SPA Catch-all
app.get(/.*/, (req, res) => {
    if (!req.path.startsWith('/api') && fs.existsSync(path.join(__dirname, '../client/dist/index.html'))) {
        res.sendFile(path.join(__dirname, '../client/dist/index.html'));
    } else if (!req.path.startsWith('/api')) {
        res.status(404).send('Visor client build not found. Run "npm run build" in client directory.');
    }
});

// --- Startup Logic ---
const initializeVisorDir = async () => {
    try {
        // 1. Create .visor directory if it doesn't exist
        await fs.ensureDir(VISOR_DIR);

        // 2. Create default files if they don't exist
        const filesToCreate = {
            'layout.json': {},
            'groups.json': {},
            'preferences.json': {}
        };

        for (const [fileName, content] of Object.entries(filesToCreate)) {
            const filePath = path.join(VISOR_DIR, fileName);
            if (!(await fs.exists(filePath))) {
                await fs.writeJson(filePath, content, { spaces: 2 });
                console.log(`Created default ${fileName}`);
            }
        }

        // 3. Add .visor to .gitignore
        const gitignorePath = path.join(ROOT_DIR, '.gitignore');
        if (await fs.exists(gitignorePath)) {
            let gitignoreContent = await fs.readFile(gitignorePath, 'utf-8');
            if (!gitignoreContent.includes('.visor')) {
                gitignoreContent += '\n\n# Visor project data\n.visor/\n';
                await fs.writeFile(gitignorePath, gitignoreContent);
                console.log('Added .visor to .gitignore');
            }
        } else {
            // If no .gitignore, create one with the .visor entry
            await fs.writeFile(gitignorePath, '# Visor project data\n.visor/\n');
            console.log('Created .gitignore and added .visor entry');
        }

    } catch (error) {
        console.error('Failed to initialize .visor directory:', error);
    }
};

// Start server
server.listen(PORT, async () => {
    await initializeVisorDir();

    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Analyzing project at ${ROOT_DIR}...`);
    try {
        await generateGraph(ROOT_DIR);
        console.log('Initial graph analysis complete.');
    } catch (e) {
        console.error('Initial graph analysis failed:', e);
    }
});
