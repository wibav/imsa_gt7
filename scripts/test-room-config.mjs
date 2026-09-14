/**
 * Tests de la configuración de sala (src/app/utils/roomConfig.js): que los
 * valores guardados en formatos antiguos se lean con los nombres del juego.
 *
 * Uso: node scripts/test-room-config.mjs
 */
import assert from 'assert/strict';
import { fileURLToPath } from 'url';
import path from 'path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { normalizarReglas, textoAjuste, seccionesVisibles, REGLAS_POR_DEFECTO, salaDeEvento, resumenSalaEvento } = await import(path.join(ROOT, 'src/app/utils/roomConfig.js'));

let ok = 0;
const test = (n, fn) => { fn(); ok++; console.log(`  ✓ ${n}`); };
const t = (rules, id, extra = {}) => textoAjuste({ rules, ...extra }, id);

test('daño mecánico antiguo y nuevo', () => {
    assert.equal(t({ mechanicalDamage: 'Graves' }, 'mechanicalDamage'), 'Grave');
    assert.equal(t({ mechanicalDamage: 'Leves' }, 'mechanicalDamage'), 'Leve');
    assert.equal(t({ mechanicalDamage: 'championship' }, 'mechanicalDamage'), 'Campeonato');
});
test('rebufo sí/no pasa a Real/Desactivado', () => {
    assert.equal(t({ raceSlipstream: true }, 'raceSlipstream'), 'Real');
    assert.equal(t({ qualySlipstream: false }, 'qualySlipstream'), 'Desactivado');
});
test('atajos: Moderado (no existe en el juego) se lee como Leve', () => {
    assert.equal(t({ penaltyShortcut: 'strong' }, 'penaltyShortcut'), 'Grave');
    assert.equal(t({ penaltyShortcut: 'moderate' }, 'penaltyShortcut'), 'Leve');
});
test('BoP y ajustes, también en mayúsculas', () => {
    assert.equal(t({ bop: 'SI', adjustments: 'NO' }, 'tuningProhibited'), 'Activado');
    assert.equal(t({ bop: 'no', adjustments: 'no' }, 'tuningProhibited'), 'Desactivado');
});
test('asistencias: no/off → Prohibido, on/default → Sin límite, ABS débil', () => {
    const r = normalizarReglas({ tcs: 'off', asm: 'on', counterSteering: 'no', abs: 'weak' });
    assert.deepEqual([r.tcs, r.asm, r.counterSteering, r.abs], ['prohibited', 'unlimited', 'prohibited', 'weak']);
});
test('neumáticos: [CB] = Carrera + requeridos Blandos; tres compuestos = utilizables', () => {
    assert.equal(t({ mandatoryTyre: ['CB'] }, 'usableTyres'), 'Carrera');
    assert.equal(t({ mandatoryTyre: ['CB'] }, 'requiredCompounds'), 'Blandos');
    const r = normalizarReglas({ mandatoryTyre: ['CD', 'CM', 'CB'] });
    assert.deepEqual(r.usableCompounds, []);
    assert.equal(r.requiredCompounds, undefined);
});
test('desgaste en clasificación: true = igual que en carrera', () => {
    assert.equal(t({ qualyTireWear: true }, 'qualyTireWear'), 'Igual que durante la carrera');
});
test('lo no configurado no se muestra', () => {
    assert.equal(t({}, 'startType'), null);
    assert.equal(seccionesVisibles({ rules: {} }).length, 0);
});
test('una sala nueva muestra las seis secciones del juego', () => {
    const s = seccionesVisibles({ raceType: 'resistencia', duration: 50, category: 'Gr4', rules: REGLAS_POR_DEFECTO });
    assert.deepEqual(s.map(x => x.titulo), ['Pista y clima', 'Configuración de la carrera', 'Ajustes de clasificación', 'Configuración de regulaciones', 'Configuración de penalizaciones', 'Limitaciones de las opciones de conducción']);
});
test('no modifica las reglas originales', () => {
    const orig = { mechanicalDamage: 'Graves', raceSlipstream: true };
    normalizarReglas(orig);
    assert.deepEqual(orig, { mechanicalDamage: 'Graves', raceSlipstream: true });
});
test('valores por defecto = sala de las capturas', () => {
    const d = REGLAS_POR_DEFECTO;
    assert.deepEqual([d.tireWear, d.fuelConsumption, d.fuelRefillRate, d.nitroTimeMultiplier, d.timeMultiplier], [4, 6, 3, 0.1, 10]);
    assert.deepEqual(d.requiredCompounds, ['soft']);
    assert.equal(d.weatherSlots.length, 9);
    assert.equal('startTime' in d, false);
});
test('eventos: nombres antiguos, clima en weather y vueltas', () => {
    const ev = { rules: { laps: '15', damage: 'Graves', tyreWear: 5, fuelWear: 0, mandatoryTyres: ['CB'], mandatoryTyreChange: 'SI', mandatoryPitstops: 1, shortcutPenalty: 'NO', bop: 'SI', adjustments: 'NO' }, weather: { timeOfDay: 'Tarde', timeMultiplier: 2, weatherSlots: 'S18/C05' } };
    const sala = salaDeEvento(ev);
    const tx = (id) => textoAjuste(sala, id);
    assert.equal(tx('__victoria'), '15 vueltas');
    assert.equal(tx('mechanicalDamage'), 'Grave');
    assert.equal(tx('tireWear'), '5x');
    assert.equal(tx('fuelConsumption'), '0x');
    assert.equal(tx('requiredCompounds'), 'Blandos');
    assert.equal(tx('mandatoryCompoundChanges'), 'Activada');
    assert.equal(tx('mandatoryPitStops'), '1');
    assert.equal(tx('penaltyShortcut'), 'Desactiv.');
    assert.equal(tx('tuningProhibited'), 'Activado');
    assert.equal(tx('timeOfDay'), 'Tarde');
    assert.equal(tx('weatherSlots'), 'S18/C05');
    assert.ok(resumenSalaEvento(ev).length >= 4);
});
console.log(`\n${ok} tests OK`);
