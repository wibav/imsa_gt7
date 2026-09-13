/**
 * Tests del detector de siglas de equipo (src/app/utils/teamTagMatcher.js).
 *
 * Casos sacados de GT7 ID reales de la liga. Sin Firestore: es lógica pura.
 *
 * Uso:
 *   node scripts/test-team-tags.mjs
 */
import assert from 'assert/strict';
import { fileURLToPath } from 'url';
import path from 'path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const {
    extraerSiglas,
    sugerirEquipos,
    pilotosConSiglasDe,
    mapaEquipoPorPiloto,
    conflictosDeMiembros,
} = await import(path.join(ROOT, 'src/app/utils/teamTagMatcher.js'));

let ok = 0;
const test = (nombre, fn) => { fn(); ok++; console.log(`  ✓ ${nombre}`); };

console.log('extraerSiglas');
test('guion bajo, mayúsculas y minúsculas dan las mismas siglas', () => {
    assert.deepEqual(extraerSiglas('HGT_ALEX94'), { tag: 'HGT', resto: 'ALEX94' });
    assert.equal(extraerSiglas('Hgt_dayo21').tag, 'HGT');
    assert.equal(extraerSiglas('Sfrt_Sebaspon77').tag, 'SFRT');
});
test('guion y siglas con dígitos', () => {
    assert.equal(extraerSiglas('MR-Tony').tag, 'MR');
    assert.equal(extraerSiglas('GRT21_TITIAXEL10').tag, 'GRT21');
});
test('espacio tras el separador: "SFRT_ Merenguay"', () => {
    assert.deepEqual(extraerSiglas('SFRT_ Merenguay'), { tag: 'SFRT', resto: 'Merenguay' });
});
test('espacio solo con siglas en mayúsculas', () => {
    assert.equal(extraerSiglas('AAM Josetxu').tag, 'AAM');
    assert.equal(extraerSiglas('Carlos Ll'), null);
    assert.equal(extraerSiglas('Luis THC'), null);
});
test('un resto sin letras no es un piloto: "Dayo_21"', () => {
    assert.equal(extraerSiglas('Dayo_21'), null);
});
test('siglas solo de dígitos no cuentan', () => {
    assert.equal(extraerSiglas('21_Nano'), null);
});
test('sin separador no hay siglas', () => {
    assert.equal(extraerSiglas('deshbourne'), null);
    assert.equal(extraerSiglas(''), null);
    assert.equal(extraerSiglas(null), null);
});

console.log('sugerirEquipos');
const nombres = [
    'HGT_ALEX94', 'HGT_Suragoth', 'HGT_dayo21', 'Hgt_dayo21', 'HGT_PeluoDW13',
    'RRT_BLAS', 'RRT_ZUNZU',
    'MR-Tony',
    'AAM_Chak', 'HPR_Chak',
    'deshbourne',
];
const resolver = { 'Hgt_dayo21': 'HGT_dayo21' };

test('la misma persona con dos escrituras cuenta una vez', () => {
    const hgt = sugerirEquipos(nombres, { resolver }).find(g => g.tag === 'HGT');
    assert.equal(hgt.pilotos.length, 4);
    assert.deepEqual(hgt.variantes, ['HGT', 'Hgt']);
    assert.deepEqual(hgt.pilotos.find(p => p.pilot === 'HGT_dayo21').nombres, ['HGT_dayo21', 'Hgt_dayo21']);
});
test('unas siglas con un solo piloto no se proponen', () => {
    const tags = sugerirEquipos(nombres, { resolver }).map(g => g.tag);
    assert.ok(!tags.includes('MR'));
    assert.ok(!tags.includes('AAM'));
});
test('no se proponen siglas ya confirmadas ni descartadas', () => {
    const equipos = [{ id: 'hgt', tag: 'HGT', tagVariants: ['Hgt'], members: [] }];
    const tags = sugerirEquipos(nombres, { resolver, equipos, descartadas: ['rrt'] }).map(g => g.tag);
    assert.deepEqual(tags, []);
});

console.log('pilotosConSiglasDe');
const hgt = {
    id: 'hgt', tag: 'HGT', tagVariants: ['Hgt'],
    members: [{ pilot: 'HGT_ALEX94', to: null }],
    notMembers: [{ pilot: 'HGT_Suragoth' }],
};
const rrt = { id: 'rrt', tag: 'RRT', members: [{ pilot: 'HGT_PeluoDW13', to: null }] };

test('quien lleva siglas antiguas pero ya es de otro equipo se separa', () => {
    const r = pilotosConSiglasDe(hgt, nombres, { resolver, equipos: [hgt, rrt] });
    assert.deepEqual(r.nuevos.map(p => p.pilot), ['HGT_dayo21']);
    assert.equal(r.deOtroEquipo.length, 1);
    assert.equal(r.deOtroEquipo[0].pilot, 'HGT_PeluoDW13');
    assert.equal(r.deOtroEquipo[0].equipo.tag, 'RRT');
});
test('miembros y "no es del equipo" no se vuelven a proponer', () => {
    const r = pilotosConSiglasDe(hgt, nombres, { resolver, equipos: [hgt, rrt] });
    const todos = [...r.nuevos, ...r.deOtroEquipo].map(p => p.pilot);
    assert.ok(!todos.includes('HGT_ALEX94'));
    assert.ok(!todos.includes('HGT_Suragoth'));
});

console.log('mapaEquipoPorPiloto');
test('solo cuentan los miembros actuales, y los alias heredan el equipo', () => {
    const eq = { id: 'x', tag: 'HGT', members: [{ pilot: 'HGT_dayo21', to: null }, { pilot: 'Viejo', to: '2026-03-01' }] };
    const m = mapaEquipoPorPiloto([eq], resolver);
    assert.equal(m['HGT_dayo21'].tag, 'HGT');
    assert.equal(m['Hgt_dayo21'].tag, 'HGT');
    assert.equal(m['Viejo'], undefined);
});

console.log('conflictosDeMiembros');
test('un piloto no puede ser miembro actual de dos equipos', () => {
    const nuevo = { id: 'nuevo', tag: 'HPR', members: [{ pilot: 'HGT_PeluoDW13', to: null }] };
    assert.deepEqual(conflictosDeMiembros(nuevo, [hgt, rrt]), ['HGT_PeluoDW13 (ya en RRT)']);
    // Si en el otro equipo ya tiene fecha de salida, no hay conflicto.
    const rrtConSalida = { ...rrt, members: [{ pilot: 'HGT_PeluoDW13', to: '2026-04-01' }] };
    assert.deepEqual(conflictosDeMiembros(nuevo, [hgt, rrtConSalida]), []);
});

console.log(`\n${ok} tests OK`);
