/**
 * Modelo de Sanción para campeonatos.
 * Cada sanción es un documento en la subcolección championships/{id}/penalties.
 */
export class Penalty {
    constructor(data = {}) {
        this.id = data.id || null;
        this.championshipId = data.championshipId || null;

        // Piloto sancionado
        this.driverName = data.driverName || '';
        this.teamName = data.teamName || '';

        // Carrera asociada (opcional)
        this.trackId = data.trackId || null;
        this.trackName = data.trackName || '';
        this.round = data.round || null;

        // Tipo y detalle
        this.type = data.type || 'custom';           // 'time' | 'position' | 'points' | 'warning' | 'disqualification' | 'custom'
        this.severity = data.severity || 'minor';     // 'minor' | 'moderate' | 'severe' | 'critical'
        this.presetId = data.presetId || null;        // ID del preset usado (null si es custom)
        this.name = data.name || '';                  // Nombre descriptivo
        this.description = data.description || '';    // Descripción detallada

        // Valores de la sanción
        this.points = data.points || 0;               // Puntos a deducir de la clasificación
        this.timeSeconds = data.timeSeconds || 0;      // Segundos de penalización (informativo)
        this.positionsLost = data.positionsLost || 0;   // Posiciones perdidas (informativo)
        this.warningPoints = data.warningPoints || 0;   // Puntos de amonestación acumulativos

        // Estado
        this.status = data.status || 'applied';        // 'applied' | 'revoked' | 'appealed'
        this.appealReason = data.appealReason || '';

        // Evidencia
        this.evidence = data.evidence || '';            // URL de video/imagen o texto descriptivo
        this.lap = data.lap || '';                      // Vuelta donde ocurrió
        this.incident = data.incident || '';            // Descripción del incidente

        // Reclamación (si viene de una reclamación pública)
        this.claimId = data.claimId || null;

        // Metadata
        this.appliedBy = data.appliedBy || '';
        this.appliedAt = data.appliedAt || new Date().toISOString();
        this.updatedAt = data.updatedAt || new Date().toISOString();
    }

    validate() {
        const errors = [];
        if (!this.driverName) errors.push('Piloto requerido');
        if (!this.name) errors.push('Nombre de sanción requerido');
        if (!this.type) errors.push('Tipo de sanción requerido');
        return { isValid: errors.length === 0, errors };
    }

    toFirestore() {
        const data = { ...this };
        delete data.id;
        data.updatedAt = new Date().toISOString();
        return data;
    }

    static fromFirestore(id, data) {
        return new Penalty({ id, ...data });
    }
}

/**
 * Modelo de Reclamación pública.
 * Los pilotos pueden reportar incidentes para que los admins revisen.
 */
export class Claim {
    constructor(data = {}) {
        this.id = data.id || null;
        this.championshipId = data.championshipId || null;

        // Reclamante
        this.reporterName = data.reporterName || '';
        this.reporterPsnId = data.reporterPsnId || '';

        // Pilotos reportados (puede ser más de uno)
        this.accusedNames = data.accusedNames || (data.accusedName ? [data.accusedName] : []);

        // Carrera
        this.trackId = data.trackId || null;
        this.trackName = data.trackName || '';
        this.round = data.round || null;

        // Detalle
        this.lap = data.lap || '';           // Número de vuelta (opcional)
        this.minute = data.minute || '';     // Minuto de carrera (opcional, útil en resistencia)
        this.description = data.description || '';
        this.evidence = data.evidence || '';          // URL de video (YouTube, etc.)

        // Estado
        this.status = data.status || 'pending';       // 'pending' | 'reviewing' | 'accepted' | 'rejected' | 'resolved'
        this.resolution = data.resolution || '';       // Descripción de la resolución
        this.penaltyId = data.penaltyId || null;      // Sanción creada como resultado (si aplica)
        this.resolvedBy = data.resolvedBy || '';
        this.resolvedAt = data.resolvedAt || null;

        // Metadata
        this.createdAt = data.createdAt || new Date().toISOString();
        this.updatedAt = data.updatedAt || new Date().toISOString();
    }

    validate() {
        const errors = [];
        if (!this.reporterName) errors.push('Nombre del reclamante requerido');
        if (!this.accusedNames || this.accusedNames.length === 0) errors.push('Al menos un piloto reportado requerido');
        if (!this.description) errors.push('Descripción del incidente requerida');
        if (!this.trackName && !this.trackId) errors.push('Carrera asociada requerida');
        return { isValid: errors.length === 0, errors };
    }

    toFirestore() {
        const data = { ...this };
        delete data.id;
        data.updatedAt = new Date().toISOString();
        return data;
    }

    static fromFirestore(id, data) {
        return new Claim({ id, ...data });
    }
}

/**
 * Presets de sanciones predefinidas para sim racing.
 * Cada campeonato puede activar/desactivar y editar valores.
 */
export const PENALTY_PRESETS = [
    {
        id: 'contact_minor',
        name: 'Contacto Menor',
        description: 'Contacto leve sin consecuencias graves',
        type: 'warning',
        severity: 'minor',
        points: 0,
        warningPoints: 1,
        icon: '🟡'
    },
    {
        id: 'contact_major',
        name: 'Contacto Mayor',
        description: 'Contacto que causa pérdida de posiciones o daño',
        type: 'points',
        severity: 'moderate',
        points: 3,
        warningPoints: 2,
        icon: '🟠'
    },
    {
        id: 'divebomb',
        name: 'Divebomb / Adelantamiento Peligroso',
        description: 'Maniobra de adelantamiento excesivamente agresiva',
        type: 'points',
        severity: 'moderate',
        points: 5,
        warningPoints: 2,
        icon: '💥'
    },
    {
        id: 'track_limits',
        name: 'Abuso de Límites de Pista',
        description: 'Salida de pista reiterada para ganar ventaja',
        type: 'time',
        severity: 'minor',
        points: 2,
        timeSeconds: 5,
        warningPoints: 1,
        icon: '🚧'
    },
    {
        id: 'unsafe_rejoin',
        name: 'Reingreso Inseguro',
        description: 'Reingreso a pista afectando a otros pilotos',
        type: 'points',
        severity: 'moderate',
        points: 5,
        warningPoints: 2,
        icon: '⚠️'
    },
    {
        id: 'blocking',
        name: 'Bloqueo / Defensa Excesiva',
        description: 'Movimientos defensivos ilegales o bloqueo deliberado',
        type: 'points',
        severity: 'moderate',
        points: 3,
        warningPoints: 1,
        icon: '🚫'
    },
    {
        id: 'pit_incident',
        name: 'Incidente en Pit Lane',
        description: 'Velocidad excesiva o maniobra peligrosa en pits',
        type: 'time',
        severity: 'minor',
        points: 2,
        timeSeconds: 10,
        warningPoints: 1,
        icon: '🔧'
    },
    {
        id: 'intentional_wreck',
        name: 'Choque Intencional',
        description: 'Colisión deliberada contra otro piloto',
        type: 'disqualification',
        severity: 'critical',
        points: 25,
        warningPoints: 4,
        icon: '🔴'
    },
    {
        id: 'false_start',
        name: 'Salida Falsa',
        description: 'Arranque antes de la señal de partida',
        type: 'time',
        severity: 'minor',
        points: 3,
        timeSeconds: 5,
        warningPoints: 1,
        icon: '🏳️'
    },
    {
        id: 'unsportsmanlike',
        name: 'Conducta Antideportiva',
        description: 'Comportamiento antideportivo general',
        type: 'points',
        severity: 'severe',
        points: 10,
        warningPoints: 3,
        icon: '🃏'
    },
    {
        id: 'no_show',
        name: 'No Presentarse (DNS sin aviso)',
        description: 'Ausencia sin notificación previa',
        type: 'points',
        severity: 'minor',
        points: 5,
        warningPoints: 1,
        icon: '👻'
    },
    {
        id: 'slow_driving',
        name: 'Conducción Lenta Deliberada',
        description: 'Ir intencionalmente lento para obstruir',
        type: 'points',
        severity: 'moderate',
        points: 5,
        warningPoints: 2,
        icon: '🐌'
    }
];

/**
 * Configuración por defecto del sistema de sanciones
 */
export const DEFAULT_PENALTIES_CONFIG = {
    enabled: false,
    warningThreshold: 8,      // Puntos de amonestación para sanción automática
    autoDisqualifyThreshold: 16, // Puntos de amonestación para descalificación
    autoPointsPenalty: 10,     // Puntos deducidos al alcanzar warningThreshold
    allowClaims: false,        // Permitir reclamaciones públicas
    presets: PENALTY_PRESETS.map(p => ({ ...p, active: true }))
};

/**
 * Labels y colores por tipo de sanción
 */
export const PENALTY_TYPE_CONFIG = {
    warning: { label: 'Amonestación', color: 'yellow', icon: '🟡' },
    time: { label: 'Penalización de Tiempo', color: 'orange', icon: '⏱️' },
    position: { label: 'Pérdida de Posiciones', color: 'orange', icon: '📉' },
    points: { label: 'Deducción de Puntos', color: 'red', icon: '➖' },
    disqualification: { label: 'Descalificación', color: 'red', icon: '🔴' },
    custom: { label: 'Personalizada', color: 'purple', icon: '⚙️' }
};

export const SEVERITY_CONFIG = {
    minor: { label: 'Leve', color: 'text-yellow-400', bg: 'bg-yellow-500/20', border: 'border-yellow-500/30' },
    moderate: { label: 'Moderada', color: 'text-orange-400', bg: 'bg-orange-500/20', border: 'border-orange-500/30' },
    severe: { label: 'Grave', color: 'text-red-400', bg: 'bg-red-500/20', border: 'border-red-500/30' },
    critical: { label: 'Crítica', color: 'text-red-500', bg: 'bg-red-600/20', border: 'border-red-600/30' }
};

export const CLAIM_STATUS_CONFIG = {
    pending: { label: 'Pendiente', color: 'text-yellow-400', bg: 'bg-yellow-500/20' },
    reviewing: { label: 'En Revisión', color: 'text-blue-400', bg: 'bg-blue-500/20' },
    accepted: { label: 'Aceptada', color: 'text-green-400', bg: 'bg-green-500/20' },
    rejected: { label: 'Rechazada', color: 'text-red-400', bg: 'bg-red-500/20' },
    resolved: { label: 'Resuelta', color: 'text-gray-400', bg: 'bg-gray-500/20' }
};
