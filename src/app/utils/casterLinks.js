/**
 * Redes de la Zona Caster: plataformas, normalización de enlaces y orden
 * aleatorio.
 *
 * Cada caster guarda una lista abierta `redes: [{ plataforma, url, etiqueta }]`.
 * Las plataformas conocidas tienen color propio y aceptan el enlace completo
 * o solo el usuario ("@pepe", "pepe"); se guarda siempre la URL completa, y
 * una URL de otra web se rechaza para que el botón de Twitch no acabe
 * llevando a cualquier sitio. "Otra" admite cualquier web con su nombre.
 *
 * Módulo puro: sin React ni Firebase.
 */

// base: perfil a partir del usuario. Sin base, solo se acepta la URL completa.
export const PLATAFORMAS = [
    { id: 'twitch', etiqueta: 'Twitch', hosts: ['twitch.tv'], base: 'https://www.twitch.tv/', arroba: false, color: 'bg-[#9146FF] hover:bg-[#7c3aed] text-white' },
    { id: 'youtube', etiqueta: 'YouTube', hosts: ['youtube.com', 'youtu.be'], base: 'https://www.youtube.com/', arroba: true, color: 'bg-[#FF0000] hover:bg-[#cc0000] text-white' },
    { id: 'kick', etiqueta: 'Kick', hosts: ['kick.com'], base: 'https://kick.com/', arroba: false, color: 'bg-[#53FC18] hover:bg-[#45d614] text-black' },
    { id: 'tiktok', etiqueta: 'TikTok', hosts: ['tiktok.com'], base: 'https://www.tiktok.com/', arroba: true, color: 'bg-black hover:bg-neutral-800 border border-white/20 text-white' },
    { id: 'instagram', etiqueta: 'Instagram', hosts: ['instagram.com'], base: 'https://www.instagram.com/', arroba: false, color: 'bg-gradient-to-r from-[#F58529] via-[#DD2A7B] to-[#8134AF] hover:brightness-110 text-white' },
    { id: 'facebook', etiqueta: 'Facebook', hosts: ['facebook.com', 'fb.gg', 'fb.watch'], base: 'https://www.facebook.com/', arroba: false, color: 'bg-[#1877F2] hover:bg-[#1465d0] text-white' },
    { id: 'x', etiqueta: 'X', hosts: ['x.com', 'twitter.com'], base: 'https://x.com/', arroba: false, color: 'bg-black hover:bg-neutral-800 border border-white/20 text-white' },
    { id: 'trovo', etiqueta: 'Trovo', hosts: ['trovo.live'], base: 'https://trovo.live/s/', arroba: false, color: 'bg-[#19D66B] hover:bg-[#15b75b] text-black' },
    { id: 'discord', etiqueta: 'Discord', hosts: ['discord.gg', 'discord.com'], base: null, color: 'bg-[#5865F2] hover:bg-[#4752c4] text-white' },
    { id: 'otra', etiqueta: 'Otra', hosts: null, base: null, color: 'bg-white/15 hover:bg-white/25 text-white' },
];

const porId = (id) => PLATAFORMAS.find(p => p.id === id) || PLATAFORMAS.find(p => p.id === 'otra');

const esDelHost = (host, permitidos) => permitidos.some(h => host === h || host.endsWith(`.${h}`));

const pareceUrl = (texto) => /^(https?:\/\/|www\.)/i.test(texto) || /\.[a-z]{2,}(\/|$)/i.test(texto);

const aUrl = (texto) => {
    try {
        const url = new URL(/^https?:\/\//i.test(texto) ? texto : `https://${texto}`);
        if (!url.hostname.includes('.')) return null;
        url.protocol = 'https:';
        return url;
    } catch {
        return null;
    }
};

/** Plataforma conocida a la que pertenece un enlace, o null. */
export function detectarPlataforma(texto) {
    const url = pareceUrl(String(texto || '').trim()) ? aUrl(String(texto).trim()) : null;
    if (!url) return null;
    const host = url.hostname.toLowerCase();
    return PLATAFORMAS.find(p => p.hosts && esDelHost(host, p.hosts))?.id || null;
}

/**
 * Convierte lo escrito en el panel en la URL del perfil.
 * Vacío → ''. Lanza un Error con mensaje legible si no es válido.
 */
export function normalizarEnlace(plataforma, valor) {
    const p = porId(plataforma);
    const texto = String(valor ?? '').trim();
    if (!texto) return '';
    const nombre = p.id === 'otra' ? 'Enlace' : p.etiqueta;

    if (pareceUrl(texto) || !p.base) {
        const url = aUrl(texto);
        if (!url) throw new Error(`${nombre}: el enlace no es válido.`);
        if (p.hosts && !esDelHost(url.hostname.toLowerCase(), p.hosts)) {
            throw new Error(`${nombre}: el enlace debe ser de ${p.hosts.join(' o ')}.`);
        }
        return url.toString();
    }

    const usuario = texto.replace(/^@/, '');
    if (!/^[\w.\-]{2,60}$/.test(usuario)) {
        throw new Error(`${nombre}: escribe el enlace al perfil o el nombre de usuario.`);
    }
    return `${p.base}${p.arroba ? '@' : ''}${usuario}`;
}

/**
 * Limpia la lista del formulario para guardarla: quita filas vacías,
 * normaliza los enlaces y quita duplicados. Lanza Error si alguna no es válida.
 */
export function normalizarRedes(redes = []) {
    const vistas = new Set();
    const limpias = [];
    (redes || []).forEach(r => {
        const url = normalizarEnlace(r.plataforma, r.url);
        if (!url || vistas.has(url)) return;
        vistas.add(url);
        const plataforma = porId(r.plataforma).id;
        const etiqueta = plataforma === 'otra'
            ? (String(r.etiqueta || '').trim() || new URL(url).hostname.replace(/^www\./, ''))
            : '';
        limpias.push({ plataforma, url, etiqueta });
    });
    return limpias;
}

/** Nombre y color con que se pinta una red. */
export function estiloRed(red) {
    const p = porId(red.plataforma);
    return { etiqueta: p.id === 'otra' ? (red.etiqueta || 'Web') : p.etiqueta, color: p.color };
}

/** Redes de un caster. */
export const redesDe = (caster) => (Array.isArray(caster?.redes) ? caster.redes : []);

/** Copia barajada (Fisher–Yates): cada visita ve a los casters en otro orden. */
export function barajar(lista, aleatorio = Math.random) {
    const copia = [...lista];
    for (let i = copia.length - 1; i > 0; i--) {
        const j = Math.floor(aleatorio() * (i + 1));
        [copia[i], copia[j]] = [copia[j], copia[i]];
    }
    return copia;
}
