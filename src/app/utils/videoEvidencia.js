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

// YouTube no admite < ni > en título ni descripción
const limpio = (v, max = 200) => {
    const s = String(v ?? '').replace(/[<>]/g, '').replace(/\s+\n/g, '\n').trim();
    return s.length > max ? `${s.slice(0, max - 1)}…` : s;
};
const lista = (v) => (Array.isArray(v) ? v : [v]).map(x => limpio(x, 60)).filter(Boolean);

/**
 * Borrador que manda el formulario: solo se aceptan estos campos, acotados.
 * Con claimId la función usa la reclamación guardada en su lugar.
 */
export function contextoSeguro(c = {}) {
    if (!c || typeof c !== 'object') return {};
    return {
        reporterName: limpio(c.reporterName, 60),
        accusedNames: lista(c.accusedNames || []).slice(0, 10),
        lap: limpio(c.lap, 10),
        minute: limpio(c.minute, 10),
        description: limpio(c.description, 1500),
        autor: limpio(c.autor, 60),
        texto: limpio(c.texto, 1500),
    };
}

const carreraTexto = ({ carrera, ronda }) => (carrera ? `${ronda ? `R${ronda} · ` : ''}${limpio(carrera, 60)}` : '');

/**
 * Título del vídeo en YouTube (máximo 100 caracteres):
 * «Reclamación · R3 · SUGO · Reporta vs Acusado».
 */
export function tituloVideo({ tipo, campeonato, carrera, ronda, reclamacion = {}, autor }) {
    const acusados = lista(reclamacion.accusedNames || []);
    const quien = tipo === 'reclamacion'
        ? [limpio(reclamacion.reporterName, 40), acusados.join(', ')].filter(Boolean).join(' vs ')
        : limpio(autor, 40);
    const partes = [
        TIPOS_VIDEO[tipo] || 'Prueba',
        carreraTexto({ carrera, ronda }) || limpio(campeonato, 60),
        quien,
    ].filter(Boolean);
    return limpio(partes.join(' · '), 100);
}

/** Descripción del vídeo: lo que necesita quien lo vea para entender el incidente. */
export function descripcionVideo({ tipo, campeonato, carrera, ronda, fecha, reclamacion = {}, autor, texto, url }) {
    const acusados = lista(reclamacion.accusedNames || []);
    const momento = [
        reclamacion.lap ? `vuelta ${limpio(reclamacion.lap, 10)}` : '',
        reclamacion.minute ? `minuto ${limpio(reclamacion.minute, 10)}` : '',
    ].filter(Boolean).join(' · ');
    const dia = /^\d{4}-\d{2}-\d{2}/.test(String(fecha || '')) ? String(fecha).slice(0, 10).split('-').reverse().join('-') : '';
    // Cada bloque son sus líneas con contenido; los bloques se separan con una línea en blanco
    const bloque = (...l) => l.filter(Boolean).join('\n');
    const original = bloque(
        reclamacion.reporterName && `Reporta: ${limpio(reclamacion.reporterName, 60)}`,
        acusados.length && `${acusados.length > 1 ? 'Acusados' : 'Acusado'}: ${acusados.join(', ')}`,
        momento && `Momento: ${momento}`,
        reclamacion.description && `Incidente: ${limpio(reclamacion.description, 1500)}`,
    );
    const bloques = [
        bloque(
            `${(TIPOS_VIDEO[tipo] || 'Prueba').toUpperCase()} · ${limpio(campeonato, 100)}`,
            carrera && `Carrera: ${carreraTexto({ carrera, ronda })}${dia ? ` · ${dia}` : ''}`,
        ),
        tipo === 'descargo' && bloque(`Descargo de: ${limpio(autor, 60)}`, texto && `Su versión: ${limpio(texto, 1500)}`),
        tipo === 'alegacion' && bloque(`Alegación de: ${limpio(autor, 60)}`, texto && `Motivo: ${limpio(texto, 1500)}`),
        original && (tipo === 'reclamacion' ? original : `Reclamación original:\n${original}`),
        url && `Ver en la web: ${url}`,
    ];
    // Por debajo del máximo de YouTube (5000 bytes)
    return hastaBytes(bloques.filter(Boolean).join('\n\n'), 4800);
}

/** Recorta por bytes UTF-8 (tildes y emojis ocupan más de uno) sin partir caracteres. */
function hastaBytes(s, max) {
    const enc = new TextEncoder();
    if (enc.encode(s).length <= max) return s;
    let out = '';
    for (const ch of s) {
        if (enc.encode(out + ch + '…').length > max) break;
        out += ch;
    }
    return `${out}…`;
}

/** Errores de la función → clave de texto del formulario. */
export const ERRORES_VIDEO = {
    tipo: 'errTipo',
    tamano: 'errTamano',
    limite: 'errLimite',
    campeonato: 'errRed',
};
