/**
 * Motor de cómputo y validación del uso de autos por piloto.
 *
 * Trabaja sobre track.carsUsed (guardado al ingresar resultados)
 * y championship.registrations[].declaredCars (declarados por el piloto).
 */

/**
 * Calcula el uso acumulado de autos por piloto a lo largo del campeonato.
 *
 * @param {Array} tracks - Pistas del campeonato (con track.carsUsed)
 * @param {Object} [options]
 * @param {Function} [options.resolveAlias] - (name) => canonicalName para normalizar psnId → gt7Id
 * @returns {Object} { [driverName]: { [carName]: usageCount } }
 */
export function calculateCarUsage(tracks, { resolveAlias = (n) => n } = {}) {
    const usage = {};

    (tracks || []).forEach(track => {
        const carsUsed = track.carsUsed || {};
        Object.entries(carsUsed).forEach(([driver, car]) => {
            if (!driver || !car) return;
            const canonical = resolveAlias(driver);
            if (!usage[canonical]) usage[canonical] = {};
            usage[canonical][car] = (usage[canonical][car] || 0) + 1;
        });

        // También escanear dentro de results.divisions si existe
        const divisions = track.results?.divisions || {};
        Object.values(divisions).forEach(div => {
            const divCarsUsed = div.carsUsed || {};
            Object.entries(divCarsUsed).forEach(([driver, car]) => {
                if (!driver || !car) return;
                const canonical = resolveAlias(driver);
                if (!usage[canonical]) usage[canonical] = {};
                usage[canonical][car] = (usage[canonical][car] || 0) + 1;
            });
        });
    });

    return usage;
}

/**
 * Valida si registrar el uso de `car` para `driver` en una nueva carrera
 * violaría los límites del campeonato.
 *
 * @param {string} driver - Nombre canónico del piloto
 * @param {string} car - Auto a usar en esta carrera
 * @param {Object} currentUsage - Salida de calculateCarUsage() (estado ANTES de esta carrera)
 * @param {Object} config - championship.carUsageTracking
 * @param {Array} declaredCars - registration.declaredCars del piloto (array de strings)
 * @returns {{ valid: boolean, violations: string[] }}
 */
export function validateCarUsage(driver, car, currentUsage, config, declaredCars = []) {
    const violations = [];
    const driverUsage = currentUsage[driver] || {};

    // 1. El auto debe haber sido declarado por el piloto (si hay declaración)
    if (declaredCars.length > 0 && !declaredCars.includes(car)) {
        violations.push(`"${car}" no fue declarado por ${driver}`);
    }

    // 2. No superar el límite de usos de este auto en particular
    const usesOfThisCar = (driverUsage[car] || 0) + 1; // +1 por la carrera actual
    if (usesOfThisCar > (config.maxUsesPerCar ?? 2)) {
        violations.push(
            `${driver} ya usó "${car}" ${driverUsage[car]} vez(es) — máximo ${config.maxUsesPerCar}`
        );
    }

    // 3. No superar el número máximo de autos distintos (solo si este auto es nuevo para el piloto)
    const isNewCar = !(car in driverUsage);
    if (isNewCar) {
        const distinctCars = Object.keys(driverUsage).length + 1;
        if (distinctCars > (config.maxCarsPerDriver ?? 3)) {
            violations.push(
                `${driver} ya tiene ${Object.keys(driverUsage).length} autos distintos — máximo ${config.maxCarsPerDriver}`
            );
        }
    }

    return { valid: violations.length === 0, violations };
}

/**
 * Valida el uso de autos de todos los pilotos de una carrera antes de guardar.
 * Útil para el enforcement bloqueante en handleSaveResults.
 *
 * @param {Object} newCarsUsed - { [driverName]: carName } — lo que se va a guardar
 * @param {Object} currentUsage - Estado acumulado SIN incluir esta carrera
 * @param {Object} config - championship.carUsageTracking
 * @param {Array} registrations - championship.registrations[]
 * @returns {{ valid: boolean, violations: string[] }}
 */
export function validateRaceCarUsage(newCarsUsed, currentUsage, config, registrations = []) {
    const allViolations = [];

    // Construir mapa driver → declaredCars
    const declaredMap = {};
    (registrations || []).forEach(reg => {
        const key = reg.gt7Id || reg.name || reg.psnId;
        if (key && reg.declaredCars?.length > 0) {
            declaredMap[key] = reg.declaredCars;
            // también mapear por psnId si difiere
            if (reg.psnId && reg.psnId !== key) declaredMap[reg.psnId] = reg.declaredCars;
        }
    });

    Object.entries(newCarsUsed).forEach(([driver, car]) => {
        if (!car) return; // sin asignación → no validar
        const declared = declaredMap[driver] || [];
        const { violations } = validateCarUsage(driver, car, currentUsage, config, declared);
        allViolations.push(...violations);
    });

    return { valid: allViolations.length === 0, violations: allViolations };
}

/**
 * Determina qué entradas (driver, trackId) deben tener sus puntos anulados
 * por violaciones de uso de autos. Se usa en standingsCalculator para invalidar
 * automáticamente los puntos de esa carrera sin bloquear el guardado.
 *
 * @param {Array} tracks - Pistas del campeonato (con track.carsUsed y track.id)
 * @param {Object} config - championship.carUsageTracking
 * @param {Array} registrations - championship.registrations[]
 * @returns {Set<string>} Set de claves "driverId::trackId" con puntos invalidados
 */
export function getInvalidatedEntries(tracks, config, registrations = []) {
    if (!config?.enabled) return new Set();

    const invalidated = new Set();

    // Construir mapa driver → declaredCars
    const declaredMap = {};
    (registrations || []).forEach(reg => {
        const key = reg.gt7Id || reg.name || reg.psnId;
        if (key) {
            declaredMap[key] = reg.declaredCars || [];
            if (reg.psnId && reg.psnId !== key) declaredMap[reg.psnId] = reg.declaredCars || [];
        }
    });

    // Recorrer carreras en orden (round asc) para acumular uso progresivo
    const sorted = [...(tracks || [])].sort((a, b) => (a.round || 0) - (b.round || 0));
    const cumulativeUsage = {}; // { driver: { car: count } } — estado ANTES de cada carrera

    sorted.forEach(track => {
        const carsUsed = track.carsUsed || {};

        Object.entries(carsUsed).forEach(([driver, car]) => {
            if (!driver || !car) return;

            const driverUsage = cumulativeUsage[driver] || {};
            const declaredCars = declaredMap[driver] || [];
            const { violations } = validateCarUsage(driver, car, cumulativeUsage, config, declaredCars);

            if (violations.length > 0) {
                invalidated.add(`${driver}::${track.id}`);
            }

            // Actualizar uso acumulado (se cuenta aunque sea inválido para detectar futuras violaciones)
            if (!cumulativeUsage[driver]) cumulativeUsage[driver] = {};
            cumulativeUsage[driver][car] = (cumulativeUsage[driver][car] || 0) + 1;
        });

        // Pilotos sin auto asignado en esta carrera no se acumulan
    });

    return invalidated;
}

/**
 * Genera un resumen de estado de uso por piloto para mostrar en UI.
 *
 * @param {Object} usage - Salida de calculateCarUsage()
 * @param {Object} config - championship.carUsageTracking
 * @param {Array} registrations - championship.registrations[]
 * @returns {Array<{ driver, declaredCars, usedCars, distincCarsCount, violations, nearLimit }>}
 */
export function buildCarUsageSummary(usage, config, registrations = []) {
    const maxUses = config?.maxUsesPerCar ?? 2;
    const maxCars = config?.maxCarsPerDriver ?? 3;
    const alertAt = config?.alertThreshold ?? 1;

    // Reunir todos los pilotos (con o sin uso registrado)
    const allDrivers = new Set();
    (registrations || []).forEach(reg => {
        const key = reg.gt7Id || reg.name || reg.psnId;
        if (key) allDrivers.add(key);
    });
    Object.keys(usage).forEach(d => allDrivers.add(d));

    const declaredMap = {};
    (registrations || []).forEach(reg => {
        const key = reg.gt7Id || reg.name || reg.psnId;
        if (key) declaredMap[key] = reg.declaredCars || [];
    });

    return Array.from(allDrivers).map(driver => {
        const driverUsage = usage[driver] || {};
        const declaredCars = declaredMap[driver] || [];
        const usedCars = Object.entries(driverUsage).map(([car, count]) => ({
            car,
            count,
            overLimit: count >= maxUses,
            nearLimit: count >= alertAt
        }));
        const distinctCount = Object.keys(driverUsage).length;
        const violations = [];

        usedCars.forEach(({ car, count }) => {
            if (count > maxUses) violations.push(`"${car}" usado ${count}/${maxUses} veces`);
            if (declaredCars.length > 0 && !declaredCars.includes(car)) {
                violations.push(`"${car}" no declarado`);
            }
        });
        if (distinctCount > maxCars) violations.push(`${distinctCount}/${maxCars} autos distintos`);

        return {
            driver,
            declaredCars,
            usedCars,
            distinctCount,
            violations,
            hasViolation: violations.length > 0,
            nearLimit: usedCars.some(c => c.nearLimit)
        };
    });
}
