/**
 * Comunidad de WhatsApp de cada organización: ahí se publican avisos,
 * horarios y cambios, y los pilotos preguntan sus dudas. Se enseña en el
 * inicio y en todo el recorrido de inscripción (campeonatos y eventos).
 *
 * Una organización puede tener su propio enlace en organizations/{id}
 * (communityWhatsappUrl); si no, se usa el de esta tabla. Sin enlace no se
 * muestra nada: no se manda a pilotos de otra liga al grupo de GT7 ESP.
 *
 * Módulo puro: sin React ni Firebase.
 */
const ORG_POR_DEFECTO = 'gt7-esp';

export const COMUNIDAD_WHATSAPP = {
    'gt7-esp': 'https://chat.whatsapp.com/LSKsgLvzwCg06me2uXMizo?mode=gi_t',
};

/** Enlace de la comunidad para un campeonato/evento (por su orgId) o null. */
export function enlaceComunidad({ orgId, org } = {}) {
    const propio = org?.communityWhatsappUrl;
    if (typeof propio === 'string' && /^https:\/\/(chat\.whatsapp\.com|wa\.me|whatsapp\.com)\//.test(propio)) return propio;
    return COMUNIDAD_WHATSAPP[orgId || ORG_POR_DEFECTO] || null;
}
