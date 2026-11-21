/**
 * Resultados de la Pre-Qualy (championship.preQualy.results).
 *
 * Cada fila es { driverName, gt7Id, time, classified, fromPreviousEdition? }.
 * `driverName` es la clave del inscrito: name || psnId || gt7Id, la misma
 * que usan el editor del panel, el de Divisiones y el reparto de salas.
 *
 * Al corregir el GT7 ID o el PSN de un inscrito, la fila de su tiempo podía
 * quedarse con la clave vieja y, al volver a asignarle el tiempo, el piloto
 * salía dos veces (Desafío del Asfalto, nov. 2026). normalizarResultadosPreQualy
 * reengancha cada fila a su inscrito actual y deja una sola por piloto.
 *
 * Módulo puro: sin React ni Firebase.
 */
import { claveNombre } from './nombresPiloto.js';

/** Clave de un inscrito en la Pre-Qualy. */
export const clavePreQualy = (reg = {}) => reg.name || reg.psnId || reg.gt7Id || '';

/** «m:ss.mmm» o «ss.mmm» → milisegundos (Infinity si no hay tiempo). */
export function parseTimeToMs(str) {
    if (!str) return Infinity;
    const parts = String(str).trim().split(':');
    if (parts.length === 2) {
        const mins = parseInt(parts[0], 10) || 0;
        const secs = parseFloat(parts[1]) || 0;
        return mins * 60000 + Math.round(secs * 1000);
    }
    return Math.round((parseFloat(parts[0]) || 0) * 1000);
}

/**
 * Reengancha cada fila a su inscrito (por cualquiera de sus identificadores,
 * actuales o los que la fila guardó), le pone la clave y el GT7 ID vigentes y
 * deja una fila por piloto: la de mejor tiempo. Las filas sin inscrito se
 * conservan (pilotos añadidos a mano o ya retirados).
 *
 * @returns {Array} filas ordenadas por tiempo
 */
export function normalizarResultadosPreQualy(results = [], registrations = []) {
    const porId = new Map();
    (registrations || []).forEach(reg => {
        [reg.name, reg.psnId, reg.gt7Id].filter(Boolean).forEach(id => {
            const k = claveNombre(id);
            if (!porId.has(k)) porId.set(k, reg);
        });
    });
    // La clave guardada manda sobre el GT7 ID guardado (puede ser el viejo)
    const inscritoDe = (fila) => porId.get(claveNombre(fila.driverName)) || porId.get(claveNombre(fila.gt7Id)) || null;

    const mejores = new Map();
    (results || []).forEach(fila => {
        const reg = inscritoDe(fila);
        const normal = reg
            ? { ...fila, driverName: clavePreQualy(reg), gt7Id: reg.gt7Id || fila.gt7Id || '' }
            : fila;
        const k = claveNombre(normal.driverName);
        if (!k) return;
        const previa = mejores.get(k);
        if (!previa || parseTimeToMs(normal.time) < parseTimeToMs(previa.time)) mejores.set(k, normal);
    });
    return [...mejores.values()].sort((a, b) => parseTimeToMs(a.time) - parseTimeToMs(b.time));
}

/**
 * Texto para compartir en WhatsApp (los *asteriscos* salen en negrita).
 *
 * @param {Object} p
 * @param {string} p.campeonato
 * @param {Array<{nombre, tiempo}>} p.clasificados
 * @param {Array<{nombre, tiempo}>} [p.noClasificados]
 * @param {string} [p.circuito]
 * @param {string} [p.fecha]
 * @param {{clasificados: string, noClasificados: string}} p.etiquetas
 */
export function textoPreQualyWhatsApp({ campeonato, circuito, fecha, clasificados = [], noClasificados = [], etiquetas }) {
    const medalla = (i) => ['🥇', '🥈', '🥉'][i] || `${i + 1}.`;
    const linea = (p, i) => `${medalla(i)} ${p.nombre} — ${p.tiempo || '—'}`;
    const partes = [
        `🎯 *Pre-Qualy ${campeonato}*`,
        [circuito, fecha].filter(Boolean).length ? `🏁 ${[circuito, fecha].filter(Boolean).join(' · ')}` : '',
        '',
        `✅ *${etiquetas.clasificados}* (${clasificados.length})`,
        ...clasificados.map(linea),
    ];
    if (noClasificados.length) {
        partes.push('', `❌ *${etiquetas.noClasificados}* (${noClasificados.length})`,
            ...noClasificados.map((p, i) => `${i + 1}. ${p.nombre} — ${p.tiempo || '—'}`));
    }
    return partes.filter((l, i) => l !== '' || i > 0).join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
