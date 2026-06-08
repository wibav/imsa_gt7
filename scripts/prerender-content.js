/*
 * Prerender de contenido para SEO / AdSense.
 *
 * El sitio es un export estático de Next.js cuyo contenido se carga client-side
 * desde Firestore. Eso deja el HTML inicial vacío → los crawlers ven "pantallas
 * sin contenido del editor" (motivo de rechazo de AdSense) y el SEO es nulo.
 *
 * Este script corre DESPUÉS de `next build`:
 *   1. Lee los campeonatos (+ teams/tracks/events) desde Firestore con firebase-admin.
 *   2. Inyecta en cada HTML estático un bloque <noscript> con contenido real
 *      (campeonatos, clasificaciones, calendario, reglamento) — crawleable y sin
 *      afectar la hidratación de React (noscript se ignora en el render del cliente).
 *   3. Inyecta JSON-LD (schema.org) en el <head> para datos estructurados.
 *   4. Genera sitemap.xml y robots.txt en /out.
 *
 * Degradación elegante: si no hay serviceAccountKey.json o falla Firestore,
 * igual genera sitemap.xml/robots.txt con las rutas estáticas y no rompe el build.
 *
 * Uso (automático en `npm run build`):
 *   node scripts/prerender-content.js
 */

const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, '..', 'out');
const BASE_URL = 'https://imsa.trenkit.com';
const MARKER = '<!-- prerender-content -->'; // idempotencia: no inyectar dos veces

// ── Rutas estáticas públicas (para sitemap) ──────────────────────────────────
const STATIC_ROUTES = [
    { path: '/', priority: '1.0', changefreq: 'daily' },
    { path: '/championships/', priority: '0.9', changefreq: 'daily' },
    { path: '/pilots/', priority: '0.8', changefreq: 'weekly' },
    { path: '/events/', priority: '0.8', changefreq: 'weekly' },
    { path: '/reglamento/', priority: '0.6', changefreq: 'monthly' },
    { path: '/equipamiento/', priority: '0.6', changefreq: 'monthly' },
    { path: '/tools/', priority: '0.5', changefreq: 'monthly' },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function esc(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function formatDate(d) {
    if (!d) return '';
    try {
        const date = new Date(typeof d === 'string' ? d : d);
        if (isNaN(date)) return '';
        return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });
    } catch {
        return '';
    }
}

const STATUS_LABELS = {
    draft: 'Borrador',
    active: 'En curso',
    completed: 'Finalizado',
    archived: 'Archivado',
};

// ── Conexión a Firestore (opcional) ──────────────────────────────────────────

function tryInitFirestore() {
    const serviceAccountPath = path.join(__dirname, '..', 'serviceAccountKey.json');
    if (!fs.existsSync(serviceAccountPath)) {
        console.warn('[prerender] serviceAccountKey.json no encontrado — se omite contenido dinámico, solo sitemap/robots.');
        return null;
    }
    try {
        const admin = require('firebase-admin');
        if (!admin.apps.length) {
            // eslint-disable-next-line import/no-dynamic-require, global-require
            const serviceAccount = require(serviceAccountPath);
            admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
        }
        return admin.firestore();
    } catch (err) {
        console.warn('[prerender] No se pudo inicializar firebase-admin:', err.message);
        return null;
    }
}

// ── Carga de datos ───────────────────────────────────────────────────────────

async function loadChampionships(db) {
    const snap = await db.collection('championships').get();
    const championships = [];

    for (const doc of snap.docs) {
        const data = doc.data();
        // Ignorar borradores/archivados en el contenido público
        if (data.status === 'draft' || data.status === 'archived') continue;

        const [teamsSnap, tracksSnap, eventsSnap] = await Promise.all([
            db.collection('championships').doc(doc.id).collection('teams').get(),
            db.collection('championships').doc(doc.id).collection('tracks').get(),
            db.collection('championships').doc(doc.id).collection('events').get(),
        ]);

        championships.push({
            id: doc.id,
            ...data,
            teams: teamsSnap.docs.map(d => ({ id: d.id, ...d.data() })),
            tracks: tracksSnap.docs.map(d => ({ id: d.id, ...d.data() })),
            events: eventsSnap.docs.map(d => ({ id: d.id, ...d.data() })),
        });
    }
    return championships;
}

// Clasificación simple: suma de track.points[driver] (misma fuente que getStandings)
function computeStandings(champ) {
    const points = {};
    (champ.tracks || []).forEach(track => {
        Object.entries(track.points || {}).forEach(([driver, pts]) => {
            if (!driver) return;
            points[driver] = (points[driver] || 0) + (Number(pts) || 0);
        });
    });
    return Object.entries(points)
        .map(([name, pts]) => ({ name, points: pts }))
        .sort((a, b) => b.points - a.points);
}

// Lista de pilotos de un campeonato (de teams o drivers)
function getDrivers(champ) {
    const names = new Set();
    (champ.teams || []).forEach(t => (t.drivers || []).forEach(d => names.add(typeof d === 'string' ? d : d.name)));
    (champ.drivers || []).forEach(d => names.add(typeof d === 'string' ? d : d.name));
    return Array.from(names).filter(Boolean);
}

// ── Generadores de contenido HTML por página ─────────────────────────────────

function renderChampionshipBlock(champ) {
    const standings = computeStandings(champ);
    const drivers = getDrivers(champ);
    const sortedTracks = [...(champ.tracks || [])].sort((a, b) => (a.round || 0) - (b.round || 0));

    let html = `<article>`;
    html += `<h2>${esc(champ.name)}</h2>`;
    html += `<p>Temporada ${esc(champ.season)} · ${esc(STATUS_LABELS[champ.status] || champ.status)}`;
    if (champ.settings?.isTeamChampionship) html += ` · Campeonato por equipos`;
    if (champ.settings?.isMultiCategory) html += ` (multicategoría)`;
    html += `</p>`;
    if (champ.description) html += `<p>${esc(champ.description)}</p>`;

    // Calendario
    if (sortedTracks.length > 0) {
        html += `<h3>Calendario de ${esc(champ.name)}</h3><ul>`;
        sortedTracks.forEach(t => {
            const date = formatDate(t.date);
            html += `<li>Ronda ${esc(t.round || '')}: ${esc(t.name)}${t.country ? ` (${esc(t.country)})` : ''}${date ? ` — ${esc(date)}` : ''}</li>`;
        });
        html += `</ul>`;
    }

    // Clasificación
    if (standings.length > 0) {
        html += `<h3>Clasificación de ${esc(champ.name)}</h3><table><thead><tr><th>Pos.</th><th>Piloto</th><th>Puntos</th></tr></thead><tbody>`;
        standings.slice(0, 30).forEach((s, i) => {
            html += `<tr><td>${i + 1}</td><td>${esc(s.name)}</td><td>${s.points}</td></tr>`;
        });
        html += `</tbody></table>`;
    } else if (drivers.length > 0) {
        html += `<h3>Pilotos inscritos</h3><ul>`;
        drivers.forEach(d => { html += `<li>${esc(d)}</li>`; });
        html += `</ul>`;
    }

    // Equipos
    if (champ.settings?.isTeamChampionship && (champ.teams || []).length > 0) {
        html += `<h3>Equipos</h3><ul>`;
        champ.teams.forEach(t => {
            const teamDrivers = (t.drivers || []).map(d => typeof d === 'string' ? d : d.name).filter(Boolean);
            html += `<li>${esc(t.name)}${teamDrivers.length ? `: ${esc(teamDrivers.join(', '))}` : ''}</li>`;
        });
        html += `</ul>`;
    }

    html += `</article>`;
    return html;
}

function buildChampionshipsContent(championships) {
    if (championships.length === 0) return '';
    let html = `<h1>Campeonatos de Gran Turismo 7</h1>`;
    html += `<p>Clasificaciones, resultados, calendario y estadísticas de los campeonatos de GT7 Championships. Datos actualizados de cada temporada, equipos y pilotos.</p>`;
    championships.forEach(c => { html += renderChampionshipBlock(c); });
    return html;
}

function buildHomeContent(championships) {
    const active = championships.filter(c => c.status === 'active');
    let html = `<h1>GT7 Championships — Campeonatos de Gran Turismo 7</h1>`;
    html += `<p>Plataforma de gestión de campeonatos de Gran Turismo 7: clasificaciones en vivo, resultados de carreras, calendario, reglamento, inscripciones, sistema de sanciones y estadísticas de pilotos y equipos.</p>`;
    const list = active.length > 0 ? active : championships;
    if (list.length > 0) {
        html += `<h2>Campeonatos ${active.length > 0 ? 'en curso' : 'disponibles'}</h2><ul>`;
        list.forEach(c => {
            html += `<li>${esc(c.name)} — Temporada ${esc(c.season)} (${esc(STATUS_LABELS[c.status] || c.status)})</li>`;
        });
        html += `</ul>`;
    }
    return html;
}

function buildPilotsContent(championships) {
    const all = new Map(); // name -> set de campeonatos
    championships.forEach(c => {
        getDrivers(c).forEach(d => {
            if (!all.has(d)) all.set(d, new Set());
            all.get(d).add(c.name);
        });
    });
    if (all.size === 0) return '';
    let html = `<h1>Pilotos de GT7 Championships</h1>`;
    html += `<p>Perfiles y participación de los pilotos en los campeonatos de Gran Turismo 7.</p><ul>`;
    Array.from(all.entries()).sort((a, b) => a[0].localeCompare(b[0])).forEach(([name, champs]) => {
        html += `<li>${esc(name)} — ${esc(Array.from(champs).join(', '))}</li>`;
    });
    html += `</ul>`;
    return html;
}

function buildEventsContent(championships) {
    const events = [];
    championships.forEach(c => (c.events || []).forEach(e => events.push({ ...e, champName: c.name })));
    if (events.length === 0) return '';
    let html = `<h1>Eventos y carreras de GT7 Championships</h1>`;
    html += `<p>Calendario de eventos, carreras especiales e inscripciones de Gran Turismo 7.</p><ul>`;
    events.forEach(e => {
        const date = formatDate(e.date);
        html += `<li>${esc(e.title || 'Evento')}${e.champName ? ` — ${esc(e.champName)}` : ''}${date ? ` (${esc(date)})` : ''}${e.track ? ` — ${esc(e.track)}` : ''}</li>`;
    });
    html += `</ul>`;
    return html;
}

function buildReglamentoContent(championships) {
    const withRegs = championships.filter(c => c.regulations && String(c.regulations).trim());
    let html = `<h1>Reglamento oficial de GT7 Championships</h1>`;
    html += `<p>Normativa, conducta en pista, sistema de sanciones por puntos, reclamaciones y procedimientos de carrera de los campeonatos de Gran Turismo 7.</p>`;
    if (withRegs.length === 0) return html; // al menos el encabezado da contexto
    withRegs.forEach(c => {
        html += `<h2>Reglamento — ${esc(c.name)}</h2>`;
        html += `<p>${esc(c.regulations).replace(/\n/g, '<br>')}</p>`;
    });
    return html;
}

// ── JSON-LD (datos estructurados) ────────────────────────────────────────────

function buildChampionshipsJsonLd(championships) {
    const itemList = {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: 'Campeonatos GT7 Championships',
        itemListElement: championships.map((c, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            item: {
                '@type': 'SportsEvent',
                name: c.name,
                sport: 'Sim Racing — Gran Turismo 7',
                description: c.description || `Campeonato de Gran Turismo 7, temporada ${c.season}`,
                eventStatus: c.status === 'completed'
                    ? 'https://schema.org/EventScheduled'
                    : 'https://schema.org/EventScheduled',
                url: `${BASE_URL}/championships/?id=${c.id}`,
            },
        })),
    };
    return itemList;
}

function buildOrganizationJsonLd() {
    return {
        '@context': 'https://schema.org',
        '@type': 'SportsOrganization',
        name: 'GT7 Championships',
        sport: 'Sim Racing — Gran Turismo 7',
        url: `${BASE_URL}/`,
        logo: `${BASE_URL}/logo_gt7.png`,
    };
}

// ── Inyección en HTML ────────────────────────────────────────────────────────

function injectIntoFile(relFile, contentHtml, jsonLd) {
    const filePath = path.join(OUT_DIR, relFile);
    if (!fs.existsSync(filePath)) {
        console.warn(`[prerender] No encontrado: ${relFile}`);
        return false;
    }

    let html = fs.readFileSync(filePath, 'utf8');

    // Idempotencia: si ya se inyectó, removemos el bloque previo antes de re-inyectar
    if (html.includes(MARKER)) {
        html = html.replace(new RegExp(`${MARKER}[\\s\\S]*?<!-- /prerender-content -->`, 'g'), '');
        html = html.replace(/<script type="application\/ld\+json" data-prerender>[\s\S]*?<\/script>/g, '');
    }

    let changed = false;

    // 1. JSON-LD en <head>
    if (jsonLd) {
        const ld = `<script type="application/ld+json" data-prerender>${JSON.stringify(jsonLd)}</script>`;
        html = html.replace(/<\/head>/i, `${ld}\n</head>`);
        changed = true;
    }

    // 2. Bloque <noscript> con contenido real, justo tras <body ...>
    if (contentHtml && contentHtml.trim()) {
        const block = `${MARKER}<noscript><div class="seo-content">${contentHtml}</div></noscript><!-- /prerender-content -->`;
        html = html.replace(/(<body[^>]*>)/i, `$1\n${block}\n`);
        changed = true;
    }

    if (changed) {
        fs.writeFileSync(filePath, html, 'utf8');
        const kb = (Buffer.byteLength(contentHtml || '', 'utf8') / 1024).toFixed(1);
        console.log(`[prerender] ${relFile}: contenido inyectado (${kb} KB) ${jsonLd ? '+ JSON-LD' : ''}`);
    }
    return changed;
}

// ── Sitemap & robots ─────────────────────────────────────────────────────────

function writeSitemap() {
    const today = new Date().toISOString().split('T')[0];
    const urls = STATIC_ROUTES.map(r => (
        `  <url>\n` +
        `    <loc>${BASE_URL}${r.path}</loc>\n` +
        `    <lastmod>${today}</lastmod>\n` +
        `    <changefreq>${r.changefreq}</changefreq>\n` +
        `    <priority>${r.priority}</priority>\n` +
        `  </url>`
    )).join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n` +
        `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;

    fs.writeFileSync(path.join(OUT_DIR, 'sitemap.xml'), xml, 'utf8');
    console.log(`[prerender] sitemap.xml generado (${STATIC_ROUTES.length} rutas).`);
}

function writeRobots() {
    const robots = `User-agent: *\nAllow: /\n\n` +
        `# Áreas administrativas (sin valor para indexación)\n` +
        `Disallow: /championshipsAdmin/\n` +
        `Disallow: /eventsAdmin/\n` +
        `Disallow: /teamsAdmin/\n` +
        `Disallow: /tracksAdmin/\n` +
        `Disallow: /usersAdmin/\n` +
        `Disallow: /login/\n\n` +
        `Sitemap: ${BASE_URL}/sitemap.xml\n`;

    fs.writeFileSync(path.join(OUT_DIR, 'robots.txt'), robots, 'utf8');
    console.log('[prerender] robots.txt generado.');
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
    if (!fs.existsSync(OUT_DIR)) {
        console.error('[prerender] No existe /out. Ejecuta `next build` primero.');
        process.exitCode = 1;
        return;
    }

    // Siempre generamos sitemap + robots
    writeSitemap();
    writeRobots();

    const db = tryInitFirestore();
    if (!db) {
        console.log('[prerender] Sin Firestore: build continúa con sitemap/robots únicamente.');
        return;
    }

    let championships;
    try {
        championships = await loadChampionships(db);
    } catch (err) {
        console.warn('[prerender] Error leyendo Firestore:', err.message, '— se omite contenido dinámico.');
        return;
    }

    console.log(`[prerender] ${championships.length} campeonatos públicos cargados.`);

    // Inyectar contenido por página
    injectIntoFile('index.html', buildHomeContent(championships), buildOrganizationJsonLd());
    injectIntoFile('championships/index.html', buildChampionshipsContent(championships), buildChampionshipsJsonLd(championships));
    injectIntoFile('pilots/index.html', buildPilotsContent(championships), null);
    injectIntoFile('events/index.html', buildEventsContent(championships), null);
    injectIntoFile('reglamento/index.html', buildReglamentoContent(championships), null);

    console.log('[prerender] Completado.');
}

main().catch(err => {
    console.error('[prerender] Fallo inesperado:', err);
    // No romper el build por SEO
    process.exitCode = 0;
});
