/**
 * Championship Model
 * Modelo de datos para el sistema de múltiples campeonatos
 */
import { STATUS_SEMANTIC_COLORS, STATUS_LABELS } from '../utils/constants';

export class Championship {
    constructor(data = {}) {
        this.id = data.id || null;
        this.name = data.name || '';
        this.shortName = data.shortName || '';
        this.description = data.description || '';
        this.season = data.season || new Date().getFullYear().toString();
        this.status = data.status || 'draft'; // 'draft' | 'active' | 'completed' | 'archived'
        this.startDate = data.startDate || null;
        this.endDate = data.endDate || null;
        this.banner = data.banner || '';
        this.logo = data.logo || '';
        this.categories = data.categories || ['Gr1', 'Gr2', 'Gr3', 'Gr4', 'GrB', 'Street'];
        this.settings = {
            pointsSystem: data.settings?.pointsSystem || this.getDefaultPointsSystem(),
            allowMultipleTeamsPerDriver: data.settings?.allowMultipleTeamsPerDriver ?? false,
            maxTeams: data.settings?.maxTeams || 20,
            maxDriversPerTeam: data.settings?.maxDriversPerTeam || 2,
            isTeamChampionship: data.settings?.isTeamChampionship ?? false
        };
        this.drivers = data.drivers || []; // Array de pilotos para campeonatos individuales
        this.createdAt = data.createdAt || new Date().toISOString();
        this.updatedAt = data.updatedAt || new Date().toISOString();
        this.createdBy = data.createdBy || null;
    }

    /**
     * Sistema de puntos por defecto
     */
    getDefaultPointsSystem() {
        return {
            1: 25,
            2: 18,
            3: 15,
            4: 12,
            5: 10,
            6: 8,
            7: 6,
            8: 4,
            9: 2,
            10: 1
        };
    }

    /**
     * Valida que el campeonato tenga todos los datos requeridos
     */
    validate() {
        const errors = [];

        if (!this.name || this.name.trim() === '') {
            errors.push('El nombre del campeonato es requerido');
        }

        if (!this.shortName || this.shortName.trim() === '') {
            errors.push('El nombre corto del campeonato es requerido');
        }

        if (this.shortName && this.shortName.length > 10) {
            errors.push('El nombre corto no debe exceder 10 caracteres');
        }

        if (!this.season || this.season.trim() === '') {
            errors.push('La temporada es requerida');
        }

        if (!['draft', 'active', 'completed', 'archived'].includes(this.status)) {
            errors.push('Estado inválido');
        }

        if (this.startDate && this.endDate) {
            const start = new Date(this.startDate);
            const end = new Date(this.endDate);
            if (start >= end) {
                errors.push('La fecha de inicio debe ser anterior a la fecha de fin');
            }
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * Convierte el modelo a un objeto plano para Firebase
     */
    toFirestore() {
        return {
            name: this.name,
            shortName: this.shortName,
            description: this.description,
            season: this.season,
            status: this.status,
            startDate: this.startDate,
            endDate: this.endDate,
            banner: this.banner,
            logo: this.logo,
            categories: this.categories,
            settings: this.settings,
            drivers: this.drivers, // Incluir drivers para campeonatos individuales
            createdAt: this.createdAt,
            updatedAt: new Date().toISOString(),
            createdBy: this.createdBy
        };
    }

    /**
     * Crea una instancia desde datos de Firebase
     */
    static fromFirestore(id, data) {
        return new Championship({
            id,
            ...data
        });
    }

    /**
     * Verifica si el campeonato está activo
     */
    isActive() {
        return this.status === 'active';
    }

    /**
     * Verifica si el campeonato está completado
     */
    isCompleted() {
        return this.status === 'completed';
    }

    /**
     * Verifica si el campeonato está archivado
     */
    isArchived() {
        return this.status === 'archived';
    }

    /**
     * Verifica si el campeonato está en borrador
     */
    isDraft() {
        return this.status === 'draft';
    }

    /**
     * Obtiene el color del badge según el estado
     */
    getStatusColor() {
        return STATUS_SEMANTIC_COLORS[this.status] || 'gray';
    }

    /**
     * Obtiene el texto del estado traducido
     */
    getStatusText() {
        return STATUS_LABELS[this.status] || 'Desconocido';
    }
}

/**
 * Team Model (dentro de un Championship)
 */
export class Team {
    constructor(data = {}) {
        this.id = data.id || null;
        this.championshipId = data.championshipId || null;
        this.name = data.name || '';
        this.color = data.color || '#000000';
        this.logo = data.logo || '';
        this.drivers = data.drivers || [];
        this.createdAt = data.createdAt || new Date().toISOString();
        this.updatedAt = data.updatedAt || new Date().toISOString();
    }

    validate() {
        const errors = [];

        if (!this.name || this.name.trim() === '') {
            errors.push('El nombre del equipo es requerido');
        }

        if (!this.championshipId) {
            errors.push('El equipo debe pertenecer a un campeonato');
        }

        if (!this.color || !/^#[0-9A-F]{6}$/i.test(this.color)) {
            errors.push('Color inválido (debe ser formato hexadecimal #RRGGBB)');
        }

        if (!this.drivers || this.drivers.length === 0) {
            errors.push('El equipo debe tener al menos un piloto');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    toFirestore() {
        return {
            championshipId: this.championshipId,
            name: this.name,
            color: this.color,
            logo: this.logo,
            drivers: this.drivers,
            createdAt: this.createdAt,
            updatedAt: new Date().toISOString()
        };
    }

    static fromFirestore(id, data) {
        return new Team({
            id,
            ...data
        });
    }
}

/**
 * Track Model (dentro de un Championship)
 */
export class Track {
    constructor(data = {}) {
        this.id = data.id || null;
        this.championshipId = data.championshipId || null;
        this.name = data.name || '';
        this.country = data.country || '';
        this.date = data.date || null;
        this.round = data.round || null;
        this.category = data.category || '';
        this.layoutImage = data.layoutImage || '';
        this.raceType = data.raceType || 'carrera'; // 'carrera' o 'resistencia'
        this.laps = data.laps || 0; // Para tipo 'carrera'
        this.duration = data.duration || 0; // Para tipo 'resistencia' (en minutos)
        this.rules = data.rules || {}; // Reglas del circuito
        this.specificCars = data.specificCars || false;
        this.allowedCars = data.allowedCars || [];
        this.points = data.points || {}; // Puntajes de pilotos: { "pilotoName": puntos }
        this.status = data.status || 'scheduled'; // 'scheduled' | 'in-progress' | 'completed'
        this.createdAt = data.createdAt || new Date().toISOString();
        this.updatedAt = data.updatedAt || new Date().toISOString();
    }

    validate() {
        const errors = [];

        if (!this.name || this.name.trim() === '') {
            errors.push('El nombre de la pista es requerido');
        }

        if (!this.championshipId) {
            errors.push('La pista debe pertenecer a un campeonato');
        }

        if (!this.date) {
            errors.push('La fecha es requerida');
        }

        if (this.specificCars && (!this.allowedCars || this.allowedCars.length === 0)) {
            errors.push('Si se habilitan carros específicos, debe agregar al menos uno');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    toFirestore() {
        return {
            championshipId: this.championshipId,
            name: this.name,
            country: this.country,
            date: this.date,
            round: this.round,
            category: this.category,
            layoutImage: this.layoutImage,
            raceType: this.raceType,
            laps: this.laps,
            duration: this.duration,
            rules: this.rules,
            specificCars: this.specificCars,
            allowedCars: this.allowedCars,
            points: this.points,
            status: this.status,
            createdAt: this.createdAt,
            updatedAt: new Date().toISOString()
        };
    }

    static fromFirestore(id, data) {
        return new Track({
            id,
            ...data
        });
    }
}

/**
 * Event Model (dentro de un Championship)
 */
export class Event {
    constructor(data = {}) {
        this.id = data.id || null;
        this.championshipId = data.championshipId || null;
        this.title = data.title || '';
        this.description = data.description || '';
        this.banner = data.banner || '';
        this.date = data.date || null;
        this.hour = data.hour || '';
        this.track = data.track || '';
        this.specificCars = data.specificCars || false;
        this.allowedCars = data.allowedCars || [];
        this.rules = data.rules || {};
        this.maxParticipants = data.maxParticipants || 0;
        this.participants = data.participants || [];
        this.status = data.status || 'upcoming'; // 'upcoming' | 'live' | 'completed'
        this.createdAt = data.createdAt || new Date().toISOString();
        this.updatedAt = data.updatedAt || new Date().toISOString();
    }

    validate() {
        const errors = [];

        if (!this.title || this.title.trim() === '') {
            errors.push('El título del evento es requerido');
        }

        if (!this.championshipId) {
            errors.push('El evento debe pertenecer a un campeonato');
        }

        if (!this.date) {
            errors.push('La fecha es requerida');
        }

        if (!this.track || this.track.trim() === '') {
            errors.push('La pista es requerida');
        }

        if (this.specificCars && (!this.allowedCars || this.allowedCars.length === 0)) {
            errors.push('Si se habilitan carros específicos, debe agregar al menos uno');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    toFirestore() {
        return {
            championshipId: this.championshipId,
            title: this.title,
            description: this.description,
            banner: this.banner,
            date: this.date,
            hour: this.hour,
            track: this.track,
            specificCars: this.specificCars,
            allowedCars: this.allowedCars,
            rules: this.rules,
            maxParticipants: this.maxParticipants,
            participants: this.participants,
            status: this.status,
            createdAt: this.createdAt,
            updatedAt: new Date().toISOString()
        };
    }

    static fromFirestore(id, data) {
        return new Event({
            id,
            ...data
        });
    }

    /**
     * Verifica si el evento está completo (participantes = máximo)
     */
    isFull() {
        return this.maxParticipants > 0 && this.participants.length >= this.maxParticipants;
    }

    /**
     * Obtiene el número de cupos disponibles
     */
    getAvailableSlots() {
        if (this.maxParticipants === 0) return Infinity;
        return Math.max(0, this.maxParticipants - this.participants.length);
    }
}
