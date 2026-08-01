"use client";

import { useState, useEffect } from "react";

/**
 * Input numérico de posición (Bloque 3, CA-3.2/CA-3.7). Mantiene un
 * BORRADOR LOCAL que solo confirma el reordenamiento en `onBlur`/Enter —
 * confirmar en cada `onChange` reordenaría la fila mientras el usuario
 * todavía está escribiendo el número (ej. teclear "12" movería primero a la
 * posición "1") y le robaría el foco a mitad de escritura.
 */
function PositionInput({ idx, position, max, onCommit }) {
    const [draft, setDraft] = useState(String(position));

    // Si la posición cambia por una acción externa (flechas ▲▼, otra fila
    // reordenada, etc.) y este input no está siendo editado, sincronizar el
    // borrador con el valor real.
    useEffect(() => {
        setDraft(String(position));
    }, [position]);

    const commit = () => {
        const parsed = parseInt(draft, 10);
        if (!Number.isFinite(parsed) || parsed === position) {
            setDraft(String(position));
            return;
        }
        onCommit(idx, parsed);
    };

    return (
        <input
            type="number"
            min={1}
            max={max}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.currentTarget.blur(); } }}
            className="w-12 bg-white/10 border border-white/20 rounded p-1 text-white text-xs text-center focus:border-orange-500 outline-none"
            title="Posición final"
        />
    );
}

/**
 * Sección "Sala Única" para eventos estándar (una sola sala, una sola ronda).
 * Es una capa de PRESENTACIÓN sobre event.participants[]/event.results[]/
 * event.streaming — no crea ningún esquema nuevo (S1.1/S1.2 del documento
 * de requerimientos). La lista de participantes es de solo lectura: se
 * gestiona desde la sección "Participantes"; aquí solo se ven ya asignados.
 */
export default function StandardRoomSection({ form, updateStreaming, resultHandlers, labelCls, inputCls, rowInputCls, loadErrors }) {
    const participants = form.participants || [];
    const results = form.results || [];
    const max = form.maxParticipants || 0;
    const isOverCapacity = max > 0 && participants.length > max;
    const resultsLoadFailed = (loadErrors || []).includes('results');

    // E1.3: aviso de gt7Id duplicados en la lista global de participantes.
    const gt7IdCounts = {};
    participants.forEach(p => {
        const key = (p.gt7Id || '').trim().toLowerCase();
        if (!key) return;
        gt7IdCounts[key] = (gt7IdCounts[key] || 0) + 1;
    });
    const hasDuplicates = Object.values(gt7IdCounts).some(c => c > 1);

    // E1.5: nombres de participantes válidos, para marcar resultados "huérfanos".
    const participantLabels = new Set(
        participants.map(p => (p.gt7Id || p.psnId || '').trim().toLowerCase()).filter(Boolean)
    );

    const { addResult, updateResult, removeResult, moveResult, setResultPosition, generateResultsFromParticipants } = resultHandlers;

    // CA-1.1/CA-1.2: escala unificada con Participantes (p-2 text-sm) para
    // el input Piloto, y ancho ≥150px (en vez de los 96px/w-24 originales)
    // para el input PSN — usa `rowInputCls` (misma clase que Participantes)
    // en vez de la escala más chica (p-1.5/text-xs) que tenía esta fila.
    const resultRowInputCls = rowInputCls || "bg-white/10 border border-white/20 rounded p-2 text-white text-sm focus:border-orange-500 outline-none";

    return (
        <div className="space-y-4">
            {/* Cabecera con contador de plazas */}
            <div className="flex items-center justify-between flex-wrap gap-2">
                <h5 className="text-white font-semibold text-sm flex items-center gap-2">
                    🏟️ Sala Única
                    <span className={`text-xs px-2 py-0.5 rounded-full ${isOverCapacity ? 'bg-red-500/30 text-red-300' : 'bg-white/10 text-gray-400'}`}>
                        {max > 0 ? `${participants.length}/${max} plazas` : `${participants.length} pilotos`}
                    </span>
                </h5>
            </div>

            {isOverCapacity && (
                <p className="text-red-300 text-xs bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
                    ⚠️ Hay más participantes inscritos ({participants.length}) que plazas ({max}). Se muestran todos, sin truncar.
                </p>
            )}
            {hasDuplicates && (
                <p className="text-yellow-300 text-xs bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-3 py-2">
                    ⚠️ Hay pilotos con el mismo GT7 ID en la lista de participantes. Revísalo en la sección Participantes.
                </p>
            )}

            {/* Caster / Host / Stream — reutiliza event.streaming (P1.3).
                CA-1.3 (parcial, desviación consciente): solo se unifica el
                font-size con el resto del formulario (se quita el override
                `text-xs md:text-sm`) — NO se toca el padding/altura de
                `inputCls`, porque esa clase la comparte TODO el formulario
                de eventos (título, descripción, fecha...) y cambiarla sería
                un cambio visual global fuera de alcance de este trabajo. */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 md:gap-3">
                <div>
                    <label className={labelCls}>🎙️ Caster</label>
                    <input type="text" className={inputCls} value={form.streaming?.casterName || ''} onChange={(e) => updateStreaming('casterName', e.target.value)} placeholder="Nombre del caster" />
                </div>
                <div>
                    <label className={labelCls}>🎮 Host</label>
                    <input type="text" className={inputCls} value={form.streaming?.hostName || ''} onChange={(e) => updateStreaming('hostName', e.target.value)} placeholder="PSN ID del host" />
                </div>
                <div>
                    <label className={labelCls}>📺 Stream URL</label>
                    <input type="url" className={inputCls} value={form.streaming?.url || ''} onChange={(e) => updateStreaming('url', e.target.value)} placeholder="https://..." />
                </div>
            </div>

            {/* Participantes — solo lectura, espejo de event.participants[] */}
            <div>
                <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-400 text-xs font-semibold uppercase">Participantes (solo lectura)</span>
                    <span className="text-gray-500 text-xs">Gestiona los pilotos en la sección &quot;Participantes&quot;</span>
                </div>
                {participants.length === 0 ? (
                    <p className="text-gray-500 text-xs text-center py-3 bg-white/5 border border-white/10 rounded-lg">
                        Sin pilotos inscritos
                    </p>
                ) : (
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                        {participants.map((p, idx) => (
                            <div key={p.id || idx} className="flex gap-2 items-center px-2 py-1.5 bg-white/5 border border-white/10 rounded">
                                <span className="text-gray-500 text-xs w-5 text-center">{idx + 1}</span>
                                <div className="flex-1 text-white text-xs">
                                    <span className="font-semibold">{p.gt7Id || p.psnId || '(sin nombre)'}</span>
                                    {p.psnId && p.gt7Id && <span className="text-gray-400 ml-2">PSN: {p.psnId}</span>}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Resultados — persisten en event.results[] (S1.2) */}
            <div>
                <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-400 text-xs font-semibold uppercase">Resultados</span>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={generateResultsFromParticipants}
                            disabled={participants.length === 0}
                            className="text-xs px-2 py-1 bg-purple-600 hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded font-semibold transition-colors"
                        >
                            📥 Cargar Pilotos
                        </button>
                        <button type="button" onClick={addResult} className="text-xs px-2 py-1 bg-green-600 hover:bg-green-700 text-white rounded font-semibold transition-colors">
                            + Resultado
                        </button>
                    </div>
                </div>
                {/* CA-2.6: banner de error de lectura distinguible de "no había
                    resultados" — sin esto, un fallo de red/ad-blocker se ve
                    idéntico a un evento vacío, y guardar encima borraría los
                    resultados reales (el botón Guardar ya queda deshabilitado
                    desde EventForm mientras esto esté presente). */}
                {resultsLoadFailed && (
                    <p className="text-red-300 text-xs bg-red-500/10 border border-red-500/40 rounded-lg px-3 py-2 mb-2">
                        ⚠️ No se pudieron cargar los resultados de este evento (posible problema de red o bloqueador de anuncios). Guardar está deshabilitado para no borrarlos — recarga la página e inténtalo de nuevo.
                    </p>
                )}
                {results.length === 0 ? (
                    <p className="text-gray-500 text-xs text-center py-3 bg-white/5 border border-white/10 rounded-lg">
                        Sin resultados cargados
                    </p>
                ) : (
                    // CA-1.5 (max-h subido de 64 a 80 para compensar filas más
                    // altas tras unificar la escala tipográfica) +
                    // overflow-x-auto/min-w para que la fila no se rompa en
                    // viewports angostos en vez de comprimir los inputs.
                    <div className="space-y-1 max-h-80 overflow-y-auto overflow-x-auto">
                        <div className="min-w-[620px] space-y-1">
                            {results.map((r, idx) => {
                                const isOrphan = r.driverName && !participantLabels.has(r.driverName.trim().toLowerCase());
                                return (
                                    <div
                                        key={r._uid || idx}
                                        className={`flex gap-1.5 items-center rounded p-1 border ${isOrphan ? 'border-amber-500/50 bg-amber-500/5' : 'border-transparent'}`}
                                        title={isOrphan ? 'Este piloto no figura en la lista de participantes (no inscrito)' : undefined}
                                    >
                                        <div className="flex flex-col gap-0.5">
                                            <button type="button" onClick={() => moveResult(idx, -1)} disabled={idx === 0} className="min-w-[24px] min-h-[24px] text-gray-500 hover:text-white disabled:opacity-20 text-[10px] leading-none">▲</button>
                                            <button type="button" onClick={() => moveResult(idx, 1)} disabled={idx === results.length - 1} className="min-w-[24px] min-h-[24px] text-gray-500 hover:text-white disabled:opacity-20 text-[10px] leading-none">▼</button>
                                        </div>
                                        {/* Bloque 3: input de posición con desplazamiento — CA-3.1/CA-3.3.
                                            Complementa las flechas ▲▼ (S5), no las reemplaza. */}
                                        <PositionInput idx={idx} position={idx + 1} max={results.length} onCommit={setResultPosition} />
                                        <span className={`text-xs w-6 text-center font-bold flex-shrink-0 ${idx === 0 ? 'text-yellow-400' : idx === 1 ? 'text-gray-300' : idx === 2 ? 'text-orange-400' : 'text-gray-500'}`}>
                                            {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                                        </span>
                                        <input type="text" className={`flex-1 min-w-[80px] ${resultRowInputCls}`} value={r.driverName || ''} onChange={(e) => updateResult(idx, 'driverName', e.target.value)} placeholder="Piloto" />
                                        <input type="text" className={`w-40 lg:w-48 ${resultRowInputCls}`} value={r.psnId || ''} onChange={(e) => updateResult(idx, 'psnId', e.target.value)} placeholder="PSN" />
                                        <button type="button" title="Vuelta rápida" onClick={() => updateResult(idx, 'fastestLap', !r.fastestLap)} className={`min-w-[24px] min-h-[24px] text-xs px-1 rounded ${r.fastestLap ? 'bg-purple-500/30 text-purple-300' : 'text-gray-600 hover:text-purple-400'}`}>⚡</button>
                                        <button type="button" title="Pole Position" onClick={() => updateResult(idx, 'polePosition', !r.polePosition)} className={`min-w-[24px] min-h-[24px] text-xs px-1 rounded ${r.polePosition ? 'bg-yellow-500/30 text-yellow-300' : 'text-gray-600 hover:text-yellow-400'}`}>🅿️</button>
                                        <button type="button" title="DNF" onClick={() => updateResult(idx, 'dnf', !r.dnf)} className={`min-w-[24px] min-h-[24px] text-xs px-1 rounded ${r.dnf ? 'bg-red-500/30 text-red-300' : 'text-gray-600 hover:text-red-400'}`}>✖</button>
                                        <button type="button" onClick={() => removeResult(idx)} className="min-w-[24px] min-h-[24px] text-red-400 hover:text-red-300 text-xs font-bold ml-1">×</button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
