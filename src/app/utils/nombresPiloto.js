/**
 * Nombres de piloto sin distinguir mayúsculas.
 *
 * Un mismo piloto aparece con distintas mayúsculas según dónde se guardó su
 * nombre: la inscripción («LTR_Urzais»), la sala («LoKo_Urzais»), las
 * capturas de resultados, la fusión de identidades («LTR_uRzAis»)… En los
 * datos de noviembre de 2026 había 38 nombres así. Los mapas de alias se
 * consultaban con el nombre exacto, y el piloto desaparecía de la
 * clasificación de su sala o salía partido en dos.
 *
 * Módulo puro: sin React ni Firebase.
 */

/** Clave de comparación de un nombre: sin espacios sobrantes y en minúsculas. */
export const claveNombre = (n) => String(n ?? '').trim().toLowerCase();

/**
 * Envuelve un mapa { nombre: valor } para que `mapa[nombre]` encuentre la
 * entrada aunque las mayúsculas no coincidan. Las coincidencias exactas
 * mandan; las claves, `Object.keys`, el spread y `in` se comportan igual que
 * en el objeto original, así que los que ya lo usaban no notan la diferencia.
 *
 * @param {Object} mapa
 * @param {Object} [extra] - Entradas que solo se usan en la búsqueda sin
 *        mayúsculas (p. ej. cada nombre canónico apuntando a sí mismo)
 * @returns {Object}
 */
export function mapaSinMayusculas(mapa = {}, extra = {}) {
    const indice = {};
    Object.entries(mapa).forEach(([k, v]) => {
        const c = claveNombre(k);
        if (c && !(c in indice)) indice[c] = v;
    });
    Object.entries(extra).forEach(([k, v]) => {
        const c = claveNombre(k);
        if (c && !(c in indice)) indice[c] = v;
    });
    return new Proxy(mapa, {
        get(objeto, clave, receptor) {
            if (typeof clave !== 'string' || clave in objeto) return Reflect.get(objeto, clave, receptor);
            return indice[claveNombre(clave)];
        },
    });
}
