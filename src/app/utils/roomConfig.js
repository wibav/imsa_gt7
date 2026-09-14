/**
 * Configuración de sala de GT7: qué opciones existen, en qué orden y con qué
 * nombres las muestra el juego.
 *
 * Es la fuente única para el editor del admin (RoomConfigEditor) y la ficha
 * pública de cada carrera (RoomConfigView). Antes cada pantalla tenía su propia
 * lista de campos y sus propias etiquetas ("Contravolante", "Engine Swap",
 * "Moderado"…), que no coincidían con lo que el anfitrión ve al crear la sala.
 *
 * Nombres, opciones y orden tomados del menú «Crear sala» de GT7 en español
 * (capturas de 2026-09-14). Las opciones marcadas con `sinVerificar` no
 * aparecían desplegadas en las capturas.
 *
 * Los valores se guardan en `track.rules`, en las mismas claves que ya existían
 * cuando la había; `normalizarReglas` traduce los valores antiguos ("Graves",
 * true, "SI", "moderate"…) a los nuevos, así que las 51 carreras guardadas se
 * siguen viendo sin migrar nada.
 */

import { TYRE_OPTIONS, WEATHER_TIME_OPTIONS, WEATHER_CONDITION_OPTIONS, WEATHER_TRANSITION_OPTIONS } from './constants.js';

const SI_NO = (si = 'Activado', no = 'Desactivado') => [{ value: true, label: si }, { value: false, label: no }];
const PROHIBIDO_SIN_LIMITE = [{ value: 'prohibited', label: 'Prohibido' }, { value: 'unlimited', label: 'Sin límite' }];
const REBUFO = [
    { value: 'strong', label: 'Fuerte' },
    { value: 'weak', label: 'Débil' },
    { value: 'real', label: 'Real' },
    { value: 'off', label: 'Desactivado' },
];
const IGUAL_QUE_CARRERA = 'race';

export const GRUPOS_AJUSTES = [
    { grupo: 'Suspensión', opciones: ['Ajuste de altura de carrocería', 'Barra antivuelco', 'Relación de amortiguación', 'Frecuencia natural', 'Ángulo de caída negativo', 'Ángulo de convergencia'] },
    { grupo: 'Diferencial', opciones: ['Diferencial', 'Diferencial central de vectorización de par'] },
    { grupo: 'Transmisión', opciones: ['Transmisión (sin marcha final)', 'Transmisión (marcha final)'] },
    { grupo: 'Otros', opciones: ['Carga aerodinámica', 'Sistema Anti-Lag', 'Balance de freno'] },
];
const TODOS_LOS_AJUSTES = GRUPOS_AJUSTES.flatMap(g => g.opciones);

const COMPUESTOS = [
    { value: 'hard', label: 'Duros' },
    { value: 'medium', label: 'Medios' },
    { value: 'soft', label: 'Blandos' },
];

/**
 * Secciones en el orden del juego. Tipos de campo:
 * - select: `opciones` [{value,label}]
 * - numero: `unidad`, `min`, `max`, `step`, `vacio` (texto si no hay valor)
 * - multiplicador: número mostrado como "4x"; admite IGUAL_QUE_CARRERA si `igualQueCarrera`
 * - compuestos: lista de COMPUESTOS; vacío = "Todo"
 * - ajustes: lista de TODOS_LOS_AJUSTES
 * - clima: franjas de clima
 *
 * `visibleSi(reglas, track)` oculta campos que no aplican.
 */
export const SECCIONES_SALA = [
    {
        id: 'pista',
        titulo: 'Pista y clima',
        campos: [
            { id: '__victoria', etiqueta: 'Condición de victoria', tipo: 'soloLectura' },
            { id: 'timeOfDay', etiqueta: 'Hora del día', tipo: 'select', opciones: [{ value: '', label: 'Predeterminada' }, ...WEATHER_TIME_OPTIONS.map(t => ({ value: t, label: t }))] },
            { id: 'timeMultiplier', etiqueta: 'Escala de tiempo variable', tipo: 'multiplicador', min: 1, max: 60 },
            { id: 'weather', etiqueta: 'Clima', tipo: 'select', opciones: [{ value: 'clear', label: 'Despejado' }, { value: 'rain', label: 'Lluvia' }, { value: 'variable', label: 'Clima personalizado' }] },
            { id: 'weatherSlots', etiqueta: 'Clima durante la carrera', tipo: 'clima', ancho: 'completo', visibleSi: r => r.weather === 'variable' },
        ],
    },
    {
        id: 'carrera',
        titulo: 'Configuración de la carrera',
        campos: [
            {
                id: 'startType', etiqueta: 'Tipo de salida', tipo: 'select', opciones: [
                    { value: 'grid_false_start', label: 'En grilla con verificación de salida en falso' },
                    { value: 'grid', label: 'En grilla', sinVerificar: true },
                    { value: 'rolling', label: 'Salida lanzada', sinVerificar: true },
                ],
            },
            {
                id: 'gridOrder', etiqueta: 'Orden de grilla', tipo: 'select', opciones: [
                    { value: 'fastest_first', label: 'Los más rápidos primero' },
                    { value: 'slowest_first', label: 'Los más lentos primero' },
                    { value: 'host', label: 'Definido por el anfitrión' },
                ],
            },
            { id: 'tuningProhibited', etiqueta: 'Modificaciones/BdR prohibidos', tipo: 'select', opciones: SI_NO() },
            { id: 'tuningOptions', etiqueta: 'Opciones de configuración', tipo: 'ajustes', ancho: 'completo', visibleSi: r => r.tuningProhibited === true },
            { id: 'boost', etiqueta: 'Impulso', tipo: 'select', opciones: [{ value: 'off', label: 'Desactivado' }, { value: 'weak', label: 'Débil', sinVerificar: true }, { value: 'strong', label: 'Fuerte', sinVerificar: true }] },
            { id: 'raceSlipstream', etiqueta: 'Fuerza de rebufo', tipo: 'select', opciones: REBUFO },
            { id: 'visibleDamage', etiqueta: 'Daños visibles', tipo: 'select', opciones: SI_NO() },
            {
                id: 'mechanicalDamage', etiqueta: 'Daño mecánico', tipo: 'select', opciones: [
                    { value: 'none', label: 'Ninguno' },
                    { value: 'light', label: 'Leve' },
                    { value: 'heavy', label: 'Grave' },
                    { value: 'championship', label: 'Campeonato' },
                ],
            },
            { id: 'tireWear', etiqueta: 'Índice de desgaste de los neumáticos', tipo: 'multiplicador', min: 0, max: 50 },
            { id: 'fuelConsumption', etiqueta: 'Índice de consumo de combustible', tipo: 'multiplicador', min: 0, max: 50 },
            { id: 'fuelRefillRate', etiqueta: 'Velocidad de recarga de combustible', tipo: 'numero', unidad: 'L/s', min: 1, max: 20 },
            { id: 'startingFuel', etiqueta: 'Combustible inicial', tipo: 'numero', unidad: '%', min: 0, max: 100, step: 5, vacio: 'Predeterminado' },
            { id: 'offTrackGrip', etiqueta: 'Reducción de adherencia fuera de pista', tipo: 'select', opciones: [{ value: 'real', label: 'Real' }, { value: 'weak', label: 'Débil', sinVerificar: true }, { value: 'off', label: 'Desactivado', sinVerificar: true }] },
            { id: 'raceEndDelay', etiqueta: 'Retraso del final de la carrera', tipo: 'numero', unidad: 'segundo(s)', min: 0, max: 600, step: 10 },
            { id: 'mandatoryPitStops', etiqueta: 'N.º mínimo de paradas en boxes', tipo: 'numero', min: 0, max: 10, vacio: '--', ceroEsVacio: true },
            { id: 'mandatoryCompoundChanges', etiqueta: 'Cambio de tipo de neumático requerido', tipo: 'select', opciones: SI_NO('Activada', 'Desactivada') },
            { id: 'nitroTimeMultiplier', etiqueta: 'Multiplicador de tiempo de uso del sistema de rebase/nitro', tipo: 'multiplicador', min: 0, max: 10, step: 0.1 },
        ],
    },
    {
        id: 'clasificacion',
        titulo: 'Ajustes de clasificación',
        campos: [
            { id: 'qualyDuration', etiqueta: 'Límite de tiempo', tipo: 'numero', unidad: 'min(s)', min: 1, max: 120 },
            { id: 'qualyOvertime', etiqueta: 'Tiempo de prórroga para la clasificación', tipo: 'numero', unidad: 'segundo(s)', min: 0, max: 600, step: 10 },
            { id: 'qualyTireWear', etiqueta: 'Índice de desgaste de los neumáticos (clasificación)', tipo: 'multiplicador', igualQueCarrera: true, min: 0, max: 50 },
            { id: 'qualyFuelConsumption', etiqueta: 'Índice de consumo de combustible (clasificación)', tipo: 'multiplicador', igualQueCarrera: true, min: 0, max: 50 },
            { id: 'qualyStartingFuel', etiqueta: 'Combustible inicial (clasificación)', tipo: 'numero', unidad: '%', igualQueCarrera: true, min: 0, max: 100, step: 5 },
            { id: 'qualySlipstream', etiqueta: 'Fuerza de rebufo (clasificación)', tipo: 'select', opciones: REBUFO },
        ],
    },
    {
        id: 'regulaciones',
        titulo: 'Configuración de regulaciones',
        campos: [
            { id: '__category', etiqueta: 'Filtrar por categoría', tipo: 'soloLectura' },
            { id: 'maxPR', etiqueta: 'Límite de PR', tipo: 'numero', min: 0, vacio: 'Sin límite' },
            { id: 'maxCV', etiqueta: 'Potencia de salida máx.', tipo: 'numero', unidad: 'CV', min: 0, vacio: 'Sin límite' },
            { id: 'minWeight', etiqueta: 'Peso mínimo', tipo: 'numero', unidad: 'kg', min: 0, vacio: 'Sin límite' },
            {
                id: 'usableTyres', etiqueta: 'Neumáticos utilizables', tipo: 'select', opciones: [
                    { value: 'any', label: 'Sin límite' },
                    { value: 'regular', label: 'Regular' },
                    { value: 'sport', label: 'Deportivo' },
                    { value: 'racing', label: 'Carrera' },
                ],
            },
            { id: 'usableCompounds', etiqueta: 'Tipos de neumáticos utilizables', tipo: 'compuestos' },
            { id: 'requiredCompounds', etiqueta: 'Tipo de neumáticos requeridos', tipo: 'compuestos', vacioEsNinguno: true },
            { id: 'nitro', etiqueta: 'Sistema Nitro', tipo: 'select', opciones: [{ value: 'prohibited', label: 'Prohibido' }, { value: 'allowed', label: 'Permitido', sinVerificar: true }] },
            { id: 'karts', etiqueta: 'Uso de karts', tipo: 'select', opciones: SI_NO('Activada', 'Desactivada') },
            { id: 'engineSwap', etiqueta: 'Cambio de motor', tipo: 'select', opciones: [{ value: 'prohibited', label: 'Prohibido' }, { value: 'allowed', label: 'Permitido', sinVerificar: true }] },
            { id: 'tuningParts', etiqueta: 'Piezas de modificación', tipo: 'select', opciones: [{ value: 'any', label: 'Sin restricción' }, { value: 'stock', label: 'Solo de serie', sinVerificar: true }] },
            { id: 'yearMin', etiqueta: 'Año (límite inferior)', tipo: 'numero', min: 1900, max: 2100, vacio: 'Sin límite' },
            { id: 'yearMax', etiqueta: 'Año (límite superior)', tipo: 'numero', min: 1900, max: 2100, vacio: 'Sin límite' },
            {
                id: 'drivetrain', etiqueta: 'Tren de transmisión', tipo: 'select', opciones: [
                    { value: 'any', label: 'Sin restricción' },
                    ...['FF', 'FR', 'MR', 'RR', '4WD'].map(t => ({ value: t, label: t, sinVerificar: true })),
                ],
            },
            {
                id: 'aspiration', etiqueta: 'Aspiración', tipo: 'select', opciones: [
                    { value: 'any', label: 'Sin restricción' },
                    { value: 'na', label: 'Natural', sinVerificar: true },
                    { value: 'turbo', label: 'Turbo', sinVerificar: true },
                    { value: 'supercharger', label: 'Sobrealimentador', sinVerificar: true },
                ],
            },
        ],
    },
    {
        id: 'penalizaciones',
        titulo: 'Configuración de penalizaciones',
        campos: [
            { id: 'penaltyShortcut', etiqueta: 'Penalización por tomar atajos', tipo: 'select', opciones: [{ value: 'off', label: 'Desactiv.' }, { value: 'light', label: 'Leve' }, { value: 'heavy', label: 'Grave' }] },
            {
                id: 'penaltyWall', etiqueta: 'Penalización por choque contra muros', tipo: 'select', opciones: [
                    { value: 'off', label: 'Desactiv.' },
                    { value: 'time_weak', label: 'Penalización de tiempo (débil)' },
                    { value: 'time_heavy', label: 'Penalización de tiempo (grave)' },
                ],
            },
            { id: 'wallCorrection', etiqueta: 'Corregir el trayecto tras chocar contra el muro', tipo: 'select', opciones: SI_NO('Activada', 'Desactivada') },
            { id: 'penaltyCarCollision', etiqueta: 'Penalización por choque con autos', tipo: 'select', opciones: [{ value: 'on', label: 'Activado' }, { value: 'off', label: 'Desactiv.' }] },
            { id: 'penaltyPitLine', etiqueta: 'Penalización por cruzar la línea de boxes', tipo: 'select', opciones: [{ value: 'on', label: 'Activada' }, { value: 'off', label: 'Desactivada' }] },
            { id: 'ghostCar', etiqueta: 'Fantasmas durante la carrera', tipo: 'select', opciones: SI_NO('Activado', 'Desactiv.') },
            { id: 'flagRules', etiqueta: 'Reglas de banderas', tipo: 'select', opciones: SI_NO() },
        ],
    },
    {
        id: 'conduccion',
        titulo: 'Limitaciones de las opciones de conducción',
        campos: [
            { id: 'counterSteering', etiqueta: 'Asistencia para contraviraje', tipo: 'select', opciones: PROHIBIDO_SIN_LIMITE },
            { id: 'asm', etiqueta: 'Control de estabilidad activo (ASM)', tipo: 'select', opciones: PROHIBIDO_SIN_LIMITE },
            { id: 'drivingLine', etiqueta: 'Asistencia de línea de conducción', tipo: 'select', opciones: PROHIBIDO_SIN_LIMITE },
            { id: 'tcs', etiqueta: 'Control de tracción', tipo: 'select', opciones: PROHIBIDO_SIN_LIMITE },
            { id: 'abs', etiqueta: 'ABS', tipo: 'select', opciones: [...PROHIBIDO_SIN_LIMITE, { value: 'weak', label: 'Débil' }] },
            { id: 'autoDrive', etiqueta: 'Conducción automática', tipo: 'select', opciones: PROHIBIDO_SIN_LIMITE },
        ],
    },
];

/**
 * Valores de una sala nueva: la sala real de la carrera de resistencia de
 * referencia (capturas de 2026-09-14). La hora del día no se veía en ellas.
 */
export const REGLAS_POR_DEFECTO = {
    timeOfDay: '',
    timeMultiplier: 10,
    weather: 'variable',
    weatherSlots: Array.from({ length: 9 }, () => ({ weather: '', transition: 'gradual' })),
    startType: 'grid_false_start',
    gridOrder: 'fastest_first',
    tuningProhibited: true,
    tuningOptions: ['Balance de freno'],
    boost: 'off',
    raceSlipstream: 'real',
    visibleDamage: true,
    mechanicalDamage: 'heavy',
    tireWear: 4,
    fuelConsumption: 6,
    fuelRefillRate: 3,
    startingFuel: null,
    offTrackGrip: 'real',
    raceEndDelay: 180,
    mandatoryPitStops: null,
    mandatoryCompoundChanges: false,
    nitroTimeMultiplier: 0.1,
    qualyDuration: 10,
    qualyOvertime: 180,
    qualyTireWear: IGUAL_QUE_CARRERA,
    qualyFuelConsumption: IGUAL_QUE_CARRERA,
    qualyStartingFuel: IGUAL_QUE_CARRERA,
    qualySlipstream: 'weak',
    maxPR: null,
    maxCV: null,
    minWeight: null,
    usableTyres: 'racing',
    usableCompounds: [],
    requiredCompounds: ['soft'],
    nitro: 'prohibited',
    karts: false,
    engineSwap: 'prohibited',
    tuningParts: 'any',
    yearMin: null,
    yearMax: null,
    drivetrain: 'any',
    aspiration: 'any',
    penaltyShortcut: 'heavy',
    penaltyWall: 'off',
    wallCorrection: false,
    penaltyCarCollision: 'on',
    penaltyPitLine: 'on',
    ghostCar: false,
    flagRules: true,
    counterSteering: 'prohibited',
    asm: 'prohibited',
    drivingLine: 'unlimited',
    tcs: 'unlimited',
    abs: 'unlimited',
    autoDrive: 'prohibited',
    notes: '',
};

// ── Lectura de valores antiguos ────────────────────────────────────────────

const esSi = (v) => v === true || v === 'yes' || v === 'SI' || v === 'si' || v === 'on';
const esNo = (v) => v === false || v === 'no' || v === 'NO' || v === 'off';

const ANTIGUO = {
    mechanicalDamage: { No: 'none', Leves: 'light', Graves: 'heavy' },
    // «Moderado» nunca existió en el juego (GT7 solo tiene Leve y Grave): se
    // muestra como Leve, que es lo más parecido a lo que se eligió.
    penaltyShortcut: { weak: 'light', moderate: 'light', strong: 'heavy' },
    // «Activada» sin nivel: el juego solo tiene penalización de tiempo débil o grave.
    penaltyWall: { on: 'time_weak' },
};

function asistencia(v, { abs = false } = {}) {
    if (v === undefined || v === null || v === '') return undefined;
    if (esNo(v) || v === 'prohibited') return 'prohibited';
    if (abs && v === 'weak') return 'weak';
    // 'default' y 'on': sin restricción, que es lo que el juego trae por defecto.
    return 'unlimited';
}

function rebufo(v) {
    if (v === true) return 'real';
    if (v === false) return 'off';
    return v;
}

/** "CB" → {grupo: 'racing', compuesto: 'soft'} */
function leerCodigoNeumatico(codigo) {
    const t = TYRE_OPTIONS.find(o => o.value === codigo);
    if (!t) return null;
    const grupo = { Racing: 'racing', Sport: 'sport', Regular: 'regular' }[t.group];
    const compuesto = { D: 'hard', M: 'medium', B: 'soft' }[codigo.slice(-1)];
    return grupo && compuesto ? { grupo, compuesto } : null;
}

/**
 * Reglas de una carrera con los valores del juego, estén guardadas en el
 * formato actual o en cualquiera de los antiguos. No modifica el original.
 *
 * Solo rellena lo que se puede deducir de lo guardado: un campo que la carrera
 * no tenía se queda sin valor y la ficha pública no lo muestra.
 */
export function normalizarReglas(reglas = {}) {
    const r = { ...reglas };

    // Nombres de los eventos (eventsAdmin), anteriores a este esquema.
    const renombrar = (antiguo, nuevo, traducir = v => v) => {
        if (r[nuevo] === undefined && r[antiguo] !== undefined) r[nuevo] = traducir(r[antiguo]);
    };
    renombrar('damage', 'mechanicalDamage');
    renombrar('tyreWear', 'tireWear');
    renombrar('fuelWear', 'fuelConsumption');
    renombrar('mandatoryTyres', 'mandatoryTyre');
    renombrar('mandatoryPitstops', 'mandatoryPitStops', Number);
    renombrar('mandatoryTyreChange', 'mandatoryCompoundChanges', esSi);
    // Era un interruptor sin nivel: activado se muestra como Grave, el nivel
    // que traía por defecto el formulario de circuitos.
    renombrar('shortcutPenalty', 'penaltyShortcut', v => (esSi(v) ? 'heavy' : 'off'));
    if (typeof r.weatherSlots === 'string') {
        r.weatherSlots = r.weatherSlots.trim();
        if (r.weatherSlots && r.weather === undefined) r.weather = 'variable';
        if (!r.weatherSlots) delete r.weatherSlots;
    }

    // Valores de hora del día anteriores a la lista del juego.
    if (r.timeOfDay === 'day') r.timeOfDay = 'Tarde';
    if (r.timeOfDay === 'night') r.timeOfDay = 'Medianoche';

    if (r.mechanicalDamage in ANTIGUO.mechanicalDamage) r.mechanicalDamage = ANTIGUO.mechanicalDamage[r.mechanicalDamage];
    if (r.penaltyShortcut in ANTIGUO.penaltyShortcut) r.penaltyShortcut = ANTIGUO.penaltyShortcut[r.penaltyShortcut];
    if (r.penaltyWall in ANTIGUO.penaltyWall) r.penaltyWall = ANTIGUO.penaltyWall[r.penaltyWall];
    if (r.visibleDamage === undefined && r.visualDamage !== undefined) r.visibleDamage = esSi(r.visualDamage);
    if (typeof r.ghostCar === 'string') r.ghostCar = esSi(r.ghostCar);

    // Rebufo: antes era sí/no.
    r.raceSlipstream = rebufo(r.raceSlipstream);
    r.qualySlipstream = rebufo(r.qualySlipstream);

    // Desgaste en clasificación: antes un interruptor (sí = igual que en carrera).
    if (r.qualyTireWear === true) r.qualyTireWear = IGUAL_QUE_CARRERA;
    else if (r.qualyTireWear === false) r.qualyTireWear = 0;

    // BoP y ajustes: el juego los junta en «Modificaciones/BdR prohibidos».
    if (r.tuningProhibited === undefined && (r.bop !== undefined || r.adjustments !== undefined)) {
        r.tuningProhibited = esSi(r.bop) && !esSi(r.adjustments);
    }
    if (r.engineSwap !== undefined && r.engineSwap !== 'prohibited' && r.engineSwap !== 'allowed') {
        r.engineSwap = esSi(r.engineSwap) ? 'allowed' : 'prohibited';
    }

    for (const k of ['counterSteering', 'asm', 'tcs', 'drivingLine', 'autoDrive']) {
        const v = asistencia(r[k] ?? r.drivingAssists?.[k]);
        if (v !== undefined) r[k] = v; else delete r[k];
    }
    const abs = asistencia(r.abs ?? r.drivingAssists?.abs, { abs: true });
    if (abs !== undefined) r.abs = abs; else delete r.abs;

    // Neumáticos: antes una sola lista de códigos ("CB", "CD,CM,CB").
    if (r.usableTyres === undefined && Array.isArray(r.mandatoryTyre) && r.mandatoryTyre.length > 0) {
        const leidos = r.mandatoryTyre.map(leerCodigoNeumatico).filter(Boolean);
        const grupos = [...new Set(leidos.map(l => l.grupo))];
        if (grupos.length === 1) r.usableTyres = grupos[0];
        const compuestos = [...new Set(leidos.map(l => l.compuesto))];
        // Con los tres compuestos no había obligación real: eran los utilizables.
        if (compuestos.length === 3) r.usableCompounds = [];
        else r.requiredCompounds = compuestos;
    }

    if (r.mandatoryPitStops === 0) r.mandatoryPitStops = null;
    return r;
}

// ── Mostrar ─────────────────────────────────────────────────────────────────

const etiquetaCompuestos = (lista, vacio) => {
    if (!Array.isArray(lista) || lista.length === 0) return vacio;
    if (lista.length === 3) return 'Todo';
    return COMPUESTOS.filter(c => lista.includes(c.value)).map(c => c.label).join(', ');
};

const numeroES = (n) => Number(n).toLocaleString('es-ES', { maximumFractionDigits: 2 });

/**
 * Texto de un campo tal como lo muestra el juego, o null si no hay nada que
 * mostrar (campo no definido en esta carrera).
 */
export function valorVisible(campo, reglas, track = {}) {
    if (campo.id === '__category') return track.category || null;
    if (campo.id === '__victoria') {
        if (track.victoria !== undefined) return track.victoria || null;
        if (track.raceType === 'resistencia' && track.duration) return `Límite de tiempo (${track.duration} min)`;
        if (track.raceType === 'sprint_carrera') return `Sprint ${track.sprintLaps || '?'} vueltas + carrera ${track.laps || '?'} vueltas`;
        if (track.laps) return `${track.laps} vuelta${track.laps === 1 ? '' : 's'}`;
        return null;
    }
    const v = reglas[campo.id];

    switch (campo.tipo) {
        case 'select': {
            if (v === undefined || v === null || v === '') {
                const vacia = campo.opciones.find(o => o.value === '');
                return vacia && v === '' ? vacia.label : null;
            }
            const op = campo.opciones.find(o => o.value === v);
            return op ? op.label : String(v);
        }
        case 'multiplicador':
            if (v === IGUAL_QUE_CARRERA) return 'Igual que durante la carrera';
            if (v === undefined || v === null || v === '') return null;
            return `${numeroES(v)}x`;
        case 'numero':
            if (v === IGUAL_QUE_CARRERA) return 'Igual que durante la carrera';
            if (v === undefined || v === '' || (v === null && !campo.vacio) || (campo.ceroEsVacio && v === 0)) {
                return campo.vacio && v !== undefined ? campo.vacio : null;
            }
            if (v === null) return campo.vacio;
            return campo.unidad ? `${numeroES(v)} ${campo.unidad}` : numeroES(v);
        case 'compuestos':
            if (v === undefined) return null;
            return etiquetaCompuestos(v, campo.vacioEsNinguno ? '--' : 'Todo');
        case 'ajustes': {
            if (!Array.isArray(v)) return null;
            if (v.length === 0) return 'Ninguna';
            if (v.length === TODOS_LOS_AJUSTES.length) return 'Todas';
            return `Algunas: ${v.join(', ')}`;
        }
        case 'clima': {
            // Eventos antiguos: códigos de preset escritos a mano ("S18/C05/R07").
            if (typeof v === 'string') return v || null;
            if (!Array.isArray(v) || v.length === 0) return null;
            return v.map(s => {
                const cond = typeof s === 'string' ? s : s?.weather;
                return WEATHER_CONDITION_OPTIONS.find(o => o.value === cond)?.label || cond || 'Aleatoria';
            }).join(' → ');
        }
        default:
            return v == null ? null : String(v);
    }
}

/**
 * Secciones con los campos que tienen algo que mostrar, para la ficha pública.
 * @returns {Array<{id, titulo, campos: Array<{id, etiqueta, valor, ancho}>}>}
 */
export function seccionesVisibles(track = {}) {
    const reglas = normalizarReglas(track.rules || {});
    return SECCIONES_SALA
        .map(s => ({
            id: s.id,
            titulo: s.titulo,
            campos: s.campos
                .filter(c => !c.visibleSi || c.visibleSi(reglas, track))
                .map(c => ({ id: c.id, etiqueta: c.etiqueta, valor: valorVisible(c, reglas, track), ancho: c.ancho }))
                .filter(c => c.valor !== null && c.valor !== undefined),
        }))
        .filter(s => s.campos.length > 0);
}

/**
 * Texto de un solo ajuste por su id, con las reglas ya normalizadas.
 * Para quien necesita un par de valores sueltos (el briefing, las etiquetas
 * del calendario) sin pintar toda la configuración.
 */
export function textoAjuste(track = {}, id, reglasNormalizadas = null) {
    const reglas = reglasNormalizadas || normalizarReglas(track.rules || {});
    const campo = SECCIONES_SALA.flatMap(sec => sec.campos).find(c => c.id === id);
    return campo ? valorVisible(campo, reglas, track) : null;
}

/**
 * Un evento guarda la sala repartida entre `rules` y `weather`, y la duración
 * como texto libre ("2h"). Devuelve un objeto con la forma de un circuito para
 * RoomConfigView / RoomConfigEditor.
 */
export function salaDeEvento(evento = {}) {
    const { weatherSlots, timeOfDay, timeMultiplier } = evento.weather || {};
    const reglas = { ...evento.rules };
    if (reglas.weatherSlots === undefined && weatherSlots) reglas.weatherSlots = weatherSlots;
    if (reglas.timeOfDay === undefined && timeOfDay) reglas.timeOfDay = timeOfDay;
    if (reglas.timeMultiplier === undefined && timeMultiplier) reglas.timeMultiplier = Number(timeMultiplier);
    const { laps, duration } = evento.rules || {};
    const victoria = laps ? `${laps} vuelta${Number(laps) === 1 ? '' : 's'}` : duration ? `Límite de tiempo (${/^\d+$/.test(String(duration).trim()) ? `${String(duration).trim()} min` : duration})` : '';
    return { rules: reglas, victoria };
}

/**
 * Resumen corto de la sala de un evento para tarjetas y listados:
 * [{ id, icono, texto }] con los nombres del juego.
 */
export function resumenSalaEvento(evento = {}) {
    const sala = salaDeEvento(evento);
    const reglas = normalizarReglas(sala.rules);
    const texto = (id) => textoAjuste(sala, id, reglas);
    const items = [
        ['__victoria', '⏱️', texto('__victoria')],
        ['timeOfDay', '🌤️', reglas.timeOfDay ? `${reglas.timeOfDay}${reglas.timeMultiplier > 1 ? ` · ${reglas.timeMultiplier}x` : ''}` : null],
        ['mechanicalDamage', '💥', texto('mechanicalDamage') && `Daño ${texto('mechanicalDamage').toLowerCase()}`],
        ['tireWear', '🛞', texto('tireWear') && `Desgaste ${texto('tireWear')}`],
        ['fuelConsumption', '⛽', texto('fuelConsumption') && `Consumo ${texto('fuelConsumption')}`],
        ['requiredCompounds', '🔴', reglas.requiredCompounds?.length ? `Requeridos: ${texto('requiredCompounds')}` : null],
        ['mandatoryPitStops', '🏁', reglas.mandatoryPitStops > 0 ? `${reglas.mandatoryPitStops} parada(s) mín.` : null],
    ];
    return items.filter(([, , t]) => t).map(([id, icono, t]) => ({ id, icono, texto: t }));
}

export { COMPUESTOS, TODOS_LOS_AJUSTES, IGUAL_QUE_CARRERA, WEATHER_TRANSITION_OPTIONS };
