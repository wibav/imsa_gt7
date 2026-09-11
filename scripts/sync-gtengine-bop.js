#!/usr/bin/env node
/**
 * Sincroniza las fichas técnicas con BoP de GT Engine (gt-engine.com) sobre el
 * catálogo de coches (`cars`).
 *
 * El catálogo que se sincroniza desde gran-turismo.com trae los datos de SERIE.
 * En las carreras de la liga el BoP está activado, así que la potencia y el
 * peso que se corren son otros, y además cambian con cada actualización del
 * juego. GT Engine publica las tres configuraciones de BoP del juego —circuito
 * rápido, medio y lento— para Gr.1, Gr.2, Gr.3 y Gr.4.
 *
 * Por defecto NO escribe nada: saca un informe y un JSON con lo emparejado.
 *
 * Uso:
 *   node scripts/sync-gtengine-bop.js                 # simulación
 *   node scripts/sync-gtengine-bop.js --json out.json # simulación + volcado
 *   node scripts/sync-gtengine-bop.js --write         # escribe en Firestore
 */
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const ESCRIBIR = args.includes('--write');
const jsonIdx = args.indexOf('--json');
const JSON_OUT = jsonIdx !== -1 ? args[jsonIdx + 1] : null;

const CLASES = { gr1: 'Gr.1', gr2: 'Gr.2', gr3: 'Gr.3', gr4: 'Gr.4' };
// Cada configuración de BoP tiene su tabla con id propio. NO se localizan por
// posición: el número de tablas cambia de una clase a otra —Gr.1 no tiene
// tabla de cambios para la configuración lenta— y contando posiciones la
// "tabla lenta" de Gr.1 resultaba ser una de diferencias, con la potencia
// vacía en todos los coches.
const CONFIGS = [['rapido', 'spec_table_h'], ['medio', 'spec_table_m'], ['lento', 'spec_table_l']];

function tablaPorId(html, id) {
    const i = html.indexOf(`id="${id}"`);
    if (i === -1) return '';
    const inicio = html.lastIndexOf('<table', i);
    const fin = html.indexOf('</table>', i);
    return inicio === -1 || fin === -1 ? '' : html.slice(inicio, fin + 8);
}

// ── Parseo ───────────────────────────────────────────────────────────────

const decodificar = (s) => s
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&nbsp;/g, ' ');
const limpia = (x) => decodificar(String(x).replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
const num = (x) => {
    const n = parseFloat(String(x).replace(/,/g, ''));
    return Number.isFinite(n) ? n : null;
};

/**
 * Nombres de columna expandidos según su colspan.
 *
 * En Gr.1 la potencia ocupa dos columnas —motor térmico e híbrido— y sin
 * expandir el colspan todo lo que va detrás se desplaza uno: el par se leía
 * como peso y el Alpine VGT salía con 54,9 kg. Las columnas que abarcan un
 * grupo (Aceleración, Estabilidad…) toman el nombre de la segunda fila.
 */
function columnas(tabla) {
    const thead = (tabla.match(/<thead[\s\S]*?<\/thead>/) || [''])[0];
    const filas = thead.match(/<tr[\s\S]*?<\/tr>/g) || [];
    const celdas = (fila) => [...fila.matchAll(/<th([^>]*)>([\s\S]*?)<\/th>/g)].map(m => ({
        texto: limpia(m[2]),
        span: parseInt((m[1].match(/colspan=["']?(\d+)/) || [])[1] || '1', 10),
    }));
    const primera = celdas(filas[0] || '');
    const sub = celdas(filas[1] || '').map(c => c.texto);
    let s = 0;
    const out = [];
    primera.forEach(({ texto, span }) => {
        if (span === 1) { out.push(texto); return; }
        // Grupo con subcolumnas en la fila 2 (Acceleration×3): usa sus nombres.
        if (/Acceleration|Stability|Rotational/i.test(texto)) {
            for (let k = 0; k < span; k++) out.push(sub[s++] || `${texto}#${k}`);
        } else {
            // Mismo dato partido en dos (ICE / Hyb.): el primero es el principal.
            out.push(texto);
            for (let k = 1; k < span; k++) out.push(`${texto}#${k}`);
        }
    });
    return out;
}

function leerTabla(tabla) {
    const cols = columnas(tabla);
    const idx = (re) => cols.findIndex(c => re.test(c));
    const iFab = idx(/^Manufac/);
    const iTrac = idx(/^Pt\.?\s?Lyt/);
    const iPP = idx(/^PP$/);
    const iCV = idx(/Max\.?\s?(Pwr|Power)\.?\s?\[PS\]$/);
    const iPar = idx(/Max\.?\s?(Trq|Torque)\.?\s?\[kgfm\]/);
    const iKg = idx(/^Wt\.\[kg\]$/);
    const iBal = idx(/Bal\.?$/);
    const i400 = idx(/^0-400m/);
    const i1000 = idx(/^0-1000m/);
    const i100 = idx(/^100-150/);

    const coches = [];
    for (const fila of tabla.match(/<tr[\s\S]*?<\/tr>/g) || []) {
        if (!fila.includes('<td')) continue;
        const td = [...fila.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(m => limpia(m[1]));
        const fab = td[iFab];
        // Filas de promedio y separadores: no son coches.
        if (!fab || fab === '-' || /average/i.test(td.join(' '))) continue;
        // La sección de detalle repite el fabricante y lleva detrás el nombre
        // completo ("155 2.5 V6 TI '93"), que es el que casa con el catálogo.
        const j = td.findIndex((v, k) => k > iFab + 1 && v === fab);
        if (j === -1 || !td[j + 1]) continue;
        coches.push({
            fabricante: fab,
            nombre: td[j + 1],
            traccion: td[iTrac] || null,
            pp: num(td[iPP]),
            cv: num(td[iCV]),
            parKgfm: num(td[iPar]),
            kg: num(td[iKg]),
            reparto: td[iBal] || null,
            s400: num(td[i400]),
            s1000: num(td[i1000]),
            s100a150: num(td[i100]),
        });
    }
    return coches;
}

async function descargar(clase) {
    const url = `https://gt-engine.com/gt7/cars/${clase}/${clase}-01-specs.html`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (GT7 Championships sync)' } });
    if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
    const html = await res.text();
    // La sección de cambios dice "1.70 (2026-06-11) → 1.71 (2026-08-20)". La
    // versión vigente es el destino de esas flechas. Buscar el "1.xx" más alto
    // de toda la página no vale: coge decimales de ratios y daba "1.99".
    // En el HTML van entidades y etiquetas entre medias
    // ("1.70&nbsp;(2026-06-11)&ensp;&rarr;&ensp;</span><b>1.71&nbsp;(…)"),
    // así que se busca sobre el texto ya limpio.
    const texto = html.replace(/<[^>]+>/g, ' ')
        .replace(/&(?:nbsp|ensp|emsp|thinsp);/g, ' ').replace(/&rarr;/g, '→').replace(/\s+/g, ' ');
    const saltos = [...texto.matchAll(/(\d+\.\d{2}) \((\d{4}-\d{2}-\d{2})\) ?→ ?(\d+\.\d{2}) \((\d{4}-\d{2}-\d{2})\)/g)]
        .map(m => [m[0], m[1], m[3], m[4]]);
    const ultimo = saltos.map(m => ({ v: m[2], fecha: m[3] })).sort((a, b) => b.fecha.localeCompare(a.fecha))[0];
    const version = ultimo?.v || null;
    return { html, version };
}

// ── Emparejado con el catálogo ───────────────────────────────────────────

const base = (s) => String(s || '').toLowerCase().normalize('NFD')
    .replace(/[̀-ͯ]/g, '').replace(/[’`´]/g, "'").replace(/\s+/g, ' ').trim();

/** Abreviaturas de GT Engine expandidas a como escribe el nombre el juego. */
function expandir(fab, nombre) {
    let n = `${fab} ${nombre}`;
    n = n.replace(/^(\S+) \1 /i, '$1 ');                         // "Alpine Alpine VGT"
    n = n.replace(/\bVGT\b/g, 'Vision Gran Turismo');
    n = n.replace(/Vision Gran Turismo '(\d\d)\b/, (m, a) => `Vision Gran Turismo 20${a}`);
    n = n.replace(/^Mercedes /, 'Mercedes-Benz ').replace(/^AMG /, 'Mercedes-Benz ');
    return n;
}

const palabras = (s) => new Set(base(s).replace(/[^a-z0-9' ]/g, ' ').split(/\s+/).filter(t => t.length > 1));

/**
 * Casan si TODAS las palabras de uno están en el otro.
 *
 * Se descartó la similitud por proporción de palabras compartidas porque daba
 * "BMW M3 GT3 '11" ≈ "BMW Z4 GT3 '11": comparten tres de cuatro palabras y son
 * coches distintos. Con el criterio de contención, "m3" no está en el otro y
 * se rechaza, mientras "Renault Mégane Gr.4" sí entra en "Renault Sport
 * Mégane Gr.4".
 */
function contenido(a, b) {
    const A = palabras(a), B = palabras(b);
    const [menor, mayor] = A.size <= B.size ? [A, B] : [B, A];
    return menor.size >= 2 && [...menor].every(t => mayor.has(t));
}

/**
 * Emparejado manual para lo que ninguna regla resuelve. Se añade aquí en vez
 * de relajar las reglas, que es como se cuelan los falsos positivos.
 */
const ALIAS = {
    'McLaren VGT (Gr.1)': 'McLaren Ultimate Vision Gran Turismo (Gr.1)',
};

function emparejar(cochesGte, catalogo, clase) {
    const pool = catalogo.filter(c => c.carClass === CLASES[clase]);
    const asignado = new Map();     // id catálogo → nombre GT Engine
    const resultado = [];
    const pendientes = [];

    // Primera pasada: exactos y alias. Ganan siempre sobre los aproximados.
    for (const c of cochesGte) {
        const clave = `${c.fabricante} ${c.nombre}`.replace(/^(\S+) \1 /i, '$1 ');
        const buscado = ALIAS[clave] || ALIAS[c.nombre] || expandir(c.fabricante, c.nombre);
        const hit = pool.find(p => base(p.name) === base(buscado));
        if (hit && !asignado.has(hit.id)) {
            asignado.set(hit.id, buscado);
            resultado.push({ ...c, catalogo: hit, via: 'exacto' });
        } else {
            pendientes.push({ c, buscado });
        }
    }

    // Segunda pasada: contención de palabras, solo si hay UN candidato libre.
    const sinPareja = [];
    for (const { c, buscado } of pendientes) {
        const candidatos = pool.filter(p => !asignado.has(p.id) && contenido(buscado, p.name));
        if (candidatos.length === 1) {
            asignado.set(candidatos[0].id, buscado);
            resultado.push({ ...c, catalogo: candidatos[0], via: 'aproximado' });
        } else {
            sinPareja.push({ ...c, buscado, candidatos: candidatos.map(p => p.name) });
        }
    }

    return { resultado, sinPareja };
}

// ── Principal ────────────────────────────────────────────────────────────

(async () => {
    admin.initializeApp({ credential: admin.credential.cert(require(path.join(ROOT, 'serviceAccountKey.json'))) });
    const db = admin.firestore();
    const catalogo = (await db.collection('cars').get()).docs.map(d => ({ id: d.id, ...d.data() }));
    console.log(`Catálogo: ${catalogo.length} coches\n`);

    const informe = { generado: new Date().toISOString(), fuente: 'gt-engine.com', clases: {} };
    const escrituras = [];

    for (const clase of Object.keys(CLASES)) {
        const { html, version } = await descargar(clase);

        // Una lectura por configuración; el emparejado se hace con la primera
        // y las otras dos se indexan por nombre.
        const porConfig = Object.fromEntries(CONFIGS.map(([k, id]) => [k, leerTabla(tablaPorId(html, id))]));
        const { resultado, sinPareja } = emparejar(porConfig.rapido, catalogo, clase);

        const clave = (c) => `${c.fabricante}|${c.nombre}`;
        const indice = Object.fromEntries(CONFIGS.map(([k]) =>
            [k, Object.fromEntries(porConfig[k].map(c => [clave(c), c]))]));

        const fichas = resultado.map(r => {
            const bop = {};
            CONFIGS.forEach(([k]) => {
                const x = indice[k][clave(r)];
                if (x) bop[k] = { pp: x.pp, cv: x.cv, parKgfm: x.parKgfm, kg: x.kg, s400: x.s400, s1000: x.s1000, s100a150: x.s100a150 };
            });
            return {
                id: r.catalogo.id,
                nombre: r.catalogo.name,
                nombreGte: `${r.fabricante} ${r.nombre}`,
                via: r.via,
                traccion: r.traccion,
                reparto: r.reparto,
                bop,
            };
        });

        informe.clases[clase] = { version, total: porConfig.rapido.length, emparejados: fichas.length, fichas, sinPareja };
        console.log(`${CLASES[clase]} (v${version || '?'}): ${fichas.length}/${porConfig.rapido.length} emparejados`
            + ` · ${fichas.filter(f => f.via === 'aproximado').length} por aproximación`);
        fichas.filter(f => f.via === 'aproximado').forEach(f => console.log(`     ≈ ${f.nombreGte}  →  ${f.nombre}`));
        sinPareja.forEach(s => console.log(`     ✗ ${s.buscado}${s.candidatos.length ? `  (ambiguo: ${s.candidatos.join(' | ')})` : ''}`));

        fichas.forEach(f => escrituras.push({
            id: f.id,
            datos: {
                bop: {
                    ...f.bop,
                    traccion: f.traccion,
                    reparto: f.reparto,
                    fuente: 'gt-engine.com',
                    versionJuego: version,
                    sincronizado: informe.generado,
                },
            },
        }));
    }

    if (JSON_OUT) {
        fs.writeFileSync(JSON_OUT, JSON.stringify(informe, null, 2));
        console.log(`\nInforme: ${JSON_OUT}`);
    }

    if (!ESCRIBIR) {
        console.log(`\nSimulación: ${escrituras.length} coches se actualizarían. Nada escrito. Usa --write para aplicarlo.`);
        process.exit(0);
    }

    // merge: solo se añade el campo `bop`; el resto de la ficha no se toca.
    const lotes = [];
    for (let i = 0; i < escrituras.length; i += 400) lotes.push(escrituras.slice(i, i + 400));
    for (const lote of lotes) {
        const batch = db.batch();
        lote.forEach(e => batch.set(db.collection('cars').doc(e.id), e.datos, { merge: true }));
        await batch.commit();
    }
    console.log(`\n✓ ${escrituras.length} coches actualizados con su BoP.`);
    process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
