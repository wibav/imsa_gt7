/**
 * Resolución de organización por URL (Fase 3 — SPEC-3).
 *
 * Formato: trenkit.com/l/{slug}. El prefijo /l/ evita que el slug de una
 * organización choque con las rutas del sistema (championships, events, etc.)
 * — ver ADR-002.
 */

export const ORG_PATH_PREFIX = '/l';

// Segmentos que nunca pueden usarse como slug de organización, sea en la
// raíz o pensando a futuro. Incluye las carpetas reales de src/app y el
// propio prefijo.
export const RESERVED_SLUGS = [
    'l', 'api', 'championships', 'championshipsadmin', 'equipamiento',
    'equipamientoadmin', 'events', 'eventsadmin', 'login', 'pilots',
    'reglamento', 'teamsadmin', 'tools', 'tracksadmin', 'usersadmin',
    'admin', 'www', 'app', 'signup',
];

/**
 * Extrae el slug de organización de un pathname, si corresponde.
 * @param {string} pathname - ej. "/l/hispania-game-team" o "/championships"
 * @returns {string|null} el slug, o null si el path no usa el prefijo /l/
 */
export function parseOrgSlugFromPath(pathname) {
    if (!pathname) return null;
    const match = pathname.match(/^\/l\/([^/]+)/);
    return match ? match[1] : null;
}

/**
 * Valida un slug propuesto para una nueva organización.
 * @param {string} slug
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateOrgSlug(slug) {
    if (!slug || typeof slug !== 'string') {
        return { valid: false, error: 'El slug es obligatorio' };
    }
    if (slug.length < 3 || slug.length > 40) {
        return { valid: false, error: 'Debe tener entre 3 y 40 caracteres' };
    }
    if (!/^[a-z0-9-]+$/.test(slug)) {
        return { valid: false, error: 'Solo minúsculas, números y guiones' };
    }
    if (slug.startsWith('-') || slug.endsWith('-')) {
        return { valid: false, error: 'No puede empezar ni terminar con guion' };
    }
    if (RESERVED_SLUGS.includes(slug.toLowerCase())) {
        return { valid: false, error: `"${slug}" es una palabra reservada` };
    }
    return { valid: true };
}
