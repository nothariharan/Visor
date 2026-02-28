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
        // Per-process working directory map (set when process starts)
        this.processCwds = new Map();
    }

    /** Register the working directory for a process */
    registerProcessCwd(processId, cwd) {
        this.processCwds.set(processId, cwd);
        console.log(`[Tracer] Registered CWD for ${processId}: ${cwd}`);
    }

    /** Get the working directory for a process, fallback to projectRoot */
    getCwd(processId) {
        return this.processCwds.get(processId) || this.projectRoot;
    }

    /**
     * Process Output from Terminal (stdout/stderr)
     */
    processOutput(processId, data, stream = 'stdout') {
        // Strip ANSI codes for regex matching
        const output = data.toString().replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
        const lines = output.split('\n').filter(l => l.trim());
        const cwd = this.getCwd(processId);

        for (const line of lines) {
            // --- Vite-specific patterns first (before generic error check) ---

            // Vite HMR update: "[vite] hmr update /src/App.jsx"
            const viteHmr = line.match(/\[vite\]\s+(?:hmr\s+update|page\s+reload)\s+(\/\S+)/i);
            if (viteHmr) {
                const file = this.resolveRelativePath(viteHmr[1], cwd);
                if (file) {
                    console.log(`[Tracer] Vite HMR: ${file}`);
                    this.emit('execution:component', { processId, file, timestamp: Date.now() });
                }
                continue;
            }

            // Vite transform: "✓ 123 modules transformed." or file list
            if (line.includes('modules transformed') || line.match(/\d+\s+module/)) {
                this.emit('execution:import', { processId, file: null, message: line.trim(), timestamp: Date.now() });
                continue;
            }

            // Vite build/transform: shows "src/App.jsx" or similar
            const viteFile = line.match(/(?:transform|compile|build|load)\s+(\S+\.(?:jsx?|tsx?|vue|svelte))/i);
            if (viteFile) {
                const file = this.resolveRelativePath(viteFile[1], cwd);
                if (file) {
                    console.log(`[Tracer] Vite file transform: ${file}`);
                    this.emit('execution:component', { processId, file, timestamp: Date.now() });
                }
                continue;
            }

            // Vite/Node error patterns (strict - only real errors)
            if (this.isRealError(line)) {
                this.handleError(processId, line, output, stream, cwd);
                continue;
            }

            // Vite internal server error block
            if (line.includes('[vite]') && line.toLowerCase().includes('error')) {
                this.handleViteError(processId, output, cwd);
                continue;
            }

            // Generic import arrow trace
            const importArrow = line.match(/→\s+(\S+\.(?:jsx?|tsx?))/);
            if (importArrow) {
                const file = this.resolveRelativePath(importArrow[1], cwd);
                if (file) this.emit('execution:import', { processId, file, timestamp: Date.now() });
                continue;
            }

            // Node.js "at ..." stack trace pointing to a file
            const atTrace = line.match(/^\s+at\s+.+\((.+\.(jsx?|tsx?)):(\d+):(\d+)\)/);
            if (atTrace && !atTrace[1].includes('node_modules')) {
                const file = this.resolveRelativePath(atTrace[1], cwd);
                if (file) {
                    this.emit('execution:trace', { processId, file, line: parseInt(atTrace[3]), timestamp: Date.now() });
                }
                continue;
            }

            // Server start
            if (this.isServerStart(line)) {
                this.handleServerStart(processId, line);
                continue;
            }

            // Warnings
            if (this.isWarning(line)) {
                this.handleWarning(processId, line, cwd);
                continue;
            }
        }
    }

    /**
     * Resolve a path (relative or absolute) to an absolute path using the process CWD
     */
    resolveRelativePath(filePath, cwd) {
        if (!filePath) return null;
        try {
            // Remove leading slash for path.join (Vite uses /src/App.jsx)
            const cleanPath = filePath.startsWith('/') ? filePath.slice(1) : filePath;
            const abs = path.isAbsolute(filePath) ? filePath : path.join(cwd, cleanPath);

            // Filter out node_modules and Vite internals
            if (abs.includes('node_modules')) return null;
            if (abs.includes('vite/dist')) return null;

            // Check existence — only return if file actually exists
            if (fs.existsSync(abs)) return abs;

            // Try without the leading segment (e.g. "src/App.jsx" without "src/")
            return null;
        } catch (e) {
            return null;
        }
    }

    /**
     * Strict error detection - only actual error types, not vague matches
     */
    isRealError(line) {
        // Must contain an actual error type keyword (not just "failed" or "undefined")
        return (
            /\bReferenceError\b/.test(line) ||
            /\bTypeError\b/.test(line) ||
            /\bSyntaxError\b/.test(line) ||
            /\bRangeError\b/.test(line) ||
            /\bEvalError\b/.test(line) ||
            /\bURIError\b/.test(line) ||
            /Cannot find module/.test(line) ||
            /Error: /.test(line) ||
            /\[error\]/i.test(line) ||
            /✗\s+error/i.test(line)
        );
    }

    isWarning(line) {
        return /\bwarning\b/i.test(line) && !this.isRealError(line);
    }

    isServerStart(line) {
        return /server.*running|listening on|ready\s+in|local:\s*http/i.test(line);
    }

    handleError(processId, errorLine, fullOutput, stream, cwd) {
        const resolved = this.parseError(fullOutput, cwd || this.getCwd(processId));

        if (!resolved.file) {
            // Vite-specific block error or Vite plugin error
            if ((fullOutput.includes('[vite]') && fullOutput.includes('Error:')) || fullOutput.includes('plugin:vite:')) {
                this.handleViteError(processId, fullOutput, cwd);
                return;
            }
            // Node.js stack-based error
            if (fullOutput.includes('Error:') && fullOutput.includes('    at ')) {
                this.handleNodeError(processId, fullOutput, cwd);
                return;
            }
            // Emit with no file (still useful for the error toast)
            this.emit('execution:error', {
                processId,
                error: { message: errorLine.trim(), type: 'TerminalError', stack: [] },
                primaryFile: null,
                executionPath: [],
                timestamp: Date.now()
            });
            return;
        }

        this.emit('execution:error', {
            processId,
            error: resolved,
            primaryFile: resolved.file,
            executionPath: [{ file: resolved.file, line: resolved.line, column: resolved.column }],
            timestamp: Date.now()
        });
    }

    parseError(errorOutput, cwd) {
        const workDir = cwd || this.projectRoot;

        // Node.js stack: "at Function (/path/to/file.js:10:5)"
        let match = errorOutput.match(/at\s+(?:.+?\s+\()?([^\s(]+\.(?:js|ts|jsx|tsx)):(\d+):(\d+)\)?/);
        if (match && !match[1].includes('node_modules') && !match[1].startsWith('node:')) {
            const file = path.isAbsolute(match[1]) ? match[1] : path.resolve(workDir, match[1]);
            return {
                file: file.includes('node_modules') ? null : file,
                line: parseInt(match[2]),
                column: parseInt(match[3]),
                message: this.extractErrorMessage(errorOutput),
                type: this.detectErrorType(errorOutput),
                stack: errorOutput
            };
        }

        // Vite build error: "src/App.jsx:10:5"
        match = errorOutput.match(/\b(src\/[^\s:]+\.(?:jsx?|tsx?)):(\d+):(\d+)/);
        if (match) {
            const file = path.join(workDir, match[1]);
            return {
                file,
                line: parseInt(match[2]),
                column: parseInt(match[3]),
                message: this.extractErrorMessage(errorOutput),
                type: 'ViteError',
                stack: errorOutput
            };
        }

        // Absolute path with line/col
        match = errorOutput.match(/([A-Za-z]:[\\/][^\s:]+\.(?:js|ts|jsx|tsx)):(\d+):(\d+)/);
        if (match && !match[1].includes('node_modules')) {
            return {
                file: match[1],
                line: parseInt(match[2]),
                column: parseInt(match[3]),
                message: this.extractErrorMessage(errorOutput),
                type: this.detectErrorType(errorOutput),
                stack: errorOutput
            };
        }

        return { message: errorOutput, file: null };
    }

    extractErrorMessage(errorOutput) {
        const lines = errorOutput.split('\n');
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('at ') && !trimmed.startsWith('-->') && !/^\d+\s*\|/.test(trimmed)) {
                return trimmed.substring(0, 300);
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

    handleViteError(processId, text, cwd) {
        const workDir = cwd || this.getCwd(processId);
        // Vite format: "Plugin vite:esbuild:\n  /path:line:col"
        // Or "File: /path/to/file.jsx:5:26"
        // Or Standalone "/path/to/file.jsx:5:26" at start of line
        const fileMatch = text.match(/(?:Plugin\s+[^:]+:\n\s+|x\s+Build failed.*\n\s+|File:\s+|^)([^\/\n:]*\/[^\n:]+\.(?:jsx?|tsx?|vue|svelte)):(\d+):(\d+)/m) ||
            text.match(/([^\s]+\.(?:jsx?|tsx?|vue|svelte)):(\d+):(\d+)/);

        let files = [];
        if (fileMatch) {
            const rawPath = fileMatch[1].trim();
            const abs = path.isAbsolute(rawPath) ? rawPath : path.join(workDir, rawPath);
            if (!abs.includes('node_modules')) {
                files.push({ file: abs, line: parseInt(fileMatch[2]), column: parseInt(fileMatch[3]) });
            }
        }

        const messageMatch = text.match(/(?:Internal server error:|Plugin.*?error:|Error:|\[plugin:[^\]]+\])\s+(.+)/i);
        const message = messageMatch ? messageMatch[1] : 'Vite Build/Plugin Error';

        this.emit('execution:error', {
            processId,
            error: { message: message.trim(), type: 'ViteError', stack: files },
            primaryFile: files.length > 0 ? files[0].file : null,
            executionPath: files,
            timestamp: Date.now()
        });
    }

    handleNodeError(processId, text, cwd) {
        const workDir = cwd || this.getCwd(processId);
        const stackLines = text.split('\n')
            .filter(l => l.trim().startsWith('at ') && !l.includes('node_modules') && !l.includes('node:'));

        const files = stackLines.map(l => {
            const m = l.match(/at\s+.+?\(([^)]+\.(?:js|ts|jsx|tsx)):(\d+):(\d+)\)/);
            if (!m) return null;
            const abs = path.isAbsolute(m[1]) ? m[1] : path.resolve(workDir, m[1]);
            return abs.includes('node_modules') ? null : { file: abs, line: parseInt(m[2]), column: parseInt(m[3]) };
        }).filter(Boolean);

        const messageMatch = text.match(/^([A-Z][a-zA-Z]*Error:.+)/m);
        const message = messageMatch ? messageMatch[1] : 'Runtime Error';

        this.emit('execution:error', {
            processId,
            error: { message, type: this.detectErrorType(text), stack: files },
            primaryFile: files.length > 0 ? files[0].file : null,
            executionPath: files,
            timestamp: Date.now()
        });
    }

    handleWarning(processId, line, cwd) {
        const workDir = cwd || this.getCwd(processId);
        const fileMatch = line.match(/([^\s"']+\.(?:js|jsx|ts|tsx)):(\d+)/);
        if (fileMatch) {
            const abs = path.isAbsolute(fileMatch[1]) ? fileMatch[1] : path.resolve(workDir, fileMatch[1]);
            this.emit('execution:warning', { processId, file: abs, line: parseInt(fileMatch[2]), message: line.trim(), timestamp: Date.now() });
        } else {
            this.emit('warning:detected', { processId, message: line.trim(), timestamp: Date.now() });
        }
    }

    handleServerStart(processId, line) {
        const portMatch = line.match(/:(\d{3,5})/);
        const port = portMatch ? parseInt(portMatch[1]) : null;
        this.emit('execution:start', { processId, port, message: line.trim(), timestamp: Date.now() });
    }

    /**
     * Process Error from Browser (via API)
     */
    processBrowserError(data) {
        console.log('\n--- [Tracer] RECEIVED BROWSER ERROR ---');
        console.log('Message:', data.message);
        console.log('Filename:', data.filename);
        console.log('WorkingDir:', data.workingDir);

        const baseDir = data.workingDir || this.projectRoot;
        const files = [];

        if (data.filename) {
            const normalized = this.normalizePathForGraph(data.filename, baseDir);
            console.log('Normalized Direct Filename:', normalized);
            if (normalized) {
                files.push({ file: normalized, line: data.line, column: data.column });
            }
        }

        if (data.stack) {
            const stackFiles = this.parseBrowserStack(data.stack, baseDir);
            files.push(...stackFiles);
        }

        // Dedup
        const uniqueFiles = [];
        const seen = new Set();
        files.forEach(f => {
            if (!seen.has(f.file)) { seen.add(f.file); uniqueFiles.push(f); }
        });

        const errorEvent = {
            error: { message: data.message, type: data.type || 'BrowserError', stack: uniqueFiles },
            primaryFile: uniqueFiles.length > 0 ? uniqueFiles[0].file : null,
            executionPath: uniqueFiles
        };

        console.log('[Tracer] Emitting execution:error');
        console.log('[Tracer] Primary File:', errorEvent.primaryFile);
        console.log('[Tracer] Stack Frame Count:', uniqueFiles.length);

        this.emit('execution:error', errorEvent);
    }

    parseBrowserStack(stack, baseDir) {
        if (!stack) return [];
        const lines = stack.split('\n');
        const files = [];
        for (const line of lines) {
            const match = line.match(/at\s+.+?\s+\((https?:\/\/.+?):(\d+):(\d+)\)/) ||
                line.match(/at\s+(https?:\/\/.+?):(\d+):(\d+)/);
            if (match) {
                const normalized = this.normalizePathForGraph(match[1], baseDir);
                if (normalized) {
                    files.push({ file: normalized, line: parseInt(match[2]), column: parseInt(match[3]) });
                }
            }
        }
        return files;
    }

    normalizePathForGraph(filePath, baseDir) {
        const rootDir = baseDir || this.projectRoot;
        if (!filePath) return null;

        // Handle HTTP URLs (from browser error-reporter)
        if (filePath.startsWith('http')) {
            try {
                const urlObj = new URL(filePath);
                let pathname = urlObj.pathname;

                // Vite /@fs/ absolute path
                if (pathname.startsWith('/@fs/')) {
                    pathname = pathname.replace('/@fs/', '');
                    if (process.platform === 'win32' && /^\/[a-zA-Z]:/.test(pathname)) {
                        pathname = pathname.substring(1);
                    }
                } else {
                    // Relative to runtime working dir
                    pathname = path.join(rootDir, pathname);
                }
                filePath = decodeURIComponent(pathname);
            } catch (e) {
                return null;
            }
        }

        let absolutePath = filePath;
        if (!path.isAbsolute(filePath)) {
            absolutePath = path.resolve(rootDir, filePath);
        }

        if (absolutePath.includes('node_modules')) return null;
        if (absolutePath.includes('vite/dist')) return null;

        return absolutePath;
    }

    emitError(data) {
        this.errors.push(data);
        this.emit('execution:error', { error: data, primaryFile: null, executionPath: [] });
    }

    getFileStates() { return Object.fromEntries(this.fileStates); }
    clearAllErrors() { this.errors = []; this.emit('errors:cleared'); }
}

module.exports = { ExecutionTracer };
