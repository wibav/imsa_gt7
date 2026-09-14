"use client";
import {
    SECCIONES_SALA,
    GRUPOS_AJUSTES,
    TODOS_LOS_AJUSTES,
    COMPUESTOS,
    IGUAL_QUE_CARRERA,
    WEATHER_TRANSITION_OPTIONS,
} from "../../utils/roomConfig";
import { WEATHER_CONDITION_OPTIONS } from "../../utils/constants";

/**
 * Editor de la configuración de sala de una carrera, con las mismas secciones,
 * nombres y orden que el menú «Crear sala» de GT7 (ver utils/roomConfig.js).
 *
 * Lo usan los dos formularios de carrera del admin —el del gestor de
 * circuitos y el del asistente de campeonato—, que antes tenían cada uno su
 * propia copia de estos campos y ya habían empezado a divergir.
 *
 * Un campo sin valor muestra «— Sin definir —»: al abrir una carrera antigua no
 * se inventa nada que el organizador no haya elegido.
 *
 * @param {Object} reglas - track.rules ya normalizadas (normalizarReglas)
 * @param {Object} track - para los campos de solo lectura (categoría, duración)
 * @param {(campo: string, valor: any) => void} onChange
 */
export default function RoomConfigEditor({ reglas = {}, track = {}, onChange, textoOrigenVictoria = 'se elige arriba' }) {
    const inputCls = "w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500";

    const control = (campo) => {
        const v = reglas[campo.id];

        switch (campo.tipo) {
            case 'soloLectura': {
                if (campo.id === '__category') {
                    return <p className="text-sm text-gray-300 py-2">{track.category || 'Se elige en la pestaña Circuito'}</p>;
                }
                if (track.victoria !== undefined) {
                    return <p className="text-sm text-gray-300 py-2">{track.victoria || 'Sin definir'} · {textoOrigenVictoria}</p>;
                }
                const texto = track.raceType === 'resistencia'
                    ? `Límite de tiempo (${track.duration || '?'} min)`
                    : track.raceType === 'sprint_carrera'
                        ? `Sprint + carrera (${track.laps || '?'} vueltas)`
                        : `${track.laps || '?'} vueltas`;
                return <p className="text-sm text-gray-300 py-2">{texto} · se elige en la pestaña Circuito</p>;
            }

            case 'select': {
                // Los <select> solo manejan texto: se busca la opción por su valor serializado.
                const clave = v === undefined || v === null ? '__vacio' : JSON.stringify(v);
                const tieneVacia = campo.opciones.some(o => o.value === '');
                return (
                    <select
                        className={inputCls}
                        value={v === '' && tieneVacia ? JSON.stringify('') : clave}
                        onChange={e => onChange(campo.id, e.target.value === '__vacio' ? null : JSON.parse(e.target.value))}
                    >
                        {!tieneVacia && <option value="__vacio" className="bg-slate-800">— Sin definir —</option>}
                        {campo.opciones.map(o => (
                            <option key={String(o.value)} value={JSON.stringify(o.value)} className="bg-slate-800">
                                {o.label}{o.sinVerificar ? ' *' : ''}
                            </option>
                        ))}
                    </select>
                );
            }

            case 'numero':
            case 'multiplicador': {
                const igual = campo.igualQueCarrera && v === IGUAL_QUE_CARRERA;
                return (
                    <div className="space-y-2">
                        {campo.igualQueCarrera && (
                            <label className="flex items-center gap-2 text-xs text-gray-300">
                                <input
                                    type="checkbox"
                                    checked={igual}
                                    onChange={e => onChange(campo.id, e.target.checked ? IGUAL_QUE_CARRERA : null)}
                                    className="w-4 h-4 rounded"
                                />
                                Igual que durante la carrera
                            </label>
                        )}
                        {!igual && (
                            <div className="flex items-center gap-2">
                                <input
                                    type="number"
                                    min={campo.min}
                                    max={campo.max}
                                    step={campo.step || 1}
                                    value={v === null || v === undefined ? '' : v}
                                    placeholder={campo.vacio || '— Sin definir —'}
                                    onChange={e => onChange(campo.id, e.target.value === '' ? null : Number(e.target.value))}
                                    className={inputCls}
                                />
                                <span className="text-sm text-gray-400 whitespace-nowrap">{campo.tipo === 'multiplicador' ? 'x' : campo.unidad || ''}</span>
                            </div>
                        )}
                    </div>
                );
            }

            case 'compuestos': {
                const lista = Array.isArray(v) ? v : [];
                return (
                    <div className="flex flex-wrap gap-2 py-1">
                        {COMPUESTOS.map(c => {
                            const marcado = lista.includes(c.value);
                            return (
                                <label key={c.value} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm cursor-pointer ${marcado ? 'bg-orange-600/30 border-orange-500 text-white' : 'bg-white/5 border-white/20 text-gray-300'}`}>
                                    <input
                                        type="checkbox"
                                        checked={marcado}
                                        onChange={e => onChange(campo.id, e.target.checked ? [...lista, c.value] : lista.filter(x => x !== c.value))}
                                        className="w-4 h-4 rounded"
                                    />
                                    {c.label}
                                </label>
                            );
                        })}
                        <span className="text-xs text-gray-500 self-center">
                            {campo.vacioEsNinguno ? 'Ninguno marcado = sin obligación' : 'Ninguno marcado = Todo'}
                        </span>
                    </div>
                );
            }

            case 'ajustes': {
                const lista = Array.isArray(v) ? v : [];
                return (
                    <div className="space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                            {GRUPOS_AJUSTES.map(g => (
                                <div key={g.grupo} className="bg-white/5 border border-white/10 rounded-lg p-3">
                                    <div className="text-xs font-semibold text-amber-200 mb-2">{g.grupo}</div>
                                    {g.opciones.map(op => (
                                        <label key={op} className="flex items-start gap-2 text-sm text-gray-200 py-1 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={lista.includes(op)}
                                                onChange={e => onChange(campo.id, e.target.checked ? [...lista, op] : lista.filter(x => x !== op))}
                                                className="w-4 h-4 rounded mt-0.5"
                                            />
                                            {op}
                                        </label>
                                    ))}
                                </div>
                            ))}
                        </div>
                        <div className="flex gap-3 text-xs">
                            <button type="button" onClick={() => onChange(campo.id, [...TODOS_LOS_AJUSTES])} className="text-orange-300 hover:text-orange-200">Seleccionar todo</button>
                            <button type="button" onClick={() => onChange(campo.id, [])} className="text-gray-400 hover:text-white">Cancelar selección</button>
                        </div>
                    </div>
                );
            }

            case 'clima': {
                // Eventos antiguos: presets escritos a mano ("S18/C05/R07").
                if (typeof v === 'string') {
                    return (
                        <div className="space-y-2">
                            <input type="text" value={v} onChange={e => onChange(campo.id, e.target.value)} className={inputCls} />
                            <button type="button" onClick={() => onChange(campo.id, [])} className="text-sm text-orange-400 hover:text-orange-300">
                                Pasar a franjas de clima como en el juego
                            </button>
                        </div>
                    );
                }
                const franjas = Array.isArray(v) ? v : [];
                const cambiar = (i, cambio) => onChange(campo.id, franjas.map((f, j) => (j === i ? { ...(typeof f === 'string' ? { weather: f } : f), ...cambio } : f)));
                return (
                    <div className="space-y-2">
                        {franjas.map((f, i) => {
                            const franja = typeof f === 'string' ? { weather: f } : f;
                            return (
                                <div key={i} className="flex flex-wrap items-center gap-2">
                                    <span className="text-xs text-gray-400 w-6">{i + 1}</span>
                                    <select value={franja.weather || ''} onChange={e => cambiar(i, { weather: e.target.value })} className={`${inputCls} flex-1 min-w-[10rem]`}>
                                        <option value="" className="bg-slate-800">Aleatoria</option>
                                        {WEATHER_CONDITION_OPTIONS.map(o => <option key={o.value} value={o.value} className="bg-slate-800">{o.label}</option>)}
                                    </select>
                                    <select value={franja.transition || 'gradual'} onChange={e => cambiar(i, { transition: e.target.value })} className={`${inputCls} w-36`}>
                                        {WEATHER_TRANSITION_OPTIONS.map(o => <option key={o.value} value={o.value} className="bg-slate-800">{o.label}</option>)}
                                    </select>
                                    <button type="button" onClick={() => onChange(campo.id, franjas.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-300 text-sm px-2" aria-label={`Quitar franja ${i + 1}`}>✕</button>
                                </div>
                            );
                        })}
                        <button type="button" onClick={() => onChange(campo.id, [...franjas, { weather: '', transition: 'gradual' }])} className="text-sm text-orange-400 hover:text-orange-300">
                            + Añadir franja de clima
                        </button>
                    </div>
                );
            }

            default:
                return null;
        }
    };

    return (
        <div className="rounded-xl overflow-hidden border border-white/20">
            {SECCIONES_SALA.map(seccion => (
                <section key={seccion.id}>
                    <h4 className="bg-white/5 border-y border-white/10 first:border-t-0 px-4 py-2.5 text-center text-sm font-semibold text-gray-200">
                        {seccion.titulo}
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4">
                        {seccion.campos
                            .filter(c => !c.visibleSi || c.visibleSi(reglas, track))
                            .map(campo => (
                                <div key={campo.id} className={`bg-white/[0.04] border border-white/10 rounded-lg p-3 ${campo.ancho === 'completo' ? 'md:col-span-2' : ''}`}>
                                    <label className="block text-xs text-gray-400 mb-1.5">{campo.etiqueta}</label>
                                    {control(campo)}
                                </div>
                            ))}
                    </div>
                </section>
            ))}
            <p className="px-4 py-3 text-xs text-gray-500 border-t border-white/10">
                * Opción que existe en el juego pero cuyo nombre exacto no se ha podido comprobar.
            </p>
        </div>
    );
}
