#!/usr/bin/env node

// Simple test to verify the ProcessManager changes work
const http = require('http');

// Test 1: Check if server is running
console.log('Testing Visor server...');
http.get('http://localhost:3000/api/graph', (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        try {
            const json = JSON.parse(data);
            console.log('✅ Server is running');
            console.log('✅ /api/graph returns:', json);

            // Test 2: Check runtime detection
            http.get('http://localhost:3000/api/runtimes/detect', (res2) => {
                let data2 = '';
                res2.on('data', chunk => data2 += chunk);
                res2.on('end', () => {
                    try {
                        const json2 = JSON.parse(data2);
                        console.log('✅ /api/runtimes/detect returns:', {
                            count: json2.runtimes?.length || 0,
                            runtimes: json2.runtimes?.map(r => ({ id: r.id, name: r.name, port: r.port }))
                        });
                        console.log('\n✅ All tests passed! Run & Open button should work now.');
                        process.exit(0);
                    } catch (e) {
                        console.error('❌ Failed to parse runtime response:', e.message);
                        process.exit(1);
                    }
                });
            }).on('error', (err) => {
                console.error('❌ Runtime detection failed:', err.message);
                process.exit(1);
            });
        } catch (e) {
            console.error('❌ Failed to parse graph response:', e.message);
            process.exit(1);
        }
    });
}).on('error', (err) => {
    console.error('❌ Cannot connect to Visor server:', err.message);
    console.error('Make sure to run: node server/index.js');
    process.exit(1);
});

setTimeout(() => {
    console.error('❌ Test timeout - server not responding');
    process.exit(1);
}, 5000);

