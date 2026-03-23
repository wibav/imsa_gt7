import { getPositionBg, getPositionDisplay } from '../../utils';

/**
 * Tabla de clasificación reutilizable para campeonatos.
 * Soporta clasificación por equipos, individual con equipos, e individual simple.
 * 
 * Modo avanzado: cuando se pasan raceColumns y standings con racePoints[],
 * muestra columnas por carrera con scroll horizontal y columnas sticky.
 * 
 * @param {Object} props
 * @param {Array} props.standings - Array de entradas de clasificación (simple o avanzado)
 * @param {'teams'|'drivers'|'individual'} [props.type='individual'] - Tipo de tabla
 * @param {string} [props.title] - Título de la sección
 * @param {string} [props.accentColor='orange'] - Color de acento
 * @param {boolean} [props.showTeamColumn=false] - Mostrar columna de equipo
 * @param {boolean} [props.showCategoryColumn=true] - Mostrar columna de categoría
 * @param {boolean} [props.showRaceColumns=false] - Mostrar columnas por carrera
 * @param {boolean} [props.showStatsColumns=false] - Mostrar columnas de Vic/Pod
 * @param {Array} [props.raceColumns] - Array de {round, name} para headers de carreras
 * @param {boolean} [props.compact=false] - Versión compacta
 * @param {string} [props.className] - Clases adicionales
 * @param {string} [props.emptyMessage] - Mensaje cuando no hay datos
 */
export default function StandingsTable({
    standings = [],
    type = 'individual',
    title,
    accentColor = 'orange',
    showTeamColumn = false,
    showCategoryColumn = true,
    showRaceColumns = false,
    showStatsColumns = false,
    raceColumns = [],
    compact = false,
    className = '',
    emptyMessage = 'Sin datos de clasificación',
    promotionZone = 0,
    relegationZone = 0
}) {
    if (standings.length === 0) {
        return (
            <div className={`bg-white/5 border border-white/10 rounded-xl p-8 text-center ${className}`}>
                <div className="text-4xl mb-3">📊</div>
                <p className="text-gray-400">{emptyMessage}</p>
            </div>
        );
    }

    const gradients = {
        orange: 'from-orange-600 to-red-600',
        blue: 'from-blue-600 to-indigo-600',
        green: 'from-green-600 to-emerald-600',
    };

    const pointsColors = {
        orange: 'text-orange-400',
        blue: 'text-blue-400',
        green: 'text-green-400',
    };

    const borderColors = {
        orange: 'border-orange-500/30',
        blue: 'border-blue-500/30',
        green: 'border-green-500/30',
    };

    const gradient = gradients[accentColor] || gradients.orange;
    const pointsColor = pointsColors[accentColor] || pointsColors.orange;
    const borderColor = borderColors[accentColor] || borderColors.orange;

    const isTeams = type === 'teams';
    const hasRaces = showRaceColumns && raceColumns.length > 0;

    // Padding según compact
    const cellPx = compact ? 'px-3 py-2' : 'px-4 py-3';
    const headerPx = compact ? 'px-3 py-3' : 'px-4 py-3';

    // Función para colorear puntos por carrera según posición
    const getRacePointsStyle = (points, position) => {
        if (points === null || points === undefined) return 'text-gray-600';
        if (position === 1) return 'text-yellow-400 font-bold';
        if (position === 2) return 'text-gray-300 font-semibold';
        if (position === 3) return 'text-amber-600 font-semibold';
        if (points > 0) return 'text-gray-300';
        return 'text-gray-500';
    };

    return (
        <div className={`${className}`}>
            {title && (
                <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    {isTeams ? '🏆' : '👤'} {title}
                </h3>
            )}
            <div className={`bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl overflow-hidden border ${borderColor}`}>
                <div className="overflow-x-auto">
                    <table className="w-full" style={{ minWidth: hasRaces ? `${600 + raceColumns.length * 56}px` : undefined }}>
                        <thead className={`bg-gradient-to-r ${gradient} text-white`}>
                            <tr>
                                {/* Columnas fijas (sticky) */}
                                <th className={`${headerPx} text-left ${hasRaces ? 'sticky left-0 z-10 bg-inherit' : ''}`}
                                    style={hasRaces ? { background: 'inherit' } : undefined}>
                                    Pos
                                </th>
                                <th className={`${headerPx} text-left ${hasRaces ? 'sticky z-10' : ''}`}
                                    style={hasRaces ? { left: '52px', background: 'inherit' } : undefined}>
                                    {isTeams ? 'Equipo' : 'Piloto'}
                                </th>
                                {showTeamColumn && !isTeams && (
                                    <th className={`${headerPx} text-left hidden md:table-cell`}>Equipo</th>
                                )}
                                {showCategoryColumn && !isTeams && (
                                    <th className={`${headerPx} text-left ${compact ? 'hidden md:table-cell' : 'hidden lg:table-cell'}`}>Cat</th>
                                )}

                                {/* Columnas de carreras */}
                                {hasRaces && raceColumns.map((race, idx) => (
                                    <th key={race.trackId || idx} className={`${headerPx} text-center`}
                                        title={race.name}>
                                        <span className="text-xs">R{race.round}</span>
                                    </th>
                                ))}

                                {/* Columnas de estadísticas */}
                                {showStatsColumns && (
                                    <>
                                        <th className={`${headerPx} text-center hidden sm:table-cell`} title="Victorias">
                                            <span className="text-xs">🏆</span>
                                        </th>
                                        <th className={`${headerPx} text-center hidden sm:table-cell`} title="Podiums">
                                            <span className="text-xs">🥇</span>
                                        </th>
                                        <th className={`${headerPx} text-center hidden sm:table-cell`} title="Pole Positions">
                                            <span className="text-xs">🎯</span>
                                        </th>
                                        <th className={`${headerPx} text-center hidden sm:table-cell`} title="Vueltas Rápidas">
                                            <span className="text-xs">⚡</span>
                                        </th>
                                    </>
                                )}

                                {/* Puntos totales */}
                                <th className={`${headerPx} text-right ${hasRaces ? 'sticky right-0 z-10' : ''}`}
                                    style={hasRaces ? { background: 'inherit' } : undefined}>
                                    Pts
                                </th>
                            </tr>
                        </thead>
                        <tbody className="text-white">
                            {standings.map((entry, index) => {
                                // Puntos totales (compatible con ambos formatos)
                                const totalPts = entry.totalPoints ?? entry.points ?? 0;

                                return (
                                    <tr
                                        key={entry.id || entry.name || index}
                                        className={`
                                            border-b border-white/10 hover:bg-white/5 transition-colors
                                            ${getPositionBg(index)}
                                            ${promotionZone > 0 && index < promotionZone ? 'border-l-3 border-l-green-500' : ''}
                                            ${relegationZone > 0 && index >= standings.length - relegationZone ? 'border-l-3 border-l-red-500' : ''}
                                        `}
                                    >
                                        {/* Posición - sticky */}
                                        <td className={`${cellPx} font-bold ${compact ? 'text-sm' : ''} ${hasRaces ? 'sticky left-0 z-10 bg-slate-800/95' : ''}`}>
                                            <span className="flex items-center gap-1">
                                                {promotionZone > 0 && index < promotionZone && <span className="text-green-400 text-xs">▲</span>}
                                                {relegationZone > 0 && index >= standings.length - relegationZone && <span className="text-red-400 text-xs">▼</span>}
                                                {getPositionDisplay(index)}
                                            </span>
                                        </td>

                                        {/* Nombre - sticky */}
                                        <td className={`${cellPx} ${hasRaces ? 'sticky z-10 bg-slate-800/95' : ''}`}
                                            style={hasRaces ? { left: '52px' } : undefined}>
                                            <div className="flex items-center gap-2">
                                                {(entry.color || entry.teamColor) && (
                                                    <div
                                                        className={`${compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} rounded-full border-2 border-white flex-shrink-0`}
                                                        style={{ backgroundColor: entry.color || entry.teamColor }}
                                                    />
                                                )}
                                                <span className={`font-semibold ${compact ? 'text-sm' : 'text-sm'} truncate max-w-[140px]`}>
                                                    {entry.name}
                                                </span>
                                            </div>
                                        </td>

                                        {/* Equipo */}
                                        {showTeamColumn && !isTeams && (
                                            <td className={`${cellPx} hidden md:table-cell`}>
                                                <div className="flex items-center gap-2">
                                                    {entry.teamColor && (
                                                        <div
                                                            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                                            style={{ backgroundColor: entry.teamColor }}
                                                        />
                                                    )}
                                                    <span className="text-gray-300 text-xs truncate max-w-[100px]">{entry.team || '-'}</span>
                                                </div>
                                            </td>
                                        )}

                                        {/* Categoría */}
                                        {showCategoryColumn && !isTeams && (
                                            <td className={`${cellPx} ${compact ? 'hidden md:table-cell' : 'hidden lg:table-cell'}`}>
                                                <span className="text-xs bg-blue-600/30 px-1.5 py-0.5 rounded">
                                                    {entry.category || '-'}
                                                </span>
                                            </td>
                                        )}

                                        {/* Puntos por carrera */}
                                        {hasRaces && raceColumns.map((race, raceIdx) => {
                                            const pts = entry.racePoints?.[raceIdx];
                                            const pos = entry.racePositions?.[raceIdx];
                                            const isFl = entry.raceFastestLap?.[raceIdx];
                                            const isPole = entry.racePole?.[raceIdx];
                                            const tooltipParts = [race.name];
                                            if (pts !== null && pts !== undefined) tooltipParts.push(`P${pos || '?'} → ${pts} pts`);
                                            else tooltipParts.push('No participó');
                                            if (isFl) tooltipParts.push('⚡ Vuelta Rápida');
                                            if (isPole) tooltipParts.push('🎯 Pole');
                                            return (
                                                <td key={race.trackId || raceIdx}
                                                    className={`${cellPx} text-center`}
                                                    title={tooltipParts.join(' | ')}
                                                >
                                                    <div className="flex flex-col items-center gap-0">
                                                        <span className={`text-xs ${getRacePointsStyle(pts, pos)}`}>
                                                            {pts !== null && pts !== undefined ? pts : '-'}
                                                        </span>
                                                        {(isFl || isPole) && (
                                                            <div className="flex gap-0.5 mt-0.5">
                                                                {isPole && <span className="text-purple-400" style={{ fontSize: '9px' }}>🎯</span>}
                                                                {isFl && <span className="text-yellow-400" style={{ fontSize: '9px' }}>⚡</span>}
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                            );
                                        })}

                                        {/* Stats */}
                                        {showStatsColumns && (
                                            <>
                                                <td className={`${cellPx} text-center hidden sm:table-cell`}>
                                                    <span className={`text-xs ${entry.wins > 0 ? 'text-yellow-400 font-bold' : 'text-gray-600'}`}>
                                                        {entry.wins || 0}
                                                    </span>
                                                </td>
                                                <td className={`${cellPx} text-center hidden sm:table-cell`}>
                                                    <span className={`text-xs ${entry.podiums > 0 ? 'text-orange-400 font-bold' : 'text-gray-600'}`}>
                                                        {entry.podiums || 0}
                                                    </span>
                                                </td>
                                                <td className={`${cellPx} text-center hidden sm:table-cell`}>
                                                    <span className={`text-xs ${entry.poles > 0 ? 'text-purple-400 font-bold' : 'text-gray-600'}`}>
                                                        {entry.poles || 0}
                                                    </span>
                                                </td>
                                                <td className={`${cellPx} text-center hidden sm:table-cell`}>
                                                    <span className={`text-xs ${entry.fastestLaps > 0 ? 'text-yellow-300 font-bold' : 'text-gray-600'}`}>
                                                        {entry.fastestLaps || 0}
                                                    </span>
                                                </td>
                                            </>
                                        )}

                                        {/* Puntos totales - sticky right */}
                                        <td className={`${cellPx} text-right font-bold ${pointsColor} ${compact ? 'text-sm' : 'text-base'} ${hasRaces ? 'sticky right-0 z-10 bg-slate-800/95' : ''}`}>
                                            <div className="flex items-center justify-end gap-1">
                                                {entry.penaltyPoints > 0 && (
                                                    <span className="text-red-400 text-xs font-normal" title={`-${entry.penaltyPoints} pts sanción`}>
                                                        (-{entry.penaltyPoints})
                                                    </span>
                                                )}
                                                {totalPts}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
