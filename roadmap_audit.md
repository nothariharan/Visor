# VISOR 3.0: Roadmap Audit & Initial Feedback

This document provides a structured analysis of the current VISOR codebase against the proposed "VISOR 3.0 Complete IDE Replacement Roadmap."

## Executive Summary
VISOR currently sits at a **"Visual Code Explorer"** stage. It has a high-quality foundation for graph visualization and basic editing, but lacks the core "IDE loops" (persistent state, fast navigation, interactive terminal) that make a tool like VS Code indispensable.

---

## Phase 1: Core IDE Fundamentals

### 1. Persistent State & Layouts
- **Current Status:** 🔴 **Not Implemented.** All layout state is in-memory. Reloading the browser triggers a full layout recalculation.
- **Feasibility:** **Very High.** We can easily use the existing `fs-extra` and `path` utilities on the backend to manage a `.visor/` directory.
- **Next Step:** Update `server/index.js` to handle `GET/POST` for layout config.

### 2. Universal Search (Cmd+P)
- **Current Status:** 🟡 **Partial.** A search bar exists that can find files and folders and center the graph on them. However, it lacks fuzzy matching (uses only `.includes()`), keyboard shortcuts, and a "modal" feel.
- **Feasibility:** **High.** Moving the existing `Search.jsx` to a global modal and adding a fuzzy-search library like `fuse.js` on the backend would solve this.
- **Score:** 40%

### 3. Integrated Monaco Editor (Enhanced)
- **Current Status:** 🟢 **Solid Foundation.** Monaco is used, has syntax highlighting, and basic saving (Ctrl+S).
- **Missing Features:** Breadcrumbs, split editing, and tabs.
- **Feasibility:** **High.** Monaco supports these features natively; the challenge is the UI layout management in React.
- **Score:** 60%

### 4. Terminal Integration
- **Current Status:** 🟡 **Minimal.** Output is captured via `spawn` and displayed in a read-only view in `ProcessManager`.
- **Missing Features:** Stdin (interactivity), `xterm.js` for true emulation, and multi-tab terminals.
- **Feasibility:** **Medium.** Requires moving from `child_process.spawn` to `node-pty` to handle TTY/interactivity correctly.
- **Score:** 30%

### 5. Git Integration (Visual)
- **Current Status:** 🔴 **Infrastructure Only.** `server/git.js` can fetch status and logs, but this data is not shown on the graph or in a dedicated panel.
- **Feasibility:** **High.** We just need to map the `git status` results to node data in `store.js` and use CSS/Lucide icons to show status dots.
- **Score:** 10%

---

## Phase 2: Advanced IDE Features

| Feature | Status | Feasibility | Complexity |
| :--- | :---: | :--- | :--- |
| **LSP Integration** | 🔴 0% | Possible via `vscode-ws-jsonrpc` | **Very High** |
| **File Indexing** | 🔴 0% | Requires backend caching | Medium |
| **AI Assistant** | 🔴 0% | Requires API integration (Gemini/OpenAI) | Low |
| **Multiplayer** | 🔴 5% | Foundation of Socket.io exists | High |
| **Component Library**| 🔴 0% | UI/Frontend task | Medium |

---

## Phase 3: Professional Features

### 11. Testing Integration
- **Current Status:** 🔴 **Not Implemented.** However, the "Critical Path" logic already understands `.test.js` files, meaning the graph can "see" tests, but it can't run them or report results yet.
- **Feasibility:** **Medium.** We can spawn Jest/Vitest and parse the JSON output to update node borders.

### 12-15. Profiling, DB, Deployment, Extensions
- **Current Status:** 🔴 **Planned.**
- **Feasibility:** Deployment (Vercel/Railway) is highly feasible via their CLIs. DB visualization is a natural fit for our graph architecture.

---

## Conclusion: Is it possible?

**Yes, 100%.** 

The most "magical" part of VISOR—the dynamic, performant graph that understands dependencies—is already working. Everything else (Persistence, Search, Terminals) consists of standard IDE-building blocks that have well-documented implementation paths.

### Immediate Priority Recommendations:
1.  **Persistence:** Fix the "reload loses layout" issue first. It's the #1 friction point.
2.  **Universal Search:** Change the search to a `Cmd+P` modal to make navigation feel fast.
3.  **Visual Git:** Add the modified dots. It gives "life" to the graph immediately.
