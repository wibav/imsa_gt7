"use client";
import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { FirebaseService } from "../services/firebaseService";
import { useAuth } from "../context/AuthContext";
import Image from "next/image";
import {
    formatDateFull,
    calculateProgress,
    getNextRace,
    getStandings,
    getDriverStandings,
    getPositionBg,
    getPositionDisplay,
    getResultColors,
    getPositionMedal,
    calculateAdvancedStandings,
    getDriverStats
} from "../utils";
import StandingsTable from "../components/championship/StandingsTable";
import DriverStatsPanel from "../components/championship/DriverStatsPanel";
import DriverComparator from "../components/championship/DriverComparator";
import LoadingSkeleton from "../components/common/LoadingSkeleton";
import RegistrationForm from "../components/championship/RegistrationForm";
import ClaimForm from '../components/championship/ClaimForm';
import ExportableStandings from '../components/championship/ExportableStandings';
import RaceBriefing from '../components/championship/RaceBriefing';
import { STREAMING_PLATFORMS } from '../utils/constants';
import { SEVERITY_CONFIG } from '../models/Penalty';

export default function ChampionshipDetailPage() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const championshipId = searchParams.get('id');
    const { currentUser, isAdmin } = useAuth();

    const [championship, setChampionship] = useState(null);
    const [teams, setTeams] = useState([]);
    const [tracks, setTracks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('standings'); // standings, calendar, stats, compare, info, penalties
    const [showRegistration, setShowRegistration] = useState(false);
    const [showClaimForm, setShowClaimForm] = useState(false);
    const [penalties, setPenalties] = useState([]);
    const [divisions, setDivisions] = useState([]);
    const [selectedDivision, setSelectedDivision] = useState('all');

    useEffect(() => {
        if (championshipId) {
            loadChampionshipData();
        }
    }, [championshipId]);

    const loadChampionshipData = async () => {
        if (!championshipId) return;

        setLoading(true);
        // Reset state
        setChampionship(null);
        setTeams([]);
        setTracks([]);

        try {
            const [champData, teamsData, tracksData, penaltiesData, divisionsData] = await Promise.all([
                FirebaseService.getChampionship(championshipId),
                FirebaseService.getTeamsByChampionship(championshipId).catch(() => []),
                FirebaseService.getTracksByChampionship(championshipId).catch(() => []),
                FirebaseService.getPenaltiesByChampionship(championshipId).catch(() => []),
                FirebaseService.getDivisionsByChampionship(championshipId).catch(() => [])
            ]);

            setChampionship(champData);
            setTeams(teamsData || []);
            setTracks(tracksData || []);
            setPenalties(penaltiesData || []);
            setDivisions(divisionsData || []);
        } catch (error) {
            console.error("Error loading championship data:", error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return <LoadingSkeleton variant="page" message="Cargando Campeonato..." />;
    }

    if (!championship) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 flex items-center justify-center">
                <div className="text-center">
                    <div className="text-6xl mb-4">❌</div>
                    <div className="text-white text-xl font-bold mb-4">Campeonato no encontrado</div>
                    <button
                        onClick={() => router.push('/')}
                        className="bg-gradient-to-r from-orange-600 to-red-600 text-white px-6 py-3 rounded-lg font-bold"
                    >
                        Volver al Inicio
                    </button>
                </div>
            </div>
        );
    }

    const standings = getStandings(championship, teams, tracks);
    const nextRace = getNextRace(tracks);
    const progress = calculateProgress(tracks, championship);

    // ── Standings Avanzado ──
    const activeDivision = divisions.find(d => d.id === selectedDivision);
    const divisionOptions = selectedDivision !== 'all' && activeDivision
        ? { divisionDrivers: activeDivision.drivers || [] }
        : {};
    const { driverStandings: advancedDriverStandings, teamStandings: advancedTeamStandings, raceColumns } =
        calculateAdvancedStandings(championship, teams, tracks, penalties, divisionOptions);
    const driverStats = getDriverStats(advancedDriverStandings);

    // Configuración de zonas de ascenso/descenso
    const promotionZone = championship?.divisionsConfig?.enabled && selectedDivision !== 'all'
        ? championship.divisionsConfig.promotionCount || 0
        : 0;
    const relegationZone = championship?.divisionsConfig?.enabled && selectedDivision !== 'all'
        ? championship.divisionsConfig.relegationCount || 0
        : 0;

    // Streaming: detectar si hay una carrera "en vivo" (status 'in-progress')
    const liveTrack = tracks.find(t => t.status === 'in-progress');
    const hasStreaming = championship.streaming?.url;
    const isLive = liveTrack && hasStreaming;
    const streamPlatform = STREAMING_PLATFORMS.find(p => p.value === championship.streaming?.platform);

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800">
            {/* Header con Banner */}
            <div className="relative">
                {championship.banner ? (
                    <div className="relative w-full h-80 bg-black">
                        <Image
                            src={championship.banner}
                            alt={championship.name}
                            fill
                            className="object-cover opacity-60"
                            priority
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/50 to-transparent"></div>
                    </div>
                ) : (
                    <div className="w-full h-80 bg-gradient-to-r from-orange-600 to-red-600"></div>
                )}

                {/* Contenido del header */}
                <div className="absolute bottom-0 left-0 right-0 px-4 sm:px-6 py-6">
                    <div className="max-w-7xl mx-auto">
                        {/* Breadcrumb */}
                        <div className="flex items-center gap-2 text-sm text-gray-300 mb-4">
                            <button
                                onClick={() => router.push('/')}
                                className="hover:text-white transition-colors"
                            >
                                🏠 Inicio
                            </button>
                            <span>/</span>
                            <span className="text-white">Campeonatos</span>
                            <span>/</span>
                            <span className="text-orange-400">{championship.name}</span>
                        </div>

                        {/* Título y info */}
                        <div className="flex items-end justify-between gap-4">
                            <div>
                                <h1 className="text-4xl sm:text-5xl font-bold text-white mb-2">
                                    {championship.name}
                                </h1>
                                <div className="flex items-center gap-4 flex-wrap">
                                    {championship.season && (
                                        <span className="text-orange-400 font-semibold">
                                            📅 Temporada {championship.season}
                                        </span>
                                    )}
                                    <span className="text-gray-300">
                                        {championship.settings?.isTeamChampionship ? '👥 Por Equipos' : '👤 Individual'}
                                    </span>
                                    <span className="text-gray-300">
                                        🏁 {progress.completed}/{progress.total} carreras
                                    </span>
                                    {isLive && (
                                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-600 text-white text-sm font-bold rounded-full animate-pulse">
                                            <span className="w-2 h-2 bg-white rounded-full"></span>
                                            EN VIVO
                                        </span>
                                    )}
                                </div>
                            </div>

                            {isAdmin() && (
                                <button
                                    onClick={() => router.push(`/championshipsAdmin?id=${championshipId}`)}
                                    className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-semibold text-sm transition-colors"
                                >
                                    ⚙️ Admin
                                </button>
                            )}

                            {/* Botón Ver en Vivo */}
                            {hasStreaming && (
                                <a
                                    href={championship.streaming.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm transition-all ${isLive
                                        ? 'bg-red-600 hover:bg-red-700 text-white animate-pulse'
                                        : 'bg-white/10 hover:bg-white/20 border border-white/30 text-white'
                                        }`}
                                >
                                    {streamPlatform?.icon || '📺'} {isLive ? 'Ver en Vivo' : 'Ver Stream'}
                                </a>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabs Navigation */}
            <div className="border-b border-white/10 bg-slate-900/80 backdrop-blur-sm sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6">
                    <div className="flex gap-1 overflow-x-auto">
                        {[
                            { id: 'standings', label: '📊 Clasificación', icon: '📊' },
                            { id: 'calendar', label: '📅 Calendario', icon: '📅' },
                            { id: 'stats', label: '📈 Estadísticas', icon: '📈' },
                            { id: 'compare', label: '⚔️ Comparar', icon: '⚔️' },
                            { id: 'info', label: 'ℹ️ Información', icon: 'ℹ️' },
                            ...(championship.penaltiesConfig?.enabled ? [{ id: 'penalties', label: '⚠️ Sanciones', icon: '⚠️' }] : [])
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`
                                    px-6 py-4 font-semibold text-sm whitespace-nowrap transition-all
                                    ${activeTab === tab.id
                                        ? 'text-white border-b-2 border-orange-500 bg-white/5'
                                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                                    }
                                `}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
                <div className="grid lg:grid-cols-4 gap-8">
                    {/* Main Content - 3 columns */}
                    <div className="lg:col-span-3">
                        {/* TAB: Clasificación */}
                        {activeTab === 'standings' && (
                            <div className="space-y-6">
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                                    <h2 className="text-3xl font-bold text-white flex items-center gap-3">
                                        📊 Clasificación Actual
                                    </h2>
                                    <div className="flex flex-wrap gap-2">
                                        <ExportableStandings
                                            standings={advancedDriverStandings}
                                            teamStandings={advancedTeamStandings}
                                            championship={championship}
                                            progress={progress}
                                            raceColumns={raceColumns}
                                        />
                                        <RaceBriefing
                                            nextRace={nextRace}
                                            championship={championship}
                                            progress={progress}
                                        />
                                    </div>
                                </div>

                                {/* Selector de División */}
                                {championship?.divisionsConfig?.enabled && divisions.length > 0 && (
                                    <div className="flex flex-wrap gap-2 mb-6">
                                        <button
                                            onClick={() => setSelectedDivision('all')}
                                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${selectedDivision === 'all'
                                                ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/30'
                                                : 'bg-white/10 text-gray-300 hover:bg-white/20'
                                                }`}
                                        >
                                            🏁 General
                                        </button>
                                        {divisions.map(div => (
                                            <button
                                                key={div.id}
                                                onClick={() => setSelectedDivision(div.id)}
                                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${selectedDivision === div.id
                                                    ? 'text-white shadow-lg'
                                                    : 'bg-white/10 text-gray-300 hover:bg-white/20'
                                                    }`}
                                                style={selectedDivision === div.id ? {
                                                    backgroundColor: div.color || '#f97316',
                                                    boxShadow: `0 10px 15px -3px ${div.color || '#f97316'}40`
                                                } : {}}
                                            >
                                                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: div.color || '#f97316' }} />
                                                {div.name}
                                                <span className="text-xs opacity-75">({(div.drivers || []).length})</span>
                                            </button>
                                        ))}
                                    </div>
                                )}

                                {/* Clasificación de Equipos */}
                                {championship.settings?.isTeamChampionship && (
                                    <div className="space-y-6">
                                        <StandingsTable
                                            standings={advancedTeamStandings}
                                            type="teams"
                                            title="Clasificación por Equipos"
                                            accentColor="orange"
                                            showRaceColumns={raceColumns.length > 0}
                                            showStatsColumns={raceColumns.length > 0}
                                            raceColumns={raceColumns}
                                        />

                                        <StandingsTable
                                            standings={advancedDriverStandings}
                                            type="drivers"
                                            title="Clasificación Individual de Pilotos"
                                            accentColor="blue"
                                            showTeamColumn={true}
                                            showCategoryColumn={true}
                                            showRaceColumns={raceColumns.length > 0}
                                            showStatsColumns={raceColumns.length > 0}
                                            raceColumns={raceColumns}
                                            promotionZone={promotionZone}
                                            relegationZone={relegationZone}
                                        />
                                    </div>
                                )}

                                {/* Clasificación Individual (cuando NO es por equipos) */}
                                {!championship.settings?.isTeamChampionship && (
                                    <StandingsTable
                                        standings={advancedDriverStandings}
                                        type="individual"
                                        accentColor="orange"
                                        showTeamColumn={true}
                                        showCategoryColumn={true}
                                        showRaceColumns={raceColumns.length > 0}
                                        showStatsColumns={raceColumns.length > 0}
                                        raceColumns={raceColumns}
                                        promotionZone={promotionZone}
                                        relegationZone={relegationZone}
                                    />
                                )}
                            </div>
                        )}

                        {/* TAB: Calendario */}
                        {activeTab === 'calendar' && (
                            <div>
                                <h2 className="text-3xl font-bold text-white mb-6 flex items-center gap-3">
                                    📅 Calendario de Carreras
                                </h2>
                                <div className="space-y-4">
                                    {tracks.length === 0 ? (
                                        <div className="bg-white/5 border border-white/10 rounded-xl p-12 text-center">
                                            <div className="text-6xl mb-4">🏁</div>
                                            <p className="text-gray-300 text-lg">No hay carreras programadas</p>
                                        </div>
                                    ) : (
                                        tracks.sort((a, b) => new Date(a.date) - new Date(b.date)).map((track, index) => (
                                            <div
                                                key={track.id || index}
                                                className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-6 border border-white/10 hover:border-orange-500/50 transition-all"
                                            >
                                                <div className="flex items-start justify-between mb-4">
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-3 mb-2">
                                                            <span className="text-2xl font-bold text-orange-400">R{track.round}</span>
                                                            <h3 className="text-xl font-bold text-white">{track.name}</h3>
                                                        </div>
                                                        <div className="flex items-center gap-4 text-gray-300">
                                                            <span>📅 {formatDateFull(track.date)}</span>
                                                            {track.country && <span>📍 {track.country}</span>}
                                                            {track.category && (
                                                                <span className="bg-blue-600/30 px-2 py-1 rounded text-sm">
                                                                    {track.category}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div>
                                                        {track.status === 'completed' && (
                                                            <span className="bg-green-500 text-white text-xs px-3 py-1 rounded-full font-bold">✓ Completada</span>
                                                        )}
                                                        {track.status === 'in-progress' && (
                                                            <span className="bg-yellow-500 text-white text-xs px-3 py-1 rounded-full font-bold">⏱️ En Curso</span>
                                                        )}
                                                        {track.status === 'scheduled' && new Date(track.date + 'T00:00:00') < new Date() && (
                                                            <span className="bg-red-500 text-white text-xs px-3 py-1 rounded-full font-bold">⚠️ Pendiente</span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Autos específicos (si aplica) */}
                                                {track.specificCars && (
                                                    <div className="mt-3 inline-flex items-start gap-2 bg-orange-500/15 border border-orange-500/30 text-orange-100 px-3 py-2 rounded-lg text-sm">
                                                        <span className="font-semibold">🚗 Autos obligatorios:</span>
                                                        <span className="text-orange-50">
                                                            {(track.allowedCars && track.allowedCars.length > 0)
                                                                ? track.allowedCars.join(', ')
                                                                : 'Lista pendiente'}
                                                        </span>
                                                    </div>
                                                )}

                                                {/* Reglas del circuito */}
                                                {track.rules && (
                                                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                                                        {track.raceType === 'sprint_carrera' && (
                                                            <span className="bg-purple-500/20 border border-purple-500/30 text-purple-300 px-2 py-1 rounded">
                                                                ⚡ Sprint + Carrera
                                                            </span>
                                                        )}
                                                        {track.raceType === 'resistencia' && (
                                                            <span className="bg-blue-500/20 border border-blue-500/30 text-blue-300 px-2 py-1 rounded">
                                                                ⏱️ Resistencia ({track.duration} min)
                                                            </span>
                                                        )}
                                                        {track.raceType === 'carrera' && (
                                                            <span className="bg-green-500/20 border border-green-500/30 text-green-300 px-2 py-1 rounded">
                                                                🏁 {track.laps} vueltas
                                                            </span>
                                                        )}
                                                        {track.rules.weather && track.rules.weather !== 'clear' && (
                                                            <span className="bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 px-2 py-1 rounded">
                                                                🌧️ {track.rules.weather === 'rain' ? 'Lluvia' : track.rules.weather === 'variable' ? 'Variable' : track.rules.weather}
                                                            </span>
                                                        )}
                                                        {track.rules.startTime && (
                                                            <span className="bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 px-2 py-1 rounded">
                                                                ⏰ {track.rules.startTime}
                                                            </span>
                                                        )}
                                                        {(track.rules.timeMultiplier ?? 1) > 1 && (
                                                            <span className="bg-yellow-500/20 border border-yellow-500/30 text-yellow-300 px-2 py-1 rounded">
                                                                ⏩ x{track.rules.timeMultiplier}
                                                            </span>
                                                        )}
                                                        {(track.rules.mandatoryPitStops ?? 0) > 0 && (
                                                            <span className="bg-red-500/20 border border-red-500/30 text-red-300 px-2 py-1 rounded">
                                                                🛣️ {track.rules.mandatoryPitStops} pit stop{track.rules.mandatoryPitStops > 1 ? 's' : ''} obligatorio{track.rules.mandatoryPitStops > 1 ? 's' : ''}
                                                            </span>
                                                        )}
                                                        {track.rules.mandatoryTyre?.length > 0 && (
                                                            <span className="bg-amber-500/20 border border-amber-500/30 text-amber-300 px-2 py-1 rounded">
                                                                🛞 Compuestos: {track.rules.mandatoryTyre.join(', ')}
                                                            </span>
                                                        )}
                                                        {track.rules.bop === 'yes' && (
                                                            <span className="bg-teal-500/20 border border-teal-500/30 text-teal-300 px-2 py-1 rounded">
                                                                ⚖️ BoP
                                                            </span>
                                                        )}
                                                    </div>
                                                )}

                                                {/* Notas del circuito */}
                                                {track.rules?.notes && (
                                                    <div className="mt-3 bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                                                        <p className="text-blue-200 text-sm whitespace-pre-line">{track.rules.notes}</p>
                                                    </div>
                                                )}
                                                {track.layoutImage && (
                                                    <div className="relative w-full h-40 bg-black/30 rounded-lg overflow-hidden mt-4">
                                                        <Image
                                                            src={track.layoutImage}
                                                            alt={track.name}
                                                            fill
                                                            className="object-contain p-2"
                                                        />
                                                    </div>
                                                )}

                                                {/* Mostrar puntajes si existen */}
                                                {track.points && Object.keys(track.points).length > 0 && (
                                                    <div className="mt-4 pt-4 border-t border-white/20">
                                                        <h4 className="text-sm font-semibold text-gray-300 mb-3">📊 Resultados</h4>
                                                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                                                            {Object.entries(track.points)
                                                                .sort(([, a], [, b]) => b - a)
                                                                .map(([driverName, points], idx) => {
                                                                    const colors = getResultColors(idx);
                                                                    const medal = getPositionMedal(idx);
                                                                    return (
                                                                        <div
                                                                            key={driverName}
                                                                            className={`flex justify-between items-center text-sm px-3 py-2 rounded-lg ${colors.bg}`}
                                                                        >
                                                                            <span className="text-gray-300 truncate">
                                                                                {medal && (
                                                                                    <span className="mr-1">{medal}</span>
                                                                                )}
                                                                                {driverName}
                                                                            </span>
                                                                            <span className={`font-bold ml-2 ${colors.text}`}>
                                                                                {points}
                                                                            </span>
                                                                        </div>
                                                                    );
                                                                })
                                                            }
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}

                        {/* TAB: Estadísticas */}
                        {activeTab === 'stats' && (
                            <div>
                                <h2 className="text-3xl font-bold text-white mb-6 flex items-center gap-3">
                                    📈 Estadísticas del Campeonato
                                </h2>
                                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                                    <div className="bg-gradient-to-br from-orange-600 to-red-600 rounded-xl p-6 text-white">
                                        <div className="text-4xl mb-2">🏁</div>
                                        <div className="text-3xl font-bold">{tracks.length}</div>
                                        <div className="text-sm opacity-90">Carreras Totales</div>
                                    </div>
                                    <div className="bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl p-6 text-white">
                                        <div className="text-4xl mb-2">✓</div>
                                        <div className="text-3xl font-bold">{progress.completed}</div>
                                        <div className="text-sm opacity-90">Completadas</div>
                                    </div>
                                    <div className="bg-gradient-to-br from-green-600 to-emerald-600 rounded-xl p-6 text-white">
                                        <div className="text-4xl mb-2">👥</div>
                                        <div className="text-3xl font-bold">
                                            {championship.settings?.isTeamChampionship
                                                ? teams.reduce((sum, t) => sum + (t.drivers?.length || 0), 0)
                                                : (championship.drivers?.length || 0)
                                            }
                                        </div>
                                        <div className="text-sm opacity-90">Pilotos</div>
                                    </div>
                                    {championship.settings?.isTeamChampionship && (
                                        <div className="bg-gradient-to-br from-purple-600 to-pink-600 rounded-xl p-6 text-white">
                                            <div className="text-4xl mb-2">🏆</div>
                                            <div className="text-3xl font-bold">{teams.length}</div>
                                            <div className="text-sm opacity-90">Equipos</div>
                                        </div>
                                    )}
                                </div>

                                {/* Panel de estadísticas detalladas */}
                                <DriverStatsPanel
                                    driverStandings={advancedDriverStandings}
                                    stats={driverStats}
                                />
                            </div>
                        )}

                        {/* TAB: Comparar */}
                        {activeTab === 'compare' && (
                            <div>
                                <h2 className="text-3xl font-bold text-white mb-6 flex items-center gap-3">
                                    ⚔️ Comparador de Pilotos
                                </h2>
                                <DriverComparator
                                    driverStandings={advancedDriverStandings}
                                    raceColumns={raceColumns}
                                />
                            </div>
                        )}

                        {/* TAB: Sanciones (público) */}
                        {activeTab === 'penalties' && championship.penaltiesConfig?.enabled && (
                            <div>
                                <h2 className="text-3xl font-bold text-white mb-6 flex items-center gap-3">
                                    ⚠️ Sanciones del Campeonato
                                </h2>
                                {penalties.filter(p => p.status === 'applied').length === 0 ? (
                                    <div className="bg-white/5 border border-white/10 rounded-xl p-8 text-center">
                                        <div className="text-4xl mb-3">✅</div>
                                        <p className="text-gray-400">Sin sanciones registradas</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {penalties.filter(p => p.status === 'applied').map(penalty => {
                                            const severityConfig = SEVERITY_CONFIG[penalty.severity] || SEVERITY_CONFIG.minor;
                                            return (
                                                <div key={penalty.id}
                                                    className={`bg-white/5 border rounded-xl p-4 ${severityConfig.border}`}>
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div>
                                                            <div className="flex items-center gap-2 flex-wrap mb-1">
                                                                <span className="text-white font-bold">{penalty.driverName}</span>
                                                                <span className={`text-xs px-2 py-0.5 rounded ${severityConfig.bg} ${severityConfig.color}`}>
                                                                    {severityConfig.label}
                                                                </span>
                                                            </div>
                                                            <div className="text-white text-sm">{penalty.name}</div>
                                                            {penalty.description && <div className="text-gray-400 text-xs mt-1">{penalty.description}</div>}
                                                            <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                                                                {penalty.trackName && <span>🏁 R{penalty.round} - {penalty.trackName}</span>}
                                                                <span>📅 {new Date(penalty.appliedAt).toLocaleDateString('es-ES')}</span>
                                                            </div>
                                                        </div>
                                                        <div className="text-right flex-shrink-0">
                                                            {penalty.points > 0 && <span className="text-red-400 font-bold text-sm">-{penalty.points} pts</span>}
                                                            {penalty.warningPoints > 0 && <div className="text-yellow-400 text-xs">+{penalty.warningPoints} ⚠️</div>}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                {/* Botón enviar reclamación */}
                                {championship.penaltiesConfig?.allowClaims && (
                                    <div className="mt-6 bg-gradient-to-br from-orange-600/20 to-red-600/20 border border-orange-400/30 rounded-xl p-6 text-center">
                                        <h3 className="text-white font-bold text-lg mb-2">📩 ¿Viste una infracción?</h3>
                                        <p className="text-gray-300 text-sm mb-4">Reporta el incidente para que los directores de carrera lo revisen</p>
                                        <button
                                            onClick={() => setShowClaimForm(true)}
                                            className="bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white px-6 py-3 rounded-lg font-bold transition-all"
                                        >
                                            📩 Reportar Incidente
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* TAB: Información */}
                        {activeTab === 'info' && (
                            <div>
                                <h2 className="text-3xl font-bold text-white mb-6 flex items-center gap-3">
                                    ℹ️ Información del Campeonato
                                </h2>
                                <div className="space-y-6">
                                    <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-6 border border-white/10">
                                        <h3 className="text-xl font-bold text-white mb-4">📋 Detalles Generales</h3>
                                        <div className="grid md:grid-cols-2 gap-4">
                                            <div>
                                                <div className="text-gray-400 text-sm mb-1">Nombre Completo</div>
                                                <div className="text-white font-semibold">{championship.name}</div>
                                            </div>
                                            <div>
                                                <div className="text-gray-400 text-sm mb-1">Nombre Corto</div>
                                                <div className="text-white font-semibold">{championship.shortName}</div>
                                            </div>
                                            <div>
                                                <div className="text-gray-400 text-sm mb-1">Temporada</div>
                                                <div className="text-white font-semibold">{championship.season}</div>
                                            </div>
                                            <div>
                                                <div className="text-gray-400 text-sm mb-1">Estado</div>
                                                <div className="text-white font-semibold capitalize">{championship.status}</div>
                                            </div>
                                            {championship.startDate && (
                                                <div>
                                                    <div className="text-gray-400 text-sm mb-1">Fecha de Inicio</div>
                                                    <div className="text-white font-semibold">{formatDateFull(championship.startDate)}</div>
                                                </div>
                                            )}
                                            {championship.endDate && (
                                                <div>
                                                    <div className="text-gray-400 text-sm mb-1">Fecha de Finalización</div>
                                                    <div className="text-white font-semibold">{formatDateFull(championship.endDate)}</div>
                                                </div>
                                            )}
                                        </div>
                                        {championship.description && (
                                            <div className="mt-4 pt-4 border-t border-white/10">
                                                <div className="text-gray-400 text-sm mb-2">Descripción</div>
                                                <div className="text-white">{championship.description}</div>
                                            </div>
                                        )}
                                    </div>

                                    {championship.categories && championship.categories.length > 0 && (
                                        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-6 border border-white/10">
                                            <h3 className="text-xl font-bold text-white mb-4">🏎️ Categorías</h3>
                                            <div className="flex flex-wrap gap-2">
                                                {championship.categories.map((cat, idx) => (
                                                    <span
                                                        key={idx}
                                                        className="bg-blue-600/30 border border-blue-400/50 text-blue-200 px-3 py-1 rounded-full font-semibold"
                                                    >
                                                        {cat}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-6 border border-white/10">
                                        <h3 className="text-xl font-bold text-white mb-4">⚙️ Configuración</h3>
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                                                <span className="text-gray-300">Tipo de Campeonato</span>
                                                <span className="text-white font-semibold">
                                                    {championship.settings?.isTeamChampionship ? '👥 Por Equipos' : '👤 Individual'}
                                                </span>
                                            </div>
                                            {championship.settings?.maxTeams && (
                                                <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                                                    <span className="text-gray-300">Máximo de Equipos</span>
                                                    <span className="text-white font-semibold">{championship.settings.maxTeams}</span>
                                                </div>
                                            )}
                                            {championship.settings?.maxDriversPerTeam && (
                                                <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                                                    <span className="text-gray-300">Pilotos por Equipo</span>
                                                    <span className="text-white font-semibold">{championship.settings.maxDriversPerTeam}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {championship.settings?.pointsSystem && typeof championship.settings.pointsSystem === 'object' && (
                                        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-6 border border-white/10">
                                            <h3 className="text-xl font-bold text-white mb-4">🎯 Sistema de Puntos</h3>

                                            {/* Puntos de Carrera */}
                                            {championship.settings.pointsSystem.race && (
                                                <div className="mb-6">
                                                    <h4 className="text-lg font-semibold text-white mb-3">🏁 Carrera</h4>
                                                    <div className="grid grid-cols-4 sm:grid-cols-8 md:grid-cols-10 gap-2">
                                                        {Object.entries(championship.settings.pointsSystem.race)
                                                            .sort(([a], [b]) => Number(a) - Number(b))
                                                            .map(([position, points]) => (
                                                                <div key={position} className="bg-white/5 rounded-lg p-2 text-center">
                                                                    <div className="text-gray-400 text-xs">P{position}</div>
                                                                    <div className="text-white font-bold">{points}</div>
                                                                </div>
                                                            ))
                                                        }
                                                    </div>
                                                </div>
                                            )}

                                            {/* Puntos de Qualifying */}
                                            {championship.settings.pointsSystem.qualifying?.enabled && (
                                                <div className="mb-6 pt-4 border-t border-white/10">
                                                    <h4 className="text-lg font-semibold text-white mb-3">⏱️ Qualifying</h4>
                                                    <div className="grid grid-cols-3 gap-3">
                                                        {Object.entries(championship.settings.pointsSystem.qualifying.positions || {})
                                                            .sort(([a], [b]) => Number(a) - Number(b))
                                                            .map(([position, points]) => (
                                                                <div key={position} className="bg-blue-600/20 border border-blue-400/30 rounded-lg p-3 text-center">
                                                                    <div className="text-blue-200 text-sm mb-1">
                                                                        {position === '1' ? '🥇' : position === '2' ? '🥈' : '🥉'} P{position}
                                                                    </div>
                                                                    <div className="text-white font-bold text-lg">+{points} pts</div>
                                                                </div>
                                                            ))
                                                        }
                                                    </div>
                                                </div>
                                            )}

                                            {/* Vuelta Rápida */}
                                            {championship.settings.pointsSystem.fastestLap?.enabled && (
                                                <div className="pt-4 border-t border-white/10">
                                                    <h4 className="text-lg font-semibold text-white mb-3">⚡ Vuelta Rápida</h4>
                                                    <div className="bg-purple-600/20 border border-purple-400/30 rounded-lg p-4 max-w-xs">
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-purple-200">Bonificación</span>
                                                            <span className="text-white font-bold text-lg">+{championship.settings.pointsSystem.fastestLap.points} pts</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Reglamentación */}
                                    {championship.regulations && (
                                        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-6 border border-white/10">
                                            <h3 className="text-xl font-bold text-white mb-4">📜 Reglamentación</h3>
                                            <div className="bg-white/5 rounded-lg p-4">
                                                <p className="text-gray-200 whitespace-pre-line text-sm leading-relaxed">{championship.regulations}</p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Tracking de Autos */}
                                    {championship.carUsageTracking?.enabled && (
                                        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-6 border border-white/10">
                                            <h3 className="text-xl font-bold text-white mb-4">🚗 Uso de Autos</h3>
                                            <div className="space-y-3">
                                                <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                                                    <span className="text-gray-300">Máximo usos por auto</span>
                                                    <span className="text-white font-semibold">{championship.carUsageTracking.maxUsesPerCar} carreras</span>
                                                </div>
                                                <p className="text-gray-400 text-xs">
                                                    Cada piloto puede usar el mismo auto un máximo de {championship.carUsageTracking.maxUsesPerCar} veces durante el campeonato.
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Sidebar - 1 column */}
                    <div className="lg:col-span-1">
                        <div className="sticky top-24 space-y-6">
                            {/* Próxima Carrera */}
                            {nextRace && (
                                <div className="bg-gradient-to-br from-orange-600 to-red-600 rounded-xl p-6 shadow-xl">
                                    <h3 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
                                        🏁 Próxima Carrera
                                    </h3>
                                    <div className="space-y-3">
                                        <div>
                                            <div className="text-white/80 text-sm mb-1">Ronda {nextRace.round}</div>
                                            <div className="text-white font-bold text-xl">{nextRace.name}</div>
                                        </div>
                                        <div className="text-white/90 text-sm">
                                            📅 {formatDateFull(nextRace.date)}
                                        </div>
                                        {nextRace.country && (
                                            <div className="text-white/90 text-sm">
                                                📍 {nextRace.country}
                                            </div>
                                        )}
                                        {nextRace.layoutImage && (
                                            <div className="relative w-full h-32 bg-black/30 rounded-lg overflow-hidden mt-4">
                                                <Image
                                                    src={nextRace.layoutImage}
                                                    alt={nextRace.name}
                                                    fill
                                                    className="object-contain p-2"
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Progreso rápido */}
                            <div className="bg-white/10 backdrop-blur-sm border border-white/30 rounded-lg p-4">
                                <h3 className="text-white font-bold mb-3">📊 Progreso</h3>
                                <div className="text-center">
                                    <div className="text-4xl font-bold text-orange-400 mb-2">
                                        {progress.percentage}%
                                    </div>
                                    <div className="text-gray-300 text-sm">
                                        {progress.completed} de {progress.total} carreras
                                    </div>
                                    <div className="w-full bg-gray-700 rounded-full h-2 mt-3">
                                        <div
                                            className="bg-gradient-to-r from-green-500 to-emerald-500 h-full rounded-full transition-all"
                                            style={{ width: `${progress.percentage}%` }}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Inscripción */}
                            {championship.registration?.enabled && championship.status === 'active' && (
                                <div className="bg-gradient-to-br from-green-600/20 to-emerald-600/20 border border-green-400/30 rounded-xl p-6">
                                    <h3 className="text-white font-bold text-lg mb-2 flex items-center gap-2">
                                        📝 Inscríbete
                                    </h3>
                                    <p className="text-gray-300 text-sm mb-4">
                                        ¡Las inscripciones están abiertas! Únete al campeonato.
                                    </p>
                                    {championship.registration?.maxParticipants > 0 && (
                                        <div className="text-sm text-gray-300 mb-3">
                                            👥 {(championship.registrations || []).filter(r => r.status === 'approved').length}/{championship.registration.maxParticipants} cupos ocupados
                                        </div>
                                    )}
                                    {championship.registration?.deadline && (
                                        <div className="text-sm text-orange-300 mb-3">
                                            📅 Hasta el {new Date(championship.registration.deadline).toLocaleDateString('es-ES')}
                                        </div>
                                    )}
                                    <button
                                        onClick={() => setShowRegistration(true)}
                                        className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white px-4 py-3 rounded-lg font-bold transition-all text-center"
                                    >
                                        🏁 Inscribirme
                                    </button>
                                </div>
                            )}

                            {/* Streaming info */}
                            {hasStreaming && championship.streaming?.casterName && (
                                <div className="bg-white/10 backdrop-blur-sm border border-white/30 rounded-lg p-4">
                                    <h3 className="text-white font-bold mb-3">📺 Transmisión</h3>
                                    <div className="space-y-2 text-sm">
                                        {championship.streaming.casterName && (
                                            <div className="flex justify-between text-gray-300">
                                                <span>🎙️ Caster:</span>
                                                <span className="text-white font-medium">{championship.streaming.casterName}</span>
                                            </div>
                                        )}
                                        {championship.streaming.hostName && (
                                            <div className="flex justify-between text-gray-300">
                                                <span>🏠 Host:</span>
                                                <span className="text-white font-medium">{championship.streaming.hostName}</span>
                                            </div>
                                        )}
                                        <a
                                            href={championship.streaming.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="block w-full text-center mt-3 px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/30 text-white rounded-lg transition-all font-medium"
                                        >
                                            {streamPlatform?.icon || '📺'} Ver en {streamPlatform?.label || 'Stream'}
                                        </a>
                                    </div>
                                </div>
                            )}

                            {/* Botón volver */}
                            <button
                                onClick={() => router.push('/')}
                                className="w-full bg-white/10 hover:bg-white/20 border border-white/30 text-white px-4 py-3 rounded-lg font-semibold transition-all"
                            >
                                ← Volver al Inicio
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Modal de Inscripción */}
            {showRegistration && (
                <RegistrationForm
                    championship={championship}
                    onClose={() => setShowRegistration(false)}
                    onSuccess={() => loadChampionshipData()}
                />
            )}

            {/* Modal de Reclamación */}
            {showClaimForm && (
                <ClaimForm
                    championshipId={championshipId}
                    championship={championship}
                    teams={teams}
                    tracks={tracks}
                    onClose={() => setShowClaimForm(false)}
                    onSubmitted={() => loadChampionshipData()}
                />
            )}
        </div>
    );
}
