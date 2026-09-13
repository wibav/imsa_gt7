/**
 * Inventario de siglas de equipo en los GT7 ID (fase 0 de docs/PLAN_EQUIPOS.md).
 *
 * NO modifica nada. Recorre las mismas fuentes que /pilotsAdmin (inscripciones,
 * clasificaciones de cada carrera, resultados por sala, eventos), resuelve cada
 * nombre a su GT7 ID unificado y lista:
 *   1. Las siglas que llevan al menos dos pilotos distintos, con la fecha de
 *      primera y última carrera en que aparece cada uno con ellas.
 *   2. Los pilotos que han corrido con siglas distintas: pista de un cambio de
 *      equipo. Solo pista: quien no cambia su GT7 ID no deja rastro.
 *
 * Uso:
 *   node scripts/audit-team-tags.mjs [--json salida.json]
 */
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const admin = require(path.join(ROOT, 'node_modules/firebase-admin'));
admin.initializeApp({ credential: admin.credential.cert(require(path.join(ROOT, 'serviceAccountKey.json'))) });
const db = admin.firestore();

const { extraerSiglas, sugerirEquipos } = await import(path.join(ROOT, 'src/app/utils/teamTagMatcher.js'));
const { buildGt7IdMap } = await import(path.join(ROOT, 'src/app/utils/championshipUtils.js'));

const args = process.argv.slice(2);
const JSON_OUT = args.includes('--json') ? args[args.indexOf('--json') + 1] : null;

const apariciones = {};      // nombre → veces
const fechas = {};           // nombre → [fechas]
const anotar = (nombre, fecha) => {
    const n = String(nombre || '').trim();
    if (!n || /^\d+$/.test(n)) return;
    apariciones[n] = (apariciones[n] || 0) + 1;
    if (fecha) (fechas[n] ||= []).push(fecha);
};

const champs = (await db.collection('championships').get()).docs.map(d => ({ id: d.id, ...d.data() }));
for (const champ of champs) {
    (champ.registrations || []).forEach(reg => {
        const entradas = Array.isArray(reg.drivers) && reg.drivers.length ? reg.drivers : [reg];
        entradas.forEach(e => [e.gt7Id, e.psnId, e.name].forEach(n => anotar(n)));
    });
    const tracks = (await db.collection('championships').doc(champ.id).collection('tracks').get()).docs.map(d => d.data());
    tracks.forEach(t => {
        Object.keys(t.points || {}).forEach(n => anotar(n, t.date));
        Object.values(t.results?.divisions || {}).forEach(div => {
            Object.keys(div?.racePositions || {}).forEach(n => anotar(n, t.date));
        });
    });
}
const eventos = (await db.collection('events').get()).docs.map(d => d.data());
eventos.forEach(ev => {
    (ev.participants || []).forEach(p => [p.gt7Id, p.psnId, p.name].forEach(n => anotar(n, ev.date)));
    (ev.results || []).forEach(r => anotar(r.driverName, ev.date));
});

const identities = (await db.collection('pilotIdentities').get()).docs.map(d => d.data());
const resolver = buildGt7IdMap(champs, identities);
const nombres = Object.keys(apariciones);

const rango = (ns) => {
    const fs_ = ns.flatMap(n => fechas[n] || []).filter(Boolean).sort();
    return fs_.length ? `${fs_[0]} → ${fs_[fs_.length - 1]}` : 'sin carreras con fecha';
};

const sugeridos = sugerirEquipos(nombres, { resolver, apariciones });
console.log(`${champs.length} campeonatos, ${eventos.length} eventos, ${nombres.length} nombres, ${identities.length} fusiones\n`);
console.log(`${sugeridos.length} siglas con 2 o más pilotos:\n`);
sugeridos.forEach(g => {
    console.log(`  ${g.tag.padEnd(6)} ${g.pilotos.length} pilotos · variantes ${g.variantes.join(', ')}`);
    g.pilotos.forEach(p => console.log(`         ${p.pilot.padEnd(24)} ${rango(p.nombres).padEnd(26)} ${p.nombres.length > 1 ? p.nombres.join(' · ') : ''}`));
});

// Pilotos con más de unas siglas a lo largo del tiempo
const siglasPorPiloto = {};
nombres.forEach(n => {
    const s = extraerSiglas(n);
    if (!s) return;
    const pilot = resolver[n] || n;
    (siglasPorPiloto[pilot] ||= new Map());
    const m = siglasPorPiloto[pilot];
    m.set(s.tag, [...(m.get(s.tag) || []), n]);
});
const cambios = Object.entries(siglasPorPiloto).filter(([, m]) => m.size > 1);
console.log(`\n${cambios.length} pilotos (ya fusionados) que han corrido con siglas distintas:`);
cambios.forEach(([pilot, m]) => {
    console.log(`  ${pilot}: ${[...m.entries()].map(([tag, ns]) => `${tag} (${rango(ns)})`).join('  →  ')}`);
});

// Mismo "resto" con siglas distintas y SIN fusionar: posible cambio de equipo
// que Identidad de pilotos aún no ha unificado.
const porResto = {};
nombres.forEach(n => {
    const s = extraerSiglas(n);
    if (!s) return;
    const k = s.resto.toLowerCase().replace(/[^a-z0-9]/g, '');
    (porResto[k] ||= new Set()).add(resolver[n] || n);
});
const sinFusionar = Object.entries(porResto).filter(([, ps]) => {
    const tags = new Set([...ps].map(p => extraerSiglas(p)?.tag).filter(Boolean));
    return ps.size > 1 && tags.size > 1;
});
console.log(`\n${sinFusionar.length} nombres iguales con siglas distintas, sin fusionar (revisar en Identidad de pilotos):`);
sinFusionar.forEach(([, ps]) => console.log(`  ${[...ps].map(p => `${p} (${rango([p])})`).join('  ·  ')}`));

if (JSON_OUT) {
    fs.writeFileSync(JSON_OUT, JSON.stringify({ generado: new Date().toISOString(), sugeridos, cambios: cambios.map(([p, m]) => [p, Object.fromEntries(m)]) }, null, 2));
    console.log(`\nInforme JSON: ${JSON_OUT}`);
}
process.exit(0);
