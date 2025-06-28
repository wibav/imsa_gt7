"use client";
import { useEffect, useState } from "react";
import { FirebaseService } from "../services/firebaseService";
import ProtectedRoute from "../components/ProtectedRoute";
import AdminNavigation from "../components/AdminNavigation";

export default function TracksAdminPage() {
    const [tracks, setTracks] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchTracks();
    }, []);

    const fetchTracks = async () => {
        try {
            setLoading(true);
            const fetchedTracks = await FirebaseService.getTracks();
            setTracks(fetchedTracks);
        } catch (error) {
            console.error("Error fetching tracks:", error);
            setTracks([]);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        try {
            await FirebaseService.saveTracks(tracks);
            alert("Pistas guardadas correctamente");
        } catch (error) {
            console.error("Error saving tracks:", error);
            alert("Error al guardar pistas: " + error.message);
        }
    };

    const updateTrack = (index, field, value) => {
        const updatedTracks = [...tracks];
        updatedTracks[index][field] = value;
        setTracks(updatedTracks);
    };

    const addNewTrack = () => {
        const newTrack = {
            id: tracks.length + 1,
            name: "Nueva Pista",
            country: "País",
            date: new Date().toISOString().split('T')[0],
            layoutImage: "" // Nuevo campo para la imagen
        };
        setTracks([...tracks, newTrack]);
    };

    const removeTrack = (index) => {
        if (confirm("¿Estás seguro de eliminar esta pista?")) {
            const updatedTracks = tracks.filter((_, i) => i !== index);
            setTracks(updatedTracks);
        }
    };

    if (loading) {
        return (
            <ProtectedRoute requireAdmin={true}>
                <div className="min-h-screen bg-gradient-to-br from-slate-900 via-green-900 to-slate-800 flex items-center justify-center">
                    <div className="text-center">
                        <div className="inline-block animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-green-500"></div>
                        <p className="text-white mt-4 text-xl">Cargando pistas...</p>
                    </div>
                </div>
            </ProtectedRoute>
        );
    }

    return (
        <ProtectedRoute requireAdmin={true}>
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-green-900 to-slate-800">
                {/* Navegación Admin */}
                <AdminNavigation currentPage="tracks" />

                {/* Contenido Principal */}
                <div className="max-w-7xl mx-auto p-8">
                    {/* Header de la página */}
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h2 className="text-4xl font-bold text-white flex items-center gap-3">
                                🏁 Administrar Pistas
                            </h2>
                            <p className="text-green-200 text-lg mt-2">
                                Gestiona el calendario de carreras y las pistas del campeonato
                            </p>
                        </div>

                        {/* Botones de acción principales */}
                        <div className="flex gap-4">
                            <button
                                onClick={handleSave}
                                className="bg-gradient-to-r from-green-600 to-emerald-600 text-white px-6 py-3 rounded-lg font-bold hover:from-green-700 hover:to-emerald-700 transition-all duration-200 flex items-center gap-2"
                            >
                                💾 Guardar Cambios
                            </button>

                            <button
                                onClick={addNewTrack}
                                className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-3 rounded-lg font-bold hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 flex items-center gap-2"
                            >
                                ➕ Nueva Pista
                            </button>

                            <button
                                onClick={() => window.location.reload()}
                                className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-6 py-3 rounded-lg font-bold hover:from-purple-700 hover:to-indigo-700 transition-all duration-200 flex items-center gap-2"
                            >
                                🔄 Recargar
                            </button>
                        </div>
                    </div>

                    {/* Grid de Pistas */}
                    <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                        {tracks.map((track, index) => (
                            <div
                                key={track.id}
                                className="bg-white/10 backdrop-blur-sm border border-white/30 rounded-lg overflow-hidden hover:bg-white/15 transition-all duration-300 shadow-lg hover:shadow-xl"
                            >
                                {/* Vista previa de la imagen */}
                                <div className="relative h-40 bg-gradient-to-br from-gray-800 to-gray-900">
                                    {track.layoutImage ? (
                                        <img
                                            src={track.layoutImage}
                                            alt={`Trazado de ${track.name}`}
                                            className="w-full h-full object-contain p-2"
                                            onError={(e) => {
                                                e.target.style.display = 'none';
                                                e.target.nextSibling.style.display = 'flex';
                                            }}
                                        />
                                    ) : null}

                                    {/* Fallback cuando no hay imagen o falla al cargar */}
                                    <div
                                        className={`w-full h-full flex items-center justify-center text-4xl ${track.layoutImage ? 'hidden' : 'flex'}`}
                                        style={{ display: track.layoutImage ? 'none' : 'flex' }}
                                    >
                                        🏁
                                    </div>

                                    {/* Número de pista */}
                                    <div className="absolute top-2 left-2 bg-green-600 text-white px-2 py-1 rounded-full text-sm font-bold">
                                        #{track.id}
                                    </div>

                                    {/* Botón eliminar */}
                                    <button
                                        onClick={() => removeTrack(index)}
                                        className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white w-8 h-8 rounded-full flex items-center justify-center transition-colors duration-200"
                                        title="Eliminar pista"
                                    >
                                        ×
                                    </button>
                                </div>

                                {/* Formulario de edición */}
                                <div className="p-6 space-y-4">
                                    {/* Nombre de la Pista */}
                                    <div>
                                        <label className="block text-green-300 font-semibold mb-2 text-sm">
                                            🏁 Nombre de la Pista:
                                        </label>
                                        <input
                                            type="text"
                                            className="w-full bg-white/20 border border-white/40 rounded-lg p-3 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200"
                                            value={track.name || ''}
                                            onChange={(e) => updateTrack(index, 'name', e.target.value)}
                                            placeholder="Nombre de la pista"
                                        />
                                    </div>

                                    {/* País */}
                                    <div>
                                        <label className="block text-green-300 font-semibold mb-2 text-sm">
                                            🌍 País:
                                        </label>
                                        <input
                                            type="text"
                                            className="w-full bg-white/20 border border-white/40 rounded-lg p-3 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200"
                                            value={track.country || ''}
                                            onChange={(e) => updateTrack(index, 'country', e.target.value)}
                                            placeholder="País"
                                        />
                                    </div>

                                    {/* Fecha */}
                                    <div>
                                        <label className="block text-green-300 font-semibold mb-2 text-sm">
                                            📅 Fecha:
                                        </label>
                                        <input
                                            type="date"
                                            className="w-full bg-white/20 border border-white/40 rounded-lg p-3 text-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200"
                                            value={track.date || ''}
                                            onChange={(e) => updateTrack(index, 'date', e.target.value)}
                                        />
                                    </div>

                                    {/* URL de Imagen del Trazado */}
                                    <div>
                                        <label className="block text-green-300 font-semibold mb-2 text-sm">
                                            🖼️ URL de Imagen del Trazado:
                                        </label>
                                        <div className="space-y-2">
                                            <input
                                                type="url"
                                                className="w-full bg-white/20 border border-white/40 rounded-lg p-3 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200"
                                                value={track.layoutImage || ''}
                                                onChange={(e) => updateTrack(index, 'layoutImage', e.target.value)}
                                                placeholder="https://ejemplo.com/imagen-trazado.jpg"
                                            />

                                            {/* Botones de ayuda */}
                                            <div className="flex gap-2 text-xs">
                                                <span className="text-green-400">💡 Tip:</span>
                                                <span className="text-gray-300">Usa URLs directas a imágenes (.jpg, .png, .svg)</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Información adicional */}
                                    <div className="pt-4 border-t border-white/20">
                                        <div className="grid grid-cols-2 gap-4 text-sm">
                                            <div>
                                                <span className="text-green-400">ID:</span>
                                                <span className="text-white ml-1">#{track.id}</span>
                                            </div>
                                            <div>
                                                <span className="text-green-400">Estado:</span>
                                                <span className="text-white ml-1">
                                                    {track.layoutImage ? '✅ Con imagen' : '⚠️ Sin imagen'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Botón de Guardar inferior */}
                    <div className="mt-8 text-center">
                        <button
                            onClick={handleSave}
                            className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white px-12 py-4 rounded-lg font-bold text-lg transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 flex items-center gap-3 mx-auto"
                        >
                            <span className="text-2xl">💾</span>
                            Guardar Todas las Pistas
                        </button>
                    </div>

                    {/* Información de ayuda */}
                    <div className="mt-8 bg-green-600/20 border border-green-500/50 rounded-lg p-6">
                        <h3 className="text-green-300 font-bold text-lg mb-3 flex items-center gap-2">
                            📚 Guía para Imágenes de Trazados
                        </h3>
                        <div className="grid md:grid-cols-2 gap-4 text-sm text-green-200">
                            <div>
                                <h4 className="font-semibold mb-2">✅ URLs Recomendadas:</h4>
                                <ul className="space-y-1 text-xs">
                                    <li>• Imágenes directas (.jpg, .png, .svg)</li>
                                    <li>• URLs públicas (sin autenticación)</li>
                                    <li>• Tamaño recomendado: 800x600px mínimo</li>
                                    <li>• Fondo transparente o blanco preferible</li>
                                </ul>
                            </div>
                            <div>
                                <h4 className="font-semibold mb-2">💡 Fuentes Sugeridas:</h4>
                                <ul className="space-y-1 text-xs">
                                    <li>• Wikipedia (diagramas SVG)</li>
                                    <li>• Sitios oficiales de circuitos</li>
                                    <li>• Gran Turismo Database</li>
                                    <li>• Racing-Circuits.info</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </ProtectedRoute>
    );
}