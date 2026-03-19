<div align="center">

# 🌌 VISOR

### The Visual Operating System for Your Codebase

*Navigate code spatially. Debug visually. Build intelligently.*

[![License: MIT](https://img.shields.io/badge/License-MIT-a6e3a1.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)
[![Node Version](https://img.shields.io/badge/node-%3E%3D18.0.0-89b4fa.svg?style=for-the-badge)](https://nodejs.org)
[![Status](https://img.shields.io/badge/status-active-a6e3a1.svg?style=for-the-badge)]()

<img width="800" height="600" alt="image" src="https://github.com/user-attachments/assets/6f8faf82-2cc8-458b-8014-3d4e00bc2918" />


**Stop drowning in file trees. Start seeing your architecture.**

[Live Demo](https://drive.google.com/file/d/1EopvzptrC0TUANrY8gk3-_0EBJPTJ7Jl/view?usp=drive_link) • [Documentation](https://github.com/nothariharan/Visor) • [Discord](https://youtu.be/QDia3e12czc?si=8SpsByB0L9qvmxd9)

</div>

---

## 💫 Why VISOR?

Traditional IDEs show you a **flat list of files**. VISOR shows you a **living system**.
```
VS Code              →    VISOR
─────────────────────────────────────────
📁 src/              →    [Interactive Graph]
  📁 components/     →    Nodes pulse as code runs
  📁 utils/          →    Edges show dependencies
  📄 App.jsx         →    Errors glow red instantly
```

**Built for:**
- 🧠 Understanding complex codebases in minutes, not days
- 🐛 Debugging by seeing execution flow visually
- 🎯 Refactoring with confidence (see all impacts)
- 🚀 Onboarding new developers 10x faster
- 🔮 Traveling through Git history spatially

---

## 🎭 Four Modes. Infinite Power.

<table>
<tr>
<td width="50%">

### 🗺️ **TOPOGRAPHY**
*The God View*

<img width="1600" height="899" alt="image" src="https://github.com/user-attachments/assets/4e23243b-cef5-4e78-bc68-1dc49d7bf3cb" />

See your entire codebase as an **interactive dependency graph**. Files are nodes. Imports are edges. Folders expand. Everything updates in real-time.

**Perfect for:**
- Architecture reviews
- Finding circular dependencies
- Understanding project structure
- Identifying code islands

</td>
<td width="50%">

### 🦴 **SKELETON**
*The Critical Path*

<img width="1600" height="886" alt="image" src="https://github.com/user-attachments/assets/aa8c6459-6060-4109-9730-712287ae6339" />


Filter noise. Show only **entry points** and **core modules**. 150+ files → 20 critical ones.

**Perfect for:**
- Code reviews
- Finding bottlenecks
- Onboarding teammates
- Impact analysis before changes

</td>
</tr>

<tr>
<td width="50%">

### ⚡ **FORGE**
*Live Execution Flow*

<img width="1600" height="899" alt="image" src="https://github.com/user-attachments/assets/e7caf51a-6873-410e-b4d4-7dd4e28f0bca" />


Watch your code **execute in real-time**. Entry points glow blue. Components pulse green. Errors turn red. **See the code breathe.**

**Perfect for:**
- Debugging runtime issues
- Understanding execution order
- Performance profiling
- Finding where errors originate

</td>
<td width="50%">

### 🕰️ **CHRONICLE**
*Time Travel Debugging*

<img width="1600" height="899" alt="image" src="https://github.com/user-attachments/assets/6cfacc8c-98b5-4f75-b4b7-5871721daa8a" />


Click any commit → **Files on disk change** → Graph updates to that exact moment. Test old bugs. Compare architectures. Understand evolution.

**Perfect for:**
- Reproducing production bugs
- Understanding refactoring history
- Comparing architectural decisions
- Code archaeology

</td>
</tr>
</table>

---

## 🛠️ Installation

### Quick Start
```bash
# Install globally
npm install -g @visor/cli

# Launch in any project
cd your-project
visor .
```

### Manual Setup
```bash
# Clone the repo
git clone https://github.com/nothariharan/visor.git
cd visor

# Install dependencies
npm install

# Build client
cd client && npm run build && cd ..

# Link globally
npm link

# Run in your project
cd /path/to/your/project
visor .
```

**That's it.** Open `http://localhost:6767` and see your codebase come alive.

---

## 🎯 Features That Actually Matter

### 🤖 **AI-Powered Auto-Fix**
Runtime error? Click **"✨ AI Fix"** on the red node. VISOR:
1. Reads the file + error stack
2. Sends to Gemini/OpenRouter
3. Applies the fix
4. Restarts your app automatically

**60% success rate on common errors.** Zero thinking required.

### 🔥 **Live Error Tracking**
Errors don't just show in terminal. They **glow red on the graph**. Execution path highlighted. One click to jump to the problem.

### 📝 **Integrated Monaco Editor**
Edit files directly in VISOR. Changes sync to your IDE (VS Code, Cursor, etc.). Syntax highlighting. IntelliSense. Autocomplete.

### 🌐 **Multi-Language Support**
Works with:
- JavaScript/TypeScript (React, Vue, Svelte, Node)
- Python (Django, Flask, FastAPI)
- Go, Rust, Ruby (coming soon)

### 🎨 **Terminal Aesthetic**
Catppuccin Mocha theme. Monospace everything. Hard shadows. No blur. Looks like a hacker terminal from the future.

---


---

## ⚙️ Configuration

Create `visor.config.js` in your project root:
```javascript
module.exports = {
  // AI Provider
  aiProvider: 'gemini', // or 'openrouter'
  
  // Files to ignore
  ignorePatterns: [
    '**/node_modules/**',
    '**/dist/**',
    '**/.git/**',
    '**/build/**'
  ],
  
  // Editor integration
  defaultEditor: 'vscode', // or 'cursor', 'vim', etc.
  
  // Graph settings
  graph: {
    maxNodes: 1000,
    collapseFolders: true,
    showHiddenFiles: false
  },
  
  // Forge mode
  forge: {
    autoRestart: true,
    errorTracking: true,
    aiAutoFix: false // Set true to auto-fix without clicking
  }
};
```

**Environment Variables** (`.env`):
```bash
# Required for AI features
GEMINI_API_KEY=your_key_here
OPENROUTER_API_KEY=your_key_here

# Optional
VISOR_PORT=6767
```

---

## 🎓 Quick Guide

### First Launch
```bash
visor .
```

**What happens:**
1. VISOR scans your project
2. Builds dependency graph
3. Opens browser at `localhost:6767`
4. You see your codebase as a living graph

### Navigate the Graph

- **Scroll** to zoom
- **Drag** to pan
- **Click node** to open file in editor
- **Click folder** to expand/collapse
- **Cmd+P** to search files instantly

### Run Your App

1. Click **Forge** mode
2. Click **▶️ Run** on your app card
3. Watch nodes light up as code executes
4. Errors turn red with "AI Fix" button

### Time Travel

1. Click **Chronicle** mode
2. Click any commit in timeline
3. **Files on disk change** to that commit
4. Click "Return to Present" when done

---

## 🏗️ Architecture
```
visor/
├── client/                # React frontend
│   ├── src/
│   │   ├── components/   # UI components
│   │   ├── hooks/        # Custom hooks
│   │   └── store/        # Zustand state
│   └── vite.config.js
├── server/               # Node.js backend
│   ├── runner/          # Process management
│   ├── tracer/          # Execution tracking
│   ├── git/             # Git operations
│   └── ai/              # AI auto-fix service
└── package.json
```

**Tech Stack:**
- **Frontend:** React, React Flow, Monaco Editor, Socket.io Client
- **Backend:** Node.js, Express, Chokidar, simple-git, Socket.io
- **AI:** Gemini API, OpenRouter
- **Parsing:** dependency-cruiser, tree-sitter

---

## 🤝 Contributing

We're building the future of code visualization. **Help us.**

### Ways to Contribute

1. **🐛 Report bugs** - [Open an issue](https://github.com/nothariharan/visor/issues)
2. **💡 Suggest features** - [Start a discussion](https://github.com/nothariharan/visor/discussions)
3. **🔧 Submit PRs** - See [CONTRIBUTING.md](CONTRIBUTING.md)
4. **📖 Improve docs** - Docs live in `/docs`
5. **⭐ Star the repo** - Seriously, it helps

### Development Setup
```bash
# Fork and clone
git clone https://github.com/YOUR_USERNAME/visor.git
cd visor

# Install deps
npm install
cd client && npm install && cd ..

# Run in dev mode
npm run dev

# Build for production
npm run build
```

**Before submitting PR:**
- Test on 3+ projects
- Add tests if adding features
- Update docs
- Follow existing code style

---

## 📜 License

MIT License - see [LICENSE](LICENSE) for details.

**TL;DR:** Do whatever you want. Credit appreciated but not required.

---

## 🌟 Star History

[![Star History Chart](https://api.star-history.com/svg?repos=nothariharan/visor&type=Date)](https://star-history.com/#nothariharan/visor&Date)

---

<div align="center">

### Built by developers, for developers.

**Stop reading files. Start seeing systems.**

[⭐ Star on GitHub](https://github.com/nothariharan/visor) • [🚀 Try the Demo](https://drive.google.com/file/d/1EopvzptrC0TUANrY8gk3-_0EBJPTJ7Jl/view?usp=drive_link) • [💬 Join Discord](https://discord.gg/visor)

<sub>Made with 🔥 by [@nothariharan](https://github.com/nothariharan) and [contributors](https://github.com/nothariharan/visor/graphs/contributors)</sub>

</div>
