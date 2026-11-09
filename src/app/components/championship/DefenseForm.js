"use client";
import { useState } from 'react';
import { FirebaseService } from '../../services/firebaseService';
import { notifyDefenseCreated } from '../../utils/telegram';
import { useI18n } from '../../i18n';
import {
    PLAZO_DESCARGO_HORAS, DESCARGO_MIN, DESCARGO_MAX, plazoDescargo, acusadosSinDescargo,
} from '../../utils/descargo';

/**
 * Modal público para que el piloto acusado presente su descargo antes de que
 * los comisarios resuelvan (reglamento general, 6.6.3 y 8.3.1). Hermano de
 * AppealForm.js: sin sesión, un descargo por piloto y reclamación.
 */
export default function DefenseForm({ championshipId, championship, claim, defenses = [], onClose, onSubmitted }) {
    const { t, locale } = useI18n();
    const de = (clave, vars) => t(`formularios.descargo.${clave}`, vars);
    const plazo = plazoDescargo(claim);
    const pendientes = acusadosSinDescargo(claim, defenses);

    const [accusedName, setAccusedName] = useState(pendientes[0] || '');
    const [text, setText] = useState('');
    const [evidenceInput, setEvidenceInput] = useState('');
    const [evidence, setEvidence] = useState([]);
    const [saving, setSaving] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [errors, setErrors] = useState([]);

    const handleAddEvidence = () => {
        const url = evidenceInput.trim();
        if (!url) return;
        if (!url.startsWith('http')) { setErrors([de('errUrl')]); return; }
        if (!evidence.includes(url)) setEvidence(prev => [...prev, url]);
        setEvidenceInput('');
        setErrors([]);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const errs = [];
        if (!accusedName) errs.push(de('errQuien'));
        if (text.trim().length < DESCARGO_MIN) errs.push(de('errMin', { n: DESCARGO_MIN }));
        if (text.length > DESCARGO_MAX) errs.push(de('errMax', { n: DESCARGO_MAX }));
        if (!plazoDescargo(claim).abierto) errs.push(de('errPlazo'));
        // Un enlace escrito pero sin pulsar «Agregar» también se envía
        const pendiente = evidenceInput.trim();
        if (pendiente && !pendiente.startsWith('http')) errs.push(de('errUrl'));
        if (errs.length > 0) { setErrors(errs); return; }
        const evidenciaFinal = pendiente && !evidence.includes(pendiente) ? [...evidence, pendiente] : evidence;

        setSaving(true);
        try {
            await FirebaseService.createDefense(championshipId, {
                claimId: claim.id,
                accusedName,
                text: text.trim(),
                evidence: evidenciaFinal,
            });
            const org = championship?.orgId
                ? await FirebaseService.getOrganization(championship.orgId).catch(() => null)
                : null;
            notifyDefenseCreated({
                championshipName: championship?.name || championshipId,
                accusedName,
                reporterName: claim.reporterName,
                trackName: claim.trackName,
                text: text.trim(),
                orgName: org?.name,
            });
            setSubmitted(true);
            if (onSubmitted) onSubmitted();
        } catch (error) {
            setErrors([`❌ ${t('formularios.reclamacion.errEnviar')}: ${error.message}`]);
        } finally {
            setSaving(false);
        }
    };

    if (submitted) {
        return (
            <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
                <div className="bg-slate-800 rounded-2xl border border-white/20 w-full max-w-md p-8 text-center">
                    <div className="text-5xl mb-4">✅</div>
                    <h3 className="text-xl font-bold text-white mb-2">{de('enviado')}</h3>
                    <p className="text-gray-400 text-sm mb-6">{de('enviadoTexto')}</p>
                    <button onClick={onClose} className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-all">
                        {t('campeonato.cerrar')}
                    </button>
                </div>
            </div>
        );
    }

    const horasRestantes = plazo.vence ? Math.max(0, Math.floor((plazo.vence - Date.now()) / 3600000)) : 0;

    return (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
            <div className="bg-slate-800 rounded-2xl border border-white/20 w-full max-w-lg max-h-[90vh] overflow-y-auto">
                <div className="p-6 border-b border-white/10">
                    <div className="flex justify-between items-center">
                        <h3 className="text-xl font-bold text-white">🛡️ {de('titulo')}</h3>
                        <button onClick={onClose} aria-label={t('campeonato.cerrar')} className="text-gray-400 hover:text-white text-2xl">✕</button>
                    </div>
                    <p className="text-gray-400 text-sm mt-1">
                        {plazo.abierto
                            ? de('quedan', { h: horasRestantes, plazo: PLAZO_DESCARGO_HORAS })
                            : plazo.vence ? de('vencio', { fecha: plazo.vence.toLocaleString(locale) }) : de('noPosible')}
                    </p>
                </div>

                {!plazo.abierto || pendientes.length === 0 ? (
                    <div className="p-6 text-center">
                        <div className="text-4xl mb-3">⏰</div>
                        <p className="text-gray-300 font-medium">{de('noPosible')}</p>
                        <button onClick={onClose} className="mt-4 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all">
                            {t('campeonato.cerrar')}
                        </button>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="p-6 space-y-4">
                        {errors.length > 0 && (
                            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3" role="alert">
                                {errors.map((err, i) => <p key={i} className="text-red-400 text-sm">• {err}</p>)}
                            </div>
                        )}

                        <div className="bg-white/5 border border-white/10 rounded-lg p-3 text-sm">
                            <p className="text-white font-semibold">{claim.reporterName} → {(claim.accusedNames?.length ? claim.accusedNames : [claim.accusedName]).join(', ')}</p>
                            {claim.trackName && <p className="text-gray-400 text-xs mt-0.5">🏁 R{claim.round} - {claim.trackName}{claim.lap && ` • ${t('campeonato.vuelta', { n: claim.lap })}`}</p>}
                            <p className="text-gray-300 text-xs mt-1">{claim.description}</p>
                        </div>

                        <div>
                            <label htmlFor="descargo-quien" className="text-gray-400 text-sm block mb-1">{de('quien')} *</label>
                            <select
                                id="descargo-quien"
                                value={accusedName}
                                onChange={e => setAccusedName(e.target.value)}
                                className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm"
                            >
                                {pendientes.map(name => (
                                    <option key={name} value={name} className="bg-slate-800">{name}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label htmlFor="descargo-texto" className="text-gray-400 text-sm block mb-1">{de('version')} *</label>
                            <textarea
                                id="descargo-texto"
                                value={text}
                                onChange={e => { setText(e.target.value); setErrors([]); }}
                                className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm h-32 resize-none"
                                placeholder={de('phVersion')}
                                maxLength={DESCARGO_MAX}
                                required
                            />
                            <p className="text-gray-500 text-xs mt-1">{de('caracteres', { a: text.length, max: DESCARGO_MAX, min: DESCARGO_MIN })}</p>
                        </div>

                        <div>
                            <label htmlFor="descargo-video" className="text-gray-400 text-sm block mb-1">{de('evidencia')}</label>
                            {evidence.length > 0 && (
                                <ul className="space-y-1 mb-2">
                                    {evidence.map(url => (
                                        <li key={url} className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5">
                                            <span className="text-blue-300 text-xs truncate flex-1">{url}</span>
                                            <button type="button" onClick={() => setEvidence(prev => prev.filter(u => u !== url))}
                                                className="text-gray-400 hover:text-red-400 leading-none">×</button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                            <div className="flex gap-2">
                                <input
                                    id="descargo-video"
                                    type="url"
                                    value={evidenceInput}
                                    onChange={e => setEvidenceInput(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddEvidence(); } }}
                                    className="flex-1 bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm"
                                    placeholder="https://youtube.com/watch?v=..."
                                />
                                <button type="button" onClick={handleAddEvidence} disabled={!evidenceInput.trim()}
                                    className="px-3 py-2 bg-orange-600 hover:bg-orange-700 disabled:opacity-40 text-white text-sm rounded-lg transition-all">
                                    + {t('formularios.declaracion.agregar')}
                                </button>
                            </div>
                            <p className="text-gray-500 text-xs mt-1">{t('formularios.reclamacion.youtubeOculto')}</p>
                        </div>

                        <p className="text-gray-400 text-xs">{de('aviso')}</p>

                        <div className="flex gap-3 justify-end pt-2">
                            <button type="button" onClick={onClose} className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all">
                                {t('formularios.inscripcion.cancelar')}
                            </button>
                            <button type="submit" disabled={saving}
                                className="px-6 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-bold transition-all disabled:opacity-50">
                                {saving ? `⏳ ${t('formularios.inscripcion.enviando')}` : `🛡️ ${de('enviar')}`}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
