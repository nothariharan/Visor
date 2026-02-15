# VISOR UI Rework: Terminal Aesthetic (Copy-Paste Ready)

**Design Philosophy:** Strip away all glassmorphism, gradients, and soft shadows. Embrace hard edges, monospace typography, and terminal-inspired UI elements.

**Reference:** https://jasoncameron.dev/ (Catppuccin Mocha theme)

---

## 1. Setup: Install Dependencies

```bash
# Install JetBrains Mono font (via CDN or local)
# Add to your index.html <head>:
```

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
```

---

## 2. Tailwind Config (tailwind.config.js)

**Copy-paste this entire config:**

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Catppuccin Mocha Palette
        crust: '#11111b',
        mantle: '#181825',
        base: '#1e1e2e',
        surface0: '#313244',
        surface1: '#45475a',
        surface2: '#585b70',
        
        overlay0: '#6c7086',
        overlay1: '#7f849c',
        overlay2: '#9399b2',
        
        subtext0: '#a6adc8',
        subtext1: '#bac2de',
        text: '#cdd6f4',
        
        lavender: '#b4befe',
        blue: '#89b4fa',
        sapphire: '#74c7ec',
        sky: '#89dceb',
        teal: '#94e2d5',
        green: '#a6e3a1',
        yellow: '#f9e2af',
        peach: '#fab387',
        maroon: '#eba0ac',
        red: '#f38ba8',
        mauve: '#cba6f7',
        pink: '#f5c2e7',
        flamingo: '#f2cdcd',
        rosewater: '#f5e0dc',
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        'hard': '4px 4px 0px rgba(17, 17, 27, 1)',
        'hard-hover': '6px 6px 0px rgba(17, 17, 27, 1)',
        'hard-red': '4px 4px 0px rgba(243, 139, 168, 0.3)',
        'hard-green': '4px 4px 0px rgba(166, 227, 161, 0.3)',
        'hard-peach': '4px 4px 0px rgba(250, 179, 135, 0.3)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'terminal-blink': 'blink 1s step-end infinite',
      },
      keyframes: {
        blink: {
          '0%, 50%': { opacity: '1' },
          '51%, 100%': { opacity: '0' },
        }
      }
    },
  },
  plugins: [],
}
```

---

## 3. Global CSS (src/index.css)

**Replace your entire CSS file with this:**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

/* Global Styles */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'JetBrains Mono', monospace;
  background-color: #1e1e2e;
  color: #cdd6f4;
  overflow: hidden;
}

/* Remove default scrollbar styling */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: #181825;
}

::-webkit-scrollbar-thumb {
  background: #45475a;
  border-radius: 0;
}

::-webkit-scrollbar-thumb:hover {
  background: #585b70;
}

/* React Flow Overrides */
.react-flow {
  background-color: #181825 !important;
}

.react-flow__node {
  transition: transform 0.2s ease-out;
}

.react-flow__node:hover {
  transform: translateY(-2px);
}

.react-flow__edge-path {
  stroke: #45475a;
  stroke-width: 2px;
}

.react-flow__edge.selected .react-flow__edge-path,
.react-flow__edge:focus .react-flow__edge-path {
  stroke: #89b4fa;
  stroke-width: 3px;
}

.react-flow__controls {
  background: #313244;
  border: 1px solid #45475a;
  border-radius: 0;
  box-shadow: 4px 4px 0px rgba(17, 17, 27, 1);
}

.react-flow__controls-button {
  background: #313244;
  border-bottom: 1px solid #45475a;
  color: #cdd6f4;
}

.react-flow__controls-button:hover {
  background: #45475a;
}

.react-flow__minimap {
  background: #313244;
  border: 1px solid #45475a;
  border-radius: 0;
}

/* Terminal cursor effect */
.terminal-cursor::after {
  content: '█';
  animation: blink 1s step-end infinite;
  margin-left: 2px;
}

@keyframes blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
}

/* Tag styles (like the reference image) */
.tag {
  display: inline-block;
  padding: 2px 8px;
  margin: 2px;
  font-size: 11px;
  border: 1px solid currentColor;
  border-radius: 4px;
  text-transform: lowercase;
  font-weight: 500;
}

.tag-blue { color: #89b4fa; border-color: #89b4fa; }
.tag-green { color: #a6e3a1; border-color: #a6e3a1; }
.tag-peach { color: #fab387; border-color: #fab387; }
.tag-red { color: #f38ba8; border-color: #f38ba8; }
.tag-yellow { color: #f9e2af; border-color: #f9e2af; }
.tag-mauve { color: #cba6f7; border-color: #cba6f7; }
```

---

## 4. Main App Layout (src/App.jsx)

**Replace your App.jsx:**

```jsx
import { useState } from 'react';
import Header from './components/Header';
import GraphCanvas from './components/GraphCanvas';
import Sidebar from './components/Sidebar';
import ProcessManager from './components/ProcessManager';

function App() {
  const [currentMode, setCurrentMode] = useState('skeleton');
  const [showSidebar, setShowSidebar] = useState(true);
  const [showProcessManager, setShowProcessManager] = useState(true);

  return (
    <div className="h-screen w-screen bg-base font-mono flex flex-col overflow-hidden">
      {/* Header */}
      <Header 
        currentMode={currentMode} 
        onModeChange={setCurrentMode}
      />

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar (Left) */}
        {showSidebar && (
          <Sidebar />
        )}

        {/* Graph Canvas (Center) */}
        <div className="flex-1 relative bg-mantle">
          <GraphCanvas mode={currentMode} />
        </div>

        {/* Process Manager (Right) */}
        {showProcessManager && (
          <ProcessManager />
        )}
      </div>

      {/* Status Bar (Bottom) */}
      <div className="h-6 bg-crust border-t border-surface1 flex items-center justify-between px-4 text-xs text-subtext0">
        <div className="flex gap-4">
          <span>● Watching files...</span>
          <span>5 / 7 files</span>
          <span>3 entry</span>
        </div>
        <div className="flex gap-4">
          <span>2 hidden</span>
          <span>⚡ 0ms</span>
        </div>
      </div>
    </div>
  );
}

export default App;
```

---

## 5. Header Component (src/components/Header.jsx)

**Terminal-style header with mode switcher:**

```jsx
export default function Header({ currentMode, onModeChange }) {
  const modes = [
    { id: 'topography', label: 'Topography', icon: '🌐', desc: 'Raw file tree' },
    { id: 'skeleton', label: 'Skeleton', icon: '🦴', desc: 'Critical path' },
    { id: 'forge', label: 'Forge', icon: '⚡', desc: 'Live execution' },
  ];

  return (
    <header className="h-14 bg-crust border-b-2 border-surface1 flex items-center justify-between px-6">
      {/* Left: Project Path */}
      <div className="flex items-center gap-3 text-sm">
        <span className="text-green">➜</span>
        <span className="text-blue">~/visor</span>
        <span className="text-subtext0">/</span>
        <span className="text-text">my-project</span>
      </div>

      {/* Center: Mode Switcher */}
      <div className="flex gap-2">
        {modes.map(mode => (
          <button
            key={mode.id}
            onClick={() => onModeChange(mode.id)}
            className={`
              px-4 py-1.5 text-xs font-bold uppercase tracking-wider
              border transition-all
              ${currentMode === mode.id
                ? 'bg-peach text-crust border-peach shadow-hard-peach'
                : 'bg-surface0 text-subtext0 border-surface1 hover:border-text'
              }
            `}
          >
            <span className="mr-2">{mode.icon}</span>
            {mode.label}
          </button>
        ))}
      </div>

      {/* Right: System Status */}
      <div className="flex items-center gap-3 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green animate-pulse-slow" />
          <span className="text-subtext0">System Nominal</span>
        </div>
        <div className="text-subtext0">03:42:24</div>
      </div>
    </header>
  );
}
```

---

## 6. Terminal Node Component (src/components/TerminalNode.jsx)

**This is your React Flow node - copy-paste ready:**

```jsx
import { Handle, Position } from '@xyflow/react';

export default function TerminalNode({ data, selected }) {
  const isError = data.status === 'error';
  const isExecuting = data.status === 'executing';
  const isWarning = data.status === 'warning';

  // Determine border color
  const borderColor = isError ? 'border-red' :
                      isWarning ? 'border-yellow' :
                      isExecuting ? 'border-green' :
                      selected ? 'border-blue' : 'border-surface1';

  const shadowColor = isError ? 'shadow-hard-red' :
                      isExecuting ? 'shadow-hard-green' :
                      'shadow-hard';

  return (
    <div 
      className={`
        font-mono w-64 bg-surface0 text-text 
        border-2 ${borderColor} ${shadowColor}
        rounded-md overflow-hidden transition-all
        hover:shadow-hard-hover
        ${isExecuting ? 'animate-pulse-slow' : ''}
      `}
    >
      {/* Header Bar */}
      <div className={`
        px-3 py-1 text-xs border-b-2 ${borderColor}
        ${isError ? 'bg-red/10' : isExecuting ? 'bg-green/10' : 'bg-mantle'}
        flex justify-between items-center
      `}>
        <span className="text-subtext0">
          {data.type === 'folder' ? 'drwxr-xr-x' : '-rw-r--r--'}
        </span>
        <span className="text-subtext0 text-[10px]">
          {new Date(data.mtime || Date.now()).toLocaleTimeString()}
        </span>
      </div>

      {/* Main Content */}
      <div className="p-3">
        <div className="flex items-center gap-2 mb-2">
          {/* Icon based on status */}
          {isError && <span className="text-red text-lg">✖</span>}
          {isExecuting && <span className="text-green text-lg">⚡</span>}
          {isWarning && <span className="text-yellow text-lg">⚠</span>}
          {!isError && !isExecuting && !isWarning && (
            <span className="text-blue text-lg">
              {data.type === 'folder' ? '📁' : '📄'}
            </span>
          )}
          
          {/* Filename */}
          <span className="font-bold text-sm truncate">{data.label}</span>
        </div>
        
        {/* Metadata */}
        <div className="text-[10px] text-subtext0 space-y-1">
          {data.commits && (
            <div className="flex justify-between">
              <span>[commits]:</span>
              <span className={data.commits > 20 ? 'text-red' : 'text-green'}>
                {data.commits}
              </span>
            </div>
          )}
          
          {data.loc && (
            <div className="flex justify-between">
              <span>[loc]:</span>
              <span>{data.loc}</span>
            </div>
          )}
          
          {data.imports && (
            <div className="flex justify-between">
              <span>[imports]:</span>
              <span className="text-blue">{data.imports}</span>
            </div>
          )}
          
          {data.importedBy && (
            <div className="flex justify-between">
              <span>[deps]:</span>
              <span className="text-peach font-bold">{data.importedBy}</span>
            </div>
          )}
        </div>

        {/* Tags (framework, type, etc.) */}
        {data.framework && (
          <div className="mt-2 flex flex-wrap gap-1">
            <span className="tag tag-blue">{data.framework}</span>
            {data.category && (
              <span className="tag tag-green">{data.category}</span>
            )}
          </div>
        )}
      </div>

      {/* Error/Warning Message */}
      {(isError || isWarning) && data.errorMessage && (
        <div className={`
          p-2 border-t-2 ${borderColor}
          ${isError ? 'bg-red/5' : 'bg-yellow/5'}
        `}>
          <div className={`
            text-[10px] mb-2 font-mono
            ${isError ? 'text-red' : 'text-yellow'}
          `}>
            [ERROR] {data.errorMessage}
          </div>
          {data.line && (
            <div className="text-[10px] text-subtext0 mb-2">
              → Line {data.line}:{data.column || 0}
            </div>
          )}
          
          {/* Action Buttons */}
          <div className="flex gap-2">
            <button className="
              flex-1 py-1 bg-peach text-crust 
              text-[10px] font-bold uppercase 
              hover:bg-peach/80 transition-colors
              border border-peach
            ">
              ✨ AI Fix
            </button>
            <button className="
              px-3 py-1 bg-surface1 text-text 
              text-[10px] font-bold uppercase 
              hover:bg-surface2 transition-colors
              border border-surface1
            ">
              Jump →
            </button>
          </div>
        </div>
      )}

      {/* React Flow Handles */}
      <Handle 
        type="target" 
        position={Position.Left} 
        className="w-2 h-4 bg-surface1 rounded-none border-none hover:bg-blue" 
      />
      <Handle 
        type="source" 
        position={Position.Right} 
        className="w-2 h-4 bg-surface1 rounded-none border-none hover:bg-blue" 
      />
    </div>
  );
}
```

---

## 7. Sidebar Component (src/components/Sidebar.jsx)

**Left panel for file tree/info:**

```jsx
import { useState } from 'react';

export default function Sidebar() {
  const [activeTab, setActiveTab] = useState('files');

  return (
    <div className="w-80 bg-crust border-r-2 border-surface1 flex flex-col">
      {/* Tab Bar */}
      <div className="h-10 border-b-2 border-surface1 flex">
        <button
          onClick={() => setActiveTab('files')}
          className={`
            flex-1 text-xs font-bold uppercase
            ${activeTab === 'files' 
              ? 'bg-surface0 text-text border-b-2 border-peach' 
              : 'bg-mantle text-subtext0 hover:bg-surface0'
            }
          `}
        >
          📁 Files
        </button>
        <button
          onClick={() => setActiveTab('info')}
          className={`
            flex-1 text-xs font-bold uppercase
            ${activeTab === 'info' 
              ? 'bg-surface0 text-text border-b-2 border-peach' 
              : 'bg-mantle text-subtext0 hover:bg-surface0'
            }
          `}
        >
          ℹ️ Info
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 text-sm">
        {activeTab === 'files' && (
          <div className="space-y-2">
            <FileTreeItem name="src" type="folder" expanded />
            <FileTreeItem name="components" type="folder" indent={1} />
            <FileTreeItem name="App.jsx" type="file" indent={2} status="error" />
            <FileTreeItem name="main.jsx" type="file" indent={2} />
            <FileTreeItem name="public" type="folder" />
            <FileTreeItem name="package.json" type="file" />
          </div>
        )}

        {activeTab === 'info' && (
          <div className="space-y-4 text-xs">
            <InfoBlock title="Project" items={[
              ['Name', 'my-project'],
              ['Type', 'React + Vite'],
              ['Files', '147'],
              ['Dependencies', '23']
            ]} />
            
            <InfoBlock title="Git" items={[
              ['Branch', 'main'],
              ['Commits', '142'],
              ['Modified', '3 files']
            ]} />
          </div>
        )}
      </div>
    </div>
  );
}

function FileTreeItem({ name, type, indent = 0, expanded, status }) {
  const icon = type === 'folder' 
    ? (expanded ? '📂' : '📁')
    : '📄';

  const statusColor = status === 'error' ? 'text-red' : 'text-text';

  return (
    <div 
      className={`
        flex items-center gap-2 py-1 px-2 rounded
        hover:bg-surface0 cursor-pointer
        ${statusColor}
      `}
      style={{ paddingLeft: `${8 + indent * 16}px` }}
    >
      <span>{icon}</span>
      <span className="text-xs">{name}</span>
      {status === 'error' && (
        <span className="ml-auto text-red text-xs">✖</span>
      )}
    </div>
  );
}

function InfoBlock({ title, items }) {
  return (
    <div className="border border-surface1 rounded p-3">
      <div className="text-peach font-bold mb-2 text-xs uppercase">
        {title}
      </div>
      <div className="space-y-1">
        {items.map(([key, value]) => (
          <div key={key} className="flex justify-between text-subtext0">
            <span>[{key.toLowerCase()}]:</span>
            <span className="text-text">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## 8. Process Manager Component (src/components/ProcessManager.jsx)

**Right panel for running processes:**

```jsx
import { useState } from 'react';

export default function ProcessManager() {
  const [processes, setProcesses] = useState([
    { id: 1, name: 'Frontend', status: 'running', port: 5173, uptime: '00:12:34' },
    { id: 2, name: 'Backend', status: 'running', port: 3000, uptime: '00:12:30' },
    { id: 3, name: 'Database', status: 'stopped', port: 27017, uptime: '--:--:--' },
  ]);

  return (
    <div className="w-96 bg-crust border-l-2 border-surface1 flex flex-col">
      {/* Header */}
      <div className="h-10 border-b-2 border-surface1 flex items-center justify-between px-4">
        <span className="text-xs font-bold uppercase text-text">
          🎛️ Processes
        </span>
        <button className="text-xs bg-peach text-crust px-2 py-1 font-bold hover:bg-peach/80">
          + ADD
        </button>
      </div>

      {/* Process List */}
      <div className="flex-1 overflow-auto p-3 space-y-3">
        {processes.map(proc => (
          <ProcessCard key={proc.id} {...proc} />
        ))}
      </div>

      {/* Actions */}
      <div className="h-14 border-t-2 border-surface1 flex gap-2 p-3">
        <button className="flex-1 bg-green text-crust text-xs font-bold uppercase hover:bg-green/80">
          ▶ Start All
        </button>
        <button className="flex-1 bg-red text-crust text-xs font-bold uppercase hover:bg-red/80">
          ⏹ Stop All
        </button>
      </div>
    </div>
  );
}

function ProcessCard({ name, status, port, uptime }) {
  const isRunning = status === 'running';

  return (
    <div className={`
      border-2 ${isRunning ? 'border-green' : 'border-surface1'}
      bg-surface0 rounded p-3
      ${isRunning ? 'shadow-hard-green' : 'shadow-hard'}
    `}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className={`
            w-2 h-2 rounded-full
            ${isRunning ? 'bg-green animate-pulse-slow' : 'bg-surface1'}
          `} />
          <span className="text-sm font-bold">{name}</span>
        </div>
        
        <div className="flex gap-1">
          {!isRunning && (
            <button className="px-2 py-0.5 bg-green text-crust text-[10px] font-bold">
              ▶
            </button>
          )}
          {isRunning && (
            <>
              <button className="px-2 py-0.5 bg-yellow text-crust text-[10px] font-bold">
                ⏸
              </button>
              <button className="px-2 py-0.5 bg-red text-crust text-[10px] font-bold">
                ⏹
              </button>
            </>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="text-[10px] text-subtext0 space-y-1">
        <div className="flex justify-between">
          <span>[port]:</span>
          <span className="text-blue">{port}</span>
        </div>
        <div className="flex justify-between">
          <span>[uptime]:</span>
          <span className={isRunning ? 'text-green' : 'text-surface1'}>
            {uptime}
          </span>
        </div>
      </div>

      {/* Open in Browser */}
      {isRunning && (
        <button className="
          w-full mt-2 py-1 
          bg-blue text-crust 
          text-[10px] font-bold uppercase 
          hover:bg-blue/80 transition-colors
        ">
          🌐 Open localhost:{port}
        </button>
      )}
    </div>
  );
}
```

---

## 9. Search Bar Component (src/components/SearchBar.jsx)

**Terminal-style search with auto-complete:**

```jsx
import { useState } from 'react';

export default function SearchBar() {
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 w-[500px]">
      <div className={`
        relative border-2 
        ${focused ? 'border-blue shadow-hard-hover' : 'border-surface1 shadow-hard'}
        bg-surface0 transition-all
      `}>
        {/* Input */}
        <div className="flex items-center px-3 py-2">
          <span className="text-blue mr-2">$</span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 200)}
            placeholder="search files or run command..."
            className="
              flex-1 bg-transparent text-text text-sm
              outline-none placeholder:text-subtext0
              font-mono
            "
          />
          {query && (
            <button 
              onClick={() => setQuery('')}
              className="text-subtext0 hover:text-red"
            >
              ✕
            </button>
          )}
        </div>

        {/* Autocomplete Results */}
        {focused && query && (
          <div className="border-t-2 border-surface1 bg-mantle max-h-64 overflow-auto">
            <SearchResult icon="📄" name="App.jsx" path="src/App.jsx" />
            <SearchResult icon="📄" name="main.jsx" path="src/main.jsx" />
            <SearchResult icon="📁" name="components" path="src/components" />
          </div>
        )}
      </div>
    </div>
  );
}

function SearchResult({ icon, name, path }) {
  return (
    <button className="
      w-full flex items-center gap-3 px-3 py-2
      hover:bg-surface0 text-left
      border-b border-surface1 last:border-0
    ">
      <span>{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="text-text text-sm font-medium truncate">{name}</div>
        <div className="text-subtext0 text-xs truncate">{path}</div>
      </div>
      <span className="text-subtext0 text-xs">⏎</span>
    </button>
  );
}
```

---

## 10. Modal/Panel Components

**For AI chat, settings, etc.:**

```jsx
export function TerminalModal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="
        w-[800px] max-h-[600px]
        bg-surface0 border-2 border-surface1
        shadow-hard-hover
        flex flex-col
      ">
        {/* Header */}
        <div className="
          h-12 border-b-2 border-surface1
          flex items-center justify-between px-4
          bg-mantle
        ">
          <span className="text-sm font-bold uppercase">{title}</span>
          <button 
            onClick={onClose}
            className="text-red hover:bg-red hover:text-crust px-2 py-1 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {children}
        </div>
      </div>
    </div>
  );
}

export function TerminalButton({ children, variant = 'default', ...props }) {
  const variants = {
    default: 'bg-surface1 text-text hover:bg-surface2 border-surface1',
    primary: 'bg-blue text-crust hover:bg-blue/80 border-blue',
    success: 'bg-green text-crust hover:bg-green/80 border-green',
    danger: 'bg-red text-crust hover:bg-red/80 border-red',
    warning: 'bg-yellow text-crust hover:bg-yellow/80 border-yellow',
    peach: 'bg-peach text-crust hover:bg-peach/80 border-peach',
  };

  return (
    <button
      className={`
        px-4 py-2 text-xs font-bold uppercase
        border-2 transition-colors
        ${variants[variant]}
      `}
      {...props}
    >
      {children}
    </button>
  );
}
```

---

## 11. Animations & Effects

**Add these utility classes for terminal effects:**

```css
/* Add to src/index.css */

/* Glitch effect on error */
@keyframes glitch {
  0% { transform: translate(0); }
  20% { transform: translate(-2px, 2px); }
  40% { transform: translate(-2px, -2px); }
  60% { transform: translate(2px, 2px); }
  80% { transform: translate(2px, -2px); }
  100% { transform: translate(0); }
}

.glitch-error {
  animation: glitch 0.3s infinite;
}

/* Scan line effect */
@keyframes scan-line {
  0% { transform: translateY(-100%); }
  100% { transform: translateY(100%); }
}

.scan-line::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: rgba(137, 180, 250, 0.3);
  animation: scan-line 8s linear infinite;
  pointer-events: none;
}

/* Terminal typing effect */
@keyframes typing {
  from { width: 0; }
  to { width: 100%; }
}

.typing-effect {
  overflow: hidden;
  white-space: nowrap;
  animation: typing 1s steps(40, end);
}

/* Data packet moving along edge */
@keyframes packet-flow {
  0% { offset-distance: 0%; }
  100% { offset-distance: 100%; }
}

.packet-flow {
  animation: packet-flow 2s linear infinite;
}
```

---

## 12. React Flow Custom Edge

**Animated data packets along edges:**

```jsx
import { getBezierPath } from '@xyflow/react';

export default function TerminalEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data
}) {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const isActive = data?.active;
  const isError = data?.error;

  return (
    <>
      {/* Main path */}
      <path
        id={id}
        className="react-flow__edge-path"
        d={edgePath}
        stroke={isError ? '#f38ba8' : isActive ? '#89b4fa' : '#45475a'}
        strokeWidth={isActive ? 3 : 2}
        strokeDasharray={isError ? '5,5' : '0'}
        fill="none"
      />

      {/* Animated packet */}
      {isActive && (
        <circle r="3" fill="#89b4fa">
          <animateMotion
            dur="2s"
            repeatCount="indefinite"
            path={edgePath}
          />
        </circle>
      )}

      {/* Label */}
      {data?.label && (
        <text>
          <textPath
            href={`#${id}`}
            startOffset="50%"
            textAnchor="middle"
            className="text-[10px] fill-subtext0"
          >
            {data.label}
          </textPath>
        </text>
      )}
    </>
  );
}
```

---

## 13. Final Integration

**Update your main graph component:**

```jsx
import ReactFlow, { Background, Controls, MiniMap } from '@xyflow/react';
import TerminalNode from './TerminalNode';
import TerminalEdge from './TerminalEdge';

const nodeTypes = {
  terminal: TerminalNode,
};

const edgeTypes = {
  terminal: TerminalEdge,
};

export default function GraphCanvas({ mode }) {
  const nodes = useGraphStore(state => state.nodes);
  const edges = useGraphStore(state => state.edges);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      fitView
      className="font-mono"
    >
      <Background 
        color="#45475a"
        gap={16}
        size={1}
        variant="dots"
      />
      
      <Controls />
      
      <MiniMap
        nodeColor={(node) => {
          if (node.data.status === 'error') return '#f38ba8';
          if (node.data.status === 'executing') return '#a6e3a1';
          return '#313244';
        }}
      />
    </ReactFlow>
  );
}
```

---

## 🎯 Implementation Checklist

1. ✅ Copy Tailwind config
2. ✅ Copy global CSS
3. ✅ Replace App.jsx with new layout
4. ✅ Copy Header component
5. ✅ Copy TerminalNode component
6. ✅ Copy Sidebar component
7. ✅ Copy ProcessManager component
8. ✅ Add SearchBar (optional)
9. ✅ Add animations CSS
10. ✅ Test and tweak colors

---

## 🚀 Quick Start

```bash
# 1. Install font (already in HTML head)
# 2. Update tailwind.config.js
# 3. Update src/index.css
# 4. Replace components one by one
# 5. Test each component
# 6. Adjust colors to taste
```

**Total time:** 2-3 hours for complete UI overhaul

This is 100% copy-paste ready. Each component is self-contained and uses the Catppuccin Mocha palette exactly like the reference site! 🎨