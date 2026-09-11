"use client";

import { useEffect, useMemo, useState } from 'react';
import { FirebaseService } from '../../services/firebaseService';
import { getAllowedCars } from '../../utils/carUsageCalculator';
import { resumenBop, textoBop } from '../../utils/carSpecs';

/**
 * Modal público para que un piloto inscrito declare sus autos para el campeonato.
 * Se muestra cuando carUsageTracking.enabled y el modo es 'declared'.
 *
 * Identificación del piloto: los pilotos se inscriben de forma anónima (el
 * formulario solo pide GT7 ID/PSN ID, no crea cuenta), así que no hay sesión
 * con la que reconocerlos. Se identifican eligiéndose de la lista de inscritos
 * — mismo criterio que ya usa el formulario de reclamaciones (ClaimForm).
 * Si el visitante SÍ tiene sesión y coincide con una inscripción, se le pasa
 * ya resuelta en `registration` y se salta ese paso.
 *
 * Catálogo de autos: si el organizador no definió `carCatalog`, se ofrecen los
 * coches oficiales de GT7 de las categorías del campeonato (ver getAllowedCars).
 *
 * @param {Object} props
 * @param {Object}   props.championship   - Datos del campeonato
 * @param {Object}   [props.registration] - Inscripción del piloto, si ya se conoce
 * @param {Array}    [props.registrations]- Inscritos entre los que elegirse (si no hay `registration`)
 * @param {Function} props.onClose        - Cerrar modal
 * @param {Function} props.onSuccess      - Callback tras guardar exitosamente
 */
export default function CarDeclarationModal({ championship, registration, registrations = [], onClose, onSuccess }) {
    const cat = championship.carUsageTracking || {};
    const maxCars = cat.maxCarsPerDriver ?? 3;
    const deadline = cat.declarationDeadline ? new Date(cat.declarationDeadline + 'T23:59:59') : null;
    const isReadOnly = deadline && new Date() > deadline;

    // Piloto: el ya resuelto por sesión, o el que se elija de la lista
    const [selectedId, setSelectedId] = useState(registration?.id || '');
    const activeReg = registration || registrations.find(r => r.id === selectedId) || null;

    const [allCars, setAllCars] = useState([]);
    const [cars, setCars] = useState(() => registration?.declaredCars || []);
    const [newCar, setNewCar] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [saved, setSaved] = useState(false);

    // Catálogo oficial (574 coches) — solo hace falta si el organizador no
    // definió una lista concreta, pero se pide siempre para poder enriquecer
    // los nombres del carCatalog con clase/PR.
    useEffect(() => {
        FirebaseService.getCars()
            .then(setAllCars)
            .catch(() => setAllCars([])); // sin catálogo se cae a texto libre
    }, []);

    const allowedCars = useMemo(
        () => getAllowedCars(championship, allCars),
        [championship, allCars]
    );
    const allowedNames = useMemo(() => allowedCars.map(c => c.name), [allowedCars]);

    // Al cambiar de piloto, cargar SUS autos ya declarados
    const handleSelectDriver = (id) => {
        setSelectedId(id);
        const reg = registrations.find(r => r.id === id);
        setCars(reg?.declaredCars || []);
        setNewCar('');
        setError('');
        setSaved(false);
    };

    const handleAddCar = (carName) => {
        const trimmed = carName?.trim();
        if (!trimmed) return;
        if (cars.includes(trimmed)) { setError('Ya declaraste ese auto.'); return; }
        if (cars.length >= maxCars) { setError(`Máximo ${maxCars} autos permitidos.`); return; }
        if (allowedNames.length > 0 && !allowedNames.includes(trimmed)) {
            setError(`"${trimmed}" no está entre los autos permitidos del campeonato.`);
            return;
        }
        setError('');
        setSaved(false);
        setCars(prev => [...prev, trimmed]);
        setNewCar('');
    };

    const handleRemove = (idx) => {
        setCars(prev => prev.filter((_, i) => i !== idx));
        setError('');
        setSaved(false);
    };

    const handleSave = async () => {
        if (isReadOnly || !activeReg) return;
        setSaving(true);
        setError('');
        try {
            await FirebaseService.saveDeclaredCars(championship.id, activeReg.id, cars);
            setSaved(true);
            onSuccess?.();
        } catch (e) {
            setError('Error al guardar. Intenta de nuevo.');
        } finally {
            setSaving(false);
        }
    };

    const driverLabel = (r) => r.gt7Id || r.psnId || r.name || 'Piloto';

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-white/30 rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
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

                {/* Selector de piloto (solo si no viene resuelto por sesión) */}
                {!registration && (
                    <div className="mb-5">
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            ¿Quién eres? <span className="text-red-400">*</span>
                        </label>
                        <select
                            value={selectedId}
                            onChange={e => handleSelectDriver(e.target.value)}
                            className="w-full px-3 py-2 bg-white/10 border border-white/30 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                        >
                            <option value="" className="bg-slate-800">Selecciona tu piloto...</option>
                            {registrations.map(r => (
                                <option key={r.id} value={r.id} className="bg-slate-800">
                                    {driverLabel(r)}{r.teamName ? ` — ${r.teamName}` : ''}
                                    {(r.declaredCars || []).length > 0 ? ' ✅' : ''}
                                </option>
                            ))}
                        </select>
                        <p className="text-gray-500 text-xs mt-1">
                            Los inscritos con ✅ ya declararon sus autos.
                        </p>
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

                {activeReg ? (
                    <>
                        {/* Autos declarados */}
                        <div className="mb-5">
                            <p className="text-sm font-medium text-gray-300 mb-3">
                                Autos de <span className="text-white font-semibold">{driverLabel(activeReg)}</span> ({cars.length}/{maxCars}):
                            </p>
                            {cars.length === 0 ? (
                                <p className="text-gray-500 text-sm">Aún no hay autos declarados.</p>
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

                        {/* Agregar auto — solo si no venció el plazo y no se llegó al máximo */}
                        {!isReadOnly && cars.length < maxCars && (
                            <div className="mb-5">
                                <p className="text-sm font-medium text-gray-300 mb-2">Agregar auto:</p>
                                {allowedCars.length > 0 ? (
                                    <>
                                        <div className="flex gap-2">
                                            <select
                                                value={newCar}
                                                onChange={e => { setNewCar(e.target.value); setError(''); }}
                                                className="flex-1 min-w-0 px-3 py-2 bg-white/10 border border-white/30 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                                            >
                                                <option value="" className="bg-slate-800">Selecciona un auto...</option>
                                                {allowedCars.filter(c => !cars.includes(c.name)).map(c => {
                                                    // Con BoP si lo hay: antes salía el PR de serie (el Alfa
                                                    // 155, 665) y con BoP ese coche corre con 603.
                                                    const bop = textoBop(c);
                                                    return (
                                                        <option key={c.name} value={c.name} className="bg-slate-800">
                                                            {c.name}{bop ? ` — ${bop}` : c.pp ? ` — PR ${c.pp} (de serie)` : ''}
                                                        </option>
                                                    );
                                                })}
                                            </select>
                                            <button type="button"
                                                onClick={() => handleAddCar(newCar)}
                                                className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-sm rounded-lg transition-colors whitespace-nowrap">
                                                + Agregar
                                            </button>
                                        </div>
                                        {(() => {
                                            const elegido = allowedCars.find(c => c.name === newCar);
                                            const r = resumenBop(elegido);
                                            if (!r) return null;
                                            return (
                                                <div className="mt-2 bg-white/5 border border-white/10 rounded-lg p-3">
                                                    <div className="grid grid-cols-4 gap-2 text-center">
                                                        {[['Tracción', r.traccion], ['PR', r.pp], ['CV', r.cv], ['kg', r.kg]].map(([k, v]) => (
                                                            <div key={k}>
                                                                <div className="text-gray-400 text-[11px]">{k}</div>
                                                                <div className="text-white text-sm font-semibold tabular-nums">{v}</div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    <p className="text-gray-500 text-[11px] mt-2 text-center">
                                                        Con BoP, en circuito medio
                                                        {r.varia && ' · cambia según el circuito: compáralo en la pestaña 🚗 Autos'}
                                                    </p>
                                                </div>
                                            );
                                        })()}
                                        <p className="text-gray-500 text-xs mt-1">
                                            {allowedCars.length} autos permitidos
                                            {(championship.categories || []).length > 0 && !(cat.carCatalog || []).length
                                                ? ` (categoría ${(championship.categories).join(', ')})`
                                                : ''}
                                        </p>
                                    </>
                                ) : (
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={newCar}
                                            onChange={e => { setNewCar(e.target.value); setError(''); }}
                                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddCar(newCar); } }}
                                            placeholder="Ej: Mazda RX-Vision GT3"
                                            className="flex-1 min-w-0 px-3 py-2 bg-white/10 border border-white/30 rounded-lg text-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
                                        />
                                        <button type="button"
                                            onClick={() => handleAddCar(newCar)}
                                            className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-sm rounded-lg transition-colors whitespace-nowrap">
                                            + Agregar
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                ) : (
                    <p className="mb-5 text-gray-400 text-sm">
                        Selecciona tu piloto para ver y editar tu declaración.
                    </p>
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
                        <button onClick={handleSave} disabled={saving || !activeReg || cars.length === 0}
                            className="flex-1 px-4 py-2 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white font-bold rounded-lg transition-all disabled:opacity-50 text-sm">
                            {saving ? '⏳ Guardando...' : '💾 Guardar declaración'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
