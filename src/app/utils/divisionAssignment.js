/**
 * Reparto de pilotos entre divisiones a partir del orden de la Pre-Qualy.
 *
 * El reparto anterior era `Math.ceil(total / nDivisiones)` y no miraba los
 * cupos: con 33 clasificados y dos salas de 15 metía 17 y 16, dos salas por
 * encima de su capacidad y nadie fuera. Una sala de GT7 no admite 17 pilotos,
 * así que el sobrante tiene que quedarse sin asignar y verse como tal.
 *
 * Criterio:
 *   1. Reparto lo más equilibrado posible — con 20 pilotos y dos salas de 15
 *      salen 10 y 10, no 15 y 5.
 *   2. Ninguna división pasa de su `maxDrivers`.
 *   3. Si tras equilibrar sobran pilotos y queda hueco en alguna división, se
 *      colocan ahí antes de dejarlos fuera: con salas de 10 y 20 no tiene
 *      sentido dejar a nadie sin sala mientras la segunda tenga sitio.
 *   4. El orden manda: los más rápidos van a la primera división, que es la
 *      de cabeza.
 */

const CUPOS_POR_DEFECTO = 15;

/**
 * @param {Array} pilotos - Ordenados de más rápido a más lento
 * @param {Array} divisiones - Ordenadas por `order`, con `id` y `maxDrivers`
 * @returns {Array} Un elemento por piloto con `divId` ('' si no cabe en ninguna)
 */
export function repartirPorPreQualy(pilotos = [], divisiones = []) {
    if (divisiones.length === 0) {
        return pilotos.map(p => ({ ...p, divId: '' }));
    }

    const cupos = divisiones.map(d => {
        const n = Number(d?.maxDrivers);
        return Number.isFinite(n) && n > 0 ? Math.floor(n) : CUPOS_POR_DEFECTO;
    });

    const total = pilotos.length;
    const k = divisiones.length;

    // 1 y 2: reparto equilibrado, recortado por los cupos de cada división.
    const base = Math.floor(total / k);
    const resto = total % k;
    const asignados = cupos.map((cupo, i) => Math.min(cupo, base + (i < resto ? 1 : 0)));

    // 3: lo que el recorte haya dejado fuera se reubica donde quede hueco.
    let sobrante = total - asignados.reduce((a, b) => a + b, 0);
    while (sobrante > 0) {
        const hueco = asignados.findIndex((n, i) => n < cupos[i]);
        if (hueco === -1) break;   // no queda sitio en ninguna división
        asignados[hueco] += 1;
        sobrante -= 1;
    }

    // 4: se recorre la lista en orden y se van llenando las divisiones.
    const salida = [];
    let indice = 0;
    divisiones.forEach((div, i) => {
        for (let n = 0; n < asignados[i] && indice < total; n++, indice++) {
            salida.push({ ...pilotos[indice], divId: div.id });
        }
    });
    for (; indice < total; indice++) {
        salida.push({ ...pilotos[indice], divId: '' });
    }

    return salida;
}

/** Cupos totales de un conjunto de divisiones. */
export function cuposTotales(divisiones = []) {
    return divisiones.reduce((total, d) => {
        const n = Number(d?.maxDrivers);
        return total + (Number.isFinite(n) && n > 0 ? Math.floor(n) : CUPOS_POR_DEFECTO);
    }, 0);
}
