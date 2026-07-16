/**
 * Compresión de imágenes en el cliente antes de subir a Firebase Storage.
 * Objetivo: banners entre 500 KB y 800 KB, sin depender de librerías externas
 * (usa <canvas> nativo del navegador).
 *
 * Ver docs técnicos: Notas/Proyectos/GT7 Championships/02-ESPECIFICACIONES.md (SPEC-7)
 */

const MAX_ORIGIN_BYTES = 10 * 1024 * 1024; // rechazo duro antes de intentar comprimir
const TARGET_MIN_BYTES = 500 * 1024;
const TARGET_MAX_BYTES = 800 * 1024;
const MAX_WIDTH = 1600;
const MAX_QUALITY_ITERATIONS = 6;

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

function canvasToBlob(canvas, quality) {
    return new Promise((resolve, reject) => {
        canvas.toBlob(
            blob => blob ? resolve(blob) : reject(new Error('Error al procesar la imagen')),
            'image/jpeg',
            quality
        );
    });
}

/**
 * Comprime una imagen apuntando a un peso final entre 500 KB y 800 KB.
 * Si la imagen original ya pesa menos de 800 KB, se devuelve tal cual
 * (no tiene sentido recomprimir ni "inflar" un archivo ya liviano).
 *
 * @param {File} file - Imagen original (ya validada con validateImageFile)
 * @returns {Promise<File>} Imagen resultante (JPEG), lista para subir
 */
export async function compressImage(file) {
    if (file.size <= TARGET_MAX_BYTES) {
        return file;
    }

    const img = await loadImage(file);
    const scale = Math.min(1, MAX_WIDTH / img.width);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    // Búsqueda binaria de calidad JPEG para caer en el rango objetivo
    let lo = 0.4, hi = 0.95;
    let best = await canvasToBlob(canvas, hi);

    for (let i = 0; i < MAX_QUALITY_ITERATIONS; i++) {
        const mid = (lo + hi) / 2;
        const blob = await canvasToBlob(canvas, mid);

        if (blob.size >= TARGET_MIN_BYTES && blob.size <= TARGET_MAX_BYTES) {
            best = blob;
            break;
        }
        if (blob.size > TARGET_MAX_BYTES) {
            hi = mid;
        } else {
            lo = mid;
            best = blob; // por debajo del máximo es aceptable como último recurso
        }
    }

    const fileName = file.name.replace(/\.[^.]+$/, '') + '.jpg';
    return new File([best], fileName, { type: 'image/jpeg' });
}
