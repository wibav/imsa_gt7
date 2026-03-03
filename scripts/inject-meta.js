/*
 Inyecta meta tags OG/Twitter directamente en los HTML estáticos generados.
 Esto asegura que scrapers (Facebook/WhatsApp/Telegram/Twitter/X) vean las etiquetas sin ejecutar JS.
 Cubre la home y todas las secciones con metadata específica.
*/
const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, '..', 'out');
const BASE_URL = 'https://imsa.trenkit.com';

// ── Páginas y su metadata OG ─────────────────────────────────
const PAGES = [
    {
        file: 'index.html',
        title: 'Dashboard - GT7 ESP Racing Club',
        description: 'Consulta en tiempo real las estadísticas, clasificaciones y resultados del campeonato GT7 ESP Racing Club. Dashboard interactivo con datos actualizados.',
        url: `${BASE_URL}/`,
        image: `${BASE_URL}/og-image.png`,
        imageAlt: 'GT7 ESP Racing Club - IMSA',
    },
    {
        file: 'championships/index.html',
        title: 'Campeonatos | GT7 ESP Racing Club',
        description: 'Clasificaciones, resultados y estadísticas de todos los campeonatos del GT7 ESP Racing Club.',
        url: `${BASE_URL}/championships/`,
        image: `${BASE_URL}/og-championships.png`,
        imageAlt: 'Campeonatos - GT7 ESP Racing Club',
    },
    {
        file: 'pilots/index.html',
        title: 'Área de Pilotos | GT7 ESP Racing Club',
        description: 'Perfiles, estadísticas y rendimiento de los pilotos del GT7 ESP Racing Club.',
        url: `${BASE_URL}/pilots/`,
        image: `${BASE_URL}/og-pilots.png`,
        imageAlt: 'Área de Pilotos - GT7 ESP Racing Club',
    },
    {
        file: 'reglamento/index.html',
        title: 'Reglamento Oficial | GT7 ESP Racing Club',
        description: 'Normativa oficial: conducta en pista, sanciones por puntos, reclamaciones y reglas de carrera del GT7 ESP Racing Club.',
        url: `${BASE_URL}/reglamento/`,
        image: `${BASE_URL}/og-reglamento.png`,
        imageAlt: 'Reglamento - GT7 ESP Racing Club',
    },
    {
        file: 'tools/index.html',
        title: 'Creador de Vinilos | GT7 ESP Racing Club',
        description: 'Convierte imágenes a vinilos SVG optimizados para Gran Turismo 7. Herramienta gratuita del GT7 ESP Racing Club.',
        url: `${BASE_URL}/tools/`,
        image: `${BASE_URL}/og-tools.png`,
        imageAlt: 'Creador de Vinilos - GT7 ESP Racing Club',
    },
    {
        file: 'events/index.html',
        title: 'Eventos | GT7 ESP Racing Club',
        description: 'Calendario de eventos, carreras especiales e inscripciones del GT7 ESP Racing Club.',
        url: `${BASE_URL}/events/`,
        image: `${BASE_URL}/og-events.png`,
        imageAlt: 'Eventos - GT7 ESP Racing Club',
    },
];

// ── Construir bloque de meta tags ────────────────────────────
function buildMetaBlock(page) {
    return `  <title>${page.title}</title>
  <meta name="description" content="${page.description}">
  <link rel="canonical" href="${page.url}">
  <!-- Open Graph -->
  <meta property="og:type" content="website">
  <meta property="og:url" content="${page.url}">
  <meta property="og:site_name" content="GT7 ESP Racing Club">
  <meta property="og:title" content="${page.title}">
  <meta property="og:description" content="${page.description}">
  <meta property="og:image" content="${page.image}">
  <meta property="og:image:secure_url" content="${page.image}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${page.imageAlt}">
  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${page.title}">
  <meta name="twitter:description" content="${page.description}">
  <meta name="twitter:image" content="${page.image}">`;
}

// ── Inyectar en un archivo HTML ───────────────────────────────
function inject(filePath, page) {
    let html = fs.readFileSync(filePath, 'utf8');

    const fbAppId = process.env.NEXT_PUBLIC_FB_APP_ID || process.env.FB_APP_ID;
    const metaBlock = buildMetaBlock(page);

    // Extraer contenido del <head>
    const headMatch = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
    const headContent = headMatch ? headMatch[1] : '';

    // Verificar si ya tiene OG tags reales (no en scripts)
    const hasOG = /(<meta[^>]+property="og:title")/i.test(headContent);
    const hasTwitter = /(<meta[^>]+name="twitter:card")/i.test(headContent);

    let changed = false;

    if (!hasOG || !hasTwitter) {
        html = html.replace(/<head([^>]*)>/i, (match) => `${match}\n${metaBlock}\n`);
        changed = true;
        console.log(`[inject-meta] OG/Twitter insertado: ${page.file}`);
    } else {
        console.log(`[inject-meta] OG tags ya presentes: ${page.file}`);
    }

    // fb:app_id
    if (fbAppId && !/property="fb:app_id"/i.test(headContent)) {
        html = html.replace(/<\/head>/i, `  <meta property="fb:app_id" content="${fbAppId}">\n</head>`);
        changed = true;
        console.log(`[inject-meta] fb:app_id añadido: ${page.file}`);
    }

    if (changed) {
        fs.writeFileSync(filePath, html, 'utf8');
    }
}

// ── Ejecutar ─────────────────────────────────────────────────
let processed = 0;
for (const page of PAGES) {
    const filePath = path.join(OUT_DIR, page.file);
    if (fs.existsSync(filePath)) {
        inject(filePath, page);
        processed++;
    } else {
        console.warn(`[inject-meta] No encontrado: ${page.file}`);
    }
}
console.log(`[inject-meta] ${processed}/${PAGES.length} páginas procesadas.`);
