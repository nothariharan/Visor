#!/usr/bin/env node
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs-extra');
const path = require('path');
const chokidar = require('chokidar');
const httpProxy = require('http-proxy');
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
const PORT = process.env.PORT || 6767;
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
        res.json({ ...data, root: ROOT_DIR });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/graph - Return graph metadata including root directory
app.get('/api/graph', async (req, res) => {
    try {
        res.json({ root: ROOT_DIR });
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

// Forward process output to WebSocket clients (DEBUG MODE)
processRunner.on('output', (data) => io.emit('process:output', data));
processRunner.on('exit', (data) => { console.log('[DBG:exit] id:', data.id, 'code:', data.code); io.emit('process:exit', data); });
processRunner.on('error', (data) => io.emit('process:error', data));

processRunner.on('execution:error', (data) => {
    console.log('\n[DBG:ERR] execution:error fired!');
    console.log('  primaryFile:', data.primaryFile || '(none)');
    console.log('  error msg  :', (data.error && data.error.message) || '(none)');
    console.log('  frames     :', (data.executionPath && data.executionPath.length) || 0);
    if (data.executionPath && data.executionPath.length) {
        data.executionPath.forEach(function (f, i) { console.log('    [' + i + '] ' + f.file); });
    }
    io.emit('execution:error', data);
});

processRunner.on('execution:warning', (data) => {
    console.log('[DBG:WARN] execution:warning:', data.file || '(no file)');
    io.emit('execution:warning', data);
});

processRunner.on('execution:trace', (data) => {
    console.log('[DBG:TRC] execution:trace:', data.file || data.id || '(no id)');
    io.emit('execution:trace', data);
});

processRunner.on('url', (data) => {
    console.log('[DBG:URL] process url:', data.url);
    io.emit('process:url', data);

    // --- Auto-inject error reporter into the project's index.html ---
    (async () => {
        try {
            const procData = processRunner.processes && processRunner.processes.get(data.id);
            const cwd = procData ? procData.cwd : ROOT_DIR;
            // Find index.html — could be in project root, public/, or src/
            const candidates = [
                path.join(cwd, 'index.html'),
                path.join(cwd, 'public', 'index.html'),
            ];
            const htmlPath = candidates.find(p => fs.existsSync(p));
            if (!htmlPath) {
                console.log('[AutoPatch] No index.html found in', cwd);
                return;
            }
            let html = await fs.readFile(htmlPath, 'utf8');
            if (html.includes('visor-tracker') || html.includes('error-reporter.js')) {
                console.log('[AutoPatch] Already injected in', htmlPath);
                return;
            }
            const scriptUrl = 'http://localhost:' + PORT + '/error-reporter.js?cwd=' + encodeURIComponent(cwd);
            const injectionTag = '<script id="visor-tracker" src="' + scriptUrl + '"></script>';
            if (html.includes('</head>')) {
                html = html.replace('</head>', '  ' + injectionTag + '\n</head>');
            } else {
                html += '\n' + injectionTag;
            }
            await fs.writeFile(htmlPath, html, 'utf8');
            console.log('[AutoPatch] Injected error-reporter into', htmlPath);
            io.emit('process:patch-status', { id: data.id, patched: true, path: htmlPath });
        } catch (err) {
            console.error('[AutoPatch] Failed:', err.message);
        }
    })();
});

processRunner.on('execution:entry', (data) => {
    console.log('[DBG:ENTRY] execution:entry:', data.file || '(no file)');
    io.emit('execution:entry', data);
});

processRunner.on('execution:import', (data) => {
    console.log('[DBG:IMP] execution:import:', data.file || '(no file)');
    io.emit('execution:import', data);
});

processRunner.on('execution:component', (data) => {
    console.log('[DBG:COMP] execution:component:', data.file || '(no file)');
    io.emit('execution:component', data);
});

processRunner.on('execution:start', (data) => {
    console.log('[DBG:START] execution:start port:', data.port || '(unknown)');
    io.emit('execution:start', data);
});

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

// --- AI Fix Endpoints ---
const { GoogleGenerativeAI } = require('@google/generative-ai');

app.post('/api/ai/fix-error', async (req, res) => {
    try {
        const { filePath, error } = req.body;
        if (!filePath) return res.status(400).json({ success: false, error: 'filePath required' });

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) return res.status(500).json({ success: false, error: 'GEMINI_API_KEY not set' });

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ success: false, error: 'File not found: ' + filePath });
        }

        const fileContent = await fs.readFile(filePath, 'utf8');
        const fileName = path.basename(filePath);

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

        const prompt = `You are an expert JavaScript/React developer fixing a runtime error.

FILE: ${fileName}
ERROR: ${error.message}
ERROR TYPE: ${error.type}
${error.line ? 'LINE: ' + error.line : ''}

CURRENT FILE CONTENT:
\`\`\`
${fileContent}
\`\`\`

Fix the error in this file. Return ONLY the complete fixed file content with no markdown, no explanation, no code fences. Just the raw fixed code.`;

        console.log('[AI Fix] Calling Gemini for:', fileName, error.message);
        const result = await model.generateContent(prompt);
        const fixedContent = result.response.text().trim();

        // Strip markdown code fences if model included them anyway
        const cleaned = fixedContent.replace(/^```[\w]*\n?/, '').replace(/\n?```$/, '');
        console.log('[AI Fix] Got fix, length:', cleaned.length);

        res.json({ success: true, fix: cleaned, message: 'Fix generated' });
    } catch (err) {
        console.error('[AI Fix] Error:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post('/api/ai/apply-fix', async (req, res) => {
    try {
        const { filePath, fixedContent } = req.body;
        if (!filePath || !fixedContent) {
            return res.status(400).json({ success: false, error: 'filePath and fixedContent required' });
        }
        // Backup original
        const backup = filePath + '.visor-backup';
        if (fs.existsSync(filePath)) {
            await fs.copyFile(filePath, backup);
        }
        await fs.writeFile(filePath, fixedContent, 'utf8');
        console.log('[AI Fix] Applied fix to:', filePath);
        res.json({ success: true, message: 'Fix applied to ' + path.basename(filePath) });
    } catch (err) {
        console.error('[AI Fix] Apply error:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});



// --- Native HTML Patcher ---
app.post('/api/project/patch-html', async (req, res) => {
    try {
        const targetDir = req.body.path || ROOT_DIR;
        const htmlPath = path.join(targetDir, 'index.html');

        if (!fs.existsSync(htmlPath)) {
            return res.status(404).json({ success: false, error: 'index.html not found in project root' });
        }

        let html = await fs.readFile(htmlPath, 'utf8');
        const scriptUrl = `http://localhost:${PORT}/error-reporter.js?cwd=${encodeURIComponent(targetDir)}`;
        const injectionTag = `<script id="visor-tracker" src="${scriptUrl}"></script>`;

        if (html.includes('visor-tracker') || html.includes('error-reporter.js')) {
            return res.json({ success: true, message: 'Tracker already installed in index.html' });
        }

        if (html.includes('</head>')) {
            html = html.replace('</head>', `  ${injectionTag}\n</head>`);
        } else if (html.includes('</body>')) {
            html = html.replace('</body>', `  ${injectionTag}\n</body>`);
        } else {
            html += `\n${injectionTag}`;
        }

        await fs.writeFile(htmlPath, html, 'utf8');
        res.json({ success: true, message: 'Successfully patched index.html' });
    } catch (err) {
        console.error('Patch HTML Error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// --- AI Auto Fix Service ---
const { AIFixService } = require('./ai/fix-service');
const fixService = new AIFixService(process.env.GEMINI_API_KEY);

app.post('/api/ai/fix-error', async (req, res) => {
    const { filePath, error } = req.body;
    if (!filePath || !error) return res.status(400).json({ success: false, error: 'Missing filePath or error' });
    const result = await fixService.fixError(filePath, error);
    if (result.success) io.emit('ai:fix-applied', { filePath, message: result.message });
    res.json(result);
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
        console.log('[Runtimes] Detecting runtimes in:', targetDir);
        const detector = new MultiRuntimeDetector(targetDir);
        const runtimes = await detector.detectAll();
        console.log('[Runtimes] Found runtimes:', runtimes.map(r => ({ id: r.id, name: r.name, port: r.port })));
        res.json({ runtimes });
    } catch (error) {
        console.error("Detection error:", error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/executables/find - Find all executable files in project
app.get('/api/executables/find', async (req, res) => {
    try {
        const executables = [];
        const ignoreDirs = new Set(['.git', 'node_modules', 'dist', 'build', 'coverage', '.visor', '.next', 'out']);
        const executableExtensions = new Set(['.sh', '.bash', '.py', '.rb', '.go', '.ts', '.js', '.pl', '.php', '.jar', '.exe', '.bat', '.cmd', '.ps1']);

        async function scanDir(dir) {
            try {
                const entries = await fs.readdir(dir, { withFileTypes: true });

                for (const entry of entries) {
                    if (entry.isDirectory()) {
                        if (!ignoreDirs.has(entry.name)) {
                            await scanDir(path.join(dir, entry.name));
                        }
                    } else if (entry.isFile()) {
                        const fullPath = path.join(dir, entry.name);
                        const ext = path.extname(entry.name).toLowerCase();
                        const relativePath = path.relative(ROOT_DIR, fullPath);

                        // Check file extension OR check for shebang (executable bit on Unix)
                        if (executableExtensions.has(ext)) {
                            try {
                                const stats = await fs.stat(fullPath);
                                // On Windows, just check extension; on Unix, check executable bit
                                const isExecutable = process.platform === 'win32'
                                    ? true
                                    : (stats.mode & 0o111) !== 0;

                                if (isExecutable) {
                                    executables.push({
                                        path: relativePath,
                                        name: entry.name,
                                        fullPath: fullPath,
                                        extension: ext,
                                        type: getExecutableType(ext, entry.name)
                                    });
                                }
                            } catch (err) {
                                // Skip files we can't stat
                            }
                        }
                    }
                }
            } catch (err) {
                // Skip directories we can't read
            }
        }

        function getExecutableType(ext, name) {
            const extLower = ext.toLowerCase();
            if (['.sh', '.bash'].includes(extLower)) return 'shell';
            if (['.py'].includes(extLower)) return 'python';
            if (['.js', '.ts'].includes(extLower)) return 'node';
            if (['.rb'].includes(extLower)) return 'ruby';
            if (['.go'].includes(extLower)) return 'go';
            if (['.pl'].includes(extLower)) return 'perl';
            if (['.php'].includes(extLower)) return 'php';
            if (['.jar'].includes(extLower)) return 'java';
            if (['.exe', '.bat', '.cmd', '.ps1'].includes(extLower)) return 'windows';
            return 'unknown';
        }

        await scanDir(ROOT_DIR);

        // Sort by name
        executables.sort((a, b) => a.name.localeCompare(b.name));

        res.json({ executables });
    } catch (error) {
        console.error("Executable detection error:", error);
        res.status(500).json({ error: error.message });
    }
});

// POST /api/executables/run - Run an executable file
app.post('/api/executables/run', async (req, res) => {
    try {
        const { path: filePath, args = [], cwd } = req.body;

        if (!filePath) {
            return res.status(400).json({ error: 'File path required' });
        }

        const fullPath = path.resolve(ROOT_DIR, filePath);

        // Security: Ensure path is within ROOT_DIR
        if (!fullPath.startsWith(ROOT_DIR)) {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Use a unique ID for this execution
        const executionId = `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const workingDir = cwd || path.dirname(fullPath);

        // Detect command based on file extension
        let command = fullPath;
        const ext = path.extname(filePath).toLowerCase();

        if (ext === '.py') {
            command = `python "${fullPath}"`;
        } else if (ext === '.rb') {
            command = `ruby "${fullPath}"`;
        } else if (ext === '.sh' || ext === '.bash') {
            command = `bash "${fullPath}"`;
        } else if (ext === '.js' || ext === '.ts') {
            command = ext === '.ts' ? `npx ts-node "${fullPath}"` : `node "${fullPath}"`;
        } else if (ext === '.go') {
            command = `go run "${fullPath}"`;
        }

        // Start the process
        const result = processRunner.start(executionId, command, workingDir);

        res.json({
            success: true,
            executionId,
            message: `Started executing ${path.basename(filePath)}`
        });
    } catch (error) {
        console.error("Executable run error:", error);
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


// ------------------ Forge Endpoints ------------------

// GET /api/forge/executable-folders
// Returns an array of detected runtimes grouped by folder (minimal metadata)
app.get('/api/forge/executable-folders', async (req, res) => {
    try {
        const detector = new MultiRuntimeDetector(ROOT_DIR);
        const runtimes = await detector.detectAll();

        if (!runtimes) {
            return res.json({ folders: [] });
        }

        // Map runtimes to folder cards; allow multiple runtimes per folder
        const grouped = {};
        for (const r of runtimes) {
            const folderPath = r.workingDir || ROOT_DIR;
            if (!folderPath.startsWith(ROOT_DIR)) continue; // Safety
            if (!grouped[folderPath]) {
                grouped[folderPath] = {
                    name: r.name || path.basename(folderPath),
                    path: folderPath,
                    description: r.description || r.framework || '',
                    executables: [],
                    metadata: {
                        fileCount: 0,
                        lastModified: null
                    }
                };
            }
            grouped[folderPath].executables.push({ name: r.name, command: r.command, id: r.id, framework: r.framework, port: r.port });
        }

        // Populate metadata (fileCount, lastModified) for each folder (async)
        await Promise.all(Object.keys(grouped).map(async (fp) => {
            try {
                const stats = await fs.stat(fp);
                grouped[fp].metadata.lastModified = stats.mtimeMs;
            } catch (e) {
                // ignore
            }

            // quick file count (non-recursive to be fast)
            try {
                const files = await fs.readdir(fp);
                grouped[fp].metadata.fileCount = files.length;
            } catch (e) {
                grouped[fp].metadata.fileCount = 0;
            }
        }));

        res.json({ folders: Object.values(grouped) });
    } catch (error) {
        console.error('Error listing executable folders:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /api/forge/inspect
// Body: { path: string }
// Returns: { path, metadata, executables: [{ name, command, id, framework }] }
app.post('/api/forge/inspect', async (req, res) => {
    try {
        const { path: folderPath } = req.body;
        if (!folderPath) return res.status(400).json({ error: 'Missing path' });

        const absolute = path.resolve(folderPath);
        if (!absolute.startsWith(ROOT_DIR)) return res.status(403).json({ error: 'Access denied' });

        // Use detector to find runtimes and filter by workingDir
        const detector = new MultiRuntimeDetector(absolute);
        const runtimes = await detector.detectAll();

        // Build metadata
        const metadata = {};
        try {
            const stats = await fs.stat(absolute);
            metadata.lastModified = stats.mtimeMs;
        } catch (e) {
            metadata.lastModified = null;
        }
        try {
            const files = await fs.readdir(absolute);
            metadata.fileCount = files.length;
        } catch (e) {
            metadata.fileCount = 0;
        }

        res.json({ path: absolute, metadata, executables: runtimes.map(r => ({ name: r.name, command: r.command, id: r.id, framework: r.framework, port: r.port })) });
    } catch (error) {
        console.error('Error inspecting folder:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /api/forge/run
// Body: { path: string, command?: string }
// Starts the chosen command in the folder. If command is omitted, uses the first detected executable.
app.post('/api/forge/run', async (req, res) => {
    try {
        const { path: folderPath, command } = req.body;
        if (!folderPath) return res.status(400).json({ error: 'Missing path' });

        const absolute = path.resolve(folderPath);
        if (!absolute.startsWith(ROOT_DIR)) return res.status(403).json({ error: 'Access denied' });

        // Inspect to find candidates
        const detector = new MultiRuntimeDetector(absolute);
        const runtimes = await detector.detectAll();
        if (!runtimes || runtimes.length === 0) {
            return res.status(400).json({ error: 'No executable candidates found in folder.' });
        }

        // Choose command
        let selected = null;
        if (command) selected = runtimes.find(r => r.command === command || r.id === command || r.name === command);
        if (!selected) selected = runtimes[0];
        if (!selected) return res.status(400).json({ error: 'No executable selected.' });

        // Safety: allow only commands that are simple npm/yarn/pnpm or node <file> or common start scripts
        const allowedPatterns = [/^npm( run)? /, /^yarn /, /^pnpm( run)? /, /^node /, /^next /, /^vite /, /^react-scripts /, /^ng /];
        const isAllowed = allowedPatterns.some(p => p.test((selected.command || '').toString()));
        if (!isAllowed) {
            // As a fallback, allow plain commands like 'serve' or 'dev' if referenced as npm scripts (prefer npm run <script>)
            // For safety, if command doesn't match allowlist, reject
            return res.status(403).json({ error: 'Command not allowed to run for safety reasons.' });
        }

        // Build command string. If the runtime already provides a full command use it; otherwise attempt to convert shorthand into 'npm run'
        let cmd = selected.command;
        if (!cmd.startsWith('npm') && !cmd.startsWith('yarn') && !cmd.startsWith('pnpm') && !cmd.startsWith('node') && !cmd.startsWith('next') && !cmd.startsWith('vite') && !cmd.startsWith('react-scripts') && !cmd.startsWith('ng')) {
            // attempt to find script name in package.json
            try {
                const pkgPath = path.join(absolute, 'package.json');
                if (await fs.exists(pkgPath)) {
                    const pkg = JSON.parse(await fs.readFile(pkgPath, 'utf-8'));
                    const scripts = pkg.scripts || {};
                    const scriptName = Object.keys(scripts).find(k => scripts[k] === cmd || scripts[k].includes(cmd));
                    if (scriptName) cmd = `npm run ${scriptName}`;
                }
            } catch (e) {
                // ignore
            }
        }

        // Start process through ProcessRunner
        // Use the absolute path as the ID so the frontend can track output by folder path
        const procId = absolute;
        const result = processRunner.start(procId, cmd, absolute);

        res.json({ success: true, id: result.id, pid: result.pid, command: result.command, status: result.status });
    } catch (error) {
        console.error('Error running executable:', error);
        res.status(500).json({ error: error.message });
    }
});

// SPA Catch-all
app.get(/.*/, (req, res) => {
    // If it's an unmatched API request, return 404 immediately
    if (req.path.startsWith('/api')) {
        return res.status(404).json({ error: 'API route not found' });
    }

    if (fs.existsSync(path.join(__dirname, '../client/dist/index.html'))) {
        res.sendFile(path.join(__dirname, '../client/dist/index.html'));
    } else {
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

// Start server with port fallback
const startServer = (port) => {
    server.listen(port, async () => {
        await initializeVisorDir();

        console.log(`\n✅ Server running on http://localhost:${port}`);
        console.log(`📍 Analyzing project at ${ROOT_DIR}...`);
        try {
            await generateGraph(ROOT_DIR);
            console.log('✅ Initial graph analysis complete.\n');
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

    server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.warn(`⚠️  Port ${port} is already in use, trying port ${port + 1}...`);
            startServer(port + 1);
        } else {
            console.error('Server error:', err);
            process.exit(1);
        }
    });
};

startServer(PORT);

