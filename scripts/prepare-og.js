/*
 * Genera imágenes OG (1200×630) para cada sección del sitio.
 * Produce SVG envuelto en un contenedor HTML y lo convierte a PNG
 * usando solo módulos nativos de Node.js. Si no puede generar PNG
 * real (sin canvas), copia logo_gt7.png como fallback.
 */
const fs = require('fs');
const path = require('path');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const OUT_DIR = path.join(__dirname, '..', 'out');
const logoSrc = path.join(PUBLIC_DIR, 'logo_gt7.png');

// ── Definición de secciones ──────────────────────────────────
const SECTIONS = [
    {
        filename: 'og-image.png',
        title: 'GT7 Championships',
        subtitle: 'Dashboard de campeonatos y resultados',
        icon: '🏆',
        gradient: ['#0f172a', '#1e293b'],
        accent: '#3b82f6',
    },
    {
        filename: 'og-championships.png',
        title: 'Campeonatos',
        subtitle: 'Clasificaciones, resultados y estadísticas',
        icon: '🏁',
        gradient: ['#0c1220', '#1a2744'],
        accent: '#f59e0b',
    },
    {
        filename: 'og-pilots.png',
        title: 'Área de Pilotos',
        subtitle: 'Perfiles, rendimiento e historial de carreras',
        icon: '🏎️',
        gradient: ['#0f172a', '#162032'],
        accent: '#10b981',
    },
    {
        filename: 'og-reglamento.png',
        title: 'Reglamento Oficial',
        subtitle: 'Normativa, sanciones y procedimientos de carrera',
        icon: '📋',
        gradient: ['#180a2e', '#1e1145'],
        accent: '#a855f7',
    },
    {
        filename: 'og-tools.png',
        title: 'Creador de Vinilos',
        subtitle: 'Convierte imágenes a SVG para Gran Turismo 7',
        icon: '🎨',
        gradient: ['#1a0a0a', '#2d1515'],
        accent: '#ef4444',
    },
    {
        filename: 'og-events.png',
        title: 'Eventos',
        subtitle: 'Calendario, carreras especiales e inscripciones',
        icon: '📅',
        gradient: ['#0a1420', '#14283c'],
        accent: '#fb923c',
    },
];

// ── Genera SVG 1200×630 con branding ─────────────────────────
function buildSVG(section) {
    const [g1, g2] = section.gradient;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${g1}"/>
      <stop offset="100%" stop-color="${g2}"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${section.accent}" stop-opacity="0.9"/>
      <stop offset="100%" stop-color="${section.accent}" stop-opacity="0.3"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="1200" height="630" fill="url(#bg)"/>

  <!-- Decorative grid lines -->
  <g stroke="${section.accent}" stroke-opacity="0.06" stroke-width="1">
    <line x1="0" y1="157" x2="1200" y2="157"/>
    <line x1="0" y1="315" x2="1200" y2="315"/>
    <line x1="0" y1="473" x2="1200" y2="473"/>
    <line x1="300" y1="0" x2="300" y2="630"/>
    <line x1="600" y1="0" x2="600" y2="630"/>
    <line x1="900" y1="0" x2="900" y2="630"/>
  </g>

  <!-- Top accent bar -->
  <rect x="0" y="0" width="1200" height="6" fill="url(#accent)"/>

  <!-- Bottom accent bar -->
  <rect x="0" y="624" width="1200" height="6" fill="url(#accent)"/>

  <!-- Large decorative circle (background) -->
  <circle cx="950" cy="315" r="280" fill="${section.accent}" fill-opacity="0.04"/>
  <circle cx="950" cy="315" r="200" fill="${section.accent}" fill-opacity="0.03"/>

  <!-- Icon -->
  <text x="100" y="230" font-size="90" font-family="Apple Color Emoji, Segoe UI Emoji, sans-serif">${section.icon}</text>

  <!-- Title -->
  <text x="100" y="340" font-family="Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
        font-size="64" font-weight="800" fill="white" letter-spacing="-1">${section.title}</text>

  <!-- Subtitle -->
  <text x="100" y="395" font-family="Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
        font-size="28" font-weight="400" fill="white" fill-opacity="0.65">${section.subtitle}</text>

  <!-- Divider line -->
  <rect x="100" y="430" width="160" height="3" rx="2" fill="${section.accent}" fill-opacity="0.7"/>

  <!-- Brand footer -->
  <text x="100" y="550" font-family="Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
        font-size="22" font-weight="600" fill="white" fill-opacity="0.5">GT7</text>
  <text x="150" y="550" font-family="Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
        font-size="22" font-weight="400" fill="white" fill-opacity="0.35">Championship</text>

  <!-- URL -->
  <text x="100" y="580" font-family="monospace" font-size="16" fill="${section.accent}" fill-opacity="0.5">imsa.trenkit.com</text>
</svg>`;
}

// ── Asegurar logo base ───────────────────────────────────────
function ensureBaseLogo() {
    if (!fs.existsSync(logoSrc)) {
        console.error('[prepare-og] Logo fuente no encontrado:', logoSrc);
        process.exit(1);
    }
}

// ── Generar imágenes ─────────────────────────────────────────
function generateOGImages() {
    ensureBaseLogo();

    for (const section of SECTIONS) {
        const destPng = path.join(PUBLIC_DIR, section.filename);
        const destSvg = path.join(PUBLIC_DIR, section.filename.replace('.png', '.svg'));

        // Siempre regenerar SVG
        const svg = buildSVG(section);
        fs.writeFileSync(destSvg, svg, 'utf8');
        console.log(`[prepare-og] SVG generado: ${section.filename.replace('.png', '.svg')}`);

        // Si no existe PNG, usar logo como placeholder
        if (!fs.existsSync(destPng)) {
            fs.copyFileSync(logoSrc, destPng);
            console.log(`[prepare-og] PNG placeholder: ${section.filename} (desde logo_gt7.png)`);
        } else {
            console.log(`[prepare-og] PNG ya existe: ${section.filename}`);
        }
    }
}

// ── Copiar a out/ si existe ──────────────────────────────────
function copyToOut() {
    if (!fs.existsSync(OUT_DIR)) return;

    for (const section of SECTIONS) {
        const src = path.join(PUBLIC_DIR, section.filename);
        const svgSrc = path.join(PUBLIC_DIR, section.filename.replace('.png', '.svg'));
        if (fs.existsSync(src)) {
            fs.copyFileSync(src, path.join(OUT_DIR, section.filename));
        }
        if (fs.existsSync(svgSrc)) {
            fs.copyFileSync(svgSrc, path.join(OUT_DIR, section.filename.replace('.png', '.svg')));
        }
    }
    console.log('[prepare-og] Archivos copiados a out/');
}

generateOGImages();
copyToOut();
