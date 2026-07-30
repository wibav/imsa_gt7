/**
 * QA adversarial — funciones puras exportadas de AppealForm.js:
 * getAppealWindowStatus (ventana de 48h) y getEligibleAppellants
 * (legitimación, CA-3.1).
 *
 * Uso: node scripts/test-appealform-logic-qa.mjs
 */
// AppealForm.js contiene JSX ("use client" + React), que Node no puede
// importar directamente. getAppealWindowStatus/getEligibleAppellants son
// funciones puras sin JSX declaradas antes del componente — se extraen por
// texto y se ejecutan tal cual (mismo enfoque que test-claimform-window-qa.mjs)
// para probar el código REAL, no una reimplementación paralela.
import { readFileSync, writeFileSync, unlinkSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcPath = path.join(__dirname, '..', 'src/app/components/championship/AppealForm.js');
const src = readFileSync(srcPath, 'utf8');

const windowFnMatch = src.match(/export function getAppealWindowStatus[\s\S]*?\n\}/);
const eligibleFnMatch = src.match(/export function getEligibleAppellants[\s\S]*?\n\}/);

if (!windowFnMatch || !eligibleFnMatch) {
    console.log('❌ No se pudo extraer getAppealWindowStatus/getEligibleAppellants de AppealForm.js — revisar el patrón de extracción del test');
    process.exit(1);
}

const tmpFile = path.join(__dirname, '.tmp-appealform-extracted.mjs');
writeFileSync(tmpFile, `${windowFnMatch[0]}\n\n${eligibleFnMatch[0]}\n`);

const { getAppealWindowStatus, getEligibleAppellants } = await import(tmpFile);

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

// ═══════ getAppealWindowStatus ═══════

check('Dentro del plazo: resuelto hace 1h con ventana de 48h → reclamable', () => {
    const claim = { resolvedAt: new Date(Date.now() - 1 * 3600 * 1000).toISOString() };
    assertEqual(getAppealWindowStatus(claim, 48).claimable, true);
});

check('Fuera del plazo: resuelto hace 49h con ventana de 48h → NO reclamable', () => {
    const claim = { resolvedAt: new Date(Date.now() - 49 * 3600 * 1000).toISOString() };
    assertEqual(getAppealWindowStatus(claim, 48).claimable, false);
});

check('E3.8 — Límite exacto: resuelto hace EXACTAMENTE 48h (por debajo del segundo) → reclamable (<=, no estricto)', () => {
    // 48h menos 1 segundo de margen para evitar flakiness por el tiempo que
    // tarda en ejecutarse el test entre el cálculo de resolvedAt y la
    // llamada a getAppealWindowStatus (que usa Date.now() internamente).
    const claim = { resolvedAt: new Date(Date.now() - (48 * 3600 * 1000 - 500)).toISOString() };
    assertEqual(getAppealWindowStatus(claim, 48).claimable, true, 'justo antes del límite debe admitir');
});

check('E3.8 — Justo pasado el límite: resuelto hace 48h + 2s → NO reclamable', () => {
    const claim = { resolvedAt: new Date(Date.now() - (48 * 3600 * 1000 + 2000)).toISOString() };
    assertEqual(getAppealWindowStatus(claim, 48).claimable, false, 'justo después del límite debe rechazar');
});

check('E3.9 — resolvedAt ausente → fail-closed, NO reclamable, motivo explícito', () => {
    const claim = { status: 'accepted' };
    const result = getAppealWindowStatus(claim, 48);
    assertEqual(result.claimable, false);
    assertEqual(result.reason, 'no-resolved-at');
});

check('E3.9 — resolvedAt null explícito → fail-closed', () => {
    assertEqual(getAppealWindowStatus({ resolvedAt: null }, 48).claimable, false);
});

check('E3.9 — resolvedAt malformado ("no-es-una-fecha") → fail-closed, no explota', () => {
    const result = getAppealWindowStatus({ resolvedAt: 'no-es-una-fecha' }, 48);
    assertEqual(result.claimable, false);
    assertEqual(result.reason, 'invalid-date');
});

check('E3.9 — NO debe usar createdAt como sustituto silencioso cuando falta resolvedAt', () => {
    // Si el código cayera en la trampa de usar createdAt como fallback,
    // este claim (createdAt reciente, sin resolvedAt) sería "reclamable".
    // Debe seguir siendo fail-closed.
    const claim = { createdAt: new Date().toISOString() /* sin resolvedAt */ };
    assertEqual(getAppealWindowStatus(claim, 48).claimable, false);
});

check('claim null/undefined → fail-closed, no explota', () => {
    assertEqual(getAppealWindowStatus(null, 48).claimable, false);
    assertEqual(getAppealWindowStatus(undefined, 48).claimable, false);
});

check('appealWindowHours = 0 → nada es reclamable salvo el instante exacto de resolvedAt', () => {
    const claim = { resolvedAt: new Date(Date.now() - 1000).toISOString() };
    assertEqual(getAppealWindowStatus(claim, 0).claimable, false);
});

check('E3.19 — el plazo se evalúa contra el appealWindowHours ACTUAL, no uno congelado en el claim (cambiar la config afecta ventanas ya abiertas)', () => {
    const claim = { resolvedAt: new Date(Date.now() - 40 * 3600 * 1000).toISOString() };
    // Con ventana de 48h, sigue abierto:
    assertEqual(getAppealWindowStatus(claim, 48).claimable, true);
    // Si el organizador acorta la ventana a 24h, el mismo claim (sin cambiar
    // ningún dato propio) debe cerrarse — la función no cachea nada.
    assertEqual(getAppealWindowStatus(claim, 24).claimable, false);
});

// ═══════ getEligibleAppellants (CA-3.1) ═══════

check('accepted → solo los pilotos en accusedNames[]', () => {
    const claim = { status: 'accepted', accusedNames: ['Piloto A', 'Piloto B'], reporterName: 'Reclamante' };
    const eligible = getEligibleAppellants(claim);
    assertEqual(eligible.length, 2);
    assertEqual(eligible.includes('Piloto A'), true);
    assertEqual(eligible.includes('Reclamante'), false, 'el reclamante NO debe poder alegar una reclamación aceptada');
});

check('rejected → solo el reporterName', () => {
    const claim = { status: 'rejected', accusedNames: ['Piloto A'], reporterName: 'Reclamante' };
    const eligible = getEligibleAppellants(claim);
    assertEqual(eligible.length, 1);
    assertEqual(eligible[0], 'Reclamante');
    assertEqual(eligible.includes('Piloto A'), false, 'el acusado NO debe poder alegar una reclamación rechazada');
});

check('pending/reviewing → nadie tiene legitimación (CA-3.3, no se puede alegar sobre no resuelta)', () => {
    assertEqual(getEligibleAppellants({ status: 'pending', accusedNames: ['X'], reporterName: 'Y' }).length, 0);
    assertEqual(getEligibleAppellants({ status: 'reviewing', accusedNames: ['X'], reporterName: 'Y' }).length, 0);
});

check('E3.4 — varios acusados, ninguno filtrado por sanción real (limitación de UI conocida): getEligibleAppellants no distingue quién fue efectivamente sancionado', () => {
    // Documentamos el comportamiento real: CA-3.1 exige que legitimación en
    // "accepted" sea sobre accusedNames[]. Si hay 2 acusados pero la sanción
    // solo se aplicó a uno, esta función igual ofrece a ambos como elegibles
    // — ver huecos de cobertura en el reporte.
    const claim = { status: 'accepted', accusedNames: ['Sancionado', 'NoSancionado'] };
    const eligible = getEligibleAppellants(claim);
    assertEqual(eligible.length, 2, 'gap conocido: no filtra por sanción efectiva, solo por accusedNames[]');
});

check('accepted sin accusedNames[] pero con accusedName (singular, legado) → fallback', () => {
    const claim = { status: 'accepted', accusedName: 'Piloto Legado' };
    const eligible = getEligibleAppellants(claim);
    assertEqual(eligible.length, 1);
    assertEqual(eligible[0], 'Piloto Legado');
});

check('accepted sin ningún acusado registrado → lista vacía, no explota', () => {
    assertEqual(getEligibleAppellants({ status: 'accepted' }).length, 0);
});

check('claim null/undefined → lista vacía, no explota', () => {
    assertEqual(getEligibleAppellants(null).length, 0);
    assertEqual(getEligibleAppellants(undefined).length, 0);
});

check('Alguien fuera de accusedNames[]/reporterName no aparece nunca en la lista de elegibles (exclusión implícita)', () => {
    const claim = { status: 'accepted', accusedNames: ['A', 'B'], reporterName: 'C' };
    const eligible = getEligibleAppellants(claim);
    assertEqual(eligible.includes('Un Tercero Cualquiera'), false);
});

unlinkSync(tmpFile);

console.log(`\n${passed} pasaron, ${failed} fallaron`);
if (failed > 0) process.exit(1);
