/**
 * Common patterns for detecting project types
 */
const PATTERNS = {
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
const ICONS = {
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
const DEFAULT_PORTS = {
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

module.exports = { PATTERNS, ICONS, DEFAULT_PORTS };
