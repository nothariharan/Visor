#!/usr/bin/env node
const express = require('express');
const cors = require('cors');
const fs = require('fs-extra');
const path = require('path');
const chokidar = require('chokidar');
const { generateGraph, getCachedGraph } = require('./graph');
const {
    getGitMetadata,
    getRepoStatus,
    stageFiles,
    unstageFiles,
    commitChanges,
    discardChanges,
    pushChanges,
    pullChanges,
    getFileDiff,
    undoLastCommit,
    getCommitHistory,
    getCurrentHead,
    checkSafety,
    timeTravel,
    returnToPresent,
    getCommitDetails
} = require('./git');
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

// POST /api/visor/reset-layout
app.post('/api/visor/reset-layout', async (req, res) => {
    const layoutPath = path.join(VISOR_DIR, 'layout.json');
    try {
        if (await fs.exists(layoutPath)) {
            await fs.remove(layoutPath);
            console.log('Layout file removed');
        }
        res.json({ success: true, message: 'Layout reset successfully' });
    } catch (error) {
        console.error('Error resetting layout:', error);
        res.status(500).json({ error: 'Failed to reset layout.' });
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

// Replace the existing Git Metadata Endpoint block
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

// --- Chronicle Git Endpoints ---
app.get('/api/chronicle/status', async (req, res) => {
    const status = await getRepoStatus(ROOT_DIR);
    res.json(status);
});

app.post('/api/chronicle/stage', async (req, res) => {
    const { files } = req.body;
    if (!files) return res.status(400).json({ error: 'Files required' });
    const result = await stageFiles(ROOT_DIR, files);
    res.json(result);
});

app.post('/api/chronicle/unstage', async (req, res) => {
    const { files } = req.body;
    if (!files) return res.status(400).json({ error: 'Files required' });
    const result = await unstageFiles(ROOT_DIR, files);
    res.json(result);
});

app.post('/api/chronicle/commit', async (req, res) => {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Message required' });
    const result = await commitChanges(ROOT_DIR, message);
    res.json(result);
});

app.post('/api/chronicle/discard', async (req, res) => {
    const { files } = req.body;
    if (!files) return res.status(400).json({ error: 'Files required' });
    const result = await discardChanges(ROOT_DIR, files);
    res.json(result);
});

app.post('/api/chronicle/push', async (req, res) => {
    const result = await pushChanges(ROOT_DIR);
    res.json(result);
});

app.post('/api/chronicle/pull', async (req, res) => {
    const result = await pullChanges(ROOT_DIR);
    res.json(result);
});

app.get('/api/chronicle/diff', async (req, res) => {
    const { path: filePath } = req.query;
    if (!filePath) return res.status(400).json({ error: 'Path required' });
    const result = await getFileDiff(ROOT_DIR, filePath);
    res.json(result);
});

app.post('/api/chronicle/undo', async (req, res) => {
    const result = await undoLastCommit(ROOT_DIR);
    res.json(result);
});

// --- Chronicle Time Travel Endpoints ---
app.get('/api/chronicle/history', async (req, res) => {
    const result = await getCommitHistory(ROOT_DIR);
    res.json(result);
});

app.get('/api/chronicle/current', async (req, res) => {
    const result = await getCurrentHead(ROOT_DIR);
    res.json(result);
});

app.get('/api/chronicle/check-safety', async (req, res) => {
    const result = await checkSafety(ROOT_DIR);
    res.json(result);
});

app.post('/api/chronicle/checkout', async (req, res) => {
    const { hash, force } = req.body;
    if (!hash) return res.status(400).json({ error: 'Commit hash required' });
    const result = await timeTravel(ROOT_DIR, hash, { force: !!force });
    res.json(result);
});

app.post('/api/chronicle/return', async (req, res) => {
    const result = await returnToPresent(ROOT_DIR);
    res.json(result);
});

app.get('/api/chronicle/commit/:hash', async (req, res) => {
    const { hash } = req.params;
    const result = await getCommitDetails(ROOT_DIR, hash);
    res.json(result);
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

// --- File Search & Indexing ---
let fileIndex = [];
let lastIndexTime = 0;
const INDEX_CACHE_DURATION = 5000; // 5 seconds

// Simple fuzzy matching algorithm
function fuzzyMatch(query, filename) {
    query = query.toLowerCase();
    filename = filename.toLowerCase();

    let queryIdx = 0;
    let matchScore = 0;

    for (let i = 0; i < filename.length && queryIdx < query.length; i++) {
        if (filename[i] === query[queryIdx]) {
            queryIdx++;
            matchScore += 1;
            // Bonus for consecutive matches
            if (i > 0 && filename[i - 1] === query[queryIdx - 2]) {
                matchScore += 0.5;
            }
        }
    }

    // Return false if not all characters were found in order
    if (queryIdx !== query.length) return false;

    // Penalize matches further into the string
    return matchScore - filename.length * 0.1;
}

// Get matched character positions for highlighting
function getMatchPositions(query, filename) {
    query = query.toLowerCase();
    filename = filename.toLowerCase();

    const positions = [];
    let queryIdx = 0;

    for (let i = 0; i < filename.length && queryIdx < query.length; i++) {
        if (filename[i] === query[queryIdx]) {
            positions.push(i);
            queryIdx++;
        }
    }

    return queryIdx === query.length ? positions : [];
}

// Build file index by scanning the directory
async function buildFileIndex() {
    const now = Date.now();

    // Use cache if fresh
    if (fileIndex.length > 0 && now - lastIndexTime < INDEX_CACHE_DURATION) {
        return fileIndex;
    }

    const index = [];
    const ignoreDirs = new Set(['.git', 'node_modules', 'dist', 'build', 'coverage', '.visor', '.vscode', '__pycache__']);

    async function scanDir(dir, relativePrefix = '') {
        try {
            const dirents = await fs.readdir(dir, { withFileTypes: true });

            for (const dirent of dirents) {
                if (dirent.name.startsWith('.') && !relativePrefix) continue; // Skip hidden at root
                if (ignoreDirs.has(dirent.name)) continue;

                const fullPath = path.join(dir, dirent.name);
                const relativePath = path.join(relativePrefix, dirent.name);

                if (dirent.isDirectory()) {
                    await scanDir(fullPath, relativePath);
                } else {
                    index.push({
                        name: dirent.name,
                        path: fullPath,
                        relativePath: relativePath,
                        ext: path.extname(dirent.name)
                    });

                    if (index.length >= 500) {
                        break; // Limit to 500 files
                    }
                }
            }
        } catch (e) {
            // Permission denied or other errors
        }
    }

    await scanDir(ROOT_DIR);
    fileIndex = index;
    lastIndexTime = now;

    return index;
}

// GET /api/search/files?q=query
app.get('/api/search/files', async (req, res) => {
    try {
        const { q = '' } = req.query;

        if (!q || q.length < 1) {
            return res.json({ results: [] });
        }

        const index = await buildFileIndex();
        const results = [];

        for (const file of index) {
            const score = fuzzyMatch(q, file.name);

            if (score !== false) {
                const positions = getMatchPositions(q, file.name);
                results.push({
                    ...file,
                    score,
                    matchPositions: positions
                });
            }
        }

        // Sort by score (descending) and limit to 50
        results.sort((a, b) => b.score - a.score);

        res.json({
            results: results.slice(0, 50),
            total: results.length
        });
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/search/recent
app.get('/api/search/recent', async (req, res) => {
    try {
        const prefsPath = path.join(VISOR_DIR, 'preferences.json');
        let prefs = {};

        if (await fs.exists(prefsPath)) {
            prefs = await fs.readJson(prefsPath);
        }

        const recentFiles = prefs.recentFiles || [];
        // Sort by lastOpened (newest first)
        recentFiles.sort((a, b) => b.lastOpened - a.lastOpened);

        res.json({ recent: recentFiles.slice(0, 20) });
    } catch (error) {
        console.error('Recent files error:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /api/search/recent (track file opened)
app.post('/api/search/recent', async (req, res) => {
    try {
        const { path: filePath } = req.body;

        if (!filePath) {
            return res.status(400).json({ error: 'Missing path' });
        }

        const prefsPath = path.join(VISOR_DIR, 'preferences.json');
        let prefs = {};

        if (await fs.exists(prefsPath)) {
            prefs = await fs.readJson(prefsPath);
        }

        let recentFiles = prefs.recentFiles || [];

        // Remove if already exists
        recentFiles = recentFiles.filter(f => f.path !== filePath);

        // Add to front
        recentFiles.unshift({
            path: filePath,
            lastOpened: Date.now()
        });

        // Keep only 20 most recent
        recentFiles = recentFiles.slice(0, 20);

        prefs.recentFiles = recentFiles;
        await fs.ensureDir(VISOR_DIR);
        await fs.writeJson(prefsPath, prefs, { spaces: 2 });

        res.json({ success: true });
    } catch (error) {
        console.error('Recent files tracking error:', error);
        res.status(500).json({ error: error.message });
    }
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

    // --- File Watcher for Chronicle Auto-Refresh ---
    chokidar.watch(ROOT_DIR, {
        ignored: [/(^|[\/\\])\../, '**/node_modules/**', '**/dist/**', '**/build/**'],
        persistent: true,
        ignoreInitial: true
    }).on('all', (event, path) => {
        // Emit event to all connected clients
        io.emit('chronicle:update', { event, path });
    });
});
