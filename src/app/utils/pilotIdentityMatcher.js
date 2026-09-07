/**
 * Detección de nombres que probablemente sean el mismo piloto.
 *
 * GT7 permite cambiar el GT7 ID tres veces, y además los pilotos anteponen la
 * etiqueta de su equipo al identificador ("RRT_ZUNZU", "Hgt_dayo21") y cambian
 * de equipo. El resultado es que la misma persona aparece escrita de varias
 * formas y sus estadísticas se parten.
 *
 * Esto SOLO propone candidatos. Ninguna fusión se aplica sin que el
 * Administrador de Plataforma la confirme, porque el heurístico se equivoca de
 * verdad: agrupa "HPR_FRANCIS126" con "HPR_FRANCIS125", que probablemente son
 * dos personas. Ver docs/PLAN_FUSION_PILOTOS.md.
 */

/** Etiqueta de equipo al principio o al final: "RRT_", "-THC", "_hgt". */
const ETIQUETA_EQUIPO = /^(?:[a-z0-9]{2,5})[_\-.](?=.)|[_\-.](?:[a-z0-9]{2,5})$/g;

export function normalizarNombre(nombre) {
    return String(nombre || '')
        .trim()
        .toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/\s+/g, ' ');
}

/** Núcleo comparable: sin etiqueta de equipo, acentos, signos ni espacios. */
export function nucleoNombre(nombre) {
    return normalizarNombre(nombre).replace(ETIQUETA_EQUIPO, '').replace(/[^a-z0-9]/g, '');
}

function levenshtein(a, b) {
    if (a === b) return 0;
    if (!a.length || !b.length) return Math.max(a.length, b.length);
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
        const fila = [i];
        for (let j = 1; j <= b.length; j++) {
            fila[j] = Math.min(prev[j] + 1, fila[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        }
        prev = fila;
    }
    return prev[b.length];
}

/** 0 a 1. Compara el núcleo, no el nombre tal cual. */
export function similitudNombres(a, b) {
    const [x, y] = [nucleoNombre(a), nucleoNombre(b)];
    if (!x || !y) return 0;
    if (x === y) return 1;
    // Un núcleo contenido en el otro: "dayo" dentro de "dayo21".
    if (x.length >= 4 && y.length >= 4 && (x.includes(y) || y.includes(x))) return 0.95;
    return 1 - levenshtein(x, y) / Math.max(x.length, y.length);
}

export const UMBRAL_POR_DEFECTO = 0.82;

/**
 * Agrupa nombres parecidos.
 *
 * @param {Array<string>} nombres
 * @param {Object} [opciones]
 * @param {number} [opciones.umbral]
 * @param {Set<string>} [opciones.yaFusionados] - Nombres que ya pertenecen a
 *        una identidad confirmada; se excluyen para no volver a proponerlos.
 * @returns {Array<Array<string>>} Grupos de 2 o más nombres
 */
export function agruparCandidatos(nombres = [], {
    umbral = UMBRAL_POR_DEFECTO,
    yaFusionados = new Set(),
    paresDescartados = new Set(),
} = {}) {
    const pendientes = nombres.filter(n => n && !yaFusionados.has(n));
    const grupos = [];
    const asignado = new Set();

    const descartada = (a, b) => paresDescartados.has(clavePar(a, b));

    pendientes.forEach(a => {
        if (asignado.has(a)) return;
        const grupo = [a];
        asignado.add(a);
        pendientes.forEach(b => {
            if (asignado.has(b)) return;
            // Basta con que se haya descartado la pareja con CUALQUIER miembro
            // del grupo: si ya se dijo que B no es A, meterlo con A por
            // parecerse a C sería colarlo por la puerta de atrás.
            if (grupo.some(g => descartada(g, b))) return;
            if (grupo.some(g => similitudNombres(g, b) >= umbral)) {
                grupo.push(b);
                asignado.add(b);
            }
        });
        if (grupo.length > 1) grupos.push(grupo);
    });

    return grupos;
}

/** Clave estable de una pareja de nombres, sin importar el orden. */
export function clavePar(a, b) {
    return [String(a), String(b)].sort().join('\u0000');
}

/**
 * Parejas descartadas a partir de los documentos de `pilotDismissals`.
 * Cada descarte guarda el grupo entero; aquí se expande a parejas.
 */
export function paresDescartadosDesde(dismissals = []) {
    const set = new Set();
    dismissals.forEach(d => {
        const nombres = d?.names || [];
        for (let i = 0; i < nombres.length; i++) {
            for (let j = i + 1; j < nombres.length; j++) set.add(clavePar(nombres[i], nombres[j]));
        }
    });
    return set;
}

/**
 * Pilotos que compartieron carrera.
 *
 * Es el mejor discriminante automático que hay: si dos nombres puntuaron en la
 * MISMA carrera, son dos personas distintas por muy parecidos que suenen. Con
 * "Tony", "Dani" o "Leo" el parecido no dice nada; esto sí.
 *
 * @param {Array} tracks - Pistas con `points` y/o `results.divisions`
 * @returns {Array<Set<string>>} Un conjunto de nombres por carrera
 */
export function nombresPorCarrera(tracks = []) {
    return tracks.map(track => {
        const nombres = new Set();
        Object.keys(track?.points || {}).forEach(n => nombres.add(n));
        Object.values(track?.results?.divisions || {}).forEach(div => {
            Object.keys(div?.racePositions || {}).forEach(n => nombres.add(n));
            Object.keys(div?.racePoints || {}).forEach(n => nombres.add(n));
        });
        Object.keys(track?.results?.racePositions || {}).forEach(n => nombres.add(n));
        return nombres;
    }).filter(s => s.size > 0);
}

/**
 * Parejas del grupo que coincidieron en alguna carrera — es decir, que casi
 * seguro NO son la misma persona.
 *
 * @param {Array<string>} grupo
 * @param {Array<Set<string>>} carreras - Salida de nombresPorCarrera()
 * @returns {Array<{a: string, b: string, veces: number}>}
 */
export function conflictosDeGrupo(grupo = [], carreras = []) {
    const conflictos = [];
    for (let i = 0; i < grupo.length; i++) {
        for (let j = i + 1; j < grupo.length; j++) {
            const veces = carreras.filter(c => c.has(grupo[i]) && c.has(grupo[j])).length;
            if (veces > 0) conflictos.push({ a: grupo[i], b: grupo[j], veces });
        }
    }
    return conflictos;
}

/**
 * Nombres ya conocidos que se parecen al que está escribiendo el piloto.
 *
 * Prevención (fase 4 del plan): el catálogo de identidades se limpia una vez,
 * pero si nadie avisa en el momento de inscribirse, el problema vuelve a
 * crecer con cada temporada. Aquí se le pregunta al propio piloto —que es
 * quien lo sabe seguro— en vez de dejarlo para una fusión posterior.
 *
 * Una coincidencia EXACTA no se sugiere: ahí no hay nada que aclarar.
 *
 * @param {string} valor - Lo que el piloto ha escrito
 * @param {Array<string>} conocidos
 * @param {Object} [opciones]
 * @param {number} [opciones.umbral] - Más exigente que el de agrupar: aquí se
 *        interrumpe a una persona, así que conviene callar salvo buen motivo.
 * @param {number} [opciones.maximo]
 * @returns {Array<string>}
 */
export function nombresParecidosA(valor, conocidos = [], { umbral = 0.86, maximo = 3 } = {}) {
    const escrito = String(valor || '').trim();
    if (escrito.length < 3) return [];
    const yaExiste = conocidos.some(n => normalizarNombre(n) === normalizarNombre(escrito));
    if (yaExiste) return [];

    // Aquí se es más estricto que al agrupar candidatos, y a propósito. En
    // /pilotsAdmin interesa proponer de más porque una persona filtra; aquí se
    // interrumpe a un piloto que está rellenando un formulario, y un aviso que
    // salta demasiado se convierte en papel pintado y se ignora.
    //
    // Medido sobre los nombres reales, la regla de "un núcleo contenido en
    // otro" era la que disparaba el ruido: hacía que "Erik" avisara por
    // "Erikjaky93". Se exige que el núcleo corto sea buena parte del largo, lo
    // que deja pasar "Dayo"/"Dayo21" y descarta "Erik"/"Erikjaky93".
    const nucleoEscrito = nucleoNombre(escrito);

    return conocidos
        .map(n => ({ nombre: n, score: similitudNombres(escrito, n), nucleo: nucleoNombre(n) }))
        .filter(x => {
            if (x.score < umbral) return false;
            const corto = Math.min(nucleoEscrito.length, x.nucleo.length);
            const largo = Math.max(nucleoEscrito.length, x.nucleo.length);
            return largo > 0 && corto / largo >= 0.6;
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, maximo)
        .map(x => x.nombre);
}

/**
 * Qué hacer al descartar un grupo, dados los descartes que ya existen.
 *
 * Los descartes se guardan por grupos y las parejas se derivan de ellos, así
 * que dos documentos solapados hacen que "Recuperar" uno no devuelva el grupo
 * a las sugerencias: el otro sigue cubriendo sus parejas y el botón parece no
 * hacer nada. Se resuelve absorbiendo los subconjuntos.
 *
 * Solo subconjuntos, no cualquier solape: fusionar {A,B} con {A,C} en {A,B,C}
 * afirmaría que B≠C, que es algo que nadie ha dicho.
 *
 * @param {Array<string>} nombres - Grupo que se quiere descartar
 * @param {Array<{id: string, names: string[]}>} existentes
 * @returns {{cubiertoPor: Object|null, absorbidos: Array}}
 */
export function planificarDescarte(nombres = [], existentes = []) {
    const limpios = [...new Set(nombres.map(n => String(n || '').trim()).filter(Boolean))];
    const nuevo = new Set(limpios);

    const cubiertoPor = existentes.find(d =>
        limpios.length > 0 && limpios.every(n => (d.names || []).includes(n))
    ) || null;

    const absorbidos = cubiertoPor ? [] : existentes.filter(d =>
        (d.names || []).length > 0 && (d.names || []).every(n => nuevo.has(n))
    );

    return { cubiertoPor, absorbidos };
}
