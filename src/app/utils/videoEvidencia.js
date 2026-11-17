/**
 * Clips de prueba subidos a YouTube desde los formularios de reclamación,
 * descargo y alegación.
 *
 * El navegador del piloto envía el vídeo directamente a YouTube: la función
 * subir_video_youtube (functions-node) abre una sesión de subida de un solo
 * uso en la cuenta de las reclamaciones y devuelve su dirección. La
 * autorización de esa cuenta nunca sale del servidor. El vídeo queda como
 * «Oculto»: lo ve quien tenga el enlace, y el comisario IA puede analizarlo.
 *
 * Límites compartidos por la web y la función. Módulo puro: sin React ni
 * Firebase.
 */

/** Los clips de un incidente duran 15-30 s: 300 MB sobran incluso en 4K. */
export const VIDEO_MAX_MB = 300;
export const VIDEO_MAX_BYTES = VIDEO_MAX_MB * 1024 * 1024;
export const VIDEO_MAX_SEGUNDOS = 60;
export const VIDEOS_POR_FORMULARIO = 3;

/** Límites diarios de la función, para no agotar el cupo de YouTube. */
export const SUBIDAS_POR_IP_DIA = 10;
export const SUBIDAS_TOTALES_DIA = 60;

export const TIPOS_VIDEO = {
    reclamacion: 'Reclamación',
    descargo: 'Descargo',
    alegacion: 'Alegación',
};

/** Título del vídeo en YouTube (máximo 100 caracteres). */
export function tituloVideo({ tipo, campeonato, carrera, ronda }) {
    const partes = [
        TIPOS_VIDEO[tipo] || 'Prueba',
        campeonato,
        carrera ? `${ronda ? `R${ronda} · ` : ''}${carrera}` : '',
    ].map(p => String(p || '').replace(/[<>]/g, '').trim()).filter(Boolean);
    const titulo = partes.join(' · ');
    return titulo.length > 100 ? `${titulo.slice(0, 99)}…` : titulo;
}

/** Errores de la función → clave de texto del formulario. */
export const ERRORES_VIDEO = {
    tipo: 'errTipo',
    tamano: 'errTamano',
    limite: 'errLimite',
    campeonato: 'errRed',
};
