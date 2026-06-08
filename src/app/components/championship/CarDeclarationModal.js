"use client";

import { useState } from 'react';
import { FirebaseService } from '../../services/firebaseService';

/**
 * Modal público para que un piloto inscrito declare sus autos para el campeonato.
 * Se muestra cuando carUsageTracking.enabled && hay un registro aprobado del piloto
 * y la fecha de declaración no ha vencido.
 *
 * @param {Object} props
 * @param {Object}   props.championship  - Datos del campeonato
 * @param {Object}   props.registration  - La entrada de registrations[] del piloto actual
 * @param {Function} props.onClose       - Cerrar modal
 * @param {Function} props.onSuccess     - Callback tras guardar exitosamente
 */
export default function CarDeclarationModal({ championship, registration, onClose, onSuccess }) {
    const cat = championship.carUsageTracking || {};
    const maxCars = cat.maxCarsPerDriver ?? 3;
    const catalog = cat.carCatalog || [];
    const deadline = cat.declarationDeadline ? new Date(cat.declarationDeadline + 'T23:59:59') : null;
    const isReadOnly = deadline && new Date() > deadline;

    const [cars, setCars] = useState(() => registration.declaredCars || []);
    const [newCar, setNewCar] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [saved, setSaved] = useState(false);

    const handleAddCar = (carName) => {
        const trimmed = carName?.trim();
        if (!trimmed) return;
        if (cars.includes(trimmed)) { setError('Ya declaraste ese auto.'); return; }
        if (cars.length >= maxCars) { setError(`Máximo ${maxCars} autos permitidos.`); return; }
        // Si hay catálogo y el auto no está en él, rechazar
        if (catalog.length > 0 && !catalog.includes(trimmed)) {
            setError(`"${trimmed}" no está en el catálogo de autos permitidos.`);
            return;
        }
        setError('');
        setCars(prev => [...prev, trimmed]);
        setNewCar('');
    };

    const handleRemove = (idx) => {
        setCars(prev => prev.filter((_, i) => i !== idx));
        setError('');
        setSaved(false);
    };

    const handleSave = async () => {
        if (isReadOnly) return;
        setSaving(true);
        setError('');
        try {
            await FirebaseService.saveDeclaredCars(championship.id, registration.id, cars);
            setSaved(true);
            onSuccess?.();
        } catch (e) {
            setError('Error al guardar. Intenta de nuevo.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-white/30 rounded-xl p-6 w-full max-w-lg">
                {/* Header */}
                <div className="flex items-center justify-between mb-5">
                    <div>
                        <h3 className="text-xl font-bold text-white">🚗 Declaración de Autos</h3>
                        <p className="text-gray-400 text-sm mt-1">{championship.name}</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl">✕</button>
                </div>

                {/* Deadline banner */}
                {deadline && (
                    <div className={`mb-5 px-4 py-3 rounded-lg text-sm ${isReadOnly ? 'bg-red-900/40 border border-red-500/40 text-red-300' : 'bg-blue-900/30 border border-blue-500/30 text-blue-200'}`}>
                        {isReadOnly
                            ? `⛔ Plazo vencido el ${deadline.toLocaleDateString('es-ES')}. Tu declaración quedó guardada.`
                            : `📅 Fecha límite: ${deadline.toLocaleDateString('es-ES')} — puedes editar hasta esa fecha.`}
                    </div>
                )}

                {/* Reglas */}
                <div className="mb-5 grid grid-cols-2 gap-3">
                    <div className="bg-white/5 rounded-lg p-3 text-center">
                        <p className="text-2xl font-bold text-orange-400">{maxCars}</p>
                        <p className="text-xs text-gray-400 mt-1">Autos distintos máx.</p>
                    </div>
                    <div className="bg-white/5 rounded-lg p-3 text-center">
                        <p className="text-2xl font-bold text-orange-400">{cat.maxUsesPerCar ?? 2}</p>
                        <p className="text-xs text-gray-400 mt-1">Usos por auto máx.</p>
                    </div>
                </div>

                {/* Autos declarados */}
                <div className="mb-5">
                    <p className="text-sm font-medium text-gray-300 mb-3">
                        Tus autos declarados ({cars.length}/{maxCars}):
                    </p>
                    {cars.length === 0 ? (
                        <p className="text-gray-500 text-sm">Aún no declaraste ningún auto.</p>
                    ) : (
                        <div className="space-y-2">
                            {cars.map((car, idx) => (
                                <div key={idx} className="flex items-center justify-between bg-white/5 border border-white/10 rounded-lg px-3 py-2">
                                    <span className="text-white text-sm">🏎️ {car}</span>
                                    {!isReadOnly && (
                                        <button onClick={() => handleRemove(idx)}
                                            className="text-gray-500 hover:text-red-400 text-sm transition-colors">
                                            ✕
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Input para agregar auto — solo si no venció el plazo y no se llegó al máximo */}
                {!isReadOnly && cars.length < maxCars && (
                    <div className="mb-5">
                        <p className="text-sm font-medium text-gray-300 mb-2">Agregar auto:</p>
                        {catalog.length > 0 ? (
                            <div className="flex gap-2">
                                <select
                                    value={newCar}
                                    onChange={e => { setNewCar(e.target.value); setError(''); }}
                                    className="flex-1 px-3 py-2 bg-white/10 border border-white/30 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                                >
                                    <option value="" className="bg-slate-800">Selecciona un auto...</option>
                                    {catalog.filter(c => !cars.includes(c)).map(c => (
                                        <option key={c} value={c} className="bg-slate-800">{c}</option>
                                    ))}
                                </select>
                                <button type="button"
                                    onClick={() => handleAddCar(newCar)}
                                    className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-sm rounded-lg transition-colors">
                                    + Agregar
                                </button>
                            </div>
                        ) : (
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={newCar}
                                    onChange={e => { setNewCar(e.target.value); setError(''); }}
                                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddCar(newCar); } }}
                                    placeholder="Ej: Mazda RX-Vision GT3"
                                    className="flex-1 px-3 py-2 bg-white/10 border border-white/30 rounded-lg text-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
                                />
                                <button type="button"
                                    onClick={() => handleAddCar(newCar)}
                                    className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-sm rounded-lg transition-colors">
                                    + Agregar
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* Error */}
                {error && (
                    <div className="mb-4 px-4 py-2 bg-red-900/40 border border-red-500/40 rounded-lg text-red-300 text-sm">
                        {error}
                    </div>
                )}

                {/* Éxito */}
                {saved && !error && (
                    <div className="mb-4 px-4 py-2 bg-green-900/40 border border-green-500/40 rounded-lg text-green-300 text-sm">
                        ✅ Declaración guardada correctamente.
                    </div>
                )}

                {/* Botones */}
                <div className="flex gap-3 pt-2">
                    <button onClick={onClose}
                        className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors text-sm">
                        {isReadOnly ? 'Cerrar' : 'Cancelar'}
                    </button>
                    {!isReadOnly && (
                        <button onClick={handleSave} disabled={saving || cars.length === 0}
                            className="flex-1 px-4 py-2 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white font-bold rounded-lg transition-all disabled:opacity-50 text-sm">
                            {saving ? '⏳ Guardando...' : '💾 Guardar declaración'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
