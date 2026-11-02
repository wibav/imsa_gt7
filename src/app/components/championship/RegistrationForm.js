"use client";

import { useState } from 'react';
import { FirebaseService } from '../../services/firebaseService';
import { sendTelegramNotification } from '../../utils/telegram';
import { isRegulationsEmpty } from '../../utils/regulations';
import RegulationsPdfButton from './RegulationsPdfButton';
import SimilarPilotHint from '../common/SimilarPilotHint';
import { useI18n } from '../../i18n';

/**
 * Formulario público de inscripción a un campeonato.
 * Soporta dos modos:
 *  - Individual: campos por piloto (gt7Id, psnId, etc.)
 *  - Equipo: nombre de equipo + N bloques de piloto con categoría
 *
 * El modo equipo se activa cuando isTeamChampionship || isMultiCategory.
 */
export default function RegistrationForm({ championship, onClose, onSuccess }) {
    const { t, locale } = useI18n();
    const registration = championship.registration || {};
    const settings = championship.settings || {};
    const isTeamMode = !!(settings.isTeamChampionship || settings.isMultiCategory);
    const requiredCategories = settings.requiredCategoriesPerTeam || [];
    const driversPerTeam = settings.maxDriversPerTeam || 2;
    const fields = registration.fields || ['gt7Id', 'psnId'];

    // ── Estado modo individual ──
    const [formData, setFormData] = useState({
        gt7Id: '',
        psnId: '',
        experience: '',
        preferredCar: '',
        acceptedRules: false
    });

    // ── Estado modo equipo ──
    const [teamName, setTeamName] = useState('');
    const [teamDrivers, setTeamDrivers] = useState(
        Array.from({ length: driversPerTeam }, (_, i) => ({
            gt7Id: '',
            psnId: '',
            category: requiredCategories[i] || ''
        }))
    );

    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    // ── Handlers modo individual ──
    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    };

    // ── Handlers modo equipo ──
    const handleDriverChange = (idx, field, value) => {
        setTeamDrivers(prev => prev.map((d, i) => i === idx ? { ...d, [field]: value } : d));
    };

    // ── Validación modo equipo ──
    const validateTeam = () => {
        if (!teamName.trim()) return t('formularios.inscripcion.errNombreEquipo');

        for (let i = 0; i < teamDrivers.length; i++) {
            const d = teamDrivers[i];
            if (!d.gt7Id.trim()) return t('formularios.inscripcion.errGt7Piloto', { n: i + 1 });
        }

        if (requiredCategories.length > 0) {
            const usedCategories = teamDrivers.map(d => d.category).filter(Boolean);
            for (const cat of requiredCategories) {
                if (!usedCategories.includes(cat)) return t('formularios.inscripcion.errFaltaCategoria', { cat });
            }
            const dupes = usedCategories.filter((c, i) => usedCategories.indexOf(c) !== i);
            if (dupes.length > 0) return t('formularios.inscripcion.errCategoriaRepetida', { cat: dupes[0] });
        }

        if (registration.acceptRules && !formData.acceptedRules) return t('formularios.inscripcion.errReglamento');

        return null;
    };

    // ── Submit ──
    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (isTeamMode) {
            const teamError = validateTeam();
            if (teamError) { setError(teamError); return; }
        } else {
            if (fields.includes('gt7Id') && !formData.gt7Id.trim()) {
                setError(t('formularios.inscripcion.errGt7')); return;
            }
            if (registration.acceptRules && !formData.acceptedRules) {
                setError(t('formularios.inscripcion.errReglamento')); return;
            }
        }

        setSubmitting(true);
        try {
            // best-effort, no bloquea la inscripción si falla
            const org = championship.orgId
                ? await FirebaseService.getOrganization(championship.orgId).catch(() => null)
                : null;
            const orgTag = org?.name ? `🏢 ${org.name}\n` : '';

            if (isTeamMode) {
                const data = {
                    teamName: teamName.trim(),
                    drivers: teamDrivers.map(d => ({
                        gt7Id: d.gt7Id.trim(),
                        psnId: d.psnId.trim(),
                        category: d.category,
                        declaredCars: []
                    })),
                    ...(registration.acceptRules ? { acceptedRules: true, acceptedRulesAt: new Date().toISOString() } : {})
                };
                await FirebaseService.submitRegistration(championship.id, data);
                sendTelegramNotification(
                    `📋 <b>Nueva inscripción de equipo</b>\n` +
                    orgTag +
                    `🏆 ${championship.name}\n` +
                    `👥 ${data.teamName}\n` +
                    data.drivers.map(d => `🎮 ${d.gt7Id}${d.category ? ` (${d.category})` : ''}`).join('\n')
                );
            } else {
                const data = {};
                visibleFields.forEach(f => {
                    if (formData[f] !== undefined) data[f] = formData[f].trim ? formData[f].trim() : formData[f];
                });
                if (registration.acceptRules) {
                    data.acceptedRules = true;
                    data.acceptedRulesAt = new Date().toISOString();
                }
                await FirebaseService.submitRegistration(championship.id, data);
                const gt7Id = data.gt7Id || '?';
                const psnId = data.psnId ? ` (PSN: ${data.psnId})` : '';
                sendTelegramNotification(
                    `📋 <b>Nueva inscripción</b>\n${orgTag}🏆 ${championship.name}\n🎮 ${gt7Id}${psnId}`
                );
            }

            setSuccess(true);
            onSuccess?.();
        } catch (err) {
            setError(err.message || t('formularios.inscripcion.errEnviar'));
        } finally {
            setSubmitting(false);
        }
    };

    // ── Guards ──
    const isExpired = registration.deadline && new Date() > new Date(registration.deadline + 'T23:59:59');
    const approvedCount = (championship.registrations || []).filter(r => r.status === 'approved').length;
    const isFull = registration.maxParticipants > 0 && approvedCount >= registration.maxParticipants;

    if (isExpired) {
        return (
            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                <div className="bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 rounded-xl border border-white/30 shadow-2xl w-full max-w-md p-8 text-center">
                    <div className="text-5xl mb-4">⏰</div>
                    <h3 className="text-xl font-bold text-white mb-2">{t('formularios.inscripcion.plazoVencido')}</h3>
                    <p className="text-gray-300 mb-6">{t('formularios.inscripcion.plazoVencidoTexto')}</p>
                    <button onClick={onClose} className="px-6 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-all">{t('campeonato.cerrar')}</button>
                </div>
            </div>
        );
    }

    if (isFull) {
        return (
            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                <div className="bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 rounded-xl border border-white/30 shadow-2xl w-full max-w-md p-8 text-center">
                    <div className="text-5xl mb-4">🚫</div>
                    <h3 className="text-xl font-bold text-white mb-2">{t('formularios.inscripcion.cupoLleno')}</h3>
                    <p className="text-gray-300 mb-6">{t('formularios.inscripcion.cupoLlenoTexto')}</p>
                    <button onClick={onClose} className="px-6 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-all">{t('campeonato.cerrar')}</button>
                </div>
            </div>
        );
    }

    if (success) {
        return (
            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                <div className="bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 rounded-xl border border-white/30 shadow-2xl w-full max-w-md p-8 text-center">
                    <div className="text-5xl mb-4">✅</div>
                    <h3 className="text-xl font-bold text-white mb-2">
                        {registration.requiresApproval ? t('formularios.inscripcion.enviada') : t('formularios.inscripcion.confirmada')}
                    </h3>
                    <p className="text-gray-300 mb-4">
                        {registration.requiresApproval
                            ? t('formularios.inscripcion.revision')
                            : isTeamMode
                                ? t('formularios.inscripcion.equipoRegistrado')
                                : t('formularios.inscripcion.bienvenido')}
                    </p>

                    {/* Si el campeonato exige declarar autos, es un paso pendiente con
                        fecha límite que el piloto no tiene por qué descubrir solo: sin
                        este aviso la sección queda enterrada en la pestaña Información. */}
                    {championship.carUsageTracking?.enabled
                        && championship.carUsageTracking.mode !== 'fixed'
                        && (
                            <div className="mb-6 p-4 bg-orange-900/30 border border-orange-500/40 rounded-lg text-left">
                                <p className="text-orange-200 text-sm font-semibold mb-1">
                                    🚗 {t('formularios.inscripcion.faltaPaso')}
                                </p>
                                <p className="text-orange-100/80 text-xs">
                                    {t('formularios.inscripcion.limitaAutos', { n: championship.carUsageTracking.maxCarsPerDriver ?? 3 })}
                                    {' '}{championship.carUsageTracking.declarationDeadline
                                        ? t('formularios.inscripcion.tienesHasta', { fecha: new Date(championship.carUsageTracking.declarationDeadline + 'T23:59:59').toLocaleDateString(locale) })
                                        : t('formularios.inscripcion.declaraLosTuyos')}{' '}{t('formularios.inscripcion.enLaPestana')} <strong>{t('formularios.inscripcion.rutaUsoAutos')}</strong>.
                                </p>
                            </div>
                        )}
                    <button onClick={onClose}
                        className="px-6 py-2 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white rounded-lg transition-all font-bold">
                        {t('formularios.inscripcion.entendido')}
                    </button>
                </div>
            </div>
        );
    }

    // Configuración de campos individuales
    const fieldConfig = {
        gt7Id: { label: 'GT7 ID', type: 'text', placeholder: t('formularios.inscripcion.phGt7'), required: true },
        psnId: { label: 'PSN ID', type: 'text', placeholder: t('formularios.inscripcion.phPsn') },
        country: { label: t('formularios.inscripcion.pais'), type: 'text', placeholder: t('formularios.inscripcion.phPais') },
        experience: {
            label: t('formularios.inscripcion.experiencia'), type: 'select', options: [
                { value: '', label: t('formularios.inscripcion.selecciona') },
                { value: 'beginner', label: t('formularios.inscripcion.principiante') },
                { value: 'intermediate', label: t('formularios.inscripcion.intermedio') },
                { value: 'advanced', label: t('formularios.inscripcion.avanzado') },
                { value: 'pro', label: t('formularios.inscripcion.profesional') }
            ]
        },
        preferredCar: { label: t('formularios.inscripcion.autoPreferido'), type: 'text', placeholder: t('formularios.inscripcion.phAuto') }
    };
    const visibleFields = fields.includes('gt7Id') ? fields : ['gt7Id', ...fields];

    // Categorías disponibles para el selector (todas las del campeonato)
    const allCategories = championship.categories || [];
    const hasRegulations = !isRegulationsEmpty(championship.regulations, championship.regulationsFormat);

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 rounded-xl border border-white/30 shadow-2xl w-full max-w-lg my-4">
                {/* Header */}
                <div className="p-6 border-b border-white/20">
                    <div className="flex justify-between items-center">
                        <div>
                            <h3 className="text-2xl font-bold text-white">
                                {isTeamMode ? `👥 ${t('formularios.inscripcion.tituloEquipo')}` : `📝 ${t('formularios.inscripcion.titulo')}`}
                            </h3>
                            <p className="text-gray-300 text-sm mt-1">{championship.name}</p>
                        </div>
                        <button onClick={onClose} className="text-white hover:text-red-400 text-3xl transition-colors">&times;</button>
                    </div>

                    {/* Info bar */}
                    <div className="flex flex-wrap gap-3 mt-4 text-sm">
                        {registration.maxParticipants > 0 && (
                            <span className="px-3 py-1 bg-blue-600/30 border border-blue-400/50 text-blue-200 rounded-full">
                                👥 {t('formularios.inscripcion.cupos', { a: approvedCount, total: registration.maxParticipants })}
                            </span>
                        )}
                        {registration.deadline && (
                            <span className="px-3 py-1 bg-orange-600/30 border border-orange-400/50 text-orange-200 rounded-full">
                                📅 {t('campeonato.inscripcion.hasta', { fecha: new Date(registration.deadline).toLocaleDateString(locale) })}
                            </span>
                        )}
                        {registration.requiresApproval && (
                            <span className="px-3 py-1 bg-yellow-600/30 border border-yellow-400/50 text-yellow-200 rounded-full">
                                ⏳ {t('formularios.inscripcion.requiereAprobacion')}
                            </span>
                        )}
                        {isTeamMode && requiredCategories.length > 0 && (
                            <span className="px-3 py-1 bg-purple-600/30 border border-purple-400/50 text-purple-200 rounded-full">
                                🏁 {requiredCategories.join(' + ')}
                            </span>
                        )}
                    </div>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    {error && (
                        <div className="bg-red-500/20 border border-red-400/50 text-red-200 p-3 rounded-lg text-sm">
                            ❌ {error}
                        </div>
                    )}

                    {isTeamMode ? (
                        /* ── Modo equipo ── */
                        <>
                            {/* Nombre del equipo */}
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    {t('formularios.inscripcion.nombreEquipo')} <span className="text-red-400">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={teamName}
                                    onChange={e => setTeamName(e.target.value)}
                                    placeholder={t('formularios.inscripcion.phEquipo')}
                                    className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
                                />
                            </div>

                            {/* Bloques de piloto */}
                            {teamDrivers.map((driver, idx) => (
                                <div key={idx} className="border border-white/20 rounded-xl p-4 bg-white/5 space-y-3">
                                    <h4 className="text-sm font-bold text-orange-300 uppercase tracking-wide">
                                        {t('formularios.inscripcion.piloto', { n: idx + 1 })}
                                        {driver.category && (
                                            <span className="ml-2 px-2 py-0.5 bg-orange-600/30 rounded-full text-orange-200 text-xs normal-case">
                                                {driver.category}
                                            </span>
                                        )}
                                    </h4>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs text-gray-400 mb-1">
                                                GT7 ID <span className="text-red-400">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                value={driver.gt7Id}
                                                onChange={e => handleDriverChange(idx, 'gt7Id', e.target.value)}
                                                placeholder={t('formularios.inscripcion.phGt7Corto')}
                                                className="w-full px-3 py-2 bg-white/10 border border-white/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
                                            />
                                            <SimilarPilotHint
                                                value={driver.gt7Id}
                                                onUsar={n => handleDriverChange(idx, 'gt7Id', n)}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-gray-400 mb-1">PSN ID</label>
                                            <input
                                                type="text"
                                                value={driver.psnId}
                                                onChange={e => handleDriverChange(idx, 'psnId', e.target.value)}
                                                placeholder={t('formularios.inscripcion.phPsnCorto')}
                                                className="w-full px-3 py-2 bg-white/10 border border-white/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
                                            />
                                        </div>
                                    </div>

                                    {/* Selector de categoría */}
                                    {allCategories.length > 0 && (
                                        <div>
                                            <label className="block text-xs text-gray-400 mb-1">
                                                {t('formularios.inscripcion.categoria')} {requiredCategories.length > 0 && <span className="text-red-400">*</span>}
                                            </label>
                                            <select
                                                value={driver.category}
                                                onChange={e => handleDriverChange(idx, 'category', e.target.value)}
                                                className="w-full px-3 py-2 bg-white/10 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
                                            >
                                                <option value="" className="bg-slate-800">{t('formularios.inscripcion.seleccionarCategoria')}</option>
                                                {allCategories.map(cat => (
                                                    <option
                                                        key={cat}
                                                        value={cat}
                                                        className="bg-slate-800"
                                                        disabled={
                                                            requiredCategories.length > 0 &&
                                                            teamDrivers.some((d, i) => i !== idx && d.category === cat)
                                                        }
                                                    >
                                                        {cat}{teamDrivers.some((d, i) => i !== idx && d.category === cat) ? ` (${t('formularios.inscripcion.yaAsignada')})` : ''}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    )}
                                </div>
                            ))}

                            {/* Hint de categorías requeridas */}
                            {requiredCategories.length > 0 && (
                                <p className="text-xs text-gray-400">
                                    ℹ️ {t('formularios.inscripcion.unoPorCategoria')}: <strong className="text-gray-200">{requiredCategories.join(', ')}</strong>
                                </p>
                            )}
                        </>
                    ) : (
                        /* ── Modo individual ── */
                        <>
                            {visibleFields.map(fieldKey => {
                                const config = fieldConfig[fieldKey];
                                if (!config) return null;

                                if (config.type === 'select') {
                                    return (
                                        <div key={fieldKey}>
                                            <label className="block text-sm font-medium text-gray-300 mb-2">{config.label}</label>
                                            <select
                                                name={fieldKey}
                                                value={formData[fieldKey]}
                                                onChange={handleChange}
                                                className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500">
                                                {config.options.map(opt => (
                                                    <option key={opt.value} value={opt.value} className="bg-slate-800">{opt.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                    );
                                }

                                return (
                                    <div key={fieldKey}>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">
                                            {config.label} {config.required && <span className="text-red-400">*</span>}
                                        </label>
                                        <input
                                            type={config.type}
                                            name={fieldKey}
                                            value={formData[fieldKey]}
                                            onChange={handleChange}
                                            required={config.required}
                                            placeholder={config.placeholder}
                                            className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500" />
                                        {fieldKey === 'gt7Id' && (
                                            <SimilarPilotHint
                                                value={formData.gt7Id}
                                                onUsar={n => setFormData(prev => ({ ...prev, gt7Id: n }))}
                                            />
                                        )}
                                    </div>
                                );
                            })}
                        </>
                    )}

                    {/* Aceptar reglamento */}
                    {registration.acceptRules && (
                        <div className="space-y-2">
                            <label className="flex items-start gap-3 p-3 bg-white/5 border border-white/10 rounded-lg cursor-pointer hover:bg-white/10 transition-all">
                                <input
                                    type="checkbox"
                                    name="acceptedRules"
                                    checked={formData.acceptedRules}
                                    onChange={handleChange}
                                    className="mt-1 w-4 h-4 accent-orange-500" />
                                <span className="text-sm text-gray-300">
                                    {t('formularios.inscripcion.heLeido')}{' '}
                                    {hasRegulations ? (
                                        <a
                                            href={`/championships/?id=${championship.id}#reglamento`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            onClick={e => e.stopPropagation()}
                                            className="text-orange-400 font-medium underline hover:text-orange-300"
                                        >
                                            {t('formularios.inscripcion.reglamentoCampeonato')}
                                        </a>
                                    ) : (
                                        <span className="text-orange-400 font-medium">{t('formularios.inscripcion.reglamentoCampeonato')}</span>
                                    )}
                                    {' '}{t('formularios.inscripcion.meComprometo')}
                                </span>
                            </label>
                            {hasRegulations && (
                                <RegulationsPdfButton championship={championship} compact />
                            )}
                        </div>
                    )}

                    {/* Submit */}
                    <div className="flex gap-3 pt-2">
                        <button type="button" onClick={onClose}
                            className="flex-1 px-4 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-all font-medium">
                            {t('formularios.inscripcion.cancelar')}
                        </button>
                        <button type="submit" disabled={submitting}
                            className="flex-1 px-4 py-3 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white rounded-lg transition-all font-bold disabled:opacity-50">
                            {submitting ? t('formularios.inscripcion.enviando') : isTeamMode ? `👥 ${t('formularios.inscripcion.inscribirEquipo')}` : `🏁 ${t('campeonato.inscripcion.inscribirme')}`}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
