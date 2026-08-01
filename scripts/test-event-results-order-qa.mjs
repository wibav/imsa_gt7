/**
 * QA adversarial — Bloque 2 (sortSubcollectionDocs) y Bloque 3
 * (reorderByPosition) del arreglo de orden de resultados de eventos
 * estándar (/eventsAdmin, Sala Única).
 *
 * Foco:
 *  - La frontera 10 vs 11 documentos: 10 "pasaba por casualidad" con el
 *    orden lexicográfico viejo (a.id.localeCompare(b.id)), 11 lo rompía
 *    ("r10" ordena antes que "r2"). Es la prueba de que el fix realmente
 *    hizo algo.
 *  - Robustez a n=100/101 (nunca depender de padding de longitud fija).
 *  - Invariante: el conjunto de `_uid` no cambia al reordenar por
 *    desplazamiento (reorderByPosition no pierde ni duplica filas).
 *  - La secuencia de `position` queda siempre 1..n sin huecos ni
 *    duplicados tras cualquier reorderByPosition.
 *
 * Uso: node scripts/test-event-results-order-qa.mjs
 */
import { sortSubcollectionDocs } from '../src/app/utils/subcollectionOrder.js';
import { reorderByPosition } from '../src/app/utils/eventResultsOrder.js';

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
function assertEqual(actual, expected, msg) {
    if (actual !== expected) throw new Error(`${msg || 'assertEqual'}: esperado ${JSON.stringify(expected)}, obtenido ${JSON.stringify(actual)}`);
}
function assertDeepEqual(actual, expected, msg) {
    const a = JSON.stringify(actual);
    const e = JSON.stringify(expected);
    if (a !== e) throw new Error(`${msg || 'assertDeepEqual'}: esperado ${e}, obtenido ${a}`);
}

// Helper: construye un "doc" fake al estilo snapshot.docs de Firestore.
function fakeDoc(id, data = {}) {
    return { id, data: () => data };
}

// ── sortSubcollectionDocs: la frontera 10 vs 11 ──

check('sortSubcollectionDocs: con 10 documentos, el orden numérico coincide con localeCompare (pasaba "por casualidad" antes del fix)', () => {
    const docs = Array.from({ length: 10 }, (_, i) => fakeDoc(`r${i}`, { position: i + 1 }));
    // Mezclar el orden de entrada para no depender de que ya vengan ordenados.
    const shuffled = [...docs].reverse();
    const sorted = sortSubcollectionDocs(shuffled, { prefix: 'r', orderField: 'position' });
    assertDeepEqual(sorted.map(d => d.id), docs.map(d => d.id), 'orden con n=10');
});

check('sortSubcollectionDocs: con 11 documentos, el orden numérico es correcto (el bug viejo rompía aquí: r10 antes que r2)', () => {
    const docs = Array.from({ length: 11 }, (_, i) => fakeDoc(`r${i}`, { position: i + 1 }));
    const shuffled = [...docs].reverse();
    const sorted = sortSubcollectionDocs(shuffled, { prefix: 'r', orderField: 'position' });
    assertDeepEqual(sorted.map(d => d.id), docs.map(d => d.id), 'orden con n=11');

    // Reproducir explícitamente el síntoma reportado: verificar que "r2" NO
    // queda después de "r10" en el resultado (que es justo lo que hacía
    // a.id.localeCompare(b.id) con 11+ documentos).
    const idx2 = sorted.findIndex(d => d.id === 'r2');
    const idx10 = sorted.findIndex(d => d.id === 'r10');
    if (idx2 > idx10) throw new Error('r2 quedó después de r10 — el bug de localeCompare sigue presente');
});

check('sortSubcollectionDocs: reproduce el síntoma EXACTO documentado con localeCompare puro (línea base, confirma que el bug era real)', () => {
    const docs = Array.from({ length: 16 }, (_, i) => fakeDoc(`r${i}`, { position: i + 1 }));
    const buggyOrder = [...docs].sort((a, b) => a.id.localeCompare(b.id)).map(d => d.id);
    const expectedBuggyOrder = ['r0', 'r1', 'r10', 'r11', 'r12', 'r13', 'r14', 'r15', 'r2', 'r3', 'r4', 'r5', 'r6', 'r7', 'r8', 'r9'];
    assertDeepEqual(buggyOrder, expectedBuggyOrder, 'localeCompare puro (comportamiento viejo documentado)');

    // Y el fix da el orden correcto para el mismo set de datos.
    const fixed = sortSubcollectionDocs(docs, { prefix: 'r', orderField: 'position' }).map(d => d.id);
    assertDeepEqual(fixed, docs.map(d => d.id), 'sortSubcollectionDocs arregla el mismo caso');
});

// ── Robustez n=100/101 ──

check('sortSubcollectionDocs: robusto a n=100 (sin padding de longitud fija)', () => {
    const docs = Array.from({ length: 100 }, (_, i) => fakeDoc(`p${i}`));
    const shuffled = [...docs].sort(() => Math.random() - 0.5);
    const sorted = sortSubcollectionDocs(shuffled, { prefix: 'p' });
    assertDeepEqual(sorted.map(d => d.id), docs.map(d => d.id), 'orden con n=100');
});

check('sortSubcollectionDocs: robusto a n=101 (frontera de un dígito más)', () => {
    const docs = Array.from({ length: 101 }, (_, i) => fakeDoc(`p${i}`));
    const shuffled = [...docs].sort(() => Math.random() - 0.5);
    const sorted = sortSubcollectionDocs(shuffled, { prefix: 'p' });
    assertDeepEqual(sorted.map(d => d.id), docs.map(d => d.id), 'orden con n=101');
});

check('sortSubcollectionDocs: IDs administrativos (p0..pN) van antes que IDs públicos con timestamp', () => {
    const docs = [
        fakeDoc('p1755000000000_ab12cd'),
        fakeDoc('p2'),
        fakeDoc('p0'),
        fakeDoc('p1'),
    ];
    const sorted = sortSubcollectionDocs(docs, { prefix: 'p' });
    assertDeepEqual(sorted.map(d => d.id), ['p0', 'p1', 'p2', 'p1755000000000_ab12cd']);
});

check('sortSubcollectionDocs: no muta el array de entrada', () => {
    const docs = [fakeDoc('r2'), fakeDoc('r0'), fakeDoc('r1')];
    const original = docs.map(d => d.id);
    sortSubcollectionDocs(docs, { prefix: 'r' });
    assertDeepEqual(docs.map(d => d.id), original, 'el array original no debe cambiar de orden');
});

// ── reorderByPosition: invariantes estructurales ──

function makeResults(n) {
    return Array.from({ length: n }, (_, i) => ({ _uid: `uid-${i}`, driverName: `Piloto ${i + 1}`, position: i + 1 }));
}

check('reorderByPosition: mover P16 a la posición 1 — el conjunto de _uid es idéntico antes/después', () => {
    const results = makeResults(16);
    const before = new Set(results.map(r => r._uid));
    const after = reorderByPosition(results, 15, 1);
    const afterSet = new Set(after.map(r => r._uid));
    assertEqual(after.length, 16, 'longitud no cambia');
    assertDeepEqual([...afterSet].sort(), [...before].sort(), 'conjunto de _uid idéntico');
});

check('reorderByPosition: tras mover, la secuencia de position es 1..n sin huecos ni duplicados', () => {
    const results = makeResults(16);
    const after = reorderByPosition(results, 15, 1);
    const positions = after.map(r => r.position).sort((a, b) => a - b);
    assertDeepEqual(positions, Array.from({ length: 16 }, (_, i) => i + 1));
});

check('reorderByPosition: el piloto movido queda exactamente en la posición destino', () => {
    const results = makeResults(16);
    const after = reorderByPosition(results, 15, 1);
    assertEqual(after[0]._uid, 'uid-15', 'el piloto que estaba en la posición 16 debe quedar en la 1');
    assertEqual(after[0].position, 1);
});

check('reorderByPosition: desplazamiento hacia adelante (P1 -> posición 5) reacomoda por desplazamiento, no intercambio', () => {
    const results = makeResults(8);
    const after = reorderByPosition(results, 0, 5);
    // uid-0 (antes P1) debe terminar en position=5; uid-1..uid-4 deben
    // haberse desplazado una posición hacia arriba (2,3,4,5 -> 1,2,3,4), NO
    // haber quedado en el mismo lugar con solo uid-0 y uid-4 intercambiados.
    const byUid = Object.fromEntries(after.map(r => [r._uid, r.position]));
    assertEqual(byUid['uid-0'], 5);
    assertEqual(byUid['uid-1'], 1);
    assertEqual(byUid['uid-2'], 2);
    assertEqual(byUid['uid-3'], 3);
    assertEqual(byUid['uid-4'], 4);
    assertEqual(byUid['uid-5'], 6, 'los que ya estaban después del destino no se mueven');
});

check('reorderByPosition: targetPos fuera de rango (0) se clampa a 1', () => {
    const results = makeResults(5);
    const after = reorderByPosition(results, 4, 0);
    assertEqual(after[0]._uid, 'uid-4');
    assertDeepEqual(after.map(r => r.position), [1, 2, 3, 4, 5]);
});

check('reorderByPosition: targetPos fuera de rango (99) se clampa a n', () => {
    const results = makeResults(5);
    const after = reorderByPosition(results, 0, 99);
    assertEqual(after[after.length - 1]._uid, 'uid-0');
    assertDeepEqual(after.map(r => r.position), [1, 2, 3, 4, 5]);
});

check('reorderByPosition: targetPos igual a la posición actual no mueve a nadie, solo reindexa', () => {
    const results = makeResults(5);
    const after = reorderByPosition(results, 2, 3);
    assertDeepEqual(after.map(r => r._uid), results.map(r => r._uid));
});

check('reorderByPosition: array vacío no explota', () => {
    assertDeepEqual(reorderByPosition([], 0, 1), []);
});

check('reorderByPosition: fromIdx fuera de rango devuelve la lista sin cambios', () => {
    const results = makeResults(3);
    const after = reorderByPosition(results, 10, 1);
    assertDeepEqual(after, results);
});

check('reorderByPosition: robusto a n=101 — conjunto de _uid y secuencia de position se preservan', () => {
    const results = makeResults(101);
    const after = reorderByPosition(results, 100, 1);
    assertEqual(after.length, 101);
    const positions = after.map(r => r.position).sort((a, b) => a - b);
    assertDeepEqual(positions, Array.from({ length: 101 }, (_, i) => i + 1));
    const afterUids = new Set(after.map(r => r._uid));
    const beforeUids = new Set(results.map(r => r._uid));
    assertDeepEqual([...afterUids].sort(), [...beforeUids].sort());
});

check('reorderByPosition: no muta el array de entrada', () => {
    const results = makeResults(5);
    const originalUids = results.map(r => r._uid);
    reorderByPosition(results, 4, 1);
    assertDeepEqual(results.map(r => r._uid), originalUids, 'el array original no debe reordenarse');
    assertDeepEqual(results.map(r => r.position), [1, 2, 3, 4, 5], 'las posiciones originales no deben reescribirse');
});

console.log(`\n${passed} pasaron, ${failed} fallaron`);
if (failed > 0) process.exit(1);
