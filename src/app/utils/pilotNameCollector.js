/**
 * Todos los nombres de piloto conocidos, con cuántas veces y en qué fechas
 * aparece cada uno.
 *
 * Recorre las mismas fuentes que /pilotsAdmin: inscripciones de campeonatos,
 * clasificaciones de cada carrera (general y por sala) y participantes y
 * resultados de eventos. Recibe los datos ya cargados para poder usarse
 * igual desde la web que desde un script.
 *
 * @param {Array<{championship: Object, tracks: Array}>} campeonatos
 * @param {Array} eventos
 * @returns {{apariciones: Object<string, number>, fechas: Object<string, string[]>}}
 */
export function recolectarNombres(campeonatos = [], eventos = []) {
    const apariciones = {};
    const fechas = {};
    const anotar = (nombre, fecha) => {
        const n = String(nombre || '').trim();
        // Las claves de puntos por ronda ("1", "2"…) no son pilotos.
        if (!n || /^\d+$/.test(n)) return;
        apariciones[n] = (apariciones[n] || 0) + 1;
        if (fecha) (fechas[n] ||= []).push(fecha);
    };

    campeonatos.forEach(({ championship, tracks = [] }) => {
        (championship?.registrations || []).forEach(reg => {
            const entradas = Array.isArray(reg.drivers) && reg.drivers.length ? reg.drivers : [reg];
            entradas.forEach(e => [e.gt7Id, e.psnId, e.name].forEach(n => anotar(n)));
        });
        tracks.forEach(t => {
            Object.keys(t.points || {}).forEach(n => anotar(n, t.date));
            Object.values(t.results?.divisions || {}).forEach(div => {
                Object.keys(div?.racePositions || {}).forEach(n => anotar(n, t.date));
            });
        });
    });

    eventos.forEach(ev => {
        (ev.participants || []).forEach(p => [p.gt7Id, p.psnId, p.name].forEach(n => anotar(n, ev.date)));
        (ev.results || []).forEach(r => anotar(r.driverName, ev.date));
    });

    Object.values(fechas).forEach(f => f.sort());
    return { apariciones, fechas };
}

/** Primera fecha en la que corrió cualquiera de estos nombres, o null. */
export function primeraFecha(nombres = [], fechas = {}) {
    const todas = nombres.flatMap(n => fechas[n] || []).sort();
    return todas[0] || null;
}
