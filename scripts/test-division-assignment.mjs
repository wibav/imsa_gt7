/**
 * Reparto de pilotos por Pre-Qualy: los cupos de cada división mandan.
 * Uso: node scripts/test-division-assignment.mjs
 */
import { fileURLToPath } from 'url';
import path from 'path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { repartirPorPreQualy, cuposTotales } = await import(
    path.join(ROOT, 'src/app/utils/divisionAssignment.js')
);

let fallos = 0;
const ok = (cond, msg) => { console.log(`  ${cond ? '✓' : '✗'} ${msg}`); if (!cond) fallos++; };

const pilotos = n => Array.from({ length: n }, (_, i) => ({ driverName: `P${i + 1}`, time: `1:0${i}` }));
const divs = (...cupos) => cupos.map((c, i) => ({ id: `d${i + 1}`, name: `División ${i + 1}`, maxDrivers: c, order: i + 1 }));
const cuenta = (r, id) => r.filter(x => x.divId === id).length;

console.log('\nA) El caso real: 33 pilotos y 2 salas de 15');
{
    const r = repartirPorPreQualy(pilotos(33), divs(15, 15));
    ok(cuenta(r, 'd1') === 15, `División 1: ${cuenta(r, 'd1')} (antes metía 17)`);
    ok(cuenta(r, 'd2') === 15, `División 2: ${cuenta(r, 'd2')} (antes metía 16)`);
    ok(cuenta(r, '') === 3, `sin asignar: ${cuenta(r, '')}`);
    ok(r.slice(0, 15).every(x => x.divId === 'd1'), 'los 15 más rápidos van a la primera');
    ok(r.slice(30).every(x => x.divId === ''), 'los 3 últimos quedan fuera');
}

console.log('\nB) Si caben todos, el reparto se equilibra');
{
    const r = repartirPorPreQualy(pilotos(20), divs(15, 15));
    ok(cuenta(r, 'd1') === 10 && cuenta(r, 'd2') === 10, `10 y 10, no 15 y 5 (${cuenta(r, 'd1')} y ${cuenta(r, 'd2')})`);
    ok(cuenta(r, '') === 0, 'nadie fuera');
}

console.log('\nC) Cupos desiguales: no se deja a nadie fuera si queda hueco');
{
    const r = repartirPorPreQualy(pilotos(25), divs(10, 20));
    ok(cuenta(r, 'd1') === 10, `la pequeña se llena: ${cuenta(r, 'd1')}`);
    ok(cuenta(r, 'd2') === 15, `el resto entra en la grande: ${cuenta(r, 'd2')}`);
    ok(cuenta(r, '') === 0, 'nadie fuera aunque el reparto equilibrado no cuadrara');
}

console.log('\nD) Impares y bordes');
{
    const r = repartirPorPreQualy(pilotos(7), divs(15, 15));
    ok(cuenta(r, 'd1') === 4 && cuenta(r, 'd2') === 3, `4 y 3: el impar va a la de cabeza (${cuenta(r, 'd1')} y ${cuenta(r, 'd2')})`);
    ok(repartirPorPreQualy([], divs(15)).length === 0, 'sin pilotos: lista vacía');
    ok(repartirPorPreQualy(pilotos(3), []).every(x => x.divId === ''), 'sin divisiones: todos sin asignar');
    const r2 = repartirPorPreQualy(pilotos(5), divs(2));
    ok(cuenta(r2, 'd1') === 2 && cuenta(r2, '') === 3, 'una sola división llena hasta su cupo');
}

console.log('\nE) Nadie se pierde ni se duplica');
{
    for (const [n, cs] of [[33, [15, 15]], [7, [3, 3, 3]], [100, [10, 10]], [1, [15]]]) {
        const r = repartirPorPreQualy(pilotos(n), divs(...cs));
        const nombres = r.map(x => x.driverName);
        ok(r.length === n && new Set(nombres).size === n,
            `${n} pilotos en ${cs.length} div: salen ${r.length}, sin repetidos`);
        const asignados = r.filter(x => x.divId).length;
        ok(asignados === Math.min(n, cs.reduce((a, b) => a + b, 0)),
            `  asignados ${asignados} = min(${n}, ${cs.reduce((a, b) => a + b, 0)} cupos)`);
    }
}

console.log('\nF) maxDrivers ausente o inválido cae en 15');
{
    ok(cuposTotales([{}, { maxDrivers: 0 }, { maxDrivers: 'x' }]) === 45, 'cuposTotales con datos sucios');
    const r = repartirPorPreQualy(pilotos(20), [{ id: 'a' }, { id: 'b' }]);
    ok(cuenta(r, '') === 0, 'sin maxDrivers, 20 pilotos caben en 2×15');
}

console.log(`\n${fallos === 0 ? '✓ TODO CORRECTO' : `✗ ${fallos} FALLOS`}\n`);
process.exit(fallos === 0 ? 0 : 1);
