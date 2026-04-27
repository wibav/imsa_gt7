"use client";
import { useState } from 'react';
import { FirebaseService } from '../services/firebaseService';
import Image from 'next/image';
import TrackFormModal, { getEmptyTrackData } from './championship/TrackFormModal';

export default function TracksManager({
    championshipId,
    tracks,
    onTracksUpdate,
    editMode,
    allDriverNames,
    championship,
    handleOpenResultsModal,
    handleResetResults
}) {
    const [showTrackModal, setShowTrackModal] = useState(false);
    const [editingTrack, setEditingTrack] = useState(null);

    const sortedTracks = [...tracks].sort((a, b) => {
        const dateA = new Date(a.date || 0);
        const dateB = new Date(b.date || 0);
        return dateA - dateB;
    });

    const openCreateModal = () => {
        setEditingTrack(null);
        setShowTrackModal(true);
    };

    const openEditModal = (track) => {
        setEditingTrack(track);
        setShowTrackModal(true);
    };

    const handleSaveTrack = async (trackData) => {
        try {
            if (editingTrack) {
                await FirebaseService.updateTrack(championshipId, editingTrack.id, {
                    ...trackData,
                    updatedAt: new Date().toISOString()
                });
                alert('✅ Pista actualizada correctamente');
            } else {
                await FirebaseService.createTrack(championshipId, {
                    ...trackData,
                    points: {},
                    createdAt: new Date().toISOString()
                });
                alert('✅ Pista creada correctamente');
            }
            setShowTrackModal(false);
            setEditingTrack(null);
            onTracksUpdate();
        } catch (error) {
            console.error('Error saving track:', error);
            alert('Error al guardar la pista: ' + error.message);
        }
    };

    const handleDeleteTrack = async (track) => {
        if (!confirm(`¿Estás seguro de eliminar la pista "${track.name}"? Esta acción no se puede deshacer.`)) {
            return;
        }
        try {
            await FirebaseService.deleteTrack(championshipId, track.id);
            alert('✅ Pista eliminada correctamente');
            onTracksUpdate();
        } catch (error) {
            console.error('Error deleting track:', error);
            alert('Error al eliminar la pista: ' + error.message);
        }
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">🏎️ Calendario de Pistas ({tracks.length})</h2>
                <div className="flex gap-2">
                    <button
                        onClick={openCreateModal}
                        className="px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold rounded-lg transition-all"
                    >
                        + Nueva Pista
                    </button>
                    {!editMode && (
                        <p className="text-sm text-gray-400 flex items-center">
                            Activa el modo edición para asignar resultados
                        </p>
                    )}
                </div>
            </div>

            {sortedTracks.length === 0 ? (
                <div className="text-center py-12 bg-white/5 border border-white/20 rounded-lg">
                    <div className="text-6xl mb-4">🏁</div>
                    <p className="text-gray-400 mb-4">No hay pistas registradas en este campeonato</p>
                    <button
                        onClick={openCreateModal}
                        className="px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-bold rounded-lg hover:from-green-700 hover:to-emerald-700"
                    >
                        + Crear Primera Pista
                    </button>
                </div>
            ) : (
                <div className="space-y-3">
                    {sortedTracks.map((track) => (
                        <div
                            key={track.id}
                            className="bg-white/10 border border-white/30 rounded-lg p-4 hover:bg-white/15 transition-all"
                        >
                            <div className="flex items-start justify-between gap-4">
                                {/* Izquierda: Imagen y datos */}
                                <div className="flex gap-4 flex-1">
                                    {/* Imagen de la pista */}
                                    {track.layoutImage ? (
                                        <div className="relative w-32 h-32 bg-black/30 rounded-lg overflow-hidden flex-shrink-0">
                                            <Image
                                                src={track.layoutImage}
                                                alt={track.name}
                                                fill
                                                className="object-contain p-2"
                                            />
                                        </div>
                                    ) : (
                                        <div className="w-32 h-32 bg-white/5 border border-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
                                            <span className="text-4xl">🏁</span>
                                        </div>
                                    )}

                                    {/* Info de la pista */}
                                    <div className="flex-1">
                                        <div className="flex items-start gap-3 mb-2">
                                            <div>
                                                <h3 className="text-lg font-bold">{track.name}</h3>
                                                <p className="text-sm text-gray-400">📍 {track.country}</p>
                                                {track.category && (
                                                    <span className="inline-block mt-1 text-xs bg-blue-600/30 text-blue-200 px-2 py-1 rounded">
                                                        {track.category}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {track.date && (
                                            <div className="text-sm text-gray-400 mt-2">
                                                📅 {new Date(track.date + 'T00:00:00').toLocaleDateString('es-ES', {
                                                    day: 'numeric',
                                                    month: 'long',
                                                    year: 'numeric'
                                                })}
                                            </div>
                                        )}

                                        {/* Puntajes asignados */}
                                        {track.points && Object.keys(track.points).length > 0 && (
                                            <div className="mt-3 pt-3 border-t border-white/20">
                                                <p className="text-xs text-gray-400 mb-2">📊 Resultados:</p>
                                                <div className="flex flex-wrap gap-2">
                                                    {Object.entries(track.points)
                                                        .sort(([, a], [, b]) => b - a)
                                                        .slice(0, 3)
                                                        .map(([driverName, points], index) => (
                                                            <div
                                                                key={driverName}
                                                                className={`flex items-center gap-1 text-xs px-2 py-1 rounded ${index === 0 ? 'bg-yellow-500/20 border border-yellow-500/30 text-yellow-300' :
                                                                    index === 1 ? 'bg-gray-400/20 border border-gray-400/30 text-gray-300' :
                                                                        'bg-orange-500/20 border border-orange-500/30 text-orange-300'
                                                                    }`}
                                                            >
                                                                <span>{index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}</span>
                                                                <span>{driverName}</span>
                                                                <span className="font-bold">({points})</span>
                                                            </div>
                                                        ))}
                                                    {Object.keys(track.points).length > 3 && (
                                                        <span className="text-xs text-gray-400">
                                                            +{Object.keys(track.points).length - 3} más
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Derecha: Botones de acción */}
                                <div className="flex flex-col gap-2">
                                    <button
                                        onClick={() => openEditModal(track)}
                                        className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-all"
                                        title="Editar pista"
                                    >
                                        ✏️ Editar
                                    </button>

                                    <button
                                        onClick={() => handleOpenResultsModal(track)}
                                        className="px-3 py-2 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white text-sm font-medium rounded-lg transition-all"
                                    >
                                        🏁 Resultados
                                    </button>

                                    {track.points && Object.keys(track.points).length > 0 && (
                                        <button
                                            onClick={() => handleResetResults(track)}
                                            className="px-3 py-2 bg-gray-600 hover:bg-red-600 text-white text-sm font-medium rounded-lg transition-all"
                                            title="Eliminar resultados"
                                        >
                                            🗑️ Reset
                                        </button>
                                    )}

                                    <button
                                        onClick={() => handleDeleteTrack(track)}
                                        className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-all"
                                        title="Eliminar pista"
                                    >
                                        🗑️ Eliminar
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal para crear/editar pista */}
            {showTrackModal && (
                <TrackFormModal
                    track={editingTrack}
                    championship={championship}
                    onSave={handleSaveTrack}
                    onClose={() => { setShowTrackModal(false); setEditingTrack(null); }}
                />
            )}
        </div>
    );
}
