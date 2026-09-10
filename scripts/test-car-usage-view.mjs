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

console.log('\nF) El roster: solo salas y quien ya corrió');
{
    // Regla de la pantalla: pilotos de alguna división + los que tienen puntos.
    const roster = (divisions, tracks) => {
        const n = new Set();
        divisions.forEach(d => (d.drivers || []).forEach(x => x && n.add(x)));
        tracks.forEach(t => Object.keys(t.points || {}).forEach(x => x && n.add(x)));
        return [...n];
    };

    // Caso GR.4: 33 inscritos, ninguna sala repartida, ninguna carrera corrida.
    const vacio = construirUsoDeAutos([], { mode: 'free', maxUsesPerCar: 4 }, roster([{ drivers: [] }], []));
    ok(vacio.filas.length === 0, 'sin salas ni carreras: no se lista a nadie (antes salían los 33 inscritos)');

    // Un piloto con sala aparece aunque no haya corrido: le quedan todos sus usos.
    const conSala = construirUsoDeAutos([], { mode: 'fixed', maxUsesPerCar: 1, carCatalog: ['A', 'B'] },
        roster([{ drivers: ['P1'] }], []));
    ok(conSala.filas.length === 1 && conSala.filas[0].usosRestantes === 2, 'con sala y sin correr: sale con sus usos intactos');

    // Y quien corrió sin estar en ninguna sala también: está clasificado.
    const corrio = construirUsoDeAutos(
        [{ id: 't1', round: 1, points: { P2: 25 }, carsUsed: { P2: 'A' } }],
        { mode: 'fixed', maxUsesPerCar: 1, carCatalog: ['A', 'B'] },
        roster([], [{ points: { P2: 25 } }])
    );
    ok(corrio.filas.some(f => f.piloto === 'P2'), 'sin sala pero con puntos: sí sale');
}

console.log('\nG) Datos reales: el Verano no pierde a nadie');
{
    const divs = (await doc.ref.collection('divisions').get()).docs.map(d => d.data());
    const enSala = new Set(divs.flatMap(d => d.drivers || []));
    const conPuntos = new Set(tracks.flatMap(t => Object.keys(t.points || {})));
    const rosterReal = [...new Set([...enSala, ...conPuntos])];
    // Ojo: en crudo el roster son 45 nombres, no 30. Las divisiones guardan el
    // PSN ID de unos pilotos y los puntos el GT7 ID de otros, así que hay que
    // normalizar con el mismo mapa que usa la pantalla o el mismo piloto sale
    // dos veces.
    const { buildGt7IdMap } = await import(path.join(ROOT, 'src/app/utils/championshipUtils.js'));
    const identidades = (await db.collection('pilotIdentities').get()).docs.map(d => d.data());
    const mapa = buildGt7IdMap(champ, identidades);
    const res = construirUsoDeAutos(tracks, champ.carUsageTracking, rosterReal, n => mapa[n] || n);
    console.log(`     roster en crudo: ${rosterReal.length} nombres → ${res.filas.length} pilotos tras normalizar`);
    ok(res.filas.length < rosterReal.length * 0.8, 'el mapa colapsa los alias (45 → ~30)');
    ok(new Set(res.filas.map(f => f.piloto)).size === res.filas.length, 'ninguna fila repetida');
    ok(res.filas.every(f => f.piloto), 'ninguna fila sin nombre');

    // Informativo: quién tiene sala pero todavía no ha puntuado. Puede ser
    // simplemente que no haya corrido —es el caso de ULR-Tony, un piloto
    // distinto de MR-Tony pese a lo que sugiera el parecido— o que su nombre
    // en la división no coincida con el de los resultados. La pantalla lo
    // muestra igual, con todos sus usos disponibles.
    const canon = n => mapa[n] || n;
    const soloSala = [...new Set(divs.flatMap(d => d.drivers || []).map(canon))]
        .filter(n => !new Set(tracks.flatMap(t => Object.keys(t.points || {})).map(canon)).has(n));
    if (soloSala.length > 0) {
        console.log(`     con sala y aún sin puntuar: ${soloSala.join(', ')}`);
    }
}

console.log(`\n${fallos === 0 ? '✓ TODO CORRECTO' : `✗ ${fallos} FALLOS`}\n`);
process.exit(fallos === 0 ? 0 : 1);
