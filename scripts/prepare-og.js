/*
 * Comprueba que las imágenes OG existen antes de compilar.
 *
 * Antes este script definía por segunda vez las mismas seis secciones
 * (título, subtítulo, colores) que generate-og-images.py y generaba con ellas
 * unos SVG que no consumía nadie: ningún meta los referencia, así que se
 * desplegaban sin usarse y, al estar duplicados los textos, cambiar uno no
 * cambiaba el otro.
 *
 * Ahora el generador de Python es la única fuente, y aquí solo se verifica su
 * salida: si falla el paso anterior, el build se para en vez de desplegar
 * enlaces con una imagen rota o desactualizada.
 */
const fs = require('fs');
const path = require('path');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');

const ESPERADAS = [
    'og-image.png',
    'og-championships.png',
    'og-pilots.png',
    'og-reglamento.png',
    'og-tools.png',
    'og-events.png',
];

const faltan = ESPERADAS.filter(f => !fs.existsSync(path.join(PUBLIC_DIR, f)));

if (faltan.length > 0) {
    console.error('[prepare-og] Faltan imágenes OG:', faltan.join(', '));
    console.error('[prepare-og] Ejecuta: python3 scripts/generate-og-images.py');
    process.exit(1);
}

console.log(`[prepare-og] ${ESPERADAS.length} imágenes OG verificadas.`);
