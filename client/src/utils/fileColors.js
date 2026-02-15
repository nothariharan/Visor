export const getFileTypeStyles = (filename, isDirectory) => {
    if (isDirectory) return { color: '#89b4fa', label: 'DIR' }; // Blue

    // Handle extensionless files or specific names
    const lowerName = filename.toLowerCase();
    if (lowerName === 'dockerfile') return { color: '#fab387', label: 'CFG' }; // Peach
    if (lowerName === 'makefile') return { color: '#fab387', label: 'CFG' }; // Peach

    const extension = filename.split('.').pop().toLowerCase();

    switch (extension) {
        // UI & Components
        case 'jsx':
        case 'tsx':
        case 'vue':
        case 'svelte':
            return { color: '#89dceb', label: 'UI' }; // Sky Blue

        // Logic & Code
        case 'js':
        case 'ts':
        case 'mjs':
        case 'cjs':
            return { color: '#f9e2af', label: 'LOGIC' }; // Yellow

        // Styles
        case 'css':
        case 'scss':
        case 'less':
        case 'styl':
            return { color: '#f5c2e7', label: 'STYLE' }; // Pink

        // Documentation
        case 'md':
        case 'mdx':
        case 'txt':
            return { color: '#cba6f7', label: 'DOCS' }; // Mauve

        // Configs
        case 'json':
        case 'yaml':
        case 'yml':
        case 'toml':
        case 'xml':
        case 'ini':
        case 'env':
            return { color: '#fab387', label: 'CFG' }; // Peach

        // Executables
        case 'bat':
        case 'ps1':
        case 'sh':
            return { color: '#a6e3a1', label: 'EXEC' }; // Green

        // Images
        case 'png':
        case 'jpg':
        case 'jpeg':
        case 'gif':
        case 'svg':
        case 'ico':
        case 'webp':
            return { color: '#f38ba8', label: 'IMG' }; // Red/Pinkish

        // Fallback
        default:
            return { color: '#a6adc8', label: 'FILE' }; // Grey
    }
};
