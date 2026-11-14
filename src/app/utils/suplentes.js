/**
 * Suplentes (reglamento general, 10.7).
 *
 * Cuando un piloto inscrito no puede correr, otro piloto corre por él. El
 * titular suma el FACTOR_PUNTOS_SUPLENTE de los puntos de la posición de su
 * suplente (redondeado); los puntos de pole y vuelta rápida van completos. El
 * resto de pilotos puntúa por su puesto real. Las victorias y podios del
 * suplente no cuentan para los desempates del titular.
 *
 * En cada bloque de resultados (results o results.divisions[id]) se guarda
 * `suplentes: { titular: nombreDelSuplente }`.
 *
 * Módulo puro: sin React ni Firebase.
 */
import { claveNombre } from './nombresPiloto.js';

export const FACTOR_PUNTOS_SUPLENTE = 0.5;

/**
 * La regla entra con la versión 2.3 del reglamento y solo rige en los
 * campeonatos que empiezan desde esa fecha: los que ya estaban en curso
 * terminan con las reglas con las que se inscribieron sus pilotos.
 */
export const VIGENCIA_REGLA_SUPLENTES = '2026-11-14';

/** ¿Rige el 10.7 en este campeonato? (por fecha de inicio, o de creación si no tiene) */
export function aplicaReglaSuplentes(championship) {
    const inicio = String(championship?.startDate || championship?.createdAt || '').slice(0, 10);
    return inicio !== '' && inicio >= VIGENCIA_REGLA_SUPLENTES;
}

/** Puntos de posición de un resultado: reducidos si corrió un suplente. */
export function puntosPosicion(puntos, conSuplente) {
    return conSuplente ? Math.round((puntos || 0) * FACTOR_PUNTOS_SUPLENTE) : (puntos || 0);
}

/** Suplentes que vienen de la carga por capturas (raceTimes[piloto].suplente). */
export function suplentesDesdeTiempos(tiempos = {}) {
    return Object.fromEntries(
        Object.entries(tiempos || {})
            .filter(([, t]) => t?.suplente)
            .map(([piloto, t]) => [piloto, t.suplente])
    );
}

/**
 * Suplentes de un bloque de resultados. Solo cuenta el campo `suplentes`
 * (nunca el suplente anotado en raceTimes por la carga de capturas), y solo
 * en los campeonatos donde rige la regla: en los demás, vacío.
 */
export function suplentesDeBloque(bloque = {}, championship) {
    if (!aplicaReglaSuplentes(championship)) return {};
    return { ...(bloque?.suplentes || {}) };
}

/** ¿Corrió un suplente por este piloto (por nombre o alias)? */
export function tieneSuplente(suplentes, nombres = []) {
    const claves = new Set(nombres.filter(Boolean).map(claveNombre));
    return Object.keys(suplentes || {}).some(k => claves.has(claveNombre(k)));
}

/**
 * Suplentes que no pueden serlo porque están inscritos en el campeonato
 * (10.7.2). Devuelve [{ titular, suplente }].
 */
export function suplentesNoValidos(suplentes, inscritos = []) {
    const claves = new Set(inscritos.flatMap(r => [r.name, r.gt7Id, r.psnId]).filter(Boolean).map(claveNombre));
    return Object.entries(suplentes || {})
        .filter(([, s]) => s && claves.has(claveNombre(s)))
        .map(([titular, suplente]) => ({ titular, suplente }));
}
