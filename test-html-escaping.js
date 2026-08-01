#!/usr/bin/env node

/**
 * Test manual de función esc() - crítica para seguridad contra XSS
 */

function esc(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

const testCases = [
    { input: null, expected: '', desc: 'null' },
    { input: undefined, expected: '', desc: 'undefined' },
    { input: '', expected: '', desc: 'empty string' },
    { input: 'normal text', expected: 'normal text', desc: 'normal text' },
    { input: '<script>alert("xss")</script>', expected: '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;', desc: 'script tag' },
    { input: 'A & B', expected: 'A &amp; B', desc: 'ampersand' },
    { input: 'Title with "quotes"', expected: 'Title with &quot;quotes&quot;', desc: 'double quotes' },
    { input: "Title with 'quotes'", expected: "Title with &#39;quotes&#39;", desc: 'single quotes' },
    { input: '<img src=x onerror=alert(1)>', expected: '&lt;img src=x onerror=alert(1)&gt;', desc: 'img tag with onerror' },
    { input: '"><script>alert(1)</script>', expected: '&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;', desc: 'quote breakout attempt' },
    { input: 123, expected: '123', desc: 'number' },
    { input: true, expected: 'true', desc: 'boolean' },
];

let passed = 0;
let failed = 0;
const failures = [];

console.log('Testing esc() function for XSS prevention:\n');

testCases.forEach(test => {
    const result = esc(test.input);
    const status = result === test.expected ? '✅' : '❌';
    console.log(`${status} ${test.desc}`);
    console.log(`  Input:    ${JSON.stringify(test.input)}`);
    console.log(`  Expected: ${test.expected}`);
    console.log(`  Got:      ${result}`);
    console.log('');

    if (result === test.expected) {
        passed++;
    } else {
        failed++;
        failures.push(test);
    }
});

console.log(`Results: ${passed}/${testCases.length} passed, ${failed} failed\n`);

if (failures.length > 0) {
    console.log('🐛 BUGS ENCONTRADOS:');
    failures.forEach(f => {
        console.log(`  - ${f.desc}: devuelve "${esc(f.input)}", esperado "${f.expected}"`);
    });
    process.exit(1);
} else {
    console.log('✅ Función esc() maneja correctamente todos los casos de escape HTML');
    process.exit(0);
}
