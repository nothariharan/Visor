const fs = require('fs-extra');
const path = require('path');
const { PATTERNS, ICONS, DEFAULT_PORTS } = require('./patterns.js');

/**
 * Base class for detection strategies
 */
class DetectionStrategy {
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
class MonorepoStrategy extends DetectionStrategy {
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
                id: `workspace-${dirName.replace(/\//g, '-')}`, // Sanitize ID
                name: pkg.name || path.basename(dirName),
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

            // If baseDir doesn't exist, return empty
            if (!await fs.pathExists(fullPath)) return [];

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
class SubdirectoryStrategy extends DetectionStrategy {
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
class DockerStrategy extends DetectionStrategy {
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
class RootProjectStrategy extends DetectionStrategy {
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

module.exports = {
    MonorepoStrategy,
    SubdirectoryStrategy,
    DockerStrategy,
    RootProjectStrategy
};
