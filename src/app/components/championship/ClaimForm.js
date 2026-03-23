"use client";
import { useState } from 'react';
import { FirebaseService } from '../../services/firebaseService';

const HOURS_LIMIT = 48;

/** Verifica si una carrera sigue dentro del plazo de 48h para reclamaciones */
function isClaimable(track) {
    if (!track.date) return false;
    const raceDate = new Date(track.date);
    const diffHours = (Date.now() - raceDate.getTime()) / (1000 * 60 * 60);
    return diffHours >= 0 && diffHours <= HOURS_LIMIT;
}

/**
 * Formulario público para que los pilotos envíen reclamaciones de incidentes.
 * Se muestra como modal en la página pública del campeonato.
 * - Acepta múltiples infractores
 * - Solo disponible 48h después de la carrera
 * - Campos opcionales: URL de video, vuelta, minuto de carrera
 */
export default function ClaimForm({ championshipId, championship, teams = [], tracks = [], onClose, onSubmitted }) {
    const [form, setForm] = useState({
        reporterName: '',
        reporterPSN: '',
        accusedNames: [],
        trackId: '',
        trackName: '',
        round: null,
        lap: '',
        minute: '',
        description: '',
        evidence: ''
    });
    const [accusedInput, setAccusedInput] = useState('');
    const [saving, setSaving] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [errors, setErrors] = useState([]);

    const allDrivers = getAllDrivers(championship, teams);

    // Solo carreras con resultados y dentro del plazo de 48h
    const claimableTracks = tracks
        .filter(t => t.points && Object.keys(t.points).length > 0 && isClaimable(t))
        .sort((a, b) => new Date(b.date) - new Date(a.date));

    const handleTrackChange = (trackId) => {
        const track = claimableTracks.find(t => t.id === trackId);
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

    const validate = () => {
        const errs = [];
        if (!form.reporterName) errs.push('Selecciona tu nombre');
        if (form.accusedNames.length === 0) errs.push('Agrega al menos un piloto infractor');
        if (!form.trackId) errs.push('Selecciona la carrera del incidente');
        if (!form.description.trim()) errs.push('Escribe una descripción del incidente');
        return errs;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const errs = validate();
        if (errs.length > 0) { setErrors(errs); return; }
        if (form.accusedNames.includes(form.reporterName)) {
            setErrors(['No puedes reportarte a ti mismo']);
            return;
        }

        setSaving(true);
        try {
            await FirebaseService.createClaim(championshipId, {
                ...form,
                createdAt: new Date().toISOString()
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
                    <h3 className="text-xl font-bold text-white mb-2">Reclamación Enviada</h3>
                    <p className="text-gray-400 text-sm mb-6">
                        Tu reporte ha sido registrado y será revisado por los comisarios de carrera.
                        Recibirás una resolución próximamente.
                    </p>
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-all"
                    >
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
                        <h3 className="text-xl font-bold text-white">📩 Reportar Incidente</h3>
                        <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl">✕</button>
                    </div>
                    <p className="text-gray-400 text-sm mt-1">
                        Solo disponible hasta <strong className="text-orange-400">48 horas</strong> después de cada carrera
                    </p>
                </div>

                {claimableTracks.length === 0 && (
                    <div className="p-6 text-center">
                        <div className="text-4xl mb-3">⏰</div>
                        <p className="text-gray-300 font-medium">No hay carreras disponibles</p>
                        <p className="text-gray-500 text-sm mt-1">
                            Solo se puede reclamar dentro de las {HOURS_LIMIT} horas posteriores a la carrera
                        </p>
                        <button onClick={onClose} className="mt-4 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all">
                            Cerrar
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
                            <label className="text-gray-400 text-sm block mb-1">Tu nombre (piloto que reporta) *</label>
                            <select
                                value={form.reporterName}
                                onChange={e => setForm(prev => ({ ...prev, reporterName: e.target.value }))}
                                className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm"
                                required
                            >
                                <option value="" className="bg-slate-800">Seleccionar...</option>
                                {allDrivers.map(d => (
                                    <option key={d.name} value={d.name} className="bg-slate-800">{d.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* PSN (opcional) */}
                        <div>
                            <label className="text-gray-400 text-sm block mb-1">Tu PSN / ID (opcional)</label>
                            <input
                                type="text"
                                value={form.reporterPSN}
                                onChange={e => setForm(prev => ({ ...prev, reporterPSN: e.target.value }))}
                                className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm"
                                placeholder="PSN o identificador"
                            />
                        </div>

                        {/* Infractores (múltiples) */}
                        <div>
                            <label className="text-gray-400 text-sm block mb-1">Piloto(s) infractor(es) *</label>
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
                                    <option value="" className="bg-slate-800">Seleccionar piloto...</option>
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
                                    + Agregar
                                </button>
                            </div>
                            <p className="text-gray-600 text-xs mt-1">Puedes agregar más de un infractor</p>
                        </div>

                        {/* Carrera */}
                        <div>
                            <label className="text-gray-400 text-sm block mb-1">Carrera del incidente *</label>
                            <select
                                value={form.trackId}
                                onChange={e => handleTrackChange(e.target.value)}
                                className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm"
                                required
                            >
                                <option value="" className="bg-slate-800">Seleccionar...</option>
                                {claimableTracks.map(t => {
                                    const hoursAgo = Math.floor((Date.now() - new Date(t.date).getTime()) / (1000 * 60 * 60));
                                    return (
                                        <option key={t.id} value={t.id} className="bg-slate-800">
                                            R{t.round} - {t.name} ({hoursAgo}h atrás)
                                        </option>
                                    );
                                })}
                            </select>
                        </div>

                        {/* Vuelta / Minuto */}
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-gray-400 text-sm block mb-1">Vuelta (opcional)</label>
                                <input
                                    type="number"
                                    min="1"
                                    value={form.lap}
                                    onChange={e => setForm(prev => ({ ...prev, lap: e.target.value }))}
                                    className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm"
                                    placeholder="Ej: 15"
                                />
                            </div>
                            <div>
                                <label className="text-gray-400 text-sm block mb-1">Minuto de carrera (opcional)</label>
                                <input
                                    type="number"
                                    min="0"
                                    value={form.minute}
                                    onChange={e => setForm(prev => ({ ...prev, minute: e.target.value }))}
                                    className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm"
                                    placeholder="Ej: 43"
                                />
                            </div>
                        </div>
                        <p className="text-gray-600 text-xs -mt-2">Usa &quot;Vuelta&quot; para carreras por vueltas o &quot;Minuto&quot; para resistencia</p>

                        {/* Descripción */}
                        <div>
                            <label className="text-gray-400 text-sm block mb-1">Descripción del incidente *</label>
                            <textarea
                                value={form.description}
                                onChange={e => { setForm(prev => ({ ...prev, description: e.target.value })); setErrors([]); }}
                                className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm h-24 resize-none"
                                placeholder="Describe qué pasó, por qué consideras que fue una infracción..."
                                required
                            />
                        </div>

                        {/* URL del video */}
                        <div>
                            <label className="text-gray-400 text-sm block mb-1">
                                URL del video (recomendado)
                            </label>
                            <input
                                type="url"
                                value={form.evidence}
                                onChange={e => setForm(prev => ({ ...prev, evidence: e.target.value }))}
                                className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm"
                                placeholder="https://youtube.com/watch?v=..."
                            />
                            <p className="text-gray-600 text-xs mt-1">Incluye un clip de YouTube con el incidente para agilizar la revisión</p>
                        </div>

                        <div className="flex gap-3 justify-end pt-2">
                            <button type="button" onClick={onClose}
                                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all">
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                disabled={saving}
                                className="px-6 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-bold transition-all disabled:opacity-50"
                            >
                                {saving ? '⏳ Enviando...' : '📩 Enviar Reporte'}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}

function getAllDrivers(championship, teams) {
    const drivers = [];
    if (teams.length > 0) {
        teams.forEach(team => {
            (team.drivers || []).forEach(d => {
                drivers.push({ name: d.name, team: team.name });
            });
        });
    }
    if (championship?.drivers?.length > 0) {
        championship.drivers.forEach(d => {
            const name = typeof d === 'string' ? d : d.name;
            if (!drivers.find(x => x.name === name)) {
                drivers.push({ name, team: '' });
            }
        });
    }
    return drivers;
}
