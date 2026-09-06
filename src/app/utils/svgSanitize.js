import DOMPurify from 'dompurify';

/**
 * Saneado de SVG antes de inyectarlo con dangerouslySetInnerHTML.
 *
 * El SVG del creador de vinilos lo genera nuestra propia Cloud Function con
 * vtracer (solo paths automáticos), así que el riesgo real hoy es bajo. Aun
 * así se sanea: es contenido que entra por red y termina en el DOM, y es el
 * mismo criterio que ya se aplica al reglamento (ver regulationsSanitize.js).
 * Si algún día la respuesta viniera manipulada, un <script> o un onload dentro
 * del SVG se ejecutarían con los permisos de la página.
 *
 * Se usa el perfil SVG de DOMPurify en vez de una lista propia para no ir
 * persiguiendo etiquetas a mano.
 *
 * Patrón de fábrica igual que en regulationsSanitize: permite instanciarlo con
 * JSDOM desde Node en pruebas, donde no hay `window`.
 */
export function createSvgSanitizer(win) {
    const purify = DOMPurify(win);

    // <foreignObject> permite meter HTML arbitrario dentro del SVG, que es la
    // vía habitual para colar scripts saltándose el perfil SVG.
    purify.addHook('uponSanitizeElement', (node, data) => {
        if (data.tagName === 'foreignobject') {
            node.parentNode?.removeChild(node);
        }
    });

    return (svg) => {
        if (!svg) return '';
        return purify.sanitize(svg, {
            USE_PROFILES: { svg: true, svgFilters: true },
            FORBID_TAGS: ['script', 'foreignObject', 'a', 'use', 'image'],
            FORBID_ATTR: ['onload', 'onerror', 'onclick', 'href', 'xlink:href'],
        });
    };
}

/** Sanea un SVG en el navegador. Fuera de él devuelve cadena vacía. */
export function sanitizeSvg(svg) {
    if (typeof window === 'undefined') return '';
    return createSvgSanitizer(window)(svg);
}
