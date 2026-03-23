"use client";

import { useState } from 'react';
import { FirebaseService } from '../../services/firebaseService';

/**
 * Formulario público de inscripción a un campeonato.
 * Se muestra como modal cuando el usuario hace clic en "Inscribirme".
 *
 * @param {Object} props
 * @param {Object} props.championship - Datos del campeonato
 * @param {Function} props.onClose - Callback para cerrar el modal
 * @param {Function} props.onSuccess - Callback tras inscripción exitosa
 */
export default function RegistrationForm({ championship, onClose, onSuccess }) {
    const registration = championship.registration || {};
    const fields = registration.fields || ['gt7Id', 'psnId'];

    const [formData, setFormData] = useState({
        gt7Id: '',
        psnId: '',
        experience: '',
        preferredCar: '',
        acceptedRules: false
    });
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        // Validaciones
        if (fields.includes('gt7Id') && !formData.gt7Id.trim()) {
            setError('El GT7 ID es obligatorio');
            return;
        }
        if (fields.includes('psnId') && fieldConfig.psnId?.required && !formData.psnId.trim()) {
            setError('El PSN ID es obligatorio');
            return;
        }
        if (registration.acceptRules && !formData.acceptedRules) {
            setError('Debes aceptar el reglamento del campeonato');
            return;
        }

        setSubmitting(true);
        try {
            // Enviar gt7Id siempre + campos configurados
            const data = {};
            visibleFields.forEach(f => {
                if (formData[f] !== undefined) data[f] = formData[f].trim ? formData[f].trim() : formData[f];
            });

            await FirebaseService.submitRegistration(championship.id, data);
            setSuccess(true);
            onSuccess?.();
        } catch (err) {
            setError(err.message || 'Error al enviar la inscripción');
        } finally {
            setSubmitting(false);
        }
    };

    // Check si el plazo ya venció
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
                    <button onClick={onClose}
                        className="px-6 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-all">
                        Cerrar
                    </button>
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
                    <button onClick={onClose}
                        className="px-6 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-all">
                        Cerrar
                    </button>
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

    // gt7Id siempre debe mostrarse, aunque no esté en fields (es el identificador principal)
    const visibleFields = fields.includes('gt7Id') ? fields : ['gt7Id', ...fields];

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 rounded-xl border border-white/30 shadow-2xl w-full max-w-lg">
                {/* Header */}
                <div className="p-6 border-b border-white/20">
                    <div className="flex justify-between items-center">
                        <div>
                            <h3 className="text-2xl font-bold text-white">📝 Inscripción</h3>
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
                    </div>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {error && (
                        <div className="bg-red-500/20 border border-red-400/50 text-red-200 p-3 rounded-lg text-sm">
                            ❌ {error}
                        </div>
                    )}

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
                    <div className="flex gap-3 pt-4">
                        <button type="button" onClick={onClose}
                            className="flex-1 px-4 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-all font-medium">
                            Cancelar
                        </button>
                        <button type="submit" disabled={submitting}
                            className="flex-1 px-4 py-3 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white rounded-lg transition-all font-bold disabled:opacity-50">
                            {submitting ? 'Enviando...' : '🏁 Inscribirme'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
