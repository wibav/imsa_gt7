"use client";

import { useState } from 'react';
import { FirebaseService } from '../../services/firebaseService';
import { sendTelegramNotification } from '../../utils/telegram';

/**
 * Formulario público de inscripción a un campeonato.
 * Soporta dos modos:
 *  - Individual: campos por piloto (gt7Id, psnId, etc.)
 *  - Equipo: nombre de equipo + N bloques de piloto con categoría
 *
 * El modo equipo se activa cuando isTeamChampionship || isMultiCategory.
 */
export default function RegistrationForm({ championship, onClose, onSuccess }) {
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
        if (!teamName.trim()) return 'El nombre del equipo es obligatorio';

        for (let i = 0; i < teamDrivers.length; i++) {
            const d = teamDrivers[i];
            if (!d.gt7Id.trim()) return `GT7 ID del Piloto ${i + 1} es obligatorio`;
        }

        if (requiredCategories.length > 0) {
            const usedCategories = teamDrivers.map(d => d.category).filter(Boolean);
            for (const cat of requiredCategories) {
                if (!usedCategories.includes(cat)) return `Falta un piloto en la categoría ${cat}`;
            }
            const dupes = usedCategories.filter((c, i) => usedCategories.indexOf(c) !== i);
            if (dupes.length > 0) return `La categoría "${dupes[0]}" está asignada a más de un piloto`;
        }

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
                setError('El GT7 ID es obligatorio'); return;
            }
            if (registration.acceptRules && !formData.acceptedRules) {
                setError('Debes aceptar el reglamento del campeonato'); return;
            }
        }

        setSubmitting(true);
        try {
            if (isTeamMode) {
                const data = {
                    teamName: teamName.trim(),
                    drivers: teamDrivers.map(d => ({
                        gt7Id: d.gt7Id.trim(),
                        psnId: d.psnId.trim(),
                        category: d.category,
                        declaredCars: []
                    }))
                };
                await FirebaseService.submitRegistration(championship.id, data);
                sendTelegramNotification(
                    `📋 <b>Nueva inscripción de equipo</b>\n` +
                    `🏆 ${championship.name}\n` +
                    `👥 ${data.teamName}\n` +
                    data.drivers.map(d => `🎮 ${d.gt7Id}${d.category ? ` (${d.category})` : ''}`).join('\n')
                );
            } else {
                const data = {};
                visibleFields.forEach(f => {
                    if (formData[f] !== undefined) data[f] = formData[f].trim ? formData[f].trim() : formData[f];
                });
                await FirebaseService.submitRegistration(championship.id, data);
                const gt7Id = data.gt7Id || '?';
                const psnId = data.psnId ? ` (PSN: ${data.psnId})` : '';
                sendTelegramNotification(
                    `📋 <b>Nueva inscripción</b>\n🏆 ${championship.name}\n🎮 ${gt7Id}${psnId}`
                );
            }

            setSuccess(true);
            onSuccess?.();
        } catch (err) {
            setError(err.message || 'Error al enviar la inscripción');
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
                    <h3 className="text-xl font-bold text-white mb-2">Plazo vencido</h3>
                    <p className="text-gray-300 mb-6">El plazo de inscripción para este campeonato ha finalizado.</p>
                    <button onClick={onClose} className="px-6 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-all">Cerrar</button>
                </div>
            </div>
        );
    }

    if (isFull) {
        return (
            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                <div className="bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 rounded-xl border border-white/30 shadow-2xl w-full max-w-md p-8 text-center">
                    <div className="text-5xl mb-4">🚫</div>
                    <h3 className="text-xl font-bold text-white mb-2">Cupo lleno</h3>
                    <p className="text-gray-300 mb-6">Se ha alcanzado el número máximo de participantes.</p>
                    <button onClick={onClose} className="px-6 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-all">Cerrar</button>
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
                        {registration.requiresApproval ? '¡Inscripción enviada!' : '¡Inscripción confirmada!'}
                    </h3>
                    <p className="text-gray-300 mb-6">
                        {registration.requiresApproval
                            ? 'Tu solicitud será revisada por los administradores. Te notificaremos cuando sea aprobada.'
                            : isTeamMode
                                ? '¡El equipo está registrado! Ya pueden participar en el campeonato.'
                                : '¡Bienvenido al campeonato! Ya estás registrado.'}
                    </p>
                    <button onClick={onClose}
                        className="px-6 py-2 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white rounded-lg transition-all font-bold">
                        Entendido
                    </button>
                </div>
            </div>
        );
    }

    // Configuración de campos individuales
    const fieldConfig = {
        gt7Id: { label: 'GT7 ID', type: 'text', placeholder: 'Tu GT7 ID (nombre en el juego)', required: true },
        psnId: { label: 'PSN ID', type: 'text', placeholder: 'Tu ID de PlayStation Network' },
        country: { label: 'País', type: 'text', placeholder: 'Ej: Guatemala, México...' },
        experience: {
            label: 'Experiencia', type: 'select', options: [
                { value: '', label: 'Selecciona...' },
                { value: 'beginner', label: 'Principiante' },
                { value: 'intermediate', label: 'Intermedio' },
                { value: 'advanced', label: 'Avanzado' },
                { value: 'pro', label: 'Profesional' }
            ]
        },
        preferredCar: { label: 'Auto preferido', type: 'text', placeholder: 'Ej: Toyota GR Supra, Mazda RX-Vision...' }
    };
    const visibleFields = fields.includes('gt7Id') ? fields : ['gt7Id', ...fields];

    // Categorías disponibles para el selector (todas las del campeonato)
    const allCategories = championship.categories || [];

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 rounded-xl border border-white/30 shadow-2xl w-full max-w-lg my-4">
                {/* Header */}
                <div className="p-6 border-b border-white/20">
                    <div className="flex justify-between items-center">
                        <div>
                            <h3 className="text-2xl font-bold text-white">
                                {isTeamMode ? '👥 Inscripción de Equipo' : '📝 Inscripción'}
                            </h3>
                            <p className="text-gray-300 text-sm mt-1">{championship.name}</p>
                        </div>
                        <button onClick={onClose} className="text-white hover:text-red-400 text-3xl transition-colors">&times;</button>
                    </div>

                    {/* Info bar */}
                    <div className="flex flex-wrap gap-3 mt-4 text-sm">
                        {registration.maxParticipants > 0 && (
                            <span className="px-3 py-1 bg-blue-600/30 border border-blue-400/50 text-blue-200 rounded-full">
                                👥 {approvedCount}/{registration.maxParticipants} cupos
                            </span>
                        )}
                        {registration.deadline && (
                            <span className="px-3 py-1 bg-orange-600/30 border border-orange-400/50 text-orange-200 rounded-full">
                                📅 Hasta {new Date(registration.deadline).toLocaleDateString('es-ES')}
                            </span>
                        )}
                        {registration.requiresApproval && (
                            <span className="px-3 py-1 bg-yellow-600/30 border border-yellow-400/50 text-yellow-200 rounded-full">
                                ⏳ Requiere aprobación
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
                                    Nombre del Equipo <span className="text-red-400">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={teamName}
                                    onChange={e => setTeamName(e.target.value)}
                                    placeholder="Ej: Velocidad Total Racing"
                                    className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
                                />
                            </div>

                            {/* Bloques de piloto */}
                            {teamDrivers.map((driver, idx) => (
                                <div key={idx} className="border border-white/20 rounded-xl p-4 bg-white/5 space-y-3">
                                    <h4 className="text-sm font-bold text-orange-300 uppercase tracking-wide">
                                        Piloto {idx + 1}
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
                                                placeholder="GT7 ID en el juego"
                                                className="w-full px-3 py-2 bg-white/10 border border-white/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-gray-400 mb-1">PSN ID</label>
                                            <input
                                                type="text"
                                                value={driver.psnId}
                                                onChange={e => handleDriverChange(idx, 'psnId', e.target.value)}
                                                placeholder="ID de PlayStation"
                                                className="w-full px-3 py-2 bg-white/10 border border-white/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
                                            />
                                        </div>
                                    </div>

                                    {/* Selector de categoría */}
                                    {allCategories.length > 0 && (
                                        <div>
                                            <label className="block text-xs text-gray-400 mb-1">
                                                Categoría {requiredCategories.length > 0 && <span className="text-red-400">*</span>}
                                            </label>
                                            <select
                                                value={driver.category}
                                                onChange={e => handleDriverChange(idx, 'category', e.target.value)}
                                                className="w-full px-3 py-2 bg-white/10 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
                                            >
                                                <option value="" className="bg-slate-800">Seleccionar categoría...</option>
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
                                                        {cat}{teamDrivers.some((d, i) => i !== idx && d.category === cat) ? ' (ya asignada)' : ''}
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
                                    ℹ️ Este campeonato requiere un piloto por categoría: <strong className="text-gray-200">{requiredCategories.join(', ')}</strong>
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
                                    </div>
                                );
                            })}
                        </>
                    )}

                    {/* Aceptar reglamento */}
                    {registration.acceptRules && (
                        <label className="flex items-start gap-3 p-3 bg-white/5 border border-white/10 rounded-lg cursor-pointer hover:bg-white/10 transition-all">
                            <input
                                type="checkbox"
                                name="acceptedRules"
                                checked={formData.acceptedRules}
                                onChange={handleChange}
                                className="mt-1 w-4 h-4 accent-orange-500" />
                            <span className="text-sm text-gray-300">
                                He leído y acepto el <span className="text-orange-400 font-medium">reglamento del campeonato</span> y me comprometo a seguir las reglas establecidas.
                            </span>
                        </label>
                    )}

                    {/* Submit */}
                    <div className="flex gap-3 pt-2">
                        <button type="button" onClick={onClose}
                            className="flex-1 px-4 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-all font-medium">
                            Cancelar
                        </button>
                        <button type="submit" disabled={submitting}
                            className="flex-1 px-4 py-3 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white rounded-lg transition-all font-bold disabled:opacity-50">
                            {submitting ? 'Enviando...' : isTeamMode ? '👥 Inscribir Equipo' : '🏁 Inscribirme'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
