"use client";

/**
 * Panel de estadísticas detalladas de pilotos.
 * Muestra rankings por victorias, podiums, poles, vueltas rápidas y récords.
 */
export default function DriverStatsPanel({ driverStandings = [], stats = null }) {
    if (!stats || driverStandings.length === 0) {
        return (
            <div className="bg-white/5 border border-white/10 rounded-xl p-8 text-center">
                <div className="text-4xl mb-3">📈</div>
                <p className="text-gray-400">Sin estadísticas disponibles aún</p>
            </div>
        );
    }

    const { topWinners, topPodiums, topPoles, topFastestLaps, records } = stats;

    return (
        <div className="space-y-6">
            {/* Récords del campeonato */}
            {records && (
                <div className="grid sm:grid-cols-3 gap-4">
                    {records.bestSingleRace?.driver && (
                        <div className="bg-gradient-to-br from-yellow-600/20 to-amber-600/20 border border-yellow-500/30 rounded-xl p-5">
                            <div className="text-2xl mb-2">🔥</div>
                            <div className="text-yellow-400 text-xs font-semibold uppercase tracking-wider mb-1">
                                Mejor Puntuación en Carrera
                            </div>
                            <div className="text-white font-bold text-lg">{records.bestSingleRace.driver}</div>
                            <div className="text-yellow-300 text-2xl font-bold">{records.bestSingleRace.points} pts</div>
                        </div>
                    )}
                    {records.mostConsistent && (
                        <div className="bg-gradient-to-br from-blue-600/20 to-indigo-600/20 border border-blue-500/30 rounded-xl p-5">
                            <div className="text-2xl mb-2">📊</div>
                            <div className="text-blue-400 text-xs font-semibold uppercase tracking-wider mb-1">
                                Más Consistente
                            </div>
                            <div className="text-white font-bold text-lg">{records.mostConsistent.name}</div>
                            <div className="text-blue-300 text-2xl font-bold">
                                {records.mostConsistent.races > 0
                                    ? (records.mostConsistent.totalPoints / records.mostConsistent.races).toFixed(1)
                                    : '0'} pts/carrera
                            </div>
                        </div>
                    )}
                    {records.mostDNFs && (
                        <div className="bg-gradient-to-br from-red-600/20 to-rose-600/20 border border-red-500/30 rounded-xl p-5">
                            <div className="text-2xl mb-2">💥</div>
                            <div className="text-red-400 text-xs font-semibold uppercase tracking-wider mb-1">
                                Más Abandonos
                            </div>
                            <div className="text-white font-bold text-lg">{records.mostDNFs.name}</div>
                            <div className="text-red-300 text-2xl font-bold">{records.mostDNFs.dnfs} DNFs</div>
                        </div>
                    )}
                </div>
            )}

            {/* Rankings por categoría */}
            <div className="grid md:grid-cols-2 gap-6">
                {/* Top Victorias */}
                <StatRankingCard
                    title="Victorias"
                    icon="🏆"
                    items={topWinners}
                    valueKey="wins"
                    colorClass="text-yellow-400"
                    bgClass="from-yellow-600 to-amber-600"
                />
                {/* Top Podiums */}
                <StatRankingCard
                    title="Podiums"
                    icon="🥇"
                    items={topPodiums}
                    valueKey="podiums"
                    colorClass="text-orange-400"
                    bgClass="from-orange-600 to-red-600"
                />
                {/* Top Poles */}
                <StatRankingCard
                    title="Pole Positions"
                    icon="⚡"
                    items={topPoles}
                    valueKey="poles"
                    colorClass="text-purple-400"
                    bgClass="from-purple-600 to-indigo-600"
                />
                {/* Top Vueltas Rápidas */}
                <StatRankingCard
                    title="Vueltas Rápidas"
                    icon="⏱️"
                    items={topFastestLaps}
                    valueKey="fastestLaps"
                    colorClass="text-cyan-400"
                    bgClass="from-cyan-600 to-blue-600"
                />
            </div>

            {/* Tabla completa de estadísticas */}
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl overflow-hidden border border-white/10">
                <div className="p-4 border-b border-white/10">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        📊 Estadísticas Completas
                    </h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-white/5 text-gray-300 text-xs uppercase">
                            <tr>
                                <th className="px-4 py-3 text-left">#</th>
                                <th className="px-4 py-3 text-left">Piloto</th>
                                <th className="px-4 py-3 text-left hidden md:table-cell">Equipo</th>
                                <th className="px-4 py-3 text-center">Carr</th>
                                <th className="px-4 py-3 text-center" title="Victorias">Vic</th>
                                <th className="px-4 py-3 text-center" title="Podiums">Pod</th>
                                <th className="px-4 py-3 text-center" title="Poles">Pole</th>
                                <th className="px-4 py-3 text-center" title="Vueltas Rápidas">VR</th>
                                <th className="px-4 py-3 text-center hidden sm:table-cell" title="DNFs">DNF</th>
                                <th className="px-4 py-3 text-center hidden sm:table-cell" title="Mejor Posición">Mejor</th>
                                <th className="px-4 py-3 text-right">Pts</th>
                            </tr>
                        </thead>
                        <tbody className="text-white text-sm">
                            {driverStandings.map((d, idx) => (
                                <tr key={d.name} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                    <td className="px-4 py-3 font-bold text-gray-400">{idx + 1}</td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            {d.teamColor && (
                                                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                                    style={{ backgroundColor: d.teamColor }} />
                                            )}
                                            <span className="font-semibold truncate max-w-[140px]">{d.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-gray-400 text-xs hidden md:table-cell truncate max-w-[100px]">
                                        {d.team || '-'}
                                    </td>
                                    <td className="px-4 py-3 text-center text-gray-300">{d.races}</td>
                                    <td className={`px-4 py-3 text-center font-bold ${d.wins > 0 ? 'text-yellow-400' : 'text-gray-600'}`}>
                                        {d.wins}
                                    </td>
                                    <td className={`px-4 py-3 text-center font-bold ${d.podiums > 0 ? 'text-orange-400' : 'text-gray-600'}`}>
                                        {d.podiums}
                                    </td>
                                    <td className={`px-4 py-3 text-center font-bold ${d.poles > 0 ? 'text-purple-400' : 'text-gray-600'}`}>
                                        {d.poles}
                                    </td>
                                    <td className={`px-4 py-3 text-center font-bold ${d.fastestLaps > 0 ? 'text-cyan-400' : 'text-gray-600'}`}>
                                        {d.fastestLaps}
                                    </td>
                                    <td className={`px-4 py-3 text-center hidden sm:table-cell ${d.dnfs > 0 ? 'text-red-400' : 'text-gray-600'}`}>
                                        {d.dnfs}
                                    </td>
                                    <td className="px-4 py-3 text-center hidden sm:table-cell text-green-400 font-bold">
                                        {d.bestPosition ? `P${d.bestPosition}` : '-'}
                                    </td>
                                    <td className="px-4 py-3 text-right font-bold text-orange-400">{d.totalPoints}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

/**
 * Card de ranking para una estadística específica.
 */
function StatRankingCard({ title, icon, items, valueKey, colorClass, bgClass }) {
    if (!items || items.length === 0) {
        return (
            <div className="bg-white/5 border border-white/10 rounded-xl p-5">
                <h4 className="text-white font-bold flex items-center gap-2 mb-3">
                    {icon} {title}
                </h4>
                <p className="text-gray-500 text-sm">Sin datos</p>
            </div>
        );
    }

    return (
        <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
            <div className={`bg-gradient-to-r ${bgClass} px-5 py-3`}>
                <h4 className="text-white font-bold flex items-center gap-2">
                    {icon} {title}
                </h4>
            </div>
            <div className="p-4 space-y-2">
                {items.slice(0, 5).map((d, idx) => (
                    <div key={d.name} className="flex items-center justify-between p-2 bg-white/5 rounded-lg">
                        <div className="flex items-center gap-3">
                            <span className="text-gray-500 text-sm font-bold w-5">{idx + 1}.</span>
                            <div className="flex items-center gap-2">
                                {d.teamColor && (
                                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                        style={{ backgroundColor: d.teamColor }} />
                                )}
                                <span className="text-white text-sm font-medium">{d.name}</span>
                            </div>
                        </div>
                        <span className={`font-bold text-lg ${colorClass}`}>{d[valueKey]}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
