/**
 * Rotación de divisiones durante el campeonato (ascensos y descensos).
 *
 * Hasta ahora los movimientos entre divisiones solo existían al terminar la
 * temporada. Con `divisionsConfig.rotation` el organizador elige cuándo se
 * aplican:
 *
 *   - 'final' (por defecto): solo al terminar, como siempre.
 *   - 'cada':  cada N carreras (`cadaCarreras`, 1 o más).
 *   - 'mitad': una vez, a mitad de campeonato.
 *
 * Nunca se rota tras la última carrera: eso es el cierre de temporada y lo
 * resuelve la nueva edición.
 *
 * Los movimientos se aplican solos (Cloud Function `rotar_divisiones`, cada
 * hora) cuando la carrera que cierra el tramo tiene resultados, han pasado
 * PLAZO_RECLAMACIONES_HORAS desde su hora de salida y no queda ninguna
 * reclamación abierta sobre las carreras del tramo. Cada rotación aplicada
 * queda registrada en `championship.divisionRotations`, que es lo que evita
 * aplicarla dos veces.
 *
 * Los puntos viajan con el piloto: la tabla de cada división suma todas sus
 * carreras, también las corridas en otra sala (decisión del organizador).
 *
 * Módulo puro: sin React ni Firebase. Lo usan el panel (DivisionsTab), la
 * página pública y la Cloud Function, que lo empaqueta con esbuild.
 */

import { calculateAdvancedStandings } from './standingsCalculator.js';
import { applyPilotIdentities } from './championshipUtils.js';
import {
    aplicarIdentidadesACampeonato,
    aplicarIdentidadesAEquipos,
    aplicarIdentidadesAPistas,
    aplicarIdentidadesADivisiones,
} from './pilotIdentityApply.js';
import { applyDeclarations, flattenRegistrations, getInvalidatedEntries } from './carUsageCalculator.js';
import { getRaceTime, raceDateTime } from './dateUtils.js';
import { claveNombre } from './nombresPiloto.js';

export const PLAZO_RECLAMACIONES_HORAS = 48;

export const MODOS_ROTACION = {
    final: 'Al terminar el campeonato',
    cada: 'Cada N carreras',
    mitad: 'A mitad de campeonato',
};

export const DEFAULT_ROTATION = { mode: 'final', cadaCarreras: 2 };

// Reclamaciones que aún pueden cambiar el resultado de una carrera
const RECLAMACION_ABIERTA = new Set(['pending', 'reviewing', 'appealed']);

/** Config de rotación normalizada (campeonatos antiguos no la tienen). */
export function configRotacion(championship) {
    const r = championship?.divisionsConfig?.rotation || {};
    const mode = MODOS_ROTACION[r.mode] ? r.mode : 'final';
    const n = Math.floor(Number(r.cadaCarreras));
    return { mode, cadaCarreras: Number.isFinite(n) && n >= 1 ? n : DEFAULT_ROTATION.cadaCarreras };
}

/** Carreras en orden de calendario: por ronda y, a igualdad, por fecha. */
export function carrerasOrdenadas(tracks = []) {
    return [...tracks].sort((a, b) => {
        const ra = Number(a.round) || Infinity;
        const rb = Number(b.round) || Infinity;
        if (ra !== rb) return ra - rb;
        return String(a.date || '').localeCompare(String(b.date || ''));
    });
}

/**
 * Tras cuántas carreras se rota. Con 8 carreras: cada 2 → [2, 4, 6];
 * cada 1 → [1..7]; mitad → [4]. Nunca incluye la última.
 */
export function cortesDeRotacion(config, totalCarreras) {
    if (totalCarreras < 2) return [];
    if (config.mode === 'mitad') return [Math.floor(totalCarreras / 2)];
    if (config.mode !== 'cada') return [];
    const cortes = [];
    for (let n = config.cadaCarreras; n < totalCarreras; n += config.cadaCarreras) cortes.push(n);
    return cortes;
}

function tieneResultados(track) {
    const r = track?.results || {};
    const conDatos = (o) => o && Object.keys(o).length > 0;
    if (r.divisions && Object.values(r.divisions).some(d => conDatos(d?.racePositions))) return true;
    return conDatos(r.racePositions) || conDatos(track?.points);
}

/**
 * Siguiente rotación por aplicar, o null. Se aplican de una en una y en
 * orden: si se acumularan dos (p. ej. la función estuvo caída), la segunda
 * sale en la siguiente pasada, calculada sobre las divisiones ya rotadas.
 *
 * @returns {{corte: number, carreras: Array, cierre: Object}|null}
 *          `estado` explica por qué no, si se pide `{ explicar: true }`.
 */
export function rotacionPendiente({ championship, divisions = [], tracks = [], claims = [], ahora = new Date() }, { explicar = false } = {}) {
    const no = (motivo) => (explicar ? { pendiente: null, motivo } : null);
    if (!championship?.divisionsConfig?.enabled) return no('Divisiones desactivadas');
    if (championship.status === 'completed') return no('Campeonato terminado');
    if (divisions.length < 2) return no('Hace falta más de una división');

    const config = configRotacion(championship);
    const carreras = carrerasOrdenadas(tracks);
    const cortes = cortesDeRotacion(config, carreras.length);
    if (cortes.length === 0) return no('Sin rotaciones durante el campeonato');

    const hechas = new Set((championship.divisionRotations || []).map(r => r.corte));
    const corte = cortes.find(c => !hechas.has(c));
    if (corte === undefined) return no('Todas las rotaciones aplicadas');

    const delTramo = carreras.slice(0, corte);
    const cierre = delTramo[delTramo.length - 1];
    if (!delTramo.every(tieneResultados)) {
        return no(`Faltan resultados antes de la rotación tras la carrera ${corte}`);
    }

    const salida = raceDateTime(cierre.date, getRaceTime(championship, cierre));
    if (!salida) return no(`La carrera ${corte} no tiene fecha`);
    const vence = new Date(salida.getTime() + PLAZO_RECLAMACIONES_HORAS * 3600000);
    if (ahora < vence) return no(`Plazo de reclamaciones abierto hasta ${vence.toISOString()}`);

    const ids = new Set(delTramo.map(t => t.id));
    const abiertas = claims.filter(c => ids.has(c.trackId) && RECLAMACION_ABIERTA.has(c.status));
    if (abiertas.length > 0) return no(`${abiertas.length} reclamación(es) sin resolver en el tramo`);

    const pendiente = { corte, carreras: delTramo, cierre };
    return explicar ? { pendiente, motivo: null } : pendiente;
}

/**
 * Clave con la que un nombre guardado en una división aparece en la
 * clasificación: identidad fusionada y, si es un PSN ID inscrito, su GT7 ID
 * (la misma resolución que hace calculateAdvancedStandings).
 */
export function resolverClaveClasificacion(championship, pilotIdentities = []) {
    const mapaFusiones = applyPilotIdentities({}, pilotIdentities);
    const psnAGt7 = {};
    (championship?.registrations || []).forEach(r => {
        if (r?.psnId && r?.gt7Id) psnAGt7[claveNombre(r.psnId)] = r.gt7Id;
    });
    return (nombre) => {
        const fusionado = mapaFusiones[nombre] || nombre;
        return claveNombre(psnAGt7[claveNombre(fusionado)] || psnAGt7[claveNombre(nombre)] || fusionado);
    };
}

/**
 * Clasificación de cada división tal y como la ve el público: con las
 * identidades fusionadas y las entradas invalidadas por uso de autos.
 *
 * @returns {Object} { [divId]: driverStandings }
 */
export function clasificacionesPorDivision({ championship, teams = [], tracks = [], penalties = [], divisions = [], pilotIdentities = [], declarations = {} }) {
    const mapaFusiones = applyPilotIdentities({}, pilotIdentities);
    const campeonato = aplicarIdentidadesACampeonato(championship, mapaFusiones);
    const equipos = aplicarIdentidadesAEquipos(teams, mapaFusiones);
    const pistas = aplicarIdentidadesAPistas(tracks, mapaFusiones);
    const divisiones = aplicarIdentidadesADivisiones(divisions, mapaFusiones);

    const flatRegs = applyDeclarations(flattenRegistrations(championship?.registrations || []), declarations);
    const invalidatedEntries = championship?.carUsageTracking?.enabled
        ? getInvalidatedEntries(tracks, championship.carUsageTracking, flatRegs)
        : new Set();

    const porDivision = {};
    divisiones.forEach(div => {
        porDivision[div.id] = calculateAdvancedStandings(
            campeonato, equipos, pistas, penalties,
            { divisionDrivers: div.drivers || [], invalidatedEntries }
        ).driverStandings;
    });
    return porDivision;
}

/**
 * Ascensos y descensos a partir de la clasificación de cada división.
 * La división de cabeza (order menor) no asciende a nadie y la última no
 * desciende a nadie.
 *
 * Los nombres de la clasificación pueden venir fusionados o como GT7 ID
 * mientras la división guarda otro alias: `claveDe` (ver
 * resolverClaveClasificacion) los cruza, y se mueve el nombre guardado.
 */
export function calcularMovimientos(standingsByDiv, divisions, divisionsConfig = {}, claveDe = claveNombre) {
    const promoCount = divisionsConfig.promotionCount ?? 5;
    const releCount = divisionsConfig.relegationCount ?? 5;
    const sorted = [...divisions].sort((a, b) => (a.order || 0) - (b.order || 0));

    const movimientos = [];
    sorted.forEach((div, i) => {
        // Nombre tal y como está guardado en la división, por su clave en la
        // clasificación. Quien no esté (retirado, movido a mano) no cuenta.
        const guardado = {};
        (div.drivers || []).forEach(n => { guardado[claveDe(n)] ??= n; });
        const tabla = (standingsByDiv[div.id] || [])
            .map(d => ({ ...d, guardado: guardado[claveNombre(d.name)] }))
            .filter(d => d.guardado);

        if (i < sorted.length - 1 && tabla.length > releCount && releCount > 0) {
            tabla.slice(-releCount).forEach(d => movimientos.push({
                driver: d.guardado, from: div.name, fromId: div.id,
                to: sorted[i + 1].name, toId: sorted[i + 1].id, type: 'relegation',
            }));
        }
        if (i > 0 && tabla.length > 0 && promoCount > 0) {
            tabla.slice(0, promoCount).forEach(d => movimientos.push({
                driver: d.guardado, from: div.name, fromId: div.id,
                to: sorted[i - 1].name, toId: sorted[i - 1].id, type: 'promotion',
            }));
        }
    });
    return movimientos;
}

/**
 * Pilotos de cada división tras aplicar los movimientos.
 * @returns {Object} { [divId]: string[] } — solo las divisiones que cambian
 */
export function aplicarMovimientos(divisions, movimientos) {
    const mapa = {};
    divisions.forEach(d => { mapa[d.id] = [...(d.drivers || [])]; });
    const movidos = new Set(movimientos.map(m => m.driver));
    Object.keys(mapa).forEach(id => { mapa[id] = mapa[id].filter(d => !movidos.has(d)); });
    movimientos.forEach(m => { if (mapa[m.toId]) mapa[m.toId].push(m.driver); });

    const cambios = {};
    divisions.forEach(d => {
        const antes = d.drivers || [];
        const despues = mapa[d.id];
        const igual = antes.length === despues.length && antes.every((n, i) => n === despues[i]);
        if (!igual) cambios[d.id] = despues;
    });
    return cambios;
}

/**
 * Todo junto: la rotación pendiente y sus movimientos, calculados solo con
 * las carreras del tramo (si una rotación se retrasa, las carreras
 * posteriores no influyen en ella).
 *
 * @returns {{corte, cierre, movimientos, cambios}|null}
 */
export function prepararRotacion(datos, ahora = new Date()) {
    const pendiente = rotacionPendiente({ ...datos, ahora });
    if (!pendiente) return null;
    const ids = new Set(pendiente.carreras.map(t => t.id));
    const tablas = clasificacionesPorDivision({ ...datos, tracks: datos.tracks.filter(t => ids.has(t.id)) });
    const movimientos = calcularMovimientos(
        tablas, datos.divisions, datos.championship.divisionsConfig,
        resolverClaveClasificacion(datos.championship, datos.pilotIdentities)
    );
    return {
        corte: pendiente.corte,
        cierre: pendiente.cierre,
        movimientos,
        cambios: aplicarMovimientos(datos.divisions, movimientos),
    };
}

/**
 * Próxima rotación prevista, para mostrarla al organizador y a los pilotos.
 * @returns {{corte: number, tras: Object, vence: Date|null}|null}
 */
export function proximaRotacion(championship, tracks = []) {
    if (!championship?.divisionsConfig?.enabled) return null;
    const carreras = carrerasOrdenadas(tracks);
    const cortes = cortesDeRotacion(configRotacion(championship), carreras.length);
    const hechas = new Set((championship.divisionRotations || []).map(r => r.corte));
    const corte = cortes.find(c => !hechas.has(c));
    if (corte === undefined) return null;
    const tras = carreras[corte - 1];
    const salida = raceDateTime(tras?.date, getRaceTime(championship, tras));
    return {
        corte,
        tras,
        vence: salida ? new Date(salida.getTime() + PLAZO_RECLAMACIONES_HORAS * 3600000) : null,
    };
}
