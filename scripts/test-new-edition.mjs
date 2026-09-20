/**
 * Tests de utils/newEdition.js (nueva edición de un campeonato).
 * Uso: node scripts/test-new-edition.mjs
 */
import assert from 'assert/strict';
import { fileURLToPath } from 'url';
import path from 'path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const E = await import(path.join(ROOT, 'src/app/utils/newEdition.js'));
let ok = 0;
const test = (n, f) => { f(); ok++; console.log('  ✓', n); };

test('dos divisiones: la alta no sube, la baja no baja', () => {
    const { movimientoPorPosicion: m, MOVIMIENTO: M } = E;
    assert.equal(m(1, 15, 0, 2, 3, 3), M.QUEDA);
    assert.equal(m(15, 15, 0, 2, 3, 3), M.BAJA);
    assert.equal(m(13, 15, 0, 2, 3, 3), M.BAJA);
    assert.equal(m(12, 15, 0, 2, 3, 3), M.QUEDA);
    assert.equal(m(1, 15, 1, 2, 3, 3), M.SUBE);
    assert.equal(m(3, 15, 1, 2, 3, 3), M.SUBE);
    assert.equal(m(15, 15, 1, 2, 3, 3), M.QUEDA);
});
test('una sola división: nadie se mueve', () => {
    assert.equal(E.movimientoPorPosicion(1, 10, 0, 1, 3, 3), E.MOVIMIENTO.QUEDA);
});
test('planificar: los que no corrieron quedan fuera de las zonas', () => {
    const f = E.planificarMovimientos([
        { division: { id: 'z', name: 'Zeus', drivers: ['A', 'B', 'C'] }, standings: [{ name: 'B', totalPoints: 10 }, { name: 'A', totalPoints: 5 }] },
        { division: { id: 'p', name: 'Poseidon', drivers: ['D', 'E'] }, standings: [{ name: 'E', totalPoints: 8 }, { name: 'D', totalPoints: 1 }] },
    ], { promotionCount: 1, relegationCount: 1 });
    // C no corrió: fuera de las zonas; baja A, el último de los que corrieron.
    assert.deepEqual(f.map(x => [x.name, x.position, x.movement]), [
        ['B', 1, 'stay'], ['A', 2, 'down'], ['C', null, 'stay'],
        ['E', 1, 'up'], ['D', 2, 'stay'],
    ]);
    assert.equal(f.find(x => x.name === 'C').raced, false);
});
test('destino con menos divisiones en la nueva edición', () => {
    assert.equal(E.divisionDestino(1, 'up', 2), 0);
    assert.equal(E.divisionDestino(0, 'down', 2), 1);
    assert.equal(E.divisionDestino(2, 'stay', 2), 1);
    assert.equal(E.divisionDestino(0, 'up', 3), 0);
});
test('inscripción del veterano con identidad fusionada', () => {
    const regs = [{ id: 'r1', gt7Id: 'HGT_dayo21', psnId: 'dayo', email: 'x@y.z', status: 'approved', declaredCars: ['X'] }];
    const [r] = E.inscripcionesVeteranos(
        [{ name: 'HGT_Dayo21', divisionName: 'Zeus', divisionIndex: 0, position: 4, movement: 'stay' }],
        regs, { championshipIdAnterior: 'c1', canonDe: { 'hgt_dayo21': 'HGT_Dayo21' } });
    assert.equal(r.gt7Id, 'HGT_dayo21');
    assert.equal(r.status, 'pending');
    assert.equal(r.carryover.fromRegistrationId, 'r1');
    assert.equal(r.carryover.continuity, 'pending');
    assert.equal(r.declaredCars, undefined);
});
test('piloto sin inscripción: se crea con su nombre', () => {
    const [r] = E.inscripcionesVeteranos([{ name: 'Suelto', divisionIndex: 1, movement: 'up' }], [], { championshipIdAnterior: 'c1' });
    assert.equal(r.gt7Id, 'Suelto');
    assert.equal(r.carryover.fromRegistrationId, null);
});
test('tiempos: solo de quien continúa', () => {
    const t = E.tiemposVeteranos([{ driverName: 'A', time: '1:40.000' }, { driverName: 'B', time: '1:41.000' }, { driverName: 'C' }], ['a', 'C']);
    assert.deepEqual(t.map(x => x.driverName), ['A']);
    assert.equal(t[0].fromPreviousEdition, true);
});
test('divisiones base sin pilotos ni ids, reordenadas', () => {
    const d = E.divisionesBase([{ id: 'p', name: 'Poseidon', order: 5, drivers: ['x'], hour: '23:00' }, { id: 'z', name: 'Zeus', order: 2, drivers: ['y'] }]);
    assert.deepEqual(d.map(x => [x.name, x.order, x.drivers.length, x.id]), [['Zeus', 1, 0, undefined], ['Poseidon', 2, 0, undefined]]);
    assert.equal(d[1].hour, '23:00');
});
test('continuidad: respuestas y cierre', () => {
    const regs = [
        { id: 'a', gt7Id: 'A', status: 'pending', carryover: { continuity: 'pending' } },
        { id: 'b', gt7Id: 'B', status: 'pending', carryover: { continuity: 'pending' } },
        { id: 'c', gt7Id: 'C', status: 'pending', carryover: { continuity: 'pending' } },
        { id: 'n', gt7Id: 'Nuevo', status: 'approved' },
    ];
    const resp = { a: { status: 'confirmed' }, b: { status: 'declined' } };
    assert.equal(E.estadoContinuidad(regs[0], resp), 'confirmed');
    assert.equal(E.estadoContinuidad(regs[2], resp), 'pending');
    assert.equal(E.estadoContinuidad(regs[3], resp), null);
    const sin = E.sincronizarContinuidad(regs, resp);
    assert.deepEqual(sin.registrations.map(r => r.status), ['approved', 'withdrawn', 'pending', 'approved']);
    const con = E.sincronizarContinuidad(regs, resp, { cerrar: true });
    assert.deepEqual(con.cambios.caducados, ['C']);
    assert.equal(con.registrations[2].carryover.continuity, 'expired');
    // ya resuelta: no se vuelve a tocar
    const otra = E.sincronizarContinuidad(con.registrations, {}, { cerrar: true });
    assert.deepEqual(otra.cambios, { confirmados: [], rechazados: [], caducados: [] });
});
test('reparto: veteranos por movimiento, nuevos por tiempo en los huecos', () => {
    const ms = (t) => (t ? Number(t) : Infinity);
    const divs = [{ id: 'z', maxDrivers: 2 }, { id: 'p', maxDrivers: 3 }];
    const f = E.repartirNuevaEdicion(
        [{ driverName: 'Z1', divisionIndex: 0, movement: 'stay' }, { driverName: 'P1', divisionIndex: 1, movement: 'up' }, { driverName: 'Z9', divisionIndex: 0, movement: 'down' }],
        [{ driverName: 'lento', time: '90' }, { driverName: 'rapido', time: '80' }, { driverName: 'sinTiempo', time: '' }, { driverName: 'extra', time: '95' }],
        divs, ms);
    const d = Object.fromEntries(f.map(x => [x.driverName, x.divId]));
    assert.deepEqual(d, { Z1: 'z', P1: 'z', Z9: 'p', rapido: 'p', lento: 'p', sinTiempo: '', extra: '' });
});
test('reparto: veteranos que superan el cupo se marcan', () => {
    const f = E.repartirNuevaEdicion([{ driverName: 'a', divisionIndex: 0, movement: 'stay' }, { driverName: 'b', divisionIndex: 0, movement: 'stay' }], [], [{ id: 'z', maxDrivers: 1 }]);
    assert.deepEqual(f.map(x => x.excedeCupo), [false, true]);
});
console.log(`\n${ok} tests OK`);
