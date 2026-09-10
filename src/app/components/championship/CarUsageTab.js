"use client";
import { useMemo, useState } from 'react';
import { construirUsoDeAutos } from '../../utils/carUsageCalculator';

/**
 * Uso de autos del lado del piloto: qué auto llevó cada uno en cada carrera y
 * cuántos usos le quedan.
 *
 * El dato ya se guardaba —cada carrera tiene su `carsUsed`— pero solo lo leía
 * el panel de administración. Un piloto no tenía forma de saber si le quedaba
 * algún uso de un coche, que en un campeonato con límite es justo lo que
 * necesita saber ANTES de la siguiente carrera.
 */
export default function CarUsageTab({ championship, tracks = [], registrations = [], gt7Map = {} }) {
    const [busqueda, setBusqueda] = useState('');
    // Memorizado: `championship?.carUsageTracking || {}` crea un objeto nuevo
    // en cada render y haría recalcular el useMemo de abajo siempre.
    const config = useMemo(() => championship?.carUsageTracking || {}, [championship]);

    const datos = useMemo(() => construirUsoDeAutos(
        tracks,
        config,
        registrations.map(r => r.gt7Id || r.name || r.psnId).filter(Boolean),
        (n) => gt7Map[n] || n
    ), [tracks, config, registrations, gt7Map]);

    const filas = useMemo(() => {
        const t = busqueda.trim().toLowerCase();
        if (!t) return datos.filas;
        return datos.filas.filter(f => f.piloto.toLowerCase().includes(t));
    }, [datos.filas, busqueda]);

    if (!config.enabled) return null;

    const conAvisos = datos.filas.filter(f => f.avisos.length > 0).length;

    return (
        <div className="space-y-6">
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-6 border border-white/10">
                <h2 className="text-2xl font-bold text-white mb-1 flex items-center gap-2">🚗 Uso de Autos</h2>
                <p className="text-gray-400 text-sm">
                    {datos.esFijo
                        ? `Catálogo fijo de ${datos.catalogo.length} autos · máximo ${datos.maxUsos} uso${datos.maxUsos === 1 ? '' : 's'} por auto`
                        : `Hasta ${datos.maxAutos} autos por piloto · máximo ${datos.maxUsos} usos de cada uno`}
                    {datos.carreras.length > 0 && ` · ${datos.carreras.length} carreras registradas`}
                </p>
                {conAvisos > 0 && (
                    <p className="text-red-300 text-sm mt-2">
                        ⚠️ {conAvisos} piloto(s) superan algún límite
                    </p>
                )}
            </div>

            <input
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="🔍 Buscar mi nombre..."
                className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
            />

            {filas.length === 0 ? (
                <div className="bg-white/5 border border-white/10 rounded-xl p-10 text-center text-gray-400">
                    {busqueda ? 'Ningún piloto coincide con la búsqueda.' : 'Todavía no hay autos registrados.'}
                </div>
            ) : (
                <div className="space-y-3">
                    {filas.map(fila => (
                        <div key={fila.piloto} className="bg-white/5 border border-white/10 rounded-xl p-4">
                            <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
                                <h3 className="text-white font-bold">{fila.piloto}</h3>
                                {datos.esFijo && (
                                    <span className={`text-xs px-2 py-1 rounded-full font-semibold ${fila.usosRestantes === 0
                                        ? 'bg-gray-500/20 text-gray-300'
                                        : 'bg-green-500/20 text-green-300'
                                        }`}>
                                        {fila.usosRestantes === 0
                                            ? 'Sin usos disponibles'
                                            : `${fila.usosRestantes} uso${fila.usosRestantes === 1 ? '' : 's'} disponible${fila.usosRestantes === 1 ? '' : 's'}`}
                                    </span>
                                )}
                            </div>

                            {/* Auto por carrera: responde "¿qué llevé en cada fecha?" */}
                            {datos.carreras.length > 0 && (
                                <div className="overflow-x-auto -mx-1 px-1 mb-3">
                                    <div className="flex gap-2 min-w-min">
                                        {datos.carreras.map(carrera => {
                                            const auto = fila.porCarrera[carrera.id];
                                            return (
                                                <div key={carrera.id}
                                                    className={`flex-shrink-0 w-36 rounded-lg p-2 border ${auto
                                                        ? 'bg-white/5 border-white/10'
                                                        : 'bg-transparent border-white/5'
                                                        }`}>
                                                    <div className="text-gray-500 text-xs mb-1">
                                                        R{carrera.round} · {carrera.name}
                                                    </div>
                                                    <div className={`text-xs leading-tight ${auto ? 'text-white' : 'text-gray-600 italic'}`}>
                                                        {auto || 'No corrió'}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            <div className="flex flex-wrap gap-2 text-xs">
                                {fila.usos.map(({ auto, veces, agotado, excedido }) => (
                                    <span key={auto}
                                        className={`px-2 py-1 rounded border ${excedido
                                            ? 'bg-red-500/20 border-red-500/40 text-red-200'
                                            : agotado
                                                ? 'bg-white/10 border-white/20 text-gray-300'
                                                : 'bg-orange-500/15 border-orange-500/30 text-orange-200'
                                            }`}>
                                        {auto} ×{veces}
                                        {datos.maxUsos > 1 && `/${datos.maxUsos}`}
                                    </span>
                                ))}
                                {fila.disponibles.map(({ auto, restantes }) => (
                                    <span key={auto}
                                        className="px-2 py-1 rounded border bg-green-500/10 border-green-500/30 text-green-300">
                                        {auto}
                                        {datos.maxUsos > 1 ? ` · ${restantes} usos` : ' · sin usar'}
                                    </span>
                                ))}
                            </div>

                            {fila.avisos.length > 0 && (
                                <div className="mt-3 bg-red-500/10 border border-red-400/30 rounded-lg px-3 py-2">
                                    {fila.avisos.map((a, i) => (
                                        <p key={i} className="text-red-300 text-xs">⚠️ {a}</p>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
