const { spawn } = require('child_process');
const EventEmitter = require('events');
const { ExecutionTracer } = require('../tracer/ExecutionTracer.js');

class ProcessRunner extends EventEmitter {
    constructor(projectRoot) {
        super();
        this.projectRoot = projectRoot || process.cwd();
        this.processes = new Map();
        this.activeProcessId = null;

        // Add tracer
        this.tracer = new ExecutionTracer(this.projectRoot);

        // Forward tracer events
        this.tracer.on('execution:error', (data) => this.emit('execution:error', data));
        this.tracer.on('execution:warning', (data) => this.emit('execution:warning', data));
        this.tracer.on('warning:detected', (data) => this.emit('execution:warning', data));
        this.tracer.on('execution:trace', (data) => this.emit('execution:trace', data));
        this.tracer.on('execution:import', (data) => this.emit('execution:import', data));
        this.tracer.on('execution:component', (data) => this.emit('execution:component', data));
        this.tracer.on('execution:start', (data) => this.emit('execution:start', data));
        this.tracer.on('execution:entry', (data) => this.emit('execution:entry', data));
        this.tracer.on('file:executed', (data) => this.emit('execution:trace', data));
    }

    handleBrowserError(errorData) {
        // Inject working directory from active process if available and not provided
        if (!errorData.workingDir && this.activeProcessId) {
            const activeProc = this.processes.get(this.activeProcessId);
            if (activeProc && activeProc.cwd) {
                // console.log(`[ProcessRunner] Using CWD from active process ${this.activeProcessId}: ${activeProc.cwd}`);
                errorData.workingDir = activeProc.cwd;
            }
        }
        this.tracer.processBrowserError(errorData);
    }

    start(id, command, cwd) {
        // Stop existing process with same ID first
        this.stop(id);

        console.log(`[ProcessRunner] Starting: ${command} in ${cwd}`);

        const proc = spawn(command, {
            cwd,
            shell: true,
            env: { ...process.env, FORCE_COLOR: '1' } // Force color output for terminal look
        });

        // Store process info
        this.processes.set(id, {
            process: proc,
            command,
            startTime: Date.now(),
            status: 'running',
            cwd,
            url: null
        });

        // Set active process for error tracking
        this.activeProcessId = id;

        // Register CWD with tracer so Vite relative paths can be resolved
        this.tracer.registerProcessCwd(id, cwd);

        // Detect entry point
        this.detectEntryPoint(id, command, cwd);

        // Helper: detect URLs in output
        // ANSI codes from Vite color output break URL regex (e.g. http://\x1b[36mlocalhost\x1b[0m:5173)
        const stripAnsi = (s) => s.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
        const urlRegex = /(https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(?::(\d+))?(?:\/[\w\-\.\/]*)?)/i;
        const portOnlyRegex = /(?:local:|local\s*http[s]?:\/\/localhost:|on port|listening on|http:\/\/localhost:|:\s*)(\d{3,5})/i;

        const detectUrl = (rawStr, procId) => {
            try {
                const str = stripAnsi(rawStr);
                const procData = this.processes.get(procId);
                if (!procData || procData.url) return;
                const match = str.match(urlRegex);
                const url = match ? match[1] : null;
                if (url && url.match(/:\d+/)) {
                    procData.url = url;
                    console.log('[DBG:URL] full url detected:', url);
                    this.emit('url', { id: procId, url });
                } else {
                    const pmatch = str.match(portOnlyRegex);
                    if (pmatch) {
                        const port = pmatch[1];
                        const builtUrl = 'http://localhost:' + port;
                        procData.url = builtUrl;
                        console.log('[DBG:URL] port-only fallback:', builtUrl);
                        this.emit('url', { id: procId, url: builtUrl });
                    } else if (url) {
                        procData.url = url;
                        console.log('[DBG:URL] portless url (last resort):', url);
                        this.emit('url', { id: procId, url });
                    }
                }
            } catch (e) {}
        };

        // Handle stdout
        proc.stdout.on('data', (data) => {
            // Send to tracer for analysis
            this.tracer.processOutput(id, data, 'stdout');

            const str = data.toString();

            // URL detection (uses shared detectUrl helper that strips ANSI codes)
            detectUrl(str, id);

            this.emit('output', {
                id,
                type: 'stdout',
                data: str
            });
        });

        // Handle stderr
        proc.stderr.on('data', (data) => {
            // Send to tracer for analysis
            this.tracer.processOutput(id, data, 'stderr');

            const str = data.toString();

            // URL detection in stderr (uses shared detectUrl helper)
            detectUrl(str, id);

            this.emit('output', {
                id,
                type: 'stderr',
                data: str
            });
        });

        // Handle exit
        proc.on('close', (code) => {
            const procData = this.processes.get(id);
            if (procData) {
                procData.status = 'stopped';
                procData.exitCode = code;
            }

            // Clear active process if this was the active one
            if (this.activeProcessId === id) {
                this.activeProcessId = null;
            }

            this.emit('exit', {
                id,
                code,
                duration: Date.now() - (procData ? procData.startTime : 0)
            });

            // Clean up if needed, but we keep the entry for status checks
            // until restarted
        });

        // Handle errors regarding spawning itself
        proc.on('error', (error) => {
            console.error(`[ProcessRunner] Error spawning ${id}:`, error);
            this.emit('error', {
                id,
                error: error.message
            });
        });

        return {
            id,
            pid: proc.pid,
            command,
            status: 'running'
        };
    }

    detectEntryPoint(processId, command, workingDir) {
        if (!workingDir) return;

        let entryFile = null;

        if (command.includes('node ')) {
            const match = command.match(/node\s+([^\s]+)/);
            entryFile = match ? match[1] : null;
        } else if (command.includes('npm run') || command.includes('npm start')) {
            const fs = require('fs');
            const path = require('path');
            try {
                const pkgPath = path.join(workingDir, 'package.json');
                if (fs.existsSync(pkgPath)) {
                    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
                    const scriptName = command.replace('npm run ', '').replace('npm start', 'start').trim();
                    const scriptCommand = pkg?.scripts?.[scriptName];
                    if (scriptCommand) {
                        entryFile = this.parseScriptCommand(scriptCommand, workingDir);
                    }
                }
            } catch (e) {
                // Ignore
            }
        } else if (command.includes('python')) {
            const match = command.match(/python\s+([^\s]+)/);
            entryFile = match ? match[1] : null;
        }

        if (entryFile) {
            const path = require('path');
            const absolutePath = path.resolve(workingDir, entryFile);

            // Emit entry point detected
            this.emit('execution:entry', {
                processId,
                file: absolutePath,
                timestamp: Date.now()
            });
        }
    }

    parseScriptCommand(scriptCommand, workingDir) {
        if (scriptCommand.includes('node ')) {
            const match = scriptCommand.match(/node\s+([^\s]+)/);
            return match ? match[1] : null;
        }
        if (scriptCommand.includes('nodemon ')) {
            const match = scriptCommand.match(/nodemon\s+([^\s]+)/);
            return match ? match[1] : null;
        }

        const fs = require('fs');
        const path = require('path');
        const commonEntries = ['src/main.js', 'src/main.tsx', 'src/index.js', 'src/index.tsx', 'index.js', 'server.js', 'main.js'];

        for (const entry of commonEntries) {
            if (fs.existsSync(path.join(workingDir, entry))) {
                return entry;
            }
        }
        return null;
    }

    /**
     * Stop a process
     */
    stop(id) {
        const procData = this.processes.get(id);

        if (procData && procData.process && procData.status === 'running') {
            const pid = procData.process.pid;
            console.log(`[ProcessRunner] Stopping process ${id} (PID: ${pid})`);

            // On Windows, tree-kill might be needed for deep processes, 
            // but standard kill usually works for direct spawns with shell: true
            // tree-kill is safer for things like 'npm run dev' which spawns 'node'
            // For now, simple kill. If issues arise, we can use 'tree-kill' package.

            // On Windows, `taskkill` is robust
            if (process.platform === 'win32') {
                try {
                    require('child_process').execSync(`taskkill /pid ${pid} /T /F`);
                } catch (e) {
                    // Ignore if already dead
                }
            } else {
                procData.process.kill('SIGTERM');
                // Force kill if needed
                setTimeout(() => {
                    if (procData.process && !procData.process.killed) {
                        procData.process.kill('SIGKILL');
                    }
                }, 5000);
            }

            procData.status = 'stopped';
            return true;
        }

        return false;
    }

    /**
     * Restart a process
     */
    restart(id) {
        const procData = this.processes.get(id);

        if (procData) {
            const { command, cwd } = procData;

            this.stop(id);

            // Wait brief moment
            setTimeout(() => {
                this.start(id, command, cwd);
            }, 1000);

            return true;
        }
        return false;
    }

    /**
     * Get process status
     */
    getStatus(id) {
        const procData = this.processes.get(id);

        if (!procData) {
            return { status: 'not_found' };
        }

        return {
            id,
            command: procData.command,
            status: procData.status,
            pid: procData.process?.pid,
            uptime: procData.status === 'running' ? Date.now() - procData.startTime : 0,
            exitCode: procData.exitCode,
            url: procData.url || null
        };
    }

    listProcesses() {
        const list = [];
        for (const [id, data] of this.processes.entries()) {
            list.push({
                id,
                command: data.command,
                status: data.status,
                pid: data.process?.pid
            });
        }
        return list;
    }

    // Add method to get file states
    getExecutionStates() {
        return this.tracer.getFileStates();
    }

    // Add method to clear errors
    clearErrors() {
        this.tracer.clearAllErrors();
    }
}

module.exports = { ProcessRunner };
