# MultiRuntimeDetector: Detailed Implementation Guide

## Overview

We're building a system that scans your project and automatically finds all the things that can be "run":
- Frontend apps (React, Vue, etc.)
- Backend servers (Express, Django, etc.)
- Databases (Docker Compose)
- Monorepo packages (Turborepo, Nx)

## Step-by-Step Implementation

---

## STEP 1: Project Setup (10 minutes)

### Create the file structure

```bash
# In your VISOR backend
cd server/

# Create new directories
mkdir -p project/detection
mkdir -p project/__tests__

# Create files
touch project/detection/MultiRuntimeDetector.js
touch project/detection/strategies.js
touch project/detection/patterns.js
touch project/__tests__/detector.test.js
```

### Why this structure?

- `MultiRuntimeDetector.js` - Main orchestrator
- `strategies.js` - Detection strategies (monorepo, subdirs, docker)
- `patterns.js` - Reusable patterns (file patterns, naming conventions)
- `__tests__/` - Tests for verification

---

## STEP 2: Define Common Patterns (15 minutes)

These are the building blocks we'll use for detection.

```javascript
// server/project/detection/patterns.js

/**
 * Common patterns for detecting project types
 */
export const PATTERNS = {
  // Directory name patterns
  directories: {
    frontend: /^(frontend|client|web|app|ui|www)$/i,
    backend: /^(backend|api|server|service)$/i,
    admin: /^(admin|dashboard|cms)$/i,
    mobile: /^(mobile|ios|android|react-native|flutter)$/i,
    docs: /^(docs|documentation|wiki)$/i,
    shared: /^(shared|common|lib|libs|packages)$/i
  },
  
  // File indicators for different frameworks
  files: {
    // Node.js
    node: ['package.json'],
    
    // Python
    python: [
      'requirements.txt',
      'setup.py',
      'pyproject.toml',
      'Pipfile',
      'poetry.lock'
    ],
    
    // Ruby
    ruby: ['Gemfile', 'Rakefile'],
    
    // Go
    go: ['go.mod', 'go.sum'],
    
    // Rust
    rust: ['Cargo.toml', 'Cargo.lock'],
    
    // Java
    java: ['pom.xml', 'build.gradle', 'build.gradle.kts'],
    
    // PHP
    php: ['composer.json'],
    
    // Docker
    docker: [
      'docker-compose.yml',
      'docker-compose.yaml',
      'compose.yml',
      'compose.yaml',
      'Dockerfile'
    ],
    
    // Monorepo markers
    monorepo: [
      'turbo.json',      // Turborepo
      'nx.json',         // Nx
      'lerna.json',      // Lerna
      'pnpm-workspace.yaml',  // pnpm
      'rush.json'        // Rush
    ]
  },
  
  // Common dev commands by framework
  commands: {
    react: 'npm start',
    vite: 'npm run dev',
    nextjs: 'npm run dev',
    vue: 'npm run serve',
    angular: 'npm start',
    svelte: 'npm run dev',
    django: 'python manage.py runserver',
    flask: 'flask run',
    fastapi: 'uvicorn main:app --reload',
    rails: 'rails server',
    express: 'npm start',
    nest: 'npm run start:dev'
  }
};

/**
 * Icons for different runtime types
 */
export const ICONS = {
  frontend: '📱',
  backend: '⚙️',
  api: '🔌',
  database: '🗄️',
  docker: '🐳',
  admin: '👤',
  mobile: '📱',
  docs: '📚',
  monorepo: '📦',
  test: '🧪',
  worker: '⚡',
  custom: '⚙️'
};

/**
 * Default ports by framework
 */
export const DEFAULT_PORTS = {
  react: 3000,
  vite: 5173,
  nextjs: 3000,
  vue: 8080,
  angular: 4200,
  svelte: 5173,
  django: 8000,
  flask: 5000,
  fastapi: 8000,
  rails: 3000,
  express: 3000,
  nest: 3000,
  laravel: 8000,
  streamlit: 8501
};
```

---

## STEP 3: Build Detection Strategies (45 minutes)

Each strategy is a separate function that returns an array of runtimes.

```javascript
// server/project/detection/strategies.js

import fs from 'fs/promises';
import path from 'path';
import { PATTERNS, ICONS, DEFAULT_PORTS } from './patterns.js';

/**
 * Base class for detection strategies
 */
export class DetectionStrategy {
  constructor(projectRoot) {
    this.projectRoot = projectRoot;
  }
  
  /**
   * Check if file exists
   */
  async fileExists(relativePath) {
    try {
      await fs.access(path.join(this.projectRoot, relativePath));
      return true;
    } catch {
      return false;
    }
  }
  
  /**
   * Read and parse JSON file
   */
  async readJSON(relativePath) {
    try {
      const content = await fs.readFile(
        path.join(this.projectRoot, relativePath),
        'utf-8'
      );
      return JSON.parse(content);
    } catch {
      return null;
    }
  }
  
  /**
   * Get list of directories
   */
  async getDirectories() {
    try {
      const entries = await fs.readdir(this.projectRoot, { withFileTypes: true });
      return entries
        .filter(entry => entry.isDirectory())
        .filter(entry => !entry.name.startsWith('.'))
        .filter(entry => entry.name !== 'node_modules')
        .map(entry => entry.name);
    } catch {
      return [];
    }
  }
}

/**
 * STRATEGY 1: Detect Monorepo Structure
 */
export class MonorepoStrategy extends DetectionStrategy {
  async detect() {
    const runtimes = [];
    
    // Check for Turborepo
    if (await this.fileExists('turbo.json')) {
      const turboRuntimes = await this.detectTurborepo();
      runtimes.push(...turboRuntimes);
    }
    
    // Check for Nx
    if (await this.fileExists('nx.json')) {
      const nxRuntimes = await this.detectNx();
      runtimes.push(...nxRuntimes);
    }
    
    // Check for npm/yarn/pnpm workspaces
    const workspaceRuntimes = await this.detectWorkspaces();
    runtimes.push(...workspaceRuntimes);
    
    // Check for Lerna
    if (await this.fileExists('lerna.json')) {
      const lernaRuntimes = await this.detectLerna();
      runtimes.push(...lernaRuntimes);
    }
    
    return runtimes;
  }
  
  /**
   * Detect Turborepo configuration
   */
  async detectTurborepo() {
    const config = await this.readJSON('turbo.json');
    if (!config?.pipeline) return [];
    
    const runtimes = [];
    
    // Look for dev/start tasks in pipeline
    for (const [taskName, taskConfig] of Object.entries(config.pipeline)) {
      if (taskName.includes('dev') || taskName.includes('start')) {
        runtimes.push({
          id: `turbo-${taskName}`,
          name: `Turbo: ${taskName}`,
          command: `turbo run ${taskName}`,
          workingDir: this.projectRoot,
          type: 'monorepo',
          framework: 'turborepo',
          icon: '⚡',
          category: 'monorepo',
          description: `Runs ${taskName} across all packages`
        });
      }
    }
    
    return runtimes;
  }
  
  /**
   * Detect Nx workspace
   */
  async detectNx() {
    const nxConfig = await this.readJSON('nx.json');
    if (!nxConfig) return [];
    
    // Try to read workspace.json or project.json files
    const workspaceJson = await this.readJSON('workspace.json');
    
    if (!workspaceJson?.projects) return [];
    
    const runtimes = [];
    
    for (const [projectName, projectConfig] of Object.entries(workspaceJson.projects)) {
      const projectRoot = projectConfig.root || projectName;
      
      // Read project.json for this specific project
      const projectJsonPath = path.join(projectRoot, 'project.json');
      const projectJson = await this.readJSON(projectJsonPath);
      
      if (projectJson?.targets) {
        // Look for serve/dev targets
        const serveTarget = projectJson.targets.serve || projectJson.targets.dev;
        
        if (serveTarget) {
          runtimes.push({
            id: `nx-${projectName}`,
            name: projectName,
            command: `nx serve ${projectName}`,
            workingDir: this.projectRoot,
            type: 'monorepo',
            framework: 'nx',
            icon: '🔷',
            category: this.guessCategory(projectName),
            description: `Nx project: ${projectName}`
          });
        }
      }
    }
    
    return runtimes;
  }
  
  /**
   * Detect npm/yarn/pnpm workspaces
   */
  async detectWorkspaces() {
    const packageJson = await this.readJSON('package.json');
    if (!packageJson) return [];
    
    // Check for workspaces (npm/yarn)
    let workspacePatterns = packageJson.workspaces;
    
    // Handle { "packages": [...] } format
    if (workspacePatterns && !Array.isArray(workspacePatterns)) {
      workspacePatterns = workspacePatterns.packages;
    }
    
    // Check for pnpm workspaces
    if (!workspacePatterns && await this.fileExists('pnpm-workspace.yaml')) {
      // Simple detection - just check common patterns
      workspacePatterns = ['packages/*', 'apps/*'];
    }
    
    if (!workspacePatterns) return [];
    
    const runtimes = [];
    
    // Expand glob patterns
    for (const pattern of workspacePatterns) {
      const dirs = await this.expandGlobPattern(pattern);
      
      for (const dir of dirs) {
        const runtime = await this.detectWorkspacePackage(dir);
        if (runtime) {
          runtimes.push(runtime);
        }
      }
    }
    
    return runtimes;
  }
  
  /**
   * Detect individual workspace package
   */
  async detectWorkspacePackage(dirName) {
    const pkgPath = path.join(this.projectRoot, dirName, 'package.json');
    
    try {
      const content = await fs.readFile(pkgPath, 'utf-8');
      const pkg = JSON.parse(content);
      
      // Look for dev/start scripts
      const scripts = pkg.scripts || {};
      const devScript = scripts.dev || scripts.start || scripts.serve;
      
      if (!devScript) return null;
      
      // Determine script name
      const scriptName = scripts.dev ? 'dev' : scripts.start ? 'start' : 'serve';
      
      return {
        id: `workspace-${dirName}`,
        name: pkg.name || dirName,
        command: `npm run ${scriptName}`,
        workingDir: path.join(this.projectRoot, dirName),
        type: 'workspace',
        framework: this.detectFramework(pkg),
        icon: this.guessIcon(dirName, pkg),
        category: this.guessCategory(dirName),
        port: this.guessPort(pkg),
        description: pkg.description || `Workspace package: ${dirName}`
      };
    } catch {
      return null;
    }
  }
  
  /**
   * Detect Lerna packages
   */
  async detectLerna() {
    const lernaJson = await this.readJSON('lerna.json');
    if (!lernaJson) return [];
    
    const packages = lernaJson.packages || ['packages/*'];
    const runtimes = [];
    
    for (const pattern of packages) {
      const dirs = await this.expandGlobPattern(pattern);
      
      for (const dir of dirs) {
        const runtime = await this.detectWorkspacePackage(dir);
        if (runtime) {
          runtimes.push({
            ...runtime,
            framework: 'lerna'
          });
        }
      }
    }
    
    return runtimes;
  }
  
  /**
   * Simple glob pattern expansion
   */
  async expandGlobPattern(pattern) {
    // Remove wildcards and get base directory
    const baseDir = pattern.replace(/\/?\*+$/, '');
    
    try {
      const fullPath = path.join(this.projectRoot, baseDir);
      const entries = await fs.readdir(fullPath, { withFileTypes: true });
      
      return entries
        .filter(e => e.isDirectory())
        .map(e => path.join(baseDir, e.name));
    } catch {
      return [];
    }
  }
  
  /**
   * Detect framework from package.json
   */
  detectFramework(pkg) {
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    
    if (deps.next) return 'nextjs';
    if (deps.vite) return 'vite';
    if (deps.react && deps['react-scripts']) return 'cra';
    if (deps.vue) return 'vue';
    if (deps['@angular/core']) return 'angular';
    if (deps.svelte) return 'svelte';
    if (deps.express) return 'express';
    if (deps['@nestjs/core']) return 'nestjs';
    
    return 'node';
  }
  
  /**
   * Guess icon based on directory name and package
   */
  guessIcon(dirName, pkg) {
    const name = dirName.toLowerCase();
    
    if (name.includes('front') || name.includes('client') || name.includes('web')) {
      return ICONS.frontend;
    }
    if (name.includes('back') || name.includes('api') || name.includes('server')) {
      return ICONS.backend;
    }
    if (name.includes('admin') || name.includes('dashboard')) {
      return ICONS.admin;
    }
    if (name.includes('mobile')) {
      return ICONS.mobile;
    }
    if (name.includes('doc')) {
      return ICONS.docs;
    }
    
    return ICONS.monorepo;
  }
  
  /**
   * Guess category
   */
  guessCategory(name) {
    name = name.toLowerCase();
    
    if (PATTERNS.directories.frontend.test(name)) return 'frontend';
    if (PATTERNS.directories.backend.test(name)) return 'backend';
    if (PATTERNS.directories.admin.test(name)) return 'admin';
    if (PATTERNS.directories.mobile.test(name)) return 'mobile';
    if (PATTERNS.directories.docs.test(name)) return 'docs';
    
    return 'package';
  }
  
  /**
   * Guess port from framework
   */
  guessPort(pkg) {
    const framework = this.detectFramework(pkg);
    return DEFAULT_PORTS[framework];
  }
}

/**
 * STRATEGY 2: Detect Subdirectories (Frontend/Backend separation)
 */
export class SubdirectoryStrategy extends DetectionStrategy {
  async detect() {
    const runtimes = [];
    const directories = await this.getDirectories();
    
    for (const dir of directories) {
      // Check if directory matches common patterns
      const category = this.categorizeDirectory(dir);
      
      if (category) {
        const runtime = await this.detectDirectoryRuntime(dir, category);
        if (runtime) {
          runtimes.push(runtime);
        }
      }
    }
    
    return runtimes;
  }
  
  /**
   * Categorize directory by name
   */
  categorizeDirectory(dirName) {
    for (const [category, pattern] of Object.entries(PATTERNS.directories)) {
      if (pattern.test(dirName)) {
        return category;
      }
    }
    return null;
  }
  
  /**
   * Detect runtime in a specific directory
   */
  async detectDirectoryRuntime(dirName, category) {
    const dirPath = path.join(this.projectRoot, dirName);
    
    // Check for package.json (Node.js project)
    const pkgPath = path.join(dirPath, 'package.json');
    if (await this.fileExists(path.join(dirName, 'package.json'))) {
      return await this.detectNodeProject(dirName, category);
    }
    
    // Check for Python project
    for (const file of PATTERNS.files.python) {
      if (await this.fileExists(path.join(dirName, file))) {
        return await this.detectPythonProject(dirName, category);
      }
    }
    
    // Check for other languages...
    // (Ruby, Go, Rust, etc.)
    
    return null;
  }
  
  /**
   * Detect Node.js project in directory
   */
  async detectNodeProject(dirName, category) {
    const pkg = await this.readJSON(path.join(dirName, 'package.json'));
    if (!pkg) return null;
    
    const scripts = pkg.scripts || {};
    const devScript = scripts.dev || scripts.start || scripts.serve;
    
    if (!devScript) return null;
    
    const scriptName = scripts.dev ? 'dev' : scripts.start ? 'start' : 'serve';
    const framework = this.detectFramework(pkg);
    
    return {
      id: `subdir-${dirName}`,
      name: dirName.charAt(0).toUpperCase() + dirName.slice(1),
      command: `npm run ${scriptName}`,
      workingDir: path.join(this.projectRoot, dirName),
      type: 'subdirectory',
      framework,
      icon: ICONS[category] || ICONS.custom,
      category,
      port: DEFAULT_PORTS[framework],
      description: `${category} - ${framework}`
    };
  }
  
  /**
   * Detect Python project in directory
   */
  async detectPythonProject(dirName, category) {
    const dirPath = path.join(this.projectRoot, dirName);
    
    // Check for Django
    if (await this.fileExists(path.join(dirName, 'manage.py'))) {
      return {
        id: `subdir-${dirName}`,
        name: dirName.charAt(0).toUpperCase() + dirName.slice(1),
        command: 'python manage.py runserver',
        workingDir: dirPath,
        type: 'subdirectory',
        framework: 'django',
        icon: ICONS[category] || '🐍',
        category,
        port: 8000,
        description: `${category} - Django`
      };
    }
    
    // Check for Flask (look for app.py)
    if (await this.fileExists(path.join(dirName, 'app.py'))) {
      return {
        id: `subdir-${dirName}`,
        name: dirName.charAt(0).toUpperCase() + dirName.slice(1),
        command: 'flask run',
        workingDir: dirPath,
        type: 'subdirectory',
        framework: 'flask',
        icon: ICONS[category] || '🐍',
        category,
        port: 5000,
        description: `${category} - Flask`
      };
    }
    
    return null;
  }
  
  /**
   * Detect framework from package.json
   */
  detectFramework(pkg) {
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    
    if (deps.next) return 'nextjs';
    if (deps.vite) return 'vite';
    if (deps.react && deps['react-scripts']) return 'cra';
    if (deps.vue) return 'vue';
    if (deps['@angular/core']) return 'angular';
    if (deps.svelte) return 'svelte';
    if (deps.express) return 'express';
    if (deps['@nestjs/core']) return 'nestjs';
    
    return 'node';
  }
}

/**
 * STRATEGY 3: Detect Docker Compose
 */
export class DockerStrategy extends DetectionStrategy {
  async detect() {
    const runtimes = [];
    
    // Check for docker-compose files
    const composeFiles = [
      'docker-compose.yml',
      'docker-compose.yaml',
      'compose.yml',
      'compose.yaml'
    ];
    
    for (const file of composeFiles) {
      if (await this.fileExists(file)) {
        runtimes.push({
          id: 'docker-compose',
          name: 'Docker Services',
          command: 'docker-compose up',
          workingDir: this.projectRoot,
          type: 'docker',
          framework: 'docker-compose',
          icon: ICONS.docker,
          category: 'infrastructure',
          description: 'All Docker services',
          stopCommand: 'docker-compose down'
        });
        
        // Only add once
        break;
      }
    }
    
    return runtimes;
  }
}

/**
 * STRATEGY 4: Detect Root-level Project
 */
export class RootProjectStrategy extends DetectionStrategy {
  async detect() {
    // Check if root has package.json
    if (await this.fileExists('package.json')) {
      const pkg = await this.readJSON('package.json');
      const scripts = pkg?.scripts || {};
      
      // Skip if it looks like a monorepo root (has workspaces but no dev script)
      const isMonorepoRoot = (pkg.workspaces && !scripts.dev && !scripts.start);
      
      if (isMonorepoRoot) {
        return [];
      }
      
      const devScript = scripts.dev || scripts.start;
      if (!devScript) return [];
      
      const scriptName = scripts.dev ? 'dev' : 'start';
      const framework = this.detectFramework(pkg);
      
      return [{
        id: 'root',
        name: pkg.name || 'Main Project',
        command: `npm run ${scriptName}`,
        workingDir: this.projectRoot,
        type: 'root',
        framework,
        icon: '📦',
        category: 'main',
        port: DEFAULT_PORTS[framework],
        description: `Root project - ${framework}`
      }];
    }
    
    return [];
  }
  
  detectFramework(pkg) {
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    
    if (deps.next) return 'nextjs';
    if (deps.vite) return 'vite';
    if (deps.react) return 'react';
    if (deps.vue) return 'vue';
    if (deps.express) return 'express';
    
    return 'node';
  }
}
```

---

## STEP 4: Build Main Detector (30 minutes)

Now we orchestrate all strategies.

```javascript
// server/project/detection/MultiRuntimeDetector.js

import {
  MonorepoStrategy,
  SubdirectoryStrategy,
  DockerStrategy,
  RootProjectStrategy
} from './strategies.js';

export class MultiRuntimeDetector {
  constructor(projectRoot) {
    this.projectRoot = projectRoot;
    
    // Initialize all strategies
    this.strategies = [
      new MonorepoStrategy(projectRoot),
      new SubdirectoryStrategy(projectRoot),
      new DockerStrategy(projectRoot),
      new RootProjectStrategy(projectRoot)
    ];
  }
  
  /**
   * Main detection method
   * Returns array of runtime configurations
   */
  async detectAll() {
    console.log('[Detector] Scanning project:', this.projectRoot);
    
    const allRuntimes = [];
    
    // Run all strategies in parallel
    const results = await Promise.all(
      this.strategies.map(strategy => strategy.detect())
    );
    
    // Flatten results
    for (const runtimes of results) {
      allRuntimes.push(...runtimes);
    }
    
    console.log(`[Detector] Found ${allRuntimes.length} runtimes`);
    
    // Remove duplicates and prioritize
    const deduplicated = this.deduplicateRuntimes(allRuntimes);
    const prioritized = this.prioritizeRuntimes(deduplicated);
    
    return prioritized;
  }
  
  /**
   * Remove duplicate runtimes based on working directory
   */
  deduplicateRuntimes(runtimes) {
    const seen = new Map();
    
    for (const runtime of runtimes) {
      const key = runtime.workingDir;
      
      // Keep the first occurrence (strategy order matters)
      if (!seen.has(key)) {
        seen.set(key, runtime);
      }
    }
    
    return Array.from(seen.values());
  }
  
  /**
   * Sort runtimes by priority
   */
  prioritizeRuntimes(runtimes) {
    const priorityOrder = {
      frontend: 1,
      backend: 2,
      api: 3,
      admin: 4,
      mobile: 5,
      main: 6,
      infrastructure: 7,
      docs: 8,
      package: 9,
      monorepo: 10,
      custom: 99
    };
    
    return runtimes.sort((a, b) => {
      const aPriority = priorityOrder[a.category] || 99;
      const bPriority = priorityOrder[b.category] || 99;
      return aPriority - bPriority;
    });
  }
}
```

---

## STEP 5: Integration with Backend (20 minutes)

Update your server to use the detector.

```javascript
// server/index.js

import { MultiRuntimeDetector } from './project/detection/MultiRuntimeDetector.js';

// API endpoint to detect runtimes
app.get('/api/runtimes/detect', async (req, res) => {
  try {
    console.log('[API] Detecting runtimes...');
    
    const detector = new MultiRuntimeDetector(process.cwd());
    const runtimes = await detector.detectAll();
    
    console.log('[API] Detected runtimes:', runtimes.map(r => r.name));
    
    res.json(runtimes);
  } catch (error) {
    console.error('[API] Error detecting runtimes:', error);
    res.status(500).json({ 
      error: error.message,
      stack: error.stack 
    });
  }
});
```

---

## STEP 6: Testing (30 minutes)

Create test cases to verify detection works.

```javascript
// server/project/__tests__/detector.test.js

import { MultiRuntimeDetector } from '../detection/MultiRuntimeDetector.js';
import { describe, it, expect } from 'vitest';
import path from 'path';

describe('MultiRuntimeDetector', () => {
  it('should detect monorepo structure', async () => {
    // Use a real monorepo project for testing
    const detector = new MultiRuntimeDetector('/path/to/monorepo');
    const runtimes = await detector.detectAll();
    
    expect(runtimes.length).toBeGreaterThan(0);
    expect(runtimes.some(r => r.type === 'monorepo')).toBe(true);
  });
  
  it('should detect frontend/backend separation', async () => {
    const detector = new MultiRuntimeDetector('/path/to/fullstack-app');
    const runtimes = await detector.detectAll();
    
    const categories = runtimes.map(r => r.category);
    expect(categories).toContain('frontend');
    expect(categories).toContain('backend');
  });
  
  it('should detect Docker Compose', async () => {
    const detector = new MultiRuntimeDetector('/path/to/docker-project');
    const runtimes = await detector.detectAll();
    
    expect(runtimes.some(r => r.framework === 'docker-compose')).toBe(true);
  });
});
```

### Manual Testing

Create test projects:

```bash
# Test 1: Simple full-stack app
mkdir test-fullstack
cd test-fullstack
mkdir frontend backend
cd frontend && npm init -y && npm install vite
cd ../backend && npm init -y && npm install express

# Test 2: Turborepo
npx create-turbo@latest test-turbo

# Test 3: Docker project
mkdir test-docker
cd test-docker
# Create docker-compose.yml
```

---

## STEP 7: Debugging & Refinement (30 minutes)

Add console logs to understand what's happening.

```javascript
// Add to strategies.js

async detect() {
  console.log(`[${this.constructor.name}] Starting detection...`);
  
  const runtimes = [];
  // ... detection logic
  
  console.log(`[${this.constructor.name}] Found ${runtimes.length} runtimes:`, 
    runtimes.map(r => r.name)
  );
  
  return runtimes;
}
```

### Common Issues & Solutions

**Issue 1: "Not detecting my monorepo"**
```javascript
// Debug: Check if files exist
console.log('turbo.json exists?', await this.fileExists('turbo.json'));
console.log('nx.json exists?', await this.fileExists('nx.json'));
```

**Issue 2: "Found duplicates"**
```javascript
// Debug: Log deduplication
console.log('Before dedup:', allRuntimes.length);
console.log('After dedup:', deduplicated.length);
console.log('Duplicates:', allRuntimes.length - deduplicated.length);
```

**Issue 3: "Wrong working directory"**
```javascript
// Verify paths are absolute
console.log('Working dir:', runtime.workingDir);
console.log('Is absolute?', path.isAbsolute(runtime.workingDir));
```

---

## STEP 8: Add Error Handling (15 minutes)

Make it robust.

```javascript
// Wrap each strategy in try-catch

async detectAll() {
  const allRuntimes = [];
  
  for (const strategy of this.strategies) {
    try {
      const runtimes = await strategy.detect();
      allRuntimes.push(...runtimes);
    } catch (error) {
      console.error(`[Detector] Error in ${strategy.constructor.name}:`, error);
      // Continue with other strategies
    }
  }
  
  return allRuntimes;
}
```

---

## Complete Testing Checklist

Test on these project types:

### ✅ Test Case 1: Simple React App
```
my-react-app/
└── package.json (with "react" and "vite")

Expected: 1 runtime (Root project - Vite)
```

### ✅ Test Case 2: Frontend + Backend
```
fullstack-app/
├── frontend/
│   └── package.json (React)
└── backend/
    └── package.json (Express)

Expected: 2 runtimes (Frontend, Backend)
```

### ✅ Test Case 3: Turborepo
```
my-turbo/
├── turbo.json
├── apps/
│   ├── web/
│   └── api/
└── packages/
    └── ui/

Expected: 1 monorepo runtime OR individual apps
```

### ✅ Test Case 4: Docker Compose
```
docker-app/
├── docker-compose.yml
├── frontend/
└── backend/

Expected: Docker Compose + Frontend + Backend (3 total)
```

### ✅ Test Case 5: Nx Workspace
```
nx-workspace/
├── nx.json
├── workspace.json
└── apps/
    ├── app1/
    └── app2/

Expected: 2 runtimes (app1, app2)
```

---

## Final Implementation Timeline

```
Hour 1: Setup + Patterns (STEP 1-2)
Hour 2: Monorepo Strategy (STEP 3.1)
Hour 3: Subdirectory + Docker Strategy (STEP 3.2-3.3)
Hour 4: Main Detector + Integration (STEP 4-5)
Hour 5: Testing + Debugging (STEP 6-7)
Hour 6: Refinement + Error Handling (STEP 8)
```

---

## What You'll Have After This

A system that can scan **any project** and return:

```javascript
[
  {
    id: 'subdir-frontend',
    name: 'Frontend',
    command: 'npm run dev',
    workingDir: '/project/frontend',
    type: 'subdirectory',
    framework: 'vite',
    icon: '📱',
    category: 'frontend',
    port: 5173
  },
  {
    id: 'subdir-backend',
    name: 'Backend',
    command: 'npm start',
    workingDir: '/project/backend',
    type: 'subdirectory',
    framework: 'express',
    icon: '⚙️',
    category: 'backend',
    port: 3000
  },
  {
    id: 'docker-compose',
    name: 'Docker Services',
    command: 'docker-compose up',
    workingDir: '/project',
    type: 'docker',
    framework: 'docker-compose',
    icon: '🐳',
    category: 'infrastructure'
  }
]
```

This data structure is then used by the UI to create process cards! 🚀

---

## Next Steps

After completing this:
1. ✅ Test on 5+ different projects
2. ✅ Add support for more frameworks (if needed)
3. ✅ Build the UI (Process Cards)
4. ✅ Connect to ProcessRunner

Ready to start? Begin with STEP 1 and work your way through! Each step builds on the previous one.