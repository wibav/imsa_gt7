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
//
// Deliberadamente GENÉRICA. La primera versión enumeraba las rutas a mano y se
// dejó fuera media docena: la lista de espera de los eventos, la subcolección
// `events` dentro de los campeonatos, `carsUsed{}`, los resultados de la
// Pre-Qualy y los de cada sala. Enumerar a mano un modelo sin esquema es
// garantía de olvidarse de algo, así que ahora se recorre todo el árbol y se
// reconoce a un piloto por la FORMA del dato, no por su ruta.

const apariciones = new Map(); // nombre exacto -> Map(ubicación -> veces)

function anotar(nombre, ubicacion) {
    const limpio = String(nombre || '').trim();
    if (!limpio) return;
    // `points{}` unas veces va indexado por piloto (en un track) y otras por
    // número de ronda (dentro de un piloto de equipo: {"1": 9, "2": 15, …}).
    // Ningún GT7 ID es solo dígitos, así que eso los separa.
    if (/^\d+$/.test(limpio)) return;
    apariciones.has(limpio) || apariciones.set(limpio, new Map());
    const sitios = apariciones.get(limpio);
    sitios.set(ubicacion, (sitios.get(ubicacion) || 0) + 1);
}

/** Objetos cuyas CLAVES son nombres de piloto: {"MR-Tony": 18, …} */
const CLAVES_SON_PILOTOS = new Set(['points', 'racePoints', 'racePositions', 'carsUsed']);

/** Campos que contienen directamente un identificador de piloto. */
const CAMPOS_PILOTO = ['gt7Id', 'psnId', 'driverName', 'reporterName', 'driver'];

/** Campos de personas que no compiten pero sí son personas de la liga. */
const CAMPOS_ROL = ['casterName', 'hostName', 'caster', 'host'];

/** ¿Este objeto describe a un piloto concreto? */
function esEntradaDePiloto(obj) {
    return CAMPOS_PILOTO.some(c => typeof obj[c] === 'string' && obj[c].trim());
}

function recorrer(valor, ruta) {
    if (Array.isArray(valor)) {
        valor.forEach(v => recorrer(v, `${ruta}[]`));
        return;
    }
    if (!valor || typeof valor !== 'object' || valor.toDate) return;

    if (esEntradaDePiloto(valor)) {
        CAMPOS_PILOTO.forEach(campo => {
            if (typeof valor[campo] === 'string') anotar(valor[campo], `${ruta}.${campo}`);
        });
        // `name` solo se toma junto a un gt7Id/psnId (inscripciones y
        // participantes). En una sanción, `name` es el nombre del preset
        // ("Contacto Mayor"), no un piloto.
        const esInscripcion = ['gt7Id', 'psnId'].some(c => typeof valor[c] === 'string' && valor[c].trim());
        if (esInscripcion && typeof valor.name === 'string') anotar(valor.name, `${ruta}.name`);
    }

    Object.entries(valor).forEach(([clave, hijo]) => {
        if (CLAVES_SON_PILOTOS.has(clave) && hijo && typeof hijo === 'object' && !Array.isArray(hijo)) {
            Object.keys(hijo).forEach(k => anotar(k, `${ruta}.${clave}{}`));
        }
        if (CAMPOS_PILOTO.includes(clave) && !esEntradaDePiloto(valor) && typeof hijo === 'string') {
            anotar(hijo, `${ruta}.${clave}`);
        }
        if (CAMPOS_ROL.includes(clave) && typeof hijo === 'string') {
            anotar(hijo, `${ruta}.${clave}`);
        }
        // Arrays de nombres sueltos: divisions.drivers[], claims.accusedNames[]
        if ((clave === 'drivers' || clave === 'accusedNames' || clave === 'participants') && Array.isArray(hijo)) {
            hijo.forEach(x => { if (typeof x === 'string') anotar(x, `${ruta}.${clave}[]`); });
        }
        // Objetos de equipo: {drivers: [{name, points}]} — sin gt7Id ni psnId
        if (clave === 'drivers' && Array.isArray(hijo)) {
            hijo.forEach(x => {
                if (x && typeof x === 'object' && typeof x.name === 'string' && !esEntradaDePiloto(x)) {
                    anotar(x.name, `${ruta}.drivers[].name`);
                }
            });
        }
        // top3: {first, second, third} con nombres
        if (clave === 'top3' && hijo && typeof hijo === 'object') {
            Object.values(hijo).forEach(n => { if (typeof n === 'string') anotar(n, `${ruta}.top3`); });
        }
        recorrer(hijo, `${ruta}.${clave}`);
    });
}

/** Recorre una colección y todas sus subcolecciones, sin listarlas a mano. */
async function recorrerColeccion(colRef, base, stats) {
    const snap = await colRef.get();
    stats.docs += snap.size;
    for (const doc of snap.docs) {
        recorrer(doc.data(), base);
        for (const sub of await doc.ref.listCollections()) {
            await recorrerColeccion(sub, `${base}/${sub.id}/*`, stats);
        }
    }
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
    const stats = { docs: 0 };
    console.log('Recorriendo campeonatos…');
    await recorrerColeccion(db.collection('championships'), 'championships/*', stats);
    const nChamps = (await db.collection('championships').get()).size;
    console.log('Recorriendo eventos…');
    await recorrerColeccion(db.collection('events'), 'events/*', stats);
    const nEventos = (await db.collection('events').get()).size;

    const nombres = [...apariciones.keys()];
    const veces = (n) => [...apariciones.get(n).values()].reduce((a, b) => a + b, 0);
    const sitios = (n) => apariciones.get(n).size;

    console.log(`\n${nChamps} campeonatos, ${nEventos} eventos (${stats.docs} documentos recorridos)`);
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
