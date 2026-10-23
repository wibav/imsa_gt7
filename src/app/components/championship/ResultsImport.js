"use client";

import { useEffect, useMemo, useState } from 'react';
import { FirebaseService } from '../../services/firebaseService';
import { emparejarPilotos, emparejarCoche, filaVueltaRapida, normalizar } from '../../utils/resultsImport';
import { getAllowedCars } from '../../utils/carUsageCalculator';

const MAX_LADO = 1800; // px: suficiente para leer los nombres y no enviar fotos de 10 MB

/** Redimensiona y pasa a JPEG en base64 (sin prefijo data:). */
function prepararImagen(file) {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            const escala = Math.min(1, MAX_LADO / Math.max(img.width, img.height));
            const canvas = document.createElement('canvas');
            canvas.width = Math.round(img.width * escala);
            canvas.height = Math.round(img.height * escala);
            canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
            URL.revokeObjectURL(url);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
            resolve({ mimeType: 'image/jpeg', data: dataUrl.split(',')[1], vista: dataUrl });
        };
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error(`No se pudo abrir ${file.name}`)); };
        img.src = url;
    });
}

const ETIQUETA_CONFIANZA = {
    aprendida: { texto: 'recordado', clase: 'bg-blue-600/30 text-blue-200' },
    segura: { texto: 'seguro', clase: 'bg-green-600/30 text-green-200' },
    probable: { texto: 'revisa', clase: 'bg-yellow-600/30 text-yellow-200' },
    manual: { texto: 'manual', clase: 'bg-white/10 text-gray-200' },
};

/**
 * Carga de resultados desde capturas de GT7 para una sala.
 *
 * Lee las capturas con IA, propone a qué piloto y coche corresponde cada fila
 * y, al aplicar, rellena el formulario del modal. No guarda nada: los
 * resultados se guardan con el botón del modal, como siempre.
 *
 * @param {object}   championship
 * @param {string}   [salaNombre]
 * @param {Array<{driver: string, nombres: string[], label: string}>} candidatos - pilotos de la sala
 * @param {Function} cochesDeclarados - (driver) => string[] (si no hay, se usan los permitidos)
 * @param {Object}   [aprendidos] - championship.aliasCapturas
 * @param {Function} onAplicar - ({ posiciones, coches, vueltaRapida, tiempos, aprendidos }) => void
 * @param {Function} onCerrar
 */
export default function ResultsImport({ championship, salaNombre = '', candidatos = [], cochesDeclarados, aprendidos = {}, onAplicar, onCerrar }) {
    const championshipId = championship?.id;
    // Sin coches declarados, se busca entre los permitidos del campeonato
    const [catalogo, setCatalogo] = useState([]);
    useEffect(() => {
        let vivo = true;
        FirebaseService.getCars().then(c => { if (vivo) setCatalogo(c || []); }).catch(() => {});
        return () => { vivo = false; };
    }, []);
    const permitidos = useMemo(() => getAllowedCars(championship, catalogo).map(c => c.name), [championship, catalogo]);
    const cochesDe = (driver) => {
        const declarados = cochesDeclarados?.(driver) || [];
        return declarados.length > 0 ? declarados : permitidos;
    };

    const [imagenes, setImagenes] = useState([]);
    const [leyendo, setLeyendo] = useState(false);
    const [error, setError] = useState('');
    const [filas, setFilas] = useState(null); // [{...fila, driver, confianza, coche}]

    const etiqueta = useMemo(() => Object.fromEntries(candidatos.map(c => [c.driver, c.label || c.driver])), [candidatos]);

    const anadirArchivos = async (lista) => {
        setError('');
        try {
            const nuevas = await Promise.all([...lista].filter(f => f.type.startsWith('image/')).map(prepararImagen));
            setImagenes(prev => [...prev, ...nuevas].slice(0, 6));
            setFilas(null);
        } catch (e) {
            setError(e.message);
        }
    };

    const leer = async () => {
        setLeyendo(true);
        setError('');
        try {
            const res = await FirebaseService.extractRaceResults(championshipId, imagenes.map(({ mimeType, data }) => ({ mimeType, data })));
            const emparejados = emparejarPilotos(res.filas, candidatos, aprendidos);
            setFilas(res.filas.map((f, i) => ({
                ...f,
                cocheLeido: f.coche,
                driver: emparejados[i].driver,
                confianza: emparejados[i].confianza,
                // piloto: inscrito de la sala · suplente: corre por un inscrito ·
                // invitado: no cuenta · null: pendiente de que el admin decida
                tipo: emparejados[i].driver ? 'piloto' : null,
                coche: emparejados[i].driver ? emparejarCoche(f.coche, cochesDe(emparejados[i].driver)) : null,
            })));
        } catch (e) {
            setError(e.message);
        } finally {
            setLeyendo(false);
        }
    };

    /** Asigna la fila i a un inscrito (como el propio piloto o como su suplente). */
    const asignar = (i, driver, tipo) => setFilas(prev => prev.map((f, k) => {
        if (k === i) {
            return {
                ...f, tipo, driver: driver || null,
                confianza: driver ? (tipo === 'suplente' ? 'suplente' : 'manual') : null,
                coche: driver ? emparejarCoche(f.cocheLeido, cochesDe(driver)) : null,
            };
        }
        // un inscrito no puede tener dos resultados
        return driver && f.driver === driver ? { ...f, driver: null, confianza: null, coche: null, tipo: null } : f;
    }));

    const marcarInvitado = (i) => setFilas(prev => prev.map((f, k) => (k === i ? { ...f, tipo: 'invitado', driver: null, confianza: null, coche: null } : f)));
    const reabrir = (i) => setFilas(prev => prev.map((f, k) => (k === i ? { ...f, tipo: null, driver: null, confianza: null, coche: null } : f)));

    const asignados = new Set((filas || []).map(f => f.driver).filter(Boolean));
    const sinResultado = candidatos.filter(c => !asignados.has(c.driver));
    const pendientes = (filas || []).filter(f => !f.tipo || ((f.tipo === 'piloto' || f.tipo === 'suplente') && !f.driver)).length;
    const invitados = (filas || []).filter(f => f.tipo === 'invitado').length;
    // Posición final: los invitados no cuentan y los de detrás suben
    const posicionFinal = useMemo(() => {
        const mapa = new Map();
        let n = 0;
        (filas || []).slice().sort((a, b) => a.posicion - b.posicion).forEach(f => {
            if (f.tipo !== 'invitado') mapa.set(f, ++n);
        });
        return mapa;
    }, [filas]);

    const aplicar = () => {
        const posiciones = {};
        const coches = {};
        const tiempos = {};
        const nuevosAprendidos = {};
        const validas = filas.filter(f => f.driver && f.tipo !== 'invitado');
        validas.forEach(f => {
            const pos = posicionFinal.get(f);
            posiciones[f.driver] = f.estado === 'no_termino' ? 'DNF' : String(pos);
            if (f.coche) coches[f.driver] = f.coche;
            tiempos[f.driver] = {
                posicion: pos, posicionEnJuego: f.posicion, tiempo: f.tiempo || '', estado: f.estado,
                vueltasPerdidas: f.vueltasPerdidas || 0, mejorVuelta: f.mejorVuelta || '', coche: f.coche || f.cocheLeido || '',
                nombreEnJuego: f.piloto,
                ...(f.tipo === 'suplente' ? { suplente: f.piloto } : {}),
            };
            // Mismo piloto con otro apodo: se recuerda. Un suplente no (puede cambiar).
            if (f.tipo === 'piloto' && (f.confianza === 'manual' || f.confianza === 'probable')) nuevosAprendidos[normalizar(f.piloto)] = f.driver;
        });
        const iVr = filaVueltaRapida(validas.filter(f => f.estado !== 'no_termino'));
        const vrDriver = iVr >= 0 ? validas.filter(f => f.estado !== 'no_termino')[iVr].driver : '';
        const invitadosLista = filas.filter(f => f.tipo === 'invitado').map(f => f.piloto);
        onAplicar({ posiciones, coches, vueltaRapida: vrDriver, tiempos, aprendidos: nuevosAprendidos, invitados: invitadosLista });
    };

    return (
        <div className="mb-6 bg-blue-950/40 border border-blue-500/40 rounded-xl p-4">
            <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                    <h4 className="text-white font-bold">📷 Cargar resultados desde capturas{salaNombre ? ` · ${salaNombre}` : ''}</h4>
                    <p className="text-xs text-gray-400 mt-0.5">
                        Sube la pantalla de resultados del juego (si la sala ocupa dos pantallas, sube las dos). Revisa el emparejamiento antes de aplicarlo; nada se guarda hasta que pulses «Guardar».
                    </p>
                </div>
                <button type="button" onClick={onCerrar} className="text-gray-400 hover:text-white text-xl" aria-label="Cerrar carga desde capturas">✕</button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
                {imagenes.map((img, i) => (
                    <div key={i} className="relative">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={img.vista} alt={`Captura ${i + 1}`} className="h-16 w-28 object-cover rounded border border-white/20" />
                        <button type="button" onClick={() => { setImagenes(prev => prev.filter((_, k) => k !== i)); setFilas(null); }}
                            className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-600 text-white text-xs leading-none" aria-label="Quitar captura">×</button>
                    </div>
                ))}
                {imagenes.length < 6 && (
                    <label className="h-16 px-4 flex items-center justify-center rounded border-2 border-dashed border-white/30 text-gray-300 text-sm cursor-pointer hover:border-blue-400 hover:text-white">
                        + Añadir captura
                        <input type="file" accept="image/*" multiple className="hidden" onChange={e => { anadirArchivos(e.target.files); e.target.value = ''; }} />
                    </label>
                )}
                <button type="button" onClick={leer} disabled={leyendo || imagenes.length === 0}
                    className="ml-auto px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg disabled:opacity-50">
                    {leyendo ? '⏳ Leyendo…' : '🔍 Leer capturas'}
                </button>
            </div>

            {error && <p className="mt-3 text-sm text-red-300">❌ {error}</p>}

            {filas && (
                <div className="mt-4">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-xs text-gray-400 border-b border-white/10">
                                    <th className="py-2 pr-2">Pos</th>
                                    <th className="py-2 pr-2">En la captura</th>
                                    <th className="py-2 pr-2">Piloto</th>
                                    <th className="py-2 pr-2">Coche</th>
                                    <th className="py-2 pr-2">Tiempo</th>
                                    <th className="py-2">Mejor vuelta</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filas.map((f, i) => (
                                    <tr key={i} className={`border-b border-white/5 ${f.tipo === 'invitado' ? 'opacity-60' : (!f.tipo || !f.driver) ? 'bg-yellow-900/20' : ''}`}>
                                        <td className="py-1.5 pr-2 text-white font-bold whitespace-nowrap">
                                            {f.tipo === 'invitado' ? <span className="text-gray-500 line-through">{f.posicion}</span>
                                                : f.estado === 'no_termino' ? <span className="text-red-300">DNF</span>
                                                : posicionFinal.get(f)}
                                            {f.tipo !== 'invitado' && posicionFinal.get(f) !== f.posicion && f.estado !== 'no_termino' && (
                                                <span className="ml-1 text-[10px] text-green-300" title={`En el juego: ${f.posicion}º`}>▲{f.posicion - posicionFinal.get(f)}</span>
                                            )}
                                        </td>
                                        <td className="py-1.5 pr-2 text-gray-300 whitespace-nowrap">{f.piloto}</td>
                                        <td className="py-1.5 pr-2">
                                            {f.tipo === 'invitado' ? (
                                                <span className="text-xs text-gray-400">🚫 Invitado · no cuenta <button type="button" onClick={() => reabrir(i)} className="ml-1 underline text-gray-300">cambiar</button></span>
                                            ) : f.tipo ? (
                                                <div className="flex items-center gap-1.5">
                                                    {f.tipo === 'suplente' && <span className="text-[10px] text-purple-200 whitespace-nowrap">🔁 suplente de</span>}
                                                    <select value={f.driver || ''} onChange={e => asignar(i, e.target.value, f.tipo)}
                                                        className="max-w-[180px] px-2 py-1 bg-white/10 border border-white/30 rounded text-white text-xs">
                                                        <option value="" className="bg-slate-800">— Elige piloto —</option>
                                                        {candidatos.map(c => (
                                                            <option key={c.driver} value={c.driver} className="bg-slate-800">
                                                                {c.label || c.driver}{asignados.has(c.driver) && c.driver !== f.driver ? ' (ya asignado)' : ''}
                                                            </option>
                                                        ))}
                                                    </select>
                                                    {ETIQUETA_CONFIANZA[f.confianza] && (
                                                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${ETIQUETA_CONFIANZA[f.confianza].clase}`}>{ETIQUETA_CONFIANZA[f.confianza].texto}</span>
                                                    )}
                                                    {f.confianza !== 'segura' && f.confianza !== 'aprendida' && (
                                                        <button type="button" onClick={() => reabrir(i)} className="text-[10px] underline text-gray-400">cambiar</button>
                                                    )}
                                                </div>
                                            ) : (
                                                // No está inscrito en la sala: el admin decide qué es
                                                <div className="flex flex-wrap items-center gap-1">
                                                    <span className="text-[11px] text-yellow-200 mr-1">No está en la sala:</span>
                                                    <button type="button" onClick={() => asignar(i, '', 'suplente')} className="text-[11px] px-2 py-0.5 rounded bg-purple-600/40 text-purple-100 hover:bg-purple-600/60">🔁 Suplente de…</button>
                                                    <button type="button" onClick={() => marcarInvitado(i)} className="text-[11px] px-2 py-0.5 rounded bg-white/10 text-gray-200 hover:bg-white/20">🚫 Invitado</button>
                                                    <button type="button" onClick={() => asignar(i, '', 'piloto')} className="text-[11px] px-2 py-0.5 rounded bg-white/10 text-gray-200 hover:bg-white/20" title="El mismo piloto con otro apodo: se recordará">👤 Es…</button>
                                                </div>
                                            )}
                                        </td>
                                        <td className="py-1.5 pr-2 text-xs whitespace-nowrap">
                                            {f.tipo === 'invitado' ? <span className="text-gray-500">{f.cocheLeido}</span>
                                                : f.coche ? <span className="text-gray-200">{f.coche}</span>
                                                : <span className="text-yellow-300" title="No coincide con sus coches: elígelo en «Auto usado por piloto»">⚠️ {f.cocheLeido}</span>}
                                        </td>
                                        <td className="py-1.5 pr-2 text-gray-300 text-xs whitespace-nowrap">{f.tiempo}</td>
                                        <td className="py-1.5 text-gray-300 text-xs">{f.mejorVuelta}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {(pendientes > 0 || invitados > 0 || sinResultado.length > 0) && (
                        <div className="mt-3 text-xs space-y-1">
                            {pendientes > 0 && <p className="text-yellow-200">⚠️ {pendientes} fila(s) por resolver: indica si es suplente (y de quién), invitado o el mismo piloto con otro apodo.</p>}
                            {invitados > 0 && <p className="text-gray-300">🚫 {invitados} invitado(s) fuera del resultado: los pilotos de detrás suben posiciones.</p>}
                            {sinResultado.length > 0 && <p className="text-blue-200">ℹ️ Sin resultado en la captura (quedarán vacíos): {sinResultado.map(c => etiqueta[c.driver]).join(', ')}</p>}
                        </div>
                    )}

                    <div className="mt-4 flex justify-end gap-2">
                        <button type="button" onClick={aplicar} disabled={pendientes > 0}
                            title={pendientes > 0 ? 'Resuelve primero las filas pendientes' : undefined}
                            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-bold rounded-lg disabled:opacity-40">
                            ✅ Aplicar al formulario
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
