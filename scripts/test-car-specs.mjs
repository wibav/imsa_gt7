/**
 * Ficha técnica con BoP. Se prueba contra los datos TAL COMO VUELVEN DE
 * FIRESTORE, no contra el JSON del script de sincronización: la primera
 * versión pasaba con el JSON y fallaba en producción porque Firestore no
 * conserva el orden de las claves de un objeto.
 *
 * Uso: node scripts/test-car-specs.mjs
 */
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const admin = require(path.join(ROOT, 'node_modules/firebase-admin'));
admin.initializeApp({ credential: admin.credential.cert(require(path.join(ROOT, 'serviceAccountKey.json'))) });

const { bopVariaPorCircuito, cochesQueVarian, filasFichaTecnica, filtrarPorNombre, resolverCoche } =
    await import(path.join(ROOT, 'src/app/utils/carSpecs.js'));

let fallos = 0;
const ok = (c, m) => { console.log(`  ${c ? '✓' : '✗'} ${m}`); if (!c) fallos++; };

const cars = (await admin.firestore().collection('cars').get()).docs.map(d => ({ id: d.id, ...d.data() }));
const deClase = (cl) => cars.filter(c => c.carClass === cl && c.bop);

console.log('\nA) Cuántos coches cambian según el circuito, con datos de Firestore');
const esperado = { 'Gr.1': 0, 'Gr.4': 16 };
for (const [clase, n] of Object.entries(esperado)) {
    const lista = deClase(clase);
    ok(cochesQueVarian(lista) === n, `${clase}: ${cochesQueVarian(lista)} de ${lista.length} (esperado ${n})`);
}
ok(bopVariaPorCircuito(deClase('Gr.1')) === false, 'Gr.1: el selector de circuito NO aparece');
ok(bopVariaPorCircuito(deClase('Gr.4')) === true, 'Gr.4: el selector sí aparece');

console.log('\nB) El orden de las claves no afecta');
{
    const a = { id: 'x', bop: { rapido: { pp: 1, cv: 2, kg: 3 }, medio: { kg: 3, pp: 1, cv: 2 }, lento: { cv: 2, kg: 3, pp: 1 } } };
    ok(cochesQueVarian([a]) === 0, 'mismos valores con las claves desordenadas: no cuenta como cambio');
    const b = { id: 'y', bop: { rapido: { pp: 1, cv: 2, kg: 3 }, medio: { pp: 1, cv: 2, kg: 4 }, lento: { pp: 1, cv: 2, kg: 3 } } };
    ok(cochesQueVarian([b]) === 1, 'un kilo de diferencia sí cuenta');
}

console.log('\nC) Solo cuenta lo que se ve en la tabla');
{
    const c = { id: 'z', bop: {
        rapido: { pp: 1, cv: 2, kg: 3, s400: 13.5 },
        medio:  { pp: 1, cv: 2, kg: 3, s400: 13.9 },
        lento:  { pp: 1, cv: 2, kg: 3, s400: 14.1 },
    } };
    ok(cochesQueVarian([c]) === 0, 'si solo cambia la aceleración (que no se muestra), no se dice que cambia');
}

console.log('\nD) Los 6 coches del Verano encuentran su ficha');
const verano = ["Toyota GR010 HYBRID '21", 'Ferrari 499P', 'Porsche 963', 'BMW M Hybrid V8', 'Peugeot 9X8', "Audi R18 TDI '11"];
ok(verano.every(n => resolverCoche(n, cars)?.bop), verano.filter(n => !resolverCoche(n, cars)?.bop).join(', ') || 'los 6 con BoP');

console.log('\nE) Tabla: orden, búsqueda y el mejor');
{
    const { filas, mejores } = filasFichaTecnica(deClase('Gr.4'), 'medio');
    ok(filas.length === 34, `34 filas (${filas.length})`);
    const nombres = filas.map(f => f.nombre);
    ok(nombres.every((n, i) => i === 0 || nombres[i - 1].localeCompare(n, 'es', { sensitivity: 'base' }) <= 0), 'orden alfabético');
    ok(filtrarPorNombre(filas, 'megane').length >= 1, 'buscar "megane" encuentra Mégane');
    ok(filtrarPorNombre(filas, 'megane').every(f => f.pp <= mejores.pp), 'el mejor no se recalcula al filtrar');
}

console.log(`\n${fallos === 0 ? '✓ TODO CORRECTO' : `✗ ${fallos} FALLOS`}\n`);
process.exit(fallos === 0 ? 0 : 1);
