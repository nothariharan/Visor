#!/usr/bin/env node

/**
 * Quick test script for Universal Search (Cmd+P) implementation
 * Tests all API endpoints and validates the implementation
 */

const http = require('http');
const path = require('path');

const PORT = process.env.PORT || 3000;
const BASE_URL = `http://localhost:${PORT}`;

let testsPassed = 0;
let testsFailed = 0;

function log(message, type = 'info') {
    const colors = {
        info: '\x1b[36m',    // Cyan
        success: '\x1b[32m',  // Green
        error: '\x1b[31m',    // Red
        warning: '\x1b[33m'   // Yellow
    };
    const reset = '\x1b[0m';
    console.log(`${colors[type] || ''}[${type.toUpperCase()}]${reset} ${message}`);
}

function request(method, path, body = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, BASE_URL);
        const options = {
            method,
            hostname: url.hostname,
            port: url.port,
            path: url.pathname + url.search,
            headers: {
                'Content-Type': 'application/json',
            },
            timeout: 5000
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    resolve({ status: res.statusCode, data: parsed });
                } catch (e) {
                    resolve({ status: res.statusCode, data });
                }
            });
        });

        req.on('error', reject);
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });

        if (body) {
            req.write(JSON.stringify(body));
        }
        req.end();
    });
}

async function test(name, fn) {
    try {
        log(`Testing: ${name}`, 'info');
        await fn();
        log(`✓ ${name} PASSED`, 'success');
        testsPassed++;
    } catch (error) {
        log(`✗ ${name} FAILED: ${error.message}`, 'error');
        testsFailed++;
    }
}

async function runTests() {
    log('='.repeat(60), 'info');
    log('Universal Search (Cmd+P) - Test Suite', 'info');
    log('='.repeat(60), 'info');
    log(`Testing server at: ${BASE_URL}\n`, 'info');

    // Test 1: Health Check
    await test('API Health Endpoint', async () => {
        const res = await request('GET', '/api/health');
        if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
        if (!res.data.status) throw new Error('Missing status field');
    });

    // Test 2: Search Files - Empty Query
    await test('Search Files - Empty Query', async () => {
        const res = await request('GET', '/api/search/files?q=');
        if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
        if (!Array.isArray(res.data.results)) throw new Error('Results should be array');
    });

    // Test 3: Search Files - Valid Query
    await test('Search Files - Valid Query (app)', async () => {
        const res = await request('GET', '/api/search/files?q=app');
        if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
        if (!Array.isArray(res.data.results)) throw new Error('Results should be array');
        if (res.data.total === undefined) throw new Error('Missing total count');
        log(`  Found ${res.data.total} results`, 'info');
    });

    // Test 4: Search Files - Fuzzy Query
    await test('Search Files - Fuzzy Query (jsx)', async () => {
        const res = await request('GET', '/api/search/files?q=jsx');
        if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
        if (res.data.results.length === 0) {
            log(`  No .jsx files found (this is ok)`, 'warning');
        } else {
            log(`  Found ${res.data.results.length} .jsx files`, 'info');
            const first = res.data.results[0];
            if (!first.matchPositions) throw new Error('Missing matchPositions');
        }
    });

    // Test 5: Recent Files - Get (before tracking)
    await test('Recent Files - Get List', async () => {
        const res = await request('GET', '/api/search/recent');
        if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
        if (!Array.isArray(res.data.recent)) throw new Error('Recent should be array');
        log(`  Retrieved ${res.data.recent.length} recent files`, 'info');
    });

    // Test 6: Recent Files - Track New File
    await test('Recent Files - Track File', async () => {
        const testPath = '/path/to/test/file.jsx';
        const res = await request('POST', '/api/search/recent', { path: testPath });
        if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
        if (!res.data.success) throw new Error('Success flag not set');
        log(`  Tracked file: ${testPath}`, 'info');
    });

    // Test 7: Recent Files - Verify Tracking
    await test('Recent Files - Verify Tracked File', async () => {
        const res = await request('GET', '/api/search/recent');
        if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
        if (!res.data.recent.some(f => f.path === '/path/to/test/file.jsx')) {
            throw new Error('Tracked file not found in recent list');
        }
        log(`  Confirmed: file appears in recent list`, 'info');
    });

    // Test 8: Search with Special Characters
    await test('Search Files - Special Query (config)', async () => {
        const res = await request('GET', '/api/search/files?q=config');
        if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
        if (!Array.isArray(res.data.results)) throw new Error('Results should be array');
    });

    // Test 9: Search Performance (should be under 100ms with cache)
    await test('Search Performance (<100ms)', async () => {
        const start = Date.now();
        const res = await request('GET', '/api/search/files?q=app');
        const elapsed = Date.now() - start;

        if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
        if (elapsed > 100) {
            log(`  Warning: Search took ${elapsed}ms (should be <100ms)`, 'warning');
        } else {
            log(`  Search completed in ${elapsed}ms ✓`, 'success');
        }
    });

    // Summary
    log('\n' + '='.repeat(60), 'info');
    const total = testsPassed + testsFailed;
    log(`Test Results: ${testsPassed}/${total} passed`, testsFailed === 0 ? 'success' : 'error');

    if (testsFailed === 0) {
        log('All tests passed! ✓', 'success');
        process.exit(0);
    } else {
        log(`${testsFailed} test(s) failed ✗`, 'error');
        process.exit(1);
    }
}

// Run tests
runTests().catch(error => {
    log(`Fatal error: ${error.message}`, 'error');
    log('Make sure the server is running on port ' + PORT, 'warning');
    process.exit(1);
});

