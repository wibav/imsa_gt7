import React, { memo } from 'react';

const TeamsView = memo(({
    sortedTeams,
    sortedTracks,
    getDriverPointsForTrack,
    calculateDriverTotal,
    CATEGORY_COLORS,
    CATEGORY_ICONS
}) => {
    return (
        <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-8 flex items-center gap-3">
                🏁 Clasificación de Equipos
            </h2>
            <div className="grid gap-6">
                {sortedTeams.map((team, position) => (
                    <div
                        key={team.id}
                        className="bg-white/10 backdrop-blur-sm border border-white/30 rounded-lg p-6 hover:bg-white/15 transition-all duration-300 shadow-lg hover:shadow-xl overflow-hidden"
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
                            {team.drivers && team.drivers.map((driver, idx) => {
                                const driverTotal = calculateDriverTotal(driver.points);
                                return (
                                    <div
                                        key={idx}
                                        className="bg-white/10 rounded-lg p-4 border border-white/20 hover:bg-white/15 transition-all duration-200"
                                    >
                                        <div className="flex items-center justify-between mb-3">
                                            <div className={`bg-gradient-to-r ${CATEGORY_COLORS[driver.category]} text-white px-3 py-1 rounded-full font-bold text-sm flex items-center gap-1`}>
                                                <span>{CATEGORY_ICONS[driver.category]}</span>
                                                {driver.category}
                                            </div>
                                            <div className="bg-indigo-600 text-white px-2 py-1 rounded-full text-xs font-bold">
                                                {driverTotal} pts
                                            </div>
                                        </div>
                                        <div className="text-white font-bold text-lg mb-3">{driver.name}</div>

                                        <div className="mt-3">
                                            <div className="text-gray-400 text-xs mb-1">Carreras con puntos:</div>
                                            <div className="flex gap-1 flex-wrap">
                                                {sortedTracks
                                                    .map(track => {
                                                        const points = getDriverPointsForTrack(driver, track);
                                                        return (
                                                            <div
                                                                key={track.id}
                                                                className={`w-6 h-6 rounded text-xs flex items-center justify-center font-bold ${points > 0 ? 'bg-green-600 text-white' : 'bg-gray-600 text-gray-400'
                                                                    }`}
                                                                title={`${track.name}: ${points} pts`}
                                                            >
                                                                {points > 0 ? points : '0'}
                                                            </div>
                                                        );
                                                    })
                                                }
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
});

TeamsView.displayName = 'TeamsView';

export default TeamsView;