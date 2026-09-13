/**
 * Siglas de equipo en los GT7 ID, y a qué equipo pertenece cada piloto.
 *
 * Muchos pilotos anteponen las siglas de su equipo al GT7 ID ("HGT_ALEX94",
 * "RRT_BLAS", "AAM Josetxu"). Aquí se leen esas siglas para PROPONER equipos
 * y miembros, pero nunca para decidir: GT7 solo deja cambiar el GT7 ID tres
 * veces, así que quien se va de un equipo puede seguir llevando sus siglas.
 * El equipo de un piloto es el que el Administrador de Plataforma confirma.
 * Ver el plan en docs/PLAN_EQUIPOS.md.
 *
 * Sin dependencias a propósito: lo usan la web, el script de auditoría y los
 * tests en node.
 */

/**
 * Siglas al principio del nombre.
 *
 * - Con `_`, `-` o `.` basta con 2-6 letras o dígitos: "Hgt_dayo21", "MR-Tony".
 * - Con espacio, solo si van en MAYÚSCULAS ("AAM Josetxu"): si no, "Carlos Ll"
 *   daría las siglas "CARLOS".
 * - El resto tiene que contener una letra: en "Dayo_21" el "21" no es un
 *   piloto, y "Dayo" no es un equipo.
 */
const CON_SEPARADOR = /^([A-Za-z0-9]{2,6})[_\-.]+\s*(.+)$/;
const CON_ESPACIO = /^([A-Z0-9]{2,6})\s+(.+)$/;

/**
 * @returns {{tag: string, resto: string} | null} tag en mayúsculas
 */
export function extraerSiglas(nombre) {
    const limpio = String(nombre || '').trim();
    const m = limpio.match(CON_SEPARADOR) || limpio.match(CON_ESPACIO);
    if (!m) return null;
    const [, tag, resto] = m;
    if (!/[A-Za-z]/.test(resto) || resto.length < 2) return null;
    if (!/[A-Za-z]/.test(tag)) return null; // "21_Nano" no son siglas
    return { tag: tag.toUpperCase(), resto: resto.trim() };
}

/** Clave para comparar siglas: "Hgt", "HGT", "hgt" son las mismas. */
export const claveSiglas = (tag) => String(tag || '').trim().toUpperCase();

/** Miembros actuales: sin fecha de salida. */
export const miembrosActuales = (equipo) => (equipo?.members || []).filter(m => m?.pilot && !m.to);

/**
 * Piloto → equipo, con los miembros actuales de todos los equipos.
 *
 * @param {Array} equipos
 * @param {Object} [resolver] - Mapa alias → GT7 ID unificado (buildGt7IdMap)
 * @returns {Object} nombre (y cada alias conocido) → equipo
 */
export function mapaEquipoPorPiloto(equipos = [], resolver = {}) {
    const mapa = {};
    equipos.forEach(eq => {
        miembrosActuales(eq).forEach(m => { mapa[m.pilot] = eq; });
    });
    // Un piloto que aparece con un alias antiguo también lleva su equipo.
    Object.entries(resolver).forEach(([alias, nombre]) => {
        if (mapa[nombre] && !mapa[alias]) mapa[alias] = mapa[nombre];
    });
    return mapa;
}

/**
 * Equipos propuestos a partir de las siglas.
 *
 * @param {string[]} nombres - Todos los nombres de piloto conocidos
 * @param {Object} opciones
 * @param {Object} [opciones.resolver] - alias → GT7 ID unificado, para no contar
 *        dos veces a la misma persona ("HGT_dayo21" y "Hgt_dayo21")
 * @param {Array} [opciones.equipos] - Equipos ya confirmados: sus siglas no se proponen
 * @param {string[]} [opciones.descartadas] - Siglas marcadas como "no es un equipo"
 * @param {Object} [opciones.apariciones] - nombre → veces, para ordenar
 * @param {number} [opciones.minPilotos=2]
 * @returns {Array<{tag: string, variantes: string[], pilotos: Array<{pilot: string, nombres: string[]}>}>}
 */
export function sugerirEquipos(nombres = [], {
    resolver = {},
    equipos = [],
    descartadas = [],
    apariciones = {},
    minPilotos = 2,
} = {}) {
    const ocupadas = new Set();
    equipos.forEach(eq => {
        ocupadas.add(claveSiglas(eq.tag));
        (eq.tagVariants || []).forEach(v => ocupadas.add(claveSiglas(v)));
    });
    const fuera = new Set(descartadas.map(claveSiglas));

    const porTag = new Map();
    nombres.forEach(nombre => {
        const s = extraerSiglas(nombre);
        if (!s || ocupadas.has(s.tag) || fuera.has(s.tag)) return;
        const variante = String(nombre).trim().match(/^[A-Za-z0-9]+/)[0];
        const pilot = resolver[nombre] || nombre;
        if (!porTag.has(s.tag)) porTag.set(s.tag, { tag: s.tag, variantes: new Set(), pilotos: new Map() });
        const g = porTag.get(s.tag);
        g.variantes.add(variante);
        if (!g.pilotos.has(pilot)) g.pilotos.set(pilot, new Set());
        g.pilotos.get(pilot).add(nombre);
    });

    const peso = (p) => [...p.nombres].reduce((a, n) => a + (apariciones[n] || 0), 0);

    return [...porTag.values()]
        .map(g => ({
            tag: g.tag,
            variantes: [...g.variantes].sort(),
            pilotos: [...g.pilotos.entries()]
                .map(([pilot, ns]) => ({ pilot, nombres: [...ns].sort() }))
                .sort((a, b) => peso(b) - peso(a) || a.pilot.localeCompare(b.pilot)),
        }))
        .filter(g => g.pilotos.length >= minPilotos)
        .sort((a, b) => b.pilotos.length - a.pilotos.length || a.tag.localeCompare(b.tag));
}

/**
 * Pilotos que llevan las siglas de un equipo confirmado y todavía no están
 * decididos: ni son miembros, ni se marcaron como "no es del equipo", ni son
 * miembros actuales de OTRO equipo (a esos se les avisa aparte).
 *
 * @returns {{nuevos: Array<{pilot, nombres}>, deOtroEquipo: Array<{pilot, nombres, equipo}>}}
 */
export function pilotosConSiglasDe(equipo, nombres = [], { resolver = {}, equipos = [] } = {}) {
    const claves = new Set([claveSiglas(equipo.tag), ...(equipo.tagVariants || []).map(claveSiglas)]);
    const decididos = new Set([
        ...(equipo.members || []).map(m => m.pilot),
        ...(equipo.notMembers || []).map(m => m.pilot),
    ]);
    const otros = mapaEquipoPorPiloto(equipos.filter(e => e.id !== equipo.id));

    const porPiloto = new Map();
    nombres.forEach(nombre => {
        const s = extraerSiglas(nombre);
        if (!s || !claves.has(s.tag)) return;
        const pilot = resolver[nombre] || nombre;
        if (decididos.has(pilot)) return;
        if (!porPiloto.has(pilot)) porPiloto.set(pilot, new Set());
        porPiloto.get(pilot).add(nombre);
    });

    const nuevos = [];
    const deOtroEquipo = [];
    [...porPiloto.entries()].forEach(([pilot, ns]) => {
        const item = { pilot, nombres: [...ns].sort() };
        if (otros[pilot]) deOtroEquipo.push({ ...item, equipo: otros[pilot] });
        else nuevos.push(item);
    });
    return { nuevos, deOtroEquipo };
}

/**
 * Comprueba la invariante antes de guardar: un piloto es miembro actual de
 * como mucho un equipo.
 *
 * @returns {string[]} descripciones de los conflictos ("ALEX94 (ya en RRT)")
 */
export function conflictosDeMiembros(equipo, equipos = []) {
    const otros = mapaEquipoPorPiloto(equipos.filter(e => e.id !== equipo.id));
    return miembrosActuales(equipo)
        .filter(m => otros[m.pilot])
        .map(m => `${m.pilot} (ya en ${otros[m.pilot].tag})`);
}
