/**
 * Utilidades de formato de fecha compartidas
 * Centraliza todas las funciones de formateo de fechas usadas en el proyecto
 */

/**
 * Hora de carrera por defecto (hora española), cuando el campeonato no
 * define otra. Las ligas de este proyecto corren de noche entre semana.
 */
export const DEFAULT_RACE_TIME = '23:00';

/**
 * Hora a la que se corre una carrera, en hora española.
 *
 * Precedencia: la de la propia carrera (si esa fecha se movió) → la del
 * campeonato → 23:00. No confundir con `track.rules.startTime`, que es la
 * hora DENTRO del juego (amanecer/mediodía/noche), no cuándo se disputa.
 *
 * En campeonatos con divisiones cada sala tiene su propia `division.hour`,
 * que manda sobre esta para esa sala en concreto.
 *
 * @param {Object} championship
 * @param {Object} [track]
 * @returns {string} "HH:mm"
 */
export const getRaceTime = (championship, track) =>
    track?.time || championship?.settings?.defaultRaceTime || DEFAULT_RACE_TIME;

/**
 * Ventana horaria de la Pre-Qualy, en hora española.
 *
 * Tiene hora propia porque no siempre se corre a la misma hora que las
 * carreras, y admite un rango: muchas ligas la abren durante una franja
 * ("de 18:00 a 23:00") en vez de a una hora concreta.
 *
 * Si no se define hora propia, cae en la del campeonato.
 *
 * @returns {{desde: string, hasta: string|null}}
 */
export const getPreQualyTime = (championship) => {
    const pq = championship?.preQualy || {};
    return {
        desde: pq.time || getRaceTime(championship),
        hasta: pq.timeEnd || null,
    };
};

/** "23:00h" o "de 18:00h a 23:00h" según haya rango o no. */
export const formatTimeWindow = ({ desde, hasta }) =>
    hasta ? `de ${desde}h a ${hasta}h` : `${desde}h`;

/**
 * Offset de Europe/Madrid respecto a UTC, en minutos, para un instante dado.
 * Se calcula con Intl en vez de asumir +1/+2 para que el cambio de horario
 * de verano no descuadre la conversión.
 */
function madridOffsetMinutes(date) {
    const dtf = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Europe/Madrid', hour12: false,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
    const p = Object.fromEntries(
        dtf.formatToParts(date).filter(x => x.type !== 'literal').map(x => [x.type, x.value])
    );
    const asUTC = Date.UTC(p.year, p.month - 1, p.day, p.hour === '24' ? 0 : p.hour, p.minute, p.second);
    return (asUTC - date.getTime()) / 60000;
}

/**
 * Instante real de una carrera a partir de su fecha y su hora española.
 * @param {string} dateStr - "YYYY-MM-DD"
 * @param {string} timeStr - "HH:mm" en hora española
 * @returns {Date|null}
 */
export const raceDateTime = (dateStr, timeStr) => {
    if (!dateStr || !timeStr) return null;
    const naive = new Date(`${dateStr}T${timeStr}:00Z`);
    if (isNaN(naive)) return null;
    // Dos pasadas: el desfase hay que medirlo en el instante real, no en la
    // hora leída como UTC. Con una sola, las 01:00 del 25/10/2026 (aún
    // horario de verano en Madrid) tomaban el desfase de invierno, porque a
    // las 01:00 UTC ya había cambiado, y salían una hora tarde.
    const aprox = new Date(naive.getTime() - madridOffsetMinutes(naive) * 60000);
    return new Date(naive.getTime() - madridOffsetMinutes(aprox) * 60000);
};

/**
 * Hora local del visitante para una carrera, o null si coincide con la
 * española (no tiene sentido repetir el mismo dato).
 *
 * Útil porque buena parte de los pilotos están en Latinoamérica y hasta
 * ahora tenían que hacer la conversión a mano.
 *
 * @returns {string|null} "HH:mm" en la zona del navegador
 */
export const localRaceTime = (dateStr, timeStr) => {
    const dt = raceDateTime(dateStr, timeStr);
    if (!dt) return null;
    const local = new Intl.DateTimeFormat('es-ES', {
        hour: '2-digit', minute: '2-digit', hour12: false,
    }).format(dt);
    return local === timeStr ? null : local;
};

/**
 * Fecha de hoy en España, "YYYY-MM-DD".
 *
 * Para convertir horas que no van ligadas a un día concreto, como la hora de
 * cada sala: el desfase con España depende de la fecha (horario de verano).
 */
export const hoyEnEspana = () =>
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date());

/** "2026-09-11" + 1 día → "2026-09-12", sin pasar por la zona del navegador. */
const siguienteDia = (dateStr) => {
    const d = new Date(`${dateStr}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().slice(0, 10);
};

/**
 * Fecha en la que cae el FINAL de una franja. Si la hora de fin es anterior a
 * la de inicio, la franja cruza la medianoche: la Pre-Qualy de la GR.4 va "de
 * 21:00 a 00:30", y ese 00:30 es del día siguiente.
 */
const fechaFinDeFranja = (dateStr, { desde, hasta }) =>
    hasta && hasta <= desde ? siguienteDia(dateStr) : dateStr;

/**
 * La misma franja en la hora del visitante, o null si coincide con la
 * española.
 *
 * El final se convierte con SU fecha real: con la fecha del inicio, un 00:30
 * que ya es del día siguiente se convertía como si fuera del mismo día, y en
 * los días de cambio de horario salía una hora distinta.
 *
 * @returns {{desde: string, hasta: string|null}|null}
 */
export const localTimeWindow = (dateStr, ventana) => {
    const desde = localRaceTime(dateStr, ventana.desde);
    const hasta = ventana.hasta
        ? localRaceTime(fechaFinDeFranja(dateStr, ventana), ventana.hasta)
        : null;
    // localRaceTime devuelve null cuando la hora es la misma que en España.
    if (!desde && !hasta) return null;
    return { desde: desde || ventana.desde, hasta: ventana.hasta ? (hasta || ventana.hasta) : null };
};

/**
 * Instante en que termina la Pre-Qualy. Sin hora de fin, se da el día entero.
 * @returns {Date|null}
 */
export const preQualyEnd = (championship) => {
    const pq = championship?.preQualy;
    if (!pq?.date) return null;
    const ventana = getPreQualyTime(championship);
    return ventana.hasta
        ? raceDateTime(fechaFinDeFranja(pq.date, ventana), ventana.hasta)
        : raceDateTime(pq.date, '23:59');
};

/**
 * Formato corto de fecha: "01 ene"
 * Usado en ChampionshipCard para próxima carrera
 * @param {string} dateStr - Fecha en formato ISO (YYYY-MM-DD)
 * @returns {string}
 */
export const formatDateShort = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr.includes('T') ? dateStr : dateStr + 'T00:00:00');
    return date.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: 'short'
    });
};

/**
 * Formato completo de fecha: "01/01/2025"
 * Usado en championships/page para calendario y detalles
 * @param {string} dateStr - Fecha en formato ISO
 * @returns {string}
 */
export const formatDateFull = (dateStr) => {
    if (!dateStr) return '';
    try {
        const date = new Date(dateStr.includes('T') ? dateStr : dateStr + 'T00:00:00');
        if (isNaN(date.getTime())) return dateStr;
        return date.toLocaleDateString('es-ES', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    } catch {
        return dateStr;
    }
};

/**
 * Verifica si una fecha ISO está en la semana actual
 * @param {string} isoDate - Fecha en formato YYYY-MM-DD
 * @returns {boolean}
 */
export const isInCurrentWeek = (isoDate) => {
    if (!isoDate) return false;
    const date = new Date(isoDate + 'T00:00:00');
    const now = new Date();
    const startOfWeek = new Date(now);
    const day = (now.getDay() + 6) % 7; // 0 = lunes
    startOfWeek.setDate(now.getDate() - day);
    startOfWeek.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 7);
    return date >= startOfWeek && date < endOfWeek;
};
