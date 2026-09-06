#!/usr/bin/env node
/**
 * Inventario de identidades de piloto.
 *
 * En este modelo no hay ids relacionales: un piloto es una CADENA, y esa
 * cadena está copiada en decenas de sitios (claves de objetos de puntos,
 * arrays de divisiones, sanciones, reclamaciones, participantes de eventos…).
 * GT7 permite cambiar el GT7 ID tres veces, así que el mismo piloto termina
 * escrito de varias formas y sus estadísticas se parten.
 *
 * Este script NO modifica nada. Solo:
 *   1. Recorre campeonatos y eventos anotando dónde aparece cada nombre.
 *   2. Agrupa los que probablemente sean la misma persona.
 *
 * Es la base del futuro fusionador: lo que aquí se lista es exactamente lo que
 * una fusión tendría que reescribir.
 *
 * Uso:
 *   node scripts/audit-pilot-identities.js [--json salida.json] [--min-score 0.8]
 */
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const jsonIdx = args.indexOf('--json');
const JSON_OUT = jsonIdx !== -1 ? args[jsonIdx + 1] : null;
const scoreIdx = args.indexOf('--min-score');
const MIN_SCORE = scoreIdx !== -1 ? parseFloat(args[scoreIdx + 1]) : 0.82;

admin.initializeApp({
    credential: admin.credential.cert(require(path.join(ROOT, 'serviceAccountKey.json'))),
});
const db = admin.firestore();

// ── Normalización ────────────────────────────────────────────────────────
// Los pilotos anteponen o posponen la etiqueta de su equipo al ID ("RRT_ZUNZU",
// "THC-FERRE", "Hgt_dayo21"), y cambian de equipo. Quitarla es lo que hace que
// "Dayo_21", "Hgt_dayo21" y "HGT_dayo21" se reconozcan como el mismo piloto.
const EQUIPO = /^(?:[a-z0-9]{2,5})[_\-.](?=.)|[_\-.](?:[a-z0-9]{2,5})$/g;

function normalizar(nombre) {
    return String(nombre || '')
        .trim()
        .toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '')   // acentos
        .replace(/\s+/g, ' ');
}

/** Núcleo del nombre: sin etiqueta de equipo ni separadores ni dígitos sueltos. */
function nucleo(nombre) {
    let n = normalizar(nombre).replace(EQUIPO, '');
    n = n.replace(/[^a-z0-9]/g, '');
    return n;
}

function levenshtein(a, b) {
    if (a === b) return 0;
    if (!a.length || !b.length) return Math.max(a.length, b.length);
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
        const fila = [i];
        for (let j = 1; j <= b.length; j++) {
            fila[j] = Math.min(
                prev[j] + 1,
                fila[j - 1] + 1,
                prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
            );
        }
        prev = fila;
    }
    return prev[b.length];
}

/** 1 = idénticos. Se compara el núcleo, no el nombre tal cual. */
function similitud(a, b) {
    const [x, y] = [nucleo(a), nucleo(b)];
    if (!x || !y) return 0;
    if (x === y) return 1;
    // Un núcleo contenido en el otro (p. ej. "dayo" dentro de "dayo21")
    if (x.length >= 4 && y.length >= 4 && (x.includes(y) || y.includes(x))) return 0.95;
    return 1 - levenshtein(x, y) / Math.max(x.length, y.length);
}

// ── Recolección ──────────────────────────────────────────────────────────
const apariciones = new Map(); // nombre exacto -> Map(ubicación -> veces)

function anotar(nombre, ubicacion) {
    const limpio = String(nombre || '').trim();
    if (!limpio) return;
    if (!apariciones.has(limpio)) apariciones.set(limpio, new Map());
    const sitios = apariciones.get(limpio);
    sitios.set(ubicacion, (sitios.get(ubicacion) || 0) + 1);
}

/** Anota las CLAVES de un objeto tipo {nombrePiloto: valor}. */
function anotarClaves(obj, ubicacion) {
    if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
        Object.keys(obj).forEach(k => anotar(k, ubicacion));
    }
}

async function recolectarCampeonatos() {
    const cs = await db.collection('championships').get();
    for (const c of cs.docs) {
        const champ = c.data();
        const base = `championships/${c.id}`;

        (champ.registrations || []).forEach(reg => {
            const entradas = Array.isArray(reg.drivers) && reg.drivers.length ? reg.drivers : [reg];
            entradas.forEach(e => {
                anotar(e.gt7Id, `${base}.registrations[].gt7Id`);
                anotar(e.psnId, `${base}.registrations[].psnId`);
                anotar(e.name, `${base}.registrations[].name`);
            });
        });
        (champ.drivers || []).forEach(d => anotar(d.name, `${base}.drivers[].name`));

        const tracks = await c.ref.collection('tracks').get();
        for (const t of tracks.docs) {
            const d = t.data();
            const tb = `${base}/tracks/${t.id}`;
            anotarClaves(d.points, `${tb}.points{}`);
            const divs = d.results?.divisions || {};
            Object.entries(divs).forEach(([divId, r]) => {
                const rb = `${tb}.results.divisions.${divId}`;
                anotarClaves(r.racePositions, `${rb}.racePositions{}`);
                anotarClaves(r.racePoints, `${rb}.racePoints{}`);
                anotarClaves(r.qualifying?.points, `${rb}.qualifying.points{}`);
                Object.values(r.qualifying?.top3 || {}).forEach(n => anotar(n, `${rb}.qualifying.top3`));
                anotar(r.fastestLap?.driver, `${rb}.fastestLap.driver`);
                anotarClaves(r.fastestLap?.points, `${rb}.fastestLap.points{}`);
            });
            // Estructura sin divisiones
            anotarClaves(d.results?.racePositions, `${tb}.results.racePositions{}`);
            anotarClaves(d.results?.racePoints, `${tb}.results.racePoints{}`);
        }

        for (const [sub, campo] of [['divisions', 'drivers[]'], ['penalties', 'driverName'], ['claims', 'reporter/accused'], ['teams', 'drivers[].name']]) {
            const q = await c.ref.collection(sub).get();
            q.docs.forEach(doc => {
                const d = doc.data();
                const u = `${base}/${sub}/${doc.id}.${campo}`;
                if (sub === 'divisions') (d.drivers || []).forEach(n => anotar(n, u));
                if (sub === 'penalties') anotar(d.driverName, u);
                if (sub === 'claims') {
                    anotar(d.reporterName, u);
                    (d.accusedNames || []).forEach(n => anotar(n, u));
                }
                if (sub === 'teams') (d.drivers || []).forEach(dr => anotar(dr.name, u));
            });
        }
    }
    return cs.size;
}

async function recolectarEventos() {
    const es = await db.collection('events').get();
    for (const e of es.docs) {
        const base = `events/${e.id}`;
        const [ps, rs, rounds] = await Promise.all([
            e.ref.collection('participants').get(),
            e.ref.collection('results').get(),
            e.ref.collection('rounds').get(),
        ]);
        ps.docs.forEach(d => {
            anotar(d.data().gt7Id, `${base}/participants.gt7Id`);
            anotar(d.data().psnId, `${base}/participants.psnId`);
        });
        rs.docs.forEach(d => {
            anotar(d.data().driverName, `${base}/results.driverName`);
            anotar(d.data().psnId, `${base}/results.psnId`);
        });
        rounds.docs.forEach(d => {
            (d.data().rooms || []).forEach(room => {
                (room.participants || []).forEach(p => {
                    anotar(p.gt7Id, `${base}/rounds.rooms[].participants[].gt7Id`);
                    anotar(p.psnId, `${base}/rounds.rooms[].participants[].psnId`);
                });
            });
        });
        // Estructura vieja: participantes en el propio documento
        (e.data().participants || []).forEach(p => {
            if (typeof p === 'string') anotar(p, `${base}.participants[]`);
            else {
                anotar(p.gt7Id, `${base}.participants[].gt7Id`);
                anotar(p.psnId, `${base}.participants[].psnId`);
            }
        });
    }
    return es.size;
}

// ── Agrupación ───────────────────────────────────────────────────────────
function agrupar(nombres) {
    const grupos = [];
    const asignado = new Set();

    nombres.forEach(a => {
        if (asignado.has(a)) return;
        const grupo = [a];
        asignado.add(a);
        nombres.forEach(b => {
            if (asignado.has(b)) return;
            if (grupo.some(g => similitud(g, b) >= MIN_SCORE)) {
                grupo.push(b);
                asignado.add(b);
            }
        });
        if (grupo.length > 1) grupos.push(grupo);
    });

    return grupos;
}

(async () => {
    console.log('Recorriendo campeonatos…');
    const nChamps = await recolectarCampeonatos();
    console.log('Recorriendo eventos…');
    const nEventos = await recolectarEventos();

    const nombres = [...apariciones.keys()];
    const veces = (n) => [...apariciones.get(n).values()].reduce((a, b) => a + b, 0);
    const sitios = (n) => apariciones.get(n).size;

    console.log(`\n${nChamps} campeonatos, ${nEventos} eventos`);
    console.log(`${nombres.length} nombres distintos`);
    console.log(`${nombres.reduce((a, n) => a + veces(n), 0)} apariciones en total`);
    console.log(`${new Set(nombres.flatMap(n => [...apariciones.get(n).keys()])).size} ubicaciones distintas donde vive un nombre\n`);

    const grupos = agrupar(nombres).sort((a, b) => b.length - a.length);
    console.log(`${grupos.length} grupos de posible mismo piloto (umbral ${MIN_SCORE}):\n`);
    grupos.forEach(g => {
        console.log(`  ── núcleo "${nucleo(g[0])}"`);
        g.sort((a, b) => veces(b) - veces(a)).forEach(n => {
            console.log(`     ${String(veces(n)).padStart(4)} apariciones en ${String(sitios(n)).padStart(3)} sitios   ${n}`);
        });
    });

    if (JSON_OUT) {
        const salida = {
            generado: new Date().toISOString(),
            minScore: MIN_SCORE,
            nombres: Object.fromEntries(
                nombres.map(n => [n, { total: veces(n), ubicaciones: Object.fromEntries(apariciones.get(n)) }])
            ),
            grupos,
        };
        fs.writeFileSync(JSON_OUT, JSON.stringify(salida, null, 2));
        console.log(`\nInforme JSON: ${JSON_OUT}`);
    }
    process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
