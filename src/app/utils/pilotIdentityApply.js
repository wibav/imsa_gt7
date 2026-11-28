/**
 * Aplica las identidades fusionadas a los datos ANTES de calcular nada.
 *
 * La fase 1 resolvía el nombre al pintarlo, y eso deja a medias las fusiones
 * de un piloto que cambió de nombre a mitad de temporada: sus puntos siguen
 * repartidos en dos entradas y la clasificación muestra dos filas con el mismo
 * nombre —y su perfil, el mismo campeonato dos veces—.
 *
 * Consolidar aquí, sobre una copia de los datos, en vez de dentro de
 * standingsCalculator, tiene dos ventajas: el motor de clasificaciones no se
 * toca (es el código más delicado del proyecto) y todo lo que se calcule a
 * partir de estos datos —clasificación, estadísticas, equipos, divisiones—
 * queda consolidado por igual, sin ir caso por caso.
 *
 * Nada de esto escribe en Firestore: son copias en memoria.
 */

import { claveNombre } from './nombresPiloto.js';

/** Nombre canónico de un piloto según el mapa alias → canónico. */
const canon = (nombre, mapa) => mapa[nombre] || nombre;

/**
 * Completa el mapa de fusiones con lo que dicen las inscripciones de UN
 * campeonato: si la identidad fusionada cubre uno de los nombres de una
 * inscripción (GT7 ID, PSN o nombre), los demás van al mismo canónico.
 *
 * Sin esto, un piloto desaparecía de la clasificación de su sala aunque tenía
 * puntos (Desafío del Asfalto, nov. 2026): la sala guardaba su PSN
 * «Limoneti32mlg», que la identidad lleva a «PRN_LimonetiMIg» (con i
 * mayúscula), y sus puntos estaban con su GT7 ID «PRN_LimonetiMlg» (con ele),
 * que la identidad no conocía. La inscripción dice que son la misma persona.
 *
 * Si los nombres de una inscripción llevan a canónicos distintos no se toca
 * nada: eso lo tiene que resolver el admin en /pilotsAdmin.
 *
 * @param {Object} mapa - alias → canónico (applyPilotIdentities)
 * @param {Array} registrations - championship.registrations (sin aplanar)
 * @returns {Object} el mismo mapa si no hay nada que añadir; si no, uno ampliado
 */
export function ampliarConInscripciones(mapa = {}, registrations = []) {
    const extra = {};
    (registrations || []).forEach(reg => {
        const pilotos = Array.isArray(reg?.drivers) && reg.drivers.length > 0 ? reg.drivers : [reg];
        pilotos.forEach(p => {
            const ids = [p?.gt7Id, p?.psnId, p?.name].map(v => String(v || '').trim()).filter(Boolean);
            const canonicos = [...new Set(ids.map(id => mapa[id]).filter(Boolean))];
            if (canonicos.length !== 1) return;
            const c = canonicos[0];
            ids.forEach(id => {
                if (!mapa[id] && claveNombre(id) !== claveNombre(c)) extra[id] = c;
            });
        });
    });
    if (Object.keys(extra).length === 0) return mapa;

    const extraPorClave = {};
    Object.entries(extra).forEach(([k, v]) => { extraPorClave[claveNombre(k)] = v; });
    // Proxy como el de mapaSinMayusculas: búsqueda exacta y, si no, sin
    // mayúsculas; lo que no es de las inscripciones lo resuelve el mapa base.
    return new Proxy({ ...mapa, ...extra }, {
        get(objeto, clave, receptor) {
            if (typeof clave !== 'string' || clave in objeto) return Reflect.get(objeto, clave, receptor);
            return extraPorClave[claveNombre(clave)] ?? mapa[clave];
        },
    });
}

/** Suma valores numéricos al fusionar dos claves en una. */
function fusionarNumericos(objeto = {}, mapa) {
    const salida = {};
    Object.entries(objeto).forEach(([nombre, valor]) => {
        const c = canon(nombre, mapa);
        const num = Number(valor);
        if (Number.isFinite(num)) {
            salida[c] = (Number(salida[c]) || 0) + num;
        } else if (salida[c] === undefined) {
            salida[c] = valor;
        }
    });
    return salida;
}

/**
 * Fusiona claves cuyo valor es una posición.
 *
 * Sumar posiciones no tendría sentido. Si dos alias tuvieran posición en la
 * misma carrera se conserva la mejor, pero es un caso que no debería existir:
 * dos nombres que puntuaron en la misma carrera son dos personas, y
 * /pilotsAdmin avisa de ello antes de dejar fusionarlos.
 */
function fusionarPosiciones(objeto = {}, mapa) {
    const salida = {};
    Object.entries(objeto).forEach(([nombre, valor]) => {
        const c = canon(nombre, mapa);
        if (salida[c] === undefined) {
            salida[c] = valor;
            return;
        }
        const actual = parseInt(salida[c], 10);
        const nueva = parseInt(valor, 10);
        if (Number.isFinite(nueva) && (!Number.isFinite(actual) || nueva < actual)) salida[c] = valor;
    });
    return salida;
}

/** Primer valor gana; solo renombra la clave. */
function fusionarPrimero(objeto = {}, mapa) {
    const salida = {};
    Object.entries(objeto).forEach(([nombre, valor]) => {
        const c = canon(nombre, mapa);
        if (salida[c] === undefined) salida[c] = valor;
    });
    return salida;
}

/** Campeonato con drivers y registrations normalizados y sin duplicados. */
export function aplicarIdentidadesACampeonato(championship, mapa = {}) {
    if (!championship || Object.keys(mapa).length === 0) return championship;

    const vistos = new Set();
    const drivers = (championship.drivers || []).reduce((acc, d) => {
        const nombre = canon(typeof d === 'string' ? d : d.name, mapa);
        if (!nombre || vistos.has(nombre)) return acc;
        vistos.add(nombre);
        acc.push(typeof d === 'string' ? nombre : { ...d, name: nombre });
        return acc;
    }, []);

    const registrations = (championship.registrations || []).map(reg => {
        const conDrivers = Array.isArray(reg.drivers) && reg.drivers.length > 0;
        const norm = e => ({
            ...e,
            gt7Id: e.gt7Id ? canon(e.gt7Id, mapa) : e.gt7Id,
            name: e.name ? canon(e.name, mapa) : e.name,
        });
        return conDrivers ? { ...reg, drivers: reg.drivers.map(norm) } : norm(reg);
    });

    return { ...championship, drivers, registrations };
}

/**
 * Equipos con sus pilotos normalizados y sin duplicados dentro del equipo.
 *
 * Ojo con `points` de un piloto de equipo: va indexado por número de ronda
 * ({"1": 9, "2": 15, …}), no por nombre. Al fusionar dos pilotos en uno hay
 * que sumar ronda a ronda; quedarse con el primero perdería puntos.
 */
export function aplicarIdentidadesAEquipos(teams = [], mapa = {}) {
    if (Object.keys(mapa).length === 0) return teams;
    return teams.map(team => {
        const porNombre = new Map();
        (team.drivers || []).forEach(d => {
            const nombre = canon(d?.name, mapa);
            if (!nombre) return;
            const previo = porNombre.get(nombre);
            if (!previo) {
                porNombre.set(nombre, { ...d, name: nombre, points: { ...(d.points || {}) } });
                return;
            }
            Object.entries(d.points || {}).forEach(([ronda, pts]) => {
                previo.points[ronda] = (Number(previo.points[ronda]) || 0) + (Number(pts) || 0);
            });
        });
        return { ...team, drivers: [...porNombre.values()] };
    });
}

/** Pistas con puntos, posiciones y resultados consolidados. */
export function aplicarIdentidadesAPistas(tracks = [], mapa = {}) {
    if (Object.keys(mapa).length === 0) return tracks;

    return tracks.map(track => {
        const nuevo = { ...track };
        if (track.points) nuevo.points = fusionarNumericos(track.points, mapa);
        if (track.carsUsed) nuevo.carsUsed = fusionarPrimero(track.carsUsed, mapa);

        if (track.results) {
            const res = { ...track.results };
            if (res.racePositions) res.racePositions = fusionarPosiciones(res.racePositions, mapa);
            if (res.racePoints) res.racePoints = fusionarNumericos(res.racePoints, mapa);

            if (res.divisions) {
                res.divisions = Object.fromEntries(
                    Object.entries(res.divisions).map(([divId, div]) => {
                        const d = { ...div };
                        if (div.racePositions) d.racePositions = fusionarPosiciones(div.racePositions, mapa);
                        if (div.racePoints) d.racePoints = fusionarNumericos(div.racePoints, mapa);
                        if (div.qualifying) {
                            d.qualifying = { ...div.qualifying };
                            if (div.qualifying.points) d.qualifying.points = fusionarNumericos(div.qualifying.points, mapa);
                            if (div.qualifying.top3) {
                                d.qualifying.top3 = Object.fromEntries(
                                    Object.entries(div.qualifying.top3).map(([k, v]) => [k, canon(v, mapa)])
                                );
                            }
                        }
                        if (div.fastestLap) {
                            d.fastestLap = { ...div.fastestLap };
                            if (div.fastestLap.driver) d.fastestLap.driver = canon(div.fastestLap.driver, mapa);
                            if (div.fastestLap.points) d.fastestLap.points = fusionarNumericos(div.fastestLap.points, mapa);
                        }
                        return [divId, d];
                    })
                );
            }
            nuevo.results = res;
        }
        return nuevo;
    });
}

/** Divisiones con su lista de pilotos normalizada y sin duplicados. */
export function aplicarIdentidadesADivisiones(divisions = [], mapa = {}) {
    if (Object.keys(mapa).length === 0) return divisions;
    return divisions.map(div => ({
        ...div,
        drivers: [...new Set((div.drivers || []).map(n => canon(n, mapa)))],
    }));
}
