"use client";
import { useState } from 'react';
import { FirebaseService } from '../../services/firebaseService';
import { notifyAppealCreated } from '../../utils/telegram';

const REASON_MIN = 10;
const REASON_MAX = 4000;

/**
 * Calcula el estado del plazo de alegación sobre una reclamación resuelta.
 * CA-3.5/E3.8: se usa el timestamp ISO COMPLETO de `resolvedAt` (no una
 * fecha sin hora, D3.4) y el borde es `<=` admisible, `>` no.
 * E3.9: si `resolvedAt` falta o es inválido, la alegación NO se ofrece
 * (fail-closed) — nunca se usa `createdAt` como sustituto silencioso.
 */
export function getAppealWindowStatus(claim, appealWindowHours) {
    if (!claim?.resolvedAt) return { claimable: false, reason: 'no-resolved-at' };
    const resolvedAt = new Date(claim.resolvedAt);
    if (isNaN(resolvedAt.getTime())) return { claimable: false, reason: 'invalid-date' };
    const deadline = new Date(resolvedAt.getTime() + appealWindowHours * 60 * 60 * 1000);
    const diffHours = (Date.now() - resolvedAt.getTime()) / (1000 * 60 * 60);
    const claimable = diffHours >= 0 && diffHours <= appealWindowHours;
    return { claimable, deadline, hoursRemaining: Math.max(0, appealWindowHours - diffHours) };
}

/** Legitimación (CA-3.1): quién puede alegar según el resultado de la reclamación. */
export function getEligibleAppellants(claim) {
    if (!claim) return [];
    if (claim.status === 'accepted') {
        return claim.accusedNames?.length > 0 ? claim.accusedNames : (claim.accusedName ? [claim.accusedName] : []);
    }
    if (claim.status === 'rejected') {
        return claim.reporterName ? [claim.reporterName] : [];
    }
    return [];
}

/**
 * Modal público para que un piloto presente una alegación (apelación) sobre
 * la resolución de una reclamación. Hermano de ClaimForm.js.
 */
export default function AppealForm({ championshipId, championship, claim, existingAppeals = [], appealWindowHours, onClose, onSubmitted }) {
    const eligible = getEligibleAppellants(claim);
    const windowStatus = getAppealWindowStatus(claim, appealWindowHours);

    const [appellantName, setAppellantName] = useState(eligible[0] || '');
    const [reason, setReason] = useState('');
    const [evidenceInput, setEvidenceInput] = useState('');
    const [evidence, setEvidence] = useState([]);
    const [saving, setSaving] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [errors, setErrors] = useState([]);

    // CA-3.2: una sola alegación por parte y reclamación.
    const alreadyAppealed = existingAppeals.find(
        a => a.claimId === claim?.id && a.appellantName === appellantName
    );

    const handleAddEvidence = () => {
        const url = evidenceInput.trim();
        if (!url) return;
        // E3.13: misma defensa que ya existe para evidencia de reclamaciones/sanciones.
        if (!url.startsWith('http')) {
            setErrors(['La URL de evidencia debe empezar con http:// o https://']);
            return;
        }
        if (evidence.includes(url)) return;
        setEvidence(prev => [...prev, url]);
        setEvidenceInput('');
        setErrors([]);
    };

    const removeEvidence = (url) => setEvidence(prev => prev.filter(u => u !== url));

    const handleSubmit = async (e) => {
        e.preventDefault();
        const errs = [];
        if (!appellantName) errs.push('Selecciona quién alega');
        if (alreadyAppealed) errs.push(`Ya existe una alegación de ${appellantName} sobre esta reclamación (estado: ${alreadyAppealed.status})`);
        if (!reason.trim() || reason.trim().length < REASON_MIN) errs.push(`El motivo debe tener al menos ${REASON_MIN} caracteres`);
        if (reason.length > REASON_MAX) errs.push(`El motivo no puede superar los ${REASON_MAX} caracteres`);
        if (!windowStatus.claimable) errs.push('El plazo para alegar sobre esta reclamación ya venció o no puede calcularse');
        if (errs.length > 0) { setErrors(errs); return; }

        setSaving(true);
        try {
            await FirebaseService.createAppeal(championshipId, {
                claimId: claim.id,
                penaltyId: claim.penaltyId || null,
                appellantName,
                appellantRole: claim.status === 'accepted' ? 'accused' : 'reporter',
                reason: reason.trim(),
                evidence,
            });
            const org = championship?.orgId
                ? await FirebaseService.getOrganization(championship.orgId).catch(() => null)
                : null;
            notifyAppealCreated({
                championshipName: championship?.name || championshipId,
                appellantName,
                reason: reason.trim(),
                orgName: org?.name,
            });
            setSubmitted(true);
            if (onSubmitted) onSubmitted();
        } catch (error) {
            setErrors(['❌ Error al enviar: ' + error.message]);
        } finally {
            setSaving(false);
        }
    };

    if (submitted) {
        return (
            <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
                <div className="bg-slate-800 rounded-2xl border border-white/20 w-full max-w-md p-8 text-center">
                    <div className="text-5xl mb-4">✅</div>
                    <h3 className="text-xl font-bold text-white mb-2">Alegación Enviada</h3>
                    <p className="text-gray-400 text-sm mb-6">
                        Tu alegación fue registrada. La sanción original sigue aplicándose mientras se revisa.
                        Consulta esta misma sección para ver la resolución cuando esté disponible.
                    </p>
                    <button onClick={onClose} className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-all">
                        Cerrar
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
            <div className="bg-slate-800 rounded-2xl border border-white/20 w-full max-w-lg max-h-[90vh] overflow-y-auto">
                <div className="p-6 border-b border-white/10">
                    <div className="flex justify-between items-center">
                        <h3 className="text-xl font-bold text-white">⚖️ Alegar contra la resolución</h3>
                        <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl">✕</button>
                    </div>
                    <p className="text-gray-400 text-sm mt-1">
                        {windowStatus.claimable
                            ? `Quedan ${Math.floor(windowStatus.hoursRemaining)} h para alegar (plazo: ${appealWindowHours} h desde la resolución)`
                            : windowStatus.deadline
                                ? `El plazo venció el ${windowStatus.deadline.toLocaleString('es-ES')}`
                                : 'El plazo para alegar no puede calcularse para esta reclamación'}
                    </p>
                </div>

                {!windowStatus.claimable || eligible.length === 0 ? (
                    <div className="p-6 text-center">
                        <div className="text-4xl mb-3">⏰</div>
                        <p className="text-gray-300 font-medium">No es posible alegar sobre esta reclamación</p>
                        <button onClick={onClose} className="mt-4 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all">
                            Cerrar
                        </button>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="p-6 space-y-4">
                        {errors.length > 0 && (
                            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                                {errors.map((err, i) => <p key={i} className="text-red-400 text-sm">• {err}</p>)}
                            </div>
                        )}

                        <div>
                            <label className="text-gray-400 text-sm block mb-1">¿Quién alega? *</label>
                            <select
                                value={appellantName}
                                onChange={e => setAppellantName(e.target.value)}
                                className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm"
                            >
                                {eligible.map(name => (
                                    <option key={name} value={name} className="bg-slate-800">{name}</option>
                                ))}
                            </select>
                            {alreadyAppealed && (
                                <p className="text-yellow-400 text-xs mt-1">
                                    Ya existe una alegación de {appellantName} — estado: {alreadyAppealed.status}
                                </p>
                            )}
                        </div>

                        <div>
                            <label className="text-gray-400 text-sm block mb-1">Motivo de la alegación *</label>
                            <textarea
                                value={reason}
                                onChange={e => { setReason(e.target.value); setErrors([]); }}
                                className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm h-28 resize-none"
                                placeholder="Explica por qué consideras que la resolución debe revisarse..."
                                required
                            />
                            <p className="text-gray-600 text-xs mt-1">{reason.length}/{REASON_MAX} caracteres (mínimo {REASON_MIN})</p>
                        </div>

                        <div>
                            <label className="text-gray-400 text-sm block mb-1">Evidencia adicional (opcional)</label>
                            {evidence.length > 0 && (
                                <ul className="space-y-1 mb-2">
                                    {evidence.map(url => (
                                        <li key={url} className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5">
                                            <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-300 text-xs truncate flex-1">{url}</a>
                                            <button type="button" onClick={() => removeEvidence(url)} className="text-gray-400 hover:text-red-400 leading-none">×</button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                            <div className="flex gap-2">
                                <input
                                    type="url"
                                    value={evidenceInput}
                                    onChange={e => setEvidenceInput(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddEvidence(); } }}
                                    className="flex-1 bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm"
                                    placeholder="https://..."
                                />
                                <button type="button" onClick={handleAddEvidence} disabled={!evidenceInput.trim()}
                                    className="px-3 py-2 bg-orange-600 hover:bg-orange-700 disabled:opacity-40 text-white text-sm rounded-lg transition-all">
                                    + Agregar
                                </button>
                            </div>
                        </div>

                        <div className="flex gap-3 justify-end pt-2">
                            <button type="button" onClick={onClose} className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all">
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                disabled={saving || Boolean(alreadyAppealed)}
                                className="px-6 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-bold transition-all disabled:opacity-50"
                            >
                                {saving ? '⏳ Enviando...' : '⚖️ Enviar Alegación'}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
