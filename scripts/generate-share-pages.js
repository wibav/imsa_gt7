/*
 * Genera páginas /share/championship/{id} y /share/event/{id} con metadata OG/Twitter
 * estática para que crawlers sociales (Facebook/WhatsApp/Twitter/Telegram) muestren
 * previews con banner/título/descripción de la entidad sin ejecutar JS.
 *
 * Arquitectura:
 *   - Lee campeonatos/eventos de Firestore (firebase-admin)
 *   - Por cada entidad, genera HTML estático con:
 *       • Metadata OG/Twitter en <head> (título, descripción, imagen)
 *       • Banner validado (HTTP/HTTPS) o fallback (data URI → no apto)
 *       • Redirect automático (JS) a la página de navegación normal de la SPA
 *       • Contenido <noscript> para crawlers sin JS
 *   - Manejo de IDs inválidos: metadata genérica sin datos reales
 *   - Mantiene navegación actual de la app (query params)
 *
 * Uso (parte del build):
 *   node scripts/generate-share-pages.js
 *
 * Contexto: Next.js 15 static export, no hay SSR en runtime → las share pages
 * deben ser pre-generadas en build time con contenido bakeado en HTML.
 */

const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, '..', 'out');
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://imsa.trenkit.com';

// ── Helpers ──────────────────────────────────────────────────────────────────

function esc(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Valida si un banner es apto para OG (debe ser HTTP/HTTPS, no data URI)
 */
function isValidOGBanner(banner) {
    if (!banner || typeof banner !== 'string') return false;
    const cleaned = banner.trim();
    // Data URI o vacío → no apto
    if (cleaned.startsWith('data:') || cleaned === '') return false;
    // Debe empezar con http:// o https://
    return cleaned.startsWith('http://') || cleaned.startsWith('https://');
}

/**
 * Obtiene imagen OG para un campeonato
 */
function getChampionshipOGImage(championship) {
    if (isValidOGBanner(championship.banner)) {
        return championship.banner.trim();
    }
    return `${BASE_URL}/og-championships.png`;
}

/**
 * Obtiene imagen OG para un evento
 */
function getEventOGImage(event) {
    if (isValidOGBanner(event.banner)) {
        return event.banner.trim();
    }
    return `${BASE_URL}/og-events.png`;
}

const STATUS_LABELS = {
    draft: 'Borrador',
    active: 'En curso',
    completed: 'Finalizado',
    archived: 'Archivado',
};

function formatDate(d) {
    if (!d) return '';
    try {
        // Manejar Firestore Timestamp (tiene .toDate() o .seconds)
        let date;
        if (d.toDate && typeof d.toDate === 'function') {
            date = d.toDate();
        } else if (d.seconds) {
            date = new Date(d.seconds * 1000);
        } else if (typeof d === 'string') {
            date = new Date(d);
        } else if (d instanceof Date) {
            date = d;
        } else {
            return '';
        }
        if (isNaN(date)) return '';
        return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });
    } catch {
        return '';
    }
}

// ── Plantilla HTML ───────────────────────────────────────────────────────────

function generateShareHTML({ title, description, image, canonicalUrl, redirectUrl, noscriptContent, type = 'article' }) {
    return `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${esc(title)}</title>
    <meta name="description" content="${esc(description)}">
    <link rel="canonical" href="${esc(canonicalUrl)}">
    
    <!-- Open Graph -->
    <meta property="og:type" content="${esc(type)}">
    <meta property="og:url" content="${esc(canonicalUrl)}">
    <meta property="og:site_name" content="GT7 Championships">
    <meta property="og:title" content="${esc(title)}">
    <meta property="og:description" content="${esc(description)}">
    <meta property="og:image" content="${esc(image)}">
    <meta property="og:image:secure_url" content="${esc(image)}">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:image:alt" content="${esc(title)}">
    
    <!-- Twitter -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${esc(title)}">
    <meta name="twitter:description" content="${esc(description)}">
    <meta name="twitter:image" content="${esc(image)}">
    
    <!-- Redirect automático para usuarios (no crawlers) -->
    <script>
        // Solo redirigir si es un navegador real (no crawler)
        if (!/bot|crawler|spider|crawling/i.test(navigator.userAgent)) {
            window.location.replace(${JSON.stringify(redirectUrl)});
        }
    </script>
    
    <style>
        body {
            font-family: system-ui, -apple-system, sans-serif;
            max-width: 800px;
            margin: 40px auto;
            padding: 20px;
            line-height: 1.6;
            color: #333;
        }
        .banner {
            width: 100%;
            max-height: 300px;
            object-fit: cover;
            border-radius: 8px;
            margin-bottom: 20px;
        }
        h1 {
            color: #1a1a1a;
            margin-bottom: 10px;
        }
        .meta {
            color: #666;
            font-size: 0.9em;
            margin-bottom: 20px;
        }
        .description {
            margin-bottom: 20px;
        }
        .redirect-notice {
            background: #f0f0f0;
            padding: 15px;
            border-radius: 4px;
            margin-top: 20px;
        }
    </style>
</head>
<body>
    <noscript>
        ${noscriptContent}
    </noscript>
    
    <div class="redirect-notice">
        <p>Redirigiendo a la aplicación principal...</p>
        <p><a href="${redirectUrl}">Haz clic aquí si no eres redirigido automáticamente</a></p>
    </div>
</body>
</html>`;
}

// ── Generación de páginas de campeonatos ────────────────────────────────────

function generateChampionshipSharePage(championship) {
    const shareUrl = `${BASE_URL}/share/championship/${championship.id}/`;
    const redirectUrl = `${BASE_URL}/championships?id=${championship.id}`;
    const image = getChampionshipOGImage(championship);

    const title = championship.name || 'Campeonato GT7';
    const statusLabel = STATUS_LABELS[championship.status] || championship.status;
    const description = championship.description ||
        `${championship.name} - Temporada ${championship.season || '2024'}. ${statusLabel}.`;

    const noscriptContent = `
        ${isValidOGBanner(championship.banner) ? `<img src="${esc(championship.banner)}" alt="${esc(title)}" class="banner">` : ''}
        <h1>${esc(title)}</h1>
        <div class="meta">
            <strong>Temporada:</strong> ${esc(championship.season || '')} | 
            <strong>Estado:</strong> ${esc(statusLabel)}
            ${championship.startDate ? ` | <strong>Inicio:</strong> ${formatDate(championship.startDate)}` : ''}
        </div>
        ${championship.description ? `<div class="description">${esc(championship.description)}</div>` : ''}
        <p><a href="${redirectUrl}">Ver campeonato completo →</a></p>
    `;

    return generateShareHTML({
        title,
        description,
        image,
        canonicalUrl: shareUrl,
        redirectUrl,
        noscriptContent,
        type: 'article'
    });
}

function generateChampionshipNotFound() {
    const shareUrl = `${BASE_URL}/share/championship/not-found/`;
    const redirectUrl = `${BASE_URL}/championships/`;
    const image = `${BASE_URL}/og-championships.png`;

    const noscriptContent = `
        <h1>Campeonato no encontrado</h1>
        <p>El campeonato solicitado no existe o no está disponible.</p>
        <p><a href="${redirectUrl}">Ver todos los campeonatos →</a></p>
    `;

    return generateShareHTML({
        title: 'Campeonato no encontrado | GT7 Championships',
        description: 'El campeonato solicitado no está disponible.',
        image,
        canonicalUrl: shareUrl,
        redirectUrl,
        noscriptContent,
        type: 'website'
    });
}

// ── Generación de páginas de eventos ────────────────────────────────────────

function generateEventSharePage(event) {
    const shareUrl = `${BASE_URL}/share/event/${event.id}/`;
    const redirectUrl = `${BASE_URL}/events?id=${event.id}`;
    const image = getEventOGImage(event);

    const title = event.title || 'Evento GT7';
    const eventDate = event.date ? formatDate(event.date) : '';
    const description = event.description ||
        `${event.title}${eventDate ? ` - ${eventDate}` : ''}. ${event.type || 'Evento especial'}.`;

    const noscriptContent = `
        ${isValidOGBanner(event.banner) ? `<img src="${esc(event.banner)}" alt="${esc(title)}" class="banner">` : ''}
        <h1>${esc(title)}</h1>
        <div class="meta">
            ${eventDate ? `<strong>Fecha:</strong> ${eventDate} | ` : ''}
            <strong>Tipo:</strong> ${esc(event.type || 'Evento')}
            ${event.track ? ` | <strong>Circuito:</strong> ${esc(event.track)}` : ''}
        </div>
        ${event.description ? `<div class="description">${esc(event.description)}</div>` : ''}
        <p><a href="${redirectUrl}">Ver evento completo →</a></p>
    `;

    return generateShareHTML({
        title,
        description,
        image,
        canonicalUrl: shareUrl,
        redirectUrl,
        noscriptContent,
        type: 'article'
    });
}

function generateEventNotFound() {
    const shareUrl = `${BASE_URL}/share/event/not-found/`;
    const redirectUrl = `${BASE_URL}/events/`;
    const image = `${BASE_URL}/og-events.png`;

    const noscriptContent = `
        <h1>Evento no encontrado</h1>
        <p>El evento solicitado no existe o no está disponible.</p>
        <p><a href="${redirectUrl}">Ver todos los eventos →</a></p>
    `;

    return generateShareHTML({
        title: 'Evento no encontrado | GT7 Championships',
        description: 'El evento solicitado no está disponible.',
        image,
        canonicalUrl: shareUrl,
        redirectUrl,
        noscriptContent,
        type: 'website'
    });
}

// ── Conexión a Firestore ─────────────────────────────────────────────────────

function tryInitFirestore() {
    const serviceAccountPath = path.join(__dirname, '..', 'serviceAccountKey.json');
    if (!fs.existsSync(serviceAccountPath)) {
        console.warn('[generate-share-pages] serviceAccountKey.json no encontrado — se omiten páginas de share.');
        return null;
    }
    try {
        const admin = require('firebase-admin');
        if (!admin.apps.length) {
            const serviceAccount = require(serviceAccountPath);
            admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
        }
        return admin.firestore();
    } catch (err) {
        console.warn('[generate-share-pages] No se pudo inicializar firebase-admin:', err.message);
        return null;
    }
}

async function loadChampionships(db) {
    const snap = await db.collection('championships').get();
    const championships = [];

    for (const doc of snap.docs) {
        const data = doc.data();
        // Incluir todos los campeonatos (excepto borradores si se desea)
        // Para share, incluimos activos y completados
        if (data.status !== 'draft') {
            championships.push({
                id: doc.id,
                ...data
            });
        }
    }

    return championships;
}

async function loadEvents(db) {
    const snap = await db.collection('events').get();
    const events = [];

    for (const doc of snap.docs) {
        const data = doc.data();
        // Incluir eventos activos y pasados, excluir borradores
        if (data.status !== 'draft') {
            events.push({
                id: doc.id,
                ...data
            });
        }
    }

    return events;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
    console.log('[generate-share-pages] Iniciando generación de páginas de compartición...');

    const db = tryInitFirestore();
    if (!db) {
        console.warn('[generate-share-pages] Firestore no disponible, generando solo páginas de fallback.');
        // Generar solo páginas not-found
        const championshipDir = path.join(OUT_DIR, 'share', 'championship', 'not-found');
        fs.mkdirSync(championshipDir, { recursive: true });
        fs.writeFileSync(
            path.join(championshipDir, 'index.html'),
            generateChampionshipNotFound()
        );

        const eventDir = path.join(OUT_DIR, 'share', 'event', 'not-found');
        fs.mkdirSync(eventDir, { recursive: true });
        fs.writeFileSync(
            path.join(eventDir, 'index.html'),
            generateEventNotFound()
        );

        console.log('[generate-share-pages] Páginas de fallback generadas.');
        return;
    }

    try {
        // Cargar datos
        const [championships, events] = await Promise.all([
            loadChampionships(db),
            loadEvents(db)
        ]);

        console.log(`[generate-share-pages] Cargados ${championships.length} campeonatos y ${events.length} eventos.`);

        // Generar páginas de campeonatos
        let championshipCount = 0;
        for (const championship of championships) {
            const dir = path.join(OUT_DIR, 'share', 'championship', String(championship.id));
            fs.mkdirSync(dir, { recursive: true });

            const html = generateChampionshipSharePage(championship);
            fs.writeFileSync(path.join(dir, 'index.html'), html);
            championshipCount++;
        }

        // Página not-found de campeonatos
        const championshipNotFoundDir = path.join(OUT_DIR, 'share', 'championship', 'not-found');
        fs.mkdirSync(championshipNotFoundDir, { recursive: true });
        fs.writeFileSync(
            path.join(championshipNotFoundDir, 'index.html'),
            generateChampionshipNotFound()
        );

        // Generar páginas de eventos
        let eventCount = 0;
        for (const event of events) {
            const dir = path.join(OUT_DIR, 'share', 'event', String(event.id));
            fs.mkdirSync(dir, { recursive: true });

            const html = generateEventSharePage(event);
            fs.writeFileSync(path.join(dir, 'index.html'), html);
            eventCount++;
        }

        // Página not-found de eventos
        const eventNotFoundDir = path.join(OUT_DIR, 'share', 'event', 'not-found');
        fs.mkdirSync(eventNotFoundDir, { recursive: true });
        fs.writeFileSync(
            path.join(eventNotFoundDir, 'index.html'),
            generateEventNotFound()
        );

        console.log(`[generate-share-pages] ✓ Generadas ${championshipCount} páginas de campeonatos.`);
        console.log(`[generate-share-pages] ✓ Generadas ${eventCount} páginas de eventos.`);
        console.log('[generate-share-pages] ✓ Páginas de compartición listas.');
    } catch (error) {
        console.error('[generate-share-pages] Error al generar páginas:', error);
        process.exit(1);
    }
}

main();
