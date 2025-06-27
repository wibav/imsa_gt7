"use client";
import { useEffect, useState } from "react";

const categoryColors = {
    'Gr1': 'from-red-600 to-red-800',
    'Gr2': 'from-blue-600 to-blue-800',
    'Gr3': 'from-green-600 to-green-800',
    'Gr4': 'from-yellow-500 to-yellow-700'
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
    const [selectedView, setSelectedView] = useState('teams'); // 'teams' or 'drivers'
    const [selectedCategory, setSelectedCategory] = useState('all');

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [teamsResponse, tracksResponse] = await Promise.all([
                fetch("/api/teams").then(res => res.json()),
                fetch("/api/tracks").then(res => res.json())
            ]);

            setTeams(teamsResponse);
            setTracks(tracksResponse);
            setLoading(false);
        } catch (error) {
            console.error("Error fetching data:", error);
            setLoading(false);
        }
    };

    // Calcula el total de puntos de un piloto
    const calculateDriverTotal = (points) => {
        if (!points) return 0;
        return Object.values(points).reduce((sum, point) => sum + (parseInt(point) || 0), 0);
    };

    // Calcula el total de puntos de un equipo
    const calculateTeamTotal = (drivers) => {
        return drivers.reduce((sum, driver) => sum + calculateDriverTotal(driver.points), 0);
    };

    // Obtiene todos los pilotos con sus totales para el ranking
    const getAllDrivers = () => {
        const allDrivers = [];
        teams.forEach((team, teamIndex) => {
            team.drivers.forEach(driver => {
                allDrivers.push({
                    ...driver,
                    teamName: team.name,
                    teamColor: team.color,
                    teamIndex: teamIndex + 1,
                    total: calculateDriverTotal(driver.points)
                });
            });
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

        const sortedTracks = tracks.sort((a, b) => new Date(a.date) - new Date(b.date));
        let completedCount = 0;

        for (let track of sortedTracks) {
            const hasResults = teams[0]?.drivers[0]?.points?.[track.id.toString()] > 0;
            if (hasResults) {
                completedCount++;
            } else {
                break;
            }
        }

        return completedCount;
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
                            <p className="text-orange-100 text-lg mt-2">Temporada 2024 - Dashboard de Resultados</p>
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
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto p-8">
                {selectedView === 'teams' ? (
                    /* Teams View */
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
                                        {team.drivers.map((driver, idx) => (
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
                                                        {calculateDriverTotal(driver.points)} pts
                                                    </div>
                                                </div>
                                                <div className="text-white font-bold text-lg">{driver.name}</div>

                                                {/* Recent Races */}
                                                <div className="mt-3">
                                                    <div className="text-gray-400 text-xs mb-1">Últimas carreras:</div>
                                                    <div className="flex gap-1">
                                                        {tracks
                                                            .sort((a, b) => new Date(a.date) - new Date(b.date))
                                                            .slice(-5)
                                                            .map(track => {
                                                                const points = driver.points?.[track.id.toString()] || 0;
                                                                return (
                                                                    <div
                                                                        key={track.id}
                                                                        className={`w-8 h-8 rounded flex items-center justify-center text-xs font-bold ${points > 0 ? 'bg-green-600 text-white' : 'bg-gray-600 text-gray-400'
                                                                            }`}
                                                                        title={`${track.name}: ${points} pts`}
                                                                    >
                                                                        {points}
                                                                    </div>
                                                                );
                                                            })
                                                        }
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    /* Drivers View */
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
                                            {tracks
                                                .sort((a, b) => new Date(a.date) - new Date(b.date))
                                                .map(track => {
                                                    const points = driver.points?.[track.id.toString()] || 0;
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
                                                })
                                            }
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}