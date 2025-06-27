"use client";
import { useEffect, useState } from "react";

const initialTracks = [
    { "id": 1, "name": "Watkins Glen", "country": "USA", "date": "2024-04-11" },
    { "id": 2, "name": "Monza", "country": "Italia", "date": "2024-04-25" },
    { "id": 3, "name": "LeMans", "country": "Francia", "date": "2024-05-16" },
    { "id": 4, "name": "Brands Hatch", "country": "UK", "date": "2024-05-30" },
    { "id": 5, "name": "Interlagos", "country": "Brasil", "date": "2024-06-13" },
    { "id": 6, "name": "Daytona", "country": "USA", "date": "2024-06-27" },
    { "id": 7, "name": "Nurburgring GP", "country": "Alemania", "date": "2024-07-11" },
    { "id": 8, "name": "Suzuka", "country": "Japón", "date": "2024-07-25" },
    { "id": 9, "name": "Laguna Seca", "country": "USA", "date": "2024-08-08" },
    { "id": 10, "name": "Fuji", "country": "Japón", "date": "2024-08-22" },
    { "id": 11, "name": "Road Atlanta", "country": "USA", "date": "2024-09-12" },
    { "id": 12, "name": "RedBull Ring", "country": "Austria", "date": "2024-10-17" },
    { "id": 13, "name": "Spa Francorchamps", "country": "Bélgica", "date": "2024-10-31" },
    { "id": 14, "name": "Mount Panorama", "country": "Australia", "date": "2024-11-14" },
    { "id": 15, "name": "Catalunya", "country": "España", "date": "2024-11-30" }
]

export default function TracksAdminPage() {
    const [tracks, setTracks] = useState(initialTracks);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchTracks();
    }, []);

    const fetchTracks = async () => {
        try {
            const tracks = await fetch("/api/tracks", {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            }).then(res => res.json());
            setTracks(tracks.length > 0 ? tracks : initialTracks);
            setLoading(false);
        } catch (error) {
            console.error("Error fetching tracks:", error);
            setLoading(false);
        }
    };

    const saveTracks = async (tracks) => {
        try {
            const response = await fetch("/api/tracks", {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(tracks)
            });
            if (!response.ok) throw new Error("Error al guardar las pistas");
            return response.json();
        } catch (error) {
            console.error("Error saving tracks:", error);
        }
    };

    const handleTrackNameChange = (index, value) => {
        const updatedTracks = [...tracks];
        updatedTracks[index].name = value;
        setTracks(updatedTracks);
    };

    const handleTrackCountryChange = (index, value) => {
        const updatedTracks = [...tracks];
        updatedTracks[index].country = value;
        setTracks(updatedTracks);
    };

    const handleTrackDateChange = (index, value) => {
        const updatedTracks = [...tracks];
        updatedTracks[index].date = value;
        setTracks(updatedTracks);
    };

    const addNewTrack = () => {
        const newTrack = {
            id: tracks.length + 1,
            name: "Nueva Pista",
            country: "País",
            date: new Date().toISOString().split('T')[0]
        };
        setTracks([...tracks, newTrack]);
    };

    const removeTrack = (index) => {
        const updatedTracks = tracks.filter((_, i) => i !== index);
        setTracks(updatedTracks);
    };

    const handleSave = async () => {
        await saveTracks(tracks);
        alert("Pistas guardadas correctamente");
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 flex items-center justify-center">
                <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-orange-500"></div>
                    <p className="text-white mt-4 text-xl">Cargando pistas...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 p-8">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="bg-gradient-to-r from-orange-600 to-red-600 rounded-t-lg p-6 border-b-4 border-blue-500">
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <span className="text-4xl">🏁</span>
                        Administrar Pistas IMSA GT7
                    </h1>
                    <p className="text-orange-100 mt-2">Gestiona las pistas del campeonato</p>
                </div>

                {/* Content */}
                <div className="bg-white/10 backdrop-blur-sm rounded-b-lg p-6">
                    {/* Add Track Button */}
                    <div className="mb-6">
                        <button
                            onClick={addNewTrack}
                            className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white px-6 py-3 rounded-lg font-semibold transition-all duration-300 shadow-lg hover:shadow-xl flex items-center gap-2"
                        >
                            <span className="text-xl">+</span>
                            Agregar Nueva Pista
                        </button>
                    </div>

                    {/* Tracks Grid */}
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                        {tracks.map((track, index) => (
                            <div
                                key={track.id}
                                className="bg-white/20 backdrop-blur-sm border border-white/30 rounded-lg p-6 hover:bg-white/25 transition-all duration-300 shadow-lg hover:shadow-xl"
                            >
                                <div className="flex justify-between items-start mb-4">
                                    <h3 className="text-lg font-bold text-white">Pista #{index + 1}</h3>
                                    <button
                                        onClick={() => removeTrack(index)}
                                        className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded-md text-sm transition-colors duration-200"
                                    >
                                        Eliminar
                                    </button>
                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-orange-300 font-semibold mb-2">
                                            🏁 Nombre de la Pista:
                                        </label>
                                        <input
                                            type="text"
                                            className="w-full bg-white/20 border border-white/40 rounded-lg p-3 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-200"
                                            value={track.name}
                                            onChange={e => handleTrackNameChange(index, e.target.value)}
                                            placeholder="Nombre de la pista"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-orange-300 font-semibold mb-2">
                                            🌍 País:
                                        </label>
                                        <input
                                            type="text"
                                            className="w-full bg-white/20 border border-white/40 rounded-lg p-3 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-200"
                                            value={track.country}
                                            onChange={e => handleTrackCountryChange(index, e.target.value)}
                                            placeholder="País"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-orange-300 font-semibold mb-2">
                                            📅 Fecha:
                                        </label>
                                        <input
                                            type="date"
                                            className="w-full bg-white/20 border border-white/40 rounded-lg p-3 text-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-200"
                                            value={track.date}
                                            onChange={e => handleTrackDateChange(index, e.target.value)}
                                        />
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
                            💾 Guardar Pistas
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}