/**
 * Sanciones que cambian el resultado de una carrera (no solo los puntos):
 *
 *   - type 'position'         → el piloto baja `positionsLost` puestos; los
 *                               que pasa suben uno.
 *   - type 'disqualification' → el piloto queda DSQ y pierde todos los puntos
 *                               de esa carrera; los de detrás suben.
 *
 * Se aplican AL CALCULAR, sobre una copia: el resultado guardado no se toca,
 * así que revocar la sanción (p. ej. en una alegación) lo deshace todo.
 * Los puntos de carrera se recalculan con la tabla del campeonato; los extras
 * (clasificación, vuelta rápida, sprint) se conservan.
 *
 * Módulo puro: sin React ni Firebase.
 */
import { isPenaltyCounting } from '../models/Penalty.js';

const normalizar = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]/g, '');

const CAMBIAN_RESULTADO = new Set(['position', 'disqualification']);

/** ¿Afecta esta sanción al resultado de esa carrera? */
function esDeLaCarrera(p, track) {
    if (p.trackId) return String(p.trackId) === String(track.id);
    return p.round != null && Number(p.round) === Number(track.round);
}

/** Grupos de nombres equivalentes (name / gt7Id / psnId) a partir de las inscripciones. */
function gruposDeNombres(championship) {
    const grupos = [];
    const regs = (championship?.registrations || []).flatMap(r => (Array.isArray(r.drivers) && r.drivers.length ? r.drivers : [r]));
    regs.forEach(r => {
        const nombres = [r.name, r.gt7Id, r.psnId].filter(Boolean).map(normalizar);
        if (nombres.length) grupos.push(new Set(nombres));
    });
    return grupos;
}

/** Clave de `posiciones` que corresponde al piloto sancionado (alias y mayúsculas incluidos). */
function claveDe(nombre, posiciones, grupos) {
    if (nombre in posiciones) return nombre;
    const n = normalizar(nombre);
    const equivalentes = new Set([n, ...grupos.filter(g => g.has(n)).flatMap(g => [...g])]);
    return Object.keys(posiciones).find(k => equivalentes.has(normalizar(k))) || null;
}

/**
 * Aplica las sanciones de posiciones y descalificación a un bloque de
 * resultados ({ racePositions, racePoints }) y ajusta `puntosTotales`.
 * Devuelve la lista de cambios aplicados.
 */
function aplicarABloque(bloque, puntosTotales, sanciones, tablaPuntos, grupos) {
    const posiciones = { ...(bloque.racePositions || {}) };
    const puntosCarrera = { ...(bloque.racePoints || {}) };
    const cambios = [];

    const propias = sanciones
        .map(p => ({ p, clave: claveDe(p.driverName, posiciones, grupos) }))
        .filter(x => x.clave);
    if (propias.length === 0) return null;

    // Orden de llegada de los que tienen posición numérica
    let orden = Object.entries(posiciones)
        .filter(([, v]) => !Number.isNaN(parseInt(v, 10)))
        .sort(([, a], [, b]) => parseInt(a, 10) - parseInt(b, 10))
        .map(([k]) => k);
    const posicionOriginal = Object.fromEntries(orden.map((k, i) => [k, i + 1]));

    // Primero las descalificaciones, después las pérdidas de posiciones
    propias.sort((a, b) => (a.p.type === 'disqualification' ? -1 : 0) - (b.p.type === 'disqualification' ? -1 : 0));
    const descalificados = new Set();
    propias.forEach(({ p, clave }) => {
        if (p.type === 'disqualification') {
            orden = orden.filter(k => k !== clave);
            descalificados.add(clave);
            cambios.push({ piloto: clave, tipo: 'disqualification', sancion: p.name, de: posicionOriginal[clave] || null, a: 'DSQ' });
        } else {
            const i = orden.indexOf(clave);
            if (i < 0) return;
            const destino = Math.min(i + (Number(p.positionsLost) || 0), orden.length - 1);
            orden.splice(i, 1);
            orden.splice(destino, 0, clave);
            cambios.push({ piloto: clave, tipo: 'position', sancion: p.name, puestos: Number(p.positionsLost) || 0 });
        }
    });

    // Nuevas posiciones y puntos de carrera
    orden.forEach((k, i) => {
        const nuevaPos = i + 1;
        const antes = puntosCarrera[k] ?? (tablaPuntos[posicionOriginal[k]] || 0);
        const ahora = tablaPuntos[nuevaPos] || 0;
        posiciones[k] = String(nuevaPos);
        puntosCarrera[k] = ahora;
        if (k in puntosTotales) puntosTotales[k] += ahora - antes;
    });
    descalificados.forEach(k => {
        posiciones[k] = 'DSQ';
        puntosCarrera[k] = 0;
        if (k in puntosTotales) puntosTotales[k] = 0; // sin ningún punto de esa carrera
    });
    cambios.forEach(c => { if (c.tipo === 'position') c.a = Number(posiciones[c.piloto]); });
    cambios.forEach(c => { if (c.tipo === 'position') c.de = posicionOriginal[c.piloto]; });

    bloque.racePositions = posiciones;
    bloque.racePoints = puntosCarrera;
    bloque.sancionesAplicadas = cambios;
    return cambios;
}

/**
 * Devuelve las carreras con las sanciones de resultado ya aplicadas.
 * Las carreras sin sanciones de este tipo se devuelven tal cual (misma referencia).
 *
 * @param {Array}  tracks
 * @param {Array}  penalties
 * @param {object} championship
 * @returns {Array}
 */
export function aplicarSancionesDeCarrera(tracks = [], penalties = [], championship = {}) {
    const relevantes = (penalties || []).filter(p => CAMBIAN_RESULTADO.has(p.type) && isPenaltyCounting(p));
    if (relevantes.length === 0) return tracks;
    const tablaPuntos = championship?.settings?.pointsSystem?.race || {};
    const grupos = gruposDeNombres(championship);

    return tracks.map(track => {
        const deLaCarrera = relevantes.filter(p => esDeLaCarrera(p, track));
        if (deLaCarrera.length === 0 || !track.results) return track;

        const copia = { ...track, points: { ...(track.points || {}) }, results: JSON.parse(JSON.stringify(track.results)) };
        if (copia.results.divisions && Object.keys(copia.results.divisions).length > 0) {
            Object.values(copia.results.divisions).forEach(div => aplicarABloque(div, copia.points, deLaCarrera, tablaPuntos, grupos));
        } else {
            aplicarABloque(copia.results, copia.points, deLaCarrera, tablaPuntos, grupos);
        }
        return copia;
    });
}
