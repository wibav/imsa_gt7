"use client";
import { useState } from 'react';
import { FirebaseService } from '../../services/firebaseService';
import { notifyClaimCreated } from '../../utils/telegram';
import { getRaceTime, raceDateTime } from '../../utils/dateUtils';
import { useI18n } from '../../i18n';
import { mapaSinMayusculas, claveNombre } from '../../utils/nombresPiloto';

// D3.2: la pantalla anunciaba 48h mientras el código realmente aplicaba
// 72h (dos plazos distintos en la misma pantalla). Se unifica en una sola
// constante — 48h es el plazo real acordado — y todo texto visible se
// deriva de ella, sin literales sueltos.
const HOURS_LIMIT = 48;

/**
 * Plazo de reclamación de una carrera: desde que empieza hasta HOURS_LIMIT
 * horas después del final de ese día, todo en hora de España.
 *
 * Antes solo se comprobaba el límite superior, así que las carreras FUTURAS
 * también salían en el selector y llegaron reclamaciones de carreras que aún
 * no se habían corrido. El inicio es la hora más temprana entre la del
 * campeonato/carrera y la de cada división (cada una puede correr a su hora).
 * firestore.rules aplica además un límite grueso por día en el servidor.
 */
function isClaimable(track, championship, divisions = []) {
    if (!track.date) return false;
    const horas = [getRaceTime(championship, track), ...divisions.map(d => d.hour).filter(Boolean)].sort();
    const inicio = raceDateTime(track.date, horas[0]);
    const finDelDia = raceDateTime(track.date, '23:59');
    if (!inicio || !finDelDia) return false;
    const ahora = Date.now();
    const deadline = finDelDia.getTime() + 60 * 1000 + HOURS_LIMIT * 60 * 60 * 1000;
    return ahora >= inicio.getTime() && ahora <= deadline;
}

/**
 * Formulario público para que los pilotos envíen reclamaciones de incidentes.
 * Se muestra como modal en la página pública del campeonato.
 * - Acepta múltiples infractores
 * - Solo desde el inicio de la carrera hasta 48h después
 * - Campos opcionales: URL de video, vuelta, minuto de carrera
 */
export default function ClaimForm({ championshipId, championship, teams = [], tracks = [], divisions = [], onClose, onSubmitted }) {
    const { t } = useI18n();
    const r = (clave, vars) => t(`formularios.reclamacion.${clave}`, vars);
    const [form, setForm] = useState({
        reporterName: '',
        reporterPsnId: '',
        accusedNames: [],
        trackId: '',
        trackName: '',
        round: null,
        lap: '',
        minute: '',
        description: '',
        evidence: []
    });
    const [accusedInput, setAccusedInput] = useState('');
    const [evidenceInput, setEvidenceInput] = useState('');
    const [saving, setSaving] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [errors, setErrors] = useState([]);

    const allDrivers = getAllDrivers(championship, teams, tracks, divisions);

    // Solo carreras dentro del plazo de 48h (no se requiere que ya tengan puntos cargados)
    const claimableTracks = tracks
        .filter(tr => isClaimable(tr, championship, divisions))
        .sort((a, b) => new Date(b.date) - new Date(a.date));

    const handleTrackChange = (trackId) => {
        const track = claimableTracks.find(tr => tr.id === trackId);
        setForm(prev => ({
            ...prev,
            trackId,
            trackName: track?.name || '',
            round: track?.round || null
        }));
    };

    const handleAddAccused = (name) => {
        if (!name || name === form.reporterName) return;
        if (form.accusedNames.includes(name)) return;
        setForm(prev => ({ ...prev, accusedNames: [...prev.accusedNames, name] }));
        setAccusedInput('');
    };

    const handleRemoveAccused = (name) => {
        setForm(prev => ({ ...prev, accusedNames: prev.accusedNames.filter(n => n !== name) }));
    };

    const handleAddEvidence = () => {
        const url = evidenceInput.trim();
        if (!url || form.evidence.includes(url)) return;
        setForm(prev => ({ ...prev, evidence: [...prev.evidence, url] }));
        setEvidenceInput('');
    };

    const handleRemoveEvidence = (url) => {
        setForm(prev => ({ ...prev, evidence: prev.evidence.filter(u => u !== url) }));
    };

    const validate = () => {
        const errs = [];
        if (!form.reporterName) errs.push(r('errNombre'));
        if (form.accusedNames.length === 0) errs.push(r('errInfractor'));
        if (!form.trackId) errs.push(r('errCarrera'));
        if (!form.description.trim()) errs.push(r('errDescripcion'));
        return errs;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const errs = validate();
        if (errs.length > 0) { setErrors(errs); return; }
        if (form.accusedNames.includes(form.reporterName)) {
            setErrors([r('errATiMismo')]);
            return;
        }

        setSaving(true);
        try {
            await FirebaseService.createClaim(championshipId, {
                ...form,
                createdAt: new Date().toISOString()
            });
            const org = championship?.orgId
                ? await FirebaseService.getOrganization(championship.orgId).catch(() => null)
                : null;
            notifyClaimCreated({
                championshipName: championship?.name || championshipId,
                reporterName: form.reporterName,
                accusedNames: form.accusedNames,
                trackName: form.trackName,
                round: form.round,
                description: form.description,
                orgName: org?.name,
            });
            setSubmitted(true);
            if (onSubmitted) onSubmitted();
        } catch (error) {
            setErrors([`❌ ${r('errEnviar')}: ${error.message}`]);
        } finally {
            setSaving(false);
        }
    };

    if (submitted) {
        return (
            <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
                <div className="bg-slate-800 rounded-2xl border border-white/20 w-full max-w-md p-8 text-center">
                    <div className="text-5xl mb-4">✅</div>
                    <h3 className="text-xl font-bold text-white mb-2">{r('enviada')}</h3>
                    <p className="text-gray-400 text-sm mb-6">
                        {r('enviadaTexto')}
                    </p>
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-all"
                    >
                        {t('campeonato.cerrar')}
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
                        <h3 className="text-xl font-bold text-white">📩 {r('titulo')}</h3>
                        <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl">✕</button>
                    </div>
                    <p className="text-gray-400 text-sm mt-1">
                        {r('disponible')} <strong className="text-orange-400">{r('horas', { n: HOURS_LIMIT })}</strong> {r('despues')}
                    </p>
                </div>

                {claimableTracks.length === 0 && (
                    <div className="p-6 text-center">
                        <div className="text-4xl mb-3">⏰</div>
                        <p className="text-gray-300 font-medium">{r('sinCarreras')}</p>
                        <p className="text-gray-500 text-sm mt-1">
                            {r('soloSePuede', { n: HOURS_LIMIT })}
                        </p>
                        <button onClick={onClose} className="mt-4 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all">
                            {t('campeonato.cerrar')}
                        </button>
                    </div>
                )}

                {claimableTracks.length > 0 && (
                    <form onSubmit={handleSubmit} className="p-6 space-y-4">
                        {/* Errores */}
                        {errors.length > 0 && (
                            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                                {errors.map((err, i) => (
                                    <p key={i} className="text-red-400 text-sm">• {err}</p>
                                ))}
                            </div>
                        )}

                        {/* Tu nombre */}
                        <div>
                            <label className="text-gray-400 text-sm block mb-1">{r('tuNombre')} *</label>
                            <select
                                value={form.reporterName}
                                onChange={e => setForm(prev => ({ ...prev, reporterName: e.target.value }))}
                                className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm"
                                required
                            >
                                <option value="" className="bg-slate-800">{r('seleccionar')}</option>
                                {allDrivers.map(d => (
                                    <option key={d.name} value={d.name} className="bg-slate-800">{d.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* PSN (opcional) */}
                        <div>
                            <label className="text-gray-400 text-sm block mb-1">{r('tuPsn')}</label>
                            <input
                                type="text"
                                value={form.reporterPsnId}
                                onChange={e => setForm(prev => ({ ...prev, reporterPsnId: e.target.value }))}
                                className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm"
                                placeholder={r('phPsn')}
                            />
                        </div>

                        {/* Infractores (múltiples) */}
                        <div>
                            <label className="text-gray-400 text-sm block mb-1">{r('infractores')} *</label>
                            {/* Chips de infractores agregados */}
                            {form.accusedNames.length > 0 && (
                                <div className="flex flex-wrap gap-2 mb-2">
                                    {form.accusedNames.map(name => (
                                        <span key={name} className="flex items-center gap-1 bg-red-500/20 border border-red-500/30 text-red-300 text-xs px-2 py-1 rounded-full">
                                            {name}
                                            <button type="button" onClick={() => handleRemoveAccused(name)}
                                                className="hover:text-white ml-0.5 leading-none">×</button>
                                        </span>
                                    ))}
                                </div>
                            )}
                            <div className="flex gap-2">
                                <select
                                    value={accusedInput}
                                    onChange={e => setAccusedInput(e.target.value)}
                                    className="flex-1 bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm"
                                >
                                    <option value="" className="bg-slate-800">{r('seleccionarPiloto')}</option>
                                    {allDrivers
                                        .filter(d => d.name !== form.reporterName && !form.accusedNames.includes(d.name))
                                        .map(d => (
                                            <option key={d.name} value={d.name} className="bg-slate-800">{d.name}</option>
                                        ))}
                                </select>
                                <button type="button"
                                    onClick={() => handleAddAccused(accusedInput)}
                                    disabled={!accusedInput}
                                    className="px-3 py-2 bg-orange-600 hover:bg-orange-700 disabled:opacity-40 text-white text-sm rounded-lg transition-all">
                                    + {t('formularios.declaracion.agregar')}
                                </button>
                            </div>
                            <p className="text-gray-600 text-xs mt-1">{r('masDeUno')}</p>
                        </div>

                        {/* Carrera */}
                        <div>
                            <label className="text-gray-400 text-sm block mb-1">{r('carrera')} *</label>
                            <select
                                value={form.trackId}
                                onChange={e => handleTrackChange(e.target.value)}
                                className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm"
                                required
                            >
                                <option value="" className="bg-slate-800">{r('seleccionar')}</option>
                                {claimableTracks.map(tr => {
                                    const hoursAgo = Math.floor((Date.now() - new Date(tr.date).getTime()) / (1000 * 60 * 60));
                                    return (
                                        <option key={tr.id} value={tr.id} className="bg-slate-800">
                                            R{tr.round} - {tr.name} ({r('haceHoras', { h: hoursAgo })})
                                        </option>
                                    );
                                })}
                            </select>
                        </div>

                        {/* Vuelta / Minuto */}
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-gray-400 text-sm block mb-1">{r('vuelta')}</label>
                                <input
                                    type="number"
                                    min="1"
                                    value={form.lap}
                                    onChange={e => setForm(prev => ({ ...prev, lap: e.target.value }))}
                                    className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm"
                                    placeholder={r('ej', { v: 15 })}
                                />
                            </div>
                            <div>
                                <label className="text-gray-400 text-sm block mb-1">{r('minuto')}</label>
                                <input
                                    type="number"
                                    min="0"
                                    value={form.minute}
                                    onChange={e => setForm(prev => ({ ...prev, minute: e.target.value }))}
                                    className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm"
                                    placeholder={r('ej', { v: 43 })}
                                />
                            </div>
                        </div>
                        <p className="text-gray-600 text-xs -mt-2">{r('vueltaOMinuto')}</p>

                        {/* Descripción */}
                        <div>
                            <label className="text-gray-400 text-sm block mb-1">{r('descripcion')} *</label>
                            <textarea
                                value={form.description}
                                onChange={e => { setForm(prev => ({ ...prev, description: e.target.value })); setErrors([]); }}
                                className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm h-24 resize-none"
                                placeholder={r('phDescripcion')}
                                required
                            />
                        </div>

                        {/* URLs de video (varias perspectivas) */}
                        <div>
                            <label className="text-gray-400 text-sm block mb-1">
                                {r('videos')}
                            </label>
                            {form.evidence.length > 0 && (
                                <ul className="space-y-1 mb-2">
                                    {form.evidence.map(url => (
                                        <li key={url} className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5">
                                            <span className="text-blue-300 text-xs truncate flex-1">{url}</span>
                                            <button type="button" onClick={() => handleRemoveEvidence(url)}
                                                className="text-gray-400 hover:text-red-400 leading-none">×</button>
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
                                    placeholder="https://youtube.com/watch?v=..."
                                />
                                <button type="button"
                                    onClick={handleAddEvidence}
                                    disabled={!evidenceInput.trim()}
                                    className="px-3 py-2 bg-orange-600 hover:bg-orange-700 disabled:opacity-40 text-white text-sm rounded-lg transition-all">
                                    + {t('formularios.declaracion.agregar')}
                                </button>
                            </div>
                            <p className="text-gray-600 text-xs mt-1">{r('masDeUnClip')}</p>
                            <p className="text-gray-500 text-xs mt-1">
                                {r('youtubeOculto')}
                            </p>
                        </div>

                        <div className="flex gap-3 justify-end pt-2">
                            <button type="button" onClick={onClose}
                                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all">
                                {t('formularios.inscripcion.cancelar')}
                            </button>
                            <button
                                type="submit"
                                disabled={saving}
                                className="px-6 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-bold transition-all disabled:opacity-50"
                            >
                                {saving ? `⏳ ${t('formularios.inscripcion.enviando')}` : `📩 ${r('enviar')}`}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}

// Alias psnId/name → gt7Id canónico, igual criterio que standingsCalculator
// (championship.registrations es la única fuente que conoce los 3
// identificadores de un mismo piloto). Sin esto, sumar divisiones y
// resultados de carrera como fuentes (ver comentario de getAllDrivers)
// duplica al piloto: una fila con su psnId (como vive en division.drivers[])
// y otra con su gt7Id (como vive en championship.drivers).
function buildAliasToGt7Id(championship) {
    const aliasToCanonical = {};
    const registerAliases = (name, psnId, gt7Id) => {
        const canonical = gt7Id || name || psnId;
        if (!canonical) return;
        [name, psnId, gt7Id].forEach(alias => {
            if (alias && alias !== canonical) aliasToCanonical[alias] = canonical;
        });
    };
    (championship?.registrations || []).forEach(reg => {
        if (Array.isArray(reg.drivers) && reg.drivers.length > 0) {
            reg.drivers.forEach(d => registerAliases(d.name, d.psnId, d.gt7Id));
        } else {
            registerAliases(reg.name, reg.psnId, reg.gt7Id);
        }
    });
    return mapaSinMayusculas(aliasToCanonical);
}

// D3.5: championship.drivers[] NO es el roster completo. En campeonatos con
// divisiones (salas), DivisionsTab asigna pilotos directo a
// division.drivers[] (ver DivisionsTab.js handleAssignDriver/moveDriver) sin
// tocar championship.drivers — ese piloto puede estar aprobado, corriendo y
// puntuando en su división y jamás aparecer en championship.drivers. Un
// piloto también puede quedar solo en resultados ya corridos si fue dado de
// baja después de correr (withdrawRegistration preserva track.points/results
// a propósito). El selector de reclamos necesita ver a "cualquiera que
// participa", no solo el roster plano: se suman también los nombres de
// division.drivers[] y los que aparecen en track.results/track.points
// (igual que hace standingsCalculator para armar la clasificación). Todo
// nombre se resuelve a su GT7 ID canónico antes de agregarse, para no
// mostrar al mismo piloto dos veces bajo psnId y gt7Id.
function getAllDrivers(championship, teams, tracks = [], divisions = []) {
    const aliasToGt7Id = buildAliasToGt7Id(championship);
    const resolve = (name) => aliasToGt7Id[name] || name;

    const drivers = [];
    const addDriver = (name, team = '') => {
        const canonical = resolve(name);
        if (!canonical) return;
        if (!drivers.find(x => claveNombre(x.name) === claveNombre(canonical))) {
            drivers.push({ name: canonical, team });
        }
    };

    if (teams.length > 0) {
        teams.forEach(team => {
            (team.drivers || []).forEach(d => addDriver(d.name, team.name));
        });
    }
    if (championship?.drivers?.length > 0) {
        championship.drivers.forEach(d => {
            addDriver(typeof d === 'string' ? d : d.name);
        });
    }

    divisions.forEach(div => {
        (div.drivers || []).forEach(name => addDriver(name));
    });

    tracks.forEach(track => {
        const results = track?.results || {};
        const resultMaps = results.divisions && Object.keys(results.divisions).length > 0
            ? Object.values(results.divisions)
            : [results];
        resultMaps.forEach(r => {
            Object.keys(r?.racePositions || {}).forEach(name => addDriver(name));
        });
        Object.keys(track?.points || {}).forEach(name => addDriver(name));
    });

    return drivers;
}
