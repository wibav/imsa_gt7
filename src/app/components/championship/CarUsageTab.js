"use client";
import { useEffect, useMemo, useState } from 'react';
import { construirUsoDeAutos, CATEGORY_TO_CAR_CLASS } from '../../utils/carUsageCalculator';
import { resolverCoche } from '../../utils/carSpecs';
import { FirebaseService } from '../../services/firebaseService';
import CarSpecsTable from './CarSpecsTable';

/**
 * Uso de autos del lado del piloto: qué auto llevó cada uno en cada carrera y
 * cuántos usos le quedan.
 *
 * El dato ya se guardaba —cada carrera tiene su `carsUsed`— pero solo lo leía
 * el panel de administración. Un piloto no tenía forma de saber si le quedaba
 * algún uso de un coche, que en un campeonato con límite es justo lo que
 * necesita saber ANTES de la siguiente carrera.
 */
export default function CarUsageTab({ championship, tracks = [], divisions = [], gt7Map = {} }) {
    const [busqueda, setBusqueda] = useState('');
    // Memorizado: `championship?.carUsageTracking || {}` crea un objeto nuevo
    // en cada render y haría recalcular el useMemo de abajo siempre.
    const config = useMemo(() => championship?.carUsageTracking || {}, [championship]);

    /**
     * Quién sale en la lista: los pilotos asignados a una sala y los que ya
     * han corrido.
     *
     * Listar a todos los inscritos llenaba la pantalla de gente sin un solo
     * dato —en la GR.4 eran 33 pilotos con la Pre-Qualy aún sin correr—, y el
     * uso de autos solo dice algo de quien tiene sala o ya ha competido.
     */
    const roster = useMemo(() => {
        const nombres = new Set();
        divisions.forEach(div => (div.drivers || []).forEach(n => n && nombres.add(n)));
        tracks.forEach(t => Object.keys(t.points || {}).forEach(n => n && nombres.add(n)));
        return [...nombres];
    }, [divisions, tracks]);

    const datos = useMemo(
        () => construirUsoDeAutos(tracks, config, roster, (n) => gt7Map[n] || n),
        [tracks, config, roster, gt7Map]
    );

    // Catálogo oficial, para la ficha técnica con BoP. Va cacheado en el
    // servicio; si falla, la ficha simplemente no aparece.
    const [catalogo, setCatalogo] = useState([]);
    useEffect(() => {
        let vivo = true;
        FirebaseService.getCars().then(c => { if (vivo) setCatalogo(c); }).catch(() => { });
        return () => { vivo = false; };
    }, []);

    /**
     * Coches de la ficha: los del catálogo del campeonato si es fijo, o todos
     * los de su clase si cada piloto elige los suyos.
     *
     * En modo fijo se muestra el nombre tal como lo escribió el organizador
     * —es el que aparece en el resto de la página— aunque la ficha se busque
     * por el nombre oficial.
     */
    const cochesFicha = useMemo(() => {
        if (catalogo.length === 0) return [];
        const fijos = config.mode === 'fixed' ? (config.carCatalog || []) : [];
        if (fijos.length > 0) {
            return fijos
                .map(nombre => {
                    const doc = resolverCoche(nombre, catalogo);
                    return doc ? { ...doc, name: nombre } : null;
                })
                .filter(Boolean);
        }
        const clases = new Set((championship?.categories || [])
            .map(cat => CATEGORY_TO_CAR_CLASS[cat]).filter(Boolean));
        // Sin clase reconocida no se muestra nada: listar los 120 coches de
        // las cuatro clases no ayuda a elegir.
        if (clases.size === 0) return [];
        return catalogo.filter(c => clases.has(c.carClass));
    }, [catalogo, config, championship]);

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
                <div className="bg-white/5 border border-white/10 rounded-xl p-10 text-center">
                    {busqueda ? (
                        <p className="text-gray-400">Ningún piloto coincide con la búsqueda.</p>
                    ) : (
                        <>
                            <div className="text-4xl mb-3">🚗</div>
                            <p className="text-gray-300 font-semibold">Todavía no hay nada que mostrar</p>
                            <p className="text-gray-500 text-sm mt-1 max-w-md mx-auto">
                                {championship?.preQualy?.enabled
                                    ? 'Aquí aparecerá el uso de autos de cada piloto en cuanto se corra la Pre-Qualy y se repartan las salas.'
                                    : 'Aquí aparecerá el uso de autos de cada piloto en cuanto se dispute la primera carrera.'}
                            </p>
                        </>
                    )}
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

            {/* Al final: lo que un piloto mira cada semana es cuántos usos le
                quedan, así que eso va primero y la ficha queda como consulta. */}
            <CarSpecsTable coches={cochesFicha} />
        </div>
    );
}
