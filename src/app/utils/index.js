// Barrel export para utilidades compartidas
export { formatDateShort, formatDateFull, isInCurrentWeek } from './dateUtils';
export { calculateProgress, getNextRace, getStandings, getDriverStandings } from './championshipUtils';
export {
    STATUS_COLORS,
    STATUS_LABELS,
    STATUS_SEMANTIC_COLORS,
    POSITION_BG,
    POSITION_MEDALS,
    getPositionBg,
    getPositionMedal,
    getPositionDisplay,
    RESULT_COLORS,
    getResultColors
} from './constants';
