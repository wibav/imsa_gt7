import React, { memo } from 'react';
import Image from 'next/image';

const TracksView = memo(({
    sortedTracks,
    showTrackResults,
    getTrackStatus,
    handleImageError,
    handleImageLoad,
    imageErrors
}) => {
    return (
        <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-8 flex items-center gap-3">
                🏁 Calendario de Pistas
            </h2>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {sortedTracks.map((track, index) => {
                    const status = getTrackStatus(track.date);
                    const hasImageError = imageErrors[track.id];
                    let statusColor = '';
                    let statusText = '';
                    let statusIcon = '';

                    switch (status) {
                        case 'completed':
                            statusColor = 'bg-green-600';
                            statusText = 'Completada';
                            statusIcon = '✅';
                            break;
                        case 'today':
                            statusColor = 'bg-orange-600';
                            statusText = 'Hoy';
                            statusIcon = '🔥';
                            break;
                        case 'upcoming':
                            statusColor = 'bg-blue-600';
                            statusText = 'Próxima';
                            statusIcon = '⏳';
                            break;
                        default:
                            statusColor = 'bg-gray-600';
                            statusText = 'Desconocido';
                            statusIcon = '❓';
                    }

                    return (
                        <div
                            key={track.id}
                            className="bg-white/10 backdrop-blur-sm border border-white/30 rounded-lg overflow-hidden hover:bg-white/15 transition-all duration-300 shadow-lg hover:shadow-xl cursor-pointer"
                            onClick={() => status === 'completed' && showTrackResults(track)}
                        >
                            {/* Track Image */}
                            <div className="relative h-48 bg-gradient-to-br from-gray-800 to-gray-900">
                                {track.image && !hasImageError ? (
                                    <Image
                                        src={track.image}
                                        alt={track.name}
                                        fill
                                        className="object-cover"
                                        onError={() => handleImageError(track.id)}
                                        onLoad={() => handleImageLoad(track.id)}
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-6xl">
                                        🏁
                                    </div>
                                )}

                                {/* Status Badge */}
                                <div className={`absolute top-4 left-4 ${statusColor} text-white px-3 py-1 rounded-full text-sm font-bold flex items-center gap-2`}>
                                    <span>{statusIcon}</span>
                                    {statusText}
                                </div>

                                {/* Track Number */}
                                <div className="absolute top-4 right-4 bg-black/50 text-white px-3 py-1 rounded-full text-sm font-bold">
                                    #{index + 1}
                                </div>
                            </div>

                            {/* Track Info */}
                            <div className="p-6">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-xl font-bold text-white">{track.name}</h3>
                                    {status === 'completed' && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                showTrackResults(track);
                                            }}
                                            className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded-lg text-sm font-bold transition-colors"
                                        >
                                            Ver Resultados
                                        </button>
                                    )}
                                </div>

                                <div className="space-y-2 text-sm">
                                    <div className="flex items-center gap-2 text-gray-300">
                                        <span>📅</span>
                                        <span>{new Date(track.date).toLocaleDateString('es-ES', {
                                            weekday: 'long',
                                            year: 'numeric',
                                            month: 'long',
                                            day: 'numeric'
                                        })}</span>
                                    </div>

                                    {track.location && (
                                        <div className="flex items-center gap-2 text-gray-300">
                                            <span>📍</span>
                                            <span>{track.location}</span>
                                        </div>
                                    )}

                                    {track.length && (
                                        <div className="flex items-center gap-2 text-gray-300">
                                            <span>📏</span>
                                            <span>{track.length}</span>
                                        </div>
                                    )}

                                    {track.description && (
                                        <p className="text-gray-400 text-xs mt-3">{track.description}</p>
                                    )}
                                </div>

                                {/* Click hint for completed races */}
                                {status === 'completed' && (
                                    <div className="mt-4 text-center">
                                        <span className="text-green-400 text-xs">
                                            💡 Haz click para ver resultados
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
});

TracksView.displayName = 'TracksView';

export default TracksView;