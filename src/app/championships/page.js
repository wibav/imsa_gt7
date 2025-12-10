"use client";
import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { FirebaseService } from "../services/firebaseService";
import { useAuth } from "../context/AuthContext";
import Image from "next/image";

export default function ChampionshipDetailPage() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const championshipId = searchParams.get('id');
    const { currentUser, isAdmin } = useAuth();

    const [championship, setChampionship] = useState(null);
    const [teams, setTeams] = useState([]);
    const [tracks, setTracks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('standings'); // standings, calendar, stats, info

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
            const [champData, teamsData, tracksData] = await Promise.all([
                FirebaseService.getChampionship(championshipId),
                FirebaseService.getTeamsByChampionship(championshipId),
                FirebaseService.getTracksByChampionship(championshipId)
            ]);

            setChampionship(champData);
            setTeams(teamsData || []);
            setTracks(tracksData || []);
        } catch (error) {
            console.error("Error loading championship data:", error);
        } finally {
            setLoading(false);
        }
    };

    // Calcular clasificación
    const getStandings = () => {
        if (championship?.settings?.isTeamChampionship) {
            // Clasificación por equipos
            return teams.map(team => {
                // Alinear cálculo con la fuente real de resultados: points por pista
                const totalPoints = (team.drivers || []).reduce((sum, driver) => {
                    const driverName = driver.name;
                    const pointsFromTracks = tracks.reduce((acc, track) => acc + (track.points?.[driverName] || 0), 0);
                    return sum + pointsFromTracks;
                }, 0);

                return {
                    name: team.name,
                    color: team.color,
                    points: totalPoints,
                    drivers: team.drivers || []
                };
            }).sort((a, b) => b.points - a.points);
        } else {
            // Clasificación individual
            // Intentar primero desde championship.drivers (campeonatos nuevos)
            if (championship.drivers && championship.drivers.length > 0) {
                return championship.drivers.map(driver => {
                    const driverName = typeof driver === 'string' ? driver : driver.name;
                    const driverCategory = typeof driver === 'string' ? '' : driver.category;

                    // Calcular puntos desde las pistas
                    const points = tracks.reduce((total, track) => {
                        return total + (track.points?.[driverName] || 0);
                    }, 0);

                    return {
                        name: driverName,
                        category: driverCategory,
                        points: points
                    };
                }).sort((a, b) => b.points - a.points);
            }

            // Fallback: pilotos desde equipos (campeonatos viejos migrados)
            const allDrivers = teams.flatMap(team =>
                team.drivers?.map(driver => ({
                    name: driver.name,
                    team: team.name,
                    teamColor: team.color,
                    category: driver.category,
                    points: Object.values(driver.points || {}).reduce((s, p) => s + (p || 0), 0)
                })) || []
            );
            return allDrivers.sort((a, b) => b.points - a.points);
        }
    };

    // Obtener próxima carrera (incluyendo hoy si no está completada)
    const getNextRace = () => {
        const now = new Date();
        now.setHours(0, 0, 0, 0); // Inicio del día de hoy

        const upcomingRaces = tracks
            .filter(t => {
                const trackDate = new Date(t.date);
                return trackDate >= now && t.status !== 'completed';
            })
            .sort((a, b) => new Date(a.date) - new Date(b.date));

        return upcomingRaces[0] || null;
    };

    // Calcular progreso
    const getProgress = () => {
        if (!tracks || tracks.length === 0) {
            return { completed: 0, total: 0, percentage: 0 };
        }

        // Una pista se considera completada si tiene puntos asignados
        const completed = tracks.filter(track => {
            return track.points && Object.keys(track.points).length > 0;
        }).length;

        const total = tracks.length;
        const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

        return { completed, total, percentage };
    };

    // Formatear fecha (formato corto: DD/MM/YYYY)
    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        try {
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) return dateStr;
            return date.toLocaleDateString('es-ES', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            });
        } catch (error) {
            console.error('Error formatting date:', error);
            return dateStr;
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 flex items-center justify-center">
                <div className="text-center">
                    <div className="text-6xl mb-4 animate-bounce">🏁</div>
                    <div className="text-white text-xl font-bold">Cargando Campeonato...</div>
                </div>
            </div>
        );
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

    const standings = getStandings();
    const nextRace = getNextRace();
    const progress = getProgress();

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
                            { id: 'info', label: 'ℹ️ Información', icon: 'ℹ️' }
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
                                <h2 className="text-3xl font-bold text-white mb-6 flex items-center gap-3">
                                    📊 Clasificación Actual
                                </h2>

                                {/* Clasificación de Equipos */}
                                {championship.settings?.isTeamChampionship && (
                                    <div>
                                        <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                                            🏆 Clasificación por Equipos
                                        </h3>
                                        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl overflow-hidden border border-orange-500/30 mb-6">
                                            <div className="overflow-x-auto">
                                                <table className="w-full">
                                                    <thead className="bg-gradient-to-r from-orange-600 to-red-600 text-white">
                                                        <tr>
                                                            <th className="px-6 py-4 text-left">Pos</th>
                                                            <th className="px-6 py-4 text-left">Equipo</th>
                                                            <th className="px-6 py-4 text-right">Puntos</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="text-white">
                                                        {standings.map((entry, index) => (
                                                            <tr
                                                                key={index}
                                                                className={`
                                                                    border-b border-white/10 hover:bg-white/5 transition-colors
                                                                    ${index === 0 ? 'bg-yellow-500/10' : ''}
                                                                    ${index === 1 ? 'bg-gray-400/10' : ''}
                                                                    ${index === 2 ? 'bg-orange-700/10' : ''}
                                                                `}
                                                            >
                                                                <td className="px-6 py-4 font-bold">
                                                                    {index === 0 && '🥇'}
                                                                    {index === 1 && '🥈'}
                                                                    {index === 2 && '🥉'}
                                                                    {index > 2 && (index + 1)}
                                                                </td>
                                                                <td className="px-6 py-4">
                                                                    <div className="flex items-center gap-3">
                                                                        {entry.color && (
                                                                            <div
                                                                                className="w-4 h-4 rounded-full border-2 border-white"
                                                                                style={{ backgroundColor: entry.color }}
                                                                            />
                                                                        )}
                                                                        <span className="font-semibold">{entry.name}</span>
                                                                    </div>
                                                                </td>
                                                                <td className="px-6 py-4 text-right font-bold text-orange-400 text-lg">
                                                                    {entry.points}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>

                                        {/* Clasificación Individual de Pilotos */}
                                        <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                                            👤 Clasificación Individual de Pilotos
                                        </h3>
                                        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl overflow-hidden border border-blue-500/30">
                                            <div className="overflow-x-auto">
                                                <table className="w-full">
                                                    <thead className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
                                                        <tr>
                                                            <th className="px-6 py-4 text-left">Pos</th>
                                                            <th className="px-6 py-4 text-left">Piloto</th>
                                                            {championship.settings?.isTeamChampionship && (
                                                                <th className="px-6 py-4 text-left">Equipo</th>
                                                            )}
                                                            <th className="px-6 py-4 text-left">Categoría</th>
                                                            <th className="px-6 py-4 text-right">Puntos</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="text-white">
                                                        {(() => {
                                                            let allDrivers = [];

                                                            if (championship.settings?.isTeamChampionship || teams.length > 0) {
                                                                // Campeonatos por equipos o campeonatos viejos con equipos
                                                                allDrivers = teams.flatMap(team =>
                                                                    (team.drivers || []).map(driver => ({
                                                                        name: driver.name,
                                                                        team: team.name,
                                                                        teamColor: team.color,
                                                                        category: driver.category,
                                                                        points: Object.values(driver.points || {}).reduce((s, p) => s + (p || 0), 0)
                                                                    }))
                                                                );
                                                            } else if (championship.drivers && championship.drivers.length > 0) {
                                                                // Campeonatos individuales nuevos
                                                                allDrivers = championship.drivers.map(driver => {
                                                                    const driverName = typeof driver === 'string' ? driver : driver.name;
                                                                    const driverCategory = typeof driver === 'string' ? '' : driver.category;

                                                                    // Calcular puntos desde las pistas
                                                                    const driverPoints = tracks.reduce((total, track) => {
                                                                        return total + (track.points?.[driverName] || 0);
                                                                    }, 0);

                                                                    return {
                                                                        name: driverName,
                                                                        category: driverCategory,
                                                                        points: driverPoints
                                                                    };
                                                                });
                                                            }

                                                            return allDrivers
                                                                .sort((a, b) => b.points - a.points)
                                                                .map((driver, index) => (
                                                                    <tr
                                                                        key={index}
                                                                        className={`
                                                                            border-b border-white/10 hover:bg-white/5 transition-colors
                                                                            ${index === 0 ? 'bg-yellow-500/10' : ''}
                                                                            ${index === 1 ? 'bg-gray-400/10' : ''}
                                                                            ${index === 2 ? 'bg-orange-700/10' : ''}
                                                                        `}
                                                                    >
                                                                        <td className="px-6 py-4 font-bold">
                                                                            {index === 0 && '🥇'}
                                                                            {index === 1 && '🥈'}
                                                                            {index === 2 && '🥉'}
                                                                            {index > 2 && (index + 1)}
                                                                        </td>
                                                                        <td className="px-6 py-4">
                                                                            <span className="font-semibold">{driver.name}</span>
                                                                        </td>
                                                                        {championship.settings?.isTeamChampionship && (
                                                                            <td className="px-6 py-4">
                                                                                <div className="flex items-center gap-2">
                                                                                    {driver.teamColor && (
                                                                                        <div
                                                                                            className="w-3 h-3 rounded-full"
                                                                                            style={{ backgroundColor: driver.teamColor }}
                                                                                        />
                                                                                    )}
                                                                                    <span className="text-gray-300">{driver.team}</span>
                                                                                </div>
                                                                            </td>
                                                                        )}
                                                                        <td className="px-6 py-4">
                                                                            <span className="text-sm bg-blue-600/30 px-2 py-1 rounded">
                                                                                {driver.category || '-'}
                                                                            </span>
                                                                        </td>
                                                                        <td className="px-6 py-4 text-right font-bold text-blue-400 text-lg">
                                                                            {driver.points}
                                                                        </td>
                                                                    </tr>
                                                                ));
                                                        })()}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Clasificación Individual (cuando NO es por equipos) */}
                                {!championship.settings?.isTeamChampionship && (
                                    <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl overflow-hidden border border-orange-500/30">
                                        <div className="overflow-x-auto">
                                            <table className="w-full">
                                                <thead className="bg-gradient-to-r from-orange-600 to-red-600 text-white">
                                                    <tr>
                                                        <th className="px-6 py-4 text-left">Pos</th>
                                                        <th className="px-6 py-4 text-left">Piloto</th>
                                                        <th className="px-6 py-4 text-left">Equipo</th>
                                                        <th className="px-6 py-4 text-left">Categoría</th>
                                                        <th className="px-6 py-4 text-right">Puntos</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="text-white">
                                                    {standings.map((entry, index) => (
                                                        <tr
                                                            key={index}
                                                            className={`
                                                                border-b border-white/10 hover:bg-white/5 transition-colors
                                                                ${index === 0 ? 'bg-yellow-500/10' : ''}
                                                                ${index === 1 ? 'bg-gray-400/10' : ''}
                                                                ${index === 2 ? 'bg-orange-700/10' : ''}
                                                            `}
                                                        >
                                                            <td className="px-6 py-4 font-bold">
                                                                {index === 0 && '🥇'}
                                                                {index === 1 && '🥈'}
                                                                {index === 2 && '🥉'}
                                                                {index > 2 && (index + 1)}
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                <span className="font-semibold">{entry.name}</span>
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                <div className="flex items-center gap-2">
                                                                    {entry.teamColor && (
                                                                        <div
                                                                            className="w-3 h-3 rounded-full"
                                                                            style={{ backgroundColor: entry.teamColor }}
                                                                        />
                                                                    )}
                                                                    <span className="text-gray-300">{entry.team}</span>
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                <span className="text-sm bg-blue-600/30 px-2 py-1 rounded">
                                                                    {entry.category || '-'}
                                                                </span>
                                                            </td>
                                                            <td className="px-6 py-4 text-right font-bold text-orange-400 text-lg">
                                                                {entry.points}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
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
                                                            <span>📅 {formatDate(track.date)}</span>
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
                                                                .map(([driverName, points], idx) => (
                                                                    <div
                                                                        key={driverName}
                                                                        className={`flex justify-between items-center text-sm px-3 py-2 rounded-lg ${idx === 0 ? 'bg-yellow-500/20 border border-yellow-500/30' :
                                                                            idx === 1 ? 'bg-gray-400/20 border border-gray-400/30' :
                                                                                idx === 2 ? 'bg-orange-500/20 border border-orange-500/30' :
                                                                                    'bg-white/5'
                                                                            }`}
                                                                    >
                                                                        <span className="text-gray-300 truncate">
                                                                            {idx < 3 && (
                                                                                <span className="mr-1">
                                                                                    {idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'}
                                                                                </span>
                                                                            )}
                                                                            {driverName}
                                                                        </span>
                                                                        <span className={`font-bold ml-2 ${idx === 0 ? 'text-yellow-400' :
                                                                            idx === 1 ? 'text-gray-300' :
                                                                                idx === 2 ? 'text-orange-400' :
                                                                                    'text-blue-400'
                                                                            }`}>
                                                                            {points}
                                                                        </span>
                                                                    </div>
                                                                ))
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

                                {standings.length > 0 && (
                                    <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-6 border border-white/10">
                                        <h3 className="text-xl font-bold text-white mb-4">🏆 Top 3</h3>
                                        <div className="space-y-3">
                                            {standings.slice(0, 3).map((entry, index) => (
                                                <div key={index} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-2xl">
                                                            {index === 0 && '🥇'}
                                                            {index === 1 && '🥈'}
                                                            {index === 2 && '🥉'}
                                                        </span>
                                                        <span className="text-white font-semibold">{entry.name}</span>
                                                    </div>
                                                    <span className="text-orange-400 font-bold text-lg">{entry.points} pts</span>
                                                </div>
                                            ))}
                                        </div>
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
                                                    <div className="text-white font-semibold">{formatDate(championship.startDate)}</div>
                                                </div>
                                            )}
                                            {championship.endDate && (
                                                <div>
                                                    <div className="text-gray-400 text-sm mb-1">Fecha de Finalización</div>
                                                    <div className="text-white font-semibold">{formatDate(championship.endDate)}</div>
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
                                            📅 {formatDate(nextRace.date)}
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
        </div>
    );
}
