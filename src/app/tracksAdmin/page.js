"use client";
import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../context/AuthContext";
import { FirebaseService } from "../services/firebaseService";
import { validateImageFile, compressImage } from "../utils/imageCompression";
import Image from "next/image";
import LoadingSkeleton from "../components/common/LoadingSkeleton";

export default function TracksAdminPage() {
    const router = useRouter();
    const { currentUser, isPlatformOwner, loading: authLoading } = useAuth();
    const [firestoreTracks, setFirestoreTracks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingTrack, setEditingTrack] = useState(null);
    const [uploadingImage, setUploadingImage] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [imageFilter, setImageFilter] = useState('all'); // 'all' | 'with' | 'without'
    const [syncing, setSyncing] = useState(false);
    const [syncProgress, setSyncProgress] = useState({ done: 0, total: 0 });

    const [trackForm, setTrackForm] = useState({
        name: '',
        country: '',
        layoutImage: ''
    });

    // Rutas de Storage subidas DENTRO de este modal y todavía no guardadas en
    // Firestore. Si el usuario cierra sin guardar, quita la imagen o sube otra
    // encima, esos objetos quedarían en el bucket sin que ningún documento los
    // cite. Solo se borran estas: una imagen que ya venía en la pista puede
    // estar propagada a los campeonatos (propagateTrackImage) y borrarla
    // rompería esas tarjetas.
    const [pendingUploads, setPendingUploads] = useState([]);

    /** Borra de Storage las subidas de esta sesión que no se han guardado. */
    const discardPendingUploads = async (paths) => {
        for (const path of paths) {
            try {
                await FirebaseService.deleteImage(path);
            } catch (error) {
                // Que no se pueda limpiar no debe impedir cerrar el modal:
                // el objeto quedará como huérfano y lo recogerá
                // scripts/audit-storage-images.js.
                console.warn('No se pudo borrar la imagen sin usar:', path, error);
            }
        }
    };

    const closeModal = async () => {
        const toDiscard = pendingUploads;
        setPendingUploads([]);
        setShowModal(false);
        await discardPendingUploads(toDiscard);
    };

    useEffect(() => {
        if (!authLoading && !currentUser) {
            router.push('/login');
        }
    }, [currentUser, authLoading, router]);

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

    // Firestore es la única fuente del catálogo (121 layouts oficiales de
    // GT7 sincronizados vía scripts/sync-official-tracks-catalog.js) — ya
    // no hace falta fusionar con una lista estática de respaldo, y
    // FirebaseService.getTracks() ya devuelve orden alfabético.
    const tracks = firestoreTracks;

    const openCreateModal = () => {
        setEditingTrack(null);
        setPendingUploads([]);
        setTrackForm({
            name: '',
            country: '',
            layoutImage: ''
        });
        setShowModal(true);
    };

    const openEditModal = (track) => {
        setEditingTrack(track);
        setPendingUploads([]);
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

        try {
            validateImageFile(file);
            setUploadingImage(true);
            const compressed = await compressImage(file);

            // El objeto se nombra por el hash de su contenido: volver a subir
            // el mismo layout no crea una segunda copia en el bucket.
            const { url, path, reused } = await FirebaseService.uploadImageDeduped(
                compressed, 'tracks', compressed.name
            );

            // Si ya se había subido otra imagen en este mismo modal, esa queda
            // sin usar: se descarta antes de perder su ruta.
            const previous = pendingUploads.filter(p => p !== path);
            setPendingUploads(reused ? [] : [path]);
            await discardPendingUploads(previous);

            setTrackForm(prev => ({ ...prev, layoutImage: url }));
            alert(reused
                ? '✅ Esta imagen ya estaba en el almacenamiento: se ha reutilizado.'
                : '✅ Imagen subida correctamente');
        } catch (error) {
            console.error('Error uploading image:', error);
            alert('Error al subir la imagen: ' + error.message);
        } finally {
            setUploadingImage(false);
            // Permite volver a elegir el mismo archivo tras un fallo (el input
            // no dispara change si el valor no cambia).
            e.target.value = '';
        }
    };

    /**
     * Quita la imagen del formulario. Si se acababa de subir en este modal,
     * también se borra del bucket; si ya venía guardada, solo se desasocia
     * (puede estar propagada a campeonatos).
     */
    const handleRemoveImage = async () => {
        const current = FirebaseService.storagePathFromUrl(trackForm.layoutImage);
        setTrackForm(prev => ({ ...prev, layoutImage: '' }));
        if (current && pendingUploads.includes(current)) {
            setPendingUploads(prev => prev.filter(p => p !== current));
            await discardPendingUploads([current]);
        }
    };

    const handleSaveTrack = async () => {
        if (!trackForm.name || !trackForm.country) {
            alert('Por favor completa los campos obligatorios: Nombre y País');
            return;
        }

        // Los campeonatos referencian los circuitos por NOMBRE, no por id
        // (propagateTrackImage compara nombres normalizados). Dos pistas con
        // el mismo nombre es justo el desorden que se depuró al migrar el
        // catálogo oficial, así que se corta aquí.
        const normalized = trackForm.name.trim().toLowerCase();
        const clash = firestoreTracks.find(
            t => (t.name || '').trim().toLowerCase() === normalized && t.id !== editingTrack?.id
        );
        if (clash) {
            alert(`Ya existe una pista llamada "${clash.name}". Usa un nombre distinto (por ejemplo incluyendo la variante del trazado).`);
            return;
        }

        // Cambiar el nombre rompe esa misma referencia por nombre: los
        // campeonatos que ya usan la pista dejarían de encontrarla.
        if (editingTrack && editingTrack.name && editingTrack.name !== trackForm.name) {
            const ok = confirm(
                `Vas a renombrar "${editingTrack.name}" a "${trackForm.name}".\n\n` +
                'Los campeonatos guardan el circuito por su nombre, así que los que ya usen el anterior dejarán de sincronizar su imagen. ¿Continuar?'
            );
            if (!ok) return;
        }

        try {
            const trackData = {
                ...trackForm,
                updatedAt: new Date().toISOString()
            };

            if (editingTrack) {
                // Actualizar pista existente en Firestore directamente por su ID
                // (evita el problema de tipo numérico/string en la comparación)
                const updatedTrack = {
                    ...editingTrack,  // conserva createdAt y otros campos
                    ...trackData,     // sobreescribe con los nuevos valores (incluye layoutImage)
                    id: editingTrack.id,
                };
                await FirebaseService.saveTracks([updatedTrack]);
                // Propagar el layoutImage a todos los campeonatos que usen este circuito
                if (updatedTrack.layoutImage) {
                    await FirebaseService.propagateTrackImage(updatedTrack.name, updatedTrack.layoutImage);
                }
                alert('✅ Pista actualizada correctamente');
            } else {
                // Crear nueva pista. Los ids del catálogo son numéricos
                // (1..121, los asigna scripts/sync-official-tracks-catalog.js);
                // se ignoran los no numéricos en vez de contarlos como 0, que
                // haría que el siguiente id pisara una pista existente.
                const numericIds = firestoreTracks
                    .map(t => Number(t.id))
                    .filter(n => Number.isFinite(n));
                trackData.id = numericIds.length ? Math.max(...numericIds) + 1 : 1;
                trackData.createdAt = new Date().toISOString();
                // Solo la pista nueva: pasar el catálogo entero reescribía las
                // 121 pistas en cada alta.
                await FirebaseService.saveTracks([trackData]);
                alert('✅ Pista creada correctamente');
            }

            // La imagen ya está referenciada desde Firestore: deja de ser una
            // subida pendiente de descartar.
            setPendingUploads([]);
            setShowModal(false);
            fetchTracks();
        } catch (error) {
            console.error('Error saving track:', error);
            alert('Error al guardar la pista: ' + error.message);
        }
    };

    const handleDeleteTrack = async (track) => {
        if (!confirm(`¿Estás seguro de eliminar la pista "${track.name}"?\n\nEsta acción no se puede deshacer y puede afectar campeonatos que usen esta pista.`)) {
            return;
        }

        try {
            // Borrado real del documento. Antes se guardaba la lista filtrada
            // con saveTracks(), que solo hace setDoc: la pista seguía en
            // Firestore aunque el mensaje dijera lo contrario.
            await FirebaseService.deleteTrackFromCatalog(track.id);
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

    const handleSyncAll = async () => {
        const tracksToSync = firestoreTracks.filter(t => t.layoutImage && t.name);
        if (tracksToSync.length === 0) {
            alert('No hay pistas con imagen en el cat\u00e1logo para sincronizar.');
            return;
        }
        if (!confirm(`\u00bfSincronizar las im\u00e1genes de ${tracksToSync.length} pistas a todos los campeonatos?\n\nEsto actualizar\u00e1 el layoutImage en todos los campeonatos que usen esas pistas.`)) return;
        try {
            setSyncing(true);
            setSyncProgress({ done: 0, total: tracksToSync.length });
            // Secuencial a propósito: cada propagateTrackImage recorre todos
            // los campeonatos y sus subcolecciones, y lanzarlas en paralelo
            // multiplica las lecturas sin ganar nada. A cambio se informa del
            // avance, porque con ~20 pistas la operación tarda minutos.
            let done = 0;
            for (const track of tracksToSync) {
                await FirebaseService.propagateTrackImage(track.name, track.layoutImage);
                done += 1;
                setSyncProgress({ done, total: tracksToSync.length });
            }
            alert(`\u2705 Sincronizaci\u00f3n completada: ${tracksToSync.length} pistas propagadas a todos los campeonatos.`);
        } catch (error) {
            console.error('Error en sincronizaci\u00f3n masiva:', error);
            alert('Error durante la sincronizaci\u00f3n: ' + error.message);
        } finally {
            setSyncing(false);
        }
    };

    if (authLoading) {
        return <div className="p-8 text-gray-400 text-sm">Cargando…</div>;
    }

    if (!currentUser || !isPlatformOwner()) {
        return <div className="p-8 text-gray-400 text-sm">Acceso denegado. Esta sección solo la administra el Administrador de Plataforma.</div>;
    }

    if (loading) {
        return <LoadingSkeleton variant="page" message="Cargando pistas..." />;
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 p-4 sm:p-8">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8">
                    <div>
                        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white flex items-center gap-3">
                            🏁 Administrar Pistas Globales
                        </h1>
                        <p className="text-gray-300 text-sm sm:text-base mt-2">
                            Catálogo maestro de pistas de Gran Turismo 7 • {tracks.length} pistas totales
                            <span className="mx-2">•</span>
                            <span className="text-green-400">{tracksWithImage} con imagen</span>
                            <span className="mx-2">•</span>
                            <span className="text-red-400">{tracksWithoutImage} sin imagen</span>
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                        <button
                            onClick={handleSyncAll}
                            disabled={syncing}
                            className="px-5 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 disabled:opacity-50 text-white font-bold rounded-lg transition-all"
                            title="Propaga las im\u00e1genes actuales del cat\u00e1logo a todos los campeonatos"
                        >
                            {syncing
                                ? `⏳ Sincronizando ${syncProgress.done}/${syncProgress.total}...`
                                : '🔄 Sincronizar Imágenes'}
                        </button>
                        <button
                            onClick={openCreateModal}
                            className="px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold rounded-lg transition-all"
                        >
                            ➕ Nueva Pista
                        </button>
                    </div>
                </div>

                {/* Filtros de imagen */}
                <div className="flex flex-wrap gap-2 mb-4">
                    {[
                        { key: 'all', label: `Todas (${tracks.length})`, active: 'bg-orange-600' },
                        { key: 'with', label: `Con imagen (${tracksWithImage})`, active: 'bg-green-600' },
                        { key: 'without', label: `Sin imagen (${tracksWithoutImage})`, active: 'bg-red-600' },
                    ].map(({ key, label, active }) => (
                        <button
                            key={key}
                            onClick={() => setImageFilter(key)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${imageFilter === key
                                ? `${active} text-white`
                                : 'bg-white/10 text-gray-300 hover:bg-white/20'
                                }`}
                        >
                            {label}
                        </button>
                    ))}
                </div>

                {/* Buscador y filtros */}
                <div className="mb-6 flex flex-col sm:flex-row gap-3 sm:gap-4">
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
                                        {!track.country && (
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
                                        <button
                                            onClick={() => handleDeleteTrack(track)}
                                            className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-all"
                                        >
                                            🗑️
                                        </button>
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
                                    onClick={closeModal}
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
                                                onClick={handleRemoveImage}
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
                                        Formatos: JPG, PNG, SVG. Máximo 10MB (se comprime automáticamente).
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
                                    onClick={closeModal}
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