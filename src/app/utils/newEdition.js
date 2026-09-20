/**
 * Nueva edición de un campeonato a partir de la anterior.
 *
 * Funciones puras (sin Firebase) para el asistente «Nueva edición» del admin:
 * clasificación final por división → ascensos/descensos → qué se lleva a la
 * edición nueva (inscripciones de quien continúa, sus tiempos de Pre-Qualy y
 * la estructura de divisiones).
 *
 * Decisiones (2026-09-19):
 * - Continúan los que marque el admin; después cada uno confirma desde la web
 *   y quien no confirme en plazo causa baja.
 * - Los veteranos conservan su tiempo de Pre-Qualy; los de quien no continúa
 *   no se copian.
 * - Los nuevos rellenan los huecos por tiempo (eso es el reparto, fase 3).
 */

export const MOVIMIENTO = { SUBE: 'up', BAJA: 'down', QUEDA: 'stay' };

const limpio = (t) => String(t || '').trim().toLowerCase();

/**
 * Movimiento de un piloto según su posición final en su división.
 * La división más alta (índice 0) no asciende y la más baja no desciende.
 *
 * @param {number} posicion   - 1 = primero
 * @param {number} total      - pilotos clasificados en la división
 * @param {number} indiceDiv  - 0 = división más alta
 * @param {number} numDivs
 */
export function movimientoPorPosicion(posicion, total, indiceDiv, numDivs, promotionCount = 0, relegationCount = 0) {
    if (!posicion || numDivs < 2) return MOVIMIENTO.QUEDA;
    const puedeSubir = indiceDiv > 0 && posicion <= promotionCount;
    const puedeBajar = indiceDiv < numDivs - 1 && posicion > total - relegationCount;
    // En una división con muy pocos pilotos las dos zonas pueden solaparse:
    // manda el ascenso, que es el mérito deportivo.
    if (puedeSubir) return MOVIMIENTO.SUBE;
    if (puedeBajar) return MOVIMIENTO.BAJA;
    return MOVIMIENTO.QUEDA;
}

/**
 * Filas del asistente: un piloto por fila con su división, posición final y
 * movimiento propuesto.
 *
 * @param {Array} divisiones - [{ division: {id, name, order, drivers}, standings: [{name, totalPoints}] }]
 *                             ordenadas de la más alta a la más baja
 * @returns {Array<{name, divisionId, divisionName, divisionIndex, position, points, movement}>}
 */
export function planificarMovimientos(divisiones = [], { promotionCount = 0, relegationCount = 0 } = {}) {
    const numDivs = divisiones.length;
    const filas = [];
    divisiones.forEach(({ division, standings = [] }, indiceDiv) => {
        // Las zonas se cuentan solo entre quienes corrieron, igual que las
        // flechas de la clasificación pública: si no, el descenso caía en
        // pilotos que nunca llegaron a correr (altas que no se presentaron o
        // nombres antiguos que siguen en la lista de la división).
        standings.forEach((s, i) => {
            filas.push({
                name: s.name,
                divisionId: division.id,
                divisionName: division.name,
                divisionIndex: indiceDiv,
                position: i + 1,
                points: s.totalPoints ?? 0,
                raced: true,
                movement: movimientoPorPosicion(i + 1, standings.length, indiceDiv, numDivs, promotionCount, relegationCount),
            });
        });
        (division.drivers || [])
            .filter(n => !standings.some(s => limpio(s.name) === limpio(n)))
            .forEach(name => filas.push({
                name,
                divisionId: division.id,
                divisionName: division.name,
                divisionIndex: indiceDiv,
                position: null,
                points: 0,
                raced: false,
                movement: MOVIMIENTO.QUEDA,
            }));
    });
    return filas;
}

/**
 * Índice de la división de destino en la NUEVA edición. Si la nueva tiene
 * menos divisiones, se ajusta a la última que exista.
 */
export function divisionDestino(divisionIndex, movement, numDivsNueva) {
    let destino = divisionIndex + (movement === MOVIMIENTO.SUBE ? -1 : movement === MOVIMIENTO.BAJA ? 1 : 0);
    destino = Math.max(0, destino);
    return Math.min(destino, Math.max(0, numDivsNueva - 1));
}

/**
 * Busca la inscripción de un piloto por su nombre en la clasificación (GT7 ID
 * unificado), mirando GT7 ID, PSN y nombre, con las fusiones de identidad.
 *
 * @param {Array} registrations - inscripciones de la edición anterior (sin aplanar)
 * @param {Object} canonDe - { alias(lowercase): nombreCanónico }
 */
export function buscarInscripcion(nombre, registrations = [], canonDe = {}) {
    const clave = (n) => limpio(canonDe[limpio(n)] || n);
    const k = clave(nombre);
    for (const reg of registrations) {
        const pilotos = Array.isArray(reg.drivers) && reg.drivers.length > 0 ? reg.drivers : [reg];
        for (const p of pilotos) {
            if ([p.gt7Id, p.psnId, p.name].some(v => v && clave(v) === k)) {
                return { reg, piloto: p };
            }
        }
    }
    return null;
}

const nuevoId = () => `reg_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

/**
 * Inscripciones de la nueva edición para quienes continúan: quedan pendientes
 * de confirmar (status 'pending' + continuity 'pending') con lo que hace falta
 * para colocarlos después.
 *
 * Solo se copia la identidad del piloto (GT7 ID, PSN, nombre, contacto que ya
 * hubiera); nada de la edición anterior como autos declarados o notas.
 */
export function inscripcionesVeteranos(filasQueContinuan, registrationsAnteriores, { championshipIdAnterior, canonDe = {}, ahora = new Date().toISOString() } = {}) {
    return filasQueContinuan.map(fila => {
        const encontrada = buscarInscripcion(fila.name, registrationsAnteriores, canonDe);
        const p = encontrada?.piloto || {};
        return {
            id: nuevoId(),
            gt7Id: p.gt7Id || fila.name,
            psnId: p.psnId || '',
            ...(p.name ? { name: p.name } : {}),
            ...(p.email ? { email: p.email } : {}),
            ...(p.category ? { category: p.category } : {}),
            status: 'pending',
            createdAt: ahora,
            updatedAt: ahora,
            carryover: {
                fromChampionshipId: championshipIdAnterior,
                fromRegistrationId: encontrada?.reg?.id || null,
                divisionName: fila.divisionName,
                divisionIndex: fila.divisionIndex,
                position: fila.position,
                movement: fila.movement,
                continuity: 'pending',
            },
        };
    });
}

/**
 * Tiempos de Pre-Qualy de la edición anterior, solo de quienes continúan.
 * Se marcan con `fromPreviousEdition` para distinguirlos de los nuevos.
 */
export function tiemposVeteranos(resultadosAnteriores = [], nombresQueContinuan = [], canonDe = {}) {
    const clave = (n) => limpio(canonDe[limpio(n)] || n);
    const claves = new Set(nombresQueContinuan.map(clave));
    return resultadosAnteriores
        .filter(r => r?.time && [r.driverName, r.gt7Id].some(n => n && claves.has(clave(n))))
        .map(r => ({ ...r, fromPreviousEdition: true }));
}

/**
 * Estructura de divisiones para la nueva edición: todo lo de cada división
 * (nombre, color, cupo, hora, transmisión…) salvo sus pilotos, que se
 * reparten después.
 */
export function divisionesBase(divisionesAnteriores = []) {
    return [...divisionesAnteriores]
        .sort((a, b) => (a.order || 0) - (b.order || 0))
        .map(({ id, drivers, createdAt, updatedAt, ...resto }, i) => ({ ...resto, order: i + 1, drivers: [] }));
}

// ── Continuidad (fase 2) ─────────────────────────────────────────────────────

export const CONTINUIDAD = {
    PENDIENTE: 'pending',
    CONFIRMADA: 'confirmed',
    RECHAZADA: 'declined',
    CADUCADA: 'expired',   // no confirmó antes del plazo
};

/**
 * Estado de continuidad de una inscripción de veterano.
 *
 * Lo que responde el piloto vive en la subcolección `continuations` (el
 * público no puede tocar `registrations`); al cerrar el plazo, o cuando el
 * admin aplica las respuestas, se vuelca en `registration.carryover.continuity`
 * y en el `status`. Mientras tanto manda lo último que haya respondido.
 *
 * @param {Object} reg
 * @param {Object} continuaciones - { [regId]: { status } }
 * @returns {string|null} null si no es un veterano
 */
export function estadoContinuidad(reg, continuaciones = {}) {
    if (!reg?.carryover) return null;
    const fijado = reg.carryover.continuity;
    if (fijado && fijado !== CONTINUIDAD.PENDIENTE) return fijado;
    return continuaciones[reg.id]?.status || CONTINUIDAD.PENDIENTE;
}

/**
 * Vuelca las respuestas en las inscripciones.
 * - Confirmada → status 'approved'.
 * - Rechazada → status 'withdrawn' (baja).
 * - Sin respuesta: se queda pendiente, salvo que `cerrar` (plazo vencido),
 *   que la convierte en baja por caducidad.
 * No toca inscripciones que no son de veteranos ni las ya resueltas.
 *
 * @returns {{ registrations: Array, cambios: {confirmados: string[], rechazados: string[], caducados: string[]} }}
 */
export function sincronizarContinuidad(registrations = [], continuaciones = {}, { cerrar = false, ahora = new Date().toISOString() } = {}) {
    const cambios = { confirmados: [], rechazados: [], caducados: [] };
    const nombre = (r) => r.gt7Id || r.name || r.psnId;
    const salida = registrations.map(reg => {
        if (!reg.carryover || (reg.carryover.continuity && reg.carryover.continuity !== CONTINUIDAD.PENDIENTE)) return reg;
        const respuesta = continuaciones[reg.id]?.status;
        let continuity = null;
        let status = reg.status;
        if (respuesta === CONTINUIDAD.CONFIRMADA) { continuity = CONTINUIDAD.CONFIRMADA; status = 'approved'; cambios.confirmados.push(nombre(reg)); }
        else if (respuesta === CONTINUIDAD.RECHAZADA) { continuity = CONTINUIDAD.RECHAZADA; status = 'withdrawn'; cambios.rechazados.push(nombre(reg)); }
        else if (cerrar) { continuity = CONTINUIDAD.CADUCADA; status = 'withdrawn'; cambios.caducados.push(nombre(reg)); }
        if (!continuity) return reg;
        return { ...reg, status, updatedAt: ahora, carryover: { ...reg.carryover, continuity, resolvedAt: ahora } };
    });
    return { registrations: salida, cambios };
}

// ── Reparto de divisiones de la nueva edición (fase 3) ───────────────────────

/**
 * Reparto de la nueva edición:
 * 1. Cada veterano confirmado va a la división que le toca por su movimiento
 *    (ajustado si la nueva edición tiene menos divisiones). Tienen prioridad:
 *    si una división se llena de veteranos, se avisa pero no se echa a nadie.
 * 2. Los nuevos, del más rápido al más lento en la Pre-Qualy, ocupan los
 *    huecos empezando por la división más alta con plazas libres.
 * 3. Quien no cabe, o es nuevo sin tiempo, queda sin asignar.
 *
 * @param {Array} veteranos - [{ driverName, divisionIndex, movement }]
 * @param {Array} nuevos    - [{ driverName, time }] (sin tiempo = sin asignar)
 * @param {Array} divisiones - ordenadas de la más alta a la más baja, con id y maxDrivers
 * @param {Function} tiempoMs - "1:23.456" → ms
 * @returns {Array<{driverName, tipo:'veterano'|'nuevo', divId, detalle, excedeCupo?}>}
 */
export function repartirNuevaEdicion(veteranos = [], nuevos = [], divisiones = [], tiempoMs = () => Infinity) {
    const cupo = (d) => { const n = Number(d?.maxDrivers); return Number.isFinite(n) && n > 0 ? Math.floor(n) : 15; };
    const ocupados = divisiones.map(() => 0);
    const salida = [];
    const flecha = { [MOVIMIENTO.SUBE]: '▲ sube', [MOVIMIENTO.BAJA]: '▼ baja', [MOVIMIENTO.QUEDA]: '= se queda' };

    veteranos.forEach(v => {
        if (divisiones.length === 0) { salida.push({ driverName: v.driverName, tipo: 'veterano', divId: '', detalle: 'sin divisiones' }); return; }
        const i = divisionDestino(v.divisionIndex ?? 0, v.movement, divisiones.length);
        ocupados[i] += 1;
        salida.push({
            driverName: v.driverName,
            tipo: 'veterano',
            divId: divisiones[i].id,
            detalle: `🔁 ${flecha[v.movement] || ''}${v.divisionName ? ` (antes ${v.divisionName})` : ''}`,
            excedeCupo: ocupados[i] > cupo(divisiones[i]),
        });
    });

    [...nuevos]
        .sort((a, b) => tiempoMs(a.time) - tiempoMs(b.time))
        .forEach(n => {
            if (!n.time) { salida.push({ driverName: n.driverName, tipo: 'nuevo', divId: '', detalle: 'sin tiempo de Pre-Qualy' }); return; }
            const i = divisiones.findIndex((d, k) => ocupados[k] < cupo(d));
            if (i === -1) { salida.push({ driverName: n.driverName, tipo: 'nuevo', divId: '', detalle: `⏱ ${n.time} · sin plaza` }); return; }
            ocupados[i] += 1;
            salida.push({ driverName: n.driverName, tipo: 'nuevo', divId: divisiones[i].id, detalle: `⏱ ${n.time}` });
        });

    return salida;
}
