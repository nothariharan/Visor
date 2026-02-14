const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');

class ExecutionTracer extends EventEmitter {
    constructor(projectRoot) {
        super();
        this.projectRoot = projectRoot;
        this.fileStates = new Map();
        this.errors = [];
    }

    processOutput(data) {
        const output = data.toString();

        // Basic error detection
        if (output.toLowerCase().includes('error:')) {
            const errorData = {
                message: output.trim(),
                timestamp: Date.now()
            };
            this.errors.push(errorData);
            this.emit('error:detected', errorData);
        }

        // Basic warning detection
        if (output.toLowerCase().includes('warning:')) {
            this.emit('warning:detected', {
                message: output.trim(),
                timestamp: Date.now()
            });
        }

        // Detect file execution (e.g., "Running test.js" or similar patterns)
        // This is a placeholder logic based on common patterns
        const executionMatch = output.match(/(?:running|executing)\s+([^\s]+\.(?:js|jsx|ts|tsx))/i);
        if (executionMatch) {
            const fileName = executionMatch[1];
            this.fileStates.set(fileName, 'running');
            this.emit('file:executed', {
                file: fileName,
                status: 'running'
            });
        }
    }

    getFileStates() {
        return Object.fromEntries(this.fileStates);
    }

    clearAllErrors() {
        this.errors = [];
    }
}

module.exports = { ExecutionTracer };
