"use client";
import { useState } from 'react';
import { FirebaseService } from '../../services/firebaseService';

/**
 * Formulario público para que los pilotos envíen reclamaciones de incidentes.
 * Se muestra como modal en la página pública del campeonato.
 */
export default function ClaimForm({ championshipId, championship, teams = [], tracks = [], onClose, onSubmitted }) {
    const [form, setForm] = useState({
        reporterName: '',
        reporterPSN: '',
        accusedName: '',
        trackId: '',
        trackName: '',
        round: null,
        lap: '',
        description: '',
        evidence: ''
    });
    const [saving, setSaving] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    const allDrivers = getAllDrivers(championship, teams);
    const completedTracks = tracks.filter(t => t.points && Object.keys(t.points).length > 0);

    const handleTrackChange = (trackId) => {
        const track = completedTracks.find(t => t.id === trackId);
        setForm(prev => ({
            ...prev,
            trackId,
            trackName: track?.name || '',
            round: track?.round || null
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.reporterName || !form.accusedName || !form.description) {
            alert('Completa los campos obligatorios');
            return;
        }
        if (form.reporterName === form.accusedName) {
            alert('No puedes reportarte a ti mismo');
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
            alert('❌ Error al enviar: ' + error.message);
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
                        Tu reporte ha sido registrado y será revisado por los directores de carrera.
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
                        Envía un reporte de incidente para que los directores de carrera lo revisen
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
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

                    {/* Piloto reportado */}
                    <div>
                        <label className="text-gray-400 text-sm block mb-1">Piloto reportado *</label>
                        <select
                            value={form.accusedName}
                            onChange={e => setForm(prev => ({ ...prev, accusedName: e.target.value }))}
                            className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm"
                            required
                        >
                            <option value="" className="bg-slate-800">Seleccionar...</option>
                            {allDrivers
                                .filter(d => d.name !== form.reporterName)
                                .map(d => (
                                    <option key={d.name} value={d.name} className="bg-slate-800">{d.name}</option>
                                ))}
                        </select>
                    </div>

                    {/* Carrera */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-gray-400 text-sm block mb-1">Carrera</label>
                            <select
                                value={form.trackId}
                                onChange={e => handleTrackChange(e.target.value)}
                                className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm"
                            >
                                <option value="" className="bg-slate-800">Seleccionar...</option>
                                {completedTracks.map(t => (
                                    <option key={t.id} value={t.id} className="bg-slate-800">R{t.round} - {t.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="text-gray-400 text-sm block mb-1">Vuelta (opcional)</label>
                            <input
                                type="text"
                                value={form.lap}
                                onChange={e => setForm(prev => ({ ...prev, lap: e.target.value }))}
                                className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm"
                                placeholder="Ej: 15"
                            />
                        </div>
                    </div>

                    {/* Descripción */}
                    <div>
                        <label className="text-gray-400 text-sm block mb-1">Descripción del incidente *</label>
                        <textarea
                            value={form.description}
                            onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
                            className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm h-24 resize-none"
                            placeholder="Describe qué pasó, por qué consideras que fue una infracción..."
                            required
                        />
                    </div>

                    {/* Evidencia */}
                    <div>
                        <label className="text-gray-400 text-sm block mb-1">Evidencia (URL de video/imagen)</label>
                        <input
                            type="url"
                            value={form.evidence}
                            onChange={e => setForm(prev => ({ ...prev, evidence: e.target.value }))}
                            className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm"
                            placeholder="https://youtube.com/watch?v=..."
                        />
                        <p className="text-gray-600 text-xs mt-1">Recomendado: incluir clip de video del incidente</p>
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
