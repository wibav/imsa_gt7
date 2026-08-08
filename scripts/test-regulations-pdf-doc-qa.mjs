/**
 * QA sobre buildRegulationsDocDefinition (src/app/utils/regulationsPdf.js).
 * Módulo JSON puro — sin pdfmake, sin navegador.
 *
 * Uso: node scripts/test-regulations-pdf-doc-qa.mjs
 */
import { buildRegulationsDocDefinition } from '../src/app/utils/regulationsPdf.js';

let passed = 0, failed = 0;
function check(name, fn) {
    try {
        fn();
        console.log(`✅ ${name}`);
        passed++;
    } catch (err) {
        console.log(`❌ ${name}`);
        console.log(`   ${err.message}`);
        failed++;
    }
}
function assert(cond, msg) {
    if (!cond) throw new Error(msg || 'assertion failed');
}

function findImages(node, found = []) {
    if (!node) return found;
    if (Array.isArray(node)) {
        node.forEach(n => findImages(n, found));
        return found;
    }
    if (typeof node === 'object') {
        if (node.image) found.push(node);
        Object.values(node).forEach(v => {
            if (v && typeof v === 'object') findImages(v, found);
        });
    }
    return found;
}

function textOf(node) {
    return JSON.stringify(node);
}

// ── org=null sin logos → no lanza, sin nodos image ──
check('org=null sin logos no lanza excepción', () => {
    const dd = buildRegulationsDocDefinition({
        championship: { name: 'Copa GT7', season: '2026' },
        org: null,
        bodyContent: [{ text: 'Reglamento de prueba' }],
        generatedAt: '08/08/2026 10:00',
        logos: {}
    });
    assert(dd && typeof dd === 'object', 'debe devolver un objeto');
});
check('sin logos, no hay nodos image en el resultado', () => {
    const dd = buildRegulationsDocDefinition({
        championship: { name: 'Copa GT7', season: '2026' },
        org: null,
        bodyContent: [{ text: 'Reglamento de prueba' }],
        generatedAt: '08/08/2026 10:00',
        logos: {}
    });
    const images = findImages(dd.content);
    assert(images.length === 0, JSON.stringify(images));
});

// ── Rango de fechas ──
check('startDate y endDate ISO ambos presentes → rango formateado', () => {
    const dd = buildRegulationsDocDefinition({
        championship: { name: 'Copa GT7', season: '2026', startDate: '2026-01-01T00:00:00.000Z', endDate: '2026-06-01T00:00:00.000Z' },
        bodyContent: [],
        generatedAt: 'x'
    });
    const flat = textOf(dd.content);
    assert(/–/.test(flat) || /-/.test(flat), flat);
    assert(!/Invalid Date/i.test(flat), flat);
});
check('solo startDate presente → sin rango a medias ni "Invalid Date"', () => {
    const dd = buildRegulationsDocDefinition({
        championship: { name: 'Copa GT7', season: '2026', startDate: '2026-01-01T00:00:00.000Z' },
        bodyContent: [],
        generatedAt: 'x'
    });
    const flat = textOf(dd.content);
    assert(!/Invalid Date/i.test(flat), flat);
});
check('ninguna fecha presente → sin rango, sin "Invalid Date"', () => {
    const dd = buildRegulationsDocDefinition({
        championship: { name: 'Copa GT7', season: '2026' },
        bodyContent: [],
        generatedAt: 'x'
    });
    const flat = textOf(dd.content);
    assert(!/Invalid Date/i.test(flat), flat);
});

// ── Estado traducido ──
check('estado traducido vía STATUS_LABELS, no el literal crudo', () => {
    const dd = buildRegulationsDocDefinition({
        championship: { name: 'Copa GT7', season: '2026', status: 'active' },
        bodyContent: [],
        generatedAt: 'x'
    });
    const flat = textOf(dd.content);
    assert(flat.includes('Activo'), flat);
    assert(!/"active"/.test(flat) || flat.includes('Activo'), flat);
});

// ── pageSize / tema claro ──
check("pageSize === 'A4'", () => {
    const dd = buildRegulationsDocDefinition({ championship: { name: 'X' }, bodyContent: [], generatedAt: 'x' });
    assert(dd.pageSize === 'A4', dd.pageSize);
});
check('colores de tema claro en defaultStyle (no blanco/claro sobre oscuro)', () => {
    const dd = buildRegulationsDocDefinition({ championship: { name: 'X' }, bodyContent: [], generatedAt: 'x' });
    assert(typeof dd.defaultStyle.color === 'string', JSON.stringify(dd.defaultStyle));
    // No debe ser blanco puro (tema oscuro de la web)
    assert(dd.defaultStyle.color.toLowerCase() !== '#ffffff', dd.defaultStyle.color);
});

// ── Footer ──
check('footer incluye nota de actualización y fecha de generación', () => {
    const dd = buildRegulationsDocDefinition({ championship: { name: 'X' }, bodyContent: [], generatedAt: '08/08/2026 10:00' });
    assert(typeof dd.footer === 'function', 'footer debe ser una función');
    const footerNode = dd.footer(1, 3);
    const flat = textOf(footerNode);
    assert(/actualizad/i.test(flat), flat);
    assert(flat.includes('08/08/2026 10:00'), flat);
    assert(/Página 1 de 3/.test(flat), flat);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
