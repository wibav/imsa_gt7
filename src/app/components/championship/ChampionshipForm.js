"use client";

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { useChampionship } from '../../context/ChampionshipContext';
import { Championship } from '../../models/Championship';
import { FirebaseService } from '../../services/firebaseService';
import { GT7_TRACKS, TYRE_OPTIONS, DAMAGE_OPTIONS, STREAMING_PLATFORMS, WEATHER_CONDITION_OPTIONS, WEATHER_TRANSITION_OPTIONS, START_TIME_OPTIONS, TIME_MULTIPLIER_OPTIONS, DEFAULT_SPRINT_POINTS, DEFAULT_DIVISIONS_CONFIG } from '../../utils/constants';
import { DEFAULT_PENALTIES_CONFIG } from '../../models/Penalty';
import LoadingSkeleton from '../common/LoadingSkeleton';
import ErrorMessage from '../common/ErrorMessage';

// ============================================================
// Constantes locales del formulario
// ============================================================

const YES_NO = [
    { value: 'yes', label: 'Sí' },
    { value: 'no', label: 'No' }
];

const WEATHER_OPTIONS = [
    { value: 'clear', label: 'Despejado' },
    { value: 'rain', label: 'Lluvia' },
    { value: 'variable', label: 'Variable' }
];

const TIME_OPTIONS = [
    { value: 'day', label: 'Día' },
    { value: 'night', label: 'Noche' },
    { value: 'dynamic', label: 'Dinámico' }
];

const ASSIST_OPTIONS = [
    { value: 'default', label: 'Predeterminado' },
    { value: 'off', label: 'Desactivado' },
    { value: 'on', label: 'Activado' }
];

const ABS_OPTIONS = [
    { value: 'default', label: 'Predeterminado' },
    { value: 'off', label: 'Desactivado' },
    { value: 'weak', label: 'Débil' }
];

const CATEGORIES = ['Gr1', 'Gr2', 'Gr3', 'Gr4', 'GrB', 'Street'];

const PENALTY_SHORTCUT_OPTIONS = [
    { value: 'off', label: 'Desactivado' },
    { value: 'weak', label: 'Leve' },
    { value: 'moderate', label: 'Moderado' },
    { value: 'strong', label: 'Fuerte' }
];

const ON_OFF_OPTIONS = [
    { value: 'on', label: 'Activado' },
    { value: 'off', label: 'Desactivado' }
];

// ============================================================
// Default data factories
// ============================================================

function getEmptyFormData() {
    return {
        name: '',
        shortName: '',
        description: '',
        season: new Date().getFullYear().toString(),
        status: 'draft',
        startDate: '',
        endDate: '',
        banner: '',
        categories: [],
        settings: {
            pointsSystem: {
                race: {
                    1: 25, 2: 22, 3: 20, 4: 18, 5: 16, 6: 14, 7: 12, 8: 10,
                    9: 9, 10: 8, 11: 7, 12: 6, 13: 5, 14: 4, 15: 3, 16: 2
                },
                fastestLap: { enabled: false, points: 1 },
                qualifying: { enabled: false, positions: { 1: 5, 2: 3, 3: 1 } }
            },
            isTeamChampionship: false,
            maxTeams: 0,
            maxDriversPerTeam: 0
        },
        teams: [],
        drivers: [],
        tracks: [],
        registration: {
            enabled: false,
            requiresApproval: true,
            deadline: '',
            maxParticipants: 0,
            fields: ['name', 'psnId'],
            acceptRules: false
        },
        streaming: {
            casterName: '',
            hostName: '',
            url: '',
            platform: ''
        },
        penaltiesConfig: { ...DEFAULT_PENALTIES_CONFIG },
        regulations: '',
        carUsageTracking: {
            enabled: false,
            maxUsesPerCar: 2,
            alertThreshold: 1
        },
        preQualy: {
            enabled: false,
            date: '',
            track: '',
            duration: 15,
            allowedCars: [],
            notes: '',
            rules: {
                weather: 'clear',
                timeOfDay: 'day',
                timeMultiplier: 1,
                startTime: '',
                tireWear: 0,
                fuelConsumption: 0,
                mandatoryTyre: [],
                mechanicalDamage: 'No',
                bop: 'yes',
                qualySlipstream: false,
                penaltyShortcut: 'strong',
                penaltyWall: 'off',
                penaltyPitLine: 'on',
                penaltyCarCollision: 'on',
                notes: ''
            }
        },
        divisionsConfig: { ...DEFAULT_DIVISIONS_CONFIG }
    };
}

function getEmptyTrackData(formData) {
    return {
        name: '',
        layoutImage: '',
        date: '',
        round: (formData?.tracks?.length || 0) + 1,
        category: formData?.categories?.[0] || '',
        raceType: 'carrera',
        laps: 10,
        duration: 60,
        sprintLaps: 5,
        rules: {
            weather: 'clear',
            timeOfDay: 'day',
            weatherSlots: [],
            timeMultiplier: 1,
            startTime: '',
            tireWear: 5,
            fuelConsumption: 1,
            fuelRefillRate: 10,
            mandatoryTyre: [],
            mandatoryPitStops: 0,
            mandatoryCompoundChanges: false,
            mechanicalDamage: 'No',
            bop: 'yes',
            adjustments: 'no',
            engineSwap: 'no',
            penalties: 'yes',
            penaltyShortcut: 'moderate',
            penaltyWall: 'on',
            penaltyPitLine: 'on',
            penaltyCarCollision: 'on',
            abs: 'default',
            tcs: 'no',
            asm: 'no',
            counterSteering: 'no',
            // Slipstream
            qualySlipstream: false,
            raceSlipstream: true,
            // Qualy settings
            qualyTireWear: false,
            // Starting fuel
            startingFuel: 100,
            notes: ''
        },
        specificCars: false,
        allowedCars: []
    };
}

// ============================================================
// Componente principal
// ============================================================

/**
 * Formulario unificado para crear y editar campeonatos.
 * @param {{ isEditing: boolean }} props
 */
export default function ChampionshipForm({ isEditing = false }) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const championshipId = isEditing ? searchParams.get('id') : null;

    const { currentUser, loading: authLoading } = useAuth();
    const {
        championships,
        createChampionship,
        updateChampionship,
        refreshChampionships
    } = useChampionship();

    // Estado general
    const [championship, setChampionship] = useState(null);
    const [currentStep, setCurrentStep] = useState(1);
    const [trackModalTab, setTrackModalTab] = useState('info');
    const [formData, setFormData] = useState(isEditing ? null : getEmptyFormData());
    const [formErrors, setFormErrors] = useState([]);
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(isEditing);
    const [bannerFile, setBannerFile] = useState(null);
    const [bannerPreview, setBannerPreview] = useState(null);

    // Estado de circuitos
    const [loadingTracks, setLoadingTracks] = useState(isEditing);
    const [firebaseTracks, setFirebaseTracks] = useState([]);
    const [showTrackModal, setShowTrackModal] = useState(false);
    const [editingTrackIndex, setEditingTrackIndex] = useState(null);
    const [trackFormData, setTrackFormData] = useState(null);
    const [showImportModal, setShowImportModal] = useState(false);

    // ============================================================
    // Effects
    // ============================================================

    // Cargar circuitos de Firebase (para el selector)
    useEffect(() => {
        const loadFirebaseTracks = async () => {
            try {
                const tracksData = await FirebaseService.getTracks();
                setFirebaseTracks(tracksData);
            } catch (error) {
                console.error('Error loading Firebase tracks:', error);
            }
        };
        loadFirebaseTracks();
    }, []);

    // [EDIT] Cargar circuitos del campeonato
    useEffect(() => {
        if (!isEditing || !championshipId || !championship) return;

        const loadChampionshipTracks = async () => {
            try {
                setLoadingTracks(true);
                const tracksData = await FirebaseService.getTracksByChampionship(championshipId);
                setFormData(prev => prev ? { ...prev, tracks: tracksData } : null);
            } catch (error) {
                console.error('Error loading championship tracks:', error);
            } finally {
                setLoadingTracks(false);
            }
        };
        loadChampionshipTracks();
    }, [isEditing, championshipId, championship]);

    // [EDIT] Cargar datos del campeonato / [NEW] Redirigir si no autenticado
    useEffect(() => {
        if (!authLoading && !currentUser) {
            router.push('/login');
            return;
        }

        if (!isEditing) return; // En modo new, solo aplica el redirect

        if (championships.length > 0 && championshipId) {
            const champ = championships.find(c => c.id === championshipId);
            if (champ) {
                setChampionship(champ);
                loadChampionshipFormData(champ);
            } else {
                router.push('/championshipsAdmin');
            }
        }
    }, [isEditing, championships, championshipId, currentUser, authLoading, router]);

    async function loadChampionshipFormData(champ) {
        // Cargar teams desde subcolección
        let teamsData = [];
        try {
            teamsData = await FirebaseService.getTeamsByChampionship(championshipId);
        } catch (error) {
            console.error('Error cargando teams:', error);
        }

        const hasTeams = teamsData.length > 0;
        const isTeamChamp = hasTeams || champ.settings?.isTeamChampionship || false;

        setFormData({
            name: champ.name,
            shortName: champ.shortName,
            description: champ.description || '',
            season: champ.season,
            status: champ.status,
            startDate: champ.startDate?.split('T')[0] || '',
            endDate: champ.endDate?.split('T')[0] || '',
            banner: champ.banner || '',
            categories: champ.categories || [],
            settings: {
                pointsSystem: champ.settings?.pointsSystem?.race
                    ? champ.settings.pointsSystem
                    : {
                        race: champ.settings?.pointsSystem || {
                            1: 25, 2: 22, 3: 20, 4: 18, 5: 16, 6: 14, 7: 12, 8: 10,
                            9: 9, 10: 8, 11: 7, 12: 6, 13: 5, 14: 4, 15: 3, 16: 2
                        },
                        fastestLap: { enabled: false, points: 1 },
                        qualifying: { enabled: false, positions: { 1: 5, 2: 3, 3: 1 } }
                    },
                isTeamChampionship: isTeamChamp,
                maxTeams: champ.settings?.maxTeams || (hasTeams ? 4 : 0),
                maxDriversPerTeam: champ.settings?.maxDriversPerTeam || (hasTeams ? 4 : 0)
            },
            teams: teamsData.length > 0 ? teamsData : (champ.teams || []),
            drivers: champ.drivers || [],
            tracks: [], // Se carga en useEffect separado
            registration: {
                enabled: champ.registration?.enabled || false,
                requiresApproval: champ.registration?.requiresApproval ?? true,
                deadline: champ.registration?.deadline || '',
                maxParticipants: champ.registration?.maxParticipants || 0,
                fields: champ.registration?.fields || ['gt7Id', 'psnId'],
                acceptRules: champ.registration?.acceptRules || false
            },
            streaming: {
                casterName: champ.streaming?.casterName || '',
                hostName: champ.streaming?.hostName || '',
                url: champ.streaming?.url || '',
                platform: champ.streaming?.platform || ''
            },
            penaltiesConfig: {
                enabled: champ.penaltiesConfig?.enabled || false,
                warningThreshold: champ.penaltiesConfig?.warningThreshold ?? 8,
                autoDisqualifyThreshold: champ.penaltiesConfig?.autoDisqualifyThreshold ?? 16,
                autoPointsPenalty: champ.penaltiesConfig?.autoPointsPenalty ?? 10,
                allowClaims: champ.penaltiesConfig?.allowClaims || false,
                presets: champ.penaltiesConfig?.presets || DEFAULT_PENALTIES_CONFIG.presets
            },
            regulations: champ.regulations || '',
            carUsageTracking: {
                enabled: champ.carUsageTracking?.enabled || false,
                maxUsesPerCar: champ.carUsageTracking?.maxUsesPerCar ?? 2,
                alertThreshold: champ.carUsageTracking?.alertThreshold ?? 1
            },
            preQualy: {
                enabled: champ.preQualy?.enabled || false,
                date: champ.preQualy?.date || '',
                track: champ.preQualy?.track || '',
                duration: champ.preQualy?.duration || 15,
                allowedCars: champ.preQualy?.allowedCars || [],
                notes: champ.preQualy?.notes || '',
                rules: {
                    weather: champ.preQualy?.rules?.weather || 'clear',
                    timeOfDay: champ.preQualy?.rules?.timeOfDay || 'day',
                    timeMultiplier: champ.preQualy?.rules?.timeMultiplier ?? 1,
                    startTime: champ.preQualy?.rules?.startTime || '',
                    tireWear: champ.preQualy?.rules?.tireWear ?? 0,
                    fuelConsumption: champ.preQualy?.rules?.fuelConsumption ?? 0,
                    mandatoryTyre: champ.preQualy?.rules?.mandatoryTyre || [],
                    mechanicalDamage: champ.preQualy?.rules?.mechanicalDamage || 'No',
                    bop: champ.preQualy?.rules?.bop || 'yes',
                    qualySlipstream: champ.preQualy?.rules?.qualySlipstream ?? false,
                    penaltyShortcut: champ.preQualy?.rules?.penaltyShortcut || 'strong',
                    penaltyWall: champ.preQualy?.rules?.penaltyWall || 'off',
                    penaltyPitLine: champ.preQualy?.rules?.penaltyPitLine || 'on',
                    penaltyCarCollision: champ.preQualy?.rules?.penaltyCarCollision || 'on',
                    notes: champ.preQualy?.rules?.notes || ''
                }
            },
            divisionsConfig: {
                enabled: champ.divisionsConfig?.enabled || false,
                promotionCount: champ.divisionsConfig?.promotionCount ?? 5,
                relegationCount: champ.divisionsConfig?.relegationCount ?? 5,
                maxDriversPerDivision: champ.divisionsConfig?.maxDriversPerDivision ?? 15
            }
        });

        setBannerPreview(champ.banner);
        setLoading(false);
    }

    // ============================================================
    // Loading guards
    // ============================================================

    if (authLoading || loading) {
        return <LoadingSkeleton variant="page" message="Cargando..." />;
    }

    if (!currentUser || (isEditing && !formData)) {
        return null;
    }

    // ============================================================
    // Handlers: Formulario general
    // ============================================================

    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleToggleTeamMode = () => {
        setFormData(prev => ({
            ...prev,
            settings: {
                ...prev.settings,
                isTeamChampionship: !prev.settings.isTeamChampionship,
                maxTeams: !prev.settings.isTeamChampionship ? 0 : prev.settings.maxTeams,
                maxDriversPerTeam: !prev.settings.isTeamChampionship ? 0 : prev.settings.maxDriversPerTeam
            }
        }));
    };

    const handleCategoryToggle = (category) => {
        setFormData(prev => ({
            ...prev,
            categories: prev.categories.includes(category)
                ? prev.categories.filter(c => c !== category)
                : [...prev.categories, category]
        }));
    };

    const handleBannerChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setBannerFile(file);
            const reader = new FileReader();
            reader.onloadend = () => setBannerPreview(reader.result);
            reader.readAsDataURL(file);
        }
    };

    // ============================================================
    // Handlers: Sistema de puntos
    // ============================================================

    const handlePointSystemChange = (position, value) => {
        setFormData(prev => ({
            ...prev,
            settings: {
                ...prev.settings,
                pointsSystem: {
                    ...prev.settings.pointsSystem,
                    race: { ...prev.settings.pointsSystem.race, [position]: parseInt(value) || 0 }
                }
            }
        }));
    };

    const handleQualyPointChange = (position, value) => {
        setFormData(prev => ({
            ...prev,
            settings: {
                ...prev.settings,
                pointsSystem: {
                    ...prev.settings.pointsSystem,
                    qualifying: {
                        ...prev.settings.pointsSystem.qualifying,
                        positions: { ...prev.settings.pointsSystem.qualifying.positions, [position]: parseInt(value) || 0 }
                    }
                }
            }
        }));
    };

    const handleToggleFastestLap = () => {
        setFormData(prev => ({
            ...prev,
            settings: {
                ...prev.settings,
                pointsSystem: {
                    ...prev.settings.pointsSystem,
                    fastestLap: { ...prev.settings.pointsSystem.fastestLap, enabled: !prev.settings.pointsSystem.fastestLap.enabled }
                }
            }
        }));
    };

    const handleToggleQualifying = () => {
        setFormData(prev => ({
            ...prev,
            settings: {
                ...prev.settings,
                pointsSystem: {
                    ...prev.settings.pointsSystem,
                    qualifying: { ...prev.settings.pointsSystem.qualifying, enabled: !prev.settings.pointsSystem.qualifying.enabled }
                }
            }
        }));
    };

    const handleFastestLapPointsChange = (value) => {
        setFormData(prev => ({
            ...prev,
            settings: {
                ...prev.settings,
                pointsSystem: {
                    ...prev.settings.pointsSystem,
                    fastestLap: { ...prev.settings.pointsSystem.fastestLap, points: parseInt(value) || 0 }
                }
            }
        }));
    };

    // ============================================================
    // Handlers: Circuitos (track modal)
    // ============================================================

    const handleOpenTrackModal = (index = null) => {
        if (index !== null) {
            setEditingTrackIndex(index);
            setTrackFormData({ ...formData.tracks[index] });
        } else {
            setEditingTrackIndex(null);
            setTrackFormData(getEmptyTrackData(formData));
        }
        setShowTrackModal(true);
    };

    const handleCloseTrackModal = () => {
        setShowTrackModal(false);
        setEditingTrackIndex(null);
        setTrackFormData(null);
        setTrackModalTab('info');
    };

    const handleSelectTrack = (trackName) => {
        const selectedTrack = firebaseTracks.find(t => t.name === trackName);
        setTrackFormData(prev => ({
            ...prev,
            name: trackName,
            layoutImage: selectedTrack?.layoutImage || ''
        }));
    };

    const handleTrackRuleChange = (field, value) => {
        setTrackFormData(prev => ({
            ...prev,
            rules: { ...prev.rules, [field]: value }
        }));
    };

    const handleSaveTrack = () => {
        if (!trackFormData.name) {
            alert('Debe seleccionar un circuito');
            return;
        }
        if (!trackFormData.date) {
            alert('Debe seleccionar una fecha');
            return;
        }

        if (editingTrackIndex !== null) {
            const updatedTracks = [...formData.tracks];
            updatedTracks[editingTrackIndex] = trackFormData;
            setFormData(prev => ({ ...prev, tracks: updatedTracks }));
        } else {
            setFormData(prev => ({ ...prev, tracks: [...prev.tracks, trackFormData] }));
        }
        handleCloseTrackModal();
    };

    const handleDeleteTrack = (index) => {
        if (confirm('¿Estás seguro de eliminar este circuito?')) {
            setFormData(prev => ({
                ...prev,
                tracks: prev.tracks.filter((_, i) => i !== index)
            }));
        }
    };

    const handleAddAllowedCar = (car) => {
        const carName = typeof car === 'string' ? car : prompt('Ingrese el nombre del carro:');
        if (carName && carName.trim() && !(trackFormData.allowedCars || []).includes(carName.trim())) {
            setTrackFormData(prev => ({
                ...prev,
                allowedCars: [...(prev.allowedCars || []), carName.trim()]
            }));
        }
    };

    const handleRemoveAllowedCar = (carOrIndex) => {
        setTrackFormData(prev => ({
            ...prev,
            allowedCars: prev.allowedCars.filter((car, i) =>
                typeof carOrIndex === 'number' ? i !== carOrIndex : car !== carOrIndex
            )
        }));
    };

    // ============================================================
    // Handlers: Pilotos y equipos
    // ============================================================

    const handleAddDriver = (name, category = '') => {
        if (name && name.trim()) {
            setFormData(prev => ({
                ...prev,
                drivers: [...(prev.drivers || []), { name: name.trim(), category }]
            }));
        }
    };

    const handleRemoveDriver = (index) => {
        setFormData(prev => ({
            ...prev,
            drivers: prev.drivers.filter((_, i) => i !== index)
        }));
    };

    const handleChangeDriverCategory = (index, newCategory) => {
        setFormData(prev => ({
            ...prev,
            drivers: prev.drivers.map((d, i) => i === index ? { ...d, category: newCategory } : d)
        }));
    };

    const handleAddTeam = (name) => {
        if (name && name.trim()) {
            setFormData(prev => ({
                ...prev,
                teams: [...(prev.teams || []), { name: name.trim(), drivers: [] }]
            }));
        }
    };

    const handleRemoveTeam = (index) => {
        setFormData(prev => ({
            ...prev,
            teams: prev.teams.filter((_, i) => i !== index)
        }));
    };

    const handleAddDriverToTeam = (teamIndex, driverName, category = '') => {
        if (driverName && driverName.trim()) {
            setFormData(prev => ({
                ...prev,
                teams: prev.teams.map((team, i) => {
                    if (i === teamIndex) {
                        return {
                            ...team,
                            drivers: [...team.drivers, { name: driverName.trim(), category }]
                        };
                    }
                    return team;
                })
            }));
        }
    };

    const handleChangeDriverCategoryInTeam = (teamIndex, driverIndex, newCategory) => {
        setFormData(prev => ({
            ...prev,
            teams: prev.teams.map((team, i) => {
                if (i === teamIndex) {
                    return {
                        ...team,
                        drivers: team.drivers.map((d, di) => di === driverIndex ? { ...d, category: newCategory } : d)
                    };
                }
                return team;
            })
        }));
    };

    const handleRemoveDriverFromTeam = (teamIndex, driverIndex) => {
        setFormData(prev => ({
            ...prev,
            teams: prev.teams.map((team, i) => {
                if (i === teamIndex) {
                    return { ...team, drivers: team.drivers.filter((_, di) => di !== driverIndex) };
                }
                return team;
            })
        }));
    };

    // ============================================================
    // Validación y navegación
    // ============================================================

    const validateStep = (step) => {
        const errors = [];
        switch (step) {
            case 1:
                if (!formData.name.trim()) errors.push('El nombre es requerido');
                if (!formData.shortName.trim()) errors.push('El nombre corto es requerido');
                if (formData.shortName.length > 10) errors.push('El nombre corto debe tener máximo 10 caracteres');
                if (!formData.season.trim()) errors.push('La temporada es requerida');
                break;
            case 2:
                if (formData.categories.length === 0) errors.push('Debe seleccionar al menos una categoría');
                break;
            case 3:
                const racePositions = Object.values(formData.settings.pointsSystem.race || {});
                if (racePositions.some(p => p < 0)) errors.push('Los puntos no pueden ser negativos');
                break;
        }
        setFormErrors(errors);
        return errors.length === 0;
    };

    const handleNext = () => {
        if (validateStep(currentStep)) {
            setCurrentStep(prev => prev + 1);
            setFormErrors([]);
        }
    };

    const handleBack = () => {
        setCurrentStep(prev => prev - 1);
        setFormErrors([]);
    };

    // ============================================================
    // Clonar campeonato anterior
    // ============================================================

    const handleCloneFrom = async (sourceId) => {
        if (!sourceId) return;
        const source = championships.find(c => c.id === sourceId);
        if (!source) return;

        try {
            // Cargar equipos y pilotos del campeonato fuente
            let teamsData = [];
            if (source.settings?.isTeamChampionship) {
                teamsData = await FirebaseService.getTeamsByChampionship(sourceId);
            }

            // Copiar configuración (sin resultados, sin tracks con puntos)
            setFormData(prev => ({
                ...prev,
                categories: source.categories || prev.categories,
                settings: {
                    ...prev.settings,
                    pointsSystem: source.settings?.pointsSystem || prev.settings.pointsSystem,
                    isTeamChampionship: source.settings?.isTeamChampionship || false,
                    maxTeams: source.settings?.maxTeams || 0,
                    maxDriversPerTeam: source.settings?.maxDriversPerTeam || 0
                },
                teams: teamsData.map(t => ({
                    ...t,
                    id: undefined, // Se crearán nuevos IDs
                    drivers: (t.drivers || []).map(d => ({ ...d, points: 0, results: [] }))
                })),
                drivers: (source.drivers || []).map(d => ({ ...d, points: 0, results: [] })),
                registration: {
                    enabled: source.registration?.enabled || false,
                    requiresApproval: source.registration?.requiresApproval ?? true,
                    deadline: '',
                    maxParticipants: source.registration?.maxParticipants || 0,
                    fields: source.registration?.fields || ['gt7Id', 'psnId'],
                    acceptRules: source.registration?.acceptRules || false
                },
                streaming: {
                    casterName: source.streaming?.casterName || '',
                    hostName: source.streaming?.hostName || '',
                    url: '',
                    platform: source.streaming?.platform || ''
                },
                clonedFrom: sourceId
            }));
        } catch (error) {
            console.error('Error cloning championship:', error);
        }
    };

    // ============================================================
    // Importar pilotos/equipos de otro campeonato
    // ============================================================

    const handleImportDrivers = async (sourceId) => {
        if (!sourceId) return;
        const source = championships.find(c => c.id === sourceId);
        if (!source) return;

        try {
            if (formData.settings.isTeamChampionship) {
                const teamsData = await FirebaseService.getTeamsByChampionship(sourceId);
                const cleanTeams = teamsData.map(t => ({
                    ...t,
                    id: undefined,
                    drivers: (t.drivers || []).map(d => ({ ...d, points: 0, results: [] }))
                }));
                // Merge: agregar equipos que no existan por nombre
                setFormData(prev => {
                    const existingNames = new Set(prev.teams.map(t => t.name?.toLowerCase()));
                    const newTeams = cleanTeams.filter(t => !existingNames.has(t.name?.toLowerCase()));
                    return { ...prev, teams: [...prev.teams, ...newTeams] };
                });
            } else {
                const sourceDrivers = (source.drivers || []).map(d => ({
                    ...d, points: 0, results: []
                }));
                // Merge: agregar pilotos que no existan por PSN ID
                setFormData(prev => {
                    const existingPsns = new Set(prev.drivers.map(d => d.psnId?.toLowerCase()));
                    const newDrivers = sourceDrivers.filter(d => !existingPsns.has(d.psnId?.toLowerCase()));
                    return { ...prev, drivers: [...prev.drivers, ...newDrivers] };
                });
            }
            setShowImportModal(false);
        } catch (error) {
            console.error('Error importing drivers:', error);
        }
    };

    // ============================================================
    // Submit
    // ============================================================

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (currentStep !== 6) return;
        if (!validateStep(currentStep)) return;
        if (saving) return;

        setSaving(true);
        setFormErrors([]);

        try {
            // Banner
            let bannerUrl = isEditing ? formData.banner : '';
            if (bannerFile) {
                const fileName = `${Date.now()}_${bannerFile.name}`;
                const path = isEditing
                    ? `championships/${championshipId}/banners/${fileName}`
                    : `championships/banners/${fileName}`;
                bannerUrl = await FirebaseService.uploadImage(bannerFile, path);
            }

            const championshipData = {
                ...formData,
                banner: bannerUrl,
                startDate: formData.startDate ? new Date(formData.startDate).toISOString() : null,
                endDate: formData.endDate ? new Date(formData.endDate).toISOString() : null,
            };

            const { tracks: tracksData, teams: teamsData, ...championshipDataCore } = championshipData;
            // drivers permanecen en championshipDataCore para que se guarden correctamente

            const champModel = new Championship(championshipDataCore);
            const validation = champModel.validate();
            if (!validation.isValid) {
                setFormErrors(validation.errors);
                setSaving(false);
                return;
            }

            if (isEditing) {
                await submitEdit(championshipDataCore, teamsData, tracksData, championshipData);
            } else {
                await submitCreate(championshipDataCore, teamsData, tracksData, championshipData);
            }

            await refreshChampionships();
            router.push('/championshipsAdmin');
        } catch (error) {
            setFormErrors([error.message || (isEditing ? 'Error al actualizar el campeonato' : 'Error al crear el campeonato')]);
        } finally {
            setSaving(false);
        }
    };

    async function submitCreate(championshipDataCore, teamsData, tracksData, fullData) {
        // championshipDataCore ya incluye drivers[], se guardan en el documento principal
        const result = await createChampionship(championshipDataCore);
        const newId = result.id;

        // Guardar equipos en subcolección
        if (fullData.settings.isTeamChampionship && teamsData?.length > 0) {
            for (const team of teamsData) {
                await FirebaseService.createTeam(newId, team);
            }
        }

        // Guardar circuitos en subcolección
        if (tracksData?.length > 0) {
            for (const track of tracksData) {
                await FirebaseService.createTrack(newId, {
                    ...track,
                    date: new Date(track.date).toISOString(),
                    status: 'upcoming',
                    championshipId: newId
                });
            }
        }
    }

    async function submitEdit(championshipDataCore, teamsData, tracksData, fullData) {
        // Actualizar campeonato (championshipDataCore ya incluye drivers[])
        await updateChampionship(championshipId, championshipDataCore);

        // Manejar equipos si es campeonato por equipos
        if (fullData.settings.isTeamChampionship) {
            const existingTeams = await FirebaseService.getTeamsByChampionship(championshipId);
            for (const team of existingTeams) {
                if (team?.id) {
                    try { await FirebaseService.deleteTeam(championshipId, team.id); }
                    catch (error) { console.error('Error deleting team:', team.id, error); }
                }
            }
            if (teamsData?.length > 0) {
                for (const team of teamsData) {
                    const { id, ...cleanTeamData } = team;
                    await FirebaseService.createTeam(championshipId, cleanTeamData);
                }
            }
        }

        // Eliminar circuitos existentes y recrear
        const existingTracks = await FirebaseService.getTracksByChampionship(championshipId);
        const uniqueTrackIds = new Set();
        for (const track of existingTracks) {
            if (track?.id && typeof track.id === 'string' && !uniqueTrackIds.has(track.id)) {
                uniqueTrackIds.add(track.id);
                try { await FirebaseService.deleteTrack(championshipId, track.id); }
                catch (error) { console.error('Error deleting track:', track.id, error); }
            }
        }

        if (tracksData?.length > 0) {
            for (const trackData of tracksData) {
                const { id, ...cleanTrackData } = trackData;
                await FirebaseService.createTrack(championshipId, cleanTrackData);
            }
        }
    }

    // ============================================================
    // Steps config
    // ============================================================

    const steps = [
        { number: 1, title: 'Info Básica', icon: '📋' },
        { number: 2, title: 'Categorías', icon: '🏎️' },
        { number: 3, title: 'Puntos', icon: '🏆' },
        { number: 4, title: 'Participantes', icon: '👥' },
        { number: 5, title: 'Opciones', icon: '⚙️' },
        { number: 6, title: 'Finalizar', icon: '✅' }
    ];

    // ============================================================
    // Render helpers
    // ============================================================

    const renderToggle = (checked, onChange, size = 'md') => {
        const sizes = {
            sm: { track: 'h-6 w-11', thumb: 'h-4 w-4', translate: 'translate-x-5' },
            md: { track: 'h-8 w-14', thumb: 'h-6 w-6', translate: 'translate-x-7' },
            lg: { track: 'h-10 w-20', thumb: 'h-8 w-8', translate: 'translate-x-11' }
        };
        const s = sizes[size];
        return (
            <button type="button" onClick={onChange}
                className={`relative inline-flex ${s.track} items-center rounded-full transition-colors ${checked ? 'bg-orange-600' : 'bg-gray-600'}`}>
                <span className={`inline-block ${s.thumb} transform rounded-full bg-white transition-transform ${checked ? s.translate : 'translate-x-1'}`} />
            </button>
        );
    };

    const renderSelect = (value, onChange, options, className = '') => (
        <select value={value} onChange={onChange}
            className={`w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500 ${className}`}>
            {options.map(opt => (
                <option key={typeof opt === 'string' ? opt : opt.value}
                    value={typeof opt === 'string' ? opt : opt.value}
                    className="bg-slate-800">
                    {typeof opt === 'string' ? opt : opt.label}
                </option>
            ))}
        </select>
    );

    // ============================================================
    // Render
    // ============================================================

    return (
        <div className="p-4 md:p-8">
            <div className="max-w-5xl mx-auto">
                {/* Header */}
                <div className="bg-white/10 backdrop-blur-sm border border-white/30 rounded-lg p-6 mb-6">
                    <div className="flex justify-between items-center">
                        <div>
                            <h1 className="text-3xl font-bold text-white mb-2">
                                {isEditing ? '✏️ Editar Campeonato' : '🏆 Nuevo Campeonato'}
                            </h1>
                            <p className="text-gray-300">
                                {isEditing
                                    ? championship?.name
                                    : 'Completa la información para crear un nuevo campeonato'}
                            </p>
                        </div>
                        <button onClick={() => router.push('/championshipsAdmin')}
                            className="px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/30 text-white rounded-lg transition-all">
                            ← Cancelar
                        </button>
                    </div>
                </div>

                {/* Stepper */}
                <div className="bg-white/10 backdrop-blur-sm border border-white/30 rounded-lg p-6 mb-6">
                    <div className="flex items-center justify-between">
                        {steps.map((step, index) => (
                            <div key={step.number} className="flex items-center flex-1">
                                <div className="flex flex-col items-center flex-1">
                                    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold transition-all ${currentStep === step.number
                                        ? 'bg-gradient-to-r from-orange-600 to-red-600 text-white scale-110'
                                        : currentStep > step.number
                                            ? 'bg-green-600 text-white'
                                            : 'bg-white/10 text-gray-400'
                                        }`}>
                                        {currentStep > step.number ? '✓' : step.icon}
                                    </div>
                                    <div className="text-center mt-2">
                                        <div className={`text-sm font-medium ${currentStep >= step.number ? 'text-white' : 'text-gray-400'}`}>
                                            {step.title}
                                        </div>
                                    </div>
                                </div>
                                {index < steps.length - 1 && (
                                    <div className={`h-1 flex-1 mx-2 transition-all ${currentStep > step.number ? 'bg-green-600' : 'bg-white/20'}`} />
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Errores */}
                {formErrors.length > 0 && (
                    <ErrorMessage errors={formErrors} title="Errores de validación" className="mb-6" />
                )}

                {/* Formulario */}
                <form onSubmit={handleSubmit}>
                    <div className="bg-white/10 backdrop-blur-sm border border-white/30 rounded-lg p-6 mb-6">

                        {/* ============================== */}
                        {/* Step 1: Información Básica     */}
                        {/* ============================== */}
                        {currentStep === 1 && (
                            <div className="space-y-6">
                                <h2 className="text-2xl font-bold text-white mb-4">📋 Información Básica</h2>

                                {/* Basar en campeonato anterior */}
                                {!isEditing && championships.length > 0 && (
                                    <div className="bg-gradient-to-r from-purple-600/20 to-blue-600/20 border border-purple-400/30 rounded-lg p-4">
                                        <div className="flex items-center gap-3 mb-2">
                                            <span className="text-2xl">📋</span>
                                            <div>
                                                <h3 className="text-white font-medium">Basar en campeonato anterior</h3>
                                                <p className="text-gray-400 text-xs">Copia la configuración, categorías, equipos y pilotos de un campeonato existente</p>
                                            </div>
                                        </div>
                                        <select
                                            onChange={(e) => handleCloneFrom(e.target.value)}
                                            className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                                            defaultValue=""
                                        >
                                            <option value="" className="bg-slate-800">Seleccionar campeonato...</option>
                                            {championships.map(c => (
                                                <option key={c.id} value={c.id} className="bg-slate-800">
                                                    {c.name} ({c.season})
                                                </option>
                                            ))}
                                        </select>
                                        {formData.clonedFrom && (
                                            <p className="text-purple-300 text-xs mt-2">✅ Configuración importada de: {championships.find(c => c.id === formData.clonedFrom)?.name}</p>
                                        )}
                                    </div>
                                )}

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">Nombre del Campeonato *</label>
                                        <input type="text" name="name" value={formData.name} onChange={handleInputChange} required
                                            className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
                                            placeholder="GT7 2026 Championship" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">Nombre Corto * (máx. 10 caracteres)</label>
                                        <input type="text" name="shortName" value={formData.shortName} onChange={handleInputChange} required maxLength={10}
                                            className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
                                            placeholder="GT7 2026" />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">Descripción</label>
                                    <textarea name="description" value={formData.description} onChange={handleInputChange} rows={4}
                                        className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
                                        placeholder="Descripción del campeonato..." />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">Temporada *</label>
                                        <input type="text" name="season" value={formData.season} onChange={handleInputChange} required
                                            className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
                                            placeholder="2025" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">Estado *</label>
                                        <select name="status" value={formData.status} onChange={handleInputChange} required
                                            className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500">
                                            <option value="draft" className="bg-slate-800">📝 Borrador</option>
                                            <option value="active" className="bg-slate-800">🏁 Activo</option>
                                            <option value="completed" className="bg-slate-800">🏆 Completado</option>
                                            <option value="archived" className="bg-slate-800">📦 Archivado</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">Fecha de Inicio</label>
                                        <input type="date" name="startDate" value={formData.startDate} onChange={handleInputChange}
                                            className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">Fecha de Fin</label>
                                        <input type="date" name="endDate" value={formData.endDate} onChange={handleInputChange}
                                            className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500" />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">Banner del Campeonato</label>
                                    <input type="file" accept="image/*" onChange={handleBannerChange}
                                        className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-orange-600 file:text-white hover:file:bg-orange-700" />
                                    {bannerPreview && (
                                        <div className="mt-4">
                                            <img src={bannerPreview} alt="Preview" className="w-full h-48 object-cover rounded-lg border border-white/30" />
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* ============================== */}
                        {/* Step 2: Categorías             */}
                        {/* ============================== */}
                        {currentStep === 2 && (
                            <div className="space-y-6">
                                <h2 className="text-2xl font-bold text-white mb-4">🏎️ Categorías</h2>
                                <p className="text-gray-300 mb-4">
                                    Selecciona las categorías de vehículos que participarán en este campeonato (puedes seleccionar varias)
                                </p>

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {CATEGORIES.map(category => (
                                        <button key={category} type="button" onClick={() => handleCategoryToggle(category)}
                                            className={`p-8 rounded-xl border-3 transition-all transform hover:scale-105 ${formData.categories.includes(category)
                                                ? 'bg-gradient-to-br from-orange-600 to-red-600 border-orange-400 text-white shadow-lg shadow-orange-500/50'
                                                : 'bg-white/10 border-white/30 text-gray-300 hover:bg-white/20 hover:border-white/50'
                                                }`}>
                                            <div className="text-6xl mb-4">🏎️</div>
                                            <div className="text-2xl font-bold mb-2">{category}</div>
                                            {formData.categories.includes(category) && (
                                                <div className="mt-2 text-sm bg-white/20 rounded-full px-3 py-1 inline-block">✓ Seleccionada</div>
                                            )}
                                        </button>
                                    ))}
                                </div>

                                {formData.categories.length > 0 && (
                                    <div className="bg-green-500/20 border border-green-500/30 rounded-lg p-4 text-green-200">
                                        <p className="text-sm">
                                            ✅ {formData.categories.length} categoría{formData.categories.length !== 1 ? 's' : ''} seleccionada{formData.categories.length !== 1 ? 's' : ''}: <strong>{formData.categories.join(', ')}</strong>
                                        </p>
                                    </div>
                                )}

                                <div className="bg-blue-500/20 border border-blue-500/30 rounded-lg p-4 text-blue-200">
                                    <p className="text-sm">
                                        💡 <strong>Tip:</strong> Puedes modificar las categorías más adelante desde la configuración del campeonato.
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* ============================== */}
                        {/* Step 3: Sistema de Puntos      */}
                        {/* ============================== */}
                        {currentStep === 3 && (
                            <div className="space-y-6">
                                <h2 className="text-2xl font-bold text-white mb-4">🏆 Sistema de Puntos</h2>
                                <p className="text-gray-300 mb-4">Configura los puntos que se otorgarán por posición y opciones adicionales</p>

                                {/* Puntos de Carrera */}
                                <div className="bg-white/5 backdrop-blur-sm border border-white/20 rounded-lg p-6">
                                    <h3 className="text-xl font-bold text-white mb-4">🏁 Puntos por Posición en Carrera</h3>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16].map(position => (
                                            <div key={position}>
                                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                                    {position}° Lugar {position <= 3 && ['🥇', '🥈', '🥉'][position - 1]}
                                                </label>
                                                <input type="number" min="0"
                                                    value={formData.settings.pointsSystem.race[position] || 0}
                                                    onChange={(e) => handlePointSystemChange(position, e.target.value)}
                                                    className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500" />
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Vuelta Rápida */}
                                <div className="bg-white/5 backdrop-blur-sm border border-white/20 rounded-lg p-6">
                                    <div className="flex items-center justify-between mb-4">
                                        <div>
                                            <h3 className="text-xl font-bold text-white">⚡ Vuelta Rápida</h3>
                                            <p className="text-sm text-gray-300">Puntos extra por marcar la vuelta más rápida de la carrera</p>
                                        </div>
                                        {renderToggle(formData.settings.pointsSystem.fastestLap.enabled, handleToggleFastestLap)}
                                    </div>
                                    {formData.settings.pointsSystem.fastestLap.enabled && (
                                        <div className="mt-4 max-w-xs">
                                            <label className="block text-sm font-medium text-gray-300 mb-2">Puntos por Vuelta Rápida</label>
                                            <input type="number" min="0"
                                                value={formData.settings.pointsSystem.fastestLap.points}
                                                onChange={(e) => handleFastestLapPointsChange(e.target.value)}
                                                className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500" />
                                        </div>
                                    )}
                                </div>

                                {/* Qualifying */}
                                <div className="bg-white/5 backdrop-blur-sm border border-white/20 rounded-lg p-6">
                                    <div className="flex items-center justify-between mb-4">
                                        <div>
                                            <h3 className="text-xl font-bold text-white">🎯 Clasificación (Qualy)</h3>
                                            <p className="text-sm text-gray-300">Puntos adicionales por posición en clasificación</p>
                                        </div>
                                        {renderToggle(formData.settings.pointsSystem.qualifying.enabled, handleToggleQualifying)}
                                    </div>
                                    {formData.settings.pointsSystem.qualifying.enabled && (
                                        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                                            {[1, 2, 3].map(position => (
                                                <div key={position}>
                                                    <label className="block text-sm font-medium text-gray-300 mb-2">
                                                        {position}° Lugar {['🥇', '🥈', '🥉'][position - 1]}
                                                    </label>
                                                    <input type="number" min="0"
                                                        value={formData.settings.pointsSystem.qualifying.positions[position] || 0}
                                                        onChange={(e) => handleQualyPointChange(position, e.target.value)}
                                                        className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500" />
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* ============================== */}
                        {/* Step 4: Configuración          */}
                        {/* ============================== */}
                        {currentStep === 4 && (
                            <div className="space-y-6">
                                <h2 className="text-2xl font-bold text-white mb-4">⚙️ Configuración del Campeonato</h2>
                                <p className="text-gray-300 mb-4">Define el tipo de campeonato y límites de participación</p>

                                <div className="space-y-6">
                                    {/* Tipo de Campeonato */}
                                    <div className="bg-white/5 backdrop-blur-sm border border-white/20 rounded-lg p-6">
                                        <div className="flex items-center justify-between mb-4">
                                            <div>
                                                <h3 className="text-xl font-bold text-white mb-2">🏁 Tipo de Campeonato</h3>
                                                <p className="text-gray-300 text-sm">
                                                    {formData.settings.isTeamChampionship
                                                        ? 'Campeonato por Equipos - Los pilotos compiten representando equipos'
                                                        : 'Campeonato Individual - Los pilotos compiten de forma individual'}
                                                </p>
                                            </div>
                                            {renderToggle(formData.settings.isTeamChampionship, handleToggleTeamMode, 'lg')}
                                        </div>
                                        <div className="flex items-center gap-4 text-sm">
                                            <div className={`flex items-center gap-2 ${!formData.settings.isTeamChampionship ? 'text-white font-bold' : 'text-gray-400'}`}>
                                                <span className="text-2xl">👤</span><span>Individual</span>
                                            </div>
                                            <div className={`flex items-center gap-2 ${formData.settings.isTeamChampionship ? 'text-white font-bold' : 'text-gray-400'}`}>
                                                <span className="text-2xl">👥</span><span>Por Equipos</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Configuración de Equipos */}
                                    {formData.settings.isTeamChampionship && (
                                        <div className="bg-white/5 backdrop-blur-sm border border-white/20 rounded-lg p-6">
                                            <h3 className="text-xl font-bold text-white mb-4">👥 Configuración de Equipos</h3>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-300 mb-2">Máximo de Equipos</label>
                                                    <input type="number" min="1"
                                                        value={formData.settings.maxTeams}
                                                        onChange={(e) => setFormData(prev => ({ ...prev, settings: { ...prev.settings, maxTeams: parseInt(e.target.value) || 0 } }))}
                                                        className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                                                        placeholder="0 = Sin límite" />
                                                    <p className="text-xs text-gray-400 mt-1">Deja en 0 para permitir equipos ilimitados</p>
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-300 mb-2">Pilotos por Equipo</label>
                                                    <input type="number" min="1"
                                                        value={formData.settings.maxDriversPerTeam}
                                                        onChange={(e) => setFormData(prev => ({ ...prev, settings: { ...prev.settings, maxDriversPerTeam: parseInt(e.target.value) || 0 } }))}
                                                        className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                                                        placeholder="0 = Sin límite" />
                                                    <p className="text-xs text-gray-400 mt-1">Deja en 0 para permitir pilotos ilimitados por equipo</p>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Gestión de Pilotos/Equipos */}
                                    {formData.settings.isTeamChampionship ? (
                                        /* === EQUIPOS === */
                                        <div className="bg-white/5 backdrop-blur-sm border border-white/20 rounded-lg p-6">
                                            <div className="mb-4 flex items-start justify-between">
                                                <div>
                                                    <h3 className="text-xl font-bold text-white mb-2">👥 Equipos y Pilotos</h3>
                                                    <p className="text-gray-300 text-sm">Agrega los equipos participantes y sus pilotos</p>
                                                </div>
                                                {championships.length > 0 && (
                                                    <button type="button" onClick={() => setShowImportModal(true)}
                                                        className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded-lg transition-all whitespace-nowrap">
                                                        📥 Importar
                                                    </button>
                                                )}
                                            </div>

                                            <div className="mb-4">
                                                <div className="flex gap-2">
                                                    <input type="text" placeholder="Nombre del equipo (ej: Red Bull Racing)"
                                                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddTeam(e.target.value); e.target.value = ''; } }}
                                                        className="flex-1 px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500" />
                                                    <button type="button" onClick={(e) => { const input = e.target.previousSibling; handleAddTeam(input.value); input.value = ''; }}
                                                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors">
                                                        + Equipo
                                                    </button>
                                                </div>
                                            </div>

                                            {(!formData.teams || formData.teams.length === 0) ? (
                                                <div className="text-center py-6 text-gray-400 bg-white/5 rounded-lg border border-white/10">
                                                    <div className="text-3xl mb-2">👥</div>
                                                    <p className="text-sm">No hay equipos agregados</p>
                                                </div>
                                            ) : (
                                                <div className="space-y-3">
                                                    {formData.teams.map((team, teamIndex) => (
                                                        <div key={teamIndex} className="bg-white/5 border border-white/10 rounded-lg p-4">
                                                            <div className="flex items-center justify-between mb-3">
                                                                <h4 className="text-white font-bold text-lg flex items-center gap-2">
                                                                    <span>🏁</span>{team.name}
                                                                </h4>
                                                                <button type="button" onClick={() => handleRemoveTeam(teamIndex)}
                                                                    className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition-colors">
                                                                    Eliminar Equipo
                                                                </button>
                                                            </div>
                                                            <div className="mb-3 pl-6">
                                                                <div className="flex gap-2">
                                                                    <input type="text" placeholder="Nombre del piloto"
                                                                        id={`teamDriverInput_${teamIndex}`}
                                                                        onKeyDown={(e) => {
                                                                            if (e.key === 'Enter') {
                                                                                e.preventDefault();
                                                                                const catSelect = document.getElementById(`teamDriverCategory_${teamIndex}`);
                                                                                handleAddDriverToTeam(teamIndex, e.target.value, catSelect?.value || '');
                                                                                e.target.value = '';
                                                                            }
                                                                        }}
                                                                        className="flex-1 px-3 py-2 bg-white/10 border border-white/30 rounded-lg text-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500" />
                                                                    <select id={`teamDriverCategory_${teamIndex}`}
                                                                        className="px-2 py-2 bg-white/10 border border-white/30 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                                                                        <option value="" className="bg-gray-800">Sin cat.</option>
                                                                        {(formData.categories || []).map(cat => (
                                                                            <option key={cat} value={cat} className="bg-gray-800">{cat}</option>
                                                                        ))}
                                                                    </select>
                                                                    <button type="button" onClick={() => {
                                                                        const nameInput = document.getElementById(`teamDriverInput_${teamIndex}`);
                                                                        const catSelect = document.getElementById(`teamDriverCategory_${teamIndex}`);
                                                                        handleAddDriverToTeam(teamIndex, nameInput?.value, catSelect?.value || '');
                                                                        if (nameInput) nameInput.value = '';
                                                                    }}
                                                                        className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded transition-colors">
                                                                        + Piloto
                                                                    </button>
                                                                </div>
                                                            </div>
                                                            {(!team.drivers || team.drivers.length === 0) ? (
                                                                <p className="text-gray-400 text-sm pl-6">Sin pilotos asignados</p>
                                                            ) : (
                                                                <div className="space-y-1 pl-6">
                                                                    {team.drivers.map((driver, driverIndex) => (
                                                                        <div key={driverIndex} className="flex items-center justify-between bg-white/5 border border-white/10 rounded p-2">
                                                                            <div className="flex items-center gap-2">
                                                                                <span className="text-lg">🏎️</span>
                                                                                <span className="text-white">{driver.name}</span>
                                                                                <select
                                                                                    value={driver.category || ''}
                                                                                    onChange={(e) => handleChangeDriverCategoryInTeam(teamIndex, driverIndex, e.target.value)}
                                                                                    className="px-2 py-0.5 bg-orange-600/20 border border-orange-500/30 text-orange-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-orange-500">
                                                                                    <option value="" className="bg-gray-800">Sin cat.</option>
                                                                                    {(formData.categories || []).map(cat => (
                                                                                        <option key={cat} value={cat} className="bg-gray-800">{cat}</option>
                                                                                    ))}
                                                                                </select>
                                                                            </div>
                                                                            <button type="button" onClick={() => handleRemoveDriverFromTeam(teamIndex, driverIndex)}
                                                                                className="text-red-400 hover:text-red-300 text-sm">Eliminar</button>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        /* === PILOTOS INDIVIDUALES === */
                                        <div className="bg-white/5 backdrop-blur-sm border border-white/20 rounded-lg p-6">
                                            <div className="mb-4 flex items-start justify-between">
                                                <div>
                                                    <h3 className="text-xl font-bold text-white mb-2">🏎️ Pilotos</h3>
                                                    <p className="text-gray-300 text-sm">Agrega los pilotos que participarán en el campeonato</p>
                                                </div>
                                                {championships.length > 0 && (
                                                    <button type="button" onClick={() => setShowImportModal(true)}
                                                        className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded-lg transition-all whitespace-nowrap">
                                                        📥 Importar
                                                    </button>
                                                )}
                                            </div>
                                            <div className="mb-4">
                                                <div className="flex gap-2">
                                                    <input type="text" id="driverNameInput" placeholder="Nombre del piloto (ej: Max Verstappen)"
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') {
                                                                e.preventDefault();
                                                                const catSelect = document.getElementById('driverCategorySelect');
                                                                handleAddDriver(e.target.value, catSelect?.value || '');
                                                                e.target.value = '';
                                                            }
                                                        }}
                                                        className="flex-1 px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500" />
                                                    <select id="driverCategorySelect"
                                                        className="px-3 py-2 bg-white/10 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500">
                                                        <option value="" className="bg-gray-800">Sin categoría</option>
                                                        {(formData.categories || []).map(cat => (
                                                            <option key={cat} value={cat} className="bg-gray-800">{cat}</option>
                                                        ))}
                                                    </select>
                                                    <button type="button" onClick={() => {
                                                        const nameInput = document.getElementById('driverNameInput');
                                                        const catSelect = document.getElementById('driverCategorySelect');
                                                        handleAddDriver(nameInput?.value, catSelect?.value || '');
                                                        if (nameInput) nameInput.value = '';
                                                    }}
                                                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors">
                                                        Agregar
                                                    </button>
                                                </div>
                                            </div>
                                            {(!formData.drivers || formData.drivers.length === 0) ? (
                                                <div className="text-center py-6 text-gray-400 bg-white/5 rounded-lg border border-white/10">
                                                    <div className="text-3xl mb-2">🏎️</div>
                                                    <p className="text-sm">No hay pilotos agregados</p>
                                                </div>
                                            ) : (
                                                <div className="space-y-2">
                                                    <p className="text-sm text-gray-400">{formData.drivers.length} piloto(s) registrado(s):</p>
                                                    <div className="space-y-1">
                                                        {formData.drivers.map((driver, index) => (
                                                            <div key={index} className="flex items-center justify-between bg-white/5 border border-white/10 rounded px-3 py-2">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-lg">🏎️</span>
                                                                    <span className="text-white">{driver.name}</span>
                                                                    <select
                                                                        value={driver.category || ''}
                                                                        onChange={(e) => handleChangeDriverCategory(index, e.target.value)}
                                                                        className="px-2 py-0.5 bg-orange-600/20 border border-orange-500/30 text-orange-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-orange-500">
                                                                        <option value="" className="bg-gray-800">Sin cat.</option>
                                                                        {(formData.categories || []).map(cat => (
                                                                            <option key={cat} value={cat} className="bg-gray-800">{cat}</option>
                                                                        ))}
                                                                    </select>
                                                                </div>
                                                                <button type="button" onClick={() => handleRemoveDriver(index)}
                                                                    className="text-red-400 hover:text-red-300 text-sm">Eliminar</button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* ══════════════════════════════════════════ */}
                                    {/* PRE-QUALY                                  */}
                                    {/* ══════════════════════════════════════════ */}
                                    <div className="bg-white/5 backdrop-blur-sm border border-purple-400/30 rounded-lg p-6">
                                        <div className="flex items-center justify-between mb-4">
                                            <div>
                                                <h3 className="text-xl font-bold text-white mb-2">🎯 Pre-Qualy</h3>
                                                <p className="text-gray-300 text-sm">
                                                    {formData.preQualy?.enabled
                                                        ? 'Sesión clasificatoria previa al campeonato habilitada'
                                                        : 'Activa para definir una sesión de clasificación antes de que inicie el campeonato'}
                                                </p>
                                            </div>
                                            {renderToggle(formData.preQualy?.enabled ?? false, () =>
                                                setFormData(prev => ({
                                                    ...prev,
                                                    preQualy: { ...prev.preQualy, enabled: !(prev.preQualy?.enabled ?? false) }
                                                })), 'lg'
                                            )}
                                        </div>

                                        {formData.preQualy?.enabled && (
                                            <div className="space-y-6 mt-4 pt-4 border-t border-purple-400/20">
                                                {/* Fecha, Circuito y Duración */}
                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-300 mb-2">📅 Fecha</label>
                                                        <input type="date"
                                                            value={formData.preQualy.date}
                                                            onChange={(e) => setFormData(prev => ({
                                                                ...prev, preQualy: { ...prev.preQualy, date: e.target.value }
                                                            }))}
                                                            className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500" />
                                                    </div>
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-300 mb-2">⏱️ Duración (min)</label>
                                                        <input type="number" min="5" max="120"
                                                            value={formData.preQualy.duration ?? 15}
                                                            onChange={(e) => setFormData(prev => ({
                                                                ...prev, preQualy: { ...prev.preQualy, duration: parseInt(e.target.value) || 15 }
                                                            }))}
                                                            className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500" />
                                                    </div>
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-300 mb-2">⏩ Velocidad del Tiempo</label>
                                                        <select value={formData.preQualy.rules?.timeMultiplier ?? 1}
                                                            onChange={(e) => setFormData(prev => ({
                                                                ...prev, preQualy: {
                                                                    ...prev.preQualy,
                                                                    rules: { ...prev.preQualy.rules, timeMultiplier: parseInt(e.target.value) }
                                                                }
                                                            }))}
                                                            className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500">
                                                            {TIME_MULTIPLIER_OPTIONS.map(opt => (
                                                                <option key={opt.value} value={opt.value} className="bg-slate-800">{opt.label}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                </div>

                                                {/* Circuito */}
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-300 mb-2">🏁 Circuito</label>
                                                    <select value={formData.preQualy.track}
                                                        onChange={(e) => setFormData(prev => ({
                                                            ...prev, preQualy: { ...prev.preQualy, track: e.target.value }
                                                        }))}
                                                        className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500">
                                                        <option value="" className="bg-slate-800">Seleccionar circuito...</option>
                                                        {firebaseTracks.length > 0 && (
                                                            <optgroup label="🖼️ Circuitos con Imagen" className="bg-slate-800">
                                                                {firebaseTracks.map(t => (
                                                                    <option key={t.id} value={t.name} className="bg-slate-800">{t.name} ✨</option>
                                                                ))}
                                                            </optgroup>
                                                        )}
                                                        <optgroup label="🎮 Gran Turismo 7" className="bg-slate-800">
                                                            {GT7_TRACKS.filter(n => !firebaseTracks.map(t => t.name).includes(n)).map(t => (
                                                                <option key={t} value={t} className="bg-slate-800">{t}</option>
                                                            ))}
                                                        </optgroup>
                                                    </select>
                                                </div>

                                                {/* Autos específicos */}
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-300 mb-2">🚗 Autos Permitidos</label>
                                                    <div className="flex gap-2 mb-2">
                                                        <input type="text" placeholder="Nombre del carro (ej: Toyota GR86)"
                                                            id="preQualyCarInput"
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') {
                                                                    e.preventDefault();
                                                                    const v = e.target.value.trim();
                                                                    if (v && !formData.preQualy.allowedCars.includes(v)) {
                                                                        setFormData(prev => ({ ...prev, preQualy: { ...prev.preQualy, allowedCars: [...prev.preQualy.allowedCars, v] } }));
                                                                    }
                                                                    e.target.value = '';
                                                                }
                                                            }}
                                                            className="flex-1 px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500" />
                                                        <button type="button" onClick={() => {
                                                            const input = document.getElementById('preQualyCarInput');
                                                            const v = input?.value?.trim();
                                                            if (v && !formData.preQualy.allowedCars.includes(v)) {
                                                                setFormData(prev => ({ ...prev, preQualy: { ...prev.preQualy, allowedCars: [...prev.preQualy.allowedCars, v] } }));
                                                            }
                                                            if (input) input.value = '';
                                                        }}
                                                            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg">
                                                            Agregar
                                                        </button>
                                                    </div>
                                                    {formData.preQualy.allowedCars?.length > 0 && (
                                                        <div className="flex flex-wrap gap-2">
                                                            {formData.preQualy.allowedCars.map((car, idx) => (
                                                                <span key={idx} className="flex items-center gap-1 bg-purple-600/20 border border-purple-400/30 text-purple-200 px-3 py-1 rounded-full text-sm">
                                                                    {car}
                                                                    <button type="button" onClick={() => setFormData(prev => ({
                                                                        ...prev, preQualy: { ...prev.preQualy, allowedCars: prev.preQualy.allowedCars.filter((_, i) => i !== idx) }
                                                                    }))} className="text-purple-400 hover:text-red-400 ml-1">×</button>
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Reglas de la Pre-Qualy */}
                                                <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                                                    <h4 className="text-white font-semibold mb-4">⚙️ Configuración de la Sesión</h4>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        <div>
                                                            <label className="block text-sm font-medium text-gray-300 mb-2">🌤️ Clima</label>
                                                            {renderSelect(formData.preQualy.rules?.weather ?? 'clear', (e) => setFormData(prev => ({
                                                                ...prev, preQualy: { ...prev.preQualy, rules: { ...prev.preQualy.rules, weather: e.target.value } }
                                                            })), WEATHER_OPTIONS)}
                                                        </div>
                                                        <div>
                                                            <label className="block text-sm font-medium text-gray-300 mb-2">🔧 Daños</label>
                                                            {renderSelect(formData.preQualy.rules?.mechanicalDamage ?? 'No', (e) => setFormData(prev => ({
                                                                ...prev, preQualy: { ...prev.preQualy, rules: { ...prev.preQualy.rules, mechanicalDamage: e.target.value } }
                                                            })), DAMAGE_OPTIONS)}
                                                        </div>
                                                        <div>
                                                            <label className="block text-sm font-medium text-gray-300 mb-2">🔀 Penalización por Atajo</label>
                                                            {renderSelect(formData.preQualy.rules?.penaltyShortcut ?? 'strong', (e) => setFormData(prev => ({
                                                                ...prev, preQualy: { ...prev.preQualy, rules: { ...prev.preQualy.rules, penaltyShortcut: e.target.value } }
                                                            })), PENALTY_SHORTCUT_OPTIONS)}
                                                        </div>
                                                        <div>
                                                            <label className="block text-sm font-medium text-gray-300 mb-2">🧱 Penalización por Muro</label>
                                                            {renderSelect(formData.preQualy.rules?.penaltyWall ?? 'off', (e) => setFormData(prev => ({
                                                                ...prev, preQualy: { ...prev.preQualy, rules: { ...prev.preQualy.rules, penaltyWall: e.target.value } }
                                                            })), ON_OFF_OPTIONS)}
                                                        </div>
                                                        <div className="flex items-center justify-between bg-white/5 border border-white/10 rounded-lg p-3">
                                                            <div>
                                                                <label className="block text-sm font-medium text-gray-300">💨 Rebufo (Slipstream)</label>
                                                                <p className="text-xs text-gray-400">Efecto de succión entre coches</p>
                                                            </div>
                                                            {renderToggle(formData.preQualy.rules?.qualySlipstream ?? false, () =>
                                                                setFormData(prev => ({
                                                                    ...prev, preQualy: {
                                                                        ...prev.preQualy,
                                                                        rules: { ...prev.preQualy.rules, qualySlipstream: !(prev.preQualy.rules?.qualySlipstream ?? false) }
                                                                    }
                                                                }))
                                                            )}
                                                        </div>
                                                        <div>
                                                            <label className="block text-sm font-medium text-gray-300 mb-2">🛞 Neumáticos Obligatorios</label>
                                                            <div className="flex flex-wrap gap-2">
                                                                {TYRE_OPTIONS.filter(t => ['CB', 'CM', 'CD'].includes(t.value)).map(tyre => {
                                                                    const tyres = formData.preQualy.rules?.mandatoryTyre || [];
                                                                    const isSelected = tyres.includes(tyre.value);
                                                                    return (
                                                                        <label key={tyre.value}
                                                                            className={`flex items-center gap-1 px-2 py-1 rounded-lg border cursor-pointer text-xs transition-all ${isSelected ? 'bg-purple-600/30 border-purple-500 text-white' : 'bg-white/5 border-white/20 text-gray-300 hover:bg-white/10'}`}>
                                                                            <input type="checkbox" checked={isSelected}
                                                                                onChange={(e) => {
                                                                                    const newTyres = e.target.checked ? [...tyres, tyre.value] : tyres.filter(t => t !== tyre.value);
                                                                                    setFormData(prev => ({
                                                                                        ...prev, preQualy: { ...prev.preQualy, rules: { ...prev.preQualy.rules, mandatoryTyre: newTyres } }
                                                                                    }));
                                                                                }}
                                                                                className="w-3 h-3" />
                                                                            {tyre.label}
                                                                        </label>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Notas */}
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-300 mb-2">📝 Notas / Instrucciones</label>
                                                    <textarea
                                                        value={formData.preQualy.notes || ''}
                                                        onChange={(e) => setFormData(prev => ({
                                                            ...prev, preQualy: { ...prev.preQualy, notes: e.target.value }
                                                        }))}
                                                        rows={3}
                                                        placeholder="Instrucciones especiales para la sesión de Pre-Qualy..."
                                                        className="w-full px-4 py-3 bg-white/10 border border-white/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-y text-sm"
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Circuitos del Campeonato */}
                                    <div className="bg-white/5 backdrop-blur-sm border border-white/20 rounded-lg p-6">
                                        <div className="flex items-center justify-between mb-4">
                                            <div>
                                                <h3 className="text-xl font-bold text-white mb-2">🏁 Circuitos del Campeonato</h3>
                                                <p className="text-gray-300 text-sm">Configura los circuitos que formarán parte del campeonato</p>
                                            </div>
                                            <button type="button" onClick={() => handleOpenTrackModal()}
                                                className="px-4 py-2 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white font-bold rounded-lg transition-all">
                                                ➕ Agregar Circuito
                                            </button>
                                        </div>

                                        {loadingTracks ? (
                                            <div className="text-center text-gray-400 py-8">Cargando circuitos...</div>
                                        ) : formData.tracks.length === 0 ? (
                                            <div className="text-center py-8 text-gray-400">
                                                <div className="text-4xl mb-2">🏁</div>
                                                <p>No hay circuitos agregados aún</p>
                                                <p className="text-sm mt-1">Haz clic en &quot;Agregar Circuito&quot; para comenzar</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-3">
                                                {formData.tracks.map((track, index) => (
                                                    <div key={index} className="bg-white/5 border border-white/20 rounded-lg p-4">
                                                        <div className="flex justify-between items-start">
                                                            <div className="flex-1">
                                                                <div className="flex items-center gap-3 mb-2">
                                                                    <span className="text-2xl font-bold text-orange-500">#{track.round}</span>
                                                                    <h4 className="text-lg font-bold text-white">{track.name}</h4>
                                                                    <span className="px-2 py-1 bg-blue-600 text-white text-xs rounded-full">{track.category}</span>
                                                                </div>
                                                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm text-gray-300">
                                                                    <div>📅 {new Date(track.date).toLocaleDateString('es-ES')}</div>
                                                                    <div>
                                                                        {track.raceType === 'carrera'
                                                                            ? <>🏁 {track.laps} vueltas</>
                                                                            : <>⏱️ {track.duration} min</>}
                                                                    </div>
                                                                    {track.specificCars && <div className="text-blue-400">🚗 {(track.allowedCars || []).length} carros específicos</div>}
                                                                </div>
                                                            </div>
                                                            <div className="flex gap-2">
                                                                <button type="button" onClick={() => handleOpenTrackModal(index)}
                                                                    className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-all">
                                                                    ✏️ Editar
                                                                </button>
                                                                <button type="button" onClick={() => handleDeleteTrack(index)}
                                                                    className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition-all">
                                                                    🗑️
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ============================== */}
                        {/* Step 5: Opciones               */}
                        {/* ============================== */}
                        {currentStep === 5 && (
                            <div className="space-y-6">
                                <h2 className="text-2xl font-bold text-white mb-4">⚙️ Opciones del Campeonato</h2>
                                <p className="text-gray-300 mb-2">Todas estas secciones son opcionales. Activa solo las que necesites.</p>

                                {/* Inscripción Pública */}
                                <div className="bg-white/5 backdrop-blur-sm border border-white/20 rounded-lg p-6">
                                    <div className="flex items-center justify-between mb-4">
                                        <div>
                                            <h3 className="text-xl font-bold text-white mb-2">📝 Inscripción Pública</h3>
                                            <p className="text-gray-300 text-sm">
                                                {formData.registration.enabled
                                                    ? 'Los pilotos pueden inscribirse desde la página pública del campeonato'
                                                    : 'La inscripción pública está deshabilitada'}
                                            </p>
                                        </div>
                                        {renderToggle(formData.registration.enabled, () => {
                                            setFormData(prev => ({
                                                ...prev,
                                                registration: { ...prev.registration, enabled: !prev.registration.enabled }
                                            }));
                                        }, 'lg')}
                                    </div>

                                    {formData.registration.enabled && (
                                        <div className="space-y-4 mt-4 pt-4 border-t border-white/10">
                                            {/* Requiere aprobación */}
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-300">Requiere aprobación del admin</label>
                                                    <p className="text-xs text-gray-400">Si está activo, las inscripciones deben ser aprobadas manualmente</p>
                                                </div>
                                                {renderToggle(formData.registration.requiresApproval, () => {
                                                    setFormData(prev => ({
                                                        ...prev,
                                                        registration: { ...prev.registration, requiresApproval: !prev.registration.requiresApproval }
                                                    }));
                                                })}
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {/* Fecha límite */}
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-300 mb-2">Fecha límite de inscripción</label>
                                                    <input type="date"
                                                        value={formData.registration.deadline}
                                                        onChange={(e) => setFormData(prev => ({
                                                            ...prev,
                                                            registration: { ...prev.registration, deadline: e.target.value }
                                                        }))}
                                                        className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500" />
                                                    <p className="text-xs text-gray-400 mt-1">Dejar vacío = sin fecha límite</p>
                                                </div>

                                                {/* Max participantes */}
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-300 mb-2">Máximo de participantes</label>
                                                    <input type="number" min="0"
                                                        value={formData.registration.maxParticipants}
                                                        onChange={(e) => setFormData(prev => ({
                                                            ...prev,
                                                            registration: { ...prev.registration, maxParticipants: parseInt(e.target.value) || 0 }
                                                        }))}
                                                        className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                                                        placeholder="0 = Sin límite" />
                                                    <p className="text-xs text-gray-400 mt-1">0 = sin límite de participantes</p>
                                                </div>
                                            </div>

                                            {/* Campos requeridos */}
                                            <div>
                                                <label className="block text-sm font-medium text-gray-300 mb-2">Campos requeridos en el formulario</label>
                                                <div className="flex flex-wrap gap-2">
                                                    {[
                                                        { value: 'gt7Id', label: 'GT7 ID', required: true },
                                                        { value: 'psnId', label: 'PSN ID', required: true },
                                                        { value: 'country', label: 'País' },
                                                        { value: 'experience', label: 'Experiencia' },
                                                        { value: 'preferredCar', label: 'Auto preferido' }
                                                    ].map(field => {
                                                        const isSelected = formData.registration.fields.includes(field.value);
                                                        return (
                                                            <button key={field.value} type="button"
                                                                disabled={field.required}
                                                                onClick={() => {
                                                                    if (field.required) return;
                                                                    setFormData(prev => ({
                                                                        ...prev,
                                                                        registration: {
                                                                            ...prev.registration,
                                                                            fields: isSelected
                                                                                ? prev.registration.fields.filter(f => f !== field.value)
                                                                                : [...prev.registration.fields, field.value]
                                                                        }
                                                                    }));
                                                                }}
                                                                className={`px-3 py-1.5 rounded-full text-sm transition-all ${isSelected
                                                                    ? 'bg-orange-600 text-white'
                                                                    : 'bg-white/10 text-gray-300 hover:bg-white/20'
                                                                    } ${field.required ? 'opacity-75 cursor-not-allowed' : 'cursor-pointer'}`}>
                                                                {isSelected ? '✓ ' : ''}{field.label}{field.required ? ' *' : ''}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                                <p className="text-xs text-gray-400 mt-1">* Campos obligatorios que no se pueden desactivar</p>
                                            </div>

                                            {/* Aceptar reglas */}
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-300">Requiere aceptar reglamento</label>
                                                    <p className="text-xs text-gray-400">El piloto debe aceptar las reglas del campeonato al inscribirse</p>
                                                </div>
                                                {renderToggle(formData.registration.acceptRules, () => {
                                                    setFormData(prev => ({
                                                        ...prev,
                                                        registration: { ...prev.registration, acceptRules: !prev.registration.acceptRules }
                                                    }));
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Sanciones */}
                                <div className="bg-white/5 backdrop-blur-sm border border-white/20 rounded-lg p-6">
                                    <div className="flex items-center justify-between mb-4">
                                        <div>
                                            <h3 className="text-xl font-bold text-white mb-2">⚠️ Sistema de Sanciones</h3>
                                            <p className="text-gray-300 text-sm">
                                                {formData.penaltiesConfig.enabled
                                                    ? 'Gestiona sanciones, amonestaciones y reclamaciones de los pilotos'
                                                    : 'Activa el sistema de sanciones para gestionar infracciones'}
                                            </p>
                                        </div>
                                        {renderToggle(formData.penaltiesConfig.enabled, () => {
                                            setFormData(prev => ({
                                                ...prev,
                                                penaltiesConfig: { ...prev.penaltiesConfig, enabled: !prev.penaltiesConfig.enabled }
                                            }));
                                        })}
                                    </div>
                                    {formData.penaltiesConfig.enabled && (
                                        <div className="space-y-4 mt-4 pt-4 border-t border-white/10">
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-300 mb-2">Umbral Amonestaciones</label>
                                                    <input type="number" min="1" max="50"
                                                        value={formData.penaltiesConfig.warningThreshold}
                                                        onChange={(e) => setFormData(prev => ({
                                                            ...prev,
                                                            penaltiesConfig: { ...prev.penaltiesConfig, warningThreshold: parseInt(e.target.value) || 8 }
                                                        }))}
                                                        className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500" />
                                                    <p className="text-xs text-gray-400 mt-1">Puntos de amonestación para penalización automática</p>
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-300 mb-2">Puntos Auto-Deducidos</label>
                                                    <input type="number" min="0" max="100"
                                                        value={formData.penaltiesConfig.autoPointsPenalty}
                                                        onChange={(e) => setFormData(prev => ({
                                                            ...prev,
                                                            penaltiesConfig: { ...prev.penaltiesConfig, autoPointsPenalty: parseInt(e.target.value) || 10 }
                                                        }))}
                                                        className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500" />
                                                    <p className="text-xs text-gray-400 mt-1">Puntos restados al alcanzar umbral</p>
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-300 mb-2">Umbral Descalificación</label>
                                                    <input type="number" min="1" max="100"
                                                        value={formData.penaltiesConfig.autoDisqualifyThreshold}
                                                        onChange={(e) => setFormData(prev => ({
                                                            ...prev,
                                                            penaltiesConfig: { ...prev.penaltiesConfig, autoDisqualifyThreshold: parseInt(e.target.value) || 16 }
                                                        }))}
                                                        className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500" />
                                                    <p className="text-xs text-gray-400 mt-1">Amonestaciones para descalificación</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-300">Reclamaciones Públicas</label>
                                                    <p className="text-xs text-gray-400">Permitir que los pilotos envíen reportes de incidentes</p>
                                                </div>
                                                {renderToggle(formData.penaltiesConfig.allowClaims, () => {
                                                    setFormData(prev => ({
                                                        ...prev,
                                                        penaltiesConfig: { ...prev.penaltiesConfig, allowClaims: !prev.penaltiesConfig.allowClaims }
                                                    }));
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Reglamentación del Campeonato */}
                                <div className="bg-white/5 backdrop-blur-sm border border-white/20 rounded-lg p-6">
                                    <h3 className="text-xl font-bold text-white mb-2">📜 Reglamentación</h3>
                                    <p className="text-gray-300 text-sm mb-4">Texto general de reglas visibles para todos los participantes</p>
                                    <textarea
                                        value={formData.regulations || ''}
                                        onChange={(e) => setFormData(prev => ({ ...prev, regulations: e.target.value }))}
                                        rows={6}
                                        placeholder={`Ej:\n1. Respeto entre pilotos en todo momento\n2. No se permite contacto intencional\n3. Respetar banderas azules\n4. Penalización por cortar pista\n5. El admin tiene la última palabra en disputas`}
                                        className="w-full px-4 py-3 bg-white/10 border border-white/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 resize-y font-mono text-sm"
                                    />
                                    <p className="text-xs text-gray-400 mt-2">Este texto se mostrará en la sección pública del campeonato</p>
                                </div>

                                {/* Tracking de Uso de Autos */}
                                <div className="bg-white/5 backdrop-blur-sm border border-white/20 rounded-lg p-6">
                                    <div className="flex items-center justify-between mb-4">
                                        <div>
                                            <h3 className="text-xl font-bold text-white">🚗 Tracking de Uso de Autos</h3>
                                            <p className="text-gray-300 text-sm mt-1">Controla cuántas veces cada piloto puede usar el mismo auto</p>
                                        </div>
                                        {renderToggle(formData.carUsageTracking?.enabled ?? false, () => {
                                            setFormData(prev => ({
                                                ...prev,
                                                carUsageTracking: {
                                                    ...prev.carUsageTracking,
                                                    enabled: !(prev.carUsageTracking?.enabled ?? false)
                                                }
                                            }));
                                        })}
                                    </div>
                                    {formData.carUsageTracking?.enabled && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-white/10">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-300 mb-2">Máximo Usos por Auto</label>
                                                <input type="number" min="1" max="20"
                                                    value={formData.carUsageTracking?.maxUsesPerCar ?? 2}
                                                    onChange={(e) => setFormData(prev => ({
                                                        ...prev,
                                                        carUsageTracking: {
                                                            ...prev.carUsageTracking,
                                                            maxUsesPerCar: parseInt(e.target.value) || 2
                                                        }
                                                    }))}
                                                    className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500" />
                                                <p className="text-xs text-gray-400 mt-1">Número de carreras que un piloto puede usar el mismo auto</p>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-300 mb-2">Alerta en Uso #</label>
                                                <input type="number" min="1" max="20"
                                                    value={formData.carUsageTracking?.alertThreshold ?? 1}
                                                    onChange={(e) => setFormData(prev => ({
                                                        ...prev,
                                                        carUsageTracking: {
                                                            ...prev.carUsageTracking,
                                                            alertThreshold: parseInt(e.target.value) || 1
                                                        }
                                                    }))}
                                                    className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500" />
                                                <p className="text-xs text-gray-400 mt-1">Mostrará aviso cuando el piloto alcance este número de usos</p>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Divisiones */}
                                <div className="bg-white/5 backdrop-blur-sm border border-white/20 rounded-lg p-6">
                                    <div className="flex items-center justify-between mb-4">
                                        <div>
                                            <h3 className="text-xl font-bold text-white mb-2">🏆 Sistema de Divisiones</h3>
                                            <p className="text-gray-300 text-sm">
                                                {formData.divisionsConfig?.enabled
                                                    ? 'Organiza pilotos en divisiones con ascensos y descensos'
                                                    : 'Activa las divisiones para separar pilotos por nivel'}
                                            </p>
                                        </div>
                                        {renderToggle(formData.divisionsConfig?.enabled ?? false, () => {
                                            setFormData(prev => ({
                                                ...prev,
                                                divisionsConfig: { ...prev.divisionsConfig, enabled: !prev.divisionsConfig?.enabled }
                                            }));
                                        })}
                                    </div>
                                    {formData.divisionsConfig?.enabled && (
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 pt-4 border-t border-white/10">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-300 mb-2">Pilotos que ascienden</label>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    max="10"
                                                    value={formData.divisionsConfig.promotionCount}
                                                    onChange={(e) => setFormData(prev => ({
                                                        ...prev,
                                                        divisionsConfig: { ...prev.divisionsConfig, promotionCount: parseInt(e.target.value) || 5 }
                                                    }))}
                                                    className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                                                />
                                                <p className="text-xs text-gray-400 mt-1">Top pilotos que suben de división</p>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-300 mb-2">Pilotos que descienden</label>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    max="10"
                                                    value={formData.divisionsConfig.relegationCount}
                                                    onChange={(e) => setFormData(prev => ({
                                                        ...prev,
                                                        divisionsConfig: { ...prev.divisionsConfig, relegationCount: parseInt(e.target.value) || 5 }
                                                    }))}
                                                    className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                                                />
                                                <p className="text-xs text-gray-400 mt-1">Últimos pilotos que bajan de división</p>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-300 mb-2">Máx. pilotos por división</label>
                                                <input
                                                    type="number"
                                                    min="5"
                                                    max="30"
                                                    value={formData.divisionsConfig.maxDriversPerDivision}
                                                    onChange={(e) => setFormData(prev => ({
                                                        ...prev,
                                                        divisionsConfig: { ...prev.divisionsConfig, maxDriversPerDivision: parseInt(e.target.value) || 15 }
                                                    }))}
                                                    className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                                                />
                                                <p className="text-xs text-gray-400 mt-1">Límite de pilotos en cada división</p>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Streaming */}
                                <div className="bg-white/5 backdrop-blur-sm border border-white/20 rounded-lg p-6">
                                    <h3 className="text-xl font-bold text-white mb-4">📺 Streaming</h3>
                                    <p className="text-gray-300 text-sm mb-4">Configura la transmisión en vivo del campeonato</p>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {/* Plataforma */}
                                        <div>
                                            <label className="block text-sm font-medium text-gray-300 mb-2">Plataforma</label>
                                            <select
                                                value={formData.streaming.platform}
                                                onChange={(e) => setFormData(prev => ({
                                                    ...prev,
                                                    streaming: { ...prev.streaming, platform: e.target.value }
                                                }))}
                                                className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500">
                                                <option value="" className="bg-slate-800">Sin streaming</option>
                                                {STREAMING_PLATFORMS.map(p => (
                                                    <option key={p.value} value={p.value} className="bg-slate-800">
                                                        {p.icon} {p.label}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* URL de stream */}
                                        <div>
                                            <label className="block text-sm font-medium text-gray-300 mb-2">URL del Stream</label>
                                            <input type="url"
                                                value={formData.streaming.url}
                                                onChange={(e) => setFormData(prev => ({
                                                    ...prev,
                                                    streaming: { ...prev.streaming, url: e.target.value }
                                                }))}
                                                className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                                                placeholder="https://youtube.com/live/..." />
                                        </div>

                                        {/* Caster */}
                                        <div>
                                            <label className="block text-sm font-medium text-gray-300 mb-2">Caster / Narrador</label>
                                            <input type="text"
                                                value={formData.streaming.casterName}
                                                onChange={(e) => setFormData(prev => ({
                                                    ...prev,
                                                    streaming: { ...prev.streaming, casterName: e.target.value }
                                                }))}
                                                className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                                                placeholder="Nombre del caster" />
                                        </div>

                                        {/* Host */}
                                        <div>
                                            <label className="block text-sm font-medium text-gray-300 mb-2">Host / Anfitrión</label>
                                            <input type="text"
                                                value={formData.streaming.hostName}
                                                onChange={(e) => setFormData(prev => ({
                                                    ...prev,
                                                    streaming: { ...prev.streaming, hostName: e.target.value }
                                                }))}
                                                className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                                                placeholder="Nombre del host de la sala" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ============================== */}
                        {/* Step 6: Resumen                */}
                        {/* ============================== */}
                        {currentStep === 6 && (
                            <div className="space-y-6">
                                <h2 className="text-2xl font-bold text-white mb-4">
                                    {isEditing ? '✅ Resumen de Cambios' : '✅ Resumen del Campeonato'}
                                </h2>
                                <p className="text-gray-300 mb-6">
                                    {isEditing ? 'Revisa los cambios antes de actualizar' : 'Revisa la información antes de crear el campeonato'}
                                </p>

                                <div className="space-y-4">
                                    {/* Info Básica */}
                                    <div className="bg-white/5 border border-white/20 rounded-lg p-4">
                                        <h3 className="text-white font-medium mb-2">📋 Información Básica</h3>
                                        <div className="grid grid-cols-2 gap-2 text-sm">
                                            <div className="text-gray-400">Nombre:</div>
                                            <div className="text-white">{formData.name}</div>
                                            <div className="text-gray-400">Nombre Corto:</div>
                                            <div className="text-white">{formData.shortName}</div>
                                            <div className="text-gray-400">Temporada:</div>
                                            <div className="text-white">{formData.season}</div>
                                            <div className="text-gray-400">Estado:</div>
                                            <div className="text-white">{formData.status}</div>
                                        </div>
                                    </div>

                                    {/* Categorías */}
                                    <div className="bg-white/5 border border-white/20 rounded-lg p-4">
                                        <h3 className="text-white font-medium mb-2">🏎️ Categorías</h3>
                                        <div className="flex flex-wrap gap-2">
                                            {formData.categories.map(cat => (
                                                <span key={cat} className="px-3 py-1 bg-orange-600 text-white rounded-full text-sm">{cat}</span>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Puntos */}
                                    <div className="bg-white/5 border border-white/20 rounded-lg p-4">
                                        <h3 className="text-white font-medium mb-2">🏆 Sistema de Puntos</h3>
                                        <div className="space-y-3">
                                            <div>
                                                <p className="text-sm text-gray-400 mb-2">Puntos por Carrera (Top 8):</p>
                                                <div className="grid grid-cols-4 md:grid-cols-8 gap-2 text-sm">
                                                    {[1, 2, 3, 4, 5, 6, 7, 8].map(position => (
                                                        <div key={position} className="text-gray-400">
                                                            {position}°: <span className="text-white">{formData.settings.pointsSystem.race[position]}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                            {formData.settings.pointsSystem.fastestLap.enabled && (
                                                <div className="flex items-center gap-2 text-sm">
                                                    <span className="text-gray-400">⚡ Vuelta Rápida:</span>
                                                    <span className="text-white font-medium">+{formData.settings.pointsSystem.fastestLap.points} pt</span>
                                                </div>
                                            )}
                                            {formData.settings.pointsSystem.qualifying.enabled && (
                                                <div>
                                                    <p className="text-sm text-gray-400 mb-1">🎯 Clasificación:</p>
                                                    <div className="flex gap-4 text-sm">
                                                        {[1, 2, 3].map(pos => (
                                                            <span key={pos} className="text-gray-300">
                                                                {pos}°: <span className="text-white font-medium">{formData.settings.pointsSystem.qualifying.positions[pos]} pts</span>
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Configuración */}
                                    <div className="bg-white/5 border border-white/20 rounded-lg p-4">
                                        <h3 className="text-white font-medium mb-2">⚙️ Configuración</h3>
                                        <div className="space-y-2 text-sm">
                                            <div className="flex justify-between text-gray-300">
                                                <span>Tipo de campeonato:</span>
                                                <span className="text-white font-medium">
                                                    {formData.settings.isTeamChampionship ? '👥 Por Equipos' : '👤 Individual'}
                                                </span>
                                            </div>
                                            {formData.settings.isTeamChampionship && (
                                                <>
                                                    <div className="flex justify-between text-gray-300">
                                                        <span>Máximo de equipos:</span>
                                                        <span className="text-white">{formData.settings.maxTeams || 'Sin límite'}</span>
                                                    </div>
                                                    <div className="flex justify-between text-gray-300">
                                                        <span>Pilotos por equipo:</span>
                                                        <span className="text-white">{formData.settings.maxDriversPerTeam || 'Sin límite'}</span>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {/* Pre-Qualy */}
                                    {formData.preQualy?.enabled && (
                                        <div className="bg-white/5 border border-purple-400/30 rounded-lg p-4">
                                            <h3 className="text-white font-medium mb-2">🎯 Pre-Qualy</h3>
                                            <div className="space-y-1 text-sm">
                                                {formData.preQualy.date && (
                                                    <div className="flex justify-between text-gray-300">
                                                        <span>Fecha:</span>
                                                        <span className="text-white">{new Date(formData.preQualy.date).toLocaleDateString('es-ES')}</span>
                                                    </div>
                                                )}
                                                {formData.preQualy.track && (
                                                    <div className="flex justify-between text-gray-300">
                                                        <span>Circuito:</span>
                                                        <span className="text-white">{formData.preQualy.track}</span>
                                                    </div>
                                                )}
                                                <div className="flex justify-between text-gray-300">
                                                    <span>Duración:</span>
                                                    <span className="text-white">{formData.preQualy.duration ?? 15} min</span>
                                                </div>
                                                {formData.preQualy.allowedCars?.length > 0 && (
                                                    <div className="flex justify-between text-gray-300">
                                                        <span>Autos:</span>
                                                        <span className="text-white">{formData.preQualy.allowedCars.join(', ')}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* Circuitos */}
                                    <div className="bg-white/5 border border-white/20 rounded-lg p-4">
                                        <h3 className="text-white font-medium mb-2">🏁 Circuitos ({formData.tracks.length})</h3>
                                        {formData.tracks.length === 0 ? (
                                            <p className="text-sm text-gray-400">No se han agregado circuitos</p>
                                        ) : (
                                            <div className="space-y-2">
                                                {formData.tracks.map((track, idx) => (
                                                    <div key={idx} className="bg-white/5 border border-white/10 rounded p-3">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className="text-orange-500 font-bold">#{track.round}</span>
                                                            <span className="text-white font-medium">{track.name}</span>
                                                            <span className="px-2 py-0.5 bg-blue-600 text-white text-xs rounded">{track.category}</span>
                                                        </div>
                                                        <div className="text-xs text-gray-400">
                                                            📅 {new Date(track.date).toLocaleDateString('es-ES')} •
                                                            {track.raceType === 'carrera' ? ` 🏁 ${track.laps} vueltas` : ` ⏱️ ${track.duration} min`}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Inscripción */}
                                    <div className="bg-white/5 border border-white/20 rounded-lg p-4">
                                        <h3 className="text-white font-medium mb-2">📝 Inscripción Pública</h3>
                                        <div className="space-y-2 text-sm">
                                            <div className="flex justify-between text-gray-300">
                                                <span>Estado:</span>
                                                <span className={`font-medium ${formData.registration.enabled ? 'text-green-400' : 'text-gray-400'}`}>
                                                    {formData.registration.enabled ? '✅ Habilitada' : '❌ Deshabilitada'}
                                                </span>
                                            </div>
                                            {formData.registration.enabled && (
                                                <>
                                                    <div className="flex justify-between text-gray-300">
                                                        <span>Requiere aprobación:</span>
                                                        <span className="text-white">{formData.registration.requiresApproval ? 'Sí' : 'No (automática)'}</span>
                                                    </div>
                                                    {formData.registration.deadline && (
                                                        <div className="flex justify-between text-gray-300">
                                                            <span>Fecha límite:</span>
                                                            <span className="text-white">{new Date(formData.registration.deadline).toLocaleDateString('es-ES')}</span>
                                                        </div>
                                                    )}
                                                    <div className="flex justify-between text-gray-300">
                                                        <span>Máx. participantes:</span>
                                                        <span className="text-white">{formData.registration.maxParticipants || 'Sin límite'}</span>
                                                    </div>
                                                    <div className="flex justify-between text-gray-300">
                                                        <span>Campos del formulario:</span>
                                                        <span className="text-white">{formData.registration.fields.join(', ')}</span>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {/* Streaming */}
                                    {(formData.streaming.platform || formData.streaming.url) && (
                                        <div className="bg-white/5 border border-white/20 rounded-lg p-4">
                                            <h3 className="text-white font-medium mb-2">📺 Streaming</h3>
                                            <div className="space-y-2 text-sm">
                                                {formData.streaming.platform && (
                                                    <div className="flex justify-between text-gray-300">
                                                        <span>Plataforma:</span>
                                                        <span className="text-white">
                                                            {STREAMING_PLATFORMS.find(p => p.value === formData.streaming.platform)?.icon}{' '}
                                                            {STREAMING_PLATFORMS.find(p => p.value === formData.streaming.platform)?.label || formData.streaming.platform}
                                                        </span>
                                                    </div>
                                                )}
                                                {formData.streaming.url && (
                                                    <div className="flex justify-between text-gray-300">
                                                        <span>URL:</span>
                                                        <span className="text-blue-400 truncate max-w-[200px]">{formData.streaming.url}</span>
                                                    </div>
                                                )}
                                                {formData.streaming.casterName && (
                                                    <div className="flex justify-between text-gray-300">
                                                        <span>Caster:</span>
                                                        <span className="text-white">{formData.streaming.casterName}</span>
                                                    </div>
                                                )}
                                                {formData.streaming.hostName && (
                                                    <div className="flex justify-between text-gray-300">
                                                        <span>Host:</span>
                                                        <span className="text-white">{formData.streaming.hostName}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Navegación */}
                    <div className="flex justify-between gap-4">
                        {currentStep > 1 && (
                            <button type="button" onClick={handleBack} disabled={saving}
                                className="px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-all disabled:opacity-50">
                                ← Anterior
                            </button>
                        )}
                        {currentStep < 6 ? (
                            <button type="button" onClick={handleNext}
                                className="ml-auto px-6 py-3 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white font-bold rounded-lg transition-all">
                                Siguiente →
                            </button>
                        ) : (
                            <button type="submit" disabled={saving}
                                className="ml-auto px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-bold rounded-lg transition-all disabled:opacity-50">
                                {saving
                                    ? (isEditing ? 'Guardando...' : 'Creando...')
                                    : (isEditing ? '✅ Actualizar Campeonato' : '✅ Crear Campeonato')}
                            </button>
                        )}
                    </div>
                </form>

                {/* ===================================================== */}
                {/* Modal de Configuración de Circuito                    */}
                {/* ===================================================== */}
                {showTrackModal && trackFormData && (
                    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
                        <div className="bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 rounded-xl border border-white/30 shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto">
                            {/* Header */}
                            <div className="sticky top-0 bg-gradient-to-r from-slate-900 to-blue-900 border-b border-white/20 z-10">
                                <div className="flex justify-between items-center px-6 pt-6 pb-4">
                                    <h3 className="text-2xl font-bold text-white">
                                        {editingTrackIndex !== null ? '✏️ Editar Circuito' : '➕ Agregar Circuito'}
                                    </h3>
                                    <button onClick={handleCloseTrackModal} className="text-white hover:text-red-400 text-3xl transition-colors">×</button>
                                </div>
                                {/* Tabs del modal */}
                                <div className="flex border-t border-white/10">
                                    {[
                                        { id: 'info', label: '📍 Circuito' },
                                        { id: 'qualy', label: '🎯 Qualy' },
                                        { id: 'carrera', label: '⚙️ Carrera' },
                                        { id: 'reglas', label: '🚦 Reglas' },
                                    ].map(tab => (
                                        <button key={tab.id} type="button"
                                            onClick={() => setTrackModalTab(tab.id)}
                                            className={`flex-1 py-3 px-2 text-sm font-medium transition-all border-b-2 ${trackModalTab === tab.id
                                                ? 'border-orange-500 text-orange-400 bg-white/5'
                                                : 'border-transparent text-gray-400 hover:text-white'
                                                }`}>
                                            {tab.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="p-6 space-y-6">
                                {/* Selector de Circuito */}
                                <div className={`bg-white/5 backdrop-blur-sm border border-white/20 rounded-lg p-6 ${trackModalTab !== 'info' ? 'hidden' : ''}`}>
                                    <h4 className="text-xl font-bold text-white mb-4">📍 Información del Circuito</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="md:col-span-2">
                                            <label className="block text-sm font-medium text-gray-300 mb-2">🏁 Seleccionar Circuito *</label>
                                            <select value={trackFormData.name}
                                                onChange={(e) => handleSelectTrack(e.target.value)}
                                                className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500">
                                                <option value="" className="bg-slate-800">Seleccionar circuito...</option>
                                                {firebaseTracks.length > 0 && (
                                                    <optgroup label="🖼️ Circuitos con Imagen" className="bg-slate-800">
                                                        {firebaseTracks.map(track => (
                                                            <option key={track.id} value={track.name} className="bg-slate-800">{track.name} ✨</option>
                                                        ))}
                                                    </optgroup>
                                                )}
                                                {(() => {
                                                    const dbNames = firebaseTracks.map(t => t.name);
                                                    const remaining = GT7_TRACKS.filter(name => !dbNames.includes(name));
                                                    return remaining.length > 0 ? (
                                                        <optgroup label="🎮 Gran Turismo 7" className="bg-slate-800">
                                                            {remaining.map(track => (
                                                                <option key={track} value={track} className="bg-slate-800">{track}</option>
                                                            ))}
                                                        </optgroup>
                                                    ) : null;
                                                })()}
                                            </select>
                                            {trackFormData.name && (
                                                <div className="mt-2 space-y-1">
                                                    <p className="text-xs text-gray-400">
                                                        Circuito seleccionado: <span className="text-white font-medium">{trackFormData.name}</span>
                                                    </p>
                                                    {trackFormData.layoutImage && (
                                                        <p className="text-xs text-green-400 flex items-center gap-1">
                                                            <span>✅</span><span>Tiene imagen de layout en Firebase</span>
                                                        </p>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-300 mb-2">📅 Fecha *</label>
                                            <input type="date" value={trackFormData.date}
                                                onChange={(e) => setTrackFormData(prev => ({ ...prev, date: e.target.value }))}
                                                className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-300 mb-2">#️⃣ Ronda</label>
                                            <input type="number" min="1" value={trackFormData.round}
                                                onChange={(e) => setTrackFormData(prev => ({ ...prev, round: parseInt(e.target.value) || 1 }))}
                                                className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-300 mb-2">🏎️ Categoría *</label>
                                            <select value={trackFormData.category}
                                                onChange={(e) => setTrackFormData(prev => ({ ...prev, category: e.target.value }))}
                                                className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500">
                                                <option value="" className="bg-slate-800">Seleccionar...</option>
                                                {formData.categories.map(cat => (
                                                    <option key={cat} value={cat} className="bg-slate-800">{cat}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                {/* Tipo de Carrera */}
                                <div className={`bg-white/5 backdrop-blur-sm border border-white/20 rounded-lg p-6 ${trackModalTab !== 'info' ? 'hidden' : ''}`}>
                                    <h4 className="text-xl font-bold text-white mb-4">🏁 Tipo de Carrera</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="md:col-span-2">
                                            <label className="block text-sm font-medium text-gray-300 mb-2">Tipo de Carrera *</label>
                                            <select value={trackFormData.raceType}
                                                onChange={(e) => setTrackFormData(prev => ({ ...prev, raceType: e.target.value }))}
                                                className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500">
                                                <option value="carrera">🏁 Carrera - Por número de vueltas</option>
                                                <option value="resistencia">⏱️ Resistencia - Por tiempo determinado</option>
                                                <option value="sprint_carrera">⚡ Sprint + Carrera - Formato dual</option>
                                            </select>
                                        </div>
                                        {trackFormData.raceType === 'carrera' && (
                                            <div className="md:col-span-2">
                                                <label className="block text-sm font-medium text-gray-300 mb-2">🔄 Número de Vueltas *</label>
                                                <input type="number" min="1" value={trackFormData.laps}
                                                    onChange={(e) => setTrackFormData(prev => ({ ...prev, laps: parseInt(e.target.value) || 1 }))}
                                                    className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                                                    placeholder="Ej: 10" />
                                                <p className="text-xs text-gray-400 mt-1">La carrera terminará después de completar este número de vueltas</p>
                                            </div>
                                        )}
                                        {trackFormData.raceType === 'resistencia' && (
                                            <div className="md:col-span-2">
                                                <label className="block text-sm font-medium text-gray-300 mb-2">⏱️ Duración (minutos) *</label>
                                                <input type="number" min="1" value={trackFormData.duration}
                                                    onChange={(e) => setTrackFormData(prev => ({ ...prev, duration: parseInt(e.target.value) || 60 }))}
                                                    className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                                                    placeholder="Ej: 60" />
                                                <p className="text-xs text-gray-400 mt-1">La carrera terminará después de este tiempo (minutos)</p>
                                            </div>
                                        )}
                                        {trackFormData.raceType === 'sprint_carrera' && (
                                            <>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-300 mb-2">⚡ Vueltas Sprint</label>
                                                    <input type="number" min="1" value={trackFormData.sprintLaps || 5}
                                                        onChange={(e) => setTrackFormData(prev => ({ ...prev, sprintLaps: parseInt(e.target.value) || 5 }))}
                                                        className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500" />
                                                    <p className="text-xs text-gray-400 mt-1">Carrera corta con puntuación reducida</p>
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-300 mb-2">🏁 Vueltas Carrera Principal</label>
                                                    <input type="number" min="1" value={trackFormData.laps}
                                                        onChange={(e) => setTrackFormData(prev => ({ ...prev, laps: parseInt(e.target.value) || 10 }))}
                                                        className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500" />
                                                    <p className="text-xs text-gray-400 mt-1">Carrera principal con puntuación completa</p>
                                                </div>
                                                <div className="md:col-span-2 bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <span className="text-purple-400 font-bold text-sm">⚡ Sistema Sprint + Carrera</span>
                                                    </div>
                                                    <p className="text-gray-400 text-xs">
                                                        Sprint: Puntuación reducida (P1={DEFAULT_SPRINT_POINTS[1]}pts, P2={DEFAULT_SPRINT_POINTS[2]}pts...) •
                                                        Carrera: Puntuación completa según el sistema de puntos del campeonato
                                                    </p>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* Configuración de Clasificación (Qualy) */}
                                <div className={`bg-white/5 backdrop-blur-sm border border-white/20 rounded-lg p-6 ${trackModalTab !== 'qualy' ? 'hidden' : ''}`}>
                                    <h4 className="text-xl font-bold text-white mb-1">🎯 Clasificación (Qualy)</h4>
                                    <p className="text-xs text-gray-400 mb-4">Configuración específica para la sesión de clasificación</p>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="flex items-center justify-between bg-white/5 border border-white/10 rounded-lg p-3">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-300">💨 Rebufo (Slipstream)</label>
                                                <p className="text-xs text-gray-400">Efecto de succión entre coches en qualy</p>
                                            </div>
                                            {renderToggle(trackFormData.rules.qualySlipstream ?? false, () =>
                                                handleTrackRuleChange('qualySlipstream', !(trackFormData.rules.qualySlipstream ?? false))
                                            )}
                                        </div>
                                        <div className="flex items-center justify-between bg-white/5 border border-white/10 rounded-lg p-3">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-300">🛞 Desgaste de Neumáticos</label>
                                                <p className="text-xs text-gray-400">Activar desgaste durante la qualy</p>
                                            </div>
                                            {renderToggle(trackFormData.rules.qualyTireWear ?? false, () =>
                                                handleTrackRuleChange('qualyTireWear', !(trackFormData.rules.qualyTireWear ?? false))
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Reglas del Circuito */}
                                <div className={`bg-white/5 backdrop-blur-sm border border-white/20 rounded-lg p-6 ${trackModalTab !== 'carrera' ? 'hidden' : ''}`}>
                                    <h4 className="text-xl font-bold text-white mb-1">⚙️ Reglas de Carrera</h4>
                                    <p className="text-xs text-gray-400 mb-4">Configuración para la sesión de carrera</p>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {/* Rebufo en carrera y combustible inicial */}
                                        <div className="flex items-center justify-between bg-white/5 border border-white/10 rounded-lg p-3">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-300">💨 Rebufo (Slipstream)</label>
                                                <p className="text-xs text-gray-400">Efecto de succión entre coches en carrera</p>
                                            </div>
                                            {renderToggle(trackFormData.rules.raceSlipstream ?? true, () =>
                                                handleTrackRuleChange('raceSlipstream', !(trackFormData.rules.raceSlipstream ?? true))
                                            )}
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-300 mb-2">⛽ Combustible Inicial (%)</label>
                                            <div className="flex items-center gap-2">
                                                <input type="range" min="0" max="100" step="5"
                                                    value={trackFormData.rules.startingFuel ?? 100}
                                                    onChange={(e) => handleTrackRuleChange('startingFuel', parseInt(e.target.value))}
                                                    className="flex-1" />
                                                <span className="text-white font-medium w-12">{trackFormData.rules.startingFuel ?? 100}%</span>
                                            </div>
                                        </div>
                                        {/* Clima y Hora */}
                                        <div>
                                            <label className="block text-sm font-medium text-gray-300 mb-2">🌤️ Clima</label>
                                            {renderSelect(trackFormData.rules.weather, (e) => handleTrackRuleChange('weather', e.target.value), WEATHER_OPTIONS)}
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-300 mb-2">🕐 Hora del Día</label>
                                            {renderSelect(trackFormData.rules.timeOfDay, (e) => handleTrackRuleChange('timeOfDay', e.target.value), TIME_OPTIONS)}
                                        </div>

                                        {/* Fase 5: Climatología avanzada */}
                                        <div>
                                            <label className="block text-sm font-medium text-gray-300 mb-2">⏰ Hora de Inicio</label>
                                            <select value={trackFormData.rules.startTime || ''}
                                                onChange={(e) => handleTrackRuleChange('startTime', e.target.value)}
                                                className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500">
                                                {START_TIME_OPTIONS.map(opt => (
                                                    <option key={opt.value} value={opt.value} className="bg-slate-800">{opt.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-300 mb-2">⏩ Velocidad del Tiempo</label>
                                            <select value={trackFormData.rules.timeMultiplier ?? 1}
                                                onChange={(e) => handleTrackRuleChange('timeMultiplier', parseInt(e.target.value))}
                                                className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500">
                                                {TIME_MULTIPLIER_OPTIONS.map(opt => (
                                                    <option key={opt.value} value={opt.value} className="bg-slate-800">{opt.label}</option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* Slots de clima dinámico */}
                                        {trackFormData.rules.weather === 'variable' && (
                                            <div className="md:col-span-2">
                                                <label className="block text-sm font-medium text-gray-300 mb-3">🌦️ Slots de Clima Dinámico</label>
                                                <p className="text-xs text-gray-400 mb-3">Define cómo cambia el clima durante la carrera</p>
                                                {(trackFormData.rules.weatherSlots || []).map((slot, idx) => (
                                                    <div key={idx} className="flex items-center gap-2 mb-2">
                                                        <span className="text-white text-xs w-8">#{idx + 1}</span>
                                                        <select value={slot.weather}
                                                            onChange={(e) => {
                                                                const slots = [...(trackFormData.rules.weatherSlots || [])];
                                                                slots[idx] = { ...slots[idx], weather: e.target.value };
                                                                handleTrackRuleChange('weatherSlots', slots);
                                                            }}
                                                            className="flex-1 px-3 py-1.5 bg-white/10 border border-white/20 rounded text-white text-sm">
                                                            {WEATHER_CONDITION_OPTIONS.map(o => (
                                                                <option key={o.value} value={o.value} className="bg-slate-800">{o.label}</option>
                                                            ))}
                                                        </select>
                                                        <select value={slot.transition || 'gradual'}
                                                            onChange={(e) => {
                                                                const slots = [...(trackFormData.rules.weatherSlots || [])];
                                                                slots[idx] = { ...slots[idx], transition: e.target.value };
                                                                handleTrackRuleChange('weatherSlots', slots);
                                                            }}
                                                            className="w-36 px-3 py-1.5 bg-white/10 border border-white/20 rounded text-white text-sm">
                                                            {WEATHER_TRANSITION_OPTIONS.map(o => (
                                                                <option key={o.value} value={o.value} className="bg-slate-800">{o.label}</option>
                                                            ))}
                                                        </select>
                                                        <button type="button" onClick={() => {
                                                            const slots = (trackFormData.rules.weatherSlots || []).filter((_, i) => i !== idx);
                                                            handleTrackRuleChange('weatherSlots', slots);
                                                        }} className="text-red-400 hover:text-red-300 text-sm">🗑</button>
                                                    </div>
                                                ))}
                                                <button type="button" onClick={() => {
                                                    const slots = [...(trackFormData.rules.weatherSlots || []), { weather: 'rain', transition: 'gradual' }];
                                                    handleTrackRuleChange('weatherSlots', slots);
                                                }} className="text-sm text-orange-400 hover:text-orange-300 mt-1">
                                                    ➕ Agregar slot de clima
                                                </button>
                                            </div>
                                        )}

                                        {/* Desgastes con sliders */}
                                        <div>
                                            <label className="block text-sm font-medium text-gray-300 mb-2">🛞 Desgaste de Neumáticos</label>
                                            <div className="flex items-center gap-2">
                                                <input type="range" min="0" max="50"
                                                    value={typeof trackFormData.rules.tireWear === 'number' ? trackFormData.rules.tireWear : 5}
                                                    onChange={(e) => handleTrackRuleChange('tireWear', parseInt(e.target.value))}
                                                    className="flex-1" />
                                                <span className="text-white font-medium w-12">x{typeof trackFormData.rules.tireWear === 'number' ? trackFormData.rules.tireWear : trackFormData.rules.tireWear}</span>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-300 mb-2">⛽ Consumo de Combustible</label>
                                            <div className="flex items-center gap-2">
                                                <input type="range" min="0" max="50"
                                                    value={typeof trackFormData.rules.fuelConsumption === 'number' ? trackFormData.rules.fuelConsumption : 1}
                                                    onChange={(e) => handleTrackRuleChange('fuelConsumption', parseInt(e.target.value))}
                                                    className="flex-1" />
                                                <span className="text-white font-medium w-12">x{typeof trackFormData.rules.fuelConsumption === 'number' ? trackFormData.rules.fuelConsumption : trackFormData.rules.fuelConsumption}</span>
                                            </div>
                                        </div>

                                        {/* Recarga de combustible */}
                                        {(typeof trackFormData.rules.fuelConsumption === 'number' ? trackFormData.rules.fuelConsumption > 0 : trackFormData.rules.fuelConsumption === 'yes') && (
                                            <div>
                                                <label className="block text-sm font-medium text-gray-300 mb-2">🚰 Velocidad de Recarga</label>
                                                <div className="flex items-center gap-2">
                                                    <input type="range" min="1" max="20" value={trackFormData.rules.fuelRefillRate || 10}
                                                        onChange={(e) => handleTrackRuleChange('fuelRefillRate', parseInt(e.target.value))}
                                                        className="flex-1" />
                                                    <span className="text-white font-medium w-16">{trackFormData.rules.fuelRefillRate || 10} L/s</span>
                                                </div>
                                            </div>
                                        )}

                                        {/* Pit stops obligatorios */}
                                        <div>
                                            <label className="block text-sm font-medium text-gray-300 mb-2">🛣️ Pit Stops Obligatorios</label>
                                            <input type="number" min="0" max="10"
                                                value={trackFormData.rules.mandatoryPitStops ?? 0}
                                                onChange={(e) => handleTrackRuleChange('mandatoryPitStops', parseInt(e.target.value) || 0)}
                                                className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500" />
                                            <p className="text-xs text-gray-400 mt-1">0 = sin obligación de parada</p>
                                        </div>

                                        {/* Cambio de compuesto obligatorio */}
                                        {(trackFormData.rules.mandatoryPitStops ?? 0) > 0 && (
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-300">🔄 Cambio de Compuesto Obligatorio</label>
                                                    <p className="text-xs text-gray-400">Debe usar al menos 2 compuestos distintos</p>
                                                </div>
                                                {renderToggle(trackFormData.rules.mandatoryCompoundChanges ?? false, () => {
                                                    handleTrackRuleChange('mandatoryCompoundChanges', !(trackFormData.rules.mandatoryCompoundChanges ?? false));
                                                })}
                                            </div>
                                        )}

                                        {/* Neumáticos Obligatorios - Multi-select */}
                                        <div className="md:col-span-2">
                                            <label className="block text-sm font-medium text-gray-300 mb-3">🏁 Neumáticos Obligatorios (puedes seleccionar varios)</label>
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                                {TYRE_OPTIONS.map(tyre => {
                                                    const tyres = trackFormData.rules.mandatoryTyre || [];
                                                    const isSelected = Array.isArray(tyres) ? tyres.includes(tyre.value) : false;
                                                    return (
                                                        <label key={tyre.value}
                                                            className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 cursor-pointer transition-all ${isSelected
                                                                ? 'bg-orange-600/30 border-orange-500 text-white'
                                                                : 'bg-white/5 border-white/20 text-gray-300 hover:bg-white/10'
                                                                }`}>
                                                            <input type="checkbox" checked={isSelected}
                                                                onChange={(e) => {
                                                                    const currentTyres = Array.isArray(tyres) ? tyres : [];
                                                                    const newTyres = e.target.checked
                                                                        ? [...currentTyres, tyre.value]
                                                                        : currentTyres.filter(t => t !== tyre.value);
                                                                    handleTrackRuleChange('mandatoryTyre', newTyres);
                                                                }}
                                                                className="w-4 h-4 rounded border-white/30 bg-white/10 text-orange-600 focus:ring-2 focus:ring-orange-500" />
                                                            <span className="font-medium text-sm">{tyre.label}</span>
                                                        </label>
                                                    );
                                                })}
                                            </div>
                                            <p className="text-xs text-gray-400 mt-2">
                                                {(trackFormData.rules.mandatoryTyre || []).length === 0
                                                    ? 'Sin restricción de neumáticos'
                                                    : `${trackFormData.rules.mandatoryTyre.length} neumático${trackFormData.rules.mandatoryTyre.length !== 1 ? 's' : ''} seleccionado${trackFormData.rules.mandatoryTyre.length !== 1 ? 's' : ''}: ${trackFormData.rules.mandatoryTyre.join(', ')}`}
                                            </p>
                                        </div>

                                        {/* Daños */}
                                        <div>
                                            <label className="block text-sm font-medium text-gray-300 mb-2">🔧 Daños</label>
                                            {renderSelect(trackFormData.rules.mechanicalDamage, (e) => handleTrackRuleChange('mechanicalDamage', e.target.value),
                                                DAMAGE_OPTIONS.map(opt => typeof opt === 'string' ? opt : opt))}
                                        </div>

                                        {/* BOP, Ajustes, Engine Swap, Penalizaciones */}
                                        <div>
                                            <label className="block text-sm font-medium text-gray-300 mb-2">⚖️ Balance de Prestaciones (BoP)</label>
                                            {renderSelect(trackFormData.rules.bop, (e) => handleTrackRuleChange('bop', e.target.value), YES_NO)}
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-300 mb-2">🔧 Ajustes del Vehículo</label>
                                            {renderSelect(trackFormData.rules.adjustments, (e) => handleTrackRuleChange('adjustments', e.target.value), YES_NO)}
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-300 mb-2">🔄 Intercambio de Motor</label>
                                            {renderSelect(trackFormData.rules.engineSwap, (e) => handleTrackRuleChange('engineSwap', e.target.value), YES_NO)}
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-300 mb-2">⚠️ Penalizaciones (General)</label>
                                            {renderSelect(trackFormData.rules.penalties, (e) => handleTrackRuleChange('penalties', e.target.value), YES_NO)}
                                        </div>
                                    </div>
                                </div>

                                {/* Penalizaciones Específicas */}
                                <div className={`bg-white/5 backdrop-blur-sm border border-white/20 rounded-lg p-6 ${trackModalTab !== 'reglas' ? 'hidden' : ''}`}>
                                    <h4 className="text-xl font-bold text-white mb-1">🚦 Penalizaciones Específicas</h4>
                                    <p className="text-xs text-gray-400 mb-4">Configura el comportamiento de cada tipo de penalización en GT7</p>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-300 mb-2">🔀 Penalización por Atajo</label>
                                            {renderSelect(trackFormData.rules.penaltyShortcut ?? 'moderate', (e) => handleTrackRuleChange('penaltyShortcut', e.target.value), PENALTY_SHORTCUT_OPTIONS)}
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-300 mb-2">🧱 Penalización por Contacto con Muro</label>
                                            {renderSelect(trackFormData.rules.penaltyWall ?? 'on', (e) => handleTrackRuleChange('penaltyWall', e.target.value), ON_OFF_OPTIONS)}
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-300 mb-2">🏎️ Penalización por Pisar Línea de Box</label>
                                            {renderSelect(trackFormData.rules.penaltyPitLine ?? 'on', (e) => handleTrackRuleChange('penaltyPitLine', e.target.value), ON_OFF_OPTIONS)}
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-300 mb-2">💥 Penalización por Golpe a Otro Coche</label>
                                            {renderSelect(trackFormData.rules.penaltyCarCollision ?? 'on', (e) => handleTrackRuleChange('penaltyCarCollision', e.target.value), ON_OFF_OPTIONS)}
                                        </div>
                                    </div>
                                </div>

                                {/* Asistencias de Conducción */}
                                <div className={`bg-white/5 backdrop-blur-sm border border-white/20 rounded-lg p-6 ${trackModalTab !== 'reglas' ? 'hidden' : ''}`}>
                                    <h4 className="text-xl font-bold text-white mb-4">🎮 Asistencias de Conducción</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-300 mb-2">ABS (Frenos Antibloqueo)</label>
                                            {renderSelect(trackFormData.rules.abs || trackFormData.rules.drivingAssists?.abs || 'default',
                                                (e) => handleTrackRuleChange('abs', e.target.value), ABS_OPTIONS)}
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-300 mb-2">TCS (Control de Tracción)</label>
                                            {renderSelect(trackFormData.rules.tcs || trackFormData.rules.drivingAssists?.tcs || 'default',
                                                (e) => handleTrackRuleChange('tcs', e.target.value), ASSIST_OPTIONS)}
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-300 mb-2">ASM (Control de Estabilidad)</label>
                                            {renderSelect(trackFormData.rules.asm || trackFormData.rules.drivingAssists?.asm || 'default',
                                                (e) => handleTrackRuleChange('asm', e.target.value), ASSIST_OPTIONS)}
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-300 mb-2">Contravolante</label>
                                            {renderSelect(trackFormData.rules.counterSteering || trackFormData.rules.drivingAssists?.counterSteering || 'default',
                                                (e) => handleTrackRuleChange('counterSteering', e.target.value), ASSIST_OPTIONS)}
                                        </div>
                                    </div>
                                </div>

                                {/* Carros Específicos */}
                                <div className="bg-white/5 backdrop-blur-sm border border-white/20 rounded-lg p-6">
                                    <div className="flex items-center justify-between mb-4">
                                        <div>
                                            <h4 className="text-xl font-bold text-white">🚗 Carros Específicos</h4>
                                            <p className="text-sm text-gray-400">Limita los carros permitidos para este circuito</p>
                                        </div>
                                        {renderToggle(trackFormData.specificCars, () => {
                                            setTrackFormData(prev => ({
                                                ...prev,
                                                specificCars: !prev.specificCars,
                                                allowedCars: !prev.specificCars ? (prev.allowedCars || []) : []
                                            }));
                                        })}
                                    </div>

                                    {trackFormData.specificCars && (
                                        <div className="space-y-3">
                                            <div className="flex gap-2">
                                                <input type="text" placeholder="Nombre del carro (ej: Mazda RX-Vision GT3)"
                                                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddAllowedCar(e.target.value); e.target.value = ''; } }}
                                                    className="flex-1 px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500" />
                                                <button type="button" onClick={(e) => { const input = e.target.previousSibling; handleAddAllowedCar(input.value); input.value = ''; }}
                                                    className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors">
                                                    Agregar
                                                </button>
                                            </div>

                                            {(trackFormData.allowedCars || []).length > 0 && (
                                                <div className="space-y-2">
                                                    <p className="text-sm text-gray-400">{trackFormData.allowedCars.length} carros permitidos:</p>
                                                    <div className="space-y-1">
                                                        {trackFormData.allowedCars.map((car, idx) => (
                                                            <div key={idx} className="flex items-center justify-between bg-white/10 rounded-lg p-3">
                                                                <span className="text-white text-sm">{car}</span>
                                                                <button type="button" onClick={() => handleRemoveAllowedCar(idx)}
                                                                    className="text-red-400 hover:text-red-300 text-sm">🗑️</button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Notas del Circuito */}
                                <div className={`bg-white/5 backdrop-blur-sm border border-white/20 rounded-lg p-6 ${trackModalTab !== 'reglas' ? 'hidden' : ''}`}>
                                    <h4 className="text-xl font-bold text-white mb-4">📝 Notas del Circuito</h4>
                                    <textarea
                                        value={trackFormData.rules?.notes || ''}
                                        onChange={(e) => handleTrackRuleChange('notes', e.target.value)}
                                        rows={4}
                                        placeholder="Reglas especiales, instrucciones adicionales, información relevante para los pilotos..."
                                        className="w-full px-4 py-3 bg-white/10 border border-white/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 resize-y"
                                    />
                                    <p className="text-xs text-gray-400 mt-2">Estas notas serán visibles para todos los pilotos del campeonato</p>
                                </div>
                            </div>

                            {/* Footer del modal */}
                            <div className="sticky bottom-0 bg-gradient-to-r from-slate-900 to-blue-900 p-6 border-t border-white/20">
                                <div className="flex justify-end gap-4">
                                    <button type="button" onClick={handleCloseTrackModal}
                                        className="px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white font-bold rounded-lg transition-all">
                                        Cancelar
                                    </button>
                                    <button type="button" onClick={handleSaveTrack}
                                        className="px-6 py-3 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white font-bold rounded-lg transition-all">
                                        {editingTrackIndex !== null ? '💾 Guardar Cambios' : '➕ Agregar Circuito'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ===================================================== */}
                {/* Modal de Importar Pilotos/Equipos                     */}
                {/* ===================================================== */}
                {showImportModal && (
                    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                        <div className="bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 rounded-xl border border-white/30 shadow-2xl w-full max-w-md">
                            <div className="p-6 border-b border-white/20">
                                <div className="flex justify-between items-center">
                                    <h3 className="text-xl font-bold text-white">📥 Importar {formData.settings.isTeamChampionship ? 'Equipos' : 'Pilotos'}</h3>
                                    <button onClick={() => setShowImportModal(false)} className="text-white hover:text-red-400 text-2xl transition-colors">&times;</button>
                                </div>
                                <p className="text-gray-400 text-sm mt-2">
                                    Selecciona un campeonato del cual importar {formData.settings.isTeamChampionship ? 'equipos y sus pilotos' : 'pilotos'}.
                                    Se agregarán sin duplicar los existentes.
                                </p>
                            </div>
                            <div className="p-6 space-y-3 max-h-80 overflow-y-auto">
                                {championships.filter(c => c.id !== championshipId).map(c => (
                                    <button
                                        key={c.id}
                                        type="button"
                                        onClick={() => handleImportDrivers(c.id)}
                                        className="w-full text-left p-4 bg-white/5 hover:bg-white/10 border border-white/20 rounded-lg transition-all"
                                    >
                                        <div className="text-white font-medium">{c.name}</div>
                                        <div className="text-gray-400 text-sm">
                                            📅 {c.season} • {c.settings?.isTeamChampionship ? '👥 Equipos' : '👤 Individual'}
                                            {c.drivers?.length > 0 && ` • ${c.drivers.length} pilotos`}
                                        </div>
                                    </button>
                                ))}
                                {championships.filter(c => c.id !== championshipId).length === 0 && (
                                    <div className="text-center py-8 text-gray-400">
                                        <div className="text-4xl mb-2">📋</div>
                                        <p>No hay otros campeonatos disponibles</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
