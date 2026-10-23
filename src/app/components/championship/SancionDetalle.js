"use client";
import { NIVELES_DANOS } from '../../models/Penalty';

/** Puntos que resta un preset: los del nivel de daños elegido, o los fijos. */
export function puntosBase(preset, nivel) {
    if (Array.isArray(preset?.damagePoints)) return nivel == null ? 0 : (preset.damagePoints[nivel] || 0);
    return preset?.points || 0;
}

/** Resumen corto para la tarjeta del catálogo: «-2 a -6 pts», «-3 pos.», «DSQ». */
export function resumenPreset(preset) {
    if (preset.type === 'disqualification') return 'DSQ';
    if (preset.type === 'position') return `-${preset.positionsLost} pos.`;
    if (Array.isArray(preset.damagePoints)) {
        return `-${Math.min(...preset.damagePoints)} a -${Math.max(...preset.damagePoints)} pts`;
    }
    return preset.points > 0 ? `-${preset.points} pts` : '';
}

/** La sanción necesita una carrera concreta (cambia su resultado). */
export const cambiaResultado = (preset) => preset?.type === 'position' || preset?.type === 'disqualification';

/**
 * Detalle de la sanción elegida: nivel de daños, posiciones o descalificación.
 *
 * @param {object}   preset
 * @param {number|null} nivel        - nivel de daños elegido (0-3)
 * @param {Function} onNivel
 * @param {number}   posiciones      - posiciones que pierde (type 'position')
 * @param {Function} onPosiciones
 */
export default function SancionDetalle({ preset, nivel, onNivel, posiciones, onPosiciones }) {
    if (!preset) return null;
    const conDanos = Array.isArray(preset.damagePoints);
    if (!conDanos && !cambiaResultado(preset) && !preset.article) return null;

    return (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 space-y-2">
            {conDanos && (
                <div>
                    <p className="text-xs text-gray-300 mb-1.5">Nivel de daños del coche afectado <span className="text-red-300">*</span></p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                        {(NIVELES_DANOS || []).map((etiqueta, i) => (
                            <button
                                key={etiqueta}
                                type="button"
                                onClick={() => onNivel(i)}
                                aria-pressed={nivel === i}
                                className={`px-2 py-1.5 rounded-lg text-xs border transition-colors ${nivel === i
                                    ? 'bg-red-600 border-red-400 text-white font-semibold'
                                    : 'bg-white/5 border-white/15 text-gray-300 hover:bg-white/10'}`}
                            >
                                {etiqueta}<span className="block font-bold">-{preset.damagePoints[i]} pts</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}
            {preset.type === 'position' && (
                <div className="flex flex-wrap items-center gap-2 text-xs text-gray-300">
                    <span>📉 Pierde</span>
                    <input
                        type="number" min="1" max="30"
                        value={posiciones}
                        onChange={e => onPosiciones(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-16 bg-white/10 border border-white/20 rounded px-2 py-1 text-white"
                    />
                    <span>posiciones en el resultado de la carrera. Los que pasa suben un puesto y se recalculan los puntos.</span>
                </div>
            )}
            {preset.type === 'disqualification' && (
                <p className="text-xs text-red-200">🔴 Queda descalificado (DSQ) de la carrera: pierde todos sus puntos de esa carrera y los de detrás suben un puesto.</p>
            )}
            {preset.article && <p className="text-[11px] text-gray-500">Reglamento general, artículo {preset.article}.</p>}
        </div>
    );
}

/** Efecto de una sanción ya impuesta, para los listados. */
export function EfectoSancion({ penalty, compacto = false }) {
    const nivel = Number.isInteger(penalty.damageLevel) ? NIVELES_DANOS[penalty.damageLevel] : null;
    return (
        <div className={`flex flex-col items-end gap-0.5 ${compacto ? '' : 'gap-1'}`}>
            {penalty.type === 'disqualification' && <span className="text-red-400 font-bold text-sm">DSQ</span>}
            {penalty.type === 'position' && penalty.positionsLost > 0 && <span className="text-orange-400 font-bold text-sm">-{penalty.positionsLost} pos.</span>}
            {penalty.points > 0 && <span className="text-red-400 font-bold text-sm">-{penalty.points} pts</span>}
            {penalty.warningPoints > 0 && <span className="text-yellow-400 text-xs">+{penalty.warningPoints} ⚠️</span>}
            {nivel && <span className="text-gray-500 text-[11px]">{nivel}</span>}
            {penalty.article && <span className="text-gray-500 text-[11px]">art. {penalty.article}</span>}
        </div>
    );
}
