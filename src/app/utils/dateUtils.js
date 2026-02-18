/**
 * Utilidades de formato de fecha compartidas
 * Centraliza todas las funciones de formateo de fechas usadas en el proyecto
 */

/**
 * Formato corto de fecha: "01 ene"
 * Usado en ChampionshipCard para próxima carrera
 * @param {string} dateStr - Fecha en formato ISO (YYYY-MM-DD)
 * @returns {string}
 */
export const formatDateShort = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr + 'T00:00:00');
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
        const date = new Date(dateStr + 'T00:00:00');
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
