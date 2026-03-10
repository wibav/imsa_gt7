"use client";

import { useState } from "react";

export default function RegistrationModal({ event, isOpen, onClose, onSubmit, isLoading, registrationMessage }) {
    const [formData, setFormData] = useState({
        gt7Id: "",
        psnId: "",
    });

    const [errors, setErrors] = useState({});

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
        // Limpiar error del campo cuando el usuario empieza a escribir
        if (errors[name]) {
            setErrors(prev => ({
                ...prev,
                [name]: ""
            }));
        }
    };

    const validateForm = () => {
        const newErrors = {};

        if (!formData.gt7Id.trim()) {
            newErrors.gt7Id = "El GT7 ID es obligatorio";
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!validateForm()) {
            return;
        }

        const data = {
            gt7Id: formData.gt7Id.trim(),
        };
        if (formData.psnId.trim()) {
            data.psnId = formData.psnId.trim();
        }

        await onSubmit(data);

        // Limpiar formulario
        setFormData({
            gt7Id: "",
            psnId: "",
        });
    };

    if (!isOpen) return null;

    const isSuccess = registrationMessage?.startsWith("✅");
    const isWaitlist = registrationMessage?.startsWith("⏳");
    const isError = registrationMessage?.startsWith("❌");

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-800 border border-white/10 rounded-xl p-6 max-w-md w-full shadow-2xl">

                {/* Pantalla de confirmación */}
                {registrationMessage && (
                    <div className="text-center py-4">
                        <div className="text-6xl mb-4">
                            {isSuccess ? "🎉" : isWaitlist ? "⏳" : "❌"}
                        </div>
                        <h2 className={`text-xl font-bold mb-3 ${isSuccess ? "text-green-400" : isWaitlist ? "text-yellow-400" : "text-red-400"
                            }`}>
                            {isSuccess ? "¡Inscripción completada!" : isWaitlist ? "En lista de reservas" : "Error en la inscripción"}
                        </h2>
                        <p className="text-gray-300 text-sm leading-relaxed mb-6">
                            {registrationMessage.replace(/^[✅⏳❌]\s*/, "")}
                        </p>
                        <button
                            onClick={onClose}
                            className="bg-white/10 border border-white/20 text-white px-6 py-2 rounded-lg font-semibold hover:bg-white/20 transition-all"
                        >
                            Cerrar
                        </button>
                    </div>
                )}

                {/* Formulario (oculto cuando hay mensaje) */}
                {!registrationMessage && (
                    <>
                        <h2 className="text-2xl font-bold text-white mb-2">
                            ✍️ Inscribirse al Evento
                        </h2>
                        <p className="text-gray-400 text-sm mb-6">
                            {event?.title}
                        </p>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            {/* GT7 ID */}
                            <div>
                                <label htmlFor="gt7Id" className="block text-gray-300 font-semibold mb-2 text-sm">
                                    GT7 ID *
                                </label>
                                <input
                                    type="text"
                                    id="gt7Id"
                                    name="gt7Id"
                                    value={formData.gt7Id}
                                    onChange={handleChange}
                                    placeholder="Tu GT7 ID"
                                    className={`w-full bg-white/10 border rounded-lg p-3 text-white placeholder-white/40 focus:outline-none focus:ring-2 transition-colors ${errors.gt7Id
                                        ? "border-red-500 focus:ring-red-500"
                                        : "border-white/30 focus:ring-orange-500"
                                        }`}
                                    disabled={isLoading}
                                />
                                {errors.gt7Id && (
                                    <p className="text-red-400 text-xs mt-1">{errors.gt7Id}</p>
                                )}
                            </div>

                            {/* PSN ID */}
                            <div>
                                <label htmlFor="psnId" className="block text-gray-300 font-semibold mb-2 text-sm">
                                    PSN ID <span className="text-gray-500 font-normal">(opcional)</span>
                                </label>
                                <input
                                    type="text"
                                    id="psnId"
                                    name="psnId"
                                    value={formData.psnId}
                                    onChange={handleChange}
                                    placeholder="Tu PSN ID"
                                    className="w-full bg-white/10 border border-white/30 rounded-lg p-3 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-orange-500 transition-colors"
                                    disabled={isLoading}
                                />
                            </div>

                            {/* Información del cupo ocupado si aplica */}
                            {event?.maxParticipants > 0 && (
                                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 text-sm text-blue-300">
                                    Cupos disponibles: {event.maxParticipants - (event.participants?.length || 0)} / {event.maxParticipants}
                                </div>
                            )}



                            {/* Botones */}
                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    disabled={isLoading}
                                    className="flex-1 bg-white/10 border border-white/20 text-white px-4 py-2 rounded-lg font-semibold hover:bg-white/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="flex-1 bg-gradient-to-r from-green-600 to-green-700 text-white px-4 py-2 rounded-lg font-bold hover:from-green-700 hover:to-green-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {isLoading ? (
                                        <>
                                            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                            Inscribiendo...
                                        </>
                                    ) : (
                                        "✍️ Inscribirse"
                                    )}
                                </button>
                            </div>
                        </form>
                    </>
                )}
            </div>
        </div>
    );
}
