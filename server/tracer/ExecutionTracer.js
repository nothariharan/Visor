const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');

class ExecutionTracer extends EventEmitter {
    constructor(projectRoot) {
        super();
        this.projectRoot = projectRoot || process.cwd();
        this.fileStates = new Map();
        this.activeTraces = new Map();
        this.errors = [];
    }

    /**
     * Process Output from Terminal (stdout/stderr)
     */
    processOutput(processId, data, stream = 'stdout') {
        // Strip ANSI codes for easier regex matching
        const output = data.toString().replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
        const lines = output.split('\n').filter(Boolean);

        for (const line of lines) {
            // 1. Errors
            if (this.isError(line)) {
                this.handleError(processId, line, output, stream);
                continue;
            }

            // 2. Imports
            if (this.isImportTrace(line)) {
                this.handleImport(processId, line);
                continue;
            }

            // 3. Component Rendering
            if (this.isComponentTrace(line)) {
                this.handleComponent(processId, line);
                continue;
            }

            // 4. Warnings
            if (this.isWarning(line)) {
                this.handleWarning(processId, line);
                continue;
            }

            // 5. Server Start
            if (this.isServerStart(line)) {
                this.handleServerStart(processId, line);
                continue;
            }

            // File Execution Tracking (Fallback/Basic)
            const executionMatch = line.match(/(?:running|executing)\s+([^\s]+\.(?:js|jsx|ts|tsx))/i);
            if (executionMatch) {
                const fileName = executionMatch[1];
                const absolutePath = path.resolve(this.projectRoot, fileName);
                this.fileStates.set(absolutePath, 'running');
                this.emit('file:executed', {
                    processId,
                    file: absolutePath,
                    startDate: Date.now(),
                    status: 'running'
                });
            }
        }
    }

    isError(line) {
        const errorPatterns = [
            /error:/i,
            /exception/i,
            /failed/i,
            /cannot find module/i,
            /undefined/i,
            /ReferenceError/,
            /TypeError/,
            /SyntaxError/
        ];
        return errorPatterns.some(pattern => pattern.test(line));
    }

    isImportTrace(line) {
        return (line.includes('modules transformed') || line.includes('→') || line.includes('importing'));
    }

    isComponentTrace(line) {
        return line.match(/\.(jsx|tsx)/) !== null && !this.isError(line) && !this.isWarning(line);
    }

    isWarning(line) {
        return line.toLowerCase().includes('warning');
    }

    isServerStart(line) {
        const startPatterns = [
            /server.*running/i,
            /listening on/i,
            /ready on/i,
            /local:.*http/i
        ];
        return startPatterns.some(pattern => pattern.test(line));
    }

    handleError(processId, errorLine, fullOutput, stream) {
        let parsed = this.parseError(fullOutput, stream);

        if (!parsed.file) {
            // Try to use the old methods if new parser fails
            if (fullOutput.includes('[vite]') && fullOutput.includes('Error:')) {
                this.handleViteError(processId, fullOutput);
                return;
            }
            if (fullOutput.includes('Error:') && fullOutput.includes('    at ')) {
                this.handleNodeError(processId, fullOutput);
                return;
            }

            // Basic error
            parsed = { message: errorLine.trim(), type: 'TerminalError', stack: fullOutput, file: null };
            this.emit('execution:error', {
                processId,
                error: parsed,
                primaryFile: null,
                timestamp: Date.now()
            });
            return;
        }

        const trace = this.activeTraces.get(processId) || { errors: [] };
        trace.errors.push(parsed);
        this.activeTraces.set(processId, trace);

        this.emit('execution:error', {
            processId,
            error: parsed,
            primaryFile: parsed.file,
            timestamp: Date.now()
        });
    }

    parseError(errorOutput, stream) {
        let match = errorOutput.match(/at\s+(?:.+?\s+\()?(?:([^:]+?):(\d+):(\d+))\)?/);
        if (match) {
            return {
                file: this.normalizePathForGraph(match[1]),
                line: parseInt(match[2]),
                column: parseInt(match[3]),
                message: this.extractErrorMessage(errorOutput),
                type: this.detectErrorType(errorOutput),
                stack: errorOutput
            };
        }

        match = errorOutput.match(/File:\s+(.+?):(\d+):(\d+)/) || errorOutput.match(/([^:\s"']+):(\d+):(\d+)/);
        // Exclude generic vite URLs like http://localhost
        if (match && !match[1].startsWith('http')) {
            return {
                file: this.normalizePathForGraph(match[1]),
                line: parseInt(match[2]),
                column: parseInt(match[3]),
                message: this.extractErrorMessage(errorOutput),
                type: 'ViteError',
                stack: errorOutput
            };
        }

        match = errorOutput.match(/File\s+"([^"]+)",\s+line\s+(\d+)/);
        if (match) {
            return {
                file: this.normalizePathForGraph(match[1]),
                line: parseInt(match[2]),
                column: 0,
                message: this.extractErrorMessage(errorOutput),
                type: 'PythonError',
                stack: errorOutput
            };
        }

        return { message: errorOutput, file: null };
    }

    extractErrorMessage(errorOutput) {
        const lines = errorOutput.split('\n');
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('at ')) {
                return trimmed;
            }
        }
        return errorOutput.substring(0, 200).trim();
    }

    detectErrorType(errorOutput) {
        if (errorOutput.includes('ReferenceError')) return 'ReferenceError';
        if (errorOutput.includes('TypeError')) return 'TypeError';
        if (errorOutput.includes('SyntaxError')) return 'SyntaxError';
        if (errorOutput.includes('Cannot find module')) return 'ModuleNotFoundError';
        return 'RuntimeError';
    }

    handleImport(processId, line) {
        const fileMatch = line.match(/→\s+(.+)/);
        if (fileMatch) {
            const file = this.normalizePathForGraph(fileMatch[1]);
            this.emit('execution:import', { processId, file, timestamp: Date.now() });
        }
    }

    handleComponent(processId, line) {
        const fileMatch = line.match(/([^\s"']+\.(jsx|tsx))/);
        if (fileMatch) {
            const file = this.normalizePathForGraph(fileMatch[1]);
            this.emit('execution:component', { processId, file, timestamp: Date.now() });
        }
    }

    handleWarning(processId, line) {
        const fileMatch = line.match(/([^\s"']+\.(js|jsx|ts|tsx)):(\d+)/);
        if (fileMatch) {
            const file = this.normalizePathForGraph(fileMatch[1]);
            this.emit('execution:warning', { processId, file, line: parseInt(fileMatch[3]), message: line, timestamp: Date.now() });
        } else {
            this.emit('warning:detected', { processId, message: line.trim(), timestamp: Date.now() });
        }
    }

    handleServerStart(processId, line) {
        const portMatch = line.match(/:(\d+)/);
        const port = portMatch ? parseInt(portMatch[1]) : null;
        this.emit('execution:start', { processId, port, message: line, timestamp: Date.now() });
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
