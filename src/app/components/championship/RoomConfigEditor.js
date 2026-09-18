"use client";
import {
    SECCIONES_SALA,
    GRUPOS_AJUSTES,
    TODOS_LOS_AJUSTES,
    COMPUESTOS,
    IGUAL_QUE_CARRERA,
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
                // Como en el juego: una fila de franjas de la salida al final
                // de la carrera, cada una con su clima. Antes eran dos
                // desplegables apilados por franja y 9 franjas ocupaban
                // media pantalla.
                const franjas = Array.isArray(v) ? v : [];
                const normal = (f) => (typeof f === 'string' ? { weather: f } : f || {});
                const cambiar = (i, weather) => onChange(campo.id, franjas.map((f, j) => (j === i ? { ...normal(f), weather } : f)));
                const icono = (cond) => {
                    const op = WEATHER_CONDITION_OPTIONS.find(o => o.value === cond);
                    return op ? op.label.split(' ')[0] : '❓';
                };
                const texto = (label) => label.split(' ').slice(1).join(' ');
                return (
                    <div className="space-y-2">
                        <div className="flex items-center justify-between text-[11px] text-gray-400 px-1">
                            <span>▶ Clima durante la salida</span>
                            <span>Clima al finalizar la carrera ▶</span>
                        </div>
                        <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-2">
                            {franjas.map((f, i) => {
                                const cond = normal(f).weather || '';
                                return (
                                    <div key={i} className="relative bg-black/20 border border-white/15 rounded-lg p-2 text-center">
                                        <button
                                            type="button"
                                            onClick={() => onChange(campo.id, franjas.filter((_, j) => j !== i))}
                                            className="absolute top-0.5 right-1 text-gray-500 hover:text-red-400 text-xs"
                                            aria-label={`Quitar franja ${i + 1}`}
                                            title="Quitar franja"
                                        >✕</button>
                                        <div className="text-[10px] text-gray-500">{i + 1}</div>
                                        <div className="text-2xl leading-none my-1">{icono(cond)}</div>
                                        <select
                                            value={cond}
                                            onChange={e => cambiar(i, e.target.value)}
                                            className="w-full bg-white/10 border border-white/20 rounded text-white text-[11px] py-1 px-0.5 focus:outline-none focus:ring-1 focus:ring-orange-500"
                                            aria-label={`Clima de la franja ${i + 1}`}
                                        >
                                            <option value="" className="bg-slate-800">Aleatoria</option>
                                            {WEATHER_CONDITION_OPTIONS.map(o => <option key={o.value} value={o.value} className="bg-slate-800">{texto(o.label)}</option>)}
                                        </select>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="flex items-center gap-4 text-xs">
                            <button type="button" onClick={() => onChange(campo.id, [...franjas, { weather: '', transition: 'gradual' }])} className="text-orange-400 hover:text-orange-300">
                                + Añadir franja
                            </button>
                            {franjas.length > 0 && (
                                <button type="button" onClick={() => onChange(campo.id, franjas.map(f => ({ ...normal(f), weather: '' })))} className="text-gray-400 hover:text-white">
                                    Todas aleatorias
                                </button>
                            )}
                            <span className="text-gray-500 ml-auto">{franjas.length} franja{franjas.length === 1 ? '' : 's'}</span>
                        </div>
                        {franjas.length === 0 && (
                            <p className="text-xs text-gray-500">Sin franjas: pulsa «+ Añadir franja» para crear la primera.</p>
                        )}
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
