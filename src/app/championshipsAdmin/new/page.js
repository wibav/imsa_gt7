"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { useChampionship } from '../../context/ChampionshipContext';
import { Championship } from '../../models/Championship';
import { FirebaseService } from '../../services/firebaseService';

// Listas de opciones para reglas
const YES_NO = ["SI", "NO"];
const DAMAGE_OPTIONS = ["No", "Leves", "Graves"];
const WEATHER_OPTIONS = [
    { value: "clear", label: "Despejado" },
    { value: "rain", label: "Lluvia" },
    { value: "variable", label: "Variable" }
];
const TIME_OPTIONS = [
    { value: "day", label: "Día" },
    { value: "night", label: "Noche" },
    { value: "dynamic", label: "Dinámico" }
];
const TYRE_OPTIONS = [
    // Regular
    "RD", "RM", "RB",
    // Sport
    "DD", "DM", "DB",
    // Racing
    "CD", "CM", "CB",
    // Wet
    "CI", "CLI",
    // Otros
    "TRR", "NVE"
];

// Pistas comunes de GT7 (principales + ficticias)
const GT7_TRACKS = [
    "Alsace - Village",
    "Autopolis - International",
    "Autopolis - Shortcut",
    "Autódromo de Interlagos",
    "Autodrome Lago Maggiore - GP",
    "Autodrome Lago Maggiore - East",
    "Autodrome Lago Maggiore - West",
    "Barcelona-Catalunya - GP",
    "Barcelona-Catalunya - No Chicane",
    "Bathurst (Mount Panorama)",
    "Blue Moon Bay Speedway",
    "Blue Moon Bay - Infield A",
    "Blue Moon Bay - Infield B",
    "Brands Hatch - GP",
    "Brands Hatch - Indy",
    "Broad Bean Raceway",
    "Circuit de la Sarthe (Le Mans)",
    "Circuit de Spa-Francorchamps",
    "Circuit de Sainte-Croix - A",
    "Circuit de Sainte-Croix - B",
    "Circuit de Sainte-Croix - C",
    "Colorado Springs - Lake",
    "Daytona - Tri-Oval",
    "Daytona - Road Course",
    "Deep Forest Raceway",
    "Dragon Trail - Seaside",
    "Dragon Trail - Gardens",
    "Fishermans Ranch",
    "Goodwood Motor Circuit",
    "Grand Valley - Highway 1",
    "High Speed Ring",
    "Kyoto Driving Park - Miyabi",
    "Kyoto Driving Park - Yamagiwa",
    "Laguna Seca",
    "Lake Louise - Long Track",
    "Lake Louise - Short Track",
    "Lake Louise - Tri-Oval",
    "Michelin Raceway Road Atlanta",
    "Monza",
    "Monza - No Chicane",
    "Northern Isle Speedway",
    "Nürburgring - Nordschleife",
    "Nürburgring - 24h",
    "Nürburgring - GP",
    "Red Bull Ring",
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
    "Watkins Glen",
    "Willow Springs - Big Willow",
    "Willow Springs - Streets of Willow",
    "Willow Springs - Horse Thief Mile"
];

export default function NewChampionship() {
    const router = useRouter();
    const { currentUser, loading: authLoading } = useAuth();
    const { createChampionship, refreshChampionships } = useChampionship();

    const [currentStep, setCurrentStep] = useState(1);
    const [formData, setFormData] = useState(getEmptyFormData());
    const [formErrors, setFormErrors] = useState([]);
    const [saving, setSaving] = useState(false);
    const [bannerFile, setBannerFile] = useState(null);
    const [bannerPreview, setBannerPreview] = useState(null);

    // Estados para el modal de circuitos
    const [showTrackModal, setShowTrackModal] = useState(false);
    const [availableTracks, setAvailableTracks] = useState([]);
    const [editingTrackIndex, setEditingTrackIndex] = useState(null);
    const [trackFormData, setTrackFormData] = useState(getEmptyTrackData());

    // Cargar circuitos disponibles
    useEffect(() => {
        const loadTracks = async () => {
            try {
                const tracks = await FirebaseService.getTracks();
                setAvailableTracks(tracks);
            } catch (error) {
                console.error('Error cargando circuitos:', error);
            }
        };
        loadTracks();
    }, []);

    // Redirigir si no está autenticado
    useEffect(() => {
        if (!authLoading && !currentUser) {
            router.push('/login');
        }
    }, [currentUser, authLoading, router]);

    if (authLoading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 flex items-center justify-center">
                <div className="text-white text-xl">Cargando...</div>
            </div>
        );
    }

    if (!currentUser) {
        return null;
    }

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
            reader.onloadend = () => {
                setBannerPreview(reader.result);
            };
            reader.readAsDataURL(file);
        }
    };

    const handlePointSystemChange = (position, value) => {
        setFormData(prev => ({
            ...prev,
            settings: {
                ...prev.settings,
                pointsSystem: {
                    ...prev.settings.pointsSystem,
                    race: {
                        ...prev.settings.pointsSystem.race,
                        [position]: parseInt(value) || 0
                    }
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
                        positions: {
                            ...prev.settings.pointsSystem.qualifying.positions,
                            [position]: parseInt(value) || 0
                        }
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
                    fastestLap: {
                        ...prev.settings.pointsSystem.fastestLap,
                        enabled: !prev.settings.pointsSystem.fastestLap.enabled
                    }
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
                    qualifying: {
                        ...prev.settings.pointsSystem.qualifying,
                        enabled: !prev.settings.pointsSystem.qualifying.enabled
                    }
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
                    fastestLap: {
                        ...prev.settings.pointsSystem.fastestLap,
                        points: parseInt(value) || 0
                    }
                }
            }
        }));
    };

    // Handlers para circuitos
    const handleOpenTrackModal = (index = null) => {
        if (index !== null) {
            setEditingTrackIndex(index);
            setTrackFormData(formData.tracks[index]);
        } else {
            setEditingTrackIndex(null);
            setTrackFormData(getEmptyTrackData());
        }
        setShowTrackModal(true);
    };

    const handleCloseTrackModal = () => {
        setShowTrackModal(false);
        setEditingTrackIndex(null);
        setTrackFormData(getEmptyTrackData());
    };

    const handleTrackInputChange = (field, value) => {
        setTrackFormData(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const handleTrackRuleChange = (field, value) => {
        setTrackFormData(prev => ({
            ...prev,
            rules: {
                ...prev.rules,
                [field]: value
            }
        }));
    };

    const handleTrackAssistChange = (field, value) => {
        setTrackFormData(prev => ({
            ...prev,
            rules: {
                ...prev.rules,
                drivingAssists: {
                    ...prev.rules.drivingAssists,
                    [field]: value
                }
            }
        }));
    };

    const handleSelectTrack = (track) => {
        setTrackFormData(prev => ({
            ...prev,
            trackId: track.id,
            name: track.name,
            layoutImage: track.layoutImage || ''
        }));
    };

    const handleSaveTrack = () => {
        // Validar campos requeridos
        if (!trackFormData.name || !trackFormData.category || !trackFormData.date) {
            alert('Por favor completa los campos requeridos: Circuito, Categoría y Fecha');
            return;
        }

        const newTracks = [...formData.tracks];
        if (editingTrackIndex !== null) {
            newTracks[editingTrackIndex] = trackFormData;
        } else {
            newTracks.push(trackFormData);
        }

        setFormData(prev => ({
            ...prev,
            tracks: newTracks
        }));

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

    const handleToggleSpecificCars = () => {
        setTrackFormData(prev => ({
            ...prev,
            specificCars: !prev.specificCars,
            allowedCars: !prev.specificCars ? [] : prev.allowedCars
        }));
    };

    const handleAddAllowedCar = (car) => {
        if (car.trim() && !trackFormData.allowedCars.includes(car.trim())) {
            setTrackFormData(prev => ({
                ...prev,
                allowedCars: [...prev.allowedCars, car.trim()]
            }));
        }
    };

    const handleRemoveAllowedCar = (carToRemove) => {
        setTrackFormData(prev => ({
            ...prev,
            allowedCars: prev.allowedCars.filter(car => car !== carToRemove)
        }));
    };

    // Handlers para pilotos individuales
    const handleAddDriver = (name) => {
        if (name && name.trim()) {
            setFormData(prev => ({
                ...prev,
                drivers: [...prev.drivers, {
                    name: name.trim(),
                    category: prev.categories[0] || ''
                }]
            }));
        }
    };

    const handleRemoveDriver = (index) => {
        setFormData(prev => ({
            ...prev,
            drivers: prev.drivers.filter((_, i) => i !== index)
        }));
    };

    // Handlers para equipos
    const handleAddTeam = (name) => {
        if (name && name.trim()) {
            setFormData(prev => ({
                ...prev,
                teams: [...prev.teams, {
                    name: name.trim(),
                    drivers: []
                }]
            }));
        }
    };

    const handleRemoveTeam = (index) => {
        setFormData(prev => ({
            ...prev,
            teams: prev.teams.filter((_, i) => i !== index)
        }));
    };

    const handleAddDriverToTeam = (teamIndex, driverName) => {
        if (driverName && driverName.trim()) {
            setFormData(prev => ({
                ...prev,
                teams: prev.teams.map((team, i) => {
                    if (i === teamIndex) {
                        return {
                            ...team,
                            drivers: [...team.drivers, {
                                name: driverName.trim(),
                                category: prev.categories[0] || ''
                            }]
                        };
                    }
                    return team;
                })
            }));
        }
    };

    const handleRemoveDriverFromTeam = (teamIndex, driverIndex) => {
        setFormData(prev => ({
            ...prev,
            teams: prev.teams.map((team, i) => {
                if (i === teamIndex) {
                    return {
                        ...team,
                        drivers: team.drivers.filter((_, di) => di !== driverIndex)
                    };
                }
                return team;
            })
        }));
    };

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
                // Validar sistema de puntos
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

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Solo procesar submit si estamos en el paso final
        if (currentStep !== 5) return;

        if (!validateStep(currentStep)) return;

        // Prevenir múltiples envíos
        if (saving) return;

        setSaving(true);
        setFormErrors([]);

        try {
            // Subir banner si existe
            let bannerUrl = '';
            if (bannerFile) {
                const fileName = `${Date.now()}_${bannerFile.name}`;
                const filePath = `championships/banners/${fileName}`;
                bannerUrl = await FirebaseService.uploadImage(bannerFile, filePath);
            }

            const championshipData = {
                ...formData,
                banner: bannerUrl,
                startDate: formData.startDate ? new Date(formData.startDate).toISOString() : null,
                endDate: formData.endDate ? new Date(formData.endDate).toISOString() : null,
            };

            // Extraer tracks, teams y drivers del formData antes de crear el campeonato
            const { tracks, teams, drivers, ...championshipWithoutSubcollections } = championshipData;

            const championship = new Championship(championshipWithoutSubcollections);
            const validation = championship.validate();

            if (!validation.isValid) {
                setFormErrors(validation.errors);
                setSaving(false);
                return;
            }

            // Crear campeonato primero
            const result = await createChampionship(championshipWithoutSubcollections);
            const championshipId = result.id;

            // Guardar equipos si es campeonato por equipos
            if (championshipData.settings.isTeamChampionship && teams && teams.length > 0) {
                for (const team of teams) {
                    await FirebaseService.createTeam(championshipId, team);
                }
            }

            // Guardar pilotos individuales si NO es campeonato por equipos
            if (!championshipData.settings.isTeamChampionship && drivers && drivers.length > 0) {
                // Los pilotos individuales se guardan directamente en el documento del campeonato
                await FirebaseService.updateChampionship(championshipId, { drivers });
            }

            // Guardar circuitos como subcolección si existen
            if (tracks && tracks.length > 0) {
                for (const track of tracks) {
                    await FirebaseService.createTrack(championshipId, {
                        ...track,
                        date: new Date(track.date).toISOString(),
                        status: 'upcoming',
                        championshipId
                    });
                }
            }

            await refreshChampionships();
            router.push('/championshipsAdmin');
        } catch (error) {
            setFormErrors([error.message || 'Error al crear el campeonato']);
        } finally {
            setSaving(false);
        }
    };

    const steps = [
        { number: 1, title: 'Información Básica', icon: '📋' },
        { number: 2, title: 'Categorías', icon: '🏎️' },
        { number: 3, title: 'Sistema de Puntos', icon: '🏆' },
        { number: 4, title: 'Configuración', icon: '⚙️' },
        { number: 5, title: 'Finalizar', icon: '✅' }
    ];

    return (
        <div className="p-4 md:p-8">
            <div className="max-w-5xl mx-auto">
                {/* Header */}
                <div className="bg-white/10 backdrop-blur-sm border border-white/30 rounded-lg p-6 mb-6">
                    <div className="flex justify-between items-center">
                        <div>
                            <h1 className="text-3xl font-bold text-white mb-2">
                                🏆 Nuevo Campeonato
                            </h1>
                            <p className="text-gray-300">
                                Completa la información para crear un nuevo campeonato
                            </p>
                        </div>
                        <button
                            onClick={() => router.push('/championshipsAdmin')}
                            className="px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/30 text-white rounded-lg transition-all"
                        >
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
                                        <div className={`text-sm font-medium ${currentStep >= step.number ? 'text-white' : 'text-gray-400'
                                            }`}>
                                            {step.title}
                                        </div>
                                    </div>
                                </div>
                                {index < steps.length - 1 && (
                                    <div className={`h-1 flex-1 mx-2 transition-all ${currentStep > step.number ? 'bg-green-600' : 'bg-white/20'
                                        }`}></div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Errores */}
                {formErrors.length > 0 && (
                    <div className="bg-red-500/20 border border-red-500 text-red-200 px-4 py-3 rounded-lg mb-6">
                        <ul className="list-disc list-inside">
                            {formErrors.map((error, index) => (
                                <li key={index}>{error}</li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* Formulario */}
                <form onSubmit={handleSubmit}>
                    <div className="bg-white/10 backdrop-blur-sm border border-white/30 rounded-lg p-6 mb-6">
                        {/* Step 1: Información Básica */}
                        {currentStep === 1 && (
                            <div className="space-y-6">
                                <h2 className="text-2xl font-bold text-white mb-4">📋 Información Básica</h2>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">
                                            Nombre del Campeonato *
                                        </label>
                                        <input
                                            type="text"
                                            name="name"
                                            value={formData.name}
                                            onChange={handleInputChange}
                                            required
                                            className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
                                            placeholder="IMSA GT7 2025"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">
                                            Nombre Corto * (máx. 10 caracteres)
                                        </label>
                                        <input
                                            type="text"
                                            name="shortName"
                                            value={formData.shortName}
                                            onChange={handleInputChange}
                                            required
                                            maxLength={10}
                                            className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
                                            placeholder="IMSA25"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">
                                        Descripción
                                    </label>
                                    <textarea
                                        name="description"
                                        value={formData.description}
                                        onChange={handleInputChange}
                                        rows={4}
                                        className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
                                        placeholder="Descripción del campeonato..."
                                    />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">
                                            Temporada *
                                        </label>
                                        <input
                                            type="text"
                                            name="season"
                                            value={formData.season}
                                            onChange={handleInputChange}
                                            required
                                            className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
                                            placeholder="2025"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">
                                            Estado *
                                        </label>
                                        <select
                                            name="status"
                                            value={formData.status}
                                            onChange={handleInputChange}
                                            required
                                            className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                                        >
                                            <option value="draft" className="bg-slate-800">📝 Borrador</option>
                                            <option value="active" className="bg-slate-800">🏁 Activo</option>
                                            <option value="completed" className="bg-slate-800">🏆 Completado</option>
                                            <option value="archived" className="bg-slate-800">📦 Archivado</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">
                                            Fecha de Inicio
                                        </label>
                                        <input
                                            type="date"
                                            name="startDate"
                                            value={formData.startDate}
                                            onChange={handleInputChange}
                                            className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">
                                            Fecha de Fin
                                        </label>
                                        <input
                                            type="date"
                                            name="endDate"
                                            value={formData.endDate}
                                            onChange={handleInputChange}
                                            className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">
                                        Banner del Campeonato
                                    </label>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handleBannerChange}
                                        className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-orange-600 file:text-white hover:file:bg-orange-700"
                                    />
                                    {bannerPreview && (
                                        <div className="mt-4">
                                            <img
                                                src={bannerPreview}
                                                alt="Preview"
                                                className="w-full h-48 object-cover rounded-lg border border-white/30"
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Step 2: Categorías */}
                        {currentStep === 2 && (
                            <div className="space-y-6">
                                <h2 className="text-2xl font-bold text-white mb-4">🏎️ Categorías</h2>
                                <p className="text-gray-300 mb-4">
                                    Selecciona las categorías de vehículos que participarán en este campeonato (puedes seleccionar varias)
                                </p>

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {['Gr1', 'Gr2', 'Gr3', 'Gr4', 'GrB', 'Street'].map(category => (
                                        <button
                                            key={category}
                                            type="button"
                                            onClick={() => handleCategoryToggle(category)}
                                            className={`p-8 rounded-xl border-3 transition-all transform hover:scale-105 ${formData.categories.includes(category)
                                                ? 'bg-gradient-to-br from-orange-600 to-red-600 border-orange-400 text-white shadow-lg shadow-orange-500/50'
                                                : 'bg-white/10 border-white/30 text-gray-300 hover:bg-white/20 hover:border-white/50'
                                                }`}
                                        >
                                            <div className="text-6xl mb-4">🏎️</div>
                                            <div className="text-2xl font-bold mb-2">{category}</div>
                                            {formData.categories.includes(category) && (
                                                <div className="mt-2 text-sm bg-white/20 rounded-full px-3 py-1 inline-block">
                                                    ✓ Seleccionada
                                                </div>
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

                        {/* Step 3: Sistema de Puntos */}
                        {currentStep === 3 && (
                            <div className="space-y-6">
                                <h2 className="text-2xl font-bold text-white mb-4">🏆 Sistema de Puntos</h2>
                                <p className="text-gray-300 mb-4">
                                    Configura los puntos que se otorgarán por posición
                                </p>

                                {/* Puntos de Carrera */}
                                <div className="bg-white/5 border border-white/20 rounded-lg p-6">
                                    <h3 className="text-xl font-bold text-white mb-4">🏁 Puntos por Posición en Carrera</h3>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16].map(position => (
                                            <div key={position}>
                                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                                    {position}° Lugar {position <= 3 && ['🥇', '🥈', '🥉'][position - 1]}
                                                </label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={formData.settings.pointsSystem.race[position] || 0}
                                                    onChange={(e) => handlePointSystemChange(position, e.target.value)}
                                                    className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Vuelta Rápida */}
                                <div className="bg-white/5 border border-white/20 rounded-lg p-6">
                                    <div className="flex items-center justify-between mb-4">
                                        <div>
                                            <h3 className="text-xl font-bold text-white">⚡ Vuelta Rápida</h3>
                                            <p className="text-sm text-gray-400">Punto extra por la vuelta más rápida de la carrera</p>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={formData.settings.pointsSystem.fastestLap.enabled}
                                                onChange={handleToggleFastestLap}
                                                className="sr-only peer"
                                            />
                                            <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-600"></div>
                                        </label>
                                    </div>
                                    {formData.settings.pointsSystem.fastestLap.enabled && (
                                        <div className="max-w-xs">
                                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                                Puntos por Vuelta Rápida
                                            </label>
                                            <input
                                                type="number"
                                                min="0"
                                                value={formData.settings.pointsSystem.fastestLap.points}
                                                onChange={(e) => handleFastestLapPointsChange(e.target.value)}
                                                className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                                            />
                                        </div>
                                    )}
                                </div>

                                {/* Qualifying */}
                                <div className="bg-white/5 border border-white/20 rounded-lg p-6">
                                    <div className="flex items-center justify-between mb-4">
                                        <div>
                                            <h3 className="text-xl font-bold text-white">🏎️ Qualifying (Qualy)</h3>
                                            <p className="text-sm text-gray-400">Puntos adicionales por posición en clasificación</p>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={formData.settings.pointsSystem.qualifying.enabled}
                                                onChange={handleToggleQualifying}
                                                className="sr-only peer"
                                            />
                                            <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-600"></div>
                                        </label>
                                    </div>
                                    {formData.settings.pointsSystem.qualifying.enabled && (
                                        <div className="grid grid-cols-3 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                                    1° Lugar 🥇
                                                </label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={formData.settings.pointsSystem.qualifying.positions[1]}
                                                    onChange={(e) => handleQualyPointChange(1, e.target.value)}
                                                    className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                                    2° Lugar 🥈
                                                </label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={formData.settings.pointsSystem.qualifying.positions[2]}
                                                    onChange={(e) => handleQualyPointChange(2, e.target.value)}
                                                    className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                                    3° Lugar 🥉
                                                </label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={formData.settings.pointsSystem.qualifying.positions[3]}
                                                    onChange={(e) => handleQualyPointChange(3, e.target.value)}
                                                    className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Step 4: Configuración */}
                        {currentStep === 4 && (
                            <div className="space-y-6">
                                <h2 className="text-2xl font-bold text-white mb-4">⚙️ Configuración del Campeonato</h2>
                                <p className="text-gray-300 mb-4">
                                    Define el tipo de campeonato y límites de participación
                                </p>

                                <div className="space-y-6">
                                    {/* Tipo de Campeonato */}
                                    <div className="bg-white/5 backdrop-blur-sm border border-white/20 rounded-lg p-6">
                                        <div className="flex items-center justify-between mb-4">
                                            <div>
                                                <h3 className="text-xl font-bold text-white mb-2">🏁 Tipo de Campeonato</h3>
                                                <p className="text-gray-300 text-sm">
                                                    {formData.settings.isTeamChampionship
                                                        ? 'Campeonato por Equipos - Los pilotos compiten representando equipos'
                                                        : 'Campeonato Individual - Los pilotos compiten de forma individual'
                                                    }
                                                </p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={handleToggleTeamMode}
                                                className={`relative inline-flex h-10 w-20 items-center rounded-full transition-colors ${formData.settings.isTeamChampionship
                                                    ? 'bg-orange-600'
                                                    : 'bg-gray-600'
                                                    }`}
                                            >
                                                <span className={`inline-block h-8 w-8 transform rounded-full bg-white transition-transform ${formData.settings.isTeamChampionship
                                                    ? 'translate-x-11'
                                                    : 'translate-x-1'
                                                    }`} />
                                            </button>
                                        </div>

                                        <div className="flex items-center gap-4 text-sm">
                                            <div className={`flex items-center gap-2 ${!formData.settings.isTeamChampionship ? 'text-white font-bold' : 'text-gray-400'}`}>
                                                <span className="text-2xl">👤</span>
                                                <span>Individual</span>
                                            </div>
                                            <div className={`flex items-center gap-2 ${formData.settings.isTeamChampionship ? 'text-white font-bold' : 'text-gray-400'}`}>
                                                <span className="text-2xl">👥</span>
                                                <span>Por Equipos</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Configuración de Equipos (solo si es campeonato por equipos) */}
                                    {formData.settings.isTeamChampionship && (
                                        <div className="bg-white/5 backdrop-blur-sm border border-white/20 rounded-lg p-6">
                                            <h3 className="text-xl font-bold text-white mb-4">👥 Configuración de Equipos</h3>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-300 mb-2">
                                                        Máximo de Equipos
                                                    </label>
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        value={formData.settings.maxTeams}
                                                        onChange={(e) => setFormData(prev => ({
                                                            ...prev,
                                                            settings: {
                                                                ...prev.settings,
                                                                maxTeams: parseInt(e.target.value) || 0
                                                            }
                                                        }))}
                                                        className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                                                        placeholder="0 = Sin límite"
                                                    />
                                                    <p className="text-xs text-gray-400 mt-1">
                                                        Deja en 0 para permitir equipos ilimitados
                                                    </p>
                                                </div>

                                                <div>
                                                    <label className="block text-sm font-medium text-gray-300 mb-2">
                                                        Pilotos por Equipo
                                                    </label>
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        value={formData.settings.maxDriversPerTeam}
                                                        onChange={(e) => setFormData(prev => ({
                                                            ...prev,
                                                            settings: {
                                                                ...prev.settings,
                                                                maxDriversPerTeam: parseInt(e.target.value) || 0
                                                            }
                                                        }))}
                                                        className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                                                        placeholder="0 = Sin límite"
                                                    />
                                                    <p className="text-xs text-gray-400 mt-1">
                                                        Deja en 0 para permitir pilotos ilimitados por equipo
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Gestión de Pilotos/Equipos */}
                                    {formData.settings.isTeamChampionship ? (
                                        <div className="bg-white/5 backdrop-blur-sm border border-white/20 rounded-lg p-6">
                                            <div className="mb-4">
                                                <h3 className="text-xl font-bold text-white mb-2">👥 Equipos y Pilotos</h3>
                                                <p className="text-gray-300 text-sm">
                                                    Agrega los equipos participantes y sus pilotos
                                                </p>
                                            </div>

                                            {/* Formulario para agregar equipo */}
                                            <div className="mb-4">
                                                <div className="flex gap-2">
                                                    <input
                                                        type="text"
                                                        placeholder="Nombre del equipo (ej: Red Bull Racing)"
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') {
                                                                e.preventDefault();
                                                                handleAddTeam(e.target.value);
                                                                e.target.value = '';
                                                            }
                                                        }}
                                                        className="flex-1 px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            const input = e.target.previousSibling;
                                                            handleAddTeam(input.value);
                                                            input.value = '';
                                                        }}
                                                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                                                    >
                                                        + Equipo
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Lista de equipos */}
                                            {formData.teams.length === 0 ? (
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
                                                                    <span>🏁</span>
                                                                    {team.name}
                                                                </h4>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleRemoveTeam(teamIndex)}
                                                                    className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition-colors"
                                                                >
                                                                    Eliminar Equipo
                                                                </button>
                                                            </div>

                                                            {/* Formulario para agregar piloto al equipo */}
                                                            <div className="mb-3 pl-6">
                                                                <div className="flex gap-2">
                                                                    <input
                                                                        type="text"
                                                                        placeholder="Nombre del piloto"
                                                                        onKeyDown={(e) => {
                                                                            if (e.key === 'Enter') {
                                                                                e.preventDefault();
                                                                                handleAddDriverToTeam(teamIndex, e.target.value);
                                                                                e.target.value = '';
                                                                            }
                                                                        }}
                                                                        className="flex-1 px-3 py-2 bg-white/10 border border-white/30 rounded-lg text-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
                                                                    />
                                                                    <button
                                                                        type="button"
                                                                        onClick={(e) => {
                                                                            const input = e.target.previousSibling;
                                                                            handleAddDriverToTeam(teamIndex, input.value);
                                                                            input.value = '';
                                                                        }}
                                                                        className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded transition-colors"
                                                                    >
                                                                        + Piloto
                                                                    </button>
                                                                </div>
                                                            </div>

                                                            {/* Lista de pilotos del equipo */}
                                                            {team.drivers.length === 0 ? (
                                                                <p className="text-gray-400 text-sm pl-6">Sin pilotos asignados</p>
                                                            ) : (
                                                                <div className="space-y-1 pl-6">
                                                                    {team.drivers.map((driver, driverIndex) => (
                                                                        <div key={driverIndex} className="flex items-center justify-between bg-white/5 border border-white/10 rounded p-2">
                                                                            <div className="flex items-center gap-2">
                                                                                <span className="text-lg">🏎️</span>
                                                                                <span className="text-white">{driver.name}</span>
                                                                            </div>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => handleRemoveDriverFromTeam(teamIndex, driverIndex)}
                                                                                className="text-red-400 hover:text-red-300 text-sm"
                                                                            >
                                                                                Eliminar
                                                                            </button>
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
                                        <div className="bg-white/5 backdrop-blur-sm border border-white/20 rounded-lg p-6">
                                            <div className="mb-4">
                                                <h3 className="text-xl font-bold text-white mb-2">🏎️ Pilotos</h3>
                                                <p className="text-gray-300 text-sm">
                                                    Agrega los pilotos que participarán en el campeonato
                                                </p>
                                            </div>

                                            {/* Formulario para agregar piloto */}
                                            <div className="mb-4">
                                                <div className="flex gap-2">
                                                    <input
                                                        type="text"
                                                        placeholder="Nombre del piloto (ej: Max Verstappen)"
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') {
                                                                e.preventDefault();
                                                                handleAddDriver(e.target.value);
                                                                e.target.value = '';
                                                            }
                                                        }}
                                                        className="flex-1 px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            const input = e.target.previousSibling;
                                                            handleAddDriver(input.value);
                                                            input.value = '';
                                                        }}
                                                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                                                    >
                                                        Agregar
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Lista de pilotos */}
                                            {formData.drivers.length === 0 ? (
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
                                                                </div>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleRemoveDriver(index)}
                                                                    className="text-red-400 hover:text-red-300 text-sm"
                                                                >
                                                                    Eliminar
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Circuitos del Campeonato */}
                                    <div className="bg-white/5 backdrop-blur-sm border border-white/20 rounded-lg p-6">
                                        <div className="flex items-center justify-between mb-4">
                                            <div>
                                                <h3 className="text-xl font-bold text-white mb-2">🏁 Circuitos del Campeonato</h3>
                                                <p className="text-gray-300 text-sm">
                                                    Agrega los circuitos que formarán parte de este campeonato
                                                </p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handleOpenTrackModal()}
                                                className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                                            >
                                                <span>+</span>
                                                <span>Agregar Circuito</span>
                                            </button>
                                        </div>

                                        {formData.tracks.length === 0 ? (
                                            <div className="text-center py-8 text-gray-400">
                                                <div className="text-4xl mb-2">🏁</div>
                                                <p>No hay circuitos agregados aún</p>
                                                <p className="text-sm mt-1">Haz clic en &quot;Agregar Circuito&quot; para comenzar</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-3">
                                                {formData.tracks.map((track, index) => (
                                                    <div key={index} className="bg-white/5 border border-white/10 rounded-lg p-4 flex items-center justify-between hover:bg-white/10 transition-colors">
                                                        <div className="flex items-center gap-4 flex-1">
                                                            <div className="text-2xl font-bold text-orange-500">
                                                                R{track.round}
                                                            </div>
                                                            <div className="flex-1">
                                                                <h4 className="text-white font-bold">{track.name}</h4>
                                                                <div className="flex items-center gap-4 text-sm text-gray-400 mt-1">
                                                                    <span>📅 {new Date(track.date).toLocaleDateString('es-ES')}</span>
                                                                    <span className="px-2 py-0.5 bg-orange-600/30 text-orange-300 rounded">
                                                                        {track.category}
                                                                    </span>
                                                                    {track.raceType === 'carrera' ? (
                                                                        <span>🏁 {track.laps} vueltas</span>
                                                                    ) : (
                                                                        <span>⏱️ {track.duration} min</span>
                                                                    )}
                                                                    {track.specificCars && (
                                                                        <span className="text-blue-400">🚗 {track.allowedCars.length} carros específicos</span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleOpenTrackModal(index)}
                                                                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm transition-colors"
                                                            >
                                                                Editar
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleDeleteTrack(index)}
                                                                className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-sm transition-colors"
                                                            >
                                                                Eliminar
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Step 5: Resumen */}
                        {currentStep === 5 && (
                            <div className="space-y-6">
                                <h2 className="text-2xl font-bold text-white mb-4">✅ Resumen del Campeonato</h2>
                                <p className="text-gray-300 mb-6">
                                    Revisa la información antes de crear el campeonato
                                </p>

                                <div className="space-y-4">
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

                                    <div className="bg-white/5 border border-white/20 rounded-lg p-4">
                                        <h3 className="text-white font-medium mb-2">🏎️ Categorías</h3>
                                        <div className="flex flex-wrap gap-2">
                                            {formData.categories.map(cat => (
                                                <span key={cat} className="px-3 py-1 bg-orange-600 text-white rounded-full text-sm">
                                                    {cat}
                                                </span>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="bg-white/5 border border-white/20 rounded-lg p-4">
                                        <h3 className="text-white font-medium mb-2">🏆 Sistema de Puntos</h3>
                                        <div className="space-y-3">
                                            <div>
                                                <p className="text-sm text-gray-400 mb-2">Puntos por Carrera (Top 8):</p>
                                                <div className="grid grid-cols-4 gap-2 text-sm">
                                                    {Object.entries(formData.settings.pointsSystem.race)
                                                        .slice(0, 8)
                                                        .map(([pos, points]) => (
                                                            <div key={pos} className="text-gray-300">
                                                                {pos}°: <span className="text-white font-medium">{points} pts</span>
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
                                                    <p className="text-sm text-gray-400 mb-1">🏎️ Qualifying:</p>
                                                    <div className="flex gap-4 text-sm">
                                                        <span className="text-gray-300">1°: <span className="text-white font-medium">{formData.settings.pointsSystem.qualifying.positions[1]} pts</span></span>
                                                        <span className="text-gray-300">2°: <span className="text-white font-medium">{formData.settings.pointsSystem.qualifying.positions[2]} pts</span></span>
                                                        <span className="text-gray-300">3°: <span className="text-white font-medium">{formData.settings.pointsSystem.qualifying.positions[3]} pts</span></span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>

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

                                    <div className="bg-white/5 border border-white/20 rounded-lg p-4">
                                        <h3 className="text-white font-medium mb-2">🏁 Circuitos ({formData.tracks.length})</h3>
                                        {formData.tracks.length === 0 ? (
                                            <p className="text-sm text-gray-400">No se han agregado circuitos</p>
                                        ) : (
                                            <div className="space-y-2">
                                                {formData.tracks.map((track, idx) => (
                                                    <div key={idx} className="bg-white/5 border border-white/10 rounded p-3 text-sm">
                                                        <div className="flex items-center gap-3 mb-2">
                                                            <span className="text-orange-500 font-bold text-lg">R{track.round}</span>
                                                            <div className="flex-1">
                                                                <div className="text-white font-medium">{track.name}</div>
                                                                <div className="text-gray-400 text-xs">
                                                                    📅 {new Date(track.date).toLocaleDateString('es-ES')} •
                                                                    🏎️ {track.category} •
                                                                    {track.raceType === 'carrera' ? (
                                                                        <span>🏁 {track.laps} vueltas</span>
                                                                    ) : (
                                                                        <span>⏱️ {track.duration} min</span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-2 text-xs text-gray-400 pl-8">
                                                            <div>🌤️ {track.rules.weather === 'clear' ? 'Despejado' : track.rules.weather === 'rain' ? 'Lluvia' : 'Variable'}</div>
                                                            <div>🕐 {track.rules.timeOfDay === 'day' ? 'Día' : track.rules.timeOfDay === 'night' ? 'Noche' : 'Dinámico'}</div>
                                                            <div>🛞 Desgaste x{track.rules.tireWear}</div>
                                                            <div>⛽ Consumo x{track.rules.fuelConsumption}</div>
                                                            <div>🔧 Daños: {track.rules.mechanicalDamage}</div>
                                                            <div>⚖️ BOP: {track.rules.bop}</div>
                                                            {track.rules.mandatoryTyre && <div>🏁 Neumático: {track.rules.mandatoryTyre}</div>}
                                                            {track.specificCars && <div className="col-span-2 text-blue-400">🚗 {track.allowedCars.length} carros específicos</div>}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Navegación */}
                    <div className="flex justify-between gap-4">
                        {currentStep > 1 && (
                            <button
                                type="button"
                                onClick={handleBack}
                                disabled={saving}
                                className="px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-all disabled:opacity-50"
                            >
                                ← Anterior
                            </button>
                        )}

                        {currentStep < 5 ? (
                            <button
                                type="button"
                                onClick={handleNext}
                                className="ml-auto px-6 py-3 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white font-bold rounded-lg transition-all"
                            >
                                Siguiente →
                            </button>
                        ) : (
                            <button
                                type="submit"
                                disabled={saving}
                                className="ml-auto px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-bold rounded-lg transition-all disabled:opacity-50"
                            >
                                {saving ? 'Creando...' : '✅ Crear Campeonato'}
                            </button>
                        )}
                    </div>
                </form>
            </div>

            {/* Modal de Configuración de Circuito */}
            {showTrackModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
                    <div className="bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 rounded-xl border border-white/20 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="sticky top-0 bg-slate-900/95 backdrop-blur-sm border-b border-white/20 p-6 flex items-center justify-between">
                            <h2 className="text-2xl font-bold text-white">
                                {editingTrackIndex !== null ? '✏️ Editar Circuito' : '➕ Agregar Circuito'}
                            </h2>
                            <button
                                onClick={handleCloseTrackModal}
                                className="text-gray-400 hover:text-white transition-colors"
                            >
                                <span className="text-2xl">×</span>
                            </button>
                        </div>

                        <div className="p-6 space-y-6">
                            {/* Selector de Circuito */}
                            <div className="bg-white/5 backdrop-blur-sm border border-white/20 rounded-lg p-4">
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    🏁 Seleccionar Circuito *
                                </label>
                                <select
                                    value={trackFormData.name}
                                    onChange={(e) => {
                                        handleTrackInputChange('name', e.target.value);
                                        // Buscar en la DB primero (tiene imágenes)
                                        const dbTrack = availableTracks.find(t => t.name === e.target.value);
                                        if (dbTrack) {
                                            handleTrackInputChange('trackId', dbTrack.id);
                                            handleTrackInputChange('layoutImage', dbTrack.layoutImage || '');
                                        } else {
                                            // Si no está en DB, limpiar campos opcionales
                                            handleTrackInputChange('trackId', '');
                                            handleTrackInputChange('layoutImage', '');
                                        }
                                    }}
                                    className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                                >
                                    <option value="">Seleccionar circuito...</option>

                                    {/* Circuitos de Firebase (con imágenes) */}
                                    {availableTracks.length > 0 && (
                                        <optgroup label="🖼️ Circuitos con Imagen">
                                            {availableTracks.map(track => (
                                                <option key={track.id} value={track.name}>
                                                    {track.name} ✨
                                                </option>
                                            ))}
                                        </optgroup>
                                    )}

                                    {/* Circuitos de GT7 que NO están en Firebase */}
                                    {(() => {
                                        const dbTrackNames = availableTracks.map(t => t.name);
                                        const remainingTracks = GT7_TRACKS.filter(name => !dbTrackNames.includes(name));

                                        if (remainingTracks.length > 0) {
                                            return (
                                                <optgroup label="🏁 Otros Circuitos de GT7">
                                                    {remainingTracks.map(track => (
                                                        <option key={track} value={track}>
                                                            {track}
                                                        </option>
                                                    ))}
                                                </optgroup>
                                            );
                                        }
                                        return null;
                                    })()}
                                </select>
                                {trackFormData.name && (
                                    <div className="mt-2 space-y-1">
                                        <p className="text-xs text-gray-400">
                                            Circuito seleccionado: <span className="text-white font-medium">{trackFormData.name}</span>
                                        </p>
                                        {trackFormData.layoutImage && (
                                            <p className="text-xs text-green-400 flex items-center gap-1">
                                                <span>✅</span>
                                                <span>Tiene imagen de layout en Firebase</span>
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Información Básica */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">
                                        📅 Fecha *
                                    </label>
                                    <input
                                        type="date"
                                        value={trackFormData.date}
                                        onChange={(e) => handleTrackInputChange('date', e.target.value)}
                                        className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">
                                        #️⃣ Ronda
                                    </label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={trackFormData.round}
                                        onChange={(e) => handleTrackInputChange('round', parseInt(e.target.value) || 1)}
                                        className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">
                                        🏎️ Categoría *
                                    </label>
                                    <select
                                        value={trackFormData.category}
                                        onChange={(e) => handleTrackInputChange('category', e.target.value)}
                                        className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                                    >
                                        <option value="">Seleccionar...</option>
                                        {formData.categories.map(cat => (
                                            <option key={cat} value={cat}>{cat}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Tipo de Carrera y Duración */}
                            <div className="bg-white/5 backdrop-blur-sm border border-white/20 rounded-lg p-4 space-y-4">
                                <h3 className="text-lg font-bold text-white">🏁 Tipo de Carrera</h3>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-gray-300 mb-2">
                                            Tipo de Carrera *
                                        </label>
                                        <select
                                            value={trackFormData.raceType}
                                            onChange={(e) => handleTrackInputChange('raceType', e.target.value)}
                                            className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                                        >
                                            <option value="carrera">🏁 Carrera - Por número de vueltas</option>
                                            <option value="resistencia">⏱️ Resistencia - Por tiempo determinado</option>
                                        </select>
                                    </div>

                                    {trackFormData.raceType === 'carrera' ? (
                                        <div className="md:col-span-2">
                                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                                🔄 Número de Vueltas *
                                            </label>
                                            <input
                                                type="number"
                                                min="1"
                                                value={trackFormData.laps}
                                                onChange={(e) => handleTrackInputChange('laps', parseInt(e.target.value) || 1)}
                                                className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                                                placeholder="Ej: 10"
                                            />
                                            <p className="text-xs text-gray-400 mt-1">
                                                La carrera terminará después de completar este número de vueltas
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="md:col-span-2">
                                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                                ⏱️ Duración (minutos) *
                                            </label>
                                            <input
                                                type="number"
                                                min="1"
                                                value={trackFormData.duration}
                                                onChange={(e) => handleTrackInputChange('duration', parseInt(e.target.value) || 60)}
                                                className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                                                placeholder="Ej: 60"
                                            />
                                            <p className="text-xs text-gray-400 mt-1">
                                                La carrera terminará después de este tiempo (minutos)
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Reglas del Circuito */}
                            <div className="bg-white/5 backdrop-blur-sm border border-white/20 rounded-lg p-4 space-y-4">
                                <h3 className="text-lg font-bold text-white">⚙️ Reglas del Circuito</h3>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Clima y Hora */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">
                                            🌤️ Clima
                                        </label>
                                        <select
                                            value={trackFormData.rules.weather}
                                            onChange={(e) => handleTrackRuleChange('weather', e.target.value)}
                                            className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                                        >
                                            {WEATHER_OPTIONS.map(opt => (
                                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">
                                            🕐 Hora del Día
                                        </label>
                                        <select
                                            value={trackFormData.rules.timeOfDay}
                                            onChange={(e) => handleTrackRuleChange('timeOfDay', e.target.value)}
                                            className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                                        >
                                            {TIME_OPTIONS.map(opt => (
                                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Desgastes */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">
                                            🛞 Desgaste de Neumáticos
                                        </label>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="range"
                                                min="0"
                                                max="50"
                                                value={trackFormData.rules.tireWear}
                                                onChange={(e) => handleTrackRuleChange('tireWear', parseInt(e.target.value))}
                                                className="flex-1"
                                            />
                                            <span className="text-white font-medium w-12">x{trackFormData.rules.tireWear}</span>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">
                                            ⛽ Consumo de Combustible
                                        </label>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="range"
                                                min="0"
                                                max="50"
                                                value={trackFormData.rules.fuelConsumption}
                                                onChange={(e) => handleTrackRuleChange('fuelConsumption', parseInt(e.target.value))}
                                                className="flex-1"
                                            />
                                            <span className="text-white font-medium w-12">x{trackFormData.rules.fuelConsumption}</span>
                                        </div>
                                    </div>

                                    {/* Recarga de combustible (solo si hay consumo) */}
                                    {trackFormData.rules.fuelConsumption > 0 && (
                                        <div>
                                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                                🚰 Velocidad de Recarga
                                            </label>
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="range"
                                                    min="1"
                                                    max="20"
                                                    value={trackFormData.rules.fuelRefillRate}
                                                    onChange={(e) => handleTrackRuleChange('fuelRefillRate', parseInt(e.target.value))}
                                                    className="flex-1"
                                                />
                                                <span className="text-white font-medium w-16">{trackFormData.rules.fuelRefillRate} L/s</span>
                                            </div>
                                        </div>
                                    )}

                                    {/* Neumáticos Obligatorios (múltiple selección) */}
                                    <div className="md:col-span-3">
                                        <label className="block text-sm font-medium text-gray-300 mb-3">
                                            🏁 Neumáticos Obligatorios (puedes seleccionar varios)
                                        </label>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                            {TYRE_OPTIONS.map(tyre => (
                                                <label
                                                    key={tyre}
                                                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 cursor-pointer transition-all ${trackFormData.rules.mandatoryTyre.includes(tyre)
                                                        ? 'bg-orange-600/30 border-orange-500 text-white'
                                                        : 'bg-white/5 border-white/20 text-gray-300 hover:bg-white/10'
                                                        }`}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={trackFormData.rules.mandatoryTyre.includes(tyre)}
                                                        onChange={(e) => {
                                                            const currentTyres = trackFormData.rules.mandatoryTyre || [];
                                                            const newTyres = e.target.checked
                                                                ? [...currentTyres, tyre]
                                                                : currentTyres.filter(t => t !== tyre);
                                                            handleTrackRuleChange('mandatoryTyre', newTyres);
                                                        }}
                                                        className="w-4 h-4 rounded border-white/30 bg-white/10 text-orange-600 focus:ring-2 focus:ring-orange-500"
                                                    />
                                                    <span className="font-medium">{tyre}</span>
                                                </label>
                                            ))}
                                        </div>
                                        <p className="text-xs text-gray-400 mt-2">
                                            {trackFormData.rules.mandatoryTyre.length === 0
                                                ? 'Sin restricción de neumáticos'
                                                : `${trackFormData.rules.mandatoryTyre.length} neumático${trackFormData.rules.mandatoryTyre.length !== 1 ? 's' : ''} seleccionado${trackFormData.rules.mandatoryTyre.length !== 1 ? 's' : ''}: ${trackFormData.rules.mandatoryTyre.join(', ')}`
                                            }
                                        </p>
                                    </div>

                                    {/* Daños */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">
                                            🔧 Daños
                                        </label>
                                        <select
                                            value={trackFormData.rules.mechanicalDamage}
                                            onChange={(e) => handleTrackRuleChange('mechanicalDamage', e.target.value)}
                                            className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                                        >
                                            {DAMAGE_OPTIONS.map(opt => (
                                                <option key={opt} value={opt}>{opt}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* BOP, Ajustes, Engine Swap */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">
                                            ⚖️ BOP
                                        </label>
                                        <select
                                            value={trackFormData.rules.bop}
                                            onChange={(e) => handleTrackRuleChange('bop', e.target.value)}
                                            className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                                        >
                                            {YES_NO.map(opt => (
                                                <option key={opt} value={opt}>{opt}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">
                                            🔧 Ajustes
                                        </label>
                                        <select
                                            value={trackFormData.rules.adjustments}
                                            onChange={(e) => handleTrackRuleChange('adjustments', e.target.value)}
                                            className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                                        >
                                            {YES_NO.map(opt => (
                                                <option key={opt} value={opt}>{opt}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">
                                            � Swap de Motor
                                        </label>
                                        <select
                                            value={trackFormData.rules.engineSwap}
                                            onChange={(e) => handleTrackRuleChange('engineSwap', e.target.value)}
                                            className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                                        >
                                            {YES_NO.map(opt => (
                                                <option key={opt} value={opt}>{opt}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">
                                            ⚠️ Penalizaciones
                                        </label>
                                        <select
                                            value={trackFormData.rules.penalties}
                                            onChange={(e) => handleTrackRuleChange('penalties', e.target.value)}
                                            className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                                        >
                                            {YES_NO.map(opt => (
                                                <option key={opt} value={opt}>{opt}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {/* Asistencias de Conducción */}
                                <div className="pt-4 border-t border-white/10">
                                    <h4 className="text-md font-bold text-white mb-3">🎮 Asistencias de Conducción</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-300 mb-2">ABS</label>
                                            <select
                                                value={trackFormData.rules.drivingAssists.abs}
                                                onChange={(e) => handleTrackAssistChange('abs', e.target.value)}
                                                className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                                            >
                                                <option value="default">Predeterminado</option>
                                                <option value="off">Desactivado</option>
                                                <option value="weak">Débil</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-300 mb-2">Control de Tracción (TCS)</label>
                                            <select
                                                value={trackFormData.rules.drivingAssists.tcs}
                                                onChange={(e) => handleTrackAssistChange('tcs', e.target.value)}
                                                className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                                            >
                                                <option value="default">Predeterminado</option>
                                                <option value="off">Desactivado</option>
                                                <option value="on">Activado</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-300 mb-2">ASM (Estabilidad)</label>
                                            <select
                                                value={trackFormData.rules.drivingAssists.asm}
                                                onChange={(e) => handleTrackAssistChange('asm', e.target.value)}
                                                className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                                            >
                                                <option value="default">Predeterminado</option>
                                                <option value="off">Desactivado</option>
                                                <option value="on">Activado</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-300 mb-2">Contravolante</label>
                                            <select
                                                value={trackFormData.rules.drivingAssists.counterSteering}
                                                onChange={(e) => handleTrackAssistChange('counterSteering', e.target.value)}
                                                className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                                            >
                                                <option value="default">Predeterminado</option>
                                                <option value="off">Desactivado</option>
                                                <option value="on">Activado</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Carros Específicos */}
                            <div className="bg-white/5 backdrop-blur-sm border border-white/20 rounded-lg p-4">
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <h3 className="text-lg font-bold text-white">🚗 Carros Específicos</h3>
                                        <p className="text-sm text-gray-400">Limita los carros permitidos para este circuito</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleToggleSpecificCars}
                                        className={`relative inline-flex h-8 w-16 items-center rounded-full transition-colors ${trackFormData.specificCars ? 'bg-orange-600' : 'bg-gray-600'}`}
                                    >
                                        <span className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${trackFormData.specificCars ? 'translate-x-9' : 'translate-x-1'}`} />
                                    </button>
                                </div>

                                {trackFormData.specificCars && (
                                    <div className="space-y-3">
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                placeholder="Nombre del carro (ej: Mazda RX-Vision GT3)"
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        handleAddAllowedCar(e.target.value);
                                                        e.target.value = '';
                                                    }
                                                }}
                                                className="flex-1 px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                                            />
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    const input = e.target.previousSibling;
                                                    handleAddAllowedCar(input.value);
                                                    input.value = '';
                                                }}
                                                className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors"
                                            >
                                                Agregar
                                            </button>
                                        </div>

                                        {trackFormData.allowedCars.length > 0 && (
                                            <div className="space-y-2">
                                                <p className="text-sm text-gray-400">{trackFormData.allowedCars.length} carros permitidos:</p>
                                                <div className="space-y-1">
                                                    {trackFormData.allowedCars.map((car, idx) => (
                                                        <div key={idx} className="flex items-center justify-between bg-white/5 border border-white/10 rounded px-3 py-2">
                                                            <span className="text-white text-sm">{car}</span>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleRemoveAllowedCar(car)}
                                                                className="text-red-400 hover:text-red-300 text-sm"
                                                            >
                                                                Eliminar
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Botones del Modal */}
                            <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/20">
                                <button
                                    type="button"
                                    onClick={handleCloseTrackModal}
                                    className="px-6 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSaveTrack}
                                    className="px-6 py-2 bg-orange-600 hover:bg-orange-700 text-white font-medium rounded-lg transition-colors"
                                >
                                    {editingTrackIndex !== null ? 'Guardar Cambios' : 'Agregar Circuito'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

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
                fastestLap: {
                    enabled: false,
                    points: 1
                },
                qualifying: {
                    enabled: false,
                    positions: {
                        1: 5,
                        2: 3,
                        3: 1
                    }
                }
            },
            isTeamChampionship: false,
            maxTeams: 0,
            maxDriversPerTeam: 0
        },
        teams: [], // Array de equipos con pilotos
        drivers: [], // Array de pilotos individuales (solo si no es por equipos)
        tracks: []
    };
}

function getEmptyTrackData() {
    return {
        trackId: '',
        name: '',
        layoutImage: '',
        date: '',
        round: 1,
        category: '',
        raceType: 'carrera', // 'carrera' o 'resistencia'
        laps: 10, // Solo para tipo 'carrera'
        duration: 60, // Solo para tipo 'resistencia' (en minutos)
        rules: {
            weather: 'clear',
            timeOfDay: 'day',
            fuelConsumption: 1,
            tireWear: 5, // x5 como en EventsAdmin
            mechanicalDamage: 'Graves',
            visualDamage: true,
            bop: 'SI',
            adjustments: 'NO',
            engineSwap: 'NO',
            penalties: 'SI',
            fuelRefillRate: 10, // L/s
            mandatoryTyre: [], // Array de neumáticos obligatorios
            drivingAssists: {
                abs: 'default',
                asm: 'default',
                tcs: 'default',
                counterSteering: 'default',
                brakeZone: false
            }
        },
        specificCars: false,
        allowedCars: []
    };
}
