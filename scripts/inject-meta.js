/*
 Inyecta meta tags OG/Twitter directamente en out/index.html.
 Esto asegura que scrapers (Facebook/WhatsApp/Telegram/Twitter/X) vean las etiquetas sin ejecutar JS.
*/
const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, '..', 'out');
const FILES = [path.join(OUT_DIR, 'index.html')];

const metaBlock = `  <title>Dashboard - GT7 ESP Racing Club</title>
  <meta name="description" content="Consulta en tiempo real las estadísticas, clasificaciones y resultados del campeonato GT7 ESP Racing Club. Dashboard interactivo con datos actualizados.">
  <link rel="canonical" href="https://imsa.trenkit.com/">
  <!-- Open Graph -->
  <meta property="og:type" content="website">
  <meta property="og:url" content="https://imsa.trenkit.com/">
  <meta property="og:site_name" content="GT7 ESP Racing Club">
  <meta property="og:title" content="IMSA - GT7 ESP Racing Club">
  <meta property="og:description" content="Consulta en tiempo real las estadísticas, clasificaciones y resultados del campeonato GT7 ESP Racing Club.">
    <meta property="og:image" content="https://imsa.trenkit.com/og-image.png">
    <meta property="og:image:secure_url" content="https://imsa.trenkit.com/og-image.png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="GT7 ESP Racing Club - IMSA">
  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="GT7 ESP Racing Club">
  <meta name="twitter:description" content="IMSA GT7 ESP Racing Club">
    <meta name="twitter:image" content="https://imsa.trenkit.com/og-image.png">`;

function inject(filePath) {
    let html = fs.readFileSync(filePath, 'utf8');

    const fbAppId = process.env.NEXT_PUBLIC_FB_APP_ID || process.env.FB_APP_ID;

    // Evitar doble inserción si ya existen og:title o twitter:card en el HTML
    if (/property=\"og:title\"|name=\"twitter:card\"/i.test(html)) {
        // Si ya están presentes como meta reales (no sólo dentro de scripts), no volver a insertar
        const headContent = html.split(/<head[^>]*>/i)[1]?.split(/<\/head>/i)[0] || '';
        if (/(<meta[^>]+property=\"og:title\")|(<meta[^>]+name=\"twitter:card\")/i.test(headContent)) {
            console.log(`[inject-meta] Meta tags ya presentes en head: ${path.basename(filePath)}. Sin cambios.`);
            return;
        }
    }

    const headOpenIndex = html.search(/<head[^>]*>/i);
    const headCloseIndex = html.search(/<\/head>/i);
    const headContent = headOpenIndex >= 0 && headCloseIndex > headOpenIndex
        ? html.slice(headOpenIndex, headCloseIndex)
        : '';

    let changed = false;

    // Insertar bloque base si no existen metatags reales de OG/Twitter
    if (!/(<meta[^>]+property=\"og:title\")/i.test(headContent) || !/(<meta[^>]+name=\"twitter:card\")/i.test(headContent)) {
        html = html.replace(/<head[^>]*>/i, (match) => `${match}\n${metaBlock}\n`);
        changed = true;
        console.log(`[inject-meta] Bloque OG/Twitter insertado en: ${path.basename(filePath)}`);
    }

    // Asegurar fb:app_id si hay APP ID definida por entorno
    if (fbAppId) {
        const hasFbAppId = headContent && /property=\"fb:app_id\"/i.test(headContent);
        if (!hasFbAppId) {
            html = html.replace(/<\/head>/i, `  <meta property=\"fb:app_id\" content=\"${fbAppId}\">\n</head>`);
            changed = true;
            console.log(`[inject-meta] fb:app_id añadido en: ${path.basename(filePath)}`);
        }
    }

    if (changed) {
        fs.writeFileSync(filePath, html, 'utf8');
    } else {
        console.log(`[inject-meta] Head ya contiene metatags necesarias: ${path.basename(filePath)}. Sin cambios.`);
    }
}

for (const file of FILES) {
    if (fs.existsSync(file)) {
        inject(file);
    } else {
        console.warn(`[inject-meta] Archivo no encontrado: ${file}`);
    }
}
