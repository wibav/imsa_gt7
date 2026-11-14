/**
 * Imágenes de campeones (pestaña «Imágenes» del campeonato).
 *
 * Cuando una sala corre todas sus carreras, el administrador elige entre
 * generar la imagen de sus tres primeros con IA (función
 * generar_imagen_podio en functions-node) o subir una propia. Cada imagen
 * vive en championships/{id}/podiumImages/{clave}, donde la clave es el id
 * de la sala o CLAVE_GENERAL si el campeonato no tiene salas.
 *
 * El podio se guarda en el documento al pedir la imagen: la clasificación
 * de una sala cambia cuando la rotación mueve a sus pilotos, y la imagen
 * tiene que retratar a quienes ganaron.
 *
 * Módulo puro: sin React ni Firebase.
 */
import { claveNombre } from './nombresPiloto.js';

export const CLAVE_GENERAL = 'general';

/** Estados del documento */
export const ESTADO_IMAGEN = {
    GENERANDO: 'generando',
    LISTA: 'lista',
    ERROR: 'error',
};

const cuenta = (t) => t?.status !== 'cancelled';
const tienePosiciones = (bloque) => Object.keys(bloque?.racePositions || {}).length > 0;

/**
 * Salas que ya corrieron todas sus carreras. Sin salas, el campeonato entero
 * cuenta como una (CLAVE_GENERAL).
 *
 * @returns {Array<{ key, name, color, terminada }>}
 */
export function salasDelCampeonato(championship, tracks = [], divisions = []) {
    const carreras = (tracks || []).filter(cuenta);
    const hayCarreras = carreras.length > 0;
    if (championship?.divisionsConfig?.enabled && divisions.length > 0) {
        return [...divisions]
            .sort((a, b) => (a.order || 0) - (b.order || 0))
            .map(div => ({
                key: div.id,
                name: div.name || '',
                color: div.color || '',
                terminada: hayCarreras && carreras.every(t => tienePosiciones(t.results?.divisions?.[div.id])),
            }));
    }
    return [{
        key: CLAVE_GENERAL,
        name: '',
        color: '',
        terminada: hayCarreras && carreras.every(t => tienePosiciones(t.results) ||
            Object.values(t.results?.divisions || {}).some(tienePosiciones)),
    }];
}

/** Coche que más usó un piloto en el campeonato (según carsUsed de cada carrera). */
export function cocheMasUsado(nombre, tracks = []) {
    const clave = claveNombre(nombre);
    const usos = {};
    (tracks || []).forEach(t => Object.entries(t.carsUsed || {}).forEach(([piloto, coche]) => {
        if (coche && typeof coche === 'string' && claveNombre(piloto) === clave) usos[coche] = (usos[coche] || 0) + 1;
    }));
    return Object.entries(usos).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
}

/** Los tres primeros de una clasificación, con lo que hace falta para la imagen. */
export function podioDe(driverStandings = [], tracks = []) {
    return (driverStandings || []).slice(0, 3).map((d, i) => ({
        pos: i + 1,
        name: d.name,
        points: d.totalPoints ?? 0,
        wins: d.wins ?? 0,
        car: cocheMasUsado(d.name, tracks),
    }));
}

// Ambientación por nombre de sala: las salas suelen llevar nombre de dioses.
const TEMAS = [
    [/zeus|j[uú]piter/, 'Zeus, king of the Greek gods: dark stormy sky with crackling lightning, white marble Greek temple columns, gold highlights'],
    [/poseid[oó]n|neptun/, 'Poseidon, god of the sea: deep ocean blues, crashing waves and sea spray, a golden trident motif, silver-white highlights'],
    [/morfeo|morpheus|hypnos|hipnos/, 'Morpheus, god of dreams: a dreamlike night sky, soft swirling mist, stars and a crescent moon, ethereal glow'],
    [/hades|plut[oó]n/, 'Hades, god of the underworld: dark volcanic landscape, embers and blue spectral flames'],
    [/thor/, 'Thor, Norse god of thunder: storm clouds, lightning and a mighty hammer motif, Nordic runes'],
    [/lok[iy]/, 'Loki, Norse trickster god: emerald mist, serpentine motifs, mischievous magical glow'],
    [/ares|marte|mars/, 'Ares, god of war: blazing red sky, bronze shields and spears, battlefield dust'],
    [/atenea|athena|minerva/, 'Athena, goddess of wisdom: olive branches, an owl motif, Parthenon columns in golden light'],
    [/apolo|apollo/, 'Apollo, god of the sun: radiant golden sunrise, sun rays and a laurel wreath'],
    [/hermes|mercurio/, 'Hermes, messenger god: winged motifs and streaks of speed across a bright sky'],
];

export function temaDeSala(nombreSala = '') {
    const n = String(nombreSala).toLowerCase();
    return TEMAS.find(([re]) => re.test(n))?.[1]
        || 'a grand championship celebration: trophy glow, golden light beams and fireworks';
}

const comillas = (s) => String(s ?? '').replace(/"/g, "'");

/**
 * Prompt para el generador de imágenes. Va en inglés (es como mejor
 * responden los modelos) con el texto de la imagen tal cual, en español.
 */
export function construirPromptPodio({ championshipName, salaName, color, podium = [] }) {
    const colorTexto = color ? ` (${String(color).toUpperCase()})` : '';
    const lugares = { 1: 'center (1st, gold)', 2: 'left (2nd, silver)', 3: 'right (3rd, bronze)' };
    const coches = podium
        .map(p => `${lugares[p.pos]} a ${comillas(p.car) || 'Gran Turismo'} race car`)
        .join('; ');
    const escalones = podium.map(p => `"${p.pos} · ${comillas(p.name)} · ${p.points} PTS"`).join(', ');
    const subtitulo = salaName ? `SALA ${comillas(salaName).toUpperCase()} · CAMPEONES` : 'CAMPEONES';
    return [
        'Square 1:1 motorsport championship winners poster, cinematic and premium.',
        `Theme: ${temaDeSala(salaName)}${color ? `, with ${color.toUpperCase()} as the main accent colour` : ''}.`,
        'Center: a three-step winners podium under stadium floodlights at night, wet asphalt reflections, confetti.',
        coches ? `In front of the podium, race cars in podium order: ${coches}.` : '',
        `Bold modern racing typography, text exactly as written: top "${comillas(championshipName).toUpperCase()}", below it "${subtitulo}".`,
        escalones ? `On the podium steps: ${escalones}.` : '',
        `Accent colour${colorTexto} in lights and typography. No other text, no logos, no watermarks.`,
    ].filter(Boolean).join(' ');
}
