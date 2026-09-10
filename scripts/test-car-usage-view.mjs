/**
 * Vista de uso de autos del lado piloto. Se prueba con los datos reales del
 * Campeonato de Verano, que es el que motivó la pantalla.
 * Uso: node scripts/test-car-usage-view.mjs
 */
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const admin = require(path.join(ROOT, 'node_modules/firebase-admin'));
admin.initializeApp({ credential: admin.credential.cert(require(path.join(ROOT, 'serviceAccountKey.json'))) });
const db = admin.firestore();

const { construirUsoDeAutos } = await import(path.join(ROOT, 'src/app/utils/carUsageCalculator.js'));

let fallos = 0;
const ok = (c, m) => { console.log(`  ${c ? '✓' : '✗'} ${m}`); if (!c) fallos++; };

const cs = await db.collection('championships').get();
const doc = cs.docs.find(d => /Verano/i.test(d.data().name));
const champ = doc.data();
const tracks = (await doc.ref.collection('tracks').get()).docs.map(d => ({ id: d.id, ...d.data() }));
const inscritos = (champ.registrations || []).map(r => r.gt7Id || r.name || r.psnId).filter(Boolean);

console.log(`\nA) Datos reales: ${champ.name}`);
const r = construirUsoDeAutos(tracks, champ.carUsageTracking, inscritos);
ok(r.carreras.length === 6, `${r.carreras.length} carreras con autos registrados`);
ok(r.filas.length > 0, `${r.filas.length} pilotos`);
ok(r.esFijo && r.maxUsos === 1, `modo fijo, máx ${r.maxUsos} uso por auto`);

const conTodo = r.filas.filter(f => f.usos.length === 6);
console.log(`     ${conTodo.length} pilotos han usado los 6 autos del catálogo`);
const ejemplo = r.filas[0];
console.log(`     ejemplo — ${ejemplo.piloto}: ${ejemplo.usos.length} autos usados, le quedan ${ejemplo.usosRestantes}`);
ok(ejemplo.usos.length + ejemplo.disponibles.length === 6 || ejemplo.usos.some(u => u.excedido),
    'usados + disponibles cuadran con el catálogo de 6');

console.log('\nB) Nadie cuenta dos veces la misma carrera');
{
    // Dos alias del mismo piloto en la misma carrera sin fusionar.
    const t = [{ id: 't1', round: 1, carsUsed: { 'Dayo': 'Ferrari 499P', 'HGT_dayo21': 'Ferrari 499P' } }];
    const res = construirUsoDeAutos(t, { mode: 'fixed', maxUsesPerCar: 1, carCatalog: ['Ferrari 499P'] }, [],
        n => (n === 'Dayo' ? 'HGT_dayo21' : n));
    const fila = res.filas[0];
    ok(res.filas.length === 1, 'los dos alias son un solo piloto');
    ok(fila.usos[0].veces === 1, `el auto cuenta 1 uso, no 2 (cuenta ${fila.usos[0].veces})`);
}

console.log('\nC) Se detecta pasarse del límite');
{
    const t = [
        { id: 't1', round: 1, carsUsed: { P1: 'Ferrari 499P' } },
        { id: 't2', round: 2, carsUsed: { P1: 'Ferrari 499P' } },
    ];
    const res = construirUsoDeAutos(t, { mode: 'fixed', maxUsesPerCar: 1, carCatalog: ['Ferrari 499P'] }, ['P1']);
    ok(res.filas[0].avisos.length === 1, `avisa del exceso: ${res.filas[0].avisos[0] || '(ninguno)'}`);
    ok(res.filas[0].usosRestantes === 0, 'sin usos restantes');
}

console.log('\nD) Un piloto inscrito que aún no ha corrido aparece igualmente');
{
    const res = construirUsoDeAutos([], { mode: 'fixed', maxUsesPerCar: 2, carCatalog: ['A', 'B'] }, ['Nuevo']);
    ok(res.filas.length === 1 && res.filas[0].usos.length === 0, 'sale con 0 usos');
    ok(res.filas[0].usosRestantes === 4, `y con sus 4 usos disponibles (${res.filas[0].usosRestantes})`);
}

console.log('\nE) Modo declaración: no se inventan disponibles del catálogo');
{
    const res = construirUsoDeAutos(
        [{ id: 't1', round: 1, carsUsed: { P1: 'Elantra' } }],
        { mode: 'free', maxUsesPerCar: 4, carCatalog: ['A', 'B', 'C'] }, ['P1']
    );
    ok(res.filas[0].disponibles.length === 0, 'el catálogo no son sus autos disponibles');
    ok(res.filas[0].usos[0].veces === 1, 'pero sí se cuenta lo que usó');
}

console.log(`\n${fallos === 0 ? '✓ TODO CORRECTO' : `✗ ${fallos} FALLOS`}\n`);
process.exit(fallos === 0 ? 0 : 1);
