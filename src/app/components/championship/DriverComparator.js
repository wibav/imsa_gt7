"use client";
import { useState } from 'react';
import { compareDrivers } from '../../utils/standingsCalculator';

/**
 * Comparador head-to-head de dos pilotos.
 * Permite seleccionar dos pilotos y ver comparación detallada.
 */
export default function DriverComparator({ driverStandings = [], raceColumns = [] }) {
    const [driver1Name, setDriver1Name] = useState('');
    const [driver2Name, setDriver2Name] = useState('');

    if (driverStandings.length < 2) {
        return (
            <div className="bg-white/5 border border-white/10 rounded-xl p-8 text-center">
                <div className="text-4xl mb-3">⚔️</div>
                <p className="text-gray-400">Se necesitan al menos 2 pilotos para comparar</p>
            </div>
        );
    }

    const driver1 = driverStandings.find(d => d.name === driver1Name);
    const driver2 = driverStandings.find(d => d.name === driver2Name);
    const comparison = driver1 && driver2 ? compareDrivers(driver1, driver2) : null;

    return (
        <div className="space-y-6">
            {/* Selectores */}
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-6 border border-white/10">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    ⚔️ Comparar Pilotos
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className="text-gray-400 text-sm mb-1 block">Piloto 1</label>
                        <select
                            value={driver1Name}
                            onChange={(e) => setDriver1Name(e.target.value)}
                            className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500"
                        >
                            <option value="" className="bg-slate-800">Seleccionar piloto...</option>
                            {driverStandings
                                .filter(d => d.name !== driver2Name)
                                .map(d => (
                                    <option key={d.name} value={d.name} className="bg-slate-800">{d.name}</option>
                                ))}
                        </select>
                    </div>
                    <div>
                        <label className="text-gray-400 text-sm mb-1 block">Piloto 2</label>
                        <select
                            value={driver2Name}
                            onChange={(e) => setDriver2Name(e.target.value)}
                            className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-red-500"
                        >
                            <option value="" className="bg-slate-800">Seleccionar piloto...</option>
                            {driverStandings
                                .filter(d => d.name !== driver1Name)
                                .map(d => (
                                    <option key={d.name} value={d.name} className="bg-slate-800">{d.name}</option>
                                ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Resultado de comparación */}
            {comparison && driver1 && driver2 && (
                <div className="space-y-6">
                    {/* Head-to-Head */}
                    <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-6 border border-white/10">
                        <h4 className="text-white font-bold text-center mb-6">Cara a Cara (en carreras compartidas)</h4>
                        <div className="flex items-center justify-center gap-4 sm:gap-8">
                            {/* Driver 1 */}
                            <div className="text-center flex-1">
                                <div className="flex items-center justify-center gap-2 mb-2">
                                    {driver1.teamColor && (
                                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: driver1.teamColor }} />
                                    )}
                                    <span className="text-white font-bold text-lg truncate max-w-[120px]">{driver1.name}</span>
                                </div>
                                <div className={`text-4xl font-bold ${comparison.headToHead.driver1Wins > comparison.headToHead.driver2Wins ? 'text-green-400' : 'text-gray-400'}`}>
                                    {comparison.headToHead.driver1Wins}
                                </div>
                                <div className="text-gray-500 text-xs mt-1">victorias</div>
                            </div>

                            {/* VS */}
                            <div className="text-center">
                                <div className="text-3xl font-bold text-gray-600">VS</div>
                                {comparison.headToHead.ties > 0 && (
                                    <div className="text-gray-500 text-xs mt-1">{comparison.headToHead.ties} empate{comparison.headToHead.ties > 1 ? 's' : ''}</div>
                                )}
                            </div>

                            {/* Driver 2 */}
                            <div className="text-center flex-1">
                                <div className="flex items-center justify-center gap-2 mb-2">
                                    {driver2.teamColor && (
                                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: driver2.teamColor }} />
                                    )}
                                    <span className="text-white font-bold text-lg truncate max-w-[120px]">{driver2.name}</span>
                                </div>
                                <div className={`text-4xl font-bold ${comparison.headToHead.driver2Wins > comparison.headToHead.driver1Wins ? 'text-green-400' : 'text-gray-400'}`}>
                                    {comparison.headToHead.driver2Wins}
                                </div>
                                <div className="text-gray-500 text-xs mt-1">victorias</div>
                            </div>
                        </div>
                    </div>

                    {/* Barra de comparación por estadísticas */}
                    <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-6 border border-white/10">
                        <h4 className="text-white font-bold mb-4">📊 Estadísticas Comparadas</h4>
                        <div className="space-y-3">
                            {comparison.comparison.map(({ label, v1, v2, higher }) => {
                                const val1 = parseFloat(v1) || 0;
                                const val2 = parseFloat(v2) || 0;
                                let winner = 'none';
                                if (higher === 'better') winner = val1 > val2 ? '1' : val2 > val1 ? '2' : 'tie';
                                else if (higher === 'worse') winner = val1 < val2 ? '1' : val2 < val1 ? '2' : 'tie';
                                else winner = 'tie';

                                return (
                                    <div key={label} className="flex items-center gap-3">
                                        <div className={`flex-1 text-right font-bold text-lg ${winner === '1' ? 'text-green-400' : winner === '2' ? 'text-red-400' : 'text-gray-300'}`}>
                                            {v1 ?? '-'}
                                        </div>
                                        <div className="w-32 sm:w-40 text-center">
                                            <span className="text-gray-400 text-xs font-medium">{label}</span>
                                        </div>
                                        <div className={`flex-1 text-left font-bold text-lg ${winner === '2' ? 'text-green-400' : winner === '1' ? 'text-red-400' : 'text-gray-300'}`}>
                                            {v2 ?? '-'}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Puntos por carrera comparados */}
                    {raceColumns.length > 0 && (
                        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-6 border border-white/10">
                            <h4 className="text-white font-bold mb-4">🏁 Puntos por Carrera</h4>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="text-gray-400 text-xs">
                                        <tr>
                                            <th className="px-3 py-2 text-left">Carrera</th>
                                            <th className="px-3 py-2 text-center">{driver1.name}</th>
                                            <th className="px-3 py-2 text-center">{driver2.name}</th>
                                            <th className="px-3 py-2 text-center">Dif</th>
                                        </tr>
                                    </thead>
                                    <tbody className="text-white">
                                        {raceColumns.map((race, idx) => {
                                            const pts1 = driver1.racePoints?.[idx];
                                            const pts2 = driver2.racePoints?.[idx];
                                            const diff = (pts1 ?? 0) - (pts2 ?? 0);
                                            const bothRaced = pts1 !== null && pts1 !== undefined && pts2 !== null && pts2 !== undefined;

                                            return (
                                                <tr key={race.trackId || idx} className="border-b border-white/5">
                                                    <td className="px-3 py-2 text-gray-300">
                                                        <span className="font-semibold text-orange-400 mr-2">R{race.round}</span>
                                                        <span className="text-xs hidden sm:inline">{race.name}</span>
                                                    </td>
                                                    <td className={`px-3 py-2 text-center font-bold ${bothRaced && pts1 > pts2 ? 'text-green-400' : 'text-gray-300'}`}>
                                                        {pts1 !== null && pts1 !== undefined ? pts1 : '-'}
                                                    </td>
                                                    <td className={`px-3 py-2 text-center font-bold ${bothRaced && pts2 > pts1 ? 'text-green-400' : 'text-gray-300'}`}>
                                                        {pts2 !== null && pts2 !== undefined ? pts2 : '-'}
                                                    </td>
                                                    <td className={`px-3 py-2 text-center text-xs ${bothRaced ? (diff > 0 ? 'text-blue-400' : diff < 0 ? 'text-red-400' : 'text-gray-500') : 'text-gray-600'}`}>
                                                        {bothRaced ? (diff > 0 ? `+${diff}` : diff === 0 ? '=' : diff) : '-'}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        {/* Total */}
                                        <tr className="bg-white/5 font-bold">
                                            <td className="px-3 py-3 text-white">Total</td>
                                            <td className="px-3 py-3 text-center text-orange-400">{driver1.totalPoints}</td>
                                            <td className="px-3 py-3 text-center text-orange-400">{driver2.totalPoints}</td>
                                            <td className={`px-3 py-3 text-center text-sm ${driver1.totalPoints - driver2.totalPoints > 0 ? 'text-blue-400' : driver1.totalPoints - driver2.totalPoints < 0 ? 'text-red-400' : 'text-gray-500'}`}>
                                                {driver1.totalPoints - driver2.totalPoints > 0 ? '+' : ''}{driver1.totalPoints - driver2.totalPoints}
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Placeholder cuando no se han seleccionado */}
            {!comparison && (
                <div className="bg-white/5 border border-white/10 rounded-xl p-12 text-center">
                    <div className="text-5xl mb-4">⚔️</div>
                    <p className="text-gray-400 text-lg">Selecciona dos pilotos para comparar</p>
                    <p className="text-gray-500 text-sm mt-2">Verás estadísticas cara a cara, puntos por carrera y más</p>
                </div>
            )}
        </div>
    );
}
