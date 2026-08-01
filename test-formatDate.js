#!/usr/bin/env node

/**
 * Test manual de formatDate - manejo de fechas de Firestore
 */

function formatDate(d) {
    if (!d) return '';
    try {
        const date = new Date(typeof d === 'string' ? d : d);
        if (isNaN(date)) return '';
        return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });
    } catch {
        return '';
    }
}

const testCases = [
    { input: null, desc: 'null' },
    { input: undefined, desc: 'undefined' },
    { input: '', desc: 'empty string' },
    { input: '2024-01-15', desc: 'ISO date string' },
    { input: 'invalid-date', desc: 'invalid date string' },
    { input: new Date('2024-01-15'), desc: 'Date object' },
    { input: 123, desc: 'number (timestamp ms?)' },
    { input: 1705276800000, desc: 'timestamp in milliseconds' },
    { input: { seconds: 1705276800, nanoseconds: 0 }, desc: 'Firestore Timestamp object' },
    { input: { toDate: function () { return new Date('2024-01-15'); } }, desc: 'Firestore Timestamp with toDate()' },
];

console.log('Testing formatDate function:\n');

const bugs = [];

testCases.forEach(test => {
    try {
        const result = formatDate(test.input);
        console.log(`${test.desc}: '${result}'`);

        // Verificar comportamiento con Timestamp de Firestore
        if (test.desc.includes('Firestore Timestamp') && result === '') {
            bugs.push({
                desc: test.desc,
                issue: 'formatDate no maneja Firestore Timestamps correctamente',
                input: test.input,
                output: result
            });
        }
    } catch (err) {
        console.log(`${test.desc}: ERROR - ${err.message}`);
        bugs.push({
            desc: test.desc,
            issue: `Lanza excepción: ${err.message}`,
            input: test.input
        });
    }
});

if (bugs.length > 0) {
    console.log('\n🐛 BUGS ENCONTRADOS:');
    bugs.forEach(b => {
        console.log(`  - ${b.desc}: ${b.issue}`);
    });
    process.exit(1);
} else {
    console.log('\n✅ No se encontraron bugs evidentes en formatDate');
    process.exit(0);
}
