const fs = require('fs-extra');
const path = require('path');

class ProjectDetector {
    constructor(projectRoot) {
        this.projectRoot = projectRoot;
    }

    /**
     * Detect project type and return run commands
     */
    async detect() {
        // Detectors order matters (most specific -> least specific)
        const detectors = [
            this.detectPackageJson,
            this.detectPython,
            this.detectRuby,
            this.detectGo,
            this.detectRust,
            this.detectPHP,
            // Docker last as generic container
            this.detectDocker
        ];

        for (const detector of detectors) {
            const result = await detector.call(this);
            if (result) return result;
        }

        return {
            type: 'unknown',
            framework: 'unknown',
            commands: [],
            message: 'Could not auto-detect project type'
        };
    }

    /**
     * Detect Node.js projects (React, Next.js, Vue, etc.)
     */
    async detectPackageJson() {
        const packageJsonPath = path.join(this.projectRoot, 'package.json');

        try {
            const content = await fs.readFile(packageJsonPath, 'utf-8');
            const pkg = JSON.parse(content);

            // Extract scripts
            const scripts = pkg.scripts || {};

            // Detect framework based on dependencies
            const deps = { ...pkg.dependencies, ...pkg.devDependencies };

            let framework = 'node';
            let primaryCommand = null;

            // Next.js
            if (deps.next) {
                framework = 'nextjs';
                primaryCommand = scripts.dev || 'next dev';
            }
            // React (CRA or Vite)
            else if (deps.react) {
                if (deps.vite) {
                    framework = 'vite-react';
                    primaryCommand = scripts.dev || 'vite';
                } else if (deps['react-scripts']) {
                    framework = 'create-react-app';
                    primaryCommand = scripts.start || 'react-scripts start';
                } else {
                    framework = 'react';
                    primaryCommand = scripts.start || scripts.dev;
                }
            }
            // Vue
            else if (deps.vue) {
                framework = 'vue';
                primaryCommand = scripts.dev || scripts.serve || 'vue-cli-service serve';
            }
            // Svelte
            else if (deps.svelte) {
                framework = 'svelte';
                primaryCommand = scripts.dev || 'vite dev';
            }
            // Angular
            else if (deps['@angular/core']) {
                framework = 'angular';
                primaryCommand = scripts.start || 'ng serve';
            }
            // Express/Node server
            else if (deps.express || deps.fastify || deps.koa || deps.hono) {
                framework = 'node-server';
                primaryCommand = scripts.dev || scripts.start || 'node index.js';
            }
            // Generic Node
            else {
                primaryCommand = scripts.start || scripts.dev;
            }

            // Build available commands list
            const commands = [];

            if (primaryCommand) {
                // If standard npm script, format nicely
                const cmdRunning = primaryCommand.startsWith('npm') || primaryCommand.startsWith('yarn') || primaryCommand.startsWith('pnpm')
                    ? primaryCommand
                    : (scripts[this.findScriptName(scripts, primaryCommand)] ? `npm run ${this.findScriptName(scripts, primaryCommand)}` : primaryCommand);

                commands.push({
                    name: 'Run App',
                    command: cmdRunning,
                    icon: 'play',
                    primary: true
                });
            }

            if (scripts.build) {
                commands.push({
                    name: 'Build',
                    command: 'npm run build',
                    icon: 'hammer',
                    primary: false
                });
            }

            if (scripts.test) {
                commands.push({
                    name: 'Run Tests',
                    command: 'npm test',
                    icon: 'flask-conical', // mapping to lucide icon name later
                    primary: false
                });
            }

            if (scripts.lint) {
                commands.push({
                    name: 'Lint',
                    command: 'npm run lint',
                    icon: 'search',
                    primary: false
                });
            }

            return {
                type: 'nodejs',
                framework,
                packageManager: await this.detectPackageManager(),
                commands,
                defaultPort: this.guessPort(framework)
            };

        } catch (error) {
            return null;
        }
    }

    /**
     * Detect Python projects
     */
    async detectPython() {
        const pythonFiles = [
            'requirements.txt',
            'Pipfile',
            'pyproject.toml',
            'manage.py',  // Django
            'app.py',     // Flask
            'main.py',     // Generic
            'streamlit_app.py' // Streamlit
        ];

        let foundFile = null;
        for (const file of pythonFiles) {
            if (await this.fileExists(file)) {
                foundFile = file;
                // Don't break immediately, prioritize framework files over generic files manually if needed
                if (file === 'manage.py' || file === 'app.py') break;
            }
        }

        if (!foundFile) return null;

        let framework = 'python';
        let primaryCommand = null;

        // Django
        if (await this.fileExists('manage.py')) {
            framework = 'django';
            primaryCommand = 'python manage.py runserver';
        }
        // Flask
        else if (await this.fileExists('app.py')) {
            const content = await fs.readFile(path.join(this.projectRoot, 'app.py'), 'utf-8');
            if (content.includes('flask') || content.includes('Flask')) {
                framework = 'flask';
                primaryCommand = 'flask run';
                // Fallback: python app.py
            } else if (content.includes('streamlit')) {
                framework = 'streamlit';
                primaryCommand = 'streamlit run app.py';
            } else if (content.includes('fastapi')) {
                framework = 'fastapi';
                primaryCommand = 'uvicorn app:app --reload';
            } else {
                primaryCommand = 'python app.py';
            }
        }
        // Streamlit specific check if generic main.py
        else if (await this.fileExists('main.py')) {
            const content = await fs.readFile(path.join(this.projectRoot, 'main.py'), 'utf-8');
            if (content.includes('streamlit')) {
                framework = 'streamlit';
                primaryCommand = 'streamlit run main.py';
            } else if (content.includes('fastapi')) {
                framework = 'fastapi';
                primaryCommand = 'uvicorn main:app --reload';
            } else {
                primaryCommand = 'python main.py';
            }
        }

        const commands = [];
        if (primaryCommand) {
            commands.push({
                name: 'Run App',
                command: primaryCommand,
                icon: 'play',
                primary: true
            });
        }

        if (await this.fileExists('pytest.ini') || await this.fileExists('tests') || await this.fileExists('test')) {
            commands.push({
                name: 'Run Tests',
                command: 'pytest',
                icon: 'flask-conical',
                primary: false
            });
        }

        return {
            type: 'python',
            framework,
            commands,
            defaultPort: this.guessPort(framework)
        };
    }

    /**
     * Detect Ruby projects
     */
    async detectRuby() {
        if (!await this.fileExists('Gemfile')) return null;

        let framework = 'ruby';
        let primaryCommand = null;

        if (await this.fileExists('bin/rails')) {
            framework = 'rails';
            primaryCommand = 'rails server';
        } else if (await this.fileExists('config.ru')) {
            framework = 'rack';
            primaryCommand = 'rackup';
        } else if (await this.fileExists('app.rb')) {
            framework = 'sinatra';
            primaryCommand = 'ruby app.rb';
        }

        return {
            type: 'ruby',
            framework,
            commands: primaryCommand ? [{ name: 'Run Server', command: primaryCommand, icon: 'play', primary: true }] : [],
            defaultPort: 3000
        };
    }

    /**
     * Detect Go projects
     */
    async detectGo() {
        if (!await this.fileExists('go.mod')) return null;

        return {
            type: 'go',
            framework: 'go',
            commands: [
                { name: 'Run', command: 'go run .', icon: 'play', primary: true },
                { name: 'Build', command: 'go build', icon: 'hammer', primary: false },
                { name: 'Test', command: 'go test ./...', icon: 'flask-conical', primary: false }
            ],
            defaultPort: 8080
        };
    }

    /**
     * Detect Rust projects
     */
    async detectRust() {
        if (!await this.fileExists('Cargo.toml')) return null;

        return {
            type: 'rust',
            framework: 'rust',
            commands: [
                { name: 'Run', command: 'cargo run', icon: 'play', primary: true },
                { name: 'Build', command: 'cargo build', icon: 'hammer', primary: false },
                { name: 'Test', command: 'cargo test', icon: 'flask-conical', primary: false }
            ],
            defaultPort: 8080
        };
    }

    /**
    * Detect PHP projects
    */
    async detectPHP() {
        if (await this.fileExists('composer.json') || await this.fileExists('index.php') || await this.fileExists('artisan')) {
            let framework = 'php';
            let primaryCommand = 'php -S localhost:8000'; // Default built-in server

            if (await this.fileExists('artisan')) {
                framework = 'laravel';
                primaryCommand = 'php artisan serve';
            } else if (await this.fileExists('wp-config.php')) {
                framework = 'wordpress';
                // wordpress usually needs full lamp stack but specific run command varies
            }

            return {
                type: 'php',
                framework,
                commands: [{ name: 'Run Server', command: primaryCommand, icon: 'play', primary: true }],
                defaultPort: 8000
            };
        }
        return null;
    }


    /**
     * Detect Docker projects
     */
    async detectDocker() {
        // Only return docker if we haven't found a more specific project type?
        // Actually docker-compose is useful regardless.
        // We'll return it if docker-compose.yml exists.

        if (await this.fileExists('docker-compose.yml') || await this.fileExists('docker-compose.yaml')) {
            return {
                type: 'docker',
                framework: 'docker-compose',
                commands: [
                    { name: 'Start Services', command: 'docker-compose up', icon: 'container', primary: true },
                    { name: 'Stop Services', command: 'docker-compose down', icon: 'stop-circle', primary: false }
                ]
            };
        }

        if (await this.fileExists('Dockerfile')) {
            return {
                type: 'docker',
                framework: 'docker',
                commands: [
                    { name: 'Build Image', command: 'docker build -t app .', icon: 'hammer', primary: true },
                    { name: 'Run Container', command: 'docker run -p 8080:8080 app', icon: 'play', primary: false }
                ]
            };
        }

        return null;
    }

    // Helpers

    async fileExists(relativePath) {
        try {
            await fs.access(path.join(this.projectRoot, relativePath));
            return true;
        } catch {
            return false;
        }
    }

    async detectPackageManager() {
        if (await this.fileExists('pnpm-lock.yaml')) return 'pnpm';
        if (await this.fileExists('yarn.lock')) return 'yarn';
        if (await this.fileExists('bun.lockb')) return 'bun';
        return 'npm';
    }

    findScriptName(scripts, command) {
        for (const [name, cmd] of Object.entries(scripts)) {
            if (cmd === command) return name;
        }
        return 'dev'; // fallback
    }

    guessPort(framework) {
        const ports = {
            nextjs: 3000,
            'create-react-app': 3000,
            react: 3000,
            'vite-react': 5173,
            vite: 5173,
            vue: 8080,
            angular: 4200,
            svelte: 5173,
            'node-server': 3000,
            django: 8000,
            flask: 5000,
            fastapi: 8000,
            rails: 3000,
            laravel: 8000
        };
        return ports[framework] || 3000;
    }
}

module.exports = { ProjectDetector };
