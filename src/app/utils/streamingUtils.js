/**
 * Transmisiones de un campeonato: una por canal, con las salas que narra.
 *
 * Con divisiones cada sala tiene su propio caster y stream (en la GR.4,
 * deshbourne narra Zeus y mr__gomez Poseidon), pero la web solo mostraba el
 * caster del campeonato: el resto quedaba escondido en la pestaña Salas.
 *
 * Se agrupa por canal y no por sala porque un mismo caster narra a veces
 * varias salas seguidas (Primavera: SegurataLoco86 en División A y B), y
 * repetir su botón no aporta nada.
 */

import { STREAMING_PLATFORMS } from './constants';

/** Plataforma a partir de la URL, para las salas, que no guardan `platform`. */
export function plataformaDeUrl(url = '') {
    const u = String(url).toLowerCase();
    const value = u.includes('twitch.tv') ? 'twitch'
        : (u.includes('youtube.com') || u.includes('youtu.be')) ? 'youtube'
            : u.includes('kick.com') ? 'kick'
                : u.includes('facebook.com') || u.includes('fb.gg') ? 'facebook'
                    : 'other';
    return STREAMING_PLATFORMS.find(p => p.value === value);
}

/** "https://www.twitch.tv/leoncoach" → "leoncoach", para salas sin caster escrito. */
function canalDeUrl(url = '') {
    const m = String(url).match(/(?:twitch\.tv|kick\.com|youtube\.com\/@?)\/?@?([\w.-]+)/i);
    return m ? m[1] : null;
}

const claveUrl = (url) => String(url || '').trim().toLowerCase().replace(/\/+$/, '').replace(/^https?:\/\/(www\.)?/, '');

/**
 * @param {Object} championship
 * @param {Array} divisions - Salas del campeonato
 * @returns {Array<{url: string, caster: string|null, hosts: string[],
 *   plataforma: Object|undefined, salas: Array<{name: string, color: string, hour: string}>}>}
 */
export function transmisionesDe(championship, divisions = []) {
    const porCanal = new Map();

    [...divisions]
        .sort((a, b) => (a.order || 0) - (b.order || 0))
        .forEach(div => {
            if (!div?.streamUrl) return;
            const clave = claveUrl(div.streamUrl);
            if (!porCanal.has(clave)) {
                porCanal.set(clave, {
                    url: div.streamUrl,
                    caster: null,
                    hosts: [],
                    plataforma: plataformaDeUrl(div.streamUrl),
                    salas: [],
                });
            }
            const t = porCanal.get(clave);
            if (!t.caster && div.casterName) t.caster = div.casterName;
            if (div.hostName && !t.hosts.some(h => h.toLowerCase() === div.hostName.toLowerCase())) {
                t.hosts.push(div.hostName);
            }
            t.salas.push({ name: div.name, color: div.color || '#f97316', hour: div.hour || null });
        });

    // Sin salas con stream, la transmisión es la del campeonato, como hasta ahora.
    const s = championship?.streaming;
    if (porCanal.size === 0 && s?.url) {
        return [{
            url: s.url,
            caster: s.casterName || null,
            hosts: s.hostName ? [s.hostName] : [],
            plataforma: STREAMING_PLATFORMS.find(p => p.value === s.platform) || plataformaDeUrl(s.url),
            salas: [],
        }];
    }

    return [...porCanal.values()].map(t => ({ ...t, caster: t.caster || canalDeUrl(t.url) || 'Stream' }));
}
