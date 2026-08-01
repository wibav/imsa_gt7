#!/usr/bin/env node

/**
 * Test manual de isValidOGBanner - función crítica para metada OG
 */

function isValidOGBanner(banner) {
    if (!banner || typeof banner !== 'string') return false;
    const cleaned = banner.trim();
    if (cleaned.startsWith('data:') || cleaned === '') return false;
    return cleaned.startsWith('http://') || cleaned.startsWith('https://');
}

const testCases = [
    { input: null, expected: false, desc: 'null banner' },
    { input: undefined, expected: false, desc: 'undefined banner' },
    { input: '', expected: false, desc: 'empty string' },
    { input: '   ', expected: false, desc: 'whitespace only' },
    { input: 'data:image/png;base64,abc', expected: false, desc: 'data URI' },
    { input: 'http://example.com/img.png', expected: true, desc: 'http URL' },
    { input: 'https://example.com/img.png', expected: true, desc: 'https URL' },
    { input: '  https://example.com/img.png  ', expected: true, desc: 'URL with whitespace' },
    { input: 'ftp://example.com/img.png', expected: false, desc: 'ftp URL' },
    { input: '//example.com/img.png', expected: false, desc: 'protocol-relative URL' },
    { input: 123, expected: false, desc: 'number' },
    { input: {}, expected: false, desc: 'object' },
    { input: [], expected: false, desc: 'array' },
    { input: 'HTTP://EXAMPLE.COM/IMG.PNG', expected: false, desc: 'uppercase HTTP (bug potencial)' },
    { input: 'HTTPS://EXAMPLE.COM/IMG.PNG', expected: false, desc: 'uppercase HTTPS (bug potencial)' },
];

let passed = 0;
let failed = 0;
const failures = [];

testCases.forEach(test => {
    const result = isValidOGBanner(test.input);
    const status = result === test.expected ? '✅' : '❌';
    console.log(`${status} ${test.desc}: ${result} (expected ${test.expected})`);
    if (result === test.expected) {
        passed++;
    } else {
        failed++;
        failures.push(test);
    }
});

console.log(`\nResults: ${passed}/${testCases.length} passed, ${failed} failed`);

if (failures.length > 0) {
    console.log('\n🐛 BUGS ENCONTRADOS:');
    failures.forEach(f => {
        console.log(`  - ${f.desc}: devuelve ${isValidOGBanner(f.input)}, esperado ${f.expected}`);
    });
}

process.exit(failed > 0 ? 1 : 0);
