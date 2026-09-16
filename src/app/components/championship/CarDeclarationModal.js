"use client";

import { useEffect, useMemo, useState } from 'react';
import { FirebaseService } from '../../services/firebaseService';
import { getAllowedCars } from '../../utils/carUsageCalculator';
import { hoyEnEspana } from '../../utils/dateUtils';
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
export default function CarDeclarationModal({ championship, registration, registrations = [], onClose, onSuccess, adminOverride = false }) {
    const cat = championship.carUsageTracking || {};
    const maxCars = cat.maxCarsPerDriver ?? 3;
    const deadline = cat.declarationDeadline ? new Date(cat.declarationDeadline + 'T23:59:59') : null;
    // El plazo es el día entero en hora de España, igual que la asignación
    // automática de autos (functions/main.py): con la hora del navegador, un
    // piloto de Latinoamérica seguía pudiendo editar después del sorteo.
    // adminOverride: el organizador puede hacer excepciones fuera de plazo
    // desde la pestaña Autos del admin.
    const plazoVencido = Boolean(cat.declarationDeadline) && hoyEnEspana() > cat.declarationDeadline;
    const isReadOnly = plazoVencido && !adminOverride;

    // Piloto: el ya resuelto por sesión, o el que se elija de la lista
    const [selectedId, setSelectedId] = useState(registration?.id || '');
    const activeReg = registration || registrations.find(r => r.id === selectedId) || null;

    const [allCars, setAllCars] = useState([]);
    const [cars, setCars] = useState(() => registration?.declaredCars || []);
    // Lo que hay guardado en la base de datos para el piloto activo. Comparar
    // con `cars` dice si hay cambios sin guardar.
    const [savedCars, setSavedCars] = useState(() => registration?.declaredCars || []);
    // Aviso que bloquea la acción hasta que el piloto elige qué hacer:
    // { titulo, mensaje, acciones: [{ texto, estilo, onClick }] }
    const [aviso, setAviso] = useState(null);
    const [guardadoAlgunaVez, setGuardadoAlgunaVez] = useState(false);
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

    // Varios pilotos avisaron de que «declararon y el sistema falló». En
    // realidad elegían un auto en el selector sin pulsar «+ Agregar», o
    // agregaban y cerraban sin guardar, y nada se lo advertía. Todo lo que
    // puede perderse ahora pide confirmación, y lo guardado se relee de la
    // base de datos antes de darlo por bueno.
    const mismosAutos = (a = [], b = []) => a.length === b.length && a.every((c, i) => c === b[i]);
    const autoSinAgregar = !isReadOnly && newCar.trim() !== '' && cars.length < maxCars && !cars.includes(newCar.trim());
    const hayCambiosSinGuardar = !isReadOnly && Boolean(activeReg) && !mismosAutos(cars, savedCars);
    const hayAlgoPendiente = autoSinAgregar || hayCambiosSinGuardar;

    const describirPendiente = () => {
        const partes = [];
        if (autoSinAgregar) partes.push(`Elegiste «${newCar.trim()}» pero no pulsaste «+ Agregar», así que no está en tu lista.`);
        if (hayCambiosSinGuardar) partes.push('Tienes cambios en tu lista de autos que todavía no guardaste.');
        return partes.join(' ');
    };

    // Salir del modal: con cambios pendientes, pedir confirmación.
    const cerrar = (forzar = false) => {
        if (!forzar && hayAlgoPendiente) {
            setAviso({
                titulo: '⚠️ Tu declaración no está guardada',
                mensaje: `${describirPendiente()} Si sales ahora, se pierde.`,
                acciones: [
                    { texto: 'Volver y guardar', estilo: 'primario', onClick: () => setAviso(null) },
                    { texto: 'Salir sin guardar', estilo: 'peligro', onClick: () => { setAviso(null); cerrar(true); } },
                ],
            });
            return;
        }
        if (guardadoAlgunaVez) onSuccess?.();
        else onClose?.();
    };

    // Cerrar también con Escape, con la misma confirmación.
    useEffect(() => {
        const alPulsar = (e) => { if (e.key === 'Escape') { if (aviso) setAviso(null); else cerrar(); } };
        window.addEventListener('keydown', alPulsar);
        return () => window.removeEventListener('keydown', alPulsar);
    });

    // Recargar o cerrar la pestaña con cambios sin guardar.
    useEffect(() => {
        if (!hayAlgoPendiente) return undefined;
        const alSalir = (e) => { e.preventDefault(); e.returnValue = ''; };
        window.addEventListener('beforeunload', alSalir);
        return () => window.removeEventListener('beforeunload', alSalir);
    }, [hayAlgoPendiente]);

    // Al cambiar de piloto, cargar SUS autos ya declarados
    const cambiarPiloto = (id) => {
        setSelectedId(id);
        const reg = registrations.find(r => r.id === id);
        setCars(reg?.declaredCars || []);
        setSavedCars(reg?.declaredCars || []);
        setNewCar('');
        setError('');
        setSaved(false);
    };
    const handleSelectDriver = (id) => {
        if (hayAlgoPendiente) {
            setAviso({
                titulo: '⚠️ Cambios sin guardar',
                mensaje: `${describirPendiente()} Si cambias de piloto, se pierden.`,
                acciones: [
                    { texto: 'Volver', estilo: 'primario', onClick: () => setAviso(null) },
                    { texto: 'Cambiar sin guardar', estilo: 'peligro', onClick: () => { setAviso(null); cambiarPiloto(id); } },
                ],
            });
            return;
        }
        cambiarPiloto(id);
    };

    const validarAuto = (carName, lista) => {
        const trimmed = carName?.trim();
        if (!trimmed) return 'Elige un auto en el selector.';
        if (lista.includes(trimmed)) return 'Ya declaraste ese auto.';
        if (lista.length >= maxCars) return `Máximo ${maxCars} autos permitidos.`;
        if (allowedNames.length > 0 && !allowedNames.includes(trimmed)) {
            return `"${trimmed}" no está entre los autos permitidos del campeonato.`;
        }
        return null;
    };

    const handleAddCar = (carName) => {
        const problema = validarAuto(carName, cars);
        if (problema) { setError(problema); return; }
        setError('');
        setSaved(false);
        setCars(prev => [...prev, carName.trim()]);
        setNewCar('');
    };

    const handleRemove = (idx) => {
        setCars(prev => prev.filter((_, i) => i !== idx));
        setError('');
        setSaved(false);
    };

    const guardar = async (lista) => {
        setSaving(true);
        setError('');
        setSaved(false);
        try {
            await FirebaseService.saveDeclaredCars(championship.id, activeReg.id, lista);
            // Releer: solo se confirma lo que de verdad quedó guardado.
            const enBaseDeDatos = await FirebaseService.getDeclaration(championship.id, activeReg.id);
            if (!mismosAutos(enBaseDeDatos || [], lista)) {
                throw new Error('verificación');
            }
            setCars(lista);
            setSavedCars(lista);
            setNewCar('');
            setSaved(true);
            setGuardadoAlgunaVez(true);
        } catch (e) {
            setError('❌ No se pudo guardar tu declaración. Revisa tu conexión y pulsa «Guardar declaración» otra vez. Si vuelve a fallar, avisa a la organización con captura de pantalla.');
        } finally {
            setSaving(false);
        }
    };

    const handleSave = async () => {
        if (isReadOnly || saving) return;
        if (!activeReg) {
            setError('Primero selecciona tu piloto en «¿Quién eres?».');
            return;
        }

        // Auto elegido pero sin agregar: ofrecer incluirlo.
        if (autoSinAgregar) {
            const conElegido = [...cars, newCar.trim()];
            const problema = validarAuto(newCar, cars);
            setAviso({
                titulo: '⚠️ Hay un auto sin agregar',
                mensaje: `Elegiste «${newCar.trim()}» pero no pulsaste «+ Agregar».`
                    + (cars.length === 0 ? ' Ahora mismo tu lista está vacía.' : ''),
                acciones: [
                    ...(problema ? [] : [{ texto: 'Agregarlo y guardar', estilo: 'primario', onClick: () => { setAviso(null); intentarGuardar(conElegido); } }]),
                    ...(cars.length > 0 ? [{ texto: 'Guardar sin ese auto', estilo: 'secundario', onClick: () => { setAviso(null); setNewCar(''); intentarGuardar(cars); } }] : []),
                    { texto: 'Volver', estilo: 'secundario', onClick: () => setAviso(null) },
                ],
            });
            return;
        }
        intentarGuardar(cars);
    };

    // Comprobaciones sobre la lista final antes de escribir.
    const intentarGuardar = (lista) => {
        if (lista.length === 0) {
            setError('No has agregado ningún auto. Elige uno en el selector y pulsa «+ Agregar»; después, «Guardar declaración».');
            return;
        }
        if (mismosAutos(lista, savedCars) && savedCars.length > 0) {
            setSaved(true);
            setError('');
            return;
        }
        if (lista.length < maxCars) {
            setAviso({
                titulo: `Solo declaraste ${lista.length} de ${maxCars} autos`,
                mensaje: `Puedes guardar así y completar más tarde, dentro del plazo. Si al cerrar el plazo no has declarado ${maxCars}, se te asignarán al azar los que falten.`,
                acciones: [
                    { texto: 'Seguir eligiendo', estilo: 'secundario', onClick: () => setAviso(null) },
                    { texto: `Guardar ${lista.length} auto${lista.length === 1 ? '' : 's'}`, estilo: 'primario', onClick: () => { setAviso(null); guardar(lista); } },
                ],
            });
            return;
        }
        guardar(lista);
    };

    const driverLabel = (r) => r.gt7Id || r.psnId || r.name || 'Piloto';

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="relative bg-gradient-to-br from-slate-800 to-slate-900 border border-white/30 rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
                {aviso && (
                    <div className="absolute inset-0 z-10 bg-black/70 flex items-center justify-center p-4 rounded-xl" role="alertdialog" aria-modal="true" aria-labelledby="aviso-declaracion">
                        <div className="w-full bg-slate-800 border border-amber-500/50 rounded-xl p-5 shadow-2xl">
                            <h4 id="aviso-declaracion" className="text-white font-bold mb-2">{aviso.titulo}</h4>
                            <p className="text-gray-300 text-sm mb-4">{aviso.mensaje}</p>
                            <div className="flex flex-col sm:flex-row-reverse gap-2">
                                {aviso.acciones.map(a => (
                                    <button
                                        key={a.texto}
                                        type="button"
                                        onClick={a.onClick}
                                        className={`flex-1 px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${a.estilo === 'primario'
                                            ? 'bg-orange-600 hover:bg-orange-700 text-white'
                                            : a.estilo === 'peligro'
                                                ? 'bg-red-700/80 hover:bg-red-700 text-white'
                                                : 'bg-white/10 hover:bg-white/20 text-gray-200'}`}
                                    >
                                        {a.texto}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
                {/* Header */}
                <div className="flex items-center justify-between mb-5">
                    <div>
                        <h3 className="text-xl font-bold text-white">🚗 Declaración de Autos</h3>
                        <p className="text-gray-400 text-sm mt-1">{championship.name}</p>
                    </div>
                    <button onClick={() => cerrar()} className="text-gray-400 hover:text-white text-2xl" aria-label="Cerrar">✕</button>
                </div>

                {/* Deadline banner */}
                {adminOverride && plazoVencido && (
                    <div className="mb-5 px-4 py-3 rounded-lg text-sm bg-amber-900/30 border border-amber-500/40 text-amber-200">
                        🔓 Excepción de administrador: el plazo venció el {deadline.toLocaleDateString('es-ES')}, pero puedes cambiar los autos de este piloto.
                    </div>
                )}
                {deadline && !(adminOverride && plazoVencido) && (
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

                {/* Éxito: solo tras releer lo guardado */}
                {saved && !error && !hayAlgoPendiente && (
                    <div className="mb-4 px-4 py-3 bg-green-900/40 border border-green-500/40 rounded-lg text-green-200 text-sm">
                        <p className="font-semibold">✅ Declaración guardada y comprobada.</p>
                        <p className="mt-1">Autos de {activeReg ? driverLabel(activeReg) : 'tu piloto'}: {savedCars.join(' · ')}</p>
                        <p className="mt-1 text-green-300/80 text-xs">Ya puedes cerrar esta ventana.</p>
                    </div>
                )}

                {/* Aviso de cambios sin guardar, siempre visible mientras los haya */}
                {!saving && hayAlgoPendiente && !aviso && (
                    <div className="mb-4 px-4 py-2 bg-amber-900/30 border border-amber-500/40 rounded-lg text-amber-200 text-xs">
                        ⚠️ {describirPendiente()}
                    </div>
                )}

                {/* Botones */}
                <div className="flex gap-3 pt-2">
                    <button onClick={() => cerrar()}
                        className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors text-sm">
                        {isReadOnly || (saved && !hayAlgoPendiente) ? 'Cerrar' : 'Cancelar'}
                    </button>
                    {!isReadOnly && (
                        <button onClick={handleSave} disabled={saving}
                            className="flex-1 px-4 py-2 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white font-bold rounded-lg transition-all disabled:opacity-50 text-sm">
                            {saving ? '⏳ Guardando...' : '💾 Guardar declaración'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
