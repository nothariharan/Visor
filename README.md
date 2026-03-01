# Visor 🚀

**The Visual Operating System for Your Codebase.**

Visor is a developer tool that transforms the abstract, text-based nature of coding into a tangible, spatial experience. It visualizes your entire codebase as a living, breathing dependency map, allowing you to understand architecture, navigate files, and resolve errors through an intuitive visual interface.

![Visor Hero](https://via.placeholder.com/800x400.png?text=Visor+Visual+Operating+System)

## ✨ Core Features

### 🗺️ The "God View" (Live Architecture Graph)
Visualize your project structure dynamically. Visor maps out file dependencies, imports, and folder hierarchies as interactive nodes and edges. Changes in your filesystem are reflected instantly in the graph.

### 🕰️ Chronicle Mode (Spatial Time Travel)
Step through your Git history visually. Click any commit to "time travel" the entire graph and filesystem to that state. Understand how your architecture evolved over time and debug historical issues with ease.

### ⚡ Forge Mode (Live Execution & Monitoring)
Monitor your running processes directly within the graph. Files that are currently executing or rendering glow in real-time. Catch stack traces, visualize error paths, and see your code "come alive" as it runs.

### 🛡️ Guardian AI (Agnostic Auto-Fix)
Resolve errors with one click. Visor detects runtime errors, parses stack traces, and provides an AI-powered "Auto-Fix" button that generates and applies code corrections using specialized LLMs (OpenRouter/Gemini).

### 📝 Tactical Editor
Edit code without leaving the graph. A slide-out Monaco Editor allows for quick fixes and bi-directional synchronization with your primary IDE (VS Code, Cursor, etc.).

## 🚀 Quick Start

### Prerequisites
- Node.js (v18+)
- Local Git repository

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-username/visor.git
   cd visor
   ```

2. **Install dependencies:**
   ```bash
   npm run build
   ```
   *This will install both backend and frontend dependencies and build the production client.*

3. **Configure Environment:**
   Copy the example environment file and add your API keys:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and add your `OPENROUTER_API_KEY` (recommended) or `GEMINI_API_KEY`.

4. **Launch Visor:**
   Run Visor on your current project:
   ```bash
   npm link
   visor .
   ```
   Alternatively, run from the directory:
   ```bash
   node server/index.js .
   ```

## 🛠️ Configuration

Visor can be customized via a `visor.config.js` file in your project root.

```javascript
module.exports = {
  aiProvider: 'openrouter', // or 'gemini'
  ignorePatterns: [
    '**/node_modules/**',
    '**/dist/**',
    '**/.git/**'
  ],
  defaultEditor: 'vscode', // vscode, cursor, etc.
};
```

## 🏗️ Architecture

Visor operates on a **Client-Server Model**:
- **Backend (Node.js):** Handles file watching (`chokidar`), dependency parsing (`dependency-cruiser`), Git operations (`simple-git`), and AI routing.
- **Frontend (React/Vite):** An interactive dashboard powered by `React Flow` for graph rendering and `Monaco Editor` for code manipulation.

## 🤝 Contributing

Visor is a hackathon-born prototype. We welcome contributions, bug reports, and feature requests!

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request


