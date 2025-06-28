"use client";
import { useEffect, useState } from "react";
import { FirebaseService } from "../services/firebaseService";

// Ejemplo de datos iniciales con nueva estructura de puntos por ID de pista
const initialTeams = [
    {
        "id": 1,
        "name": "Equipo 1",
        "color": "green",
        "drivers": [
            {
                "name": "YECHE",
                "category": "Gr1",
                "points": {
                    "1": 9,   // Watkins Glen
                    "2": 15,  // Monza
                    "3": 13,  // LeMans
                    "4": 14   // Brands Hatch
                    // Las demás pistas (5-15) tendrán 0 por defecto
                }
            },
            {
                "name": "NANO",
                "category": "Gr2",
                "points": {
                    "1": 10,
                    "2": 9,
                    "3": 9,
                    "4": 9
                }
            },
            {
                "name": "JORGE",
                "category": "Gr3",
                "points": {
                    "1": 6,
                    "2": 6,
                    "3": 5,
                    "4": 5
                }
            },
            {
                "name": "DANI",
                "category": "Gr4",
                "points": {
                    "1": 2,
                    "2": 3,
                    "3": 3,
                    "4": 2
                }
            }
        ]
    },
    {
        "id": 2,
        "name": "Equipo 2",
        "color": "red",
        "drivers": [
            {
                "name": "MISIL",
                "category": "Gr1",
                "points": {
                    "1": 11,
                    "2": 16,
                    "3": 14,
                    "4": 10
                }
            },
            {
                "name": "CHELIOS",
                "category": "Gr2",
                "points": {
                    "1": 12,
                    "2": 10,
                    "3": 11,
                    "4": 11
                }
            },
            {
                "name": "LUYAN",
                "category": "Gr3",
                "points": {
                    "1": 7,
                    "2": 8,
                    "3": 7,
                    "4": 7
                }
            },
            {
                "name": "DESH",
                "category": "Gr4",
                "points": {
                    "1": 3,
                    "2": 2,
                    "3": 2,
                    "4": 1
                }
            }
        ]
    },
    {
        "id": 3,
        "name": "Equipo 3",
        "color": "yellow",
        "drivers": [
            {
                "name": "VAZQUEZ",
                "category": "Gr1",
                "points": {
                    "1": 15,
                    "2": 13,
                    "3": 15,
                    "4": 15
                }
            },
            {
                "name": "HOLO",
                "category": "Gr2",
                "points": {
                    "1": 13,
                    "2": 12,
                    "3": 12,
                    "4": 12
                }
            },
            {
                "name": "SERRANO",
                "category": "Gr3",
                "points": {
                    "1": 5,
                    "2": 5,
                    "3": 6,
                    "4": 6
                }
            },
            {
                "name": "CHIKY",
                "category": "Gr4",
                "points": {
                    "1": 4,
                    "2": 4,
                    "3": 4,
                    "4": 3
                }
            }
        ]
    },
    {
        "id": 4,
        "name": "Equipo 4",
        "color": "orange",
        "drivers": [
            {
                "name": "OJER",
                "category": "Gr1",
                "points": {
                    "1": 16,
                    "2": 14,
                    "3": 16,
                    "4": 16
                }
            },
            {
                "name": "SEGURATA",
                "category": "Gr2",
                "points": {
                    "1": 14,
                    "2": 11,
                    "3": 10,
                    "4": 13
                }
            },
            {
                "name": "NICO",
                "category": "Gr3",
                "points": {
                    "1": 8,
                    "2": 7,
                    "3": 8,
                    "4": 8
                }
            },
            {
                "name": "TONY",
                "category": "Gr4",
                "points": {
                    "1": 1,
                    "2": 1,
                    "3": 1,
                    "4": 4
                }
            }
        ]
    }
]

const categoryColors = {
    'Gr1': 'from-red-600 to-red-800',
    'Gr2': 'from-yellow-500 to-yellow-700',
    'Gr3': 'from-green-600 to-green-800',
    'Gr4': 'from-blue-600 to-blue-800'
};

export default function TeamsAdminPage() {
    const [teams, setTeams] = useState(initialTeams);
    const [tracks, setTracks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedTrackId, setSelectedTrackId] = useState(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);

            // Usar el servicio de Firebase directamente
            const [fetchedTeams, fetchedTracks] = await Promise.all([
                FirebaseService.getTeams(),
                FirebaseService.getTracks()
            ]);

            // Si no hay datos en Firebase, usar datos iniciales
            const teamsToUse = fetchedTeams.length > 0 ? fetchedTeams : initialTeams;
            const tracksToUse = fetchedTracks.length > 0 ? fetchedTracks : [];

            // Migrar datos antiguos (array) a nueva estructura (objeto con IDs)
            const updatedTeams = teamsToUse.map(team => ({
                ...team,
                drivers: team.drivers.map(driver => {
                    let points = {};

                    if (Array.isArray(driver.points)) {
                        // Migrar de array a objeto con IDs
                        driver.points.forEach((point, index) => {
                            const trackId = tracksToUse[index]?.id;
                            if (trackId) {
                                points[trackId.toString()] = point || 0;
                            }
                        });
                    } else if (typeof driver.points === 'object') {
                        // Ya está en el formato correcto
                        points = { ...driver.points };
                    }

                    // Asegurar que todos los tracks tengan entrada
                    tracksToUse.forEach(track => {
                        if (!points.hasOwnProperty(track.id.toString())) {
                            points[track.id.toString()] = 0;
                        }
                    });

                    return {
                        ...driver,
                        points: points
                    };
                })
            }));

            setTeams(updatedTeams);
            setTracks(tracksToUse);

            // Auto-seleccionar la próxima carrera a completar
            const nextTrackId = findNextRaceToComplete(tracksToUse, updatedTeams);
            setSelectedTrackId(nextTrackId);

        } catch (error) {
            console.error("Error fetching data:", error);
            // En caso de error, usar datos iniciales
            setTeams(initialTeams);
            setTracks([]);
        } finally {
            setLoading(false);
        }
    };

    // Encuentra la próxima carrera que necesita puntos
    const findNextRaceToComplete = (tracks, teams) => {
        if (tracks.length === 0 || teams.length === 0) return tracks[0]?.id || null;

        const today = new Date();

        // Ordenar tracks por fecha
        const sortedTracks = [...tracks].sort((a, b) => new Date(a.date) - new Date(b.date));

        for (let track of sortedTracks) {
            const raceDate = new Date(track.date);
            const hasResults = teams[0].drivers[0].points[track.id.toString()] > 0;

            // Si la carrera ya pasó pero no tiene resultados, priorizarla
            if (raceDate <= today && !hasResults) {
                return track.id;
            }
        }

        // Si no hay carreras pasadas sin resultados, encontrar la próxima carrera
        for (let track of sortedTracks) {
            const raceDate = new Date(track.date);
            if (raceDate >= today) {
                return track.id;
            }
        }

        return sortedTracks[0]?.id || null;
    };

    // Guarda los equipos usando el servicio de Firebase
    const handleSave = async () => {
        try {
            await FirebaseService.saveTeams(teams);
            alert("Equipos guardados correctamente en Firebase");
        } catch (error) {
            console.error("Error saving teams:", error);
            alert("Error al guardar equipos: " + error.message);
        }
    };

    // Calcula el total de puntos de un piloto
    const calculateDriverTotal = (points) => {
        return Object.values(points).reduce((sum, point) => sum + (parseInt(point) || 0), 0);
    };

    // Calcula el total de puntos de un equipo
    const calculateTeamTotal = (drivers) => {
        return drivers.reduce((sum, driver) => sum + calculateDriverTotal(driver.points), 0);
    };

    // Actualiza el nombre del equipo
    const handleTeamNameChange = (idx, value) => {
        const updated = [...teams];
        updated[idx].name = value;
        setTeams(updated);
    };

    // Actualiza el nombre de un piloto
    const handleDriverNameChange = (teamIdx, driverIdx, value) => {
        const updated = [...teams];
        updated[teamIdx].drivers[driverIdx].name = value;
        setTeams(updated);
    };

    // Actualiza los puntos de un piloto en una pista específica
    const handlePointsChange = (teamIdx, driverIdx, trackId, value) => {
        const updated = [...teams];
        const points = parseInt(value) || 0;

        // Asegurar que el objeto de puntos existe
        if (!updated[teamIdx].drivers[driverIdx].points) {
            updated[teamIdx].drivers[driverIdx].points = {};
        }

        updated[teamIdx].drivers[driverIdx].points[trackId.toString()] = points;

        setTeams(updated);
    };

    // Obtener el estado de la carrera (pasada, actual, futura)
    const getTrackStatus = (trackDate, trackId) => {
        const today = new Date();
        const raceDate = new Date(trackDate);
        const diffTime = raceDate - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        // Verificar si ya tiene resultados
        const hasResults = teams.length > 0 && teams[0].drivers[0].points[trackId.toString()] > 0;

        if (diffDays < 0) {
            return hasResults ? 'completed' : 'missing';
        }
        if (diffDays <= 7) return 'current';
        return 'future';
    };

    // Obtener track seleccionado
    const selectedTrack = tracks.find(track => track.id === selectedTrackId);

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 flex items-center justify-center">
                <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-orange-500"></div>
                    <p className="text-white mt-4 text-xl">Cargando equipos...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 p-8">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="bg-gradient-to-r from-orange-600 to-red-600 rounded-t-lg p-6 border-b-4 border-blue-500">
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <span className="text-4xl">🏎️</span>
                        Administrar Equipos IMSA GT7
                    </h1>
                    <p className="text-orange-100 mt-2">Gestiona los equipos, pilotos y puntos del campeonato</p>
                </div>

                {/* Content */}
                <div className="bg-white/10 backdrop-blur-sm rounded-b-lg p-6">
                    {/* Track Selector */}
                    {tracks.length > 0 && (
                        <div className="mb-8">
                            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                                🏁 Seleccionar Carrera para Editar Puntos:
                            </h3>
                            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                {tracks
                                    .sort((a, b) => new Date(a.date) - new Date(b.date))
                                    .map((track) => {
                                        const status = getTrackStatus(track.date, track.id);
                                        let statusColor = '';
                                        let statusText = '';
                                        let borderColor = '';

                                        switch (status) {
                                            case 'completed':
                                                statusColor = 'from-green-600 to-emerald-600';
                                                statusText = '✅ Completada';
                                                borderColor = 'border-green-400';
                                                break;
                                            case 'missing':
                                                statusColor = 'from-red-600 to-red-700';
                                                statusText = '❗ Faltan Puntos';
                                                borderColor = 'border-red-400';
                                                break;
                                            case 'current':
                                                statusColor = 'from-yellow-600 to-orange-600';
                                                statusText = '🔥 Esta Semana';
                                                borderColor = 'border-yellow-400';
                                                break;
                                            case 'future':
                                                statusColor = 'from-blue-600 to-indigo-600';
                                                statusText = '📅 Próxima';
                                                borderColor = 'border-blue-400';
                                                break;
                                        }

                                        return (
                                            <button
                                                key={track.id}
                                                onClick={() => setSelectedTrackId(track.id)}
                                                className={`p-4 rounded-lg border-2 transition-all duration-200 text-left ${selectedTrackId === track.id
                                                    ? `border-orange-400 bg-white/25 shadow-lg ring-2 ring-orange-400/50`
                                                    : `${borderColor} bg-white/10 hover:bg-white/20`
                                                    }`}
                                            >
                                                <div className="text-white font-semibold text-sm mb-1">
                                                    Carrera #{track.id}
                                                </div>
                                                <div className="text-orange-300 font-bold">
                                                    {track.name}
                                                </div>
                                                <div className="text-gray-300 text-xs mt-1">
                                                    📍 {track.country}
                                                </div>
                                                <div className="text-gray-300 text-xs">
                                                    📅 {new Date(track.date).toLocaleDateString('es-ES')}
                                                </div>
                                                <div className={`bg-gradient-to-r ${statusColor} text-white px-2 py-1 rounded-full text-xs font-bold mt-2 inline-block`}>
                                                    {statusText}
                                                </div>
                                                {status === 'missing' && (
                                                    <div className="text-red-300 text-xs mt-1 font-semibold">
                                                        ⚠️ Carrera pasada sin puntos
                                                    </div>
                                                )}
                                            </button>
                                        );
                                    })}
                            </div>

                            {/* Instructions */}
                            <div className="mt-4 bg-blue-900/30 border border-blue-400/50 rounded-lg p-4">
                                <h4 className="text-blue-300 font-semibold mb-2">📝 Instrucciones:</h4>
                                <ul className="text-blue-200 text-sm space-y-1">
                                    <li>• <span className="text-green-400">Verde ✅</span>: Carrera completada con puntos</li>
                                    <li>• <span className="text-red-400">Rojo ❗</span>: Carrera pasada SIN puntos (necesita actualizar)</li>
                                    <li>• <span className="text-yellow-400">Amarillo 🔥</span>: Carrera de esta semana</li>
                                    <li>• <span className="text-blue-400">Azul 📅</span>: Carrera futura</li>
                                </ul>
                            </div>
                        </div>
                    )}

                    {/* Teams Grid */}
                    <div className="grid gap-8 lg:grid-cols-2">
                        {teams.map((team, idx) => (
                            <div
                                key={team.id}
                                className="bg-white/20 backdrop-blur-sm border border-white/30 rounded-lg p-6 hover:bg-white/25 transition-all duration-300 shadow-lg hover:shadow-xl"
                            >
                                {/* Team Header */}
                                <div className="mb-6">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div
                                            className={`w-6 h-6 rounded-full`}
                                            style={{ backgroundColor: team.color }}
                                        ></div>
                                        <h2 className="text-xl font-bold text-white">Equipo #{idx + 1}</h2>
                                        <div className="ml-auto bg-gradient-to-r from-purple-600 to-purple-800 text-white px-3 py-1 rounded-full font-bold">
                                            Total: {calculateTeamTotal(team.drivers)} pts
                                        </div>
                                    </div>

                                    <label className="block text-orange-300 font-semibold mb-2">
                                        🏆 Nombre del equipo:
                                    </label>
                                    <input
                                        className="w-full bg-white/20 border border-white/40 rounded-lg p-3 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-200 font-semibold"
                                        value={team.name}
                                        onChange={e => handleTeamNameChange(idx, e.target.value)}
                                        placeholder="Nombre del equipo"
                                    />
                                </div>

                                {/* Drivers */}
                                <div>
                                    <label className="block text-orange-300 font-semibold mb-4 text-lg">
                                        👥 Pilotos:
                                    </label>
                                    <div className="space-y-4">
                                        {team.drivers.map((driver, dIdx) => (
                                            <div
                                                key={dIdx}
                                                className="bg-white/10 rounded-lg p-4 border border-white/20 hover:bg-white/15 transition-all duration-200"
                                            >
                                                <div className="flex flex-wrap items-center gap-3 mb-3">
                                                    <div className={`bg-gradient-to-r ${categoryColors[driver.category]} text-white px-3 py-1 rounded-full font-bold text-sm`}>
                                                        {driver.category}
                                                    </div>

                                                    <input
                                                        className="flex-1 min-w-[120px] bg-white/20 border border-white/40 rounded-lg p-2 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 font-semibold"
                                                        value={driver.name}
                                                        onChange={e => handleDriverNameChange(idx, dIdx, e.target.value)}
                                                        placeholder="Nombre del piloto"
                                                    />

                                                    <div className="bg-gradient-to-r from-indigo-600 to-indigo-800 text-white px-3 py-1 rounded-full font-bold text-sm">
                                                        Total: {calculateDriverTotal(driver.points)} pts
                                                    </div>
                                                </div>

                                                {/* Points for selected track */}
                                                {selectedTrack && (
                                                    <div className="mt-3 p-4 bg-white/15 rounded-lg border-2 border-orange-400/70">
                                                        <div className="flex items-center justify-between mb-2">
                                                            <span className="text-orange-300 font-bold text-sm">
                                                                🏁 {selectedTrack.name} (ID: {selectedTrack.id})
                                                            </span>
                                                            <span className="text-gray-300 text-xs">
                                                                📅 {new Date(selectedTrack.date).toLocaleDateString('es-ES')}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-3">
                                                            <span className="text-white font-semibold">Puntos:</span>
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                max="50"
                                                                className="w-24 bg-white/20 border-2 border-orange-400/50 rounded-lg p-2 text-white text-center font-bold focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-lg"
                                                                value={driver.points?.[selectedTrack.id.toString()] || 0}
                                                                onChange={e => handlePointsChange(idx, dIdx, selectedTrack.id, e.target.value)}
                                                                placeholder="0"
                                                            />
                                                            <span className="text-white font-semibold">pts</span>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* All points summary by track */}
                                                <div className="mt-3 text-xs">
                                                    <div className="bg-gray-700/50 text-gray-300 px-3 py-2 rounded-lg">
                                                        <div className="font-semibold mb-2">Historial por Pista:</div>
                                                        <div className="grid grid-cols-3 gap-1">
                                                            {tracks
                                                                .sort((a, b) => new Date(a.date) - new Date(b.date))
                                                                .map((track) => {
                                                                    const points = driver.points?.[track.id.toString()] || 0;
                                                                    return (
                                                                        <div key={track.id} className={`text-center p-2 rounded text-xs ${selectedTrackId === track.id
                                                                            ? 'bg-orange-500 text-white border-2 border-orange-300'
                                                                            : points > 0
                                                                                ? 'bg-green-600 text-white'
                                                                                : 'bg-gray-600 text-gray-300'
                                                                            }`}>
                                                                            <div className="font-bold">{track.name.substring(0, 8)}</div>
                                                                            <div className="font-bold">{points}</div>
                                                                        </div>
                                                                    );
                                                                })}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Save Button */}
                    <div className="mt-8 text-center">
                        <button
                            onClick={handleSave}
                            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-8 py-4 rounded-lg font-bold text-lg transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
                        >
                            💾 Guardar Equipos
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}