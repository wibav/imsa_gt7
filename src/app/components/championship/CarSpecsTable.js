"use client";
import { useMemo, useState } from 'react';
import {
    CONFIGS_BOP,
    COLUMNAS_ORDENABLES,
    filasFichaTecnica,
    filtrarPorNombre,
    bopVariaPorCircuito,
    cochesQueVarian,
    origenFicha,
    MINIMO_PARA_BUSCAR,
} from '../../utils/carSpecs';

/**
 * Tabla comparativa de los coches de un campeonato con sus valores de BoP.
 *
 * Sirve para elegir: en la GR.4 Endurance cada piloto escoge dos coches de 34,
 * y hasta ahora solo veía sus nombres.
 */
export default function CarSpecsTable({ coches = [], titulo = '📊 Ficha técnica con BoP' }) {
    const [config, setConfig] = useState('medio');
    const [orden, setOrden] = useState({ campo: 'nombre', desc: false });
    const [busqueda, setBusqueda] = useState('');

    const varia = useMemo(() => bopVariaPorCircuito(coches), [coches]);
    const nVarian = useMemo(() => cochesQueVarian(coches), [coches]);
    const origen = useMemo(() => origenFicha(coches), [coches]);
    const { filas, mejores } = useMemo(
        () => filasFichaTecnica(coches, varia ? config : 'medio', orden),
        [coches, config, orden, varia]
    );

    const visibles = useMemo(() => filtrarPorNombre(filas, busqueda), [filas, busqueda]);

    if (filas.length === 0) return null;

    const ordenarPor = (campo) => setOrden(prev => ({
        campo,
        // Primer clic: A→Z en el nombre, y el mejor arriba en el resto (más PR
        // y CV, menos kg). El segundo clic invierte.
        desc: prev.campo === campo
            ? !prev.desc
            : campo === 'nombre' ? false : COLUMNAS_ORDENABLES[campo].mejorEsMayor,
    }));
    const flecha = (campo) => (orden.campo === campo ? (orden.desc ? ' ↓' : ' ↑') : '');

    const celda = (campo, valor, decimales = 0) => {
        const esMejor = valor != null && valor === mejores[campo];
        return (
            <td className={`px-2 sm:px-3 py-2 text-right tabular-nums whitespace-nowrap ${esMejor ? 'text-green-300 font-bold' : 'text-gray-200'}`}>
                {valor == null ? '—' : Number(valor).toLocaleString('es-ES', {
                    minimumFractionDigits: decimales, maximumFractionDigits: decimales,
                })}
            </td>
        );
    };

    return (
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl border border-white/10 overflow-hidden">
            <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <h3 className="text-lg font-bold text-white">{titulo}</h3>
                    <p className="text-gray-400 text-xs mt-0.5">
                        {filas.length} coches · valores con el BoP de la liga activado
                    </p>
                </div>
                {varia ? (
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400 whitespace-nowrap">Tipo de circuito</span>
                        <div className="flex flex-wrap gap-1 bg-black/20 rounded-lg p-1">
                        {CONFIGS_BOP.map(c => (
                            <button
                                key={c.id}
                                onClick={() => setConfig(c.id)}
                                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${config === c.id
                                    ? 'bg-orange-600 text-white'
                                    : 'text-gray-300 hover:bg-white/10'
                                    }`}
                            >
                                {c.etiqueta}
                            </button>
                        ))}
                        </div>
                    </div>
                ) : (
                    <span className="text-xs text-gray-400 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5">
                        El BoP es el mismo en todos los circuitos
                    </span>
                )}
            </div>

            {/* Sin esta línea los botones no se entendían: "Lento" parecía
                hablar del coche, no del circuito. */}
            {varia && (
                <p className="px-5 pb-4 -mt-1 text-xs text-gray-400 leading-relaxed">
                    ℹ️ En GT7 el BoP de algunos autos cambia según el circuito: no es el mismo en uno
                    rápido, de rectas largas, que en uno lento y técnico. Aquí afecta
                    a <span className="text-white font-medium">{nVarian} de {filas.length}</span> autos.
                    Elige el tipo de circuito de la carrera para ver los valores con los que se corre.
                </p>
            )}

            {filas.length >= MINIMO_PARA_BUSCAR && (
                <div className="px-5 pb-4">
                    <input
                        type="search"
                        value={busqueda}
                        onChange={(e) => setBusqueda(e.target.value)}
                        placeholder="🔍 Buscar un auto..."
                        className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                </div>
            )}

            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="text-xs text-gray-400 border-y border-white/10 bg-white/5">
                            <th className="px-2 sm:px-3 py-2 text-left font-medium">
                                <button onClick={() => ordenarPor('nombre')} className="hover:text-white transition-colors">
                                    Auto{flecha('nombre')}
                                </button>
                            </th>
                            <th className="px-2 sm:px-3 py-2 text-center font-medium">Tracción</th>
                            {Object.entries(COLUMNAS_ORDENABLES).map(([campo, { etiqueta }]) => (
                                <th key={campo} className="px-2 sm:px-3 py-2 text-right font-medium">
                                    <button onClick={() => ordenarPor(campo)} className="hover:text-white transition-colors">
                                        {etiqueta}{flecha(campo)}
                                    </button>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {visibles.length === 0 && (
                            <tr>
                                <td colSpan={2 + Object.keys(COLUMNAS_ORDENABLES).length}
                                    className="px-3 py-6 text-center text-gray-400 text-sm">
                                    Ningún auto coincide con &ldquo;{busqueda}&rdquo;
                                </td>
                            </tr>
                        )}
                        {visibles.map(f => (
                            <tr key={f.id} className="hover:bg-white/5">
                                <td className="px-2 sm:px-3 py-2 text-white leading-tight">{f.nombre}</td>
                                <td className="px-2 sm:px-3 py-2 text-center text-gray-300 text-xs">{f.traccion}</td>
                                {celda('pp', f.pp, 2)}
                                {celda('cv', f.cv)}
                                {celda('kg', f.kg)}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {origen && (
                <p className="px-5 py-3 text-xs text-gray-500 border-t border-white/10">
                    En verde, el mejor de cada columna. Datos de{' '}
                    <a href="https://gt-engine.com/gt7/" target="_blank" rel="noopener noreferrer"
                        className="text-orange-400 hover:underline">GT Engine</a>
                    {' '}· versión {origen.version} del juego
                </p>
            )}
        </div>
    );
}
