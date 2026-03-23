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
    const [activeTab, setActiveTab] = useState('info'); // standings, calendar, stats, info, penalties
    const [selectedTrack, setSelectedTrack] = useState(null);
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

    // ── Standings por División (para vista General con divisiones activas) ──
    const divisionsStandings = championship?.divisionsConfig?.enabled && divisions.length > 0
        ? divisions
            .slice()
            .sort((a, b) => (a.order || 0) - (b.order || 0))
            .map(div => {
                const opts = { divisionDrivers: div.drivers || [] };
                const { driverStandings, teamStandings, raceColumns: rc } =
                    calculateAdvancedStandings(championship, teams, tracks, penalties, opts);
                return {
                    division: div,
                    driverStandings,
                    teamStandings,
                    raceColumns: rc,
                    promotionZone: championship.divisionsConfig.promotionCount || 0,
                    relegationZone: championship.divisionsConfig.relegationCount || 0,
                };
            })
        : [];

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
                            { id: 'info', label: 'ℹ️ Información', icon: 'ℹ️' },
                            { id: 'standings', label: '📊 Clasificación', icon: '📊' },
                            { id: 'calendar', label: '📅 Calendario', icon: '📅' },
                            { id: 'stats', label: '📈 Estadísticas', icon: '📈' },
                            ...(championship?.preQualy?.enabled ? [{ id: 'prequaly', label: '🎯 Pre-Qualy', icon: '🎯' }] : []),
                            ...(championship?.divisionsConfig?.enabled ? [{ id: 'salas', label: '🏟️ Salas', icon: '🏟️' }] : []),
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
                                            🏁 Todas las Salas
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

                                {/* ── Vista: TODAS LAS SALAS (divisiones activadas + selectedDivision === 'all') ── */}
                                {championship?.divisionsConfig?.enabled && divisions.length > 0 && selectedDivision === 'all' && (
                                    <div className="space-y-8">
                                        {divisionsStandings.map(({ division: div, driverStandings: ds, teamStandings: ts, raceColumns: rc, promotionZone: pz, relegationZone: rz }) => (
                                            <div key={div.id}>
                                                {/* Header de sala */}
                                                <div
                                                    className="flex items-center gap-3 mb-3 px-4 py-3 rounded-xl"
                                                    style={{ background: `linear-gradient(135deg, ${div.color || '#f97316'}20, ${div.color || '#f97316'}08)`, border: `1px solid ${div.color || '#f97316'}30` }}
                                                >
                                                    <div
                                                        className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-base flex-shrink-0"
                                                        style={{ backgroundColor: div.color || '#f97316' }}
                                                    >
                                                        {div.order}
                                                    </div>
                                                    <div className="flex-1">
                                                        <div className="text-white font-bold text-lg leading-tight">{div.name}</div>
                                                        <div className="text-xs" style={{ color: `${div.color || '#f97316'}cc` }}>
                                                            {(div.drivers || []).length} piloto{(div.drivers || []).length !== 1 ? 's' : ''}
                                                            {div.casterName && <span className="ml-3">🎙️ {div.casterName}</span>}
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => setSelectedDivision(div.id)}
                                                        className="text-xs px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white transition-colors"
                                                    >
                                                        Ver detalle →
                                                    </button>
                                                </div>

                                                {/* Tabla de clasificación de la sala */}
                                                {ds.length === 0 ? (
                                                    <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-center">
                                                        <p className="text-gray-400 text-sm">Sin datos de clasificación para esta sala</p>
                                                    </div>
                                                ) : championship.settings?.isTeamChampionship ? (
                                                    <div className="space-y-4">
                                                        <StandingsTable
                                                            standings={ts}
                                                            type="teams"
                                                            title={`${div.name} — Equipos`}
                                                            accentColor="orange"
                                                            showRaceColumns={rc.length > 0}
                                                            showStatsColumns={rc.length > 0}
                                                            raceColumns={rc}
                                                        />
                                                        <StandingsTable
                                                            standings={ds}
                                                            type="drivers"
                                                            title={`${div.name} — Pilotos`}
                                                            accentColor="blue"
                                                            showTeamColumn={true}
                                                            showCategoryColumn={true}
                                                            showRaceColumns={rc.length > 0}
                                                            showStatsColumns={rc.length > 0}
                                                            raceColumns={rc}
                                                            promotionZone={pz}
                                                            relegationZone={rz}
                                                        />
                                                    </div>
                                                ) : (
                                                    <StandingsTable
                                                        standings={ds}
                                                        type="individual"
                                                        title={div.name}
                                                        accentColor="orange"
                                                        showTeamColumn={true}
                                                        showCategoryColumn={true}
                                                        showRaceColumns={rc.length > 0}
                                                        showStatsColumns={rc.length > 0}
                                                        raceColumns={rc}
                                                        promotionZone={pz}
                                                        relegationZone={rz}
                                                    />
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* ── Vista: DIVISIÓN ESPECÍFICA o SIN DIVISIONES ── */}
                                {(!championship?.divisionsConfig?.enabled || !divisions.length || selectedDivision !== 'all') && (
                                    <>
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

                                        {/* Clasificación Individual */}
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
                                    </>
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
                                    {/* Pre-Qualy */}
                                    {championship.preQualy?.enabled && (
                                        <div className="bg-gradient-to-br from-purple-900/60 to-indigo-900/60 rounded-xl p-6 border border-purple-400/40">
                                            <div className="flex items-center gap-3 mb-3">
                                                <span className="text-2xl font-bold text-purple-400">PQ</span>
                                                <div>
                                                    <h3 className="text-xl font-bold text-white">Pre-Qualy</h3>
                                                    <p className="text-purple-300 text-sm">Sesión clasificatoria previa al campeonato</p>
                                                </div>
                                                <span className="ml-auto text-xs bg-purple-500/30 border border-purple-400/40 text-purple-200 px-2 py-1 rounded-full">
                                                    Previa
                                                </span>
                                            </div>
                                            {championship.preQualy.date && (
                                                <div className="text-gray-300 text-sm mb-2">
                                                    📅 {formatDateFull(championship.preQualy.date)}
                                                </div>
                                            )}
                                            {championship.preQualy.duration && (
                                                <div className="text-gray-300 text-sm mb-2">
                                                    ⏱️ {championship.preQualy.duration} min
                                                </div>
                                            )}
                                            {championship.preQualy.track && (
                                                <div className="text-gray-300 text-sm mb-2">
                                                    📍 {championship.preQualy.track}
                                                </div>
                                            )}
                                            {championship.preQualy.allowedCars?.length > 0 && (
                                                <div className="mt-2 inline-flex items-start gap-2 bg-orange-500/15 border border-orange-500/30 text-orange-100 px-3 py-2 rounded-lg text-sm">
                                                    <span className="font-semibold">🚗 Autos obligatorios:</span>
                                                    <span className="text-orange-50">{championship.preQualy.allowedCars.join(', ')}</span>
                                                </div>
                                            )}
                                            {championship.preQualy.rules && (
                                                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                                                    {championship.preQualy.rules.weather && championship.preQualy.rules.weather !== 'clear' && (
                                                        <span className="bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 px-2 py-1 rounded">
                                                            🌧️ {championship.preQualy.rules.weather === 'variable' ? 'Variable' : championship.preQualy.rules.weather === 'rain' ? 'Lluvia' : championship.preQualy.rules.weather}
                                                        </span>
                                                    )}
                                                    {(championship.preQualy.rules.timeMultiplier ?? 1) > 1 && (
                                                        <span className="bg-yellow-500/20 border border-yellow-500/30 text-yellow-300 px-2 py-1 rounded">
                                                            ⏩ x{championship.preQualy.rules.timeMultiplier}
                                                        </span>
                                                    )}
                                                    {championship.preQualy.rules.timeOfDay && (
                                                        <span className="bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 px-2 py-1 rounded">
                                                            🕐 {championship.preQualy.rules.timeOfDay}
                                                        </span>
                                                    )}
                                                    {championship.preQualy.rules.startTime && (
                                                        <span className="bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 px-2 py-1 rounded">
                                                            ⏰ {championship.preQualy.rules.startTime}
                                                        </span>
                                                    )}
                                                    {championship.preQualy.rules.qualySlipstream === false && (
                                                        <span className="bg-gray-500/20 border border-gray-500/30 text-gray-300 px-2 py-1 rounded">
                                                            💨 Sin rebufo
                                                        </span>
                                                    )}
                                                    {championship.preQualy.rules.tireWear > 0 && (
                                                        <span className="bg-orange-500/20 border border-orange-500/30 text-orange-300 px-2 py-1 rounded">
                                                            🛞 Desgaste x{championship.preQualy.rules.tireWear}
                                                        </span>
                                                    )}
                                                    {championship.preQualy.rules.fuelConsumption > 0 && (
                                                        <span className="bg-orange-500/20 border border-orange-500/30 text-orange-300 px-2 py-1 rounded">
                                                            ⛽ Consumo x{championship.preQualy.rules.fuelConsumption}
                                                        </span>
                                                    )}
                                                    {championship.preQualy.rules.mandatoryTyre?.length > 0 && (
                                                        <span className="bg-amber-500/20 border border-amber-500/30 text-amber-300 px-2 py-1 rounded">
                                                            🛞 {championship.preQualy.rules.mandatoryTyre.join(', ')}
                                                        </span>
                                                    )}
                                                    {championship.preQualy.rules.bop === 'yes' && (
                                                        <span className="bg-teal-500/20 border border-teal-500/30 text-teal-300 px-2 py-1 rounded">
                                                            ⚖️ BoP
                                                        </span>
                                                    )}
                                                    {championship.preQualy.rules.mechanicalDamage && championship.preQualy.rules.mechanicalDamage !== 'No' && (
                                                        <span className="bg-red-500/20 border border-red-500/30 text-red-300 px-2 py-1 rounded">
                                                            🔧 Daños: {championship.preQualy.rules.mechanicalDamage}
                                                        </span>
                                                    )}
                                                    {championship.preQualy.rules.penaltyShortcut && championship.preQualy.rules.penaltyShortcut !== 'moderate' && (
                                                        <span className="bg-red-500/20 border border-red-500/30 text-red-300 px-2 py-1 rounded">
                                                            🔀 Atajo: {championship.preQualy.rules.penaltyShortcut}
                                                        </span>
                                                    )}
                                                    {championship.preQualy.rules.penaltyWall && championship.preQualy.rules.penaltyWall !== 'on' && (
                                                        <span className="bg-slate-500/20 border border-slate-500/30 text-slate-300 px-2 py-1 rounded">
                                                            🧱 Muro: {championship.preQualy.rules.penaltyWall}
                                                        </span>
                                                    )}
                                                    {championship.preQualy.rules.penaltyPitLine && championship.preQualy.rules.penaltyPitLine !== 'on' && (
                                                        <span className="bg-slate-500/20 border border-slate-500/30 text-slate-300 px-2 py-1 rounded">
                                                            🏎️ Línea box: {championship.preQualy.rules.penaltyPitLine}
                                                        </span>
                                                    )}
                                                    {championship.preQualy.rules.penaltyCarCollision && championship.preQualy.rules.penaltyCarCollision !== 'on' && (
                                                        <span className="bg-slate-500/20 border border-slate-500/30 text-slate-300 px-2 py-1 rounded">
                                                            💥 Colisión: {championship.preQualy.rules.penaltyCarCollision}
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                            {championship.preQualy.notes && (
                                                <div className="mt-3 bg-purple-500/10 border border-purple-500/20 rounded-lg p-3">
                                                    <p className="text-purple-200 text-sm whitespace-pre-line">{championship.preQualy.notes}</p>
                                                </div>
                                            )}
                                        </div>
                                    )}

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
                                                        {Array.isArray(track.rules.weatherSlots) && track.rules.weatherSlots.length > 0 && (
                                                            <span className="bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 px-2 py-1 rounded">
                                                                🌦️ {track.rules.weatherSlots.length} slot{track.rules.weatherSlots.length > 1 ? 's' : ''} de clima
                                                            </span>
                                                        )}
                                                        {track.rules.timeOfDay && (
                                                            <span className="bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 px-2 py-1 rounded">
                                                                🕐 {track.rules.timeOfDay}
                                                            </span>
                                                        )}
                                                        {(track.rules.mandatoryPitStops ?? 0) > 0 && (
                                                            <span className="bg-red-500/20 border border-red-500/30 text-red-300 px-2 py-1 rounded">
                                                                🛣️ {track.rules.mandatoryPitStops} pit stop{track.rules.mandatoryPitStops > 1 ? 's' : ''} obligatorio{track.rules.mandatoryPitStops > 1 ? 's' : ''}
                                                            </span>
                                                        )}
                                                        {track.rules.mandatoryCompoundChanges && (
                                                            <span className="bg-amber-500/20 border border-amber-500/30 text-amber-300 px-2 py-1 rounded">
                                                                🔄 Cambio de compuesto obligatorio
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
                                                        {/* Rebufo */}
                                                        {track.rules.raceSlipstream === false && (
                                                            <span className="bg-gray-500/20 border border-gray-500/30 text-gray-300 px-2 py-1 rounded">
                                                                💨 Sin rebufo
                                                            </span>
                                                        )}
                                                        {track.rules.qualySlipstream === false && (
                                                            <span className="bg-gray-500/20 border border-gray-500/30 text-gray-300 px-2 py-1 rounded">
                                                                🎯 Sin rebufo qualy
                                                            </span>
                                                        )}
                                                        {/* Combustible inicial */}
                                                        {track.rules.startingFuel != null && track.rules.startingFuel < 100 && (
                                                            <span className="bg-orange-500/20 border border-orange-500/30 text-orange-300 px-2 py-1 rounded">
                                                                ⛽ Sale con {track.rules.startingFuel}%
                                                            </span>
                                                        )}
                                                        {track.rules.tireWear > 0 && (
                                                            <span className="bg-orange-500/20 border border-orange-500/30 text-orange-300 px-2 py-1 rounded">
                                                                🛞 Desgaste x{track.rules.tireWear}
                                                            </span>
                                                        )}
                                                        {track.rules.qualyTireWear && (
                                                            <span className="bg-orange-500/20 border border-orange-500/30 text-orange-300 px-2 py-1 rounded">
                                                                🎯 Desgaste en qualy
                                                            </span>
                                                        )}
                                                        {track.rules.fuelConsumption > 0 && (
                                                            <span className="bg-orange-500/20 border border-orange-500/30 text-orange-300 px-2 py-1 rounded">
                                                                ⛽ Consumo x{track.rules.fuelConsumption}
                                                            </span>
                                                        )}
                                                        {track.rules.fuelRefillRate && (
                                                            <span className="bg-orange-500/20 border border-orange-500/30 text-orange-300 px-2 py-1 rounded">
                                                                🚰 Recarga {track.rules.fuelRefillRate} L/s
                                                            </span>
                                                        )}
                                                        {track.rules.mechanicalDamage && track.rules.mechanicalDamage !== 'No' && (
                                                            <span className="bg-red-500/20 border border-red-500/30 text-red-300 px-2 py-1 rounded">
                                                                🔧 Daños: {track.rules.mechanicalDamage}
                                                            </span>
                                                        )}
                                                        {track.rules.adjustments === 'no' && (
                                                            <span className="bg-gray-500/20 border border-gray-500/30 text-gray-300 px-2 py-1 rounded">
                                                                🔧 Sin ajustes
                                                            </span>
                                                        )}
                                                        {track.rules.engineSwap === 'yes' && (
                                                            <span className="bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 px-2 py-1 rounded">
                                                                🔄 Engine swap permitido
                                                            </span>
                                                        )}
                                                        {track.rules.penalties === 'no' && (
                                                            <span className="bg-gray-500/20 border border-gray-500/30 text-gray-300 px-2 py-1 rounded">
                                                                ⚠️ Penalización general: Off
                                                            </span>
                                                        )}
                                                        {/* Penalizaciones específicas */}
                                                        {track.rules.penaltyShortcut && track.rules.penaltyShortcut !== 'moderate' && (
                                                            <span className="bg-red-500/20 border border-red-500/30 text-red-300 px-2 py-1 rounded">
                                                                🔀 Atajo: {track.rules.penaltyShortcut === 'strong' ? 'Fuerte' : track.rules.penaltyShortcut === 'weak' ? 'Leve' : 'Off'}
                                                            </span>
                                                        )}
                                                        {track.rules.penaltyWall === 'off' && (
                                                            <span className="bg-slate-500/20 border border-slate-500/30 text-slate-300 px-2 py-1 rounded">
                                                                🧱 Muro: Off
                                                            </span>
                                                        )}
                                                        {track.rules.penaltyPitLine === 'off' && (
                                                            <span className="bg-slate-500/20 border border-slate-500/30 text-slate-300 px-2 py-1 rounded">
                                                                🏎️ Línea box: Off
                                                            </span>
                                                        )}
                                                        {track.rules.penaltyCarCollision === 'off' && (
                                                            <span className="bg-slate-500/20 border border-slate-500/30 text-slate-300 px-2 py-1 rounded">
                                                                💥 Colisión coche: Off
                                                            </span>
                                                        )}
                                                        {track.rules.abs && track.rules.abs !== 'default' && (
                                                            <span className="bg-violet-500/20 border border-violet-500/30 text-violet-300 px-2 py-1 rounded">
                                                                ABS: {track.rules.abs}
                                                            </span>
                                                        )}
                                                        {track.rules.tcs && track.rules.tcs !== 'default' && (
                                                            <span className="bg-violet-500/20 border border-violet-500/30 text-violet-300 px-2 py-1 rounded">
                                                                TCS: {track.rules.tcs}
                                                            </span>
                                                        )}
                                                        {track.rules.asm && track.rules.asm !== 'default' && (
                                                            <span className="bg-violet-500/20 border border-violet-500/30 text-violet-300 px-2 py-1 rounded">
                                                                ASM: {track.rules.asm}
                                                            </span>
                                                        )}
                                                        {track.rules.counterSteering && track.rules.counterSteering !== 'default' && (
                                                            <span className="bg-violet-500/20 border border-violet-500/30 text-violet-300 px-2 py-1 rounded">
                                                                Contravolante: {track.rules.counterSteering}
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

                                                {/* Botón Ver Detalles */}
                                                <div className="mt-4 pt-4 border-t border-white/10 flex justify-end">
                                                    <button
                                                        onClick={() => setSelectedTrack(track)}
                                                        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600/30 hover:bg-blue-600/50 border border-blue-400/40 text-blue-200 rounded-lg text-sm font-semibold transition-all"
                                                    >
                                                        📋 Ver Detalles
                                                    </button>
                                                </div>
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

                        {/* TAB: Salas / Divisiones */}
                        {activeTab === 'salas' && championship?.divisionsConfig?.enabled && (() => {
                            const maxPerSala = championship.divisionsConfig.maxDriversPerDivision || 15;
                            const approvedRegistrations = (championship.registrations || [])
                                .filter(r => r.status === 'approved' || !championship.registration?.requiresApproval);
                            const totalAssigned = divisions.reduce((sum, d) => sum + (d.drivers || []).length, 0);
                            const allAssignedDrivers = new Set(divisions.flatMap(d => d.drivers || []));
                            // Identificar por gt7Id (campo principal) o psnId/name como fallback
                            const unassigned = approvedRegistrations.filter(r => {
                                const id = r.gt7Id || r.psnId || r.name;
                                return !allAssignedDrivers.has(id);
                            });

                            return (
                                <div className="space-y-6">
                                    <div className="flex items-center justify-between">
                                        <h2 className="text-3xl font-bold text-white flex items-center gap-3">
                                            🏟️ Salas y Divisiones
                                        </h2>
                                        <div className="flex items-center gap-3 text-sm text-gray-400">
                                            <span>👥 {totalAssigned} / {approvedRegistrations.length} inscritos asignados</span>
                                        </div>
                                    </div>

                                    {/* Resumen */}
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                        <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
                                            <div className="text-2xl font-bold text-orange-400">{divisions.length}</div>
                                            <div className="text-gray-400 text-xs mt-1">Salas activas</div>
                                        </div>
                                        <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
                                            <div className="text-2xl font-bold text-blue-400">{maxPerSala}</div>
                                            <div className="text-gray-400 text-xs mt-1">Máx. pilotos/sala</div>
                                        </div>
                                        <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
                                            <div className="text-2xl font-bold text-green-400">{totalAssigned}</div>
                                            <div className="text-gray-400 text-xs mt-1">Pilotos asignados</div>
                                        </div>
                                        <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
                                            <div className="text-2xl font-bold text-yellow-400">{unassigned.length}</div>
                                            <div className="text-gray-400 text-xs mt-1">Sin asignar</div>
                                        </div>
                                    </div>

                                    {/* Cards de cada sala */}
                                    {divisions.length === 0 ? (
                                        <div className="bg-white/5 border border-white/10 rounded-xl p-10 text-center">
                                            <div className="text-5xl mb-3">🏟️</div>
                                            <p className="text-gray-300 font-semibold mb-1">Aún no se han configurado las salas</p>
                                            <p className="text-gray-500 text-sm">Las salas se asignarán una vez finalice el proceso de Pre-Qualy</p>
                                        </div>
                                    ) : (
                                        <div className="grid sm:grid-cols-2 gap-6">
                                            {divisions.sort((a, b) => (a.order || 0) - (b.order || 0)).map(div => {
                                                const pilots = div.drivers || [];
                                                const spotsUsed = pilots.length;
                                                const spotsLeft = maxPerSala - spotsUsed;
                                                const fillPct = Math.min((spotsUsed / maxPerSala) * 100, 100);
                                                const divColor = div.color || '#f97316';

                                                return (
                                                    <div
                                                        key={div.id}
                                                        className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl border overflow-hidden"
                                                        style={{ borderColor: `${divColor}40` }}
                                                    >
                                                        {/* Header de la sala */}
                                                        <div
                                                            className="px-5 py-4 flex items-center justify-between"
                                                            style={{ background: `linear-gradient(135deg, ${divColor}20, ${divColor}08)` }}
                                                        >
                                                            <div className="flex items-center gap-3">
                                                                <div
                                                                    className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow"
                                                                    style={{ backgroundColor: divColor }}
                                                                >
                                                                    {div.order || '—'}
                                                                </div>
                                                                <div>
                                                                    <div className="text-white font-bold text-lg leading-tight">{div.name}</div>
                                                                    <div className="text-xs mt-0.5" style={{ color: `${divColor}cc` }}>Sala {div.order}</div>
                                                                </div>
                                                            </div>
                                                            <div className="text-right">
                                                                <div className="text-white font-bold text-xl">{spotsUsed}<span className="text-gray-400 text-sm font-normal">/{maxPerSala}</span></div>
                                                                <div className="text-xs text-gray-400">{spotsLeft > 0 ? `${spotsLeft} libre${spotsLeft > 1 ? 's' : ''}` : 'Completa'}</div>
                                                            </div>
                                                        </div>

                                                        {/* Barra de progreso de ocupación */}
                                                        <div className="px-5 py-2 bg-black/20">
                                                            <div className="w-full bg-white/10 rounded-full h-1.5">
                                                                <div
                                                                    className="h-full rounded-full transition-all"
                                                                    style={{ width: `${fillPct}%`, backgroundColor: divColor }}
                                                                />
                                                            </div>
                                                        </div>

                                                        {/* Caster / Host / Stream */}
                                                        {(div.casterName || div.hostName || div.streamUrl) && (
                                                            <div className="px-5 py-3 border-b flex flex-wrap gap-3 text-sm" style={{ borderColor: `${divColor}20` }}>
                                                                {div.casterName && (
                                                                    <div className="flex items-center gap-1.5 text-gray-300">
                                                                        <span className="text-base">🎙️</span>
                                                                        <span className="font-medium text-white">{div.casterName}</span>
                                                                    </div>
                                                                )}
                                                                {div.hostName && (
                                                                    <div className="flex items-center gap-1.5 text-gray-300">
                                                                        <span className="text-base">🏠</span>
                                                                        <span>{div.hostName}</span>
                                                                    </div>
                                                                )}
                                                                {div.streamUrl && (
                                                                    <a
                                                                        href={div.streamUrl}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className="flex items-center gap-1.5 text-blue-300 hover:text-blue-100 transition-colors"
                                                                    >
                                                                        <span>📺</span>
                                                                        <span className="underline">Ver Stream</span>
                                                                    </a>
                                                                )}
                                                            </div>
                                                        )}

                                                        {/* Lista de pilotos */}
                                                        <div className="px-5 py-4">
                                                            {pilots.length === 0 ? (
                                                                <p className="text-gray-500 text-sm text-center py-2">Sin pilotos asignados aún</p>
                                                            ) : (
                                                                <ul className="space-y-1.5">
                                                                    {pilots.map((driver, idx) => (
                                                                        <li key={driver} className="flex items-center gap-3 py-1.5 px-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
                                                                            <span
                                                                                className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                                                                                style={{ backgroundColor: `${divColor}60`, border: `1px solid ${divColor}50` }}
                                                                            >
                                                                                {idx + 1}
                                                                            </span>
                                                                            <span className="text-white text-sm font-medium">{driver}</span>
                                                                        </li>
                                                                    ))}
                                                                </ul>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}

                                    {/* Pilotos inscritos sin asignar */}
                                    {unassigned.length > 0 && (
                                        <div className="bg-yellow-500/10 border border-yellow-400/30 rounded-xl p-5">
                                            <h3 className="text-yellow-200 font-bold mb-3 flex items-center gap-2">
                                                ⏳ Pilotos pendientes de asignación
                                                <span className="bg-yellow-500/20 text-yellow-200 text-xs px-2 py-0.5 rounded-full">{unassigned.length}</span>
                                            </h3>
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-sm">
                                                    <thead>
                                                        <tr className="text-left text-xs text-gray-400 border-b border-white/10">
                                                            <th className="pb-2 pr-4">#</th>
                                                            <th className="pb-2 pr-4">GT7 ID</th>
                                                            <th className="pb-2 pr-4">PSN ID</th>
                                                            <th className="pb-2">Estado</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-white/5">
                                                        {unassigned.map((r, idx) => (
                                                            <tr key={r.id || idx} className="hover:bg-white/5">
                                                                <td className="py-2 pr-4 text-gray-500 font-mono text-xs">{idx + 1}</td>
                                                                <td className="py-2 pr-4 text-white font-medium">{r.gt7Id || r.name || '—'}</td>
                                                                <td className="py-2 pr-4 text-gray-300">{r.psnId || '—'}</td>
                                                                <td className="py-2">
                                                                    <span className="text-yellow-400 text-xs bg-yellow-500/10 px-2 py-0.5 rounded-full">⏳ Sin sala</span>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}

                                    {/* Info de ascenso/descenso */}
                                    {(championship.divisionsConfig.promotionCount > 0 || championship.divisionsConfig.relegationCount > 0) && (
                                        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                                            <h3 className="text-white font-bold mb-3">🔄 Sistema de Ascenso / Descenso</h3>
                                            <div className="flex flex-wrap gap-4 text-sm">
                                                {championship.divisionsConfig.promotionCount > 0 && (
                                                    <div className="flex items-center gap-2">
                                                        <span className="w-3 h-3 rounded-full bg-green-500 inline-block"></span>
                                                        <span className="text-gray-300">Ascienden los <strong className="text-green-400">{championship.divisionsConfig.promotionCount}</strong> primeros</span>
                                                    </div>
                                                )}
                                                {championship.divisionsConfig.relegationCount > 0 && (
                                                    <div className="flex items-center gap-2">
                                                        <span className="w-3 h-3 rounded-full bg-red-500 inline-block"></span>
                                                        <span className="text-gray-300">Descienden los últimos <strong className="text-red-400">{championship.divisionsConfig.relegationCount}</strong></span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })()}

                        {/* TAB: Pre-Qualy */}
                        {activeTab === 'prequaly' && championship?.preQualy?.enabled && (() => {
                            const pq = championship.preQualy;
                            const results = pq.results || [];
                            const classified = results.filter(r => r.classified !== false);
                            const notClassified = results.filter(r => r.classified === false);
                            return (
                                <div className="space-y-6">
                                    <h2 className="text-3xl font-bold text-white flex items-center gap-3">
                                        🎯 Pre-Qualy
                                    </h2>

                                    {/* Info de la sesión */}
                                    <div className="bg-gradient-to-br from-purple-900/60 to-indigo-900/60 rounded-xl p-6 border border-purple-400/40">
                                        <div className="flex items-center gap-3 mb-4">
                                            <span className="text-2xl font-bold text-purple-400">PQ</span>
                                            <div>
                                                <h3 className="text-lg font-bold text-white">Sesión clasificatoria previa</h3>
                                                <p className="text-purple-300 text-sm">Los resultados determinan la asignación a salas</p>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                                            {pq.date && (
                                                <div className="bg-white/5 rounded-lg p-3">
                                                    <div className="text-gray-400 text-xs mb-1">📅 Fecha</div>
                                                    <div className="text-white font-medium">{new Date(pq.date).toLocaleDateString('es-ES')}</div>
                                                </div>
                                            )}
                                            {pq.track && (
                                                <div className="bg-white/5 rounded-lg p-3">
                                                    <div className="text-gray-400 text-xs mb-1">📍 Circuito</div>
                                                    <div className="text-white font-medium">{pq.track}</div>
                                                </div>
                                            )}
                                            <div className="bg-white/5 rounded-lg p-3">
                                                <div className="text-gray-400 text-xs mb-1">⏱️ Duración</div>
                                                <div className="text-white font-medium">{pq.duration ?? 15} min</div>
                                            </div>
                                            <div className="bg-white/5 rounded-lg p-3">
                                                <div className="text-gray-400 text-xs mb-1">🏁 Clasificados</div>
                                                <div className="text-white font-medium">{classified.length} / {results.length}</div>
                                            </div>
                                        </div>
                                        {pq.allowedCars?.length > 0 && (
                                            <div className="mt-3 inline-flex items-center gap-2 bg-orange-500/15 border border-orange-500/30 text-orange-100 px-3 py-2 rounded-lg text-sm">
                                                <span className="font-semibold">🚗 Autos:</span>
                                                <span>{pq.allowedCars.join(', ')}</span>
                                            </div>
                                        )}
                                        {pq.notes && (
                                            <p className="mt-3 text-purple-200 text-sm bg-purple-500/10 rounded-lg p-3">{pq.notes}</p>
                                        )}
                                    </div>

                                    {/* Resultados */}
                                    {results.length === 0 ? (
                                        <div className="bg-white/5 border border-white/10 rounded-xl p-10 text-center">
                                            <div className="text-4xl mb-3">⏳</div>
                                            <p className="text-gray-300 font-semibold">Resultados pendientes</p>
                                            <p className="text-gray-500 text-sm mt-1">Los resultados se publicarán una vez finalice la sesión</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            {/* Tabla clasificados */}
                                            <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
                                                <div className="px-5 py-3 border-b border-white/10 flex items-center gap-2">
                                                    <span className="text-green-400 font-bold">✅ Clasificados</span>
                                                    <span className="bg-green-500/20 text-green-300 text-xs px-2 py-0.5 rounded-full">{classified.length}</span>
                                                </div>
                                                <table className="w-full text-sm">
                                                    <thead>
                                                        <tr className="text-left text-xs text-gray-400 border-b border-white/10 bg-white/5">
                                                            <th className="px-5 py-2 w-10">Pos</th>
                                                            <th className="px-5 py-2">Piloto (GT7 ID)</th>
                                                            <th className="px-5 py-2 text-right">Tiempo</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-white/5">
                                                        {classified.map((r, idx) => (
                                                            <tr key={idx} className={`hover:bg-white/5 transition-colors ${idx < 3 ? 'bg-yellow-500/5' : ''}`}>
                                                                <td className="px-5 py-3">
                                                                    {idx === 0 && <span className="text-yellow-400 font-bold">🥇</span>}
                                                                    {idx === 1 && <span className="text-gray-300 font-bold">🥈</span>}
                                                                    {idx === 2 && <span className="text-orange-400 font-bold">🥉</span>}
                                                                    {idx > 2 && <span className="text-gray-500 font-mono">{idx + 1}</span>}
                                                                </td>
                                                                <td className="px-5 py-3 text-white font-medium">{r.driverName}</td>
                                                                <td className="px-5 py-3 text-right font-mono text-yellow-300">{r.time || '—'}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>

                                            {/* No clasificados */}
                                            {notClassified.length > 0 && (
                                                <div className="bg-white/5 border border-red-400/20 rounded-xl overflow-hidden">
                                                    <div className="px-5 py-3 border-b border-white/10 flex items-center gap-2">
                                                        <span className="text-red-400 font-bold">❌ No clasificados</span>
                                                        <span className="bg-red-500/20 text-red-300 text-xs px-2 py-0.5 rounded-full">{notClassified.length}</span>
                                                    </div>
                                                    <div className="divide-y divide-white/5">
                                                        {notClassified.map((r, idx) => (
                                                            <div key={idx} className="px-5 py-3 flex items-center justify-between">
                                                                <span className="text-gray-400">{r.driverName}</span>
                                                                <span className="text-gray-600 font-mono text-sm">{r.time || '—'}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })()}

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
                                            {championship.settings?.isTeamChampionship && championship.settings?.maxTeams && (
                                                <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                                                    <span className="text-gray-300">Máximo de Equipos</span>
                                                    <span className="text-white font-semibold">{championship.settings.maxTeams}</span>
                                                </div>
                                            )}
                                            {championship.settings?.isTeamChampionship && championship.settings?.maxDriversPerTeam && (
                                                <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                                                    <span className="text-gray-300">Pilotos por Equipo</span>
                                                    <span className="text-white font-semibold">{championship.settings.maxDriversPerTeam}</span>
                                                </div>
                                            )}
                                            {championship.divisionsConfig?.enabled && championship.divisionsConfig?.maxDriversPerDivision && (
                                                <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                                                    <span className="text-gray-300">Máx. pilotos por división</span>
                                                    <span className="text-white font-semibold">{championship.divisionsConfig.maxDriversPerDivision}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {championship.penaltiesConfig?.enabled && (
                                        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-6 border border-white/10">
                                            <h3 className="text-xl font-bold text-white mb-4">⚠️ Sistema de Sanciones</h3>
                                            <div className="space-y-3">
                                                <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                                                    <span className="text-gray-300">Reclamaciones públicas</span>
                                                    <span className="text-white font-semibold">
                                                        {championship.penaltiesConfig.allowClaims ? '✅ Activas' : '❌ Desactivadas'}
                                                    </span>
                                                </div>
                                                <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                                                    <span className="text-gray-300">Umbral de amonestaciones</span>
                                                    <span className="text-white font-semibold">{championship.penaltiesConfig.warningThreshold ?? 8}</span>
                                                </div>
                                                <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                                                    <span className="text-gray-300">Auto-deducción de puntos</span>
                                                    <span className="text-white font-semibold">-{championship.penaltiesConfig.autoPointsPenalty ?? 10} pts</span>
                                                </div>
                                                <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                                                    <span className="text-gray-300">Umbral de descalificación</span>
                                                    <span className="text-white font-semibold">{championship.penaltiesConfig.autoDisqualifyThreshold ?? 16}</span>
                                                </div>
                                                {Array.isArray(championship.penaltiesConfig.presets) && (
                                                    <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                                                        <span className="text-gray-300">Presets activos</span>
                                                        <span className="text-white font-semibold">
                                                            {championship.penaltiesConfig.presets.filter(p => p.active).length}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

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
                                                <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                                                    <span className="text-gray-300">Alerta en uso #</span>
                                                    <span className="text-white font-semibold">{championship.carUsageTracking.alertThreshold ?? 1}</span>
                                                </div>
                                                <p className="text-gray-400 text-xs">
                                                    Cada piloto puede usar el mismo auto un máximo de {championship.carUsageTracking.maxUsesPerCar} veces durante el campeonato.
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Pre-Qualy */}
                                    {championship.preQualy?.enabled && (
                                        <div className="bg-gradient-to-br from-purple-900/40 to-indigo-900/40 rounded-xl p-6 border border-purple-400/30">
                                            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                                                <span className="bg-purple-600 text-white text-xs font-bold px-2 py-1 rounded-full">PQ</span>
                                                Pre-Qualy
                                            </h3>
                                            <div className="grid md:grid-cols-2 gap-4 mb-4">
                                                {championship.preQualy.date && (
                                                    <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                                                        <span className="text-gray-300">📅 Fecha</span>
                                                        <span className="text-white font-semibold">{formatDateFull(championship.preQualy.date)}</span>
                                                    </div>
                                                )}
                                                {championship.preQualy.track && (
                                                    <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                                                        <span className="text-gray-300">📍 Circuito</span>
                                                        <span className="text-white font-semibold">{championship.preQualy.track}</span>
                                                    </div>
                                                )}
                                                {championship.preQualy.duration && (
                                                    <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                                                        <span className="text-gray-300">⏱️ Duración</span>
                                                        <span className="text-white font-semibold">{championship.preQualy.duration} min</span>
                                                    </div>
                                                )}
                                                {championship.preQualy.allowedCars?.length > 0 && (
                                                    <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                                                        <span className="text-gray-300">🚗 Autos</span>
                                                        <span className="text-white font-semibold text-right text-sm">{championship.preQualy.allowedCars.join(', ')}</span>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Reglas PQ */}
                                            {championship.preQualy.rules && (
                                                <div className="mb-4">
                                                    <div className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">Configuración de sesión</div>
                                                    <div className="flex flex-wrap gap-2 text-xs">
                                                        {championship.preQualy.rules.weather && championship.preQualy.rules.weather !== 'clear' && (
                                                            <span className="bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 px-2 py-1 rounded">🌧️ {championship.preQualy.rules.weather === 'rain' ? 'Lluvia' : championship.preQualy.rules.weather === 'variable' ? 'Variable' : championship.preQualy.rules.weather}</span>
                                                        )}
                                                        {championship.preQualy.rules.timeOfDay && (
                                                            <span className="bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 px-2 py-1 rounded">🕐 {championship.preQualy.rules.timeOfDay}</span>
                                                        )}
                                                        {championship.preQualy.rules.startTime && (
                                                            <span className="bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 px-2 py-1 rounded">⏰ {championship.preQualy.rules.startTime}</span>
                                                        )}
                                                        {(championship.preQualy.rules.timeMultiplier ?? 1) > 1 && (
                                                            <span className="bg-yellow-500/20 border border-yellow-500/30 text-yellow-300 px-2 py-1 rounded">⏩ x{championship.preQualy.rules.timeMultiplier}</span>
                                                        )}
                                                        {championship.preQualy.rules.tireWear > 0 && (
                                                            <span className="bg-orange-500/20 border border-orange-500/30 text-orange-300 px-2 py-1 rounded">🛞 Desgaste x{championship.preQualy.rules.tireWear}</span>
                                                        )}
                                                        {championship.preQualy.rules.fuelConsumption > 0 && (
                                                            <span className="bg-orange-500/20 border border-orange-500/30 text-orange-300 px-2 py-1 rounded">⛽ Consumo x{championship.preQualy.rules.fuelConsumption}</span>
                                                        )}
                                                        {championship.preQualy.rules.mechanicalDamage && championship.preQualy.rules.mechanicalDamage !== 'No' && (
                                                            <span className="bg-red-500/20 border border-red-500/30 text-red-300 px-2 py-1 rounded">🔧 Daños: {championship.preQualy.rules.mechanicalDamage}</span>
                                                        )}
                                                        {championship.preQualy.rules.bop === 'yes' && (
                                                            <span className="bg-teal-500/20 border border-teal-500/30 text-teal-300 px-2 py-1 rounded">⚖️ BoP</span>
                                                        )}
                                                        {championship.preQualy.rules.qualySlipstream === false && (
                                                            <span className="bg-gray-500/20 border border-gray-500/30 text-gray-300 px-2 py-1 rounded">💨 Sin rebufo</span>
                                                        )}
                                                        {championship.preQualy.rules.mandatoryTyre?.length > 0 && (
                                                            <span className="bg-amber-500/20 border border-amber-500/30 text-amber-300 px-2 py-1 rounded">🛞 {championship.preQualy.rules.mandatoryTyre.join(', ')}</span>
                                                        )}
                                                        {championship.preQualy.rules.penaltyShortcut && championship.preQualy.rules.penaltyShortcut !== 'moderate' && (
                                                            <span className="bg-red-500/20 border border-red-500/30 text-red-300 px-2 py-1 rounded">🔀 Atajo: {championship.preQualy.rules.penaltyShortcut === 'strong' ? 'Fuerte' : championship.preQualy.rules.penaltyShortcut === 'weak' ? 'Leve' : 'Off'}</span>
                                                        )}
                                                        {championship.preQualy.rules.penaltyWall === 'off' && (
                                                            <span className="bg-slate-500/20 border border-slate-500/30 text-slate-300 px-2 py-1 rounded">🧱 Muro: Off</span>
                                                        )}
                                                        {championship.preQualy.rules.penaltyPitLine === 'off' && (
                                                            <span className="bg-slate-500/20 border border-slate-500/30 text-slate-300 px-2 py-1 rounded">🏎️ Línea box: Off</span>
                                                        )}
                                                        {championship.preQualy.rules.penaltyCarCollision === 'off' && (
                                                            <span className="bg-slate-500/20 border border-slate-500/30 text-slate-300 px-2 py-1 rounded">💥 Colisión: Off</span>
                                                        )}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Notas PQ */}
                                            {championship.preQualy.notes && (
                                                <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-3 mb-4">
                                                    <p className="text-purple-200 text-sm whitespace-pre-line">{championship.preQualy.notes}</p>
                                                </div>
                                            )}

                                            {/* Lista de inscritos para Pre-Qualy */}
                                            {(() => {
                                                const registrations = championship.registrations || [];
                                                const eligible = registrations.filter(r =>
                                                    r.status === 'approved' || (!championship.registration?.requiresApproval && r.status !== 'rejected')
                                                );
                                                if (eligible.length === 0) return null;
                                                return (
                                                    <div>
                                                        <div className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2 flex items-center justify-between">
                                                            <span>📋 Clasificación Pre-Qualy ({eligible.length} habilitados)</span>
                                                            {championship?.divisionsConfig?.enabled && (
                                                                <span className="text-purple-300 normal-case font-normal">Resultado determina asignación de salas</span>
                                                            )}
                                                        </div>
                                                        <div className="space-y-2">
                                                            {eligible.map((r, idx) => {
                                                                const divAssigned = divisions.find(d => (d.drivers || []).includes(r.name));
                                                                return (
                                                                    <div key={r.id || idx} className="flex items-center gap-3 bg-white/5 hover:bg-white/8 rounded-lg px-3 py-2.5 transition-colors">
                                                                        <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white bg-purple-600/50 flex-shrink-0">
                                                                            {idx + 1}
                                                                        </span>
                                                                        <div className="flex-1 min-w-0">
                                                                            <span className="text-white font-medium text-sm">{r.name}</span>
                                                                            {r.psnId && <span className="text-gray-500 text-xs ml-2">@{r.psnId}</span>}
                                                                        </div>
                                                                        {divAssigned ? (
                                                                            <span
                                                                                className="text-xs px-2 py-0.5 rounded-full font-semibold flex-shrink-0"
                                                                                style={{ backgroundColor: `${divAssigned.color || '#f97316'}25`, color: divAssigned.color || '#f97316', border: `1px solid ${divAssigned.color || '#f97316'}40` }}
                                                                            >
                                                                                {divAssigned.name}
                                                                            </span>
                                                                        ) : championship?.divisionsConfig?.enabled ? (
                                                                            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-600/30 text-gray-400 border border-gray-600/30 flex-shrink-0">
                                                                                Por asignar
                                                                            </span>
                                                                        ) : null}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                );
                                            })()}
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
                            {championship.registration?.enabled && !['completed', 'archived'].includes(championship.status) && (
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
                                    <div className="text-sm text-gray-300 mb-2">
                                        🧾 Aprobación: {championship.registration?.requiresApproval ? 'Manual' : 'Automática'}
                                    </div>
                                    <div className="text-sm text-gray-300 mb-2">
                                        ✅ Aceptar reglamento: {championship.registration?.acceptRules ? 'Sí' : 'No'}
                                    </div>
                                    {championship.registration?.fields?.length > 0 && (
                                        <div className="text-sm text-gray-300 mb-3">
                                            📌 Campos: {championship.registration.fields.join(', ')}
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

            {/* Modal Detalles de Circuito */}
            {selectedTrack && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setSelectedTrack(null)}>
                    <div
                        className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl border border-white/10 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header del modal */}
                        <div className="flex items-center justify-between p-6 border-b border-white/10">
                            <div>
                                <div className="flex items-center gap-3 mb-1">
                                    <span className="text-2xl font-bold text-orange-400">R{selectedTrack.round}</span>
                                    <h2 className="text-2xl font-bold text-white">{selectedTrack.name}</h2>
                                </div>
                                <div className="flex items-center gap-3 text-gray-400 text-sm flex-wrap">
                                    {selectedTrack.date && <span>📅 {formatDateFull(selectedTrack.date)}</span>}
                                    {selectedTrack.country && <span>📍 {selectedTrack.country}</span>}
                                </div>
                            </div>
                            <button
                                onClick={() => setSelectedTrack(null)}
                                className="text-gray-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/10"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="p-6 space-y-6">
                            {/* Layout del circuito */}
                            {selectedTrack.layoutImage && (
                                <div className="relative w-full h-48 bg-black/30 rounded-xl overflow-hidden">
                                    <Image src={selectedTrack.layoutImage} alt={selectedTrack.name} fill className="object-contain p-3" />
                                </div>
                            )}

                            {/* Formato de carrera */}
                            <div className="bg-white/5 rounded-xl p-4">
                                <h3 className="text-white font-bold mb-3">🏁 Formato de Carrera</h3>
                                <div className="grid grid-cols-2 gap-3 text-sm">
                                    {selectedTrack.category && (
                                        <div>
                                            <div className="text-gray-400 mb-1">Categoría</div>
                                            <div className="text-white font-semibold">{selectedTrack.category}</div>
                                        </div>
                                    )}
                                    <div>
                                        <div className="text-gray-400 mb-1">Tipo de Carrera</div>
                                        <div className="text-white font-semibold">
                                            {selectedTrack.raceType === 'sprint_carrera' ? '⚡ Sprint + Carrera' :
                                                selectedTrack.raceType === 'resistencia' ? `⏱️ Resistencia (${selectedTrack.duration} min)` :
                                                    selectedTrack.raceType === 'carrera' ? `🏁 ${selectedTrack.laps} vueltas` : '🏁 Carrera'}
                                        </div>
                                    </div>
                                    {selectedTrack.status && (
                                        <div>
                                            <div className="text-gray-400 mb-1">Estado</div>
                                            <div className="text-white font-semibold capitalize">
                                                {selectedTrack.status === 'completed' ? '✅ Completada' :
                                                    selectedTrack.status === 'in-progress' ? '⏱️ En Curso' :
                                                        selectedTrack.status === 'scheduled' ? '📅 Programada' : selectedTrack.status}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Autos específicos */}
                            {selectedTrack.specificCars && (
                                <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-4">
                                    <h3 className="text-orange-200 font-bold mb-2">🚗 Autos Obligatorios</h3>
                                    <p className="text-orange-100 text-sm">
                                        {(selectedTrack.allowedCars && selectedTrack.allowedCars.length > 0)
                                            ? selectedTrack.allowedCars.join(', ')
                                            : 'Lista pendiente'}
                                    </p>
                                </div>
                            )}

                            {/* Reglas completas */}
                            {selectedTrack.rules && (
                                <div className="bg-white/5 rounded-xl p-4">
                                    <h3 className="text-white font-bold mb-3">⚙️ Configuración de Carrera</h3>
                                    <div className="grid grid-cols-2 gap-3 text-sm">
                                        {selectedTrack.rules.weather && (
                                            <div>
                                                <div className="text-gray-400 mb-1">🌤️ Clima</div>
                                                <div className="text-white font-semibold">
                                                    {selectedTrack.rules.weather === 'clear' ? 'Despejado' :
                                                        selectedTrack.rules.weather === 'rain' ? '🌧️ Lluvia' :
                                                            selectedTrack.rules.weather === 'variable' ? '🌦️ Variable' : selectedTrack.rules.weather}
                                                </div>
                                            </div>
                                        )}
                                        {selectedTrack.rules.timeOfDay && (
                                            <div>
                                                <div className="text-gray-400 mb-1">🕐 Hora del Día</div>
                                                <div className="text-white font-semibold">{selectedTrack.rules.timeOfDay}</div>
                                            </div>
                                        )}
                                        {selectedTrack.rules.startTime && (
                                            <div>
                                                <div className="text-gray-400 mb-1">⏰ Hora de Inicio</div>
                                                <div className="text-white font-semibold">{selectedTrack.rules.startTime}</div>
                                            </div>
                                        )}
                                        {(selectedTrack.rules.timeMultiplier ?? 1) !== 1 && (
                                            <div>
                                                <div className="text-gray-400 mb-1">⏩ Multiplicador de Tiempo</div>
                                                <div className="text-white font-semibold">x{selectedTrack.rules.timeMultiplier}</div>
                                            </div>
                                        )}
                                        {selectedTrack.rules.tireWear != null && (
                                            <div>
                                                <div className="text-gray-400 mb-1">🛞 Desgaste de Neumáticos</div>
                                                <div className="text-white font-semibold">
                                                    {selectedTrack.rules.tireWear > 0 ? `x${selectedTrack.rules.tireWear}` : 'Off'}
                                                </div>
                                            </div>
                                        )}
                                        {selectedTrack.rules.fuelConsumption != null && (
                                            <div>
                                                <div className="text-gray-400 mb-1">⛽ Consumo de Combustible</div>
                                                <div className="text-white font-semibold">
                                                    {selectedTrack.rules.fuelConsumption > 0 ? `x${selectedTrack.rules.fuelConsumption}` : 'Off'}
                                                </div>
                                            </div>
                                        )}
                                        {selectedTrack.rules.startingFuel != null && (
                                            <div>
                                                <div className="text-gray-400 mb-1">⛽ Combustible Inicial</div>
                                                <div className="text-white font-semibold">{selectedTrack.rules.startingFuel}%</div>
                                            </div>
                                        )}
                                        {selectedTrack.rules.fuelRefillRate && (
                                            <div>
                                                <div className="text-gray-400 mb-1">🚰 Velocidad de Recarga</div>
                                                <div className="text-white font-semibold">{selectedTrack.rules.fuelRefillRate} L/s</div>
                                            </div>
                                        )}
                                        {selectedTrack.rules.mechanicalDamage && (
                                            <div>
                                                <div className="text-gray-400 mb-1">🔧 Daño Mecánico</div>
                                                <div className="text-white font-semibold">{selectedTrack.rules.mechanicalDamage}</div>
                                            </div>
                                        )}
                                        {selectedTrack.rules.bop && (
                                            <div>
                                                <div className="text-gray-400 mb-1">⚖️ Balance of Performance</div>
                                                <div className="text-white font-semibold">{selectedTrack.rules.bop === 'yes' ? '✅ Activo' : '❌ Desactivado'}</div>
                                            </div>
                                        )}
                                        {selectedTrack.rules.adjustments && (
                                            <div>
                                                <div className="text-gray-400 mb-1">🔧 Ajustes de Auto</div>
                                                <div className="text-white font-semibold">{selectedTrack.rules.adjustments === 'no' ? '❌ No permitidos' : '✅ Permitidos'}</div>
                                            </div>
                                        )}
                                        {selectedTrack.rules.engineSwap && (
                                            <div>
                                                <div className="text-gray-400 mb-1">🔄 Engine Swap</div>
                                                <div className="text-white font-semibold">{selectedTrack.rules.engineSwap === 'yes' ? '✅ Permitido' : '❌ No permitido'}</div>
                                            </div>
                                        )}
                                        {selectedTrack.rules.abs && (
                                            <div>
                                                <div className="text-gray-400 mb-1">ABS</div>
                                                <div className="text-white font-semibold capitalize">{selectedTrack.rules.abs}</div>
                                            </div>
                                        )}
                                        {selectedTrack.rules.tcs && (
                                            <div>
                                                <div className="text-gray-400 mb-1">TCS</div>
                                                <div className="text-white font-semibold capitalize">{selectedTrack.rules.tcs}</div>
                                            </div>
                                        )}
                                        {selectedTrack.rules.asm && (
                                            <div>
                                                <div className="text-gray-400 mb-1">ASM</div>
                                                <div className="text-white font-semibold capitalize">{selectedTrack.rules.asm}</div>
                                            </div>
                                        )}
                                        {selectedTrack.rules.counterSteering && (
                                            <div>
                                                <div className="text-gray-400 mb-1">🎯 Contravolante</div>
                                                <div className="text-white font-semibold capitalize">{selectedTrack.rules.counterSteering}</div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Penalizaciones */}
                                    <div className="mt-4 pt-4 border-t border-white/10">
                                        <h4 className="text-gray-300 font-semibold mb-3 text-sm">⚠️ Penalizaciones</h4>
                                        <div className="grid grid-cols-2 gap-3 text-sm">
                                            <div>
                                                <div className="text-gray-400 mb-1">Penalización General</div>
                                                <div className="text-white font-semibold">{selectedTrack.rules.penalties === 'no' ? '❌ Off' : '✅ On'}</div>
                                            </div>
                                            <div>
                                                <div className="text-gray-400 mb-1">🔀 Atajo</div>
                                                <div className="text-white font-semibold capitalize">
                                                    {selectedTrack.rules.penaltyShortcut === 'strong' ? '⬆️ Fuerte' :
                                                        selectedTrack.rules.penaltyShortcut === 'moderate' ? '➡️ Moderado' :
                                                            selectedTrack.rules.penaltyShortcut === 'weak' ? '⬇️ Leve' :
                                                                selectedTrack.rules.penaltyShortcut === 'off' ? '❌ Off' :
                                                                    selectedTrack.rules.penaltyShortcut || '—'}
                                                </div>
                                            </div>
                                            <div>
                                                <div className="text-gray-400 mb-1">🧱 Colisión con Muro</div>
                                                <div className="text-white font-semibold">{selectedTrack.rules.penaltyWall === 'off' ? '❌ Off' : selectedTrack.rules.penaltyWall === 'on' ? '✅ On' : selectedTrack.rules.penaltyWall || '—'}</div>
                                            </div>
                                            <div>
                                                <div className="text-gray-400 mb-1">🏎️ Línea de Box</div>
                                                <div className="text-white font-semibold">{selectedTrack.rules.penaltyPitLine === 'off' ? '❌ Off' : selectedTrack.rules.penaltyPitLine === 'on' ? '✅ On' : selectedTrack.rules.penaltyPitLine || '—'}</div>
                                            </div>
                                            <div>
                                                <div className="text-gray-400 mb-1">💥 Colisión entre Coches</div>
                                                <div className="text-white font-semibold">{selectedTrack.rules.penaltyCarCollision === 'off' ? '❌ Off' : selectedTrack.rules.penaltyCarCollision === 'on' ? '✅ On' : selectedTrack.rules.penaltyCarCollision || '—'}</div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Rebufo */}
                                    <div className="mt-4 pt-4 border-t border-white/10">
                                        <h4 className="text-gray-300 font-semibold mb-3 text-sm">💨 Rebufo (Slipstream)</h4>
                                        <div className="grid grid-cols-2 gap-3 text-sm">
                                            <div>
                                                <div className="text-gray-400 mb-1">En Carrera</div>
                                                <div className="text-white font-semibold">{selectedTrack.rules.raceSlipstream === false ? '❌ Off' : '✅ On'}</div>
                                            </div>
                                            <div>
                                                <div className="text-gray-400 mb-1">En Qualy</div>
                                                <div className="text-white font-semibold">{selectedTrack.rules.qualySlipstream === false ? '❌ Off' : '✅ On'}</div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Neumáticos */}
                                    {(selectedTrack.rules.mandatoryTyre?.length > 0 || selectedTrack.rules.mandatoryCompoundChanges || selectedTrack.rules.qualyTireWear) && (
                                        <div className="mt-4 pt-4 border-t border-white/10">
                                            <h4 className="text-gray-300 font-semibold mb-3 text-sm">🛞 Neumáticos</h4>
                                            <div className="grid grid-cols-2 gap-3 text-sm">
                                                {selectedTrack.rules.mandatoryTyre?.length > 0 && (
                                                    <div className="col-span-2">
                                                        <div className="text-gray-400 mb-1">Compuestos Obligatorios</div>
                                                        <div className="text-white font-semibold">{selectedTrack.rules.mandatoryTyre.join(', ')}</div>
                                                    </div>
                                                )}
                                                {selectedTrack.rules.mandatoryCompoundChanges && (
                                                    <div>
                                                        <div className="text-gray-400 mb-1">Cambio de Compuesto</div>
                                                        <div className="text-white font-semibold">✅ Obligatorio</div>
                                                    </div>
                                                )}
                                                {selectedTrack.rules.qualyTireWear && (
                                                    <div>
                                                        <div className="text-gray-400 mb-1">Desgaste en Qualy</div>
                                                        <div className="text-white font-semibold">✅ Activo</div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* Pit Stops obligatorios */}
                                    {(selectedTrack.rules.mandatoryPitStops ?? 0) > 0 && (
                                        <div className="mt-4 pt-4 border-t border-white/10">
                                            <h4 className="text-gray-300 font-semibold mb-2 text-sm">🛣️ Paradas en Boxes</h4>
                                            <p className="text-white font-semibold text-sm">
                                                {selectedTrack.rules.mandatoryPitStops} pit stop{selectedTrack.rules.mandatoryPitStops > 1 ? 's' : ''} obligatorio{selectedTrack.rules.mandatoryPitStops > 1 ? 's' : ''}
                                            </p>
                                        </div>
                                    )}

                                    {/* Slots de clima */}
                                    {Array.isArray(selectedTrack.rules.weatherSlots) && selectedTrack.rules.weatherSlots.length > 0 && (
                                        <div className="mt-4 pt-4 border-t border-white/10">
                                            <h4 className="text-gray-300 font-semibold mb-3 text-sm">🌦️ Secuencia de Clima</h4>
                                            <div className="flex flex-wrap gap-2">
                                                {selectedTrack.rules.weatherSlots.map((slot, i) => (
                                                    <span key={i} className="bg-cyan-500/20 border border-cyan-500/30 text-cyan-200 px-3 py-1 rounded-lg text-sm">
                                                        Slot {i + 1}: {slot}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Notas */}
                            {selectedTrack.rules?.notes && (
                                <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
                                    <h3 className="text-blue-200 font-bold mb-2">📝 Notas</h3>
                                    <p className="text-blue-100 text-sm whitespace-pre-line">{selectedTrack.rules.notes}</p>
                                </div>
                            )}
                        </div>

                        <div className="px-6 pb-6">
                            <button
                                onClick={() => setSelectedTrack(null)}
                                className="w-full bg-white/10 hover:bg-white/20 border border-white/20 text-white px-4 py-3 rounded-lg font-semibold transition-all"
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
