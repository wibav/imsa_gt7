/**
 * Convierte registrations de equipo en entradas planas por piloto.
 * Permite que standings y carUsage sigan funcionando sin cambios cuando
 * la inscripción es de equipo (drivers[]).
 *
 * Para registros individuales (sin drivers[]) devuelve el registro tal cual.
 *
 * @param {Array} registrations - championship.registrations[]
 * @returns {Array} Array de registros planos, uno por piloto
 */
export function flattenRegistrations(registrations = []) {
    const flat = [];
    for (const reg of registrations) {
        if (Array.isArray(reg.drivers) && reg.drivers.length > 0) {
            // Registro de equipo: expandir a un entry por piloto
            reg.drivers.forEach(driver => {
                flat.push({
                    ...driver,                  // gt7Id, psnId, category, declaredCars
                    id: `${reg.id}_${driver.gt7Id || driver.psnId}`,
                    teamName: reg.teamName,
                    teamRegistrationId: reg.id,
                    status: reg.status,
                    createdAt: reg.createdAt
                });
            });
        } else {
            flat.push(reg);
        }
    }
    return flat;
}

/**
 * Id del documento de declaración para una inscripción.
 *
 * El id de un piloto de equipo es sintético (`${reg.id}_${gt7Id||psnId}`, ver
 * flattenRegistrations) y el gt7Id lo escribe el propio piloto, así que puede
 * traer barras — que Firestore no admite en un id de documento. Se sustituyen
 * de forma determinista para que guardar y leer usen siempre la misma clave.
 */
export function declarationDocId(registrationId) {
    return String(registrationId || '').replace(/\//g, '_');
}

/**
 * Vuelca las declaraciones (subcolección `declarations`) sobre las
 * inscripciones ya aplanadas, dejando `declaredCars` donde el resto del
 * código lo espera.
 *
 * Si una inscripción no tiene documento en la subcolección se respeta su
 * `declaredCars` embebido: es el formato antiguo, previo a mover las
 * declaraciones fuera del array de inscripciones.
 *
 * @param {Array}  flatRegs     - salida de flattenRegistrations()
 * @param {Object} declarations - { [docId]: string[] }
 */
export function applyDeclarations(flatRegs = [], declarations = {}) {
    if (!declarations || Object.keys(declarations).length === 0) return flatRegs;
    return flatRegs.map(reg => {
        const cars = declarations[declarationDocId(reg.id)];
        return cars ? { ...reg, declaredCars: cars } : reg;
    });
}

/**
 * Categoría del campeonato → clase de coche del catálogo oficial de GT7.
 * El juego usa "Gr.4"/"Gr.N"; la app guarda "Gr4"/"Street" en
 * championship.categories, así que hace falta traducir para cruzar ambos.
 * ("Street" son los coches de calle, que en GT7 son la clase Gr.N.)
 */
export const CATEGORY_TO_CAR_CLASS = {
    Gr1: 'Gr.1',
    Gr2: 'Gr.2',
    Gr3: 'Gr.3',
    Gr4: 'Gr.4',
    GrB: 'Gr.B',
    Street: 'Gr.N',
};

/**
 * Coches del catálogo oficial que corresponden a unas categorías dadas.
 * Si ninguna categoría mapea a una clase de GT7 (categorías propias de la
 * liga), no se acota: se devuelve el catálogo entero, que sigue siendo una
 * lista válida de coches del juego.
 *
 * La usan tanto el selector del organizador como el del piloto, para que
 * ambos ofrezcan exactamente lo mismo.
 *
 * @param {string[]} categories - championship.categories
 * @param {Array}    allCars    - catálogo global (FirebaseService.getCars())
 */
export function getCarsForCategories(categories = [], allCars = []) {
    const classes = new Set(
        (categories || []).map(cat => CATEGORY_TO_CAR_CLASS[cat]).filter(Boolean)
    );
    if (classes.size === 0) return allCars;
    return allCars.filter(c => classes.has(c.carClass));
}

/**
 * Coches que un piloto puede declarar en este campeonato.
 *
 * Prioridad:
 *   1. `carUsageTracking.carCatalog` si el organizador definió una lista
 *      concreta (gana siempre: puede ser un subconjunto muy acotado).
 *   2. Si no, los del catálogo oficial que correspondan a las categorías del
 *      campeonato (ej. categories:["Gr4"] → los 34 Gr.4).
 *
 * Devuelve [] solo si no hay catálogo cargado (colección vacía o fallo de
 * lectura), que es la señal para caer a texto libre.
 *
 * @param {Object} championship
 * @param {Array}  allCars - catálogo global (FirebaseService.getCars())
 * @returns {Array<{name: string, carClass?: string, manufacturer?: string, pp?: number}>}
 */
export function getAllowedCars(championship, allCars = []) {
    const catalog = championship?.carUsageTracking?.carCatalog || [];
    if (catalog.length > 0) {
        // El catálogo del organizador son nombres sueltos: se enriquecen con
        // los datos oficiales cuando el nombre coincide, si no van pelados.
        const byName = new Map(allCars.map(c => [c.name, c]));
        return catalog.map(name => byName.get(name) || { name });
    }
    return getCarsForCategories(championship?.categories, allCars);
}

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

    // 1. El auto debe estar permitido (declarado por el piloto o en catálogo fijo)
    if (declaredCars.length > 0 && !declaredCars.includes(car)) {
        const label = config.mode === 'fixed' ? 'no está en el catálogo fijo' : `no fue declarado por ${driver}`;
        violations.push(`"${car}" ${label}`);
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

    const isFixed = config.mode === 'fixed';
    const fixedCatalog = isFixed ? (config.carCatalog || []) : null;

    // Construir mapa driver → lista permitida de autos
    // En modo 'fixed': todos los pilotos comparten el catálogo del admin
    // En modo 'declared': cada piloto tiene su propia declaración
    const declaredMap = {};
    (registrations || []).forEach(reg => {
        const key = reg.gt7Id || reg.name || reg.psnId;
        if (key) {
            declaredMap[key] = isFixed ? fixedCatalog : (reg.declaredCars || []);
            if (reg.psnId && reg.psnId !== key) {
                declaredMap[reg.psnId] = isFixed ? fixedCatalog : (reg.declaredCars || []);
            }
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

/**
 * Uso de autos por piloto y por carrera, listo para pintar del lado del piloto.
 *
 * El dato existía —cada carrera guarda `carsUsed` con el auto de cada piloto—
 * pero solo lo leía el panel de administración: un piloto no tenía forma de
 * saber qué auto usó en cada fecha ni cuántos usos le quedaban, que en un
 * campeonato con límite de usos es información que necesita ANTES de la
 * siguiente carrera, no después.
 *
 * @param {Array} tracks - Pistas ordenadas por ronda, con `carsUsed`
 * @param {Object} config - championship.carUsageTracking
 * @param {Array} pilotos - Nombres de piloto a listar (inscritos)
 * @param {Function} [resolveAlias] - Normaliza el nombre (GT7 ID canónico)
 * @returns {{carreras: Array, filas: Array}}
 */
export function construirUsoDeAutos(tracks = [], config = {}, pilotos = [], resolveAlias = (n) => n) {
    const maxUsos = config?.maxUsesPerCar ?? 2;
    const maxAutos = config?.maxCarsPerDriver ?? 3;
    const catalogo = config?.carCatalog || [];
    const esFijo = config?.mode === 'fixed';

    const carreras = [...tracks]
        .filter(t => Object.keys(t.carsUsed || {}).length > 0)
        .sort((a, b) => (a.round || 0) - (b.round || 0))
        .map(t => ({ id: t.id, round: t.round, name: t.name, date: t.date }));

    // Auto de cada piloto en cada carrera, con los nombres ya normalizados.
    const porPiloto = {};
    const anota = (nombre, trackId, auto) => {
        if (!nombre || !auto) return;
        const canonico = resolveAlias(nombre);
        porPiloto[canonico] = porPiloto[canonico] || { porCarrera: {}, usos: {} };
        // Si el mismo piloto apareciera dos veces en una carrera (dos alias sin
        // fusionar), el primero manda: contarlo dos veces inflaría sus usos.
        if (porPiloto[canonico].porCarrera[trackId]) return;
        porPiloto[canonico].porCarrera[trackId] = auto;
        porPiloto[canonico].usos[auto] = (porPiloto[canonico].usos[auto] || 0) + 1;
    };

    tracks.forEach(track => {
        Object.entries(track.carsUsed || {}).forEach(([n, auto]) => anota(n, track.id, auto));
        Object.values(track.results?.divisions || {}).forEach(div => {
            Object.entries(div?.carsUsed || {}).forEach(([n, auto]) => anota(n, track.id, auto));
        });
    });

    const nombres = new Set(pilotos.map(p => resolveAlias(p)).filter(Boolean));
    Object.keys(porPiloto).forEach(n => nombres.add(n));

    const filas = [...nombres].map(piloto => {
        const datos = porPiloto[piloto] || { porCarrera: {}, usos: {} };
        const usos = Object.entries(datos.usos)
            .map(([auto, veces]) => ({ auto, veces, agotado: veces >= maxUsos, excedido: veces > maxUsos }))
            .sort((a, b) => b.veces - a.veces || a.auto.localeCompare(b.auto));

        // Autos del catálogo con usos libres. Solo tiene sentido en modo fijo:
        // en modo declaración cada piloto elige los suyos y el catálogo es la
        // lista de dónde elegir, no lo que tiene disponible.
        const disponibles = esFijo && catalogo.length > 0
            ? catalogo
                .map(auto => ({ auto, restantes: maxUsos - (datos.usos[auto] || 0) }))
                .filter(x => x.restantes > 0)
            : [];

        const distintos = usos.length;
        const avisos = [];
        usos.forEach(({ auto, veces }) => {
            if (veces > maxUsos) avisos.push(`"${auto}" usado ${veces} veces (máx. ${maxUsos})`);
        });
        if (distintos > maxAutos) avisos.push(`${distintos} autos distintos (máx. ${maxAutos})`);

        return {
            piloto,
            porCarrera: datos.porCarrera,
            usos,
            distintos,
            disponibles,
            usosRestantes: disponibles.reduce((a, x) => a + x.restantes, 0),
            avisos,
        };
    }).sort((a, b) => b.usos.length - a.usos.length || a.piloto.localeCompare(b.piloto));

    return { carreras, filas, maxUsos, maxAutos, esFijo, catalogo };
}
