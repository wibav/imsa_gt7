"use client";
import { useMemo, useState } from 'react';
import { FirebaseService } from '../../services/firebaseService';
import { hoyEnEspana } from '../../utils/dateUtils';
import { CONTINUIDAD, MOVIMIENTO, estadoContinuidad, divisionDestino } from '../../utils/newEdition';
import { useI18n } from '../../i18n';

/**
 * «¿Continúas en esta edición?» — el veterano de una nueva edición se elige de
 * la lista y confirma o rechaza su continuidad.
 *
 * Sin cuentas, igual que la declaración de autos: cualquiera puede responder
 * por cualquiera, pero el admin lo ve todo en la pestaña Continuidad y puede
 * corregirlo. Lo guardado se relee del servidor antes de darlo por bueno.
 *
 * @param {Object} championship - con `edition` y `registrations`
 * @param {Array}  divisions    - divisiones de la nueva edición (para decir a cuál va)
 * @param {Object} continuations - { [regId]: {status} }
 */
export default function ContinuityModal({ championship, divisions = [], continuations = {}, onClose, onSaved }) {
    const { t, locale } = useI18n();
    const c = (clave, vars) => t(`formularios.continuidad.${clave}`, vars);
    const edicion = championship.edition || {};
    const plazo = edicion.continuityDeadline;
    const cerrado = Boolean(edicion.continuityClosedFor) || (plazo && hoyEnEspana() > plazo);

    const veteranos = useMemo(
        () => (championship.registrations || []).filter(r => r.carryover)
            .sort((a, b) => (a.gt7Id || '').localeCompare(b.gt7Id || '')),
        [championship.registrations]
    );
    const divsOrdenadas = useMemo(() => [...divisions].sort((a, b) => (a.order || 0) - (b.order || 0)), [divisions]);

    const [respuestas, setRespuestas] = useState(continuations);
    const [regId, setRegId] = useState('');
    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState('');
    const [aviso, setAviso] = useState('');
    const [confirmarRechazo, setConfirmarRechazo] = useState(false);

    const reg = veteranos.find(r => r.id === regId);
    const estado = reg ? estadoContinuidad(reg, respuestas) : null;
    const nombre = (r) => r.gt7Id || r.name || r.psnId || t('componentes.tabla.piloto');

    const destino = (() => {
        if (!reg || divsOrdenadas.length === 0) return null;
        const i = divisionDestino(reg.carryover.divisionIndex ?? 0, reg.carryover.movement, divsOrdenadas.length);
        return divsOrdenadas[i]?.name || null;
    })();

    const responder = async (status) => {
        setGuardando(true);
        setError('');
        setAviso('');
        try {
            await FirebaseService.setContinuation(championship.id, reg.id, status, 'piloto');
            setRespuestas(prev => ({ ...prev, [reg.id]: { status } }));
            setAviso(status === CONTINUIDAD.CONFIRMADA
                ? `✅ ${c('confirmadaOk')}`
                : c('rechazadaOk'));
            setConfirmarRechazo(false);
            onSaved?.();
        } catch (e) {
            console.error(e);
            setError(`❌ ${c('errGuardar')}`);
        } finally {
            setGuardando(false);
        }
    };

    const etiquetaEstado = {
        [CONTINUIDAD.PENDIENTE]: <span className="text-yellow-300">⏳ {c('pendiente')}</span>,
        [CONTINUIDAD.CONFIRMADA]: <span className="text-green-300">✅ {c('confirmada')}</span>,
        [CONTINUIDAD.RECHAZADA]: <span className="text-red-300">🚪 {c('noContinua')}</span>,
        [CONTINUIDAD.CADUCADA]: <span className="text-red-300">⌛ {c('caducada')}</span>,
    };
    const flecha = { [MOVIMIENTO.SUBE]: `▲ ${c('asciendes')}`, [MOVIMIENTO.BAJA]: `▼ ${c('desciendes')}`, [MOVIMIENTO.QUEDA]: `= ${c('teMantienes')}` };

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={onClose}>
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-white/30 rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="flex items-start justify-between mb-4">
                    <div>
                        <h3 className="text-xl font-bold text-white">🔁 {c('titulo')}</h3>
                        <p className="text-gray-400 text-sm mt-1">{championship.name}{edicion.previousName ? ` · ${c('vieneDe', { edicion: edicion.previousName })}` : ''}</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl" aria-label={t('campeonato.cerrar')}>✕</button>
                </div>

                <div className={`mb-4 px-4 py-3 rounded-lg text-sm ${cerrado ? 'bg-red-900/40 border border-red-500/40 text-red-200' : 'bg-blue-900/30 border border-blue-500/30 text-blue-100'}`}>
                    {cerrado
                        ? c('plazoTerminado')
                        : plazo
                            ? <>{c('tienesHasta')} <strong>{new Date(`${plazo}T12:00:00`).toLocaleDateString(locale)}</strong> {c('aLas')}</>
                            : c('confirmaSi')}
                </div>

                <label className="block text-sm font-medium text-gray-300 mb-2">{t('formularios.declaracion.quienEres')}</label>
                <select
                    value={regId}
                    onChange={e => { setRegId(e.target.value); setError(''); setAviso(''); setConfirmarRechazo(false); }}
                    className="w-full px-3 py-2 bg-white/10 border border-white/30 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                    <option value="" className="bg-slate-800">{t('formularios.declaracion.seleccionaPiloto')}</option>
                    {veteranos.map(r => {
                        const e = estadoContinuidad(r, respuestas);
                        const marca = e === CONTINUIDAD.CONFIRMADA ? ' ✅' : e === CONTINUIDAD.PENDIENTE ? '' : ' 🚪';
                        return <option key={r.id} value={r.id} className="bg-slate-800">{nombre(r)}{marca}</option>;
                    })}
                </select>

                {reg && (
                    <div className="mt-4 bg-white/5 border border-white/10 rounded-lg p-4 text-sm space-y-1">
                        <p className="text-white font-semibold">{nombre(reg)}</p>
                        <p className="text-gray-300">
                            {c('edicionAnterior')}: {reg.carryover.divisionName || '—'}{reg.carryover.position ? `, ${reg.carryover.position}º` : ''}
                            {' · '}{flecha[reg.carryover.movement] || ''}
                        </p>
                        {destino && <p className="text-gray-300">{c('estaEdicion')}: <strong className="text-white">{destino}</strong></p>}
                        <p>{t('campeonato.estadoCol')}: {etiquetaEstado[estado]}</p>
                    </div>
                )}

                {error && <div className="mt-4 px-4 py-2 bg-red-900/40 border border-red-500/40 rounded-lg text-red-200 text-sm">{error}</div>}
                {aviso && !error && <div className="mt-4 px-4 py-2 bg-green-900/40 border border-green-500/40 rounded-lg text-green-200 text-sm">{aviso}</div>}

                {reg && !cerrado && (estado === CONTINUIDAD.PENDIENTE || estado === CONTINUIDAD.CONFIRMADA || estado === CONTINUIDAD.RECHAZADA) && (
                    confirmarRechazo ? (
                        <div className="mt-4 bg-red-900/20 border border-red-500/40 rounded-lg p-4 text-sm">
                            <p className="text-red-100 mb-3">{c('seguro')}</p>
                            <div className="flex gap-2">
                                <button onClick={() => setConfirmarRechazo(false)} className="flex-1 px-3 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg">{t('formularios.declaracion.volver')}</button>
                                <button onClick={() => responder(CONTINUIDAD.RECHAZADA)} disabled={guardando} className="flex-1 px-3 py-2 bg-red-700 hover:bg-red-800 text-white rounded-lg font-semibold disabled:opacity-50">
                                    {guardando ? '⏳…' : c('siNoContinuo')}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="mt-4 flex flex-col sm:flex-row gap-2">
                            <button
                                onClick={() => responder(CONTINUIDAD.CONFIRMADA)}
                                disabled={guardando || estado === CONTINUIDAD.CONFIRMADA}
                                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold rounded-lg disabled:opacity-50"
                            >
                                {guardando ? `⏳ ${t('formularios.declaracion.guardando')}` : estado === CONTINUIDAD.CONFIRMADA ? `✅ ${c('yaConfirmado')}` : `✅ ${c('confirmo')}`}
                            </button>
                            <button
                                onClick={() => setConfirmarRechazo(true)}
                                disabled={guardando || estado === CONTINUIDAD.RECHAZADA}
                                className="flex-1 px-4 py-2.5 bg-white/10 hover:bg-white/20 text-gray-200 rounded-lg disabled:opacity-50"
                            >
                                {c('noContinuo')}
                            </button>
                        </div>
                    )
                )}

                <button onClick={onClose} className="mt-4 w-full px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg text-sm">{t('campeonato.cerrar')}</button>
            </div>
        </div>
    );
}
