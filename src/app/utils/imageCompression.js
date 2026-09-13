/**
 * Preparación de imágenes en el cliente antes de subir a Firebase Storage,
 * sin librerías externas (usa <canvas> nativo del navegador).
 *
 * Todo se guarda en PNG, nunca en JPG. Antes, por encima de 800 KB se
 * recomprimía a JPG, que no tiene canal alfa: un logo o un trazado de
 * circuito con fondo transparente quedaba con el fondo negro. El PNG no
 * tiene "calidad" que bajar, así que el peso se controla reduciendo la
 * resolución, sin bajar de un mínimo que se vea nítido en la cabecera.
 *
 * Ver docs técnicos: Notas/Proyectos/GT7 Championships/02-ESPECIFICACIONES.md (SPEC-7)
 */

const MAX_ORIGIN_BYTES = 10 * 1024 * 1024; // rechazo duro antes de intentar procesar
const TARGET_MAX_BYTES = 2 * 1024 * 1024;  // un banner 16:9 fotográfico en PNG ronda 2 MB a 1600 px
const MAX_WIDTH = 1600;
const MIN_WIDTH = 1200;                     // por debajo, el banner se ve borroso a pantalla completa
const SCALE_STEP = 0.9;

/**
 * Valida tipo y peso de origen de una imagen antes de procesarla.
 * @param {File} file
 * @throws {Error} con mensaje amigable si no es válida
 */
export function validateImageFile(file) {
    if (!file) throw new Error('No se seleccionó ningún archivo');
    if (!file.type.startsWith('image/')) {
        throw new Error('Por favor selecciona un archivo de imagen');
    }
    if (file.size > MAX_ORIGIN_BYTES) {
        throw new Error(`La imagen supera el máximo de ${MAX_ORIGIN_BYTES / (1024 * 1024)} MB`);
    }
}

function loadImage(file) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo leer la imagen')); };
        img.src = url;
    });
}

function renderPng(img, width) {
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width);
    canvas.height = Math.round(img.height * (width / img.width));
    // Sin fondo: el lienzo arranca transparente y así se queda.
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    return new Promise((resolve, reject) => {
        canvas.toBlob(
            blob => blob ? resolve(blob) : reject(new Error('Error al procesar la imagen')),
            'image/png'
        );
    });
}

/**
 * Convierte la imagen a PNG de como mucho 1600 px de ancho y, si pasa de
 * 2 MB, baja la resolución por pasos hasta 1200 px.
 *
 * Un PNG que ya cumple ancho y peso se sube tal cual, sin recodificarlo.
 *
 * @param {File} file - Imagen original (ya validada con validateImageFile)
 * @returns {Promise<File>} Imagen PNG lista para subir
 */
export async function compressImage(file) {
    const img = await loadImage(file);
    const yaSirve = file.type === 'image/png' && img.width <= MAX_WIDTH && file.size <= TARGET_MAX_BYTES;
    if (yaSirve) return file;

    let width = Math.min(MAX_WIDTH, img.width);
    let best = await renderPng(img, width);

    // Una imagen pequeña de origen no se reduce más: ya está por debajo del mínimo.
    while (best.size > TARGET_MAX_BYTES && width * SCALE_STEP >= MIN_WIDTH) {
        width *= SCALE_STEP;
        best = await renderPng(img, width);
    }

    const fileName = file.name.replace(/\.[^.]+$/, '') + '.png';
    return new File([best], fileName, { type: 'image/png' });
}
