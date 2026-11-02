"use client";

import { useEffect, useMemo, useState } from 'react';
import { FirebaseService } from '../../services/firebaseService';
import { getAllowedCars, getExcludedCars, resumenLimitadores } from '../../utils/carUsageCalculator';
import { hoyEnEspana } from '../../utils/dateUtils';
import { resumenBop, textoBop } from '../../utils/carSpecs';
import { useI18n } from '../../i18n';

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
    const { t, lang, locale } = useI18n();
    const d = (clave, vars) => t(`formularios.declaracion.${clave}`, vars);
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
    const excludedNames = useMemo(() => new Set(getExcludedCars(championship)), [championship]);

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
        if (autoSinAgregar) partes.push(d('pendienteSinAgregar', { auto: newCar.trim() }));
        if (hayCambiosSinGuardar) partes.push(d('pendienteCambios'));
        return partes.join(' ');
    };

    // Salir del modal: con cambios pendientes, pedir confirmación.
    const cerrar = (forzar = false) => {
        if (!forzar && hayAlgoPendiente) {
            setAviso({
                titulo: `⚠️ ${d('noGuardada')}`,
                mensaje: `${describirPendiente()} ${d('siSales')}`,
                acciones: [
                    { texto: d('volverGuardar'), estilo: 'primario', onClick: () => setAviso(null) },
                    { texto: d('salirSinGuardar'), estilo: 'peligro', onClick: () => { setAviso(null); cerrar(true); } },
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
                titulo: `⚠️ ${d('cambiosSinGuardar')}`,
                mensaje: `${describirPendiente()} ${d('siCambiasPiloto')}`,
                acciones: [
                    { texto: d('volver'), estilo: 'primario', onClick: () => setAviso(null) },
                    { texto: d('cambiarSinGuardar'), estilo: 'peligro', onClick: () => { setAviso(null); cambiarPiloto(id); } },
                ],
            });
            return;
        }
        cambiarPiloto(id);
    };

    const validarAuto = (carName, lista) => {
        const trimmed = carName?.trim();
        if (!trimmed) return d('errElige');
        if (lista.includes(trimmed)) return d('errYaDeclarado');
        if (lista.length >= maxCars) return d('errMaximo', { n: maxCars });
        if (allowedNames.length > 0 && !allowedNames.includes(trimmed)) {
            return d('errNoPermitido', { auto: trimmed });
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
            setError(`❌ ${d('errGuardar')}`);
        } finally {
            setSaving(false);
        }
    };

    const handleSave = async () => {
        if (isReadOnly || saving) return;
        if (!activeReg) {
            setError(d('errSinPiloto'));
            return;
        }

        // Auto elegido pero sin agregar: ofrecer incluirlo.
        if (autoSinAgregar) {
            const conElegido = [...cars, newCar.trim()];
            const problema = validarAuto(newCar, cars);
            setAviso({
                titulo: `⚠️ ${d('autoSinAgregar')}`,
                mensaje: d('elegisteSinAgregar', { auto: newCar.trim() })
                    + (cars.length === 0 ? ` ${d('listaVacia')}` : ''),
                acciones: [
                    ...(problema ? [] : [{ texto: d('agregarYGuardar'), estilo: 'primario', onClick: () => { setAviso(null); intentarGuardar(conElegido); } }]),
                    ...(cars.length > 0 ? [{ texto: d('guardarSinEse'), estilo: 'secundario', onClick: () => { setAviso(null); setNewCar(''); intentarGuardar(cars); } }] : []),
                    { texto: d('volver'), estilo: 'secundario', onClick: () => setAviso(null) },
                ],
            });
            return;
        }
        intentarGuardar(cars);
    };

    // Comprobaciones sobre la lista final antes de escribir.
    const intentarGuardar = (lista) => {
        if (lista.length === 0) {
            setError(d('errNinguno'));
            return;
        }
        if (mismosAutos(lista, savedCars) && savedCars.length > 0) {
            setSaved(true);
            setError('');
            return;
        }
        if (lista.length < maxCars) {
            setAviso({
                titulo: d('soloDeclaraste', { a: lista.length, total: maxCars }),
                mensaje: d('puedesGuardarAsi', { n: maxCars }),
                acciones: [
                    { texto: d('seguirEligiendo'), estilo: 'secundario', onClick: () => setAviso(null) },
                    { texto: d('guardarN', { n: lista.length }), estilo: 'primario', onClick: () => { setAviso(null); guardar(lista); } },
                ],
            });
            return;
        }
        guardar(lista);
    };

    const driverLabel = (r) => r.gt7Id || r.psnId || r.name || t('componentes.tabla.piloto');

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
                        <h3 className="text-xl font-bold text-white">🚗 {d('titulo')}</h3>
                        <p className="text-gray-400 text-sm mt-1">{championship.name}</p>
                    </div>
                    <button onClick={() => cerrar()} className="text-gray-400 hover:text-white text-2xl" aria-label={t('campeonato.cerrar')}>✕</button>
                </div>

                {/* Deadline banner */}
                {adminOverride && plazoVencido && (
                    <div className="mb-5 px-4 py-3 rounded-lg text-sm bg-amber-900/30 border border-amber-500/40 text-amber-200">
                        🔓 {d('excepcionAdmin', { fecha: deadline.toLocaleDateString(locale) })}
                    </div>
                )}
                {deadline && !(adminOverride && plazoVencido) && (
                    <div className={`mb-5 px-4 py-3 rounded-lg text-sm ${isReadOnly ? 'bg-red-900/40 border border-red-500/40 text-red-300' : 'bg-blue-900/30 border border-blue-500/30 text-blue-200'}`}>
                        {isReadOnly
                            ? `⛔ ${d('plazoVencido', { fecha: deadline.toLocaleDateString(locale) })}`
                            : `📅 ${d('fechaLimite', { fecha: deadline.toLocaleDateString(locale) })}`}
                    </div>
                )}

                {/* Selector de piloto (solo si no viene resuelto por sesión) */}
                {!registration && (
                    <div className="mb-5">
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            {d('quienEres')} <span className="text-red-400">*</span>
                        </label>
                        <select
                            value={selectedId}
                            onChange={e => handleSelectDriver(e.target.value)}
                            className="w-full px-3 py-2 bg-white/10 border border-white/30 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                        >
                            <option value="" className="bg-slate-800">{d('seleccionaPiloto')}</option>
                            {registrations.map(r => (
                                <option key={r.id} value={r.id} className="bg-slate-800">
                                    {driverLabel(r)}{r.teamName ? ` — ${r.teamName}` : ''}
                                    {(r.declaredCars || []).length > 0 ? ' ✅' : ''}
                                </option>
                            ))}
                        </select>
                        <p className="text-gray-500 text-xs mt-1">
                            {d('conCheck')}
                        </p>
                    </div>
                )}

                {/* Reglas */}
                <div className="mb-5 grid grid-cols-2 gap-3">
                    <div className="bg-white/5 rounded-lg p-3 text-center">
                        <p className="text-2xl font-bold text-orange-400">{maxCars}</p>
                        <p className="text-xs text-gray-400 mt-1">{d('maxDistintos')}</p>
                    </div>
                    <div className="bg-white/5 rounded-lg p-3 text-center">
                        <p className="text-2xl font-bold text-orange-400">{cat.maxUsesPerCar ?? 2}</p>
                        <p className="text-xs text-gray-400 mt-1">{d('maxUsos')}</p>
                    </div>
                </div>

                {activeReg ? (
                    <>
                        {/* Autos declarados */}
                        <div className="mb-5">
                            <p className="text-sm font-medium text-gray-300 mb-3">
                                {d('autosDe')} <span className="text-white font-semibold">{driverLabel(activeReg)}</span> ({cars.length}/{maxCars}):
                            </p>
                            {cars.length === 0 ? (
                                <p className="text-gray-500 text-sm">{d('sinAutos')}</p>
                            ) : (
                                <div className="space-y-2">
                                    {cars.map((car, idx) => (
                                        <div key={idx} className={`flex items-center justify-between rounded-lg px-3 py-2 border ${excludedNames.has(car) ? 'bg-red-900/20 border-red-500/40' : 'bg-white/5 border-white/10'}`}>
                                            <span className="text-white text-sm">
                                                🏎️ {car}
                                                {/* Excluido después de declararlo: no se borra, se avisa */}
                                                {excludedNames.has(car) && (
                                                    <span className="block text-xs text-red-300 mt-0.5">⚠️ {d('yaNoPermitido')}</span>
                                                )}
                                            </span>
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
                                <p className="text-sm font-medium text-gray-300 mb-2">{d('agregarAuto')}:</p>
                                {allowedCars.length > 0 ? (
                                    <>
                                        <div className="flex gap-2">
                                            <select
                                                value={newCar}
                                                onChange={e => { setNewCar(e.target.value); setError(''); }}
                                                className="flex-1 min-w-0 px-3 py-2 bg-white/10 border border-white/30 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                                            >
                                                <option value="" className="bg-slate-800">{d('seleccionaAuto')}</option>
                                                {allowedCars.filter(c => !cars.includes(c.name)).map(c => {
                                                    // Con BoP si lo hay: antes salía el PR de serie (el Alfa
                                                    // 155, 665) y con BoP ese coche corre con 603.
                                                    const bop = textoBop(c, 'medio', lang);
                                                    return (
                                                        <option key={c.name} value={c.name} className="bg-slate-800">
                                                            {c.name}{bop ? ` — ${bop}` : c.pp ? ` — ${d('prSerie', { pp: c.pp })}` : ''}
                                                        </option>
                                                    );
                                                })}
                                            </select>
                                            <button type="button"
                                                onClick={() => handleAddCar(newCar)}
                                                className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-sm rounded-lg transition-colors whitespace-nowrap">
                                                + {d('agregar')}
                                            </button>
                                        </div>
                                        {(() => {
                                            const elegido = allowedCars.find(c => c.name === newCar);
                                            const r = resumenBop(elegido);
                                            if (!r) return null;
                                            return (
                                                <div className="mt-2 bg-white/5 border border-white/10 rounded-lg p-3">
                                                    <div className="grid grid-cols-4 gap-2 text-center">
                                                        {[[t('componentes.ficha.traccion'), r.traccion], [t('componentes.ficha.columna.pp'), r.pp], [t('componentes.ficha.columna.cv'), r.cv], ['kg', r.kg]].map(([k, v]) => (
                                                            <div key={k}>
                                                                <div className="text-gray-400 text-[11px]">{k}</div>
                                                                <div className="text-white text-sm font-semibold tabular-nums">{v}</div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    <p className="text-gray-500 text-[11px] mt-2 text-center">
                                                        {d('conBop')}
                                                        {r.varia && ` · ${d('cambiaCircuito')}`}
                                                    </p>
                                                </div>
                                            );
                                        })()}
                                        <p className="text-gray-500 text-xs mt-1">
                                            {d('autosPermitidos', { n: allowedCars.length })}
                                            {(championship.categories || []).length > 0 && !(cat.carCatalog || []).length
                                                ? ` (${d('categoria', { cat: (championship.categories).join(', ') })})`
                                                : ''}
                                            {resumenLimitadores(cat.limitadores) && <span className="block text-orange-300/80">🔧 {resumenLimitadores(cat.limitadores, lang)}</span>}
                                        </p>
                                    </>
                                ) : (
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={newCar}
                                            onChange={e => { setNewCar(e.target.value); setError(''); }}
                                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddCar(newCar); } }}
                                            placeholder={d('phAuto')}
                                            className="flex-1 min-w-0 px-3 py-2 bg-white/10 border border-white/30 rounded-lg text-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
                                        />
                                        <button type="button"
                                            onClick={() => handleAddCar(newCar)}
                                            className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-sm rounded-lg transition-colors whitespace-nowrap">
                                            + {d('agregar')}
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                ) : (
                    <p className="mb-5 text-gray-400 text-sm">
                        {d('seleccionaParaVer')}
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
                        <p className="font-semibold">✅ {d('guardada')}</p>
                        <p className="mt-1">{d('autosDe')} {activeReg ? driverLabel(activeReg) : d('tuPiloto')}: {savedCars.join(' · ')}</p>
                        <p className="mt-1 text-green-300/80 text-xs">{d('puedesCerrar')}</p>
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
                        {isReadOnly || (saved && !hayAlgoPendiente) ? t('campeonato.cerrar') : t('formularios.inscripcion.cancelar')}
                    </button>
                    {!isReadOnly && (
                        <button onClick={handleSave} disabled={saving}
                            className="flex-1 px-4 py-2 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white font-bold rounded-lg transition-all disabled:opacity-50 text-sm">
                            {saving ? `⏳ ${d('guardando')}` : `💾 ${d('guardar')}`}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
