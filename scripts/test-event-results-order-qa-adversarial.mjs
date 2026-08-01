/**
 * QA ADVERSARIAL INDEPENDIENTE — sortSubcollectionDocs / reorderByPosition
 *
 * Escrito por un segundo par de ojos (QA), sin asumir que el 18/18 del
 * programador (scripts/test-event-results-order-qa.mjs) fue suficiente.
 * Ataca específicamente lo que el documento de requerimientos y el plan
 * señalan como riesgo: colisión de prefijos, n grandes, mezcla admin/
 * pública, precedencia sufijo-de-ID vs orderField, estabilidad del
 * desempate, y el contrato de clamp de reorderByPosition con inputs no
 * numéricos.
 *
 * Uso: node scripts/test-event-results-order-qa-adversarial.mjs
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
function fakeDoc(id, data = {}) {
    return { id, data: () => data };
}

// ══════════════════════════════════════════════════════════════
// sortSubcollectionDocs
// ══════════════════════════════════════════════════════════════

check('sortSubcollectionDocs: frontera exacta EXCLUSIVA r0..r9 (n=10) — orden correcto sin ayuda de orderField', () => {
    const docs = Array.from({ length: 10 }, (_, i) => fakeDoc(`r${i}`)).sort(() => Math.random() - 0.5);
    const sorted = sortSubcollectionDocs(docs, { prefix: 'r' });
    assertDeepEqual(sorted.map(d => d.id), Array.from({ length: 10 }, (_, i) => `r${i}`));
});

check('sortSubcollectionDocs: frontera exacta r0..r10 (n=11) — sin orderField, el sufijo numérico basta solo', () => {
    const docs = Array.from({ length: 11 }, (_, i) => fakeDoc(`r${i}`)).sort(() => Math.random() - 0.5);
    const sorted = sortSubcollectionDocs(docs, { prefix: 'r' });
    assertDeepEqual(sorted.map(d => d.id), Array.from({ length: 11 }, (_, i) => `r${i}`));
});

check('sortSubcollectionDocs: prefijo "rnd" NO colisiona con una llamada hecha con prefijo "r" (regex no debe casar "rnd5" como r+"nd5")', () => {
    // Si alguien llama mal el helper con prefix:'r' sobre una lista que
    // mezcla resultados "r0..r5" y rondas "rnd0..rnd5", los rnd* no deben
    // interpretarse como si tuvieran sufijo numérico del prefijo "r"
    // (rnd5.slice(1) = "nd5", no son todos dígitos -> null, correcto).
    const docs = [
        fakeDoc('r2'), fakeDoc('r0'), fakeDoc('r1'),
        fakeDoc('rnd1'), fakeDoc('rnd0'),
    ];
    const sorted = sortSubcollectionDocs(docs, { prefix: 'r' });
    // r0,r1,r2 (sufijo numérico real del prefijo "r") deben ir primero,
    // en orden numérico; los rnd* (sin sufijo numérico reconocido para el
    // prefijo "r") van después, desempatados por localeCompare del ID
    // completo ("rnd0" < "rnd1").
    assertDeepEqual(sorted.map(d => d.id), ['r0', 'r1', 'r2', 'rnd0', 'rnd1'],
        'rnd* no debe intercalarse entre r0..r2 como si tuviera sufijo numérico');
});

check('sortSubcollectionDocs: llamada correcta con prefijo "rnd" sobre rondas puras funciona igual que con "r"/"p"', () => {
    const docs = Array.from({ length: 13 }, (_, i) => fakeDoc(`rnd${i}`, { roundNumber: i + 1 })).sort(() => Math.random() - 0.5);
    const sorted = sortSubcollectionDocs(docs, { prefix: 'rnd', orderField: 'roundNumber' });
    assertDeepEqual(sorted.map(d => d.id), Array.from({ length: 13 }, (_, i) => `rnd${i}`));
});

check('sortSubcollectionDocs: robusto a n=999 (nada de padding de longitud fija)', () => {
    const docs = Array.from({ length: 999 }, (_, i) => fakeDoc(`p${i}`)).sort(() => Math.random() - 0.5);
    const sorted = sortSubcollectionDocs(docs, { prefix: 'p' });
    assertDeepEqual(sorted.map(d => d.id), Array.from({ length: 999 }, (_, i) => `p${i}`));
});

check('sortSubcollectionDocs: p0..pN administrativos primero, luego públicos p{timestamp}_{rand} en orden CRONOLÓGICO entre sí', () => {
    const docs = [
        fakeDoc('p1755100000000_zz99zz'), // más tarde
        fakeDoc('p3'),
        fakeDoc('p1755000000000_aa11aa'), // más temprano
        fakeDoc('p0'),
        fakeDoc('p1'),
        fakeDoc('p1755050000000_mm55mm'), // en medio
        fakeDoc('p2'),
    ];
    const sorted = sortSubcollectionDocs(docs, { prefix: 'p' });
    assertDeepEqual(sorted.map(d => d.id), [
        'p0', 'p1', 'p2', 'p3',
        'p1755000000000_aa11aa', 'p1755050000000_mm55mm', 'p1755100000000_zz99zz',
    ]);
});

check('sortSubcollectionDocs: precedencia — el sufijo numérico del ID manda sobre orderField aunque orderField diga lo contrario (datos ya corrompidos)', () => {
    // r5 con position:1 (corrupto) vs r1 con position:99 (corrupto): el
    // sufijo del ID debe imponerse — es la decisión documentada del plan
    // ("el propio bug pudo haber dejado position desalineado").
    const docs = [fakeDoc('r5', { position: 1 }), fakeDoc('r1', { position: 99 }), fakeDoc('r3', { position: 50 })];
    const sorted = sortSubcollectionDocs(docs, { prefix: 'r', orderField: 'position' });
    assertDeepEqual(sorted.map(d => d.id), ['r1', 'r3', 'r5'], 'el sufijo del ID debe ganar sobre orderField');
});

check('sortSubcollectionDocs: orderField solo se usa cuando NINGUNO de los dos tiene sufijo numérico reconocible', () => {
    const docs = [
        fakeDoc('pTIMESTAMP_bbb', { registeredAt: '2026-01-02' }),
        fakeDoc('pTIMESTAMP_aaa', { registeredAt: '2026-01-01' }),
    ];
    // orderField no está en la firma real de estos casos (participants no
    // usa orderField según el plan), pero probamos el fallback genérico:
    // sin sufijo numérico en ninguno, y sin orderField numérico útil, cae a
    // localeCompare del id completo.
    const sorted = sortSubcollectionDocs(docs, { prefix: 'p' });
    assertDeepEqual(sorted.map(d => d.id), ['pTIMESTAMP_aaa', 'pTIMESTAMP_bbb'], 'desempate por localeCompare del id completo');
});

check('sortSubcollectionDocs: desempate estable con localeCompare — determinista entre llamadas repetidas (mismo input, mismo output)', () => {
    const docs = [fakeDoc('x_bb'), fakeDoc('x_aa'), fakeDoc('x_cc')];
    const run1 = sortSubcollectionDocs(docs, { prefix: 'p' }).map(d => d.id);
    const run2 = sortSubcollectionDocs(docs, { prefix: 'p' }).map(d => d.id);
    const run3 = sortSubcollectionDocs([...docs].reverse(), { prefix: 'p' }).map(d => d.id);
    assertDeepEqual(run1, run2, 'dos llamadas con el mismo input deben dar el mismo output');
    assertDeepEqual(run1, run3, 'el orden de entrada no debe afectar el resultado final (estable, no solo "estable de JS sort")');
});

check('sortSubcollectionDocs: IDs duplicados en la clave de orden (dos docs con exactamente el mismo id) no explota y es determinista', () => {
    const docs = [fakeDoc('r3', { a: 1 }), fakeDoc('r3', { a: 2 }), fakeDoc('r1', { a: 3 })];
    const sorted = sortSubcollectionDocs(docs, { prefix: 'r' });
    assertEqual(sorted.length, 3);
    assertEqual(sorted[0].id, 'r1');
    assertEqual(sorted[1].id, 'r3');
    assertEqual(sorted[2].id, 'r3');
});

check('sortSubcollectionDocs: array vacío no explota', () => {
    assertDeepEqual(sortSubcollectionDocs([], { prefix: 'r' }), []);
});

check('sortSubcollectionDocs: un solo documento se devuelve igual', () => {
    const docs = [fakeDoc('r0', { position: 1 })];
    const sorted = sortSubcollectionDocs(docs, { prefix: 'r', orderField: 'position' });
    assertEqual(sorted.length, 1);
    assertEqual(sorted[0].id, 'r0');
});

check('sortSubcollectionDocs: sin prefix/options no explota (options={} por defecto) y cae a localeCompare puro', () => {
    const docs = [fakeDoc('b'), fakeDoc('a')];
    const sorted = sortSubcollectionDocs(docs);
    assertDeepEqual(sorted.map(d => d.id), ['a', 'b']);
});

check('sortSubcollectionDocs: id no-string o doc malformado no explota (data() ausente se maneja con optional chaining)', () => {
    const docs = [{ id: 'r1', data: () => ({}) }, { id: 'r0', data: () => null }];
    const sorted = sortSubcollectionDocs(docs, { prefix: 'r', orderField: 'position' });
    assertDeepEqual(sorted.map(d => d.id), ['r0', 'r1']);
});

// ══════════════════════════════════════════════════════════════
// reorderByPosition
// ══════════════════════════════════════════════════════════════

function makeResults(n) {
    return Array.from({ length: n }, (_, i) => ({ _uid: `uid-${i}`, position: i + 1 }));
}
function assertInvariants(before, after, label) {
    const beforeUids = new Set(before.map(r => r._uid));
    const afterUids = new Set(after.map(r => r._uid));
    assertEqual(after.length, before.length, `${label}: longitud preservada`);
    assertDeepEqual([...afterUids].sort(), [...beforeUids].sort(), `${label}: conjunto de _uid idéntico`);
    const positions = after.map(r => r.position).sort((a, b) => a - b);
    assertDeepEqual(positions, Array.from({ length: before.length }, (_, i) => i + 1), `${label}: secuencia 1..n sin huecos ni duplicados`);
}

check('reorderByPosition: mover el primero (idx=0) al último (targetPos=n)', () => {
    const before = makeResults(6);
    const after = reorderByPosition(before, 0, 6);
    assertInvariants(before, after, 'primero->último');
    assertEqual(after[after.length - 1]._uid, 'uid-0');
});

check('reorderByPosition: mover el último (idx=n-1) al primero (targetPos=1)', () => {
    const before = makeResults(6);
    const after = reorderByPosition(before, 5, 1);
    assertInvariants(before, after, 'último->primero');
    assertEqual(after[0]._uid, 'uid-5');
});

check('reorderByPosition: no-mover, fromIdx===targetPos-1 (ya está donde se pidió) deja el orden intacto', () => {
    const before = makeResults(6);
    const after = reorderByPosition(before, 3, 4); // idx 3 = posición 4 ya
    assertInvariants(before, after, 'no-mover');
    assertDeepEqual(after.map(r => r._uid), before.map(r => r._uid));
});

check('reorderByPosition: targetPos=0 se clampa a 1 (no explota, no negativo)', () => {
    const before = makeResults(6);
    const after = reorderByPosition(before, 3, 0);
    assertInvariants(before, after, 'targetPos=0');
    assertEqual(after[0]._uid, 'uid-3');
});

check('reorderByPosition: targetPos=-5 se clampa a 1', () => {
    const before = makeResults(6);
    const after = reorderByPosition(before, 3, -5);
    assertInvariants(before, after, 'targetPos=-5');
    assertEqual(after[0]._uid, 'uid-3');
});

check('reorderByPosition: targetPos=n+10 se clampa a n', () => {
    const before = makeResults(6);
    const after = reorderByPosition(before, 0, 16);
    assertInvariants(before, after, 'targetPos=n+10');
    assertEqual(after[after.length - 1]._uid, 'uid-0');
});

// ── Contrato roto: NaN/undefined NO se clampan a [1,n] como dice el JSDoc ──
check('[BUG] reorderByPosition: targetPos=NaN debería clampar a [1,n] según su propio JSDoc, pero no lo hace', () => {
    const before = makeResults(5);
    const after = reorderByPosition(before, 2, NaN);
    // El JSDoc dice "se clampa a [1, n]" sin excepción para NaN. Math.max(1,
    // NaN) === NaN y Math.min(NaN, n) === NaN, así que clampedTargetPos
    // termina siendo NaN, targetIdx = NaN - 1 = NaN, y
    // list.splice(NaN, 0, moved) trata NaN como índice 0 → el elemento
    // SIEMPRE termina en la primera posición, sin importar dónde estaba.
    // Documentamos el comportamiento observado y marcamos el contrato
    // violado.
    assertInvariants(before, after, 'NaN no corrompe el invariante estructural (longitud/uids/posiciones), pero...');
    if (after[0]._uid !== 'uid-2') {
        throw new Error('comportamiento cambió respecto a lo observado — revisar');
    }
    // Esto es justamente el bug: se esperaría "clamp a 1 o n" documentado,
    // en la práctica siempre cae a la posición 1 con NaN, lo cual coincide
    // con "clamp a 1" únicamente por casualidad de que splice(NaN,...) ==
    // splice(0,...). Con Math.max(1, NaN) el resultado real es NaN, no 1;
    // el "clamp a 1" no está garantizado por el código, solo por un efecto
    // colateral de Array.prototype.splice.
});

check('[BUG] reorderByPosition: targetPos=undefined tiene el mismo comportamiento no documentado que NaN', () => {
    const before = makeResults(5);
    const after = reorderByPosition(before, 2, undefined);
    assertInvariants(before, after, 'undefined no corrompe el invariante estructural');
    assertEqual(after[0]._uid, 'uid-2', 'undefined empuja el elemento al frente vía splice(NaN,...), no documentado');
});

check('reorderByPosition: array vacío no explota', () => {
    assertDeepEqual(reorderByPosition([], 0, 1), []);
});

check('reorderByPosition: array de un solo elemento — cualquier movimiento es no-op salvo reindexado', () => {
    const before = [{ _uid: 'solo', position: 1 }];
    const after = reorderByPosition(before, 0, 5);
    assertEqual(after.length, 1);
    assertEqual(after[0]._uid, 'solo');
    assertEqual(after[0].position, 1);
});

check('reorderByPosition: fromIdx fuera de rango (negativo) devuelve la lista intacta', () => {
    const before = makeResults(4);
    const after = reorderByPosition(before, -1, 2);
    assertDeepEqual(after, before);
});

check('reorderByPosition: fromIdx fuera de rango (== n) devuelve la lista intacta', () => {
    const before = makeResults(4);
    const after = reorderByPosition(before, 4, 2);
    assertDeepEqual(after, before);
});

check('reorderByPosition: fromIdx = NaN se trata como fuera de rango (NaN < 0 y NaN >= n son ambas false, pero no debe crashear)', () => {
    const before = makeResults(4);
    // fromIdx < 0 → false (NaN comparisons), fromIdx >= n → false también,
    // así que pasa el guard inicial. Verificamos que al menos no explota y
    // preserva longitud/_uid — documentamos el comportamiento real.
    let threw = false;
    let after;
    try {
        after = reorderByPosition(before, NaN, 2);
    } catch (e) {
        threw = true;
    }
    if (threw) {
        throw new Error('reorderByPosition(results, NaN, targetPos) lanza una excepción — fromIdx no numérico no está protegido');
    }
    // Si no explotó, al menos el conjunto de datos no debe haberse perdido.
    assertEqual(after.length, 4, 'longitud preservada pese a fromIdx=NaN');
});

console.log(`\n${passed} pasaron, ${failed} fallaron`);
if (failed > 0) process.exit(1);
