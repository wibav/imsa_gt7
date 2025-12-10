"use client";

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { useChampionship } from '../../context/ChampionshipContext';
import { Championship } from '../../models/Championship';
import { FirebaseService } from '../../services/firebaseService';

// Constantes para las reglas de los circuitos
const YES_NO = [
    { value: 'yes', label: 'Sí' },
    { value: 'no', label: 'No' }
];

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
    { value: "RD", label: "RD - Duros" },
    { value: "RM", label: "RM - Medios" },
    { value: "RB", label: "RB - Blandos" },
    // Sport
    { value: "DD", label: "DD - Sport Duros" },
    { value: "DM", label: "DM - Sport Medios" },
    { value: "DB", label: "DB - Sport Blandos" },
    // Racing
    { value: "CD", label: "CD - Racing Duros" },
    { value: "CM", label: "CM - Racing Medios" },
    { value: "CB", label: "CB - Racing Blandos" },
    // Wet
    { value: "CI", label: "CI - Intermedios" },
    { value: "CLI", label: "CLI - Lluvia" },
    // Otros
    { value: "TRR", label: "TRR - Tierra/Rally" },
    { value: "NVE", label: "NVE - Nieve" }
];

// Lista completa de circuitos de Gran Turismo 7
const GT7_TRACKS = [
    "Alsace - Village", "Autodrome Lago Maggiore - GP", "Autodrome Lago Maggiore - East", "Autodrome Lago Maggiore - West",
    "Autopolis - International Racing Course", "Barcelona - Circuit de Catalunya", "BB Raceway",
    "Blue Moon Bay Speedway - Infield A", "Blue Moon Bay Speedway - Infield B", "Blue Moon Bay Speedway",
    "Brands Hatch - GP Circuit", "Brands Hatch - Indy Circuit", "Broad Bean Raceway",
    "Circuit de Sainte-Croix - A", "Circuit de Sainte-Croix - B", "Circuit de Sainte-Croix - C",
    "Circuit de Spa-Francorchamps", "Colorado Springs - Lake", "Colorado Springs - Club",
    "Daytona International Speedway - Road Course", "Daytona International Speedway - Oval",
    "Deep Forest Raceway", "Dragon Trail - Seaside", "Dragon Trail - Gardens",
    "Fishermans Ranch", "Fuji International Speedway", "Grand Valley - Highway 1",
    "Grand Valley - South", "Grand Valley - East", "Goodwood Motor Circuit",
    "Circuit Gilles Villeneuve", "Yas Marina Circuit",
    "High Speed Ring", "Horse Thief Mile", "Interlagos",
    "Kyoto Driving Park - Yamagiwa", "Kyoto Driving Park - Miyabi", "Lake Louise",
    "La Sarthe - Circuit de 24 Heures du Mans", "La Sarthe - Circuit de 24 Heures du Mans (No Chicane)",
    "Laguna Seca - Weathertech Raceway", "Le Mans - Circuit Bugatti",
    "Monza - Circuit", "Mount Panorama - Bathurst", "Nürburgring - 24h Layout",
    "Nürburgring - GP", "Nürburgring - Nordschleife", "Northern Isle Speedway",
    "Red Bull Ring - GP", "Red Bull Ring - Short Track", "Road Atlanta",
    "Sardegna - Road Track A", "Sardegna - Road Track B", "Sardegna - Road Track C",
    "Sardegna - Windmills", "Special Stage Route X", "Suzuka Circuit",
    "Tokyo Expressway - East", "Tokyo Expressway - Central", "Tokyo Expressway - South",
    "Trial Mountain Circuit", "Tsukuba Circuit", "Watkins Glen International - Short Course",
    "Watkins Glen International - Full Course", "Weathertech Raceway - Laguna Seca",
    "Willow Springs - Big Willow", "Willow Springs - Streets of Willow", "Willow Springs - Horse Thief Mile"
];

export default function EditChampionship() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const championshipId = searchParams.get("id");
    const { currentUser, loading: authLoading } = useAuth();
    const { championships, updateChampionship, refreshChampionships } = useChampionship();

    const [championship, setChampionship] = useState(null);
    const [currentStep, setCurrentStep] = useState(1);
    const [formData, setFormData] = useState(null);
    const [formErrors, setFormErrors] = useState([]);
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);
    const [bannerFile, setBannerFile] = useState(null);
    const [bannerPreview, setBannerPreview] = useState(null);

    // Estados para circuitos
    const [loadingTracks, setLoadingTracks] = useState(true);
    const [firebaseTracks, setFirebaseTracks] = useState([]);
    const [showTrackModal, setShowTrackModal] = useState(false);
    const [editingTrackIndex, setEditingTrackIndex] = useState(null);
    const [trackFormData, setTrackFormData] = useState(null);

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

    // Cargar circuitos del campeonato
    useEffect(() => {
        const loadChampionshipTracks = async () => {
            if (!championshipId || !championship) return;

            try {
                setLoadingTracks(true);
                const tracksData = await FirebaseService.getTracksByChampionship(championshipId);
                // Actualizar formData con tracks si ya existe
                setFormData(prev => prev ? { ...prev, tracks: tracksData } : null);
            } catch (error) {
                console.error('Error loading championship tracks:', error);
            } finally {
                setLoadingTracks(false);
            }
        };

        loadChampionshipTracks();
    }, [championshipId, championship]);

    // Cargar datos del campeonato
    useEffect(() => {
        const loadChampionshipData = async () => {
            if (!authLoading && !currentUser) {
                router.push('/login');
                return;
            }

            if (championships.length > 0) {
                const champ = championships.find(c => c.id === championshipId);
                if (champ) {
                    setChampionship(champ);

                    console.log('📊 Campeonato encontrado:', champ.name);
                    console.log('🔍 isTeamChampionship en Firebase:', champ.settings?.isTeamChampionship);
                    console.log('🔍 teams en documento:', champ.teams);
                    console.log('🔍 drivers en documento:', champ.drivers);

                    // SIEMPRE cargar teams desde la subcolección, sin importar el flag
                    // porque puede estar mal configurado en campeonatos antiguos
                    let teamsData = [];
                    try {
                        teamsData = await FirebaseService.getTeamsByChampionship(championshipId);
                        console.log('👥 Teams cargados desde subcolección Firebase:', teamsData.length, 'equipos');
                        if (teamsData.length > 0) {
                            console.log('👥 Primer equipo:', teamsData[0]);
                        }
                    } catch (error) {
                        console.error('❌ Error cargando teams:', error);
                    }

                    // Determinar si es campeonato por equipos basándose en la data real
                    const hasTeams = teamsData.length > 0;
                    const isTeamChamp = hasTeams || champ.settings?.isTeamChampionship || false;

                    console.log('🎯 Decisión final: isTeamChampionship =', isTeamChamp);
                    console.log('🎯 Razón: hasTeams =', hasTeams, '|| flag =', champ.settings?.isTeamChampionship);

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
                                ? champ.settings.pointsSystem // Nueva estructura
                                : { // Convertir estructura antigua o crear nueva
                                    race: champ.settings?.pointsSystem || {
                                        1: 25, 2: 22, 3: 20, 4: 18, 5: 16, 6: 14, 7: 12, 8: 10,
                                        9: 9, 10: 8, 11: 7, 12: 6, 13: 5, 14: 4, 15: 3, 16: 2
                                    },
                                    fastestLap: {
                                        enabled: false,
                                        points: 1
                                    },
                                    qualifying: {
                                        enabled: false,
                                        positions: { 1: 5, 2: 3, 3: 1 }
                                    }
                                },
                            isTeamChampionship: isTeamChamp,
                            maxTeams: champ.settings?.maxTeams || (hasTeams ? 4 : 0),
                            maxDriversPerTeam: champ.settings?.maxDriversPerTeam || (hasTeams ? 4 : 0)
                        },
                        teams: teamsData.length > 0 ? teamsData : (champ.teams || []),
                        drivers: champ.drivers || [],
                        tracks: [] // Se cargará en useEffect separado
                    });

                    console.log('✅ FormData configurado con', teamsData.length, 'teams');
                    setBannerPreview(champ.banner);
                    setLoading(false);
                } else {
                    router.push('/championshipsAdmin');
                }
            }
        };

        loadChampionshipData();
    }, [championships, championshipId, currentUser, authLoading, router]);

    if (authLoading || loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 flex items-center justify-center">
                <div className="text-white text-xl">Cargando...</div>
            </div>
        );
    }

    if (!currentUser || !formData) {
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
    const getEmptyTrackData = () => ({
        name: '',
        date: '',
        round: (formData?.tracks?.length || 0) + 1,
        category: formData?.categories?.[0] || '',
        raceType: 'carrera', // 'carrera' o 'resistencia'
        laps: 10, // Solo para tipo 'carrera'
        duration: 60, // Solo para tipo 'resistencia' (en minutos)
        rules: {
            weather: 'fixed',
            timeOfDay: 'fixed',
            tireWear: 'yes',
            fuelConsumption: 'yes',
            fuelRefillRate: 1,
            mandatoryTyre: [], // Array de neumáticos obligatorios
            mechanicalDamage: 'none',
            bop: 'yes',
            adjustments: 'no',
            engineSwap: 'no',
            penalties: 'yes',
            abs: 'default',
            tcs: 'no',
            asm: 'no',
            counterSteering: 'no'
        },
        specificCars: false,
        allowedCars: []
    });

    const handleOpenTrackModal = (index = null) => {
        if (index !== null) {
            setEditingTrackIndex(index);
            setTrackFormData({ ...formData.tracks[index] });
        } else {
            setEditingTrackIndex(null);
            setTrackFormData(getEmptyTrackData());
        }
        setShowTrackModal(true);
    };

    const handleCloseTrackModal = () => {
        setShowTrackModal(false);
        setEditingTrackIndex(null);
        setTrackFormData(null);
    };

    const handleSelectTrack = (trackName) => {
        const selectedTrack = firebaseTracks.find(t => t.name === trackName);
        if (selectedTrack) {
            setTrackFormData(prev => ({
                ...prev,
                name: trackName,
                layoutImage: selectedTrack.layoutImage || ''
            }));
        } else {
            setTrackFormData(prev => ({
                ...prev,
                name: trackName,
                layoutImage: ''
            }));
        }
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

    const handleAddAllowedCar = () => {
        const carName = prompt('Ingrese el nombre del carro:');
        if (carName && carName.trim()) {
            setTrackFormData(prev => ({
                ...prev,
                allowedCars: [...(prev.allowedCars || []), carName.trim()]
            }));
        }
    };

    const handleRemoveAllowedCar = (index) => {
        setTrackFormData(prev => ({
            ...prev,
            allowedCars: prev.allowedCars.filter((_, i) => i !== index)
        }));
    };

    // Handlers para pilotos individuales
    const handleAddDriver = (name) => {
        if (name && name.trim()) {
            setFormData(prev => ({
                ...prev,
                drivers: [...(prev.drivers || []), {
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
                teams: [...(prev.teams || []), {
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
            let bannerUrl = formData.banner;

            // Subir nuevo banner si existe
            if (bannerFile) {
                const fileName = `${Date.now()}_${bannerFile.name}`;
                const path = `championships/${championshipId}/banners/${fileName}`;
                bannerUrl = await FirebaseService.uploadImage(bannerFile, path);
            }

            const championshipData = {
                ...formData,
                banner: bannerUrl,
                startDate: formData.startDate ? new Date(formData.startDate).toISOString() : null,
                endDate: formData.endDate ? new Date(formData.endDate).toISOString() : null,
            };

            const updatedChampionship = new Championship(championshipData);
            const validation = updatedChampionship.validate();

            if (!validation.isValid) {
                setFormErrors(validation.errors);
                setSaving(false);
                return;
            }

            // Extraer teams y tracks antes de actualizar (los drivers SÍ se incluyen en el documento)
            const { teams: teamsData, tracks: tracksData, ...championshipDataToSave } = championshipData;

            console.log('🔍 OBJETO COMPLETO ANTES DE ENVIAR A FIREBASE:');
            console.log('championshipDataToSave:', JSON.stringify(championshipDataToSave, null, 2));
            console.log('Drivers específicamente:', championshipDataToSave.drivers);
            console.log('Teams extraídos:', teamsData);
            console.log('Tracks extraídos:', tracksData?.length || 0);
            console.log('isTeamChampionship:', championshipData.settings.isTeamChampionship);

            // Actualizar campeonato (incluye drivers si es individual)
            await updateChampionship(championshipId, championshipDataToSave);

            // Manejar equipos si es campeonato por equipos
            if (championshipData.settings.isTeamChampionship) {
                // Eliminar equipos existentes
                const existingTeams = await FirebaseService.getTeamsByChampionship(championshipId);
                for (const team of existingTeams) {
                    if (team && team.id) {
                        try {
                            await FirebaseService.deleteTeam(championshipId, team.id);
                        } catch (error) {
                            console.error('Error deleting team:', team.id, error);
                        }
                    }
                }

                // Crear equipos nuevos
                if (teamsData && teamsData.length > 0) {
                    for (const team of teamsData) {
                        const { id, ...cleanTeamData } = team;
                        await FirebaseService.createTeam(championshipId, cleanTeamData);
                    }
                }
            }

            // Eliminar todos los circuitos existentes de Firestore
            const existingTracks = await FirebaseService.getTracksByChampionship(championshipId);
            console.log('📍 Tracks existentes en Firebase:', existingTracks.length);

            // Analizar duplicados
            const trackNames = existingTracks.map(t => t.name);
            const trackIds = existingTracks.map(t => t.id);
            const duplicateNames = trackNames.filter((name, index) => trackNames.indexOf(name) !== index);
            const duplicateIds = trackIds.filter((id, index) => trackIds.indexOf(id) !== index);

            if (duplicateNames.length > 0) {
                console.warn('⚠️ TRACKS DUPLICADOS POR NOMBRE:', [...new Set(duplicateNames)]);
            }
            if (duplicateIds.length > 0) {
                console.warn('⚠️ TRACKS CON IDS DUPLICADOS:', duplicateIds);
            }

            // Listar todos los tracks con sus IDs
            console.log('📋 Lista completa de tracks:');
            existingTracks.forEach((track, index) => {
                console.log(`  ${index + 1}. ID: ${track.id} | Name: ${track.name} | Round: ${track.round}`);
            });

            // Usar Set para evitar duplicados por ID
            const uniqueTrackIds = new Set();
            let deletedCount = 0;
            let skippedCount = 0;

            for (const track of existingTracks) {
                // Solo eliminar si tiene un ID válido y no lo hemos procesado antes
                if (track && track.id && typeof track.id === 'string') {
                    if (!uniqueTrackIds.has(track.id)) {
                        uniqueTrackIds.add(track.id);
                        try {
                            console.log(`❌ Eliminando [${deletedCount + 1}/${existingTracks.length}]:`, track.id, track.name);
                            await FirebaseService.deleteTrack(championshipId, track.id);
                            deletedCount++;
                        } catch (error) {
                            console.error('❌ Error eliminando track:', track.id, error);
                        }
                    } else {
                        skippedCount++;
                        console.log(`⏭️ Skipped duplicado:`, track.id, track.name);
                    }
                } else {
                    skippedCount++;
                    console.warn('⚠️ Track sin ID válido:', track);
                }
            }

            console.log(`✅ Resumen eliminación: ${deletedCount} eliminados, ${skippedCount} omitidos, ${uniqueTrackIds.size} IDs únicos`);

            // Crear todos los circuitos del estado actual
            console.log('🏎️ Creando', tracksData?.length || 0, 'nuevos tracks');

            if (tracksData && tracksData.length > 0) {
                for (const trackData of tracksData) {
                    try {
                        // Limpiar el ID si existe (para evitar conflictos)
                        const { id, ...cleanTrackData } = trackData;
                        console.log('➕ Creando track:', cleanTrackData.name, 'Round:', cleanTrackData.round);
                        await FirebaseService.createTrack(championshipId, cleanTrackData);
                    } catch (error) {
                        console.error('Error creating track:', trackData.name, error);
                        throw error;
                    }
                }
            }

            await refreshChampionships();
            router.push('/championshipsAdmin');
        } catch (error) {
            setFormErrors([error.message || 'Error al actualizar el campeonato']);
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
                                ✏️ Editar Campeonato
                            </h1>
                            <p className="text-gray-300">
                                {championship?.name}
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

                {/* Formulario - Reutilizando los mismos steps que en new */}
                <form onSubmit={handleSubmit}>
                    <div className="bg-white/10 backdrop-blur-sm border border-white/30 rounded-lg p-6 mb-6">
                        {/* Los mismos steps que en la página new - copio el contenido */}
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

                        {/* Copiar los demás steps de new/page.js - Step 2, 3, 4, 5 */}
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
                            </div>
                        )}

                        {currentStep === 3 && (
                            <div className="space-y-6">
                                <h2 className="text-2xl font-bold text-white mb-4">🏆 Sistema de Puntos</h2>
                                <p className="text-gray-300 mb-4">
                                    Configura los puntos que se otorgarán por posición y opciones adicionales
                                </p>

                                {/* Puntos de Carrera */}
                                <div className="bg-white/5 backdrop-blur-sm border border-white/20 rounded-lg p-6">
                                    <h3 className="text-xl font-bold text-white mb-4">🏁 Puntos de Carrera</h3>
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
                                <div className="bg-white/5 backdrop-blur-sm border border-white/20 rounded-lg p-6">
                                    <div className="flex items-center justify-between mb-4">
                                        <div>
                                            <h3 className="text-xl font-bold text-white mb-2">⚡ Vuelta Rápida</h3>
                                            <p className="text-gray-300 text-sm">Puntos extra por marcar la vuelta más rápida de la carrera</p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={handleToggleFastestLap}
                                            className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${formData.settings.pointsSystem.fastestLap.enabled
                                                ? 'bg-green-600'
                                                : 'bg-gray-600'
                                                }`}
                                        >
                                            <span className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${formData.settings.pointsSystem.fastestLap.enabled
                                                ? 'translate-x-7'
                                                : 'translate-x-1'
                                                }`} />
                                        </button>
                                    </div>

                                    {formData.settings.pointsSystem.fastestLap.enabled && (
                                        <div className="mt-4">
                                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                                Puntos por Vuelta Rápida
                                            </label>
                                            <input
                                                type="number"
                                                min="0"
                                                value={formData.settings.pointsSystem.fastestLap.points}
                                                onChange={(e) => handleFastestLapPointsChange(e.target.value)}
                                                className="w-full md:w-48 px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                                            />
                                        </div>
                                    )}
                                </div>

                                {/* Clasificación (Qualy) */}
                                <div className="bg-white/5 backdrop-blur-sm border border-white/20 rounded-lg p-6">
                                    <div className="flex items-center justify-between mb-4">
                                        <div>
                                            <h3 className="text-xl font-bold text-white mb-2">🎯 Clasificación (Qualy)</h3>
                                            <p className="text-gray-300 text-sm">Puntos extra por posición en clasificación</p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={handleToggleQualifying}
                                            className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${formData.settings.pointsSystem.qualifying.enabled
                                                ? 'bg-green-600'
                                                : 'bg-gray-600'
                                                }`}
                                        >
                                            <span className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${formData.settings.pointsSystem.qualifying.enabled
                                                ? 'translate-x-7'
                                                : 'translate-x-1'
                                                }`} />
                                        </button>
                                    </div>

                                    {formData.settings.pointsSystem.qualifying.enabled && (
                                        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                                            {[1, 2, 3].map(position => (
                                                <div key={position}>
                                                    <label className="block text-sm font-medium text-gray-300 mb-2">
                                                        {position}° Lugar {['🥇', '🥈', '🥉'][position - 1]}
                                                    </label>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        value={formData.settings.pointsSystem.qualifying.positions[position] || 0}
                                                        onChange={(e) => handleQualyPointChange(position, e.target.value)}
                                                        className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

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
                                                            {(!team.drivers || team.drivers.length === 0) ? (
                                                                <p className="text-gray-400 text-sm pl-6">Sin pilotos asignados</p>
                                                            ) : (
                                                                <div className="space-y-1 pl-6">
                                                                    {team.drivers.map((driver, driverIndex) => (
                                                                        <div key={driverIndex} className="flex items-center justify-between bg-white/5 border border-white/10 rounded p-2">
                                                                            <div className="flex items-center gap-2">
                                                                                <span className="text-lg">🏎️</span>
                                                                                <span className="text-white">{driver.name}</span>
                                                                                <span className="px-2 py-0.5 bg-orange-600/30 text-orange-300 rounded text-xs">
                                                                                    {driver.category}
                                                                                </span>
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
                                                                    <span className="px-2 py-0.5 bg-orange-600/30 text-orange-300 rounded text-xs">
                                                                        {driver.category}
                                                                    </span>
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
                                        <div className="flex justify-between items-center mb-4">
                                            <div>
                                                <h3 className="text-xl font-bold text-white mb-2">🏁 Circuitos del Campeonato</h3>
                                                <p className="text-gray-300 text-sm">Configura los circuitos que formarán parte del campeonato</p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handleOpenTrackModal()}
                                                className="px-4 py-2 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white font-bold rounded-lg transition-all"
                                            >
                                                ➕ Agregar Circuito
                                            </button>
                                        </div>

                                        {loadingTracks ? (
                                            <div className="text-center text-gray-400 py-8">
                                                Cargando circuitos...
                                            </div>
                                        ) : formData.tracks.length === 0 ? (
                                            <div className="text-center text-gray-400 py-8">
                                                No hay circuitos configurados. Haz clic en &quot;Agregar Circuito&quot; para comenzar.
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
                                                                    <span className="px-2 py-1 bg-blue-600 text-white text-xs rounded-full">
                                                                        {track.category}
                                                                    </span>
                                                                </div>
                                                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm text-gray-300">
                                                                    <div>📅 {new Date(track.date).toLocaleDateString()}</div>
                                                                    <div>
                                                                        {track.raceType === 'carrera' ? (
                                                                            <>🏁 {track.laps} vueltas</>
                                                                        ) : (
                                                                            <>⏱️ {track.duration} min</>
                                                                        )}
                                                                    </div>
                                                                    <div>🌤️ {track.rules.weather}</div>
                                                                    <div>⚙️ BoP: {track.rules.bop}</div>
                                                                </div>
                                                            </div>
                                                            <div className="flex gap-2">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleOpenTrackModal(index)}
                                                                    className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-all"
                                                                >
                                                                    ✏️ Editar
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleDeleteTrack(index)}
                                                                    className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition-all"
                                                                >
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

                        {currentStep === 5 && (
                            <div className="space-y-6">
                                <h2 className="text-2xl font-bold text-white mb-4">✅ Resumen de Cambios</h2>
                                <p className="text-gray-300 mb-6">
                                    Revisa los cambios antes de actualizar
                                </p>

                                <div className="space-y-4">
                                    <div className="bg-white/5 border border-white/20 rounded-lg p-4">
                                        <h3 className="text-white font-medium mb-2">📋 Información Básica</h3>
                                        <div className="grid grid-cols-2 gap-2 text-sm">
                                            <div className="text-gray-400">Nombre:</div>
                                            <div className="text-white">{formData.name}</div>
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

                                        <div className="mb-4">
                                            <h4 className="text-white text-sm font-medium mb-2">Puntos de Carrera:</h4>
                                            <div className="grid grid-cols-4 md:grid-cols-8 gap-2 text-sm">
                                                {[1, 2, 3, 4, 5, 6, 7, 8].map(position => (
                                                    <div key={position} className="text-gray-400">
                                                        {position}°: <span className="text-white">{formData.settings.pointsSystem.race[position]}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {formData.settings.pointsSystem.fastestLap.enabled && (
                                            <div className="mb-4">
                                                <h4 className="text-white text-sm font-medium mb-2">⚡ Vuelta Rápida:</h4>
                                                <div className="text-sm">
                                                    <span className="text-gray-400">Puntos extra: </span>
                                                    <span className="text-white">+{formData.settings.pointsSystem.fastestLap.points}</span>
                                                </div>
                                            </div>
                                        )}

                                        {formData.settings.pointsSystem.qualifying.enabled && (
                                            <div>
                                                <h4 className="text-white text-sm font-medium mb-2">🎯 Clasificación:</h4>
                                                <div className="grid grid-cols-3 gap-2 text-sm">
                                                    {[1, 2, 3].map(position => (
                                                        <div key={position} className="text-gray-400">
                                                            {position}°: <span className="text-white">{formData.settings.pointsSystem.qualifying.positions[position]}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
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

                                    {/* Circuitos */}
                                    <div className="bg-white/5 border border-white/20 rounded-lg p-4">
                                        <h3 className="text-white font-medium mb-2">🏁 Circuitos</h3>
                                        {formData.tracks.length === 0 ? (
                                            <p className="text-gray-400 text-sm">No hay circuitos configurados</p>
                                        ) : (
                                            <div className="space-y-2">
                                                {formData.tracks.map((track, index) => (
                                                    <div key={index} className="bg-white/5 border border-white/10 rounded p-3">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className="text-orange-500 font-bold">#{track.round}</span>
                                                            <span className="text-white font-medium">{track.name}</span>
                                                            <span className="px-2 py-0.5 bg-blue-600 text-white text-xs rounded">
                                                                {track.category}
                                                            </span>
                                                        </div>
                                                        <div className="text-xs text-gray-400">
                                                            📅 {new Date(track.date).toLocaleDateString()} •
                                                            {track.raceType === 'carrera' ? ` ${track.laps} vueltas` : ` ${track.duration} min`}
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
                                {saving ? 'Guardando...' : '✅ Actualizar Campeonato'}
                            </button>
                        )}
                    </div>
                </form>

                {/* Modal de Configuración de Circuito */}
                {showTrackModal && trackFormData && (
                    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
                        <div className="bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 rounded-xl border border-white/30 shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-y-auto">
                            <div className="sticky top-0 bg-gradient-to-r from-slate-900 to-blue-900 p-6 border-b border-white/20 z-10">
                                <div className="flex justify-between items-center">
                                    <h3 className="text-2xl font-bold text-white">
                                        {editingTrackIndex !== null ? '✏️ Editar Circuito' : '➕ Agregar Circuito'}
                                    </h3>
                                    <button
                                        onClick={handleCloseTrackModal}
                                        className="text-white hover:text-red-400 text-3xl transition-colors"
                                    >
                                        ×
                                    </button>
                                </div>
                            </div>

                            <div className="p-6 space-y-6">
                                {/* Información Básica */}
                                <div className="bg-white/5 backdrop-blur-sm border border-white/20 rounded-lg p-6">
                                    <h4 className="text-xl font-bold text-white mb-4">📍 Información del Circuito</h4>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="md:col-span-2">
                                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                                Circuito *
                                            </label>
                                            <select
                                                value={trackFormData.name}
                                                onChange={(e) => handleSelectTrack(e.target.value)}
                                                required
                                                className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                                            >
                                                <option value="" className="bg-slate-800">Seleccionar circuito...</option>
                                                {firebaseTracks.length > 0 && (
                                                    <optgroup label="🏁 Circuitos con Imágenes" className="bg-slate-800">
                                                        {firebaseTracks.map(track => (
                                                            <option key={track.id} value={track.name} className="bg-slate-800">
                                                                {track.name}
                                                            </option>
                                                        ))}
                                                    </optgroup>
                                                )}
                                                <optgroup label="🎮 Gran Turismo 7" className="bg-slate-800">
                                                    {GT7_TRACKS.map(track => (
                                                        <option key={track} value={track} className="bg-slate-800">
                                                            {track}
                                                        </option>
                                                    ))}
                                                </optgroup>
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                                Fecha *
                                            </label>
                                            <input
                                                type="date"
                                                value={trackFormData.date}
                                                onChange={(e) => setTrackFormData(prev => ({ ...prev, date: e.target.value }))}
                                                required
                                                className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                                Ronda
                                            </label>
                                            <input
                                                type="number"
                                                min="1"
                                                value={trackFormData.round}
                                                onChange={(e) => setTrackFormData(prev => ({ ...prev, round: parseInt(e.target.value) || 1 }))}
                                                className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                                Categoría *
                                            </label>
                                            <select
                                                value={trackFormData.category}
                                                onChange={(e) => setTrackFormData(prev => ({ ...prev, category: e.target.value }))}
                                                required
                                                className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                                            >
                                                {formData.categories.map(cat => (
                                                    <option key={cat} value={cat} className="bg-slate-800">{cat}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                {/* Tipo de Carrera y Duración */}
                                <div className="bg-white/5 backdrop-blur-sm border border-white/20 rounded-lg p-6">
                                    <h4 className="text-xl font-bold text-white mb-4">🏁 Tipo de Carrera</h4>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="md:col-span-2">
                                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                                Tipo de Carrera *
                                            </label>
                                            <select
                                                value={trackFormData.raceType}
                                                onChange={(e) => setTrackFormData(prev => ({ ...prev, raceType: e.target.value }))}
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
                                                    onChange={(e) => setTrackFormData(prev => ({ ...prev, laps: parseInt(e.target.value) || 1 }))}
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
                                                    onChange={(e) => setTrackFormData(prev => ({ ...prev, duration: parseInt(e.target.value) || 60 }))}
                                                    className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                                                    placeholder="Ej: 60"
                                                />
                                                <p className="text-xs text-gray-400 mt-1">
                                                    La carrera terminará después de este tiempo (minutos)
                                                </p>
                                            </div>
                                        )}

                                        <div>
                                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                                Clima
                                            </label>
                                            <select
                                                value={trackFormData.rules.weather}
                                                onChange={(e) => handleTrackRuleChange('weather', e.target.value)}
                                                className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                                            >
                                                {WEATHER_OPTIONS.map(opt => (
                                                    <option key={opt.value} value={opt.value} className="bg-slate-800">{opt.label}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                                Hora del Día
                                            </label>
                                            <select
                                                value={trackFormData.rules.timeOfDay}
                                                onChange={(e) => handleTrackRuleChange('timeOfDay', e.target.value)}
                                                className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                                            >
                                                {TIME_OPTIONS.map(opt => (
                                                    <option key={opt.value} value={opt.value} className="bg-slate-800">{opt.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                {/* Reglas de Juego */}
                                <div className="bg-white/5 backdrop-blur-sm border border-white/20 rounded-lg p-6">
                                    <h4 className="text-xl font-bold text-white mb-4">⚙️ Reglas de Juego</h4>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                                Desgaste de Neumáticos
                                            </label>
                                            <select
                                                value={trackFormData.rules.tireWear}
                                                onChange={(e) => handleTrackRuleChange('tireWear', e.target.value)}
                                                className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                                            >
                                                {YES_NO.map(opt => (
                                                    <option key={opt.value} value={opt.value} className="bg-slate-800">{opt.label}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                                Consumo de Combustible
                                            </label>
                                            <select
                                                value={trackFormData.rules.fuelConsumption}
                                                onChange={(e) => handleTrackRuleChange('fuelConsumption', e.target.value)}
                                                className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                                            >
                                                {YES_NO.map(opt => (
                                                    <option key={opt.value} value={opt.value} className="bg-slate-800">{opt.label}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                                Tasa de Recarga de Combustible
                                            </label>
                                            <input
                                                type="number"
                                                min="1"
                                                max="10"
                                                value={trackFormData.rules.fuelRefillRate}
                                                onChange={(e) => handleTrackRuleChange('fuelRefillRate', parseInt(e.target.value) || 1)}
                                                className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                                Neumático Obligatorio
                                            </label>
                                            <select
                                                value={trackFormData.rules.mandatoryTyre}
                                                onChange={(e) => handleTrackRuleChange('mandatoryTyre', e.target.value)}
                                                className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                                            >
                                                {TYRE_OPTIONS.map(opt => (
                                                    <option key={opt.value} value={opt.value} className="bg-slate-800">{opt.label}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                                Daño Mecánico
                                            </label>
                                            <select
                                                value={trackFormData.rules.mechanicalDamage}
                                                onChange={(e) => handleTrackRuleChange('mechanicalDamage', e.target.value)}
                                                className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                                            >
                                                {DAMAGE_OPTIONS.map(opt => (
                                                    <option key={opt.value} value={opt.value} className="bg-slate-800">{opt.label}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                                Balance de Prestaciones (BoP)
                                            </label>
                                            <select
                                                value={trackFormData.rules.bop}
                                                onChange={(e) => handleTrackRuleChange('bop', e.target.value)}
                                                className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                                            >
                                                {YES_NO.map(opt => (
                                                    <option key={opt.value} value={opt.value} className="bg-slate-800">{opt.label}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                                Ajustes del Vehículo
                                            </label>
                                            <select
                                                value={trackFormData.rules.adjustments}
                                                onChange={(e) => handleTrackRuleChange('adjustments', e.target.value)}
                                                className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                                            >
                                                {YES_NO.map(opt => (
                                                    <option key={opt.value} value={opt.value} className="bg-slate-800">{opt.label}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                                Intercambio de Motor
                                            </label>
                                            <select
                                                value={trackFormData.rules.engineSwap}
                                                onChange={(e) => handleTrackRuleChange('engineSwap', e.target.value)}
                                                className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                                            >
                                                {YES_NO.map(opt => (
                                                    <option key={opt.value} value={opt.value} className="bg-slate-800">{opt.label}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                                Penalizaciones
                                            </label>
                                            <select
                                                value={trackFormData.rules.penalties}
                                                onChange={(e) => handleTrackRuleChange('penalties', e.target.value)}
                                                className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                                            >
                                                {YES_NO.map(opt => (
                                                    <option key={opt.value} value={opt.value} className="bg-slate-800">{opt.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                {/* Asistencias */}
                                <div className="bg-white/5 backdrop-blur-sm border border-white/20 rounded-lg p-6">
                                    <h4 className="text-xl font-bold text-white mb-4">🎮 Asistencias de Conducción</h4>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                                ABS (Frenos Antibloqueo)
                                            </label>
                                            <select
                                                value={trackFormData.rules.abs}
                                                onChange={(e) => handleTrackRuleChange('abs', e.target.value)}
                                                className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                                            >
                                                <option value="default" className="bg-slate-800">Por defecto</option>
                                                <option value="no" className="bg-slate-800">Desactivado</option>
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                                TCS (Control de Tracción)
                                            </label>
                                            <select
                                                value={trackFormData.rules.tcs}
                                                onChange={(e) => handleTrackRuleChange('tcs', e.target.value)}
                                                className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                                            >
                                                {YES_NO.map(opt => (
                                                    <option key={opt.value} value={opt.value} className="bg-slate-800">{opt.label}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                                ASM (Control de Estabilidad)
                                            </label>
                                            <select
                                                value={trackFormData.rules.asm}
                                                onChange={(e) => handleTrackRuleChange('asm', e.target.value)}
                                                className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                                            >
                                                {YES_NO.map(opt => (
                                                    <option key={opt.value} value={opt.value} className="bg-slate-800">{opt.label}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                                Contravolante
                                            </label>
                                            <select
                                                value={trackFormData.rules.counterSteering}
                                                onChange={(e) => handleTrackRuleChange('counterSteering', e.target.value)}
                                                className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                                            >
                                                {YES_NO.map(opt => (
                                                    <option key={opt.value} value={opt.value} className="bg-slate-800">{opt.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                {/* Restricción de Carros */}
                                <div className="bg-white/5 backdrop-blur-sm border border-white/20 rounded-lg p-6">
                                    <h4 className="text-xl font-bold text-white mb-4">🚗 Restricción de Vehículos</h4>

                                    <div className="flex items-center gap-4 mb-4">
                                        <label className="flex items-center gap-2 text-white cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={trackFormData.specificCars}
                                                onChange={(e) => setTrackFormData(prev => ({
                                                    ...prev,
                                                    specificCars: e.target.checked,
                                                    allowedCars: e.target.checked ? prev.allowedCars : []
                                                }))}
                                                className="w-5 h-5 rounded border-white/30 bg-white/10 text-orange-600 focus:ring-2 focus:ring-orange-500"
                                            />
                                            <span>Habilitar restricción de vehículos específicos</span>
                                        </label>
                                    </div>

                                    {trackFormData.specificCars && (
                                        <div>
                                            <div className="flex justify-between items-center mb-3">
                                                <label className="block text-sm font-medium text-gray-300">
                                                    Vehículos Permitidos
                                                </label>
                                                <button
                                                    type="button"
                                                    onClick={handleAddAllowedCar}
                                                    className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg transition-all"
                                                >
                                                    ➕ Agregar Vehículo
                                                </button>
                                            </div>

                                            {trackFormData.allowedCars && trackFormData.allowedCars.length > 0 ? (
                                                <div className="space-y-2">
                                                    {trackFormData.allowedCars.map((car, index) => (
                                                        <div key={index} className="flex items-center justify-between bg-white/10 rounded-lg p-3">
                                                            <span className="text-white">{car}</span>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleRemoveAllowedCar(index)}
                                                                className="text-red-400 hover:text-red-300 transition-colors"
                                                            >
                                                                🗑️
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="text-gray-400 text-sm text-center py-4">
                                                    No hay vehículos agregados. Haz clic en &quot;Agregar Vehículo&quot;
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Footer con botones */}
                            <div className="sticky bottom-0 bg-gradient-to-r from-slate-900 to-blue-900 p-6 border-t border-white/20">
                                <div className="flex justify-end gap-4">
                                    <button
                                        type="button"
                                        onClick={handleCloseTrackModal}
                                        className="px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white font-bold rounded-lg transition-all"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleSaveTrack}
                                        className="px-6 py-3 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white font-bold rounded-lg transition-all"
                                    >
                                        {editingTrackIndex !== null ? '💾 Guardar Cambios' : '➕ Agregar Circuito'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
