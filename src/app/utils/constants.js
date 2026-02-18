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
