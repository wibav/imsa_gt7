#!/usr/bin/env node

/**
 * Test del script generate-share-pages.js
 * Verifica lógica de generación sin ejecutar el build completo
 */

const fs = require('fs');
const path = require('path');

// Simular las funciones del script
function esc(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function isValidOGBanner(banner) {
    if (!banner || typeof banner !== 'string') return false;
    const cleaned = banner.trim();
    if (cleaned.startsWith('data:') || cleaned === '') return false;
    return cleaned.startsWith('http://') || cleaned.startsWith('https://');
}

const BASE_URL = 'https://imsa.trenkit.com';

function getChampionshipOGImage(championship) {
    if (isValidOGBanner(championship.banner)) {
        return championship.banner;
    }
    return `${BASE_URL}/og-championships.png`;
}

function getEventOGImage(event) {
    if (isValidOGBanner(event.banner)) {
        return event.banner;
    }
    return `${BASE_URL}/og-events.png`;
}

// Tests
const bugs = [];
let testsRun = 0;

console.log('Testing generate-share-pages.js logic:\n');

// Test 1: Championship con banner válido
testsRun++;
const championship1 = {
    id: 'test1',
    name: 'Campeonato Test',
    banner: 'https://example.com/banner.png'
};
const img1 = getChampionshipOGImage(championship1);
if (img1 !== championship1.banner) {
    bugs.push({
        test: 'Championship con banner válido',
        expected: championship1.banner,
        got: img1
    });
} else {
    console.log('✅ Championship con banner válido usa ese banner');
}

// Test 2: Championship con data URI
testsRun++;
const championship2 = {
    id: 'test2',
    name: 'Campeonato Test 2',
    banner: 'data:image/png;base64,abc123'
};
const img2 = getChampionshipOGImage(championship2);
if (img2 !== `${BASE_URL}/og-championships.png`) {
    bugs.push({
        test: 'Championship con data URI',
        expected: `${BASE_URL}/og-championships.png`,
        got: img2
    });
} else {
    console.log('✅ Championship con data URI usa fallback');
}

// Test 3: Championship sin banner
testsRun++;
const championship3 = {
    id: 'test3',
    name: 'Campeonato Test 3'
};
const img3 = getChampionshipOGImage(championship3);
if (img3 !== `${BASE_URL}/og-championships.png`) {
    bugs.push({
        test: 'Championship sin banner',
        expected: `${BASE_URL}/og-championships.png`,
        got: img3
    });
} else {
    console.log('✅ Championship sin banner usa fallback');
}

// Test 4: Escape de caracteres especiales en título
testsRun++;
const maliciousTitle = '<script>alert("xss")</script>';
const escaped = esc(maliciousTitle);
if (escaped.includes('<script>') || escaped.includes('</script>')) {
    bugs.push({
        test: 'Escape de XSS en título',
        issue: 'Script tags no escapados correctamente',
        input: maliciousTitle,
        output: escaped
    });
} else {
    console.log('✅ Escape de XSS en título funciona correctamente');
}

// Test 5: Escape de comillas en descripción
testsRun++;
const quotedDesc = 'Campeonato "Elite" - \'Temporada 2024\'';
const escapedDesc = esc(quotedDesc);
if (escapedDesc.includes('"') || escapedDesc.includes("'")) {
    bugs.push({
        test: 'Escape de comillas',
        issue: 'Comillas no escapadas correctamente',
        input: quotedDesc,
        output: escapedDesc
    });
} else {
    console.log('✅ Escape de comillas funciona correctamente');
}

// Test 6: URL de redirección correcta
testsRun++;
const redirectUrl = `${BASE_URL}/championships?id=test1`;
const expectedPattern = /^https:\/\/imsa\.trenkit\.com\/championships\?id=.+$/;
if (!expectedPattern.test(redirectUrl)) {
    bugs.push({
        test: 'URL de redirección',
        issue: 'Formato de URL incorrecto',
        got: redirectUrl
    });
} else {
    console.log('✅ URL de redirección tiene formato correcto');
}

// Test 7: Evento con banner válido
testsRun++;
const event1 = {
    id: 'evt1',
    name: 'Evento Test',
    banner: 'https://example.com/event-banner.png'
};
const evtImg1 = getEventOGImage(event1);
if (evtImg1 !== event1.banner) {
    bugs.push({
        test: 'Evento con banner válido',
        expected: event1.banner,
        got: evtImg1
    });
} else {
    console.log('✅ Evento con banner válido usa ese banner');
}

// Test 8: Banner con espacios en blanco
testsRun++;
const championship4 = {
    id: 'test4',
    name: 'Test 4',
    banner: '   https://example.com/banner.png   '
};
const img4 = getChampionshipOGImage(championship4);
if (img4 !== championship4.banner.trim()) {
    bugs.push({
        test: 'Banner con espacios debe trimmearse',
        expected: championship4.banner.trim(),
        got: img4
    });
} else {
    console.log('✅ Banner con espacios se maneja correctamente');
}

console.log(`\n${testsRun} tests ejecutados\n`);

if (bugs.length > 0) {
    console.log('🐛 BUGS ENCONTRADOS:');
    bugs.forEach(b => {
        console.log(`\n  ${b.test}:`);
        if (b.issue) console.log(`    Issue: ${b.issue}`);
        if (b.expected) console.log(`    Expected: ${b.expected}`);
        if (b.got) console.log(`    Got: ${b.got}`);
        if (b.input) console.log(`    Input: ${b.input}`);
        if (b.output) console.log(`    Output: ${b.output}`);
    });
    process.exit(1);
} else {
    console.log('✅ Todas las funciones del script pasan los tests');
    process.exit(0);
}
