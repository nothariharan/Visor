const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');

class ExecutionTracer extends EventEmitter {
    constructor(projectRoot) {
        super();
        this.projectRoot = projectRoot || process.cwd();
        this.fileStates = new Map();
        this.errors = [];
    }

    /**
     * Process Output from Terminal (stdout/stderr)
     */
    processOutput(data) {
        // Strip ANSI codes for easier regex matching
        const output = data.toString().replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');

        // 1. Vite Error Format
        // [vite] Internal server error: ...
        // Plugin: vite:import-analysis
        // File: /path/to/file.jsx:10:15
        if (output.includes('[vite]') && output.includes('Error:')) {
            this.handleViteError(output);
            return;
        }

        // 2. Standard Node.js Error / Stack Trace
        // Error: message
        //     at Function (file:line:col)
        if (output.includes('Error:') && output.includes('    at ')) {
            this.handleNodeError(output);
            return;
        }

        // 3. Basic "error:" string detection (Fallback)
        if (output.toLowerCase().includes('error:')) {
            const errorData = {
                message: output.trim(),
                timestamp: Date.now(),
                type: 'TerminalError'
            };
            this.emitError(errorData);
        }

        // Warning detection
        if (output.toLowerCase().includes('warning:')) {
            this.emit('warning:detected', {
                message: output.trim(),
                timestamp: Date.now()
            });
        }

        // File Execution Tracking (unchanged)
        const executionMatch = output.match(/(?:running|executing)\s+([^\s]+\.(?:js|jsx|ts|tsx))/i);
        if (executionMatch) {
            const fileName = executionMatch[1];
            // Try to resolve relative to root
            const absolutePath = path.resolve(this.projectRoot, fileName);

            this.fileStates.set(absolutePath, 'running');
            this.emit('file:executed', {
                file: absolutePath,
                startDate: Date.now(),
                status: 'running'
            });
        }
    }

    /**
     * Process Error from Browser (via API)
     */
    processBrowserError(data) {
        // data: { message, filename, line, column, stack, type, workingDir }

        // Use the provided workingDir or fall back to project root
        const baseDir = data.workingDir || this.projectRoot;

        const files = [];

        // If we have a direct filename/line
        if (data.filename) {
            const normalized = this.normalizePathForGraph(data.filename, baseDir);
            if (normalized) {
                files.push({
                    file: normalized,
                    line: data.line,
                    column: data.column
                });
            }
        }

        // Parse stack trace for more frames
        if (data.stack) {
            const stackFiles = this.parseBrowserStack(data.stack, baseDir);
            files.push(...stackFiles);
        }

        // Dedup files
        const uniqueFiles = [];
        const seen = new Set();
        files.forEach(f => {
            if (!seen.has(f.file)) {
                seen.add(f.file);
                uniqueFiles.push(f);
            }
        });

        const errorEvent = {
            error: {
                message: data.message,
                type: data.type || 'BrowserError',
                stack: uniqueFiles
            },
            primaryFile: uniqueFiles.length > 0 ? uniqueFiles[0].file : null,
            executionPath: uniqueFiles
        };

        console.log('[Tracer] Emitting execution:error');
        console.log('[Tracer] Primary File:', errorEvent.primaryFile);
        console.log('[Tracer] Stack Frame Count:', uniqueFiles.length);

        this.emit('execution:error', errorEvent);
    }

    /**
     * Handle Vite Terminal Errors
     */
    handleViteError(text) {
        // Try to find "File: /path/to/file:line:col"
        const fileMatch = text.match(/File:\s+(.+?):(\d+):(\d+)/);

        let files = [];
        if (fileMatch) {
            const filePath = this.normalizePathForGraph(fileMatch[1]);
            if (filePath) {
                files.push({
                    file: filePath,
                    line: parseInt(fileMatch[2]),
                    column: parseInt(fileMatch[3])
                });
            }
        }

        // Extract message
        // Usually line after "Internal server error:"
        const messageMatch = text.match(/server error:\s+(.+)/i) || text.match(/Error:\s+(.+)/);
        const message = messageMatch ? messageMatch[1] : 'Build/Runtime Error';

        this.emit('execution:error', {
            error: {
                message: message.trim(),
                type: 'ViteError',
                stack: files
            },
            primaryFile: files.length > 0 ? files[0].file : null,
            executionPath: files
        });
    }

    /**
     * Handle Node.js Terminal Stack Traces
     */
    handleNodeError(text) {
        const lines = text.split('\n');
        const message = lines[0]; // First line is usually the error message

        const stackFrames = [];

        // regex for "at Function (file:line:col)" or "at file:line:col"
        // Note: Terminal output might confuse paths, so we look for absolute paths or relative to root

        const regex = /at\s+(?:.+?\s+\()?(?:(.+?):(\d+):(\d+))\)?/;

        for (const line of lines) {
            const match = line.match(regex);
            if (match) {
                const rawPath = match[1];
                const normalized = this.normalizePathForGraph(rawPath);

                if (normalized) {
                    stackFrames.push({
                        file: normalized,
                        line: parseInt(match[2]),
                        column: parseInt(match[3])
                    });
                }
            }
        }

        if (stackFrames.length > 0) {
            this.emit('execution:error', {
                error: {
                    message: message,
                    type: 'NodeError',
                    stack: stackFrames
                },
                primaryFile: stackFrames[0].file,
                executionPath: stackFrames
            });
        } else {
            // Fallback if no frames parsed
            this.emitError({ message, type: 'NodeError' });
        }
    }

    /**
     * Parse Browser Stack Trace
     * Format: "at FunctionName (http://localhost:5173/src/App.jsx:10:5)"
     */
    parseBrowserStack(stack, baseDir) {
        if (!stack) return [];

        const lines = stack.split('\n');
        const files = [];

        for (const line of lines) {
            const match = line.match(/at\s+.+?\s+\((https?:\/\/.+?):(\d+):(\d+)\)/) ||
                line.match(/at\s+(https?:\/\/.+?):(\d+):(\d+)/);

            if (match) {
                const url = match[1];
                const normalized = this.normalizePathForGraph(url, baseDir);
                if (normalized) {
                    files.push({
                        file: normalized,
                        line: parseInt(match[2]),
                        column: parseInt(match[3])
                    });
                }
            }
        }
        return files;
    }

    /**
     * Normalize paths to match Graph Node IDs (Absolute Windows/POSIX paths)
     */
    normalizePathForGraph(filePath, baseDir) {
        const rootDir = baseDir || this.projectRoot;

        if (!filePath) return null;

        // 1. Handle HTTP URLs (Browser)
        if (filePath.startsWith('http')) {
            // http://localhost:PORT/src/App.jsx
            // Remove origin
            try {
                const urlObj = new URL(filePath);
                let pathname = urlObj.pathname;

                // Vite specific: /@fs/C:/Users/...
                if (pathname.startsWith('/@fs/')) {
                    pathname = pathname.replace('/@fs/', '');
                    // On windows, it might start with /C:/..., so remove leading slash if needed
                    if (process.platform === 'win32' && /^\/[a-zA-Z]:/.test(pathname)) {
                        pathname = pathname.substring(1);
                    }
                }
                // Vite specific: /src/App.jsx -> Join with root
                else {
                    // If it starts with slash, join with the runtime's working directory
                    pathname = path.join(rootDir, pathname);
                }

                // Decode URI components (spaces etc)
                filePath = decodeURIComponent(pathname);

            } catch (e) {
                return null;
            }
        }

        // 2. Handle Absolute Paths
        let absolutePath = filePath;
        if (!path.isAbsolute(filePath)) {
            absolutePath = path.resolve(rootDir, filePath);
        }

        // 3. Filters
        // Ignore node_modules, internal scripts
        if (absolutePath.includes('node_modules')) return null;
        if (absolutePath.includes('vite/dist')) return null;
        if (absolutePath.includes('chrome-extension://')) return null;

        // 4. Verification
        // Optional: Check if file exists? 
        // Might be expensive to do check on every log line, but good for accuracy.
        // For now, assume if it resolves to project root, it's valid.

        return absolutePath;
    }

    emitError(data) {
        this.errors.push(data);
        this.emit('execution:error', {
            error: data,
            primaryFile: null,
            executionPath: []
        });
    }

    getFileStates() {
        return Object.fromEntries(this.fileStates);
    }

    clearAllErrors() {
        this.errors = [];
        this.emit('errors:cleared');
    }
}

module.exports = { ExecutionTracer };
