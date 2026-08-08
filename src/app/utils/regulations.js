/**
 * Utilidades puras (sin DOM, sin dependencias) para el reglamento de campeonato.
 * Importable desde el navegador y desde scripts Node (.mjs) para QA.
 *
 * NOTA: este módulo define la lista blanca de tags/atributos "real" del
 * proyecto. `scripts/prerender-content.js` (CommonJS) mantiene una copia
 * simplificada en `stripTags()` para el snapshot SEO — si cambia el
 * esquema de tags permitidos aquí, hay que sincronizarlo allá también.
 */

export const REGULATIONS_MAX_BYTES = 100 * 1024; // 100 KB, Firestore cuenta bytes UTF-8

export const REGULATIONS_ALLOWED_TAGS = ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'h3', 'h4', 'ul', 'ol', 'li', 'a'];
export const REGULATIONS_ALLOWED_ATTR = ['href', 'target', 'rel'];
export const REGULATIONS_ALLOWED_URI_REGEXP = /^(?:https?:|mailto:)/i;

/**
 * Tamaño en bytes UTF-8 de un string (Firestore cuenta bytes, no String.length).
 * @param {string} html
 * @returns {number}
 */
export function regulationsByteSize(html) {
    if (!html) return 0;
    return new TextEncoder().encode(html).length;
}

/**
 * Convierte texto plano legacy en HTML seguro para el editor.
 * Escapa entidades PRIMERO, luego construye párrafos/saltos de línea.
 * @param {string} text
 * @returns {string}
 */
export function plainTextToRegulationsHtml(text) {
    if (!text) return '';
    const escaped = String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

    const paragraphs = escaped.split(/\n{2,}/);
    return paragraphs
        .map(p => `<p>${p.split('\n').join('<br>')}</p>`)
        .join('');
}

/**
 * Extrae texto plano aproximado de HTML del reglamento (DOM-free, regex/string).
 * Su salida NUNCA se inyecta como HTML — se usa para snapshot SEO (donde se
 * re-escapa) y para detectar contenido vacío.
 * @param {string} html
 * @returns {string}
 */
export function regulationsHtmlToPlainText(html) {
    if (!html) return '';
    let text = String(html);

    // Saltos de línea a partir de <br> y cierres de bloque. Los cierres de
    // bloque producen doble salto (separador de párrafo), coherente con
    // `plainTextToRegulationsHtml` (que parte por \n{2,} en <p>).
    text = text.replace(/<br\s*\/?>/gi, '\n');
    text = text.replace(/<\/(p|h3|h4|li|ul|ol)>/gi, '\n\n');

    // Quitar el resto de tags
    text = text.replace(/<[^>]*>/g, '');

    // Decodificar entidades básicas
    text = text
        .replace(/&nbsp;/gi, ' ')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
        .replace(/&amp;/gi, '&');

    // Colapsar líneas en blanco excesivas y recortar
    text = text.replace(/\n{3,}/g, '\n\n').split('\n').map(l => l.trim()).join('\n').trim();

    return text;
}

/**
 * Determina si el contenido del reglamento está vacío (null, whitespace,
 * o marcado vacío tipo <p></p>/<p><br></p>/<p>&nbsp;</p>).
 * @param {string|null} regulations
 * @param {'html'|'plain'|null} [format]
 * @returns {boolean}
 */
export function isRegulationsEmpty(regulations, format) {
    if (!regulations) return true;
    if (typeof regulations !== 'string') return true;
    if (regulations.trim() === '') return true;

    if (format === 'html') {
        const plain = regulationsHtmlToPlainText(regulations);
        return plain.trim() === '';
    }

    return regulations.trim() === '';
}

/**
 * Normaliza el par (html, format) antes de guardar: si está vacío, ambos
 * campos vuelven a null; si no, se guarda el html tal cual (ya saneado por
 * el caller) junto al discriminador 'html'.
 * @param {{ html: string, format: 'html'|'plain'|null }} params
 * @returns {{ regulations: string|null, regulationsFormat: 'html'|'plain'|null }}
 */
export function normalizeRegulationsForSave({ html, format }) {
    if (isRegulationsEmpty(html, format)) {
        return { regulations: null, regulationsFormat: null };
    }
    return { regulations: html, regulationsFormat: format === 'html' ? 'html' : format };
}

/**
 * Genera un nombre de archivo determinista y válido multiplataforma para
 * el PDF del reglamento.
 * @param {{ shortName?: string, name?: string, season?: string }} championship
 * @returns {string}
 */
export function regulationsFilename(championship) {
    const base = (championship?.shortName || championship?.name || 'campeonato').toString();
    const season = (championship?.season || '').toString();

    const slugify = (s) => s
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '') // quitar acentos
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');

    let slug = slugify(base);
    const seasonSlug = slugify(season);

    let filename = slug
        ? (seasonSlug ? `reglamento-${slug}-${seasonSlug}` : `reglamento-${slug}`)
        : 'reglamento';
    const MAX_BASE_LENGTH = 76; // 80 - '.pdf'.length, para que el archivo final quede <= 80 chars
    if (filename.length > MAX_BASE_LENGTH) filename = filename.slice(0, MAX_BASE_LENGTH).replace(/-+$/, '');
    if (!filename) filename = 'reglamento';

    return `${filename}.pdf`;
}
