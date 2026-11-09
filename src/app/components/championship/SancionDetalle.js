"use client";
import { NIVELES_DANOS } from '../../models/Penalty';
import { useI18n } from '../../i18n';

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

// ── Agravantes y atenuantes (reglamento general, 6.5) ──────────────────
// Cada agravante duplica la sanción y cada atenuante la reduce a la mitad.
// Se combinan, pero el resultado nunca supera el triple de la base. Los
// extras por daños (6.4) se suman después, fuera de este cálculo.
export const AGRAVANTES = [
    { id: 'vuelta', etiqueta: 'Primera o última vuelta' },
    { id: 'reincidencia', etiqueta: 'Reincidencia (la misma infracción en este campeonato)' },
    { id: 'malaFe', etiqueta: 'Intencionalidad o mala fe' },
];
export const ATENUANTES = [
    { id: 'devolvio', etiqueta: 'Devolvió la posición tras el incidente' },
    { id: 'otras', etiqueta: 'Otras circunstancias que reducen la gravedad o la culpa' },
];
export const SIN_FACTORES = { agravantes: [], atenuantes: [] };

/** Multiplicador de los factores marcados: ×2 por agravante, ×½ por atenuante. */
export function multiplicadorFactores(factores) {
    return Math.pow(2, factores?.agravantes?.length || 0) * Math.pow(0.5, factores?.atenuantes?.length || 0);
}

/** Sanción tras agravantes y atenuantes, redondeada y con el tope del triple. */
export function aplicarFactores(base, factores) {
    if (!base) return 0;
    return Math.min(Math.round(base * multiplicadorFactores(factores)), base * 3);
}

/** ¿Los factores se aplican a este preset? Solo a puntos y posiciones. */
export const admiteFactores = (preset) => preset?.type === 'points' || preset?.type === 'position';

/** Lo que se guarda en la sanción para dejar constancia del cálculo. */
export function registroFactores(base, factores) {
    return {
        agravantes: factores?.agravantes || [],
        atenuantes: factores?.atenuantes || [],
        base,
        multiplicador: multiplicadorFactores(factores),
    };
}

/**
 * Casillas de agravantes y atenuantes con el resultado calculado.
 *
 * @param {number}   base          - puntos o posiciones antes de los factores
 * @param {string}   unidad        - 'pts' | 'pos.'
 * @param {object}   factores      - { agravantes: [], atenuantes: [] }
 * @param {Function} onChange
 * @param {number}   previas       - sanciones previas del piloto por la misma infracción
 */
export function FactoresSancion({ base, unidad = 'pts', factores, onChange, previas = 0 }) {
    const alternar = (grupo, id) => {
        const lista = factores[grupo] || [];
        onChange({ ...factores, [grupo]: lista.includes(id) ? lista.filter(x => x !== id) : [...lista, id] });
    };
    const resultado = aplicarFactores(base, factores);
    const mult = multiplicadorFactores(factores);
    const topado = base > 0 && Math.round(base * mult) > base * 3;
    const casilla = (grupo, f, color) => (
        <label key={f.id} className="flex items-start gap-2 text-xs text-gray-300 cursor-pointer">
            <input type="checkbox" checked={(factores[grupo] || []).includes(f.id)} onChange={() => alternar(grupo, f.id)}
                className={`mt-0.5 w-4 h-4 ${color}`} />
            <span>
                {f.etiqueta}
                {f.id === 'reincidencia' && previas > 0 && (
                    <span className="block text-yellow-300">Ya tiene {previas} sanción(es) por esta infracción en el campeonato.</span>
                )}
            </span>
        </label>
    );
    return (
        <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
                <h4 className="text-purple-200 font-semibold text-sm">⚖️ Agravantes y atenuantes <span className="text-gray-500 font-normal">(art. 6.5)</span></h4>
                <span className="text-xs text-gray-400 whitespace-nowrap">
                    -{base} {unidad}{mult !== 1 && <> ×{mult} → <span className="text-red-300 font-bold">-{resultado} {unidad}</span></>}
                </span>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                    <p className="text-[11px] uppercase tracking-wide text-red-300">Agravantes (×2 cada uno)</p>
                    {AGRAVANTES.map(f => casilla('agravantes', f, 'accent-red-500'))}
                </div>
                <div className="space-y-1.5">
                    <p className="text-[11px] uppercase tracking-wide text-green-300">Atenuantes (÷2 cada uno)</p>
                    {ATENUANTES.map(f => casilla('atenuantes', f, 'accent-green-500'))}
                </div>
            </div>
            {topado && <p className="text-[11px] text-gray-400">Limitada al triple de la sanción base.</p>}
        </div>
    );
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
    const { t } = useI18n();
    const niveles = t('sanciones.nivelesDanos');
    const nivel = Number.isInteger(penalty.damageLevel) ? (niveles[penalty.damageLevel] || NIVELES_DANOS[penalty.damageLevel]) : null;
    return (
        <div className={`flex flex-col items-end gap-0.5 ${compacto ? '' : 'gap-1'}`}>
            {penalty.type === 'disqualification' && <span className="text-red-400 font-bold text-sm">DSQ</span>}
            {penalty.type === 'position' && penalty.positionsLost > 0 && <span className="text-orange-400 font-bold text-sm">-{penalty.positionsLost} {t('sanciones.pos')}</span>}
            {penalty.points > 0 && <span className="text-red-400 font-bold text-sm">-{penalty.points} pts</span>}
            {penalty.factores && penalty.factores.multiplicador !== 1 && (
                <span className="text-gray-500 text-[11px]">{penalty.factores.base} ×{penalty.factores.multiplicador}</span>
            )}
            {penalty.warningPoints > 0 && <span className="text-yellow-400 text-xs">+{penalty.warningPoints} ⚠️</span>}
            {nivel && <span className="text-gray-500 text-[11px]">{nivel}</span>}
            {penalty.article && <span className="text-gray-500 text-[11px]">{t('sanciones.art', { art: penalty.article })}</span>}
        </div>
    );
}
