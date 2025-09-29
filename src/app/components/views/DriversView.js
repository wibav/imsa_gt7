import React, { memo } from 'react';
import { CATEGORY_COLORS, CATEGORY_ICONS } from '../../constants/categories';

const DriversView = memo(({
    drivers,
    selectedCategory,
    onCategoryChange,
    completedRaces
}) => {
    return (
        <div>
            <div className="flex flex-wrap items-center justify-between mb-8">
                <h2 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-3">
                    👤 Clasificación de Pilotos
                </h2>

                {/* Category Filter */}
                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={() => onCategoryChange('all')}
                        className={`px-4 py-2 rounded-lg font-bold transition-all duration-200 ${selectedCategory === 'all'
                            ? 'bg-white text-gray-800'
                            : 'bg-white/20 text-white hover:bg-white/30'
                            }`}
                    >
                        Todos
                    </button>
                    {Object.keys(CATEGORY_COLORS).map(category => (
                        <button
                            key={category}
                            onClick={() => onCategoryChange(category)}
                            className={`px-4 py-2 rounded-lg font-bold transition-all duration-200 flex items-center gap-2 ${selectedCategory === category
                                ? 'bg-white text-gray-800'
                                : 'bg-white/20 text-white hover:bg-white/30'
                                }`}
                        >
                            <span>{CATEGORY_ICONS[category]}</span>
                            {category}
                        </button>
                    ))}
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {drivers && drivers.length > 0 ? drivers.map((driver, position) => (
                    <div
                        key={`${driver.teamName}-${driver.name}`}
                        className="bg-white/10 backdrop-blur-sm border border-white/30 rounded-lg p-6 hover:bg-white/15 transition-all duration-300 shadow-lg hover:shadow-xl"
                    >
                        {/* Driver Header */}
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center justify-center w-12 h-12 bg-gradient-to-br from-gray-700 to-gray-900 rounded-full border-2 border-orange-400">
                                <span className="text-lg font-bold text-white">#{position + 1}</span>
                            </div>
                            <div className={`bg-gradient-to-r ${CATEGORY_COLORS[driver.category]} text-white px-3 py-1 rounded-full font-bold text-sm flex items-center gap-1`}>
                                <span>{CATEGORY_ICONS[driver.category]}</span>
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
                                {sortedTracks.map(track => {
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
                )) : (
                    <div className="text-center py-8">
                        <div className="text-gray-400 text-lg">
                            No hay pilotos disponibles
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
});

DriversView.displayName = 'DriversView';

export default DriversView;