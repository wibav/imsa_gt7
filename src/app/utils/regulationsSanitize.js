/**
 * Saneo de HTML del reglamento de campeonato con DOMPurify.
 * Configuración ÚNICA compartida entre el navegador y los scripts de QA en
 * Node (vía JSDOM) — evita que existan dos copias de la lista blanca que
 * puedan divergir.
 */
import DOMPurify from 'dompurify';
import {
    REGULATIONS_ALLOWED_TAGS,
    REGULATIONS_ALLOWED_ATTR,
    REGULATIONS_ALLOWED_URI_REGEXP
} from './regulations.js';

function getConfig() {
    return {
        ALLOWED_TAGS: REGULATIONS_ALLOWED_TAGS,
        ALLOWED_ATTR: REGULATIONS_ALLOWED_ATTR,
        ALLOWED_URI_REGEXP: REGULATIONS_ALLOWED_URI_REGEXP,
        FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'svg', 'math', 'img'],
        FORBID_ATTR: ['style', 'srcset', 'formaction'],
        ALLOW_DATA_ATTR: false,
        ALLOW_ARIA_ATTR: false
    };
}

function attachLinkHook(purifier) {
    purifier.addHook('afterSanitizeAttributes', (node) => {
        if (node.tagName !== 'A') return;

        const href = node.getAttribute('href');
        if (href && !REGULATIONS_ALLOWED_URI_REGEXP.test(href)) {
            node.removeAttribute('href');
        }

        if (node.hasAttribute('href')) {
            node.setAttribute('target', '_blank');
            node.setAttribute('rel', 'noopener noreferrer');
        } else {
            node.removeAttribute('target');
            node.removeAttribute('rel');
        }
    });
}

/**
 * Crea una instancia de sanitizador ligada a una ventana dada (navegador o
 * `new JSDOM('').window` en Node). Usa la MISMA configuración que el
 * sanitizador por defecto del navegador.
 * @param {Window} win
 * @returns {{ sanitize: (html: string) => string }}
 */
export function createRegulationsSanitizer(win) {
    const purifier = DOMPurify(win);
    attachLinkHook(purifier);
    const config = getConfig();
    return {
        sanitize: (html) => purifier.sanitize(html || '', config)
    };
}

let defaultSanitizer = null;

/**
 * Sanea HTML del reglamento usando la ventana global del navegador.
 * Solo debe llamarse en cliente (nunca durante `next build`/SSR).
 * @param {string} html
 * @returns {string}
 */
export function sanitizeRegulationsHtml(html) {
    if (typeof window === 'undefined') return '';
    if (!defaultSanitizer) {
        defaultSanitizer = createRegulationsSanitizer(window);
    }
    return defaultSanitizer.sanitize(html);
}
