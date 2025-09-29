import React, { memo } from 'react';
import Image from 'next/image';

const TracksView = memo(({
    tracks,
    events,
    completedRaces,
    activeEvent,
    progressPercentage,
    onShowTrackResults,
    onImageError,
    onImageLoad
}) => {
    return (
        <div className="space-y-6">
            <div className="text-center mb-8">
                <div className="bg-white/10 backdrop-blur-sm border border-white/30 rounded-lg p-6 inline-block">
                    <h3 className="text-2xl font-bold text-white mb-2 flex items-center gap-2 justify-center">
                        <span>🏁</span>
                        Calendario de Carreras 2024
                    </h3>
                    <div className="text-gray-300">
                        <span>Progreso: </span>
                        <span className="font-bold text-yellow-400">{progressPercentage?.toFixed(1) || 0}%</span>
                        <span> completado</span>
                    </div>
                    
                    {/* Progress Bar */}
                    <div className="w-full bg-gray-700 rounded-full h-2 mt-3">
                        <div 
                            className="bg-gradient-to-r from-green-500 to-blue-500 h-2 rounded-full transition-all duration-500"
                            style={{ width: `${progressPercentage || 0}%` }}
                        ></div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {tracks && tracks.length > 0 ? tracks.map((track) => {
                    const raceEvent = events?.find(e => e.trackId === track.id);
                    const status = track.id <= completedRaces ? 'completed' : 
                                  activeEvent && activeEvent.trackId === track.id ? 'current' : 'upcoming';
                    
                    return (
                        <div key={track.id} className={`bg-white/10 backdrop-blur-sm border rounded-lg p-6 hover:bg-white/15 transition-all duration-200 ${
                            status === 'completed' ? 'border-green-500/50' :
                            status === 'current' ? 'border-yellow-500/50' :
                            'border-white/30'
                        }`}>
                            <div className="relative">
                                {/* Status Badge */}
                                <div className={`absolute -top-2 -right-2 px-3 py-1 rounded-full text-xs font-bold z-10 ${
                                    status === 'completed' ? 'bg-green-600 text-white' :
                                    status === 'current' ? 'bg-yellow-600 text-white' :
                                    'bg-blue-600 text-white'
                                }`}>
                                    {status === 'completed' ? '✅ Completada' :
                                     status === 'current' ? '⚡ Activa' :
                                     '⏳ Próxima'}
                                </div>

                                {/* Track Image */}
                                <div className="relative mb-4 overflow-hidden rounded-lg">
                                    <Image
                                        src={track.image}
                                        alt={track.name}
                                        width={400}
                                        height={200}
                                        className="w-full h-32 object-cover transition-transform duration-300 hover:scale-105"
                                        onError={() => onImageError && onImageError(track.id)}
                                        onLoad={() => onImageLoad && onImageLoad(track.id)}
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>
                                </div>

                                {/* Track Info */}
                                <div className="space-y-3">
                                    <div>
                                        <h3 className="text-xl font-bold text-white mb-1">{track.name}</h3>
                                        <div className="flex items-center gap-2 text-gray-300 text-sm">
                                            <span>🌍</span>
                                            <span>{track.location}</span>
                                        </div>
                                    </div>

                                    {/* Race Date */}
                                    {raceEvent && (
                                        <div className="flex items-center gap-2 text-gray-300 text-sm">
                                            <span>📅</span>
                                            <span>{new Date(raceEvent.date).toLocaleDateString('es-ES')}</span>
                                        </div>
                                    )}

                                    {/* Track Details */}
                                    <div className="grid grid-cols-2 gap-2 text-sm">
                                        <div className="bg-black/20 rounded p-2 text-center">
                                            <div className="text-gray-300">Distancia</div>
                                            <div className="text-white font-bold">{track.length}km</div>
                                        </div>
                                        <div className="bg-black/20 rounded p-2 text-center">
                                            <div className="text-gray-300">Carrera</div>
                                            <span className="text-orange-400 font-bold">#{track.id}</span>
                                        </div>
                                    </div>

                                    {/* Progress Indicator */}
                                    <div className="pt-4 border-t border-white/20">
                                        <div className="text-center">
                                            {status === 'completed' && (
                                                <button
                                                    onClick={() => onShowTrackResults && onShowTrackResults(track)}
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
                        </div>
                    );
                }) : (
                    <div className="text-center py-8">
                        <div className="text-gray-400 text-lg">
                            No hay pistas disponibles
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
});

TracksView.displayName = 'TracksView';

export default TracksView;