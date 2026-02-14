const path = require('path');
const { MultiRuntimeDetector } = require('../detection/MultiRuntimeDetector');

// Mock strategies if needed, or just run against known dirs
async function runTests() {
    console.log('🧪 Testing MultiRuntimeDetector...');

    // Test 1: Scan current project (Visor)
    // Expect: "root" or "subdir" runtimes (client/server)
    const rootDir = path.resolve(__dirname, '../../../');
    console.log(`\nScanning: ${rootDir}`);

    const detector = new MultiRuntimeDetector(rootDir);
    const runtimes = await detector.detectAll();

    console.log('\nFound Runtimes:');
    runtimes.forEach(r => {
        console.log(`- [${r.category}] ${r.name} (${r.framework})`);
        console.log(`  Cmd: ${r.command}`);
        console.log(`  Dir: ${r.workingDir}`);
    });

    // Validation
    const hasServer = runtimes.some(r => r.name.toLowerCase().includes('server') || r.framework === 'node');
    const hasClient = runtimes.some(r => r.name.toLowerCase().includes('client') || r.framework === 'vite');

    if (hasServer && hasClient) {
        console.log('\n✅ SUCCESS: Detected both client and server runtimes!');
    } else {
        console.log('\n⚠️ WARNING: Might have missed some runtimes.');
    }
}

runTests().catch(console.error);
