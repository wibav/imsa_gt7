/* Crea og-image.png 1200x630 a partir de logo_gt7.png si no existe. */
const fs = require('fs');
const path = require('path');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const OUT_DIR = path.join(__dirname, '..', 'out');
const src = path.join(PUBLIC_DIR, 'logo_gt7.png');
const destPublic = path.join(PUBLIC_DIR, 'og-image.png');
const destOut = path.join(OUT_DIR, 'og-image.png');

function ensureOgImage() {
    if (!fs.existsSync(src)) {
        console.error('[prepare-og] Fuente no encontrada:', src);
        process.exit(1);
    }
    // Si no existe en public, copiamos logo como og-image
    if (!fs.existsSync(destPublic)) {
        fs.copyFileSync(src, destPublic);
        console.log('[prepare-og] Copiado og-image.png en public/ desde logo_gt7.png');
    } else {
        console.log('[prepare-og] og-image.png ya existe en public/');
    }
}

function copyToOut() {
    if (!fs.existsSync(OUT_DIR)) return;
    fs.copyFileSync(destPublic, destOut);
    console.log('[prepare-og] Copiado og-image.png a out/');
}

ensureOgImage();
copyToOut();
