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
        this.tracer.on('execution:error', (data) => {
            this.emit('execution:error', { ...data, processId: this.activeProcessId });
        });

        this.tracer.on('warning:detected', (data) => {
            this.emit('execution:warning', data);
        });

        this.tracer.on('file:executed', (data) => {
            this.emit('execution:trace', data);
        });
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

        // Simple parsing for spawn (windows compatibility)
        // Usually shell: true handles command strings well
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
            cwd
        });

        // Set active process for error tracking
        this.activeProcessId = id;

        // Handle stdout
        proc.stdout.on('data', (data) => {
            // Send to tracer for analysis
            this.tracer.processOutput(data);

            this.emit('output', {
                id,
                type: 'stdout',
                data: data.toString()
            });
        });

        // Handle stderr
        proc.stderr.on('data', (data) => {
            // Send to tracer for analysis
            this.tracer.processOutput(data);

            this.emit('output', {
                id,
                type: 'stderr',
                data: data.toString()
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
            exitCode: procData.exitCode
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
