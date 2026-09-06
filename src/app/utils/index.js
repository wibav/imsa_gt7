// Barrel export para utilidades compartidas
export {
    formatDateShort,
    formatDateFull,
    isInCurrentWeek,
    DEFAULT_RACE_TIME,
    getRaceTime,
    raceDateTime,
    localRaceTime,
} from './dateUtils';
export { calculateProgress, getNextRace, getStandings, getDriverStandings } from './championshipUtils';
export { calculateAdvancedStandings, getDriverStats, compareDrivers, getStandingsByCategory } from './standingsCalculator';
export { flattenRegistrations } from './carUsageCalculator';
export { compressImage, validateImageFile } from './imageCompression';
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
    getResultColors,
    EVENT_TYPES,
    getDefaultRounds,
    EVENT_STATUSES,
    EVENT_CATEGORIES,
    EVENT_FORMATS,
    STREAMING_PLATFORMS,
    TYRE_OPTIONS,
    DAMAGE_OPTIONS,
    WEATHER_TIME_OPTIONS
} from './constants';
