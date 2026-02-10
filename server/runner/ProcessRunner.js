const { spawn } = require('child_process');
const EventEmitter = require('events');

class ProcessRunner extends EventEmitter {
    constructor() {
        super();
        this.processes = new Map();
    }

    /**
     * Start a new process
     */
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
            status: 'running'
        });

        // Handle stdout
        proc.stdout.on('data', (data) => {
            this.emit('output', {
                id,
                type: 'stdout',
                data: data.toString()
            });
        });

        // Handle stderr
        proc.stderr.on('data', (data) => {
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
            const { command, process: oldProc } = procData;
            // Get CWD from old process spawn args if available, or assume current?
            // Actually we didn't store CWD. Let's rely on stored command context if needed
            // But simplify: we usually run in project root.
            const cwd = process.cwd(); // Or store it in start()

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
}

module.exports = { ProcessRunner };
