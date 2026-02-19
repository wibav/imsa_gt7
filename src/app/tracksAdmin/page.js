"use client";
import { useEffect, useState, useMemo } from "react";
import { FirebaseService } from "../services/firebaseService";
import { GT7_TRACKS } from "../utils/constants";
import Image from "next/image";
import LoadingSkeleton from "../components/common/LoadingSkeleton";

/**
 * Normaliza un nombre de pista para comparación (quita acentos, minúsculas, etc.)
 */
const normalizeTrackName = (name) =>
    (name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

export default function TracksAdminPage() {
    const [firestoreTracks, setFirestoreTracks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingTrack, setEditingTrack] = useState(null);
    const [uploadingImage, setUploadingImage] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [imageFilter, setImageFilter] = useState('all'); // 'all' | 'with' | 'without'

    const [trackForm, setTrackForm] = useState({
        name: '',
        country: '',
        layoutImage: ''
    });

    useEffect(() => {
        fetchTracks();
    }, []);

    const fetchTracks = async () => {
        try {
            setLoading(true);
            const fetchedTracks = await FirebaseService.getTracks();
            setFirestoreTracks(fetchedTracks);
        } catch (error) {
            console.error("Error fetching tracks:", error);
            setFirestoreTracks([]);
        } finally {
            setLoading(false);
        }
    };

    /**
     * Fusiona las pistas de Firestore con la lista completa de GT7.
     * Las pistas de GT7 que no existen en Firestore se muestran como "sin imagen".
     */
    const tracks = useMemo(() => {
        // Mapa normalizado de pistas ya guardadas en Firestore
        const firestoreMap = new Map();
        firestoreTracks.forEach(t => {
            firestoreMap.set(normalizeTrackName(t.name), t);
        });

        // Empezar con las pistas de Firestore
        const merged = [...firestoreTracks];

        // Agregar pistas de GT7_TRACKS que no están en Firestore
        let nextId = firestoreTracks.length > 0
            ? Math.max(...firestoreTracks.map(t => Number(t.id) || 0)) + 1
            : 1;

        GT7_TRACKS.forEach(trackName => {
            const normalized = normalizeTrackName(trackName);
            if (!firestoreMap.has(normalized)) {
                merged.push({
                    id: `gt7_${nextId++}`,
                    name: trackName,
                    country: '',
                    layoutImage: '',
                    _isVirtual: true // No guardada aún en Firestore
                });
            }
        });

        // Ordenar alfabéticamente
        merged.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        return merged;
    }, [firestoreTracks]);

    const openCreateModal = () => {
        setEditingTrack(null);
        setTrackForm({
            name: '',
            country: '',
            layoutImage: ''
        });
        setShowModal(true);
    };

    const openEditModal = (track) => {
        setEditingTrack(track);
        setTrackForm({
            name: track.name || '',
            country: track.country || '',
            layoutImage: track.layoutImage || ''
        });
        setShowModal(true);
    };

    const handleImageUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            alert('Por favor selecciona un archivo de imagen');
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            alert('La imagen es muy grande. Máximo 5MB');
            return;
        }

        try {
            setUploadingImage(true);
            const timestamp = Date.now();
            const fileName = `${file.name.replace(/\s/g, '_')}`;
            const path = `tracks/${timestamp}_${fileName}`;

            const downloadURL = await FirebaseService.uploadImage(file, path);
            setTrackForm(prev => ({ ...prev, layoutImage: downloadURL }));
            alert('✅ Imagen subida correctamente');
        } catch (error) {
            console.error('Error uploading image:', error);
            alert('Error al subir la imagen: ' + error.message);
        } finally {
            setUploadingImage(false);
        }
    };

    const handleSaveTrack = async () => {
        if (!trackForm.name || !trackForm.country) {
            alert('Por favor completa los campos obligatorios: Nombre y País');
            return;
        }

        try {
            const trackData = {
                ...trackForm,
                updatedAt: new Date().toISOString()
            };

            if (editingTrack) {
                if (editingTrack._isVirtual) {
                    // Pista virtual de GT7 → crear nueva en Firestore
                    const newId = firestoreTracks.length > 0
                        ? Math.max(...firestoreTracks.map(t => Number(t.id) || 0)) + 1
                        : 1;
                    trackData.id = newId;
                    trackData.createdAt = new Date().toISOString();
                    const updatedTracks = [...firestoreTracks, trackData];
                    await FirebaseService.saveTracks(updatedTracks);
                    alert('✅ Pista guardada correctamente');
                } else {
                    // Actualizar pista existente en Firestore
                    trackData.id = editingTrack.id;
                    const updatedTracks = firestoreTracks.map(t =>
                        t.id === editingTrack.id ? { ...t, ...trackData } : t
                    );
                    await FirebaseService.saveTracks(updatedTracks);
                    alert('✅ Pista actualizada correctamente');
                }
            } else {
                // Crear nueva pista
                const newId = firestoreTracks.length > 0
                    ? Math.max(...firestoreTracks.map(t => Number(t.id) || 0)) + 1
                    : 1;
                trackData.id = newId;
                trackData.createdAt = new Date().toISOString();
                const updatedTracks = [...firestoreTracks, trackData];
                await FirebaseService.saveTracks(updatedTracks);
                alert('✅ Pista creada correctamente');
            }

            setShowModal(false);
            fetchTracks();
        } catch (error) {
            console.error('Error saving track:', error);
            alert('Error al guardar la pista: ' + error.message);
        }
    };

    const handleDeleteTrack = async (track) => {
        if (track._isVirtual) {
            alert('Esta pista es parte del catálogo GT7 y no se puede eliminar. Solo se pueden eliminar pistas personalizadas.');
            return;
        }

        if (!confirm(`¿Estás seguro de eliminar la pista "${track.name}"?\n\nEsta acción no se puede deshacer y puede afectar campeonatos que usen esta pista.`)) {
            return;
        }

        try {
            const updatedTracks = firestoreTracks.filter(t => t.id !== track.id);
            await FirebaseService.saveTracks(updatedTracks);
            alert('✅ Pista eliminada correctamente');
            fetchTracks();
        } catch (error) {
            console.error('Error deleting track:', error);
            alert('Error al eliminar la pista: ' + error.message);
        }
    };

    const filteredTracks = useMemo(() => {
        let result = tracks;

        // Filtro por imagen
        if (imageFilter === 'with') {
            result = result.filter(t => t.layoutImage);
        } else if (imageFilter === 'without') {
            result = result.filter(t => !t.layoutImage);
        }

        // Filtro por búsqueda
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            result = result.filter(t =>
                t.name?.toLowerCase().includes(term) ||
                t.country?.toLowerCase().includes(term)
            );
        }

        return result;
    }, [tracks, searchTerm, imageFilter]);

    const tracksWithImage = tracks.filter(t => t.layoutImage).length;
    const tracksWithoutImage = tracks.length - tracksWithImage;

    if (loading) {
        return <LoadingSkeleton variant="page" message="Cargando pistas..." />;
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 p-8">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-4xl font-bold text-white flex items-center gap-3">
                            🏁 Administrar Pistas Globales
                        </h1>
                        <p className="text-gray-300 mt-2">
                            Catálogo maestro de pistas de Gran Turismo 7 • {tracks.length} pistas totales
                            <span className="mx-2">•</span>
                            <span className="text-green-400">{tracksWithImage} con imagen</span>
                            <span className="mx-2">•</span>
                            <span className="text-red-400">{tracksWithoutImage} sin imagen</span>
                        </p>
                    </div>
                    <button
                        onClick={openCreateModal}
                        className="px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold rounded-lg transition-all"
                    >
                        ➕ Nueva Pista
                    </button>
                </div>

                {/* Filtros de imagen */}
                <div className="flex gap-2 mb-4">
                    {[
                        { key: 'all', label: `Todas (${tracks.length})`, color: 'orange' },
                        { key: 'with', label: `Con imagen (${tracksWithImage})`, color: 'green' },
                        { key: 'without', label: `Sin imagen (${tracksWithoutImage})`, color: 'red' },
                    ].map(({ key, label, color }) => (
                        <button
                            key={key}
                            onClick={() => setImageFilter(key)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${imageFilter === key
                                ? `bg-${color}-600 text-white`
                                : 'bg-white/10 text-gray-300 hover:bg-white/20'
                                }`}
                        >
                            {label}
                        </button>
                    ))}
                </div>

                {/* Buscador y filtros */}
                <div className="mb-6 flex gap-4">
                    <div className="flex-1 relative">
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="🔍 Buscar por nombre o país..."
                            className="w-full px-4 py-3 bg-white/10 border border-white/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-orange-500"
                        />
                    </div>
                    <div className="text-white bg-white/10 border border-white/30 rounded-lg px-4 py-3 flex items-center gap-2">
                        <span className="text-sm">Resultados:</span>
                        <span className="font-bold text-orange-400">{filteredTracks.length}</span>
                    </div>
                </div>

                {/* Grid de pistas */}
                {filteredTracks.length === 0 ? (
                    <div className="text-center py-16 bg-white/5 border border-white/20 rounded-xl">
                        <div className="text-6xl mb-4">🏁</div>
                        <p className="text-gray-400 text-lg mb-4">
                            {searchTerm ? 'No se encontraron pistas' : 'No hay pistas registradas'}
                        </p>
                        {!searchTerm && (
                            <button
                                onClick={openCreateModal}
                                className="px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-bold rounded-lg hover:from-green-700 hover:to-emerald-700"
                            >
                                ➕ Crear Primera Pista
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredTracks.map((track) => (
                            <div
                                key={track.id}
                                className={`bg-white/10 border rounded-xl overflow-hidden hover:bg-white/15 transition-all ${track.layoutImage ? 'border-white/30' : 'border-red-500/40'
                                    }`}
                            >
                                {/* Imagen */}
                                <div className="relative h-48 bg-black/30">
                                    {track.layoutImage ? (
                                        <Image
                                            src={track.layoutImage}
                                            alt={track.name}
                                            fill
                                            className="object-contain p-4"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                                            <span className="text-5xl opacity-40">🏁</span>
                                            <span className="text-xs text-red-300 font-medium">Sin imagen asignada</span>
                                        </div>
                                    )}
                                    {track._isVirtual && (
                                        <span className="absolute top-2 left-2 bg-blue-600/80 text-white text-xs px-2 py-0.5 rounded">
                                            Catálogo GT7
                                        </span>
                                    )}
                                </div>

                                {/* Info */}
                                <div className="p-4">
                                    <h3 className="text-xl font-bold text-white mb-2">{track.name}</h3>
                                    <p className="text-gray-300 text-sm mb-3">
                                        {track.country ? `📍 ${track.country}` : '📍 País no asignado'}
                                    </p>

                                    <div className="flex flex-wrap gap-2 mb-4 text-xs">
                                        {!track.layoutImage && (
                                            <span className="bg-red-600/30 text-red-200 px-2 py-1 rounded">
                                                ⚠️ Sin imagen
                                            </span>
                                        )}
                                        {track._isVirtual && !track.country && (
                                            <span className="bg-yellow-600/30 text-yellow-200 px-2 py-1 rounded">
                                                📝 Sin país
                                            </span>
                                        )}
                                    </div>

                                    {/* Botones */}
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => openEditModal(track)}
                                            className={`flex-1 px-3 py-2 text-white text-sm font-medium rounded-lg transition-all ${!track.layoutImage
                                                ? 'bg-orange-600 hover:bg-orange-700'
                                                : 'bg-blue-600 hover:bg-blue-700'
                                                }`}
                                        >
                                            {!track.layoutImage ? '📷 Asignar imagen' : '✏️ Editar'}
                                        </button>
                                        {!track._isVirtual && (
                                            <button
                                                onClick={() => handleDeleteTrack(track)}
                                                className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-all"
                                            >
                                                🗑️
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Modal */}
                {showModal && (
                    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                        <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-white/30 rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-2xl font-bold text-white">
                                    {editingTrack ? '✏️ Editar Pista' : '➕ Nueva Pista'}
                                </h3>
                                <button
                                    onClick={() => setShowModal(false)}
                                    className="text-gray-400 hover:text-white text-2xl"
                                >
                                    ✕
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">
                                        Nombre de la Pista *
                                    </label>
                                    <input
                                        type="text"
                                        value={trackForm.name}
                                        onChange={(e) => setTrackForm(prev => ({ ...prev, name: e.target.value }))}
                                        className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white focus:outline-none focus:border-orange-500"
                                        placeholder="Ej: Circuito de Catalunya"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">
                                        País *
                                    </label>
                                    <input
                                        type="text"
                                        value={trackForm.country}
                                        onChange={(e) => setTrackForm(prev => ({ ...prev, country: e.target.value }))}
                                        className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white focus:outline-none focus:border-orange-500"
                                        placeholder="Ej: España"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">
                                        Imagen del Circuito
                                    </label>

                                    {trackForm.layoutImage && (
                                        <div className="relative w-full h-48 bg-black/30 rounded-lg overflow-hidden mb-3">
                                            <Image
                                                src={trackForm.layoutImage}
                                                alt="Preview"
                                                fill
                                                className="object-contain p-2"
                                            />
                                            <button
                                                onClick={() => setTrackForm(prev => ({ ...prev, layoutImage: '' }))}
                                                className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded-lg text-sm"
                                            >
                                                🗑️ Quitar
                                            </button>
                                        </div>
                                    )}

                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handleImageUpload}
                                        disabled={uploadingImage}
                                        className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-orange-600 file:text-white file:cursor-pointer hover:file:bg-orange-700"
                                    />
                                    {uploadingImage && (
                                        <p className="text-sm text-orange-400 mt-2">⏳ Subiendo imagen...</p>
                                    )}
                                    <p className="text-xs text-gray-400 mt-2">
                                        Formatos: JPG, PNG, SVG. Máximo 5MB.
                                    </p>
                                </div>
                            </div>

                            <div className="flex gap-3 mt-6">
                                <button
                                    onClick={handleSaveTrack}
                                    disabled={uploadingImage}
                                    className="flex-1 px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {editingTrack ? '💾 Guardar Cambios' : '➕ Crear Pista'}
                                </button>
                                <button
                                    onClick={() => setShowModal(false)}
                                    className="px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white font-bold rounded-lg transition-all"
                                >
                                    Cancelar
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}