"use client";
import { useEffect, useMemo, useState } from 'react';
import { FirebaseService } from '../../services/firebaseService';
import { hoyEnEspana } from '../../utils/dateUtils';
import {
    CONTINUIDAD,
    MOVIMIENTO,
    estadoContinuidad,
    sincronizarContinuidad,
    divisionDestino,
} from '../../utils/newEdition';

/**
 * Pestaña «Continuidad» del admin de una nueva edición: plazo, estado de cada
 * veterano (confirmó, no continúa, pendiente, baja), corrección a mano y
 * volcado de las respuestas en las inscripciones.
 *
 * Al cerrar el plazo lo hace solo la función close_edition_continuity
 * (functions/main.py); los botones de aquí sirven para no esperar.
 */
export default function ContinuityTab({ championship, divisions = [], onUpdate }) {
    const edicion = championship.edition || {};
    const [continuaciones, setContinuaciones] = useState({});
    const [plazo, setPlazo] = useState(edicion.continuityDeadline || '');
    const [guardando, setGuardando] = useState(false);
    const [mensaje, setMensaje] = useState('');
    const [copiado, setCopiado] = useState(false);

    const recargar = () => FirebaseService.getContinuations(championship.id).then(setContinuaciones).catch(() => {});
    useEffect(() => { recargar(); }, [championship.id]); // eslint-disable-line react-hooks/exhaustive-deps

    const veteranos = useMemo(() => (championship.registrations || []).filter(r => r.carryover), [championship.registrations]);
    const divsOrdenadas = useMemo(() => [...divisions].sort((a, b) => (a.order || 0) - (b.order || 0)), [divisions]);
    const nombre = (r) => r.gt7Id || r.name || r.psnId || '—';

    const cuenta = (e) => veteranos.filter(r => estadoContinuidad(r, continuaciones) === e).length;
    const cerrado = Boolean(edicion.continuityClosedFor);
    const vencido = Boolean(edicion.continuityDeadline) && hoyEnEspana() > edicion.continuityDeadline;
    const url = `https://imsa.trenkit.com/championships?id=${championship.id}`;

    const guardarPlazo = async () => {
        setGuardando(true);
        setMensaje('');
        try {
            // Cambiar el plazo reabre las confirmaciones si ya se habían cerrado
            // (quien ya causó baja sigue de baja: eso se corrige fila a fila).
            await FirebaseService.updateChampionship(championship.id, {
                edition: { ...edicion, continuityDeadline: plazo || null, continuityClosedFor: null },
            });
            setMensaje('✅ Plazo guardado.');
            await onUpdate?.();
        } catch (e) {
            setMensaje('❌ No se pudo guardar el plazo: ' + e.message);
        } finally {
            setGuardando(false);
        }
    };

    const fijarRespuesta = async (reg, status) => {
        setGuardando(true);
        setMensaje('');
        try {
            if (status === CONTINUIDAD.PENDIENTE) await FirebaseService.clearContinuation(championship.id, reg.id);
            else await FirebaseService.setContinuation(championship.id, reg.id, status, 'admin');
            // Si ya estaba resuelta en la inscripción, se reabre para que
            // mande la nueva respuesta al volver a aplicar.
            if (reg.carryover.continuity && reg.carryover.continuity !== CONTINUIDAD.PENDIENTE) {
                const registrations = championship.registrations.map(r => (r.id === reg.id
                    ? { ...r, status: 'pending', carryover: { ...r.carryover, continuity: CONTINUIDAD.PENDIENTE } }
                    : r));
                await FirebaseService.updateChampionship(championship.id, { registrations });
                await onUpdate?.();
            }
            await recargar();
        } catch (e) {
            setMensaje('❌ No se pudo cambiar la respuesta: ' + e.message);
        } finally {
            setGuardando(false);
        }
    };

    const aplicar = async (cerrar) => {
        if (cerrar && !window.confirm('Se cerrará el plazo: quien no haya confirmado causará baja y su plaza quedará libre. ¿Continuar?')) return;
        setGuardando(true);
        setMensaje('');
        try {
            const { registrations, cambios } = sincronizarContinuidad(championship.registrations || [], continuaciones, { cerrar });
            await FirebaseService.updateChampionship(championship.id, {
                registrations,
                ...(cerrar ? { edition: { ...edicion, continuityClosedFor: edicion.continuityDeadline || hoyEnEspana(), continuityClosedAt: new Date().toISOString() } } : {}),
            });
            setMensaje(`✅ Aplicado: ${cambios.confirmados.length} confirmados pasan a aprobados, ${cambios.rechazados.length} bajas${cerrar ? `, ${cambios.caducados.length} bajas por no confirmar` : ''}.`);
            await onUpdate?.();
        } catch (e) {
            setMensaje('❌ No se pudo aplicar: ' + e.message);
        } finally {
            setGuardando(false);
        }
    };

    const copiarMensaje = async () => {
        const texto = `🔁 ${championship.name}: si corriste ${edicion.previousName || 'la edición anterior'}, confirma tu continuidad${edicion.continuityDeadline ? ` antes del ${new Date(`${edicion.continuityDeadline}T12:00:00`).toLocaleDateString('es-ES')} (23:59 España)` : ''}.\nEntra aquí, pulsa «Confirmar mi continuidad» y elige tu nombre:\n${url}\nQuien no confirme a tiempo causará baja y su plaza quedará libre.`;
        try { await navigator.clipboard.writeText(texto); setCopiado(true); setTimeout(() => setCopiado(false), 2000); } catch { /* sin portapapeles */ }
    };

    const badge = {
        [CONTINUIDAD.PENDIENTE]: 'bg-yellow-500/20 text-yellow-300',
        [CONTINUIDAD.CONFIRMADA]: 'bg-green-500/20 text-green-300',
        [CONTINUIDAD.RECHAZADA]: 'bg-red-500/20 text-red-300',
        [CONTINUIDAD.CADUCADA]: 'bg-red-500/20 text-red-300',
    };
    const texto = {
        [CONTINUIDAD.PENDIENTE]: '⏳ Pendiente',
        [CONTINUIDAD.CONFIRMADA]: '✅ Confirmó',
        [CONTINUIDAD.RECHAZADA]: '🚪 No continúa',
        [CONTINUIDAD.CADUCADA]: '⌛ Baja (no confirmó)',
    };
    const flecha = { [MOVIMIENTO.SUBE]: '▲', [MOVIMIENTO.BAJA]: '▼', [MOVIMIENTO.QUEDA]: '=' };

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-white">🔁 Continuidad</h2>
                <p className="text-gray-400 text-sm mt-1">Pilotos que vienen de {edicion.previousName || 'la edición anterior'}.</p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[[CONTINUIDAD.CONFIRMADA, 'Confirmaron', 'text-green-400'], [CONTINUIDAD.PENDIENTE, 'Pendientes', 'text-yellow-300'], [CONTINUIDAD.RECHAZADA, 'No continúan', 'text-red-400'], [CONTINUIDAD.CADUCADA, 'Baja por plazo', 'text-red-400']].map(([e, l, c]) => (
                    <div key={e} className="rounded-xl p-4 border border-white/10 bg-white/5 text-center">
                        <p className={`text-3xl font-bold ${c}`}>{cuenta(e)}</p>
                        <p className="text-gray-400 text-xs mt-1">{l}</p>
                    </div>
                ))}
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-5 space-y-4">
                <div className="flex flex-wrap items-end gap-3">
                    <label className="block">
                        <span className="text-sm text-gray-300">Plazo para confirmar (23:59 España)</span>
                        <input type="date" value={plazo} onChange={e => setPlazo(e.target.value)}
                            className="block mt-1 px-3 py-2 bg-white/10 border border-white/30 rounded-lg text-white text-sm" />
                    </label>
                    <button onClick={guardarPlazo} disabled={guardando || plazo === (edicion.continuityDeadline || '')}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm disabled:opacity-50">Guardar plazo</button>
                    <button onClick={copiarMensaje} className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm">
                        {copiado ? '✅ Copiado' : '📋 Copiar mensaje para WhatsApp'}
                    </button>
                </div>
                <p className="text-xs text-gray-400">
                    {cerrado
                        ? `Confirmaciones cerradas el ${edicion.continuityClosedFor}. Cambia el plazo para reabrirlas.`
                        : vencido
                            ? 'El plazo ya venció: se cerrará automáticamente en unos minutos, o ciérralo ahora.'
                            : edicion.continuityDeadline
                                ? 'Al vencer el plazo, quien no haya confirmado causa baja automáticamente y se avisa por Telegram.'
                                : 'Sin plazo: nadie causará baja automáticamente hasta que lo fijes.'}
                </p>
                <div className="flex flex-wrap gap-2">
                    <button onClick={() => aplicar(false)} disabled={guardando}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm disabled:opacity-50"
                        title="Los que confirmaron pasan a aprobados (para repartir divisiones) y los que dijeron que no, a baja">
                        Aplicar respuestas ahora
                    </button>
                    {!cerrado && (
                        <button onClick={() => aplicar(true)} disabled={guardando}
                            className="px-4 py-2 bg-red-700/80 hover:bg-red-700 text-white rounded-lg text-sm disabled:opacity-50">
                            Cerrar plazo ahora
                        </button>
                    )}
                </div>
                {mensaje && <p className="text-sm text-gray-200">{mensaje}</p>}
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="text-xs text-gray-400 border-b border-white/10 bg-white/5">
                            <tr>
                                <th className="text-left px-4 py-2.5">Piloto</th>
                                <th className="text-left px-4 py-2.5">Edición anterior</th>
                                <th className="text-left px-4 py-2.5">Esta edición</th>
                                <th className="text-left px-4 py-2.5">Estado</th>
                                <th className="text-left px-4 py-2.5">Corregir</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {veteranos.map(r => {
                                const e = estadoContinuidad(r, continuaciones);
                                const i = divsOrdenadas.length ? divisionDestino(r.carryover.divisionIndex ?? 0, r.carryover.movement, divsOrdenadas.length) : -1;
                                const quien = continuaciones[r.id]?.by;
                                return (
                                    <tr key={r.id}>
                                        <td className="px-4 py-2.5 text-white font-medium">{nombre(r)}</td>
                                        <td className="px-4 py-2.5 text-gray-300">{r.carryover.divisionName || '—'}{r.carryover.position ? ` · ${r.carryover.position}º` : ''}</td>
                                        <td className="px-4 py-2.5 text-gray-300">{flecha[r.carryover.movement]} {divsOrdenadas[i]?.name || '—'}</td>
                                        <td className="px-4 py-2.5">
                                            <span className={`text-xs px-2 py-0.5 rounded-full ${badge[e]}`}>{texto[e]}</span>
                                            {quien === 'admin' && <span className="text-[11px] text-gray-500 ml-1">(admin)</span>}
                                        </td>
                                        <td className="px-4 py-2.5">
                                            <div className="flex gap-1">
                                                <button disabled={guardando || e === CONTINUIDAD.CONFIRMADA} onClick={() => fijarRespuesta(r, CONTINUIDAD.CONFIRMADA)} className="px-2 py-1 text-xs rounded bg-green-600/30 hover:bg-green-600/50 text-green-200 disabled:opacity-30" title="Marcar como confirmado">✅</button>
                                                <button disabled={guardando || e === CONTINUIDAD.RECHAZADA} onClick={() => fijarRespuesta(r, CONTINUIDAD.RECHAZADA)} className="px-2 py-1 text-xs rounded bg-red-600/30 hover:bg-red-600/50 text-red-200 disabled:opacity-30" title="Marcar como que no continúa">🚪</button>
                                                <button disabled={guardando || e === CONTINUIDAD.PENDIENTE} onClick={() => fijarRespuesta(r, CONTINUIDAD.PENDIENTE)} className="px-2 py-1 text-xs rounded bg-white/10 hover:bg-white/20 text-gray-200 disabled:opacity-30" title="Volver a pendiente">↺</button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                {veteranos.length === 0 && <p className="p-4 text-gray-400 text-sm">No hay pilotos de la edición anterior.</p>}
            </div>
        </div>
    );
}
