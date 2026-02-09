module.exports = {
    // Layout algorithm: 'layered' (default) or 'radial' (coming soon)
    layout: 'layered',

    // Max files to analyze to prevent performance issues
    maxFiles: 2000,

    // Patterns to ignore (in addition to standard .git, node_modules)
    ignore: [
        'coverage',
        'dist',
        'build',
        '**/*.test.js',
        '**/*.spec.js'
    ],

    // Git integration settings
    git: {
        enabled: true,
        churnThreshold: 20 // Commits to trigger high churn warning
    }
};
