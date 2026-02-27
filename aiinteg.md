# VISOR: AI Auto-Fix + Live Execution Flow (The Guardian System)

**Mission:** Transform Forge Mode from a passive terminal into an intelligent debugging assistant that visualizes execution flow in real-time and automatically fixes errors.

---

## 🎯 Feature Overview

### What This System Does:

**1. Live Execution Visualization**
- Shows which files are currently executing (blue glow)
- Shows execution path with animated arrows
- Shows component hierarchy (yellow for components, green for services)
- Real-time visual feedback of code flow

**2. Intelligent Error Detection**
- Catches runtime errors from running processes
- Parses stack traces to identify exact file and line
- Highlights error node in red
- Shows execution path that led to error

**3. AI-Powered Auto-Fix**
- One-click fix button on error nodes
- Sends error context + file content to Gemini API
- Applies fix automatically
- Re-runs process to verify

---

## 🏗️ System Architecture

```
User starts process in Forge Mode
         ↓
ProcessRunner spawns with enhanced monitoring
         ↓
ExecutionTracer tracks all console output
         ↓
┌────────────────────────────────────────┐
│  Real-Time Flow Visualization          │
├────────────────────────────────────────┤
│  - Entry point detected → blue glow    │
│  - Imports resolved → yellow glow      │
│  - Functions executing → pulse effect  │
│  - Data flow shown with moving arrows  │
└────────────────────────────────────────┘
         ↓
ERROR OCCURS
         ↓
┌────────────────────────────────────────┐
│  Error Detection & Parsing             │
├────────────────────────────────────────┤
│  1. Catch stderr output                │
│  2. Parse stack trace                  │
│  3. Extract file path + line number    │
│  4. Map to graph node                  │
│  5. Highlight error node in RED        │
│  6. Show execution path in red         │
└────────────────────────────────────────┘
         ↓
User clicks "AI Fix" button
         ↓
┌────────────────────────────────────────┐
│  AI Context Gathering                  │
├────────────────────────────────────────┤
│  1. Read errored file content          │
│  2. Read related files (imports)       │
│  3. Extract error message + stack      │
│  4. Gather dependency context          │
└────────────────────────────────────────┘
         ↓
Send to Gemini API
         ↓
┌────────────────────────────────────────┐
│  AI Fix Generation                     │
├────────────────────────────────────────┤
│  1. Gemini analyzes error              │
│  2. Generates fixed code               │
│  3. Returns ONLY code (no explanation) │
└────────────────────────────────────────┘
         ↓
Apply fix to file
         ↓
Re-run process automatically
         ↓
SUCCESS → Green glow
ERROR → Show diff, ask user
```

---

## 📦 Part 1: Live Execution Flow Visualization

### Goal: Show the code "coming alive" as it runs

#### 1.1 Execution State Types

```javascript
// Different execution states for nodes
const ExecutionStates = {
  IDLE: 'idle',              // Gray - not running
  ENTRY: 'entry',            // Blue - entry point
  EXECUTING: 'executing',    // Green pulse - currently running
  COMPONENT: 'component',    // Yellow - React component rendering
  SERVICE: 'service',        // Cyan - Service/API layer executing
  DATABASE: 'database',      // Purple - Database query
  ERROR: 'error',           // Red - Crashed
  WARNING: 'warning'        // Orange - Warning logged
};
```

#### 1.2 Enhanced Process Runner

**Backend: Track Execution Context**

```javascript
// server/runner/EnhancedProcessRunner.js

import { ProcessRunner } from './ProcessRunner.js';
import { ExecutionTracer } from './ExecutionTracer.js';

export class EnhancedProcessRunner extends ProcessRunner {
  constructor(projectRoot, io) {
    super(projectRoot);
    this.io = io;  // Socket.io for real-time updates
    this.tracer = new ExecutionTracer(projectRoot, io);
    this.executionMap = new Map();  // Track what's executing
  }
  
  start(id, command, workingDir) {
    // Start process normally
    const proc = super.start(id, command, workingDir);
    
    // Set up enhanced monitoring
    this.setupExecutionMonitoring(id, proc, workingDir);
    
    return proc;
  }
  
  setupExecutionMonitoring(processId, proc, workingDir) {
    const execContext = {
      processId,
      entryPoint: null,
      activeFiles: new Set(),
      executionPath: [],
      startTime: Date.now()
    };
    
    this.executionMap.set(processId, execContext);
    
    // Monitor stdout for execution traces
    proc.stdout.on('data', (data) => {
      this.tracer.processOutput(processId, data.toString(), 'stdout');
    });
    
    // Monitor stderr for errors
    proc.stderr.on('data', (data) => {
      this.tracer.processOutput(processId, data.toString(), 'stderr');
    });
    
    // Detect entry point
    this.detectEntryPoint(processId, command, workingDir);
  }
  
  detectEntryPoint(processId, command, workingDir) {
    // Parse command to find entry file
    // Examples:
    //   "npm run dev"     → check package.json scripts
    //   "node server.js"  → server.js is entry
    //   "python app.py"   → app.py is entry
    
    let entryFile = null;
    
    if (command.includes('node ')) {
      // Extract file after 'node'
      const match = command.match(/node\s+([^\s]+)/);
      entryFile = match ? match[1] : null;
    } else if (command.includes('npm run')) {
      // Read package.json to find script
      const pkg = this.readPackageJson(workingDir);
      const scriptName = command.split('npm run ')[1];
      const scriptCommand = pkg?.scripts?.[scriptName];
      
      if (scriptCommand) {
        // Recursively parse script command
        entryFile = this.parseScriptCommand(scriptCommand);
      }
    } else if (command.includes('python')) {
      const match = command.match(/python\s+([^\s]+)/);
      entryFile = match ? match[1] : null;
    }
    
    if (entryFile) {
      const absolutePath = path.join(workingDir, entryFile);
      
      // Emit entry point detected
      this.io.emit('execution:entry', {
        processId,
        file: absolutePath,
        timestamp: Date.now()
      });
      
      // Update execution context
      const context = this.executionMap.get(processId);
      context.entryPoint = absolutePath;
      context.activeFiles.add(absolutePath);
    }
  }
  
  readPackageJson(dir) {
    try {
      const pkgPath = path.join(dir, 'package.json');
      return JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    } catch {
      return null;
    }
  }
  
  parseScriptCommand(scriptCommand) {
    // Parse various script formats
    // "vite"              → node_modules/.bin/vite → find vite entry
    // "node src/index.js" → src/index.js
    // "nodemon app.js"    → app.js
    
    if (scriptCommand.includes('node ')) {
      const match = scriptCommand.match(/node\s+([^\s]+)/);
      return match ? match[1] : null;
    }
    
    if (scriptCommand.includes('nodemon ')) {
      const match = scriptCommand.match(/nodemon\s+([^\s]+)/);
      return match ? match[1] : null;
    }
    
    // For bundlers (vite, webpack), check for main/index files
    const commonEntries = [
      'src/main.js',
      'src/main.tsx',
      'src/index.js',
      'src/index.tsx',
      'index.js',
      'main.js'
    ];
    
    for (const entry of commonEntries) {
      if (fs.existsSync(path.join(workingDir, entry))) {
        return entry;
      }
    }
    
    return null;
  }
}
```

#### 1.3 Execution Tracer (Enhanced)

**Track imports, function calls, and errors**

```javascript
// server/runner/ExecutionTracer.js

export class ExecutionTracer {
  constructor(projectRoot, io) {
    this.projectRoot = projectRoot;
    this.io = io;
    this.activeTraces = new Map();
  }
  
  processOutput(processId, data, stream) {
    const lines = data.split('\n').filter(Boolean);
    
    for (const line of lines) {
      // Detect different execution patterns
      
      // 1. Check for errors
      if (this.isError(line)) {
        this.handleError(processId, line, stream);
        continue;
      }
      
      // 2. Check for imports/requires (from bundler output)
      if (this.isImportTrace(line)) {
        this.handleImport(processId, line);
        continue;
      }
      
      // 3. Check for React component rendering
      if (this.isComponentTrace(line)) {
        this.handleComponent(processId, line);
        continue;
      }
      
      // 4. Check for warnings
      if (this.isWarning(line)) {
        this.handleWarning(processId, line);
        continue;
      }
      
      // 5. Check for successful start
      if (this.isServerStart(line)) {
        this.handleServerStart(processId, line);
        continue;
      }
    }
  }
  
  isError(line) {
    const errorPatterns = [
      /error/i,
      /exception/i,
      /failed/i,
      /cannot find/i,
      /undefined/i,
      /ReferenceError/,
      /TypeError/,
      /SyntaxError/
    ];
    
    return errorPatterns.some(pattern => pattern.test(line));
  }
  
  isImportTrace(line) {
    // Vite/Webpack bundler traces
    // Example: "✓ 24 modules transformed."
    // Example: "→ src/App.jsx"
    
    return (
      line.includes('modules transformed') ||
      line.includes('→') ||
      line.includes('importing')
    );
  }
  
  isComponentTrace(line) {
    // React component rendering traces
    // Can be added via React DevTools integration later
    // For now, detect from file names ending in .jsx/.tsx
    
    return line.match(/\.(jsx|tsx)/) !== null;
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
  
  handleError(processId, errorLine, stream) {
    // Parse error to extract file and line number
    const parsed = this.parseError(errorLine, stream);
    
    if (!parsed.file) return;
    
    // Emit error event to frontend
    this.io.emit('execution:error', {
      processId,
      error: {
        message: parsed.message,
        file: parsed.file,
        line: parsed.line,
        column: parsed.column,
        type: parsed.type,
        stack: parsed.stack
      },
      timestamp: Date.now()
    });
    
    // Track in active traces
    const trace = this.activeTraces.get(processId) || { errors: [] };
    trace.errors.push(parsed);
    this.activeTraces.set(processId, trace);
  }
  
  parseError(errorOutput, stream) {
    // Multiple error format parsers
    
    // 1. Node.js stack trace format
    //    at Object.<anonymous> (/path/to/file.js:10:5)
    const nodeMatch = errorOutput.match(/at\s+.*?\(([^:]+):(\d+):(\d+)\)/);
    
    if (nodeMatch) {
      return {
        file: this.normalizeFilePath(nodeMatch[1]),
        line: parseInt(nodeMatch[2]),
        column: parseInt(nodeMatch[3]),
        message: this.extractErrorMessage(errorOutput),
        type: this.detectErrorType(errorOutput),
        stack: errorOutput
      };
    }
    
    // 2. Vite error format
    //    /path/to/file.jsx:10:5
    const viteMatch = errorOutput.match(/([^:]+):(\d+):(\d+)/);
    
    if (viteMatch) {
      return {
        file: this.normalizeFilePath(viteMatch[1]),
        line: parseInt(viteMatch[2]),
        column: parseInt(viteMatch[3]),
        message: this.extractErrorMessage(errorOutput),
        type: 'ViteError',
        stack: errorOutput
      };
    }
    
    // 3. Python traceback format
    //    File "/path/to/file.py", line 10
    const pythonMatch = errorOutput.match(/File\s+"([^"]+)",\s+line\s+(\d+)/);
    
    if (pythonMatch) {
      return {
        file: this.normalizeFilePath(pythonMatch[1]),
        line: parseInt(pythonMatch[2]),
        column: 0,
        message: this.extractErrorMessage(errorOutput),
        type: 'PythonError',
        stack: errorOutput
      };
    }
    
    return {
      message: errorOutput,
      file: null
    };
  }
  
  normalizeFilePath(filePath) {
    // Remove webpack:/// prefix
    filePath = filePath.replace(/^webpack:\/\/\//, '');
    
    // Convert to absolute path if relative
    if (!path.isAbsolute(filePath)) {
      filePath = path.join(this.projectRoot, filePath);
    }
    
    // Normalize separators
    filePath = filePath.replace(/\\/g, '/');
    
    return filePath;
  }
  
  extractErrorMessage(errorOutput) {
    // Extract first line as message
    const lines = errorOutput.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('at ')) {
        return trimmed;
      }
    }
    
    return errorOutput.substring(0, 200);
  }
  
  detectErrorType(errorOutput) {
    if (errorOutput.includes('ReferenceError')) return 'ReferenceError';
    if (errorOutput.includes('TypeError')) return 'TypeError';
    if (errorOutput.includes('SyntaxError')) return 'SyntaxError';
    if (errorOutput.includes('Cannot find module')) return 'ModuleNotFoundError';
    
    return 'RuntimeError';
  }
  
  handleImport(processId, line) {
    // Extract file being imported
    // Example: "→ src/components/Header.jsx"
    
    const fileMatch = line.match(/→\s+(.+)/);
    
    if (fileMatch) {
      const file = this.normalizeFilePath(fileMatch[1]);
      
      this.io.emit('execution:import', {
        processId,
        file,
        timestamp: Date.now()
      });
    }
  }
  
  handleComponent(processId, line) {
    // Detect React component from file name
    const fileMatch = line.match(/([^\s]+\.(jsx|tsx))/);
    
    if (fileMatch) {
      const file = this.normalizeFilePath(fileMatch[1]);
      
      this.io.emit('execution:component', {
        processId,
        file,
        timestamp: Date.now()
      });
    }
  }
  
  handleWarning(processId, line) {
    // Extract warning file if present
    const fileMatch = line.match(/([^\s]+\.(js|jsx|ts|tsx)):(\d+)/);
    
    if (fileMatch) {
      const file = this.normalizeFilePath(fileMatch[1]);
      const lineNum = parseInt(fileMatch[3]);
      
      this.io.emit('execution:warning', {
        processId,
        file,
        line: lineNum,
        message: line,
        timestamp: Date.now()
      });
    }
  }
  
  handleServerStart(processId, line) {
    // Extract port
    const portMatch = line.match(/:(\d+)/);
    const port = portMatch ? parseInt(portMatch[1]) : null;
    
    this.io.emit('execution:start', {
      processId,
      port,
      message: line,
      timestamp: Date.now()
    });
  }
}
```

#### 1.4 Frontend: Visual Flow System

**Listen to execution events and update graph**

```javascript
// src/hooks/useExecutionFlow.js

import { useEffect } from 'react';
import { useGraphStore } from '../store';

export function useExecutionFlow(socket) {
  const updateNodeStatus = useGraphStore(state => state.updateNodeStatus);
  const updateEdgeStatus = useGraphStore(state => state.updateEdgeStatus);
  
  useEffect(() => {
    if (!socket) return;
    
    // Entry point detected
    socket.on('execution:entry', ({ file }) => {
      updateNodeStatus(file, {
        executionState: 'entry',
        glow: 'blue',
        animated: true
      });
    });
    
    // File being imported/executed
    socket.on('execution:import', ({ file }) => {
      updateNodeStatus(file, {
        executionState: 'executing',
        glow: 'green',
        pulse: true
      });
      
      // Auto-clear after 2 seconds
      setTimeout(() => {
        updateNodeStatus(file, {
          executionState: 'idle',
          glow: null,
          pulse: false
        });
      }, 2000);
    });
    
    // Component rendering
    socket.on('execution:component', ({ file }) => {
      updateNodeStatus(file, {
        executionState: 'component',
        glow: 'yellow',
        pulse: true
      });
      
      setTimeout(() => {
        updateNodeStatus(file, { executionState: 'idle', glow: null });
      }, 1500);
    });
    
    // Warning detected
    socket.on('execution:warning', ({ file, message }) => {
      updateNodeStatus(file, {
        executionState: 'warning',
        glow: 'orange',
        warning: message
      });
    });
    
    // ERROR detected (THE BIG ONE)
    socket.on('execution:error', ({ error }) => {
      updateNodeStatus(error.file, {
        executionState: 'error',
        glow: 'red',
        pulse: true,
        error: {
          message: error.message,
          line: error.line,
          type: error.type,
          stack: error.stack
        }
      });
      
      // Show execution path that led to error
      highlightErrorPath(error);
    });
    
    // Server started successfully
    socket.on('execution:start', ({ port }) => {
      // Show success notification
      showNotification(`Server running on port ${port}`, 'success');
    });
    
    return () => {
      socket.off('execution:entry');
      socket.off('execution:import');
      socket.off('execution:component');
      socket.off('execution:warning');
      socket.off('execution:error');
      socket.off('execution:start');
    };
  }, [socket, updateNodeStatus]);
}

function highlightErrorPath(error) {
  // Parse stack trace to get execution path
  // Highlight all files in the call stack leading to error
  
  const stackFiles = parseStackTrace(error.stack);
  
  stackFiles.forEach((file, index) => {
    updateEdgeStatus(file, {
      color: 'red',
      animated: true,
      dashArray: '5,5'
    });
  });
}
```

#### 1.5 CSS: Execution State Animations

```css
/* src/styles/execution-flow.css */

/* Entry point - Blue glow */
.node-execution-entry {
  border-color: #89b4fa !important;
  box-shadow: 0 0 20px rgba(137, 180, 250, 0.6);
  animation: pulse-blue 2s infinite;
}

@keyframes pulse-blue {
  0%, 100% {
    box-shadow: 0 0 20px rgba(137, 180, 250, 0.4);
  }
  50% {
    box-shadow: 0 0 40px rgba(137, 180, 250, 0.8);
  }
}

/* Executing - Green pulse */
.node-execution-executing {
  border-color: #a6e3a1 !important;
  box-shadow: 0 0 15px rgba(166, 227, 161, 0.6);
  animation: pulse-green 1s ease-in-out 2;
}

@keyframes pulse-green {
  0%, 100% {
    transform: scale(1);
    box-shadow: 0 0 15px rgba(166, 227, 161, 0.4);
  }
  50% {
    transform: scale(1.05);
    box-shadow: 0 0 30px rgba(166, 227, 161, 0.8);
  }
}

/* Component - Yellow glow */
.node-execution-component {
  border-color: #f9e2af !important;
  box-shadow: 0 0 15px rgba(249, 226, 175, 0.6);
  animation: pulse-yellow 1.5s ease-in-out 2;
}

@keyframes pulse-yellow {
  0%, 100% {
    box-shadow: 0 0 15px rgba(249, 226, 175, 0.4);
  }
  50% {
    box-shadow: 0 0 25px rgba(249, 226, 175, 0.7);
  }
}

/* Error - Red pulse + shake */
.node-execution-error {
  border-color: #f38ba8 !important;
  box-shadow: 0 0 30px rgba(243, 139, 168, 0.8);
  animation: pulse-red-shake 1.5s infinite;
}

@keyframes pulse-red-shake {
  0%, 100% {
    box-shadow: 0 0 20px rgba(243, 139, 168, 0.6);
    transform: translateX(0);
  }
  25% {
    transform: translateX(-3px);
  }
  50% {
    box-shadow: 0 0 40px rgba(243, 139, 168, 1);
    transform: translateX(3px);
  }
  75% {
    transform: translateX(-3px);
  }
}

/* Warning - Orange glow */
.node-execution-warning {
  border-color: #fab387 !important;
  box-shadow: 0 0 15px rgba(250, 179, 135, 0.6);
}

/* Animated edges showing data flow */
.edge-execution-flow {
  stroke: #89b4fa;
  stroke-width: 3px;
  animation: flow-animation 2s linear infinite;
}

@keyframes flow-animation {
  0% {
    stroke-dashoffset: 20;
  }
  100% {
    stroke-dashoffset: 0;
  }
}

/* Error path edges */
.edge-error-path {
  stroke: #f38ba8;
  stroke-width: 3px;
  stroke-dasharray: 10 5;
  animation: error-flow 1.5s linear infinite;
}

@keyframes error-flow {
  0% {
    stroke-dashoffset: 15;
  }
  100% {
    stroke-dashoffset: 0;
  }
}
```

---

## 📦 Part 2: AI Auto-Fix System

### Goal: One-click error resolution using Gemini API

#### 2.1 AI Fix Button on Error Nodes

```javascript
// src/components/TerminalNode.jsx (enhanced)

export function TerminalNode({ data }) {
  const [fixing, setFixing] = useState(false);
  const [fixResult, setFixResult] = useState(null);
  
  const handleAIFix = async () => {
    setFixing(true);
    
    try {
      const response = await fetch('/api/ai/fix-error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filePath: data.id,
          error: data.error
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        setFixResult(result);
        // Show success notification
        showNotification('AI Fix applied! Re-running...', 'success');
      } else {
        showNotification(`Fix failed: ${result.error}`, 'error');
      }
    } catch (error) {
      showNotification('AI Fix service unavailable', 'error');
    } finally {
      setFixing(false);
    }
  };
  
  if (data.executionState === 'error') {
    return (
      <div className="node-card node-execution-error">
        {/* ... normal node content ... */}
        
        {/* Error panel */}
        <div className="error-panel bg-red/10 border-t-2 border-red p-3">
          <div className="text-red text-xs font-mono mb-2">
            {data.error.type}: {data.error.message}
          </div>
          
          {data.error.line && (
            <div className="text-subtext0 text-[10px] mb-2">
              Line {data.error.line}:{data.error.column}
            </div>
          )}
          
          {/* Action buttons */}
          <div className="flex gap-2">
            <button
              onClick={handleAIFix}
              disabled={fixing}
              className="
                flex-1 py-1.5 bg-peach text-crust
                text-[10px] font-bold uppercase
                hover:bg-peach/80 transition-colors
                disabled:opacity-50 disabled:cursor-not-allowed
              "
            >
              {fixing ? '⏳ Fixing...' : '✨ AI Fix'}
            </button>
            
            <button
              onClick={() => openInEditor(data.id, data.error.line)}
              className="
                px-3 py-1.5 bg-blue text-crust
                text-[10px] font-bold uppercase
                hover:bg-blue/80 transition-colors
              "
            >
              Edit
            </button>
          </div>
          
          {/* Fix result */}
          {fixResult && (
            <div className="mt-2 text-[10px] text-green">
              ✓ {fixResult.message}
            </div>
          )}
        </div>
      </div>
    );
  }
  
  // ... rest of node rendering ...
}
```

#### 2.2 Backend: AI Fix Service

```javascript
// server/ai/fix-service.js

import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs/promises';
import path from 'path';

export class AIFixService {
  constructor(apiKey) {
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
  }
  
  async fixError(filePath, errorContext) {
    try {
      // 1. Read the errored file
      const fileContent = await fs.readFile(filePath, 'utf-8');
      
      // 2. Read related files (imports)
      const imports = await this.extractImports(filePath, fileContent);
      const importContents = await this.readImports(filePath, imports);
      
      // 3. Build context for AI
      const context = this.buildContext(
        fileContent,
        errorContext,
        importContents
      );
      
      // 4. Generate fix
      const fixedCode = await this.generateFix(context);
      
      // 5. Validate fix (basic)
      if (!this.validateFix(fixedCode, fileContent)) {
        return {
          success: false,
          error: 'Generated fix appears invalid'
        };
      }
      
      // 6. Create backup
      await this.createBackup(filePath, fileContent);
      
      // 7. Apply fix
      await fs.writeFile(filePath, fixedCode, 'utf-8');
      
      return {
        success: true,
        message: 'Fix applied successfully',
        diff: this.createDiff(fileContent, fixedCode)
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  async extractImports(filePath, content) {
    const imports = [];
    
    // Match ES6 imports
    const importRegex = /import\s+.*?\s+from\s+['"](.+?)['"]/g;
    let match;
    
    while ((match = importRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }
    
    // Match CommonJS requires
    const requireRegex = /require\s*\(\s*['"](.+?)['"]\s*\)/g;
    
    while ((match = requireRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }
    
    // Filter to local files only (not node_modules)
    return imports.filter(imp => imp.startsWith('.'));
  }
  
  async readImports(basePath, imports) {
    const baseDir = path.dirname(basePath);
    const contents = {};
    
    for (const imp of imports) {
      try {
        // Resolve relative path
        let impPath = path.join(baseDir, imp);
        
        // Add extensions if missing
        if (!path.extname(impPath)) {
          for (const ext of ['.js', '.jsx', '.ts', '.tsx']) {
            if (await this.fileExists(impPath + ext)) {
              impPath += ext;
              break;
            }
          }
        }
        
        if (await this.fileExists(impPath)) {
          contents[imp] = await fs.readFile(impPath, 'utf-8');
        }
      } catch {
        // Skip if can't read
      }
    }
    
    return contents;
  }
  
  async fileExists(path) {
    try {
      await fs.access(path);
      return true;
    } catch {
      return false;
    }
  }
  
  buildContext(fileContent, errorContext, importContents) {
    // Build comprehensive context for AI
    let context = `# File with Error\n\n`;
    context += `\`\`\`\n${fileContent}\n\`\`\`\n\n`;
    
    context += `# Error Information\n\n`;
    context += `Type: ${errorContext.type}\n`;
    context += `Message: ${errorContext.message}\n`;
    context += `Line: ${errorContext.line}\n`;
    context += `Column: ${errorContext.column}\n\n`;
    
    if (errorContext.stack) {
      context += `Stack Trace:\n\`\`\`\n${errorContext.stack}\n\`\`\`\n\n`;
    }
    
    if (Object.keys(importContents).length > 0) {
      context += `# Related Files\n\n`;
      
      for (const [imp, content] of Object.entries(importContents)) {
        context += `## ${imp}\n\n`;
        context += `\`\`\`\n${content.substring(0, 500)}\n\`\`\`\n\n`;
      }
    }
    
    return context;
  }
  
  async generateFix(context) {
    const prompt = `You are a code fixing AI. Fix the error in the provided code.

${context}

CRITICAL INSTRUCTIONS:
1. Return ONLY the fixed code - no explanations, no markdown, no comments about the fix
2. The code must be complete and ready to save to a file
3. Do not include markdown code fences (\`\`\`)
4. Do not add explanatory text before or after the code
5. Preserve all imports, exports, and structure
6. Fix ONLY the error - do not refactor unrelated code

Return the complete fixed code now:`;

    const result = await this.model.generateContent(prompt);
    const response = result.response;
    let fixedCode = response.text();
    
    // Clean up response (remove markdown if AI added it anyway)
    fixedCode = fixedCode.replace(/```[a-z]*\n?/g, '');
    fixedCode = fixedCode.trim();
    
    return fixedCode;
  }
  
  validateFix(fixedCode, originalCode) {
    // Basic validation
    
    // 1. Check it's not empty
    if (!fixedCode || fixedCode.length < 10) {
      return false;
    }
    
    // 2. Check it's not just an explanation
    if (fixedCode.startsWith('Here') || fixedCode.startsWith('I ')) {
      return false;
    }
    
    // 3. Check it contains code-like structures
    const codePatterns = [
      /function/,
      /const|let|var/,
      /import|export/,
      /\{.*\}/s
    ];
    
    const hasCode = codePatterns.some(pattern => pattern.test(fixedCode));
    
    if (!hasCode) {
      return false;
    }
    
    // 4. Check similarity (should be similar but not identical)
    const similarity = this.calculateSimilarity(fixedCode, originalCode);
    
    if (similarity < 0.3 || similarity > 0.99) {
      // Too different or too similar
      return false;
    }
    
    return true;
  }
  
  calculateSimilarity(str1, str2) {
    // Simple character-based similarity
    const len1 = str1.length;
    const len2 = str2.length;
    const longer = Math.max(len1, len2);
    
    if (longer === 0) return 1.0;
    
    let matches = 0;
    const minLen = Math.min(len1, len2);
    
    for (let i = 0; i < minLen; i++) {
      if (str1[i] === str2[i]) matches++;
    }
    
    return matches / longer;
  }
  
  async createBackup(filePath, content) {
    const backupDir = path.join(path.dirname(filePath), '.visor', 'backups');
    await fs.mkdir(backupDir, { recursive: true });
    
    const timestamp = Date.now();
    const fileName = path.basename(filePath);
    const backupPath = path.join(backupDir, `${fileName}.${timestamp}.bak`);
    
    await fs.writeFile(backupPath, content, 'utf-8');
  }
  
  createDiff(original, fixed) {
    // Simple line-by-line diff
    const origLines = original.split('\n');
    const fixedLines = fixed.split('\n');
    
    const diff = [];
    const maxLen = Math.max(origLines.length, fixedLines.length);
    
    for (let i = 0; i < maxLen; i++) {
      const origLine = origLines[i] || '';
      const fixedLine = fixedLines[i] || '';
      
      if (origLine !== fixedLine) {
        if (origLine) {
          diff.push({ type: 'removed', line: origLine, lineNum: i + 1 });
        }
        if (fixedLine) {
          diff.push({ type: 'added', line: fixedLine, lineNum: i + 1 });
        }
      }
    }
    
    return diff;
  }
}
```

#### 2.3 API Endpoint

```javascript
// server/index.js

import { AIFixService } from './ai/fix-service.js';

const fixService = new AIFixService(process.env.GEMINI_API_KEY);

app.post('/api/ai/fix-error', async (req, res) => {
  const { filePath, error } = req.body;
  
  if (!filePath || !error) {
    return res.status(400).json({
      success: false,
      error: 'Missing filePath or error'
    });
  }
  
  console.log('[AI Fix] Attempting to fix:', filePath);
  
  const result = await fixService.fixError(filePath, error);
  
  if (result.success) {
    console.log('[AI Fix] Success:', filePath);
    
    // Notify frontend to re-run process
    io.emit('ai:fix-applied', {
      filePath,
      message: result.message
    });
  } else {
    console.error('[AI Fix] Failed:', result.error);
  }
  
  res.json(result);
});
```

---

## 📦 Part 3: Auto Re-Run After Fix

### Goal: Automatically restart process after AI fix

```javascript
// Frontend: Listen for fix applied
socket.on('ai:fix-applied', ({ filePath }) => {
  // Show notification
  showNotification('Fix applied! Restarting process...', 'success');
  
  // Wait 2 seconds for file system to settle
  setTimeout(() => {
    // Restart the process
    restartProcess();
  }, 2000);
});

async function restartProcess() {
  const processId = getCurrentProcessId();
  
  // Stop current process
  await fetch(`/api/process/${processId}/stop`, { method: 'POST' });
  
  // Wait for stop
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Start again
  await fetch(`/api/process/${processId}/start`, { method: 'POST' });
  
  // Clear error states
  clearAllNodeErrors();
}
```

---

## ✅ Complete Implementation Checklist

**Part 1: Live Execution Flow (8 hours)**
- [ ] Implement EnhancedProcessRunner with entry point detection
- [ ] Implement ExecutionTracer with multi-format parsing
- [ ] Add execution state tracking (idle/entry/executing/component/error)
- [ ] Create execution flow CSS animations
- [ ] Add WebSocket events for real-time updates
- [ ] Test with React, Node, Python projects
- [ ] Add moving arrow animations for data flow

**Part 2: AI Auto-Fix (6 hours)**
- [ ] Create AIFixService with Gemini integration
- [ ] Implement context gathering (file + imports + error)
- [ ] Add fix validation logic
- [ ] Create backup system before applying fixes
- [ ] Add AI Fix button to error nodes
- [ ] Test with common errors (undefined, type errors, syntax)
- [ ] Add diff preview for fixes

**Part 3: Integration (4 hours)**
- [ ] Connect execution events to graph updates
- [ ] Add auto-restart after fix
- [ ] Add loading states for AI fix
- [ ] Test complete flow end-to-end
- [ ] Add error recovery if fix fails
- [ ] Document API key setup

**Total: ~18 hours**

---

## 🎯 Success Criteria

**Live Execution Flow:**
1. ✅ Entry point glows blue when process starts
2. ✅ Files glow green/yellow as they execute
3. ✅ Arrows animate showing data flow
4. ✅ Error nodes turn red immediately

**AI Auto-Fix:**
1. ✅ Error detected within 1 second
2. ✅ AI fix completes in < 10 seconds
3. ✅ Fix success rate > 60% for common errors
4. ✅ Never breaks working code
5. ✅ Backups created before every fix

---

This system transforms VISOR from "cool visualization" into "intelligent debugging companion" that developers will rely on daily! 🚀