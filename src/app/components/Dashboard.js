"use client";
import { useEffect, useState } from "react";
import { FirebaseService } from "../services/firebaseService";
import { useAuth } from '../context/AuthContext';

const categoryColors = {
    'Gr1': 'from-red-600 to-red-800',
    'Gr2': 'from-yellow-500 to-yellow-700',
    'Gr3': 'from-green-600 to-green-800',
    'Gr4': 'from-blue-600 to-blue-800'
};

const categoryIcons = {
    'Gr1': '🏎️',
    'Gr2': '🚗',
    'Gr3': '🏁',
    'Gr4': '🚙'
};

export default function Dashboard() {
    const [teams, setTeams] = useState([]);
    const [tracks, setTracks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedView, setSelectedView] = useState('teams');
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [selectedTrackResults, setSelectedTrackResults] = useState(null); // Para el modal de resultados
    const { currentUser, logout, isAdmin } = useAuth();
    const [imageErrors, setImageErrors] = useState({});

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [teamsResponse, tracksResponse] = await Promise.all([
                FirebaseService.getTeams(),
                FirebaseService.getTracks()
            ]);

            setTeams(teamsResponse);
            setTracks(tracksResponse);
        } catch (error) {
            console.error("Error fetching data:", error);
        } finally {
            setLoading(false);
        }
    };

    // Obtiene las pistas ordenadas por fecha
    const getSortedTracks = () => {
        return tracks.sort((a, b) => new Date(a.date) - new Date(b.date));
    };

    // Función helper para obtener puntos de un piloto en una pista específica
    const getDriverPointsForTrack = (driver, track) => {
        if (!driver.points || !track) {
            return 0;
        }

        if (typeof driver.points === 'object' && !Array.isArray(driver.points)) {
            const points = driver.points[track.id] ||
                driver.points[parseInt(track.id)] ||
                driver.points[track.id.toString()] ||
                0;

            return parseInt(points) || 0;
        }

        if (Array.isArray(driver.points)) {
            const sortedTracks = getSortedTracks();
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
                    if (points > 0) { // Solo incluir pilotos que participaron
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

        // Ordenar por puntos (mayor a menor)
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

    // Obtiene todos los pilotos con sus totales para el ranking
    const getAllDrivers = () => {
        const allDrivers = [];
        teams.forEach((team, teamIndex) => {
            if (team.drivers && Array.isArray(team.drivers)) {
                team.drivers.forEach(driver => {
                    allDrivers.push({
                        ...driver,
                        teamName: team.name,
                        teamColor: team.color,
                        teamIndex: teamIndex + 1,
                        total: calculateDriverTotal(driver.points)
                    });
                });
            }
        });
        return allDrivers.sort((a, b) => b.total - a.total);
    };

    // Filtra pilotos por categoría
    const getFilteredDrivers = () => {
        const allDrivers = getAllDrivers();
        if (selectedCategory === 'all') return allDrivers;
        return allDrivers.filter(driver => driver.category === selectedCategory);
    };

    // Obtiene los equipos ordenados por puntos
    const getSortedTeams = () => {
        return teams
            .map(team => ({
                ...team,
                total: calculateTeamTotal(team.drivers)
            }))
            .sort((a, b) => b.total - a.total);
    };

    // Obtiene el estado de las carreras completadas
    const getCompletedRaces = () => {
        if (teams.length === 0 || tracks.length === 0) return 0;

        const sortedTracks = getSortedTracks();
        let completedCount = 0;

        for (let track of sortedTracks) {
            const hasResults = teams[0]?.drivers?.[0]?.points?.[track.id.toString()] > 0;
            if (hasResults) {
                completedCount++;
            } else {
                break;
            }
        }

        return completedCount;
    };

    // Obtiene el estado de una carrera
    const getTrackStatus = (trackDate) => {
        const today = new Date();
        const raceDate = new Date(trackDate);
        const diffTime = raceDate - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays === 0) return 'current';
        if (diffDays < 0) return 'completed';
        return 'upcoming';
    };

    // Función para mostrar resultados de una carrera
    const showTrackResults = (track) => {
        setSelectedTrackResults(track);
    };

    // Función para cerrar el modal de resultados
    const closeTrackResults = () => {
        setSelectedTrackResults(null);
    };

    // Función para manejar logout
    const handleLogout = async () => {
        try {
            await logout();
        } catch (error) {
            console.error('Error al cerrar sesión:', error);
        }
    };

    // Función para manejar errores de imagen
    const handleImageError = (trackId) => {
        setImageErrors(prev => ({
            ...prev,
            [trackId]: true
        }));
    };

    const handleImageLoad = (trackId) => {
        setImageErrors(prev => ({
            ...prev,
            [trackId]: false
        }));
    };

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

    const completedRaces = getCompletedRaces();
    const totalRaces = tracks.length;
    const progressPercentage = totalRaces > 0 ? (completedRaces / totalRaces) * 100 : 0;

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800">
            {/* Header */}
            <div className="bg-gradient-to-r from-orange-600 via-red-600 to-orange-600 p-8">
                <div className="max-w-7xl mx-auto">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h1 className="text-4xl font-bold text-white flex items-center gap-4">
                                <span className="text-5xl">🏆</span>
                                IMSA GT7 Racing Club ESP
                            </h1>
                            <p className="text-orange-100 text-lg mt-2">Temporada 2025 - Dashboard de Resultados</p>
                        </div>
                        <div className="text-right">
                            <div className="bg-white/20 backdrop-blur-sm rounded-lg p-4">
                                <div className="text-white font-bold text-lg">Progreso del Campeonato</div>
                                <div className="text-orange-200 text-sm">{completedRaces} de {totalRaces} carreras</div>
                                <div className="w-48 bg-gray-700 rounded-full h-3 mt-2">
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
                    <div className="flex flex-wrap gap-4">
                        <button
                            onClick={() => setSelectedView('teams')}
                            className={`px-6 py-3 rounded-lg font-bold transition-all duration-200 ${selectedView === 'teams'
                                ? 'bg-white text-orange-600 shadow-lg'
                                : 'bg-white/20 text-white hover:bg-white/30'
                                }`}
                        >
                            🏎️ Equipos
                        </button>
                        <button
                            onClick={() => setSelectedView('drivers')}
                            className={`px-6 py-3 rounded-lg font-bold transition-all duration-200 ${selectedView === 'drivers'
                                ? 'bg-white text-orange-600 shadow-lg'
                                : 'bg-white/20 text-white hover:bg-white/30'
                                }`}
                        >
                            👤 Pilotos
                        </button>
                        <button
                            onClick={() => setSelectedView('tracks')}
                            className={`px-6 py-3 rounded-lg font-bold transition-all duration-200 ${selectedView === 'tracks'
                                ? 'bg-white text-orange-600 shadow-lg'
                                : 'bg-white/20 text-white hover:bg-white/30'
                                }`}
                        >
                            🏁 Pistas
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

            <div className="max-w-7xl mx-auto p-8">
                {selectedView === 'teams' ? (
                    /* Teams View - mantienes el código existente */
                    <div>
                        <h2 className="text-3xl font-bold text-white mb-8 flex items-center gap-3">
                            🏁 Clasificación de Equipos
                        </h2>
                        <div className="grid gap-6">
                            {getSortedTeams().map((team, position) => (
                                <div
                                    key={team.id}
                                    className="bg-white/10 backdrop-blur-sm border border-white/30 rounded-lg p-6 hover:bg-white/15 transition-all duration-300 shadow-lg hover:shadow-xl"
                                >
                                    {/* Team Header */}
                                    <div className="flex items-center justify-between mb-6">
                                        <div className="flex items-center gap-4">
                                            <div className="flex items-center justify-center w-16 h-16 bg-gradient-to-br from-gray-700 to-gray-900 rounded-full border-4 border-orange-400 shadow-lg">
                                                <span className="text-2xl font-bold text-white">#{position + 1}</span>
                                            </div>
                                            <div>
                                                <h3 className="text-2xl font-bold text-white">{team.name}</h3>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <div
                                                        className="w-4 h-4 rounded-full border-2 border-white"
                                                        style={{ backgroundColor: team.color }}
                                                    ></div>
                                                    <span className="text-gray-300 text-sm">Equipo #{team.id}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="bg-gradient-to-r from-purple-600 to-purple-800 text-white px-6 py-3 rounded-lg">
                                                <div className="text-sm text-purple-200">Puntos Totales</div>
                                                <div className="text-3xl font-bold">{team.total}</div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Drivers Grid */}
                                    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                                        {team.drivers && team.drivers.map((driver, idx) => {
                                            const driverTotal = calculateDriverTotal(driver.points);
                                            return (
                                                <div
                                                    key={idx}
                                                    className="bg-white/10 rounded-lg p-4 border border-white/20 hover:bg-white/15 transition-all duration-200"
                                                >
                                                    <div className="flex items-center justify-between mb-3">
                                                        <div className={`bg-gradient-to-r ${categoryColors[driver.category]} text-white px-3 py-1 rounded-full font-bold text-sm flex items-center gap-1`}>
                                                            <span>{categoryIcons[driver.category]}</span>
                                                            {driver.category}
                                                        </div>
                                                        <div className="bg-indigo-600 text-white px-2 py-1 rounded-full text-xs font-bold">
                                                            {driverTotal} pts
                                                        </div>
                                                    </div>
                                                    <div className="text-white font-bold text-lg mb-3">{driver.name}</div>

                                                    {/* Recent Races */}
                                                    <div className="mt-3">
                                                        <div className="text-gray-400 text-xs mb-1">Carreras con puntos:</div>
                                                        <div className="flex gap-1 flex-wrap">
                                                            {getSortedTracks()
                                                                .map(track => {
                                                                    const points = getDriverPointsForTrack(driver, track);

                                                                    return (
                                                                        <div
                                                                            key={track.id}
                                                                            className={`w-8 h-8 rounded flex items-center justify-center text-xs font-bold ${points > 0 ? 'bg-green-600 text-white' : 'bg-gray-600 text-gray-400'
                                                                                }`}
                                                                            title={`${track.name}: ${points} pts (ID: ${track.id})`}
                                                                        >
                                                                            {points}
                                                                        </div>
                                                                    );
                                                                })
                                                            }
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : selectedView === 'drivers' ? (
                    /* Drivers View - mantienes el código existente */
                    <div>
                        <div className="flex flex-wrap items-center justify-between mb-8">
                            <h2 className="text-3xl font-bold text-white flex items-center gap-3">
                                👤 Clasificación de Pilotos
                            </h2>

                            {/* Category Filter */}
                            <div className="flex flex-wrap gap-2">
                                <button
                                    onClick={() => setSelectedCategory('all')}
                                    className={`px-4 py-2 rounded-lg font-bold transition-all duration-200 ${selectedCategory === 'all'
                                        ? 'bg-white text-gray-800'
                                        : 'bg-white/20 text-white hover:bg-white/30'
                                        }`}
                                >
                                    Todos
                                </button>
                                {Object.keys(categoryColors).map(category => (
                                    <button
                                        key={category}
                                        onClick={() => setSelectedCategory(category)}
                                        className={`px-4 py-2 rounded-lg font-bold transition-all duration-200 flex items-center gap-2 ${selectedCategory === category
                                            ? 'bg-white text-gray-800'
                                            : 'bg-white/20 text-white hover:bg-white/30'
                                            }`}
                                    >
                                        <span>{categoryIcons[category]}</span>
                                        {category}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {getFilteredDrivers().map((driver, position) => (
                                <div
                                    key={`${driver.teamName}-${driver.name}`}
                                    className="bg-white/10 backdrop-blur-sm border border-white/30 rounded-lg p-6 hover:bg-white/15 transition-all duration-300 shadow-lg hover:shadow-xl"
                                >
                                    {/* Driver Header */}
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center justify-center w-12 h-12 bg-gradient-to-br from-gray-700 to-gray-900 rounded-full border-2 border-orange-400">
                                            <span className="text-lg font-bold text-white">#{position + 1}</span>
                                        </div>
                                        <div className={`bg-gradient-to-r ${categoryColors[driver.category]} text-white px-3 py-1 rounded-full font-bold text-sm flex items-center gap-1`}>
                                            <span>{categoryIcons[driver.category]}</span>
                                            {driver.category}
                                        </div>
                                    </div>

                                    <div className="text-center mb-4">
                                        <h3 className="text-xl font-bold text-white">{driver.name}</h3>
                                        <div className="flex items-center justify-center gap-2 mt-1">
                                            <div
                                                className="w-3 h-3 rounded-full"
                                                style={{ backgroundColor: driver.teamColor }}
                                            ></div>
                                            <span className="text-gray-300 text-sm">{driver.teamName}</span>
                                        </div>
                                    </div>

                                    <div className="text-center mb-4">
                                        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-4 py-2 rounded-lg inline-block">
                                            <div className="text-sm text-indigo-200">Puntos Totales</div>
                                            <div className="text-2xl font-bold">{driver.total}</div>
                                        </div>
                                    </div>

                                    {/* Race History */}
                                    <div>
                                        <div className="text-gray-400 text-sm mb-2 text-center">Historial de Carreras</div>
                                        <div className="grid grid-cols-5 gap-1">
                                            {getSortedTracks().map(track => {
                                                const points = getDriverPointsForTrack(driver, track);

                                                return (
                                                    <div
                                                        key={track.id}
                                                        className={`h-10 rounded flex flex-col items-center justify-center text-xs font-bold ${points > 0 ? 'bg-green-600 text-white' : 'bg-gray-600 text-gray-400'
                                                            }`}
                                                        title={`${track.name}: ${points} pts`}
                                                    >
                                                        <div className="text-xs">{track.name.substring(0, 3)}</div>
                                                        <div>{points}</div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    /* Tracks View - ACTUALIZADO con funcionalidad de click */
                    <div>
                        <h2 className="text-3xl font-bold text-white mb-8 flex items-center gap-3">
                            🏁 Calendario de Pistas
                        </h2>
                        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                            {getSortedTracks().map((track, index) => {
                                const status = getTrackStatus(track.date);
                                const hasImageError = imageErrors[track.id];
                                let statusColor = '';
                                let statusText = '';
                                let statusIcon = '';

                                switch (status) {
                                    case 'completed':
                                        statusColor = 'from-green-600 to-emerald-600';
                                        statusText = 'Completada';
                                        statusIcon = '✅';
                                        break;
                                    case 'current':
                                        statusColor = 'from-yellow-600 to-orange-600';
                                        statusText = 'En Curso / Esta Semana';
                                        statusIcon = '🔥';
                                        break;
                                    case 'upcoming':
                                        statusColor = 'from-blue-600 to-indigo-600';
                                        statusText = 'Próxima';
                                        statusIcon = '📅';
                                        break;
                                }

                                return (
                                    <div
                                        key={track.id}
                                        className="bg-white/10 backdrop-blur-sm border border-white/30 rounded-lg overflow-hidden hover:bg-white/15 transition-all duration-300 shadow-lg hover:shadow-xl"
                                    >
                                        {/* Imagen del trazado */}
                                        <div className="relative h-48 bg-gradient-to-br from-gray-800 to-gray-900">
                                            {track.layoutImage && !hasImageError ? (
                                                <img
                                                    src={track.layoutImage}
                                                    alt={`Trazado de ${track.name}`}
                                                    className="w-full h-full object-contain p-4"
                                                    onError={() => handleImageError(track.id)}
                                                    onLoad={() => handleImageLoad(track.id)}
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center">
                                                    <div className="text-center">
                                                        <div className="text-6xl mb-2">🏁</div>
                                                        <div className="text-gray-400 text-sm">
                                                            {track.layoutImage ? 'Error al cargar imagen' : 'Sin imagen de trazado'}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Overlay con número de pista */}
                                            <div className="absolute top-4 left-4 flex items-center justify-center w-12 h-12 bg-black/60 backdrop-blur-sm rounded-full border-2 border-orange-400 shadow-lg">
                                                <span className="text-lg font-bold text-white">#{index + 1}</span>
                                            </div>

                                            {/* Status badge */}
                                            <div className={`absolute top-4 right-4 bg-gradient-to-r ${statusColor} text-white px-3 py-1 rounded-full font-bold text-sm flex items-center gap-1 shadow-lg backdrop-blur-sm`}>
                                                <span>{statusIcon}</span>
                                                {statusText}
                                            </div>

                                            {/* Indicador de imagen */}
                                            {track.layoutImage && (
                                                <div className="absolute bottom-2 left-2">
                                                    <div className={`px-2 py-1 rounded-full text-xs font-bold ${hasImageError
                                                        ? 'bg-red-600/80 text-red-200'
                                                        : 'bg-green-600/80 text-green-200'
                                                        }`}>
                                                        {hasImageError ? '🚫 Error' : '🖼️ Trazado'}
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Contenido de la tarjeta */}
                                        <div className="p-6">
                                            <div className="text-center mb-4">
                                                <h3 className="text-xl font-bold text-white mb-2">{track.name}</h3>
                                                <div className="text-gray-300 text-sm mb-1 flex items-center justify-center gap-1">
                                                    <span>📍</span>
                                                    <span>{track.country}</span>
                                                </div>
                                                <div className="text-orange-300 font-semibold flex items-center justify-center gap-1">
                                                    <span>📅</span>
                                                    <span>
                                                        {new Date(track.date).toLocaleDateString('es-ES', {
                                                            weekday: 'long',
                                                            year: 'numeric',
                                                            month: 'long',
                                                            day: 'numeric'
                                                        })}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Track Details */}
                                            <div className="space-y-2 mb-4">
                                                {track.length && (
                                                    <div className="flex items-center justify-between text-sm">
                                                        <span className="text-gray-400">Longitud:</span>
                                                        <span className="text-white font-semibold">{track.length}</span>
                                                    </div>
                                                )}
                                                {track.category && (
                                                    <div className="flex items-center justify-between text-sm">
                                                        <span className="text-gray-400">Categoría:</span>
                                                        <span className="text-white font-semibold">{track.category}</span>
                                                    </div>
                                                )}
                                                <div className="flex items-center justify-between text-sm">
                                                    <span className="text-gray-400">ID de Pista:</span>
                                                    <span className="text-orange-400 font-bold">#{track.id}</span>
                                                </div>
                                            </div>

                                            {/* Progress Indicator */}
                                            <div className="pt-4 border-t border-white/20">
                                                <div className="text-center">
                                                    {status === 'completed' && (
                                                        <button
                                                            onClick={() => showTrackResults(track)}
                                                            className="w-full text-green-400 font-semibold text-sm hover:text-green-300 transition-all duration-200 cursor-pointer bg-green-600/20 px-3 py-3 rounded-lg hover:bg-green-600/30 flex items-center justify-center gap-2"
                                                        >
                                                            <span>🏆</span>
                                                            <span>Ver Resultados</span>
                                                        </button>
                                                    )}
                                                    {status === 'current' && (
                                                        <div className="w-full text-yellow-400 font-semibold text-sm bg-yellow-600/20 px-3 py-3 rounded-lg flex items-center justify-center gap-2">
                                                            <span>⚡</span>
                                                            <span>Carrera Activa</span>
                                                        </div>
                                                    )}
                                                    {status === 'upcoming' && (
                                                        <div className="w-full text-blue-400 font-semibold text-sm bg-blue-600/20 px-3 py-3 rounded-lg flex items-center justify-center gap-2">
                                                            <span>⏳</span>
                                                            <span>Próxima Carrera</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* Modal de Resultados de Carrera */}
            {selectedTrackResults && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-white/20">
                        {/* Header del Modal */}
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

                        {/* Clasificación */}
                        <div className="space-y-3">
                            {getTrackResults(selectedTrackResults).map((driver, position) => (
                                <div
                                    key={`${driver.teamName}-${driver.name}`}
                                    className="bg-white/10 backdrop-blur-sm border border-white/30 rounded-lg p-4 hover:bg-white/15 transition-all duration-200"
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            {/* Posición */}
                                            <div className={`flex items-center justify-center w-12 h-12 rounded-full font-bold text-white ${position === 0 ? 'bg-gradient-to-r from-yellow-500 to-yellow-600' : // Oro
                                                position === 1 ? 'bg-gradient-to-r from-gray-400 to-gray-500' : // Plata
                                                    position === 2 ? 'bg-gradient-to-r from-amber-600 to-amber-700' : // Bronce
                                                        'bg-gradient-to-r from-gray-600 to-gray-700' // Regular
                                                }`}>
                                                <span className="text-lg">#{position + 1}</span>
                                            </div>

                                            {/* Info del Piloto */}
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

                                            {/* Categoría */}
                                            <div className={`bg-gradient-to-r ${categoryColors[driver.category]} text-white px-3 py-1 rounded-full font-bold text-sm flex items-center gap-1`}>
                                                <span>{categoryIcons[driver.category]}</span>
                                                {driver.category}
                                            </div>
                                        </div>

                                        {/* Puntos */}
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

                        {/* Footer del Modal */}
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