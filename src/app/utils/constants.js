/**
 * Constantes compartidas del proyecto
 * Centraliza valores duplicados entre componentes y modelos
 */

/**
 * Colores CSS de Tailwind para badges de estado de campeonato
 */
export const STATUS_COLORS = {
    active: 'bg-green-500',
    draft: 'bg-gray-500',
    completed: 'bg-blue-500',
    archived: 'bg-gray-600'
};

/**
 * Etiquetas traducidas para estados de campeonato
 */
export const STATUS_LABELS = {
    active: 'Activo',
    draft: 'Borrador',
    completed: 'Finalizado',
    archived: 'Archivado'
};

/**
 * Colores semánticos para el modelo Championship (sin prefijo Tailwind)
 */
export const STATUS_SEMANTIC_COLORS = {
    draft: 'gray',
    active: 'green',
    completed: 'blue',
    archived: 'yellow'
};

/**
 * Fondos de posición para tablas de clasificación (top 3)
 */
export const POSITION_BG = {
    0: 'bg-yellow-500/10',
    1: 'bg-gray-400/10',
    2: 'bg-orange-700/10'
};

/**
 * Medallas/emojis por posición
 */
export const POSITION_MEDALS = {
    0: '🥇',
    1: '🥈',
    2: '🥉'
};

/**
 * Obtiene la clase CSS de fondo para una posición en la clasificación
 * @param {number} index - Índice (0-based)
 * @returns {string} Clase CSS
 */
export const getPositionBg = (index) => POSITION_BG[index] || '';

/**
 * Obtiene la medalla/emoji para una posición
 * @param {number} index - Índice (0-based)
 * @returns {string|null} Emoji de medalla o null para posiciones > 3
 */
export const getPositionMedal = (index) => POSITION_MEDALS[index] || null;

/**
 * Renderiza el indicador de posición (medalla o número)
 * @param {number} index - Índice (0-based)
 * @returns {string} Medalla emoji o número de posición
 */
export const getPositionDisplay = (index) => {
    return POSITION_MEDALS[index] || (index + 1).toString();
};

/**
 * Colores para resultados en cards (primera, segunda, tercera posición y resto)
 */
export const RESULT_COLORS = {
    0: {
        bg: 'bg-yellow-500/20 border border-yellow-500/30',
        text: 'text-yellow-400'
    },
    1: {
        bg: 'bg-gray-400/20 border border-gray-400/30',
        text: 'text-gray-300'
    },
    2: {
        bg: 'bg-orange-500/20 border border-orange-500/30',
        text: 'text-orange-400'
    },
    default: {
        bg: 'bg-white/5',
        text: 'text-blue-400'
    }
};

/**
 * Obtiene los colores de resultado para una posición
 * @param {number} index - Índice (0-based)
 * @returns {{ bg: string, text: string }}
 */
export const getResultColors = (index) => RESULT_COLORS[index] || RESULT_COLORS.default;

/**
 * Lista completa de circuitos de Gran Turismo 7
 * Fuente única de verdad para todos los formularios y el admin de pistas
 */
export const GT7_TRACKS = [
    "Alsace - Village",
    "Autodrome Lago Maggiore - East",
    "Autodrome Lago Maggiore - GP",
    "Autodrome Lago Maggiore - West",
    "Autopolis - International Racing Course",
    "Autopolis - Shortcut",
    "Autódromo de Interlagos",
    "Barcelona-Catalunya - GP",
    "Barcelona-Catalunya - No Chicane",
    "BB Raceway",
    "Blue Moon Bay Speedway",
    "Blue Moon Bay Speedway - Infield A",
    "Blue Moon Bay Speedway - Infield B",
    "Brands Hatch - GP",
    "Brands Hatch - Indy",
    "Broad Bean Raceway",
    "Circuit de la Sarthe (Le Mans)",
    "Circuit de la Sarthe - No Chicane",
    "Circuit de Sainte-Croix - A",
    "Circuit de Sainte-Croix - B",
    "Circuit de Sainte-Croix - C",
    "Circuit de Spa-Francorchamps",
    "Circuit Gilles Villeneuve",
    "Colorado Springs - Club",
    "Colorado Springs - Lake",
    "Daytona International Speedway - Oval",
    "Daytona International Speedway - Road Course",
    "Deep Forest Raceway",
    "Dragon Trail - Gardens",
    "Dragon Trail - Seaside",
    "Fishermans Ranch",
    "Fuji International Speedway",
    "Goodwood Motor Circuit",
    "Grand Valley - East",
    "Grand Valley - Highway 1",
    "Grand Valley - South",
    "High Speed Ring",
    "Kyoto Driving Park - Miyabi",
    "Kyoto Driving Park - Yamagiwa",
    "Laguna Seca",
    "Lake Louise - Long Track",
    "Lake Louise - Short Track",
    "Lake Louise - Tri-Oval",
    "Le Mans - Circuit Bugatti",
    "Michelin Raceway Road Atlanta",
    "Monza",
    "Monza - No Chicane",
    "Mount Panorama (Bathurst)",
    "Northern Isle Speedway",
    "Nürburgring - 24h",
    "Nürburgring - GP",
    "Nürburgring - Nordschleife",
    "Red Bull Ring",
    "Red Bull Ring - Short Track",
    "Sardegna - Road Track A",
    "Sardegna - Road Track B",
    "Sardegna - Road Track C",
    "Sardegna - Windmills",
    "Special Stage Route X",
    "Suzuka Circuit",
    "Tokyo Expressway - Central Clockwise",
    "Tokyo Expressway - Central Counterclockwise",
    "Tokyo Expressway - East Clockwise",
    "Tokyo Expressway - East Counterclockwise",
    "Tokyo Expressway - South Clockwise",
    "Tokyo Expressway - South Counterclockwise",
    "Trial Mountain Circuit",
    "Tsukuba Circuit",
    "Watkins Glen International",
    "Watkins Glen International - Short Course",
    "Willow Springs - Big Willow",
    "Willow Springs - Horse Thief Mile",
    "Willow Springs - Streets of Willow",
    "Yas Marina Circuit"
];

// ================================
// Event Constants
// ================================

/**
 * Configuración de estados para eventos únicos
 */
export const EVENT_STATUSES = {
    upcoming: { label: 'Próximo', color: 'bg-blue-500', textColor: 'text-blue-400', icon: '📅' },
    live: { label: 'En Vivo', color: 'bg-green-500', textColor: 'text-green-400', icon: '🔴' },
    completed: { label: 'Finalizado', color: 'bg-gray-500', textColor: 'text-gray-400', icon: '✅' }
};

/**
 * Categorías de eventos
 */
export const EVENT_CATEGORIES = [
    { value: 'competitive', label: 'Competitivo', icon: '🏆' },
    { value: 'casual', label: 'Casual', icon: '🎮' },
    { value: 'special', label: 'Especial', icon: '⭐' },
    { value: 'endurance', label: 'Endurance', icon: '⏱️' },
    { value: 'time-attack', label: 'Time Attack', icon: '⚡' },
    { value: 'drift', label: 'Drift', icon: '🌪️' }
];

/**
 * Formatos de evento (tipo de sesión)
 */
export const EVENT_FORMATS = [
    { value: 'race', label: 'Carrera única' },
    { value: 'sprint+race', label: 'Sprint + Carrera' },
    { value: 'endurance', label: 'Resistencia' },
    { value: 'time-attack', label: 'Time Attack' },
    { value: 'drift', label: 'Drift' }
];

/**
 * Plataformas de streaming soportadas
 */
export const STREAMING_PLATFORMS = [
    { value: 'youtube', label: 'YouTube', icon: '📺' },
    { value: 'twitch', label: 'Twitch', icon: '🟣' },
    { value: 'kick', label: 'Kick', icon: '🟢' },
    { value: 'facebook', label: 'Facebook Gaming', icon: '🔵' },
    { value: 'other', label: 'Otra', icon: '🔗' }
];

/**
 * Opciones de neumáticos GT7
 */
export const TYRE_OPTIONS = [
    { value: 'CD', label: 'Competición Duro (CD)', group: 'Racing' },
    { value: 'CM', label: 'Competición Medio (CM)', group: 'Racing' },
    { value: 'CB', label: 'Competición Blando (CB)', group: 'Racing' },
    { value: 'DD', label: 'Sport Duro (DD)', group: 'Sport' },
    { value: 'DM', label: 'Sport Medio (DM)', group: 'Sport' },
    { value: 'DB', label: 'Sport Blando (DB)', group: 'Sport' },
    { value: 'RD', label: 'Regular Duro (RD)', group: 'Regular' },
    { value: 'RM', label: 'Regular Medio (RM)', group: 'Regular' },
    { value: 'RB', label: 'Regular Blando (RB)', group: 'Regular' },
    { value: 'CI', label: 'Intermedio (CI)', group: 'Wet' },
    { value: 'CLI', label: 'Lluvia (CLI)', group: 'Wet' },
    { value: 'TRR', label: 'Rally (TRR)', group: 'Other' },
    { value: 'NVE', label: 'Nieve (NVE)', group: 'Other' }
];

/**
 * Opciones de daños
 */
export const DAMAGE_OPTIONS = [
    { value: 'No', label: 'Sin daños' },
    { value: 'Leves', label: 'Daños leves' },
    { value: 'Graves', label: 'Daños graves' }
];

/**
 * Horas del día para clima GT7
 */
export const WEATHER_TIME_OPTIONS = [
    'Primera h. mañana',
    'Última h. mañana',
    'Tarde',
    'Atardecer',
    'Crepúsculo',
    'Puesta del Sol',
    'Medianoche'
];
