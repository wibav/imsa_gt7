"use client";
import { useEffect, useState, useMemo, useCallback } from "react";
import { FirebaseService } from "../services/firebaseService";
import { useAuth } from '../context/AuthContext';
import Image from "next/image";

// Importar constantes desde archivo separado
import { CATEGORY_COLORS, CATEGORY_ICONS } from '../constants/categories';

// Importar vistas optimizadas
import TeamsView from './views/TeamsView';
import DriversView from './views/DriversView';
import EventsView from './views/EventsView';
import TracksView from './views/TracksView';

export default function Dashboard() {
    const [teams, setTeams] = useState([]);
    const [tracks, setTracks] = useState([]);
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedView, setSelectedView] = useState('teams');
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [selectedTrackResults, setSelectedTrackResults] = useState(null);
    const { currentUser, logout, isAdmin } = useAuth();
    const [imageErrors, setImageErrors] = useState({});

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [teamsResponse, tracksResponse, eventsResponse] = await Promise.all([
                FirebaseService.getTeams(),
                FirebaseService.getTracks(),
                FirebaseService.getEvents().catch(() => [])
            ]);

            setTeams(teamsResponse);
            setTracks(tracksResponse);
            setEvents(eventsResponse || []);
        } catch (error) {
            console.error("Error fetching data:", error);
        } finally {
            setLoading(false);
        }
    };

    // Determinar si una fecha está en la misma semana (lunes-domingo) que hoy
    const isInCurrentWeek = (isoDate) => {
        if (!isoDate) return false;
        const date = new Date(isoDate + "T00:00:00");
        const now = new Date();
        const startOfWeek = new Date(now);
        const day = (now.getDay() + 6) % 7; // 0 = lunes
        startOfWeek.setDate(now.getDate() - day);
        startOfWeek.setHours(0, 0, 0, 0);
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 7);
        return date >= startOfWeek && date < endOfWeek;
    };

    // Obtener el evento activo de la semana
    const activeEvent = useMemo(() => {
        if (!events || events.length === 0) return null;
        const sorted = [...events].sort((a, b) => new Date(a.date) - new Date(b.date));
        return sorted.find(ev => isInCurrentWeek(ev.date)) || null;
    }, [events]);

    // Obtiene las pistas ordenadas por fecha
    const sortedTracks = useMemo(() => {
        return tracks.sort((a, b) => new Date(a.date) - new Date(b.date));
    }, [tracks]);

    // Obtiene los eventos ordenados por fecha
    const sortedEvents = useMemo(() => {
        if (!events || events.length === 0) return [];
        return [...events].sort((a, b) => new Date(a.date) - new Date(b.date));
    }, [events]);

    // Función helper para obtener puntos de un piloto en una pista específica
    const getDriverPointsForTrack = (driver, track) => {
        if (!driver.points || !track) return 0;

        if (typeof driver.points === 'object' && !Array.isArray(driver.points)) {
            const points = driver.points[track.id] ||
                driver.points[parseInt(track.id)] ||
                driver.points[track.id.toString()] ||
                0;
            return parseInt(points) || 0;
        }

        if (Array.isArray(driver.points)) {
            const trackIndex = sortedTracks.findIndex(t => t.id === track.id);
            const pointsByIndex = driver.points[trackIndex] || 0;
            return parseInt(pointsByIndex) || 0;
        }

        return 0;
    };

    // Obtiene los resultados de una carrera específica
    const getTrackResults = (track) => {
        const results = [];

        teams.forEach(team => {
            if (team.drivers && Array.isArray(team.drivers)) {
                team.drivers.forEach(driver => {
                    const points = getDriverPointsForTrack(driver, track);
                    if (points > 0) {
                        results.push({
                            ...driver,
                            teamName: team.name,
                            teamColor: team.color,
                            points: points
                        });
                    }
                });
            }
        });

        return results.sort((a, b) => b.points - a.points);
    };

    // Calcula el total de puntos de un piloto
    const calculateDriverTotal = (points) => {
        if (!points) return 0;
        if (typeof points === 'object' && !Array.isArray(points)) {
            return Object.values(points).reduce((sum, point) => sum + (parseInt(point) || 0), 0);
        }
        if (Array.isArray(points)) {
            return points.reduce((sum, point) => sum + (parseInt(point) || 0), 0);
        }
        return 0;
    };

    // Calcula el total de puntos de un equipo
    const calculateTeamTotal = (drivers) => {
        if (!drivers || !Array.isArray(drivers)) return 0;
        return drivers.reduce((sum, driver) => sum + calculateDriverTotal(driver.points), 0);
    };

    // Obtiene todos los pilotos con sus totales
    const allDrivers = useMemo(() => {
        const drivers = [];
        teams.forEach((team) => {
            team.drivers?.forEach((driver) => {
                drivers.push({
                    ...driver,
                    teamName: team.name,
                    teamColor: team.color,
                    total: calculateDriverTotal(driver.points)
                });
            });
        });
        return drivers.sort((a, b) => b.total - a.total);
    }, [teams]);

    // Filtra pilotos por categoría
    const filteredDrivers = useMemo(() => {
        if (selectedCategory === 'all') return allDrivers;
        return allDrivers.filter(driver => driver.category === selectedCategory);
    }, [allDrivers, selectedCategory]);

    // Obtiene los equipos ordenados por puntos
    const sortedTeams = useMemo(() => {
        return teams
            .map(team => ({
                ...team,
                total: calculateTeamTotal(team.drivers)
            }))
            .sort((a, b) => b.total - a.total);
    }, [teams]);

    // Obtiene las carreras completadas
    const completedRaces = useMemo(() => {
        if (teams.length === 0 || tracks.length === 0) return 0;

        let completedCount = 0;
        for (let track of sortedTracks) {
            const hasResults = teams.some(team =>
                team.drivers?.some(driver => getDriverPointsForTrack(driver, track) > 0)
            );
            if (hasResults) completedCount++;
        }
        return completedCount;
    }, [teams, sortedTracks]);

    // Función para mostrar resultados de una carrera
    const showTrackResults = useCallback((track) => {
        setSelectedTrackResults(track);
    }, []);

    // Función para cerrar el modal de resultados
    const closeTrackResults = useCallback(() => {
        setSelectedTrackResults(null);
    }, []);

    // useCallback para manejar cambios de categoría
    const handleCategoryChange = useCallback((category) => {
        setSelectedCategory(category);
    }, []);

    // Función para manejar logout
    const handleLogout = useCallback(async () => {
        try {
            await logout();
        } catch (error) {
            console.error('Error durante logout:', error);
        }
    }, [logout]);

    // Función para manejar errores de imagen
    const handleImageError = useCallback((trackId) => {
        setImageErrors(prev => ({
            ...prev,
            [trackId]: true
        }));
    }, []);

    const handleImageLoad = useCallback((trackId) => {
        setImageErrors(prev => ({
            ...prev,
            [trackId]: false
        }));
    }, []);

    // Calcular el progreso del campeonato
    const progressPercentage = useMemo(() => {
        const totalRaces = tracks.length;
        return totalRaces > 0 ? (completedRaces / totalRaces) * 100 : 0;
    }, [completedRaces, tracks.length]);

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 flex items-center justify-center">
                <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-orange-500"></div>
                    <p className="text-white mt-4 text-xl">Cargando campeonato...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 overflow-x-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-orange-600 via-red-600 to-orange-600 px-4 py-6 sm:p-8">
                <div className="max-w-7xl mx-auto w-full">
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
                        <div>
                            <h1 className="text-3xl sm:text-4xl font-bold text-white flex items-center gap-4">
                                <Image
                                    src="/logo_gt7.png"
                                    alt="GT7 ESP Racing Club Logo"
                                    width={64}
                                    height={64}
                                    className="w-16 h-16 object-contain"
                                    onError={(e) => {
                                        e.target.style.display = 'none';
                                    }}
                                />
                                IMSA GT7 Racing Club ESP
                                <span className="text-4xl sm:text-5xl">🏆</span>
                            </h1>
                            <p className="text-orange-100 text-lg mt-2">Temporada 2025 - Dashboard de Resultados</p>
                        </div>
                        <div className="w-full md:w-auto text-left md:text-right">
                            <div className="bg-white/20 backdrop-blur-sm rounded-xl md:rounded-lg p-4 w-full md:w-auto">
                                <div className="text-white font-bold text-lg">Progreso del Campeonato</div>
                                <div className="text-orange-200 text-sm">{completedRaces} de {tracks.length} carreras</div>
                                <div className="w-full md:w-64 bg-gray-700 rounded-full h-3 mt-2">
                                    <div
                                        className="bg-gradient-to-r from-green-500 to-emerald-500 h-3 rounded-full transition-all duration-500"
                                        style={{ width: `${progressPercentage}%` }}
                                    ></div>
                                </div>
                                <div className="text-white font-bold text-lg mt-1">{progressPercentage.toFixed(1)}%</div>
                            </div>
                        </div>
                    </div>

                    {/* Navigation */}
                    <div className="flex flex-wrap gap-4 w-full">
                        <button
                            onClick={() => setSelectedView('teams')}
                            className={`px-6 py-3 rounded-lg font-bold transition-all duration-200 w-full xs:w-auto sm:w-auto ${selectedView === 'teams'
                                ? 'bg-white text-orange-600 shadow-lg'
                                : 'bg-white/20 text-white hover:bg-white/30'
                                }`}
                        >
                            🏎️ Equipos
                        </button>
                        <button
                            onClick={() => setSelectedView('drivers')}
                            className={`px-6 py-3 rounded-lg font-bold transition-all duration-200 w-full xs:w-auto sm:w-auto ${selectedView === 'drivers'
                                ? 'bg-white text-orange-600 shadow-lg'
                                : 'bg-white/20 text-white hover:bg-white/30'
                                }`}
                        >
                            👤 Pilotos
                        </button>
                        <button
                            onClick={() => setSelectedView('tracks')}
                            className={`px-6 py-3 rounded-lg font-bold transition-all duration-200 w-full xs:w-auto sm:w-auto ${selectedView === 'tracks'
                                ? 'bg-white text-orange-600 shadow-lg'
                                : 'bg-white/20 text-white hover:bg-white/30'
                                }`}
                        >
                            🏁 Pistas
                        </button>
                        <button
                            onClick={() => setSelectedView('events')}
                            className={`px-6 py-3 rounded-lg font-bold transition-all duration-200 w-full xs:w-auto sm:w-auto ${selectedView === 'events'
                                ? 'bg-white text-orange-600 shadow-lg'
                                : 'bg-white/20 text-white hover:bg-white/30'
                                }`}
                        >
                            🎉 Eventos
                        </button>

                        {/* Admin Controls */}
                        {currentUser ? (
                            <div className="flex items-center gap-4 mt-4">
                                <div className="flex items-center gap-2 bg-white/10 rounded-lg px-4 py-2">
                                    <span className="text-white text-sm">
                                        👤 {currentUser.email}
                                    </span>
                                    {isAdmin() && (
                                        <span className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white text-xs px-2 py-1 rounded-full font-bold">
                                            ADMIN
                                        </span>
                                    )}
                                </div>

                                {isAdmin() && (
                                    <>
                                        <button
                                            onClick={() => window.location.href = '/teamsAdmin'}
                                            className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-4 py-2 rounded-lg font-bold hover:from-purple-700 hover:to-indigo-700 transition-all duration-200"
                                        >
                                            ⚙️ Admin Equipos
                                        </button>
                                        <button
                                            onClick={() => window.location.href = '/tracksAdmin'}
                                            className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-4 py-2 rounded-lg font-bold hover:from-purple-700 hover:to-indigo-700 transition-all duration-200"
                                        >
                                            🏁 Admin Pistas
                                        </button>
                                        <button
                                            onClick={() => window.location.href = '/eventsAdmin'}
                                            className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-4 py-2 rounded-lg font-bold hover:from-purple-700 hover:to-indigo-700 transition-all duration-200"
                                        >
                                            🎉 Admin Eventos
                                        </button>
                                    </>
                                )}

                                <button
                                    onClick={handleLogout}
                                    className="bg-gradient-to-r from-red-600 to-red-700 text-white px-4 py-2 rounded-lg font-bold hover:from-red-700 hover:to-red-800 transition-all duration-200"
                                >
                                    🚪 Cerrar Sesión
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={() => window.location.href = '/login'}
                                className="bg-gradient-to-r from-green-600 to-emerald-600 text-white px-6 py-3 rounded-lg font-bold hover:from-green-700 hover:to-emerald-700 transition-all duration-200 flex items-center gap-2"
                            >
                                🔐 Admin Login
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 py-8 sm:p-8">
                {/* Evento especial de la semana */}
                {(() => {
                    if (!activeEvent) return null;
                    const participants = activeEvent.participants || [];
                    return (
                        <div className="mb-10 bg-white/10 backdrop-blur-sm border border-white/30 rounded-xl overflow-hidden shadow-xl">
                            <div className="bg-gradient-to-r from-amber-600 via-orange-600 to-red-600 p-4 sm:p-6">
                                <div className="flex items-center justify-between gap-4 flex-wrap">
                                    <div>
                                        <div className="text-white text-sm opacity-90">Evento especial de esta semana</div>
                                        <h2 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-3">🎉 {activeEvent.title}</h2>
                                        <div className="text-orange-100 mt-1 flex flex-wrap items-center gap-2 text-sm">
                                            <span>📅 {new Date(activeEvent.date).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
                                            {activeEvent.hour ? <span>• 🕢 {activeEvent.hour}h (Hora España)</span> : null}
                                            {activeEvent.track ? <span>• 🏁 {activeEvent.track}</span> : null}
                                        </div>
                                    </div>
                                    {activeEvent.banner ? (
                                        <div className="w-full sm:w-80 h-40 relative rounded-lg overflow-hidden border border-white/30 bg-black/30">
                                            <Image src={activeEvent.banner} alt={activeEvent.title} fill className="object-contain p-2" />
                                        </div>
                                    ) : null}
                                </div>
                            </div>

                            <div className="p-4 sm:p-6">
                                {activeEvent.description ? (
                                    <p className="text-white/90 mb-4">{activeEvent.description}</p>
                                ) : null}

                                <div className="grid md:grid-cols-2 gap-6">
                                    <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                                        <div className="text-white font-semibold mb-3">Reglamento</div>
                                        <ul className="text-sm text-gray-200 space-y-1">
                                            {activeEvent?.rules?.duration && <li>• Carrera: {activeEvent.rules.duration}</li>}
                                            {activeEvent?.rules?.bop && <li>• BOP: {activeEvent.rules.bop}</li>}
                                            {activeEvent?.rules?.adjustments && <li>• Ajustes: {activeEvent.rules.adjustments}</li>}
                                            {activeEvent?.rules?.damage && <li>• Daños: {activeEvent.rules.damage}</li>}
                                            {activeEvent?.rules?.engineSwap && <li>• Swap de motor: {activeEvent.rules.engineSwap}</li>}
                                            {activeEvent?.rules?.penalties && <li>• Penalizaciones: {activeEvent.rules.penalties}</li>}
                                            {activeEvent?.rules?.wear && <li>• Desgaste y consumo: {activeEvent.rules.wear}</li>}
                                            {typeof activeEvent?.rules?.tyreWear === 'number' && <li>• Desgaste de neumáticos: x{activeEvent.rules.tyreWear}</li>}
                                            {typeof activeEvent?.rules?.fuelWear === 'number' && <li>• Desgaste de combustible: x{activeEvent.rules.fuelWear}</li>}
                                            {typeof activeEvent?.rules?.fuelWear === 'number' && activeEvent.rules.fuelWear > 0 && typeof activeEvent?.rules?.fuelRefillRate === 'number' && (
                                                <li>• Velocidad de recarga de combustible: {activeEvent.rules.fuelRefillRate} L/s</li>
                                            )}
                                            {activeEvent?.rules?.mandatoryTyre && <li>• Neumático obligatorio: ${activeEvent.rules.mandatoryTyre}</li>}
                                        </ul>
                                    </div>

                                    <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="text-white font-semibold">Participantes ({participants.length}/{activeEvent.maxParticipants || 16})</div>
                                        </div>
                                        {participants.length === 0 ? (
                                            <div className="text-gray-300 text-sm">Aún no hay inscritos.</div>
                                        ) : (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                {participants.slice(0, activeEvent.maxParticipants || 16).map((p, idx) => (
                                                    <div key={p.id || idx} className="bg-white/10 rounded px-3 py-2 text-white flex items-center gap-2">
                                                        <div className="w-6 h-6 rounded-full bg-orange-600/70 text-xs flex items-center justify-center">{idx + 1}</div>
                                                        <div className="flex-1">
                                                            <div className="font-semibold text-sm">{p.name}</div>
                                                            {p.team ? <div className="text-xs text-gray-300">{p.team}</div> : null}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })()}

                {/* Renderizado de Vistas */}
                {selectedView === 'teams' && (
                    <TeamsView
                        teams={sortedTeams}
                        completedRaces={completedRaces}
                    />
                )}

                {selectedView === 'drivers' && (
                    <DriversView
                        drivers={filteredDrivers}
                        selectedCategory={selectedCategory}
                        onCategoryChange={handleCategoryChange}
                        completedRaces={completedRaces}
                    />
                )}

                {selectedView === 'events' && (
                    <EventsView
                        events={sortedEvents}
                        tracks={tracks}
                    />
                )}

                {selectedView === 'tracks' && (
                    <TracksView
                        tracks={sortedTracks}
                        events={events}
                        completedRaces={completedRaces}
                        activeEvent={activeEvent}
                        progressPercentage={progressPercentage}
                        onShowTrackResults={showTrackResults}
                        onImageError={handleImageError}
                        onImageLoad={handleImageLoad}
                    />
                )}
            </div>

            {/* Modal de Resultados de Carrera */}
            {selectedTrackResults && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-white/20">
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h3 className="text-2xl font-bold text-white flex items-center gap-3">
                                    🏁 Resultados de {selectedTrackResults.name}
                                </h3>
                                <p className="text-gray-300 mt-1">
                                    📅 {new Date(selectedTrackResults.date).toLocaleDateString('es-ES', {
                                        weekday: 'long',
                                        year: 'numeric',
                                        month: 'long',
                                        day: 'numeric'
                                    })}
                                </p>
                            </div>
                            <button
                                onClick={closeTrackResults}
                                className="text-gray-400 hover:text-white text-2xl font-bold bg-white/10 hover:bg-white/20 rounded-full w-10 h-10 flex items-center justify-center transition-all duration-200"
                            >
                                ×
                            </button>
                        </div>

                        <div className="space-y-3">
                            {getTrackResults(selectedTrackResults).map((driver, position) => (
                                <div
                                    key={`${driver.teamName}-${driver.name}`}
                                    className="bg-white/10 backdrop-blur-sm border border-white/30 rounded-lg p-4 hover:bg-white/15 transition-all duration-200"
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className={`flex items-center justify-center w-12 h-12 rounded-full font-bold text-white ${position === 0 ? 'bg-gradient-to-r from-yellow-500 to-yellow-600' :
                                                position === 1 ? 'bg-gradient-to-r from-gray-400 to-gray-500' :
                                                    position === 2 ? 'bg-gradient-to-r from-amber-600 to-amber-700' :
                                                        'bg-gradient-to-r from-gray-600 to-gray-700'
                                                }`}>
                                                <span className="text-lg">#{position + 1}</span>
                                            </div>

                                            <div>
                                                <div className="text-white font-bold text-lg">{driver.name}</div>
                                                <div className="flex items-center gap-2">
                                                    <div
                                                        className="w-3 h-3 rounded-full"
                                                        style={{ backgroundColor: driver.teamColor }}
                                                    ></div>
                                                    <span className="text-gray-300 text-sm">{driver.teamName}</span>
                                                </div>
                                            </div>

                                            <div className={`bg-gradient-to-r ${CATEGORY_COLORS[driver.category]} text-white px-3 py-1 rounded-full font-bold text-sm flex items-center gap-1`}>
                                                <span>{CATEGORY_ICONS[driver.category]}</span>
                                                {driver.category}
                                            </div>
                                        </div>

                                        <div className="text-right">
                                            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-4 py-2 rounded-lg">
                                                <div className="text-sm text-indigo-200">Puntos</div>
                                                <div className="text-xl font-bold">{driver.points}</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {getTrackResults(selectedTrackResults).length === 0 && (
                                <div className="text-center py-8">
                                    <div className="text-gray-400 text-lg">
                                        No hay resultados disponibles para esta carrera
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="mt-6 pt-4 border-t border-white/20 text-center">
                            <button
                                onClick={closeTrackResults}
                                className="bg-gradient-to-r from-orange-600 to-red-600 text-white px-6 py-2 rounded-lg font-bold hover:from-orange-700 hover:to-red-700 transition-all duration-200"
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