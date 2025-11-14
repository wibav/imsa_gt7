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
        setLoading(true);
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
                const totalPoints = team.drivers?.reduce((sum, driver) => {
                    const driverPoints = Object.values(driver.points || {}).reduce((s, p) => s + (p || 0), 0);
                    return sum + driverPoints;
                }, 0) || 0;

                return {
                    name: team.name,
                    color: team.color,
                    points: totalPoints,
                    drivers: team.drivers || []
                };
            }).sort((a, b) => b.points - a.points);
        } else {
            // Clasificación individual
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
                const trackDate = new Date(t.date + 'T00:00:00');
                return trackDate >= now && t.status !== 'completed';
            })
            .sort((a, b) => new Date(a.date) - new Date(b.date));

        return upcomingRaces[0] || null;
    };

    // Calcular progreso
    const getProgress = () => {
        const now = new Date();
        now.setHours(0, 0, 0, 0); // Inicio del día de hoy

        // Una pista se considera completada si:
        // 1. Su fecha ya pasó
        // 2. Tiene puntos asignados (campo points con al menos un valor)
        const completed = tracks.filter(track => {
            const trackDate = new Date(track.date + 'T00:00:00');
            const dateHasPassed = trackDate < now;
            const hasPoints = track.points && Object.keys(track.points).length > 0;

            return dateHasPassed && hasPoints;
        }).length;

        const total = tracks.length;
        const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
        return { completed, total, percentage };
    };

    // Formatear fecha
    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        const date = new Date(dateStr + 'T00:00:00');
        return date.toLocaleDateString('es-ES', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
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
                                                            <th className="px-6 py-4 text-left">Equipo</th>
                                                            <th className="px-6 py-4 text-left">Categoría</th>
                                                            <th className="px-6 py-4 text-right">Puntos</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="text-white">
                                                        {teams.flatMap(team =>
                                                            (team.drivers || []).map(driver => ({
                                                                name: driver.name,
                                                                team: team.name,
                                                                teamColor: team.color,
                                                                category: driver.category,
                                                                points: Object.values(driver.points || {}).reduce((s, p) => s + (p || 0), 0)
                                                            }))
                                                        )
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
                                                                    <td className="px-6 py-4">
                                                                        <span className="text-sm bg-blue-600/30 px-2 py-1 rounded">
                                                                            {driver.category || '-'}
                                                                        </span>
                                                                    </td>
                                                                    <td className="px-6 py-4 text-right font-bold text-blue-400 text-lg">
                                                                        {driver.points}
                                                                    </td>
                                                                </tr>
                                                            ))}
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

                        {/* TAB: Calendario - Continuará en el siguiente archivo por longitud... */}
                        {activeTab === 'calendar' && (
                            <div>
                                <h2 className="text-3xl font-bold text-white mb-6 flex items-center gap-3">
                                    📅 Calendario de Carreras
                                </h2>
                                <div className="text-gray-300">Ver archivo completo para contenido del calendario</div>
                            </div>
                        )}

                        {/* TAB: Estadísticas */}
                        {activeTab === 'stats' && (
                            <div>
                                <h2 className="text-3xl font-bold text-white mb-6 flex items-center gap-3">
                                    📈 Estadísticas del Campeonato
                                </h2>
                                <div className="text-gray-300">Ver archivo completo para estadísticas</div>
                            </div>
                        )}

                        {/* TAB: Información */}
                        {activeTab === 'info' && (
                            <div>
                                <h2 className="text-3xl font-bold text-white mb-6 flex items-center gap-3">
                                    ℹ️ Información del Campeonato
                                </h2>
                                <div className="text-gray-300">Ver archivo completo para información</div>
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
