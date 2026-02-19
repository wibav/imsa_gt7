"use client";
import { useState, useEffect } from 'react';
import { FirebaseService } from '../../services/firebaseService';
import {
    PENALTY_PRESETS, DEFAULT_PENALTIES_CONFIG,
    PENALTY_TYPE_CONFIG, SEVERITY_CONFIG, CLAIM_STATUS_CONFIG
} from '../../models/Penalty';

/**
 * Tab de Sanciones para el admin de campeonatos.
 * Incluye: configuración, catálogo de presets, aplicar sanciones, historial y reclamaciones.
 */
export default function PenaltiesTab({
    championshipId,
    championship,
    teams = [],
    tracks = [],
    onUpdate
}) {
    const [penalties, setPenalties] = useState([]);
    const [claims, setClaims] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeSection, setActiveSection] = useState('penalties'); // penalties | config | claims
    const [showApplyModal, setShowApplyModal] = useState(false);
    const [showClaimResolveModal, setShowClaimResolveModal] = useState(null);
    const [saving, setSaving] = useState(false);

    // Config local del sistema de sanciones
    const [config, setConfig] = useState({
        enabled: championship?.penaltiesConfig?.enabled ?? false,
        warningThreshold: championship?.penaltiesConfig?.warningThreshold ?? 8,
        autoDisqualifyThreshold: championship?.penaltiesConfig?.autoDisqualifyThreshold ?? 16,
        autoPointsPenalty: championship?.penaltiesConfig?.autoPointsPenalty ?? 10,
        allowClaims: championship?.penaltiesConfig?.allowClaims ?? false,
        presets: championship?.penaltiesConfig?.presets || DEFAULT_PENALTIES_CONFIG.presets
    });

    useEffect(() => {
        if (championshipId) loadData();
    }, [championshipId]);

    const loadData = async () => {
        if (!championshipId) return;
        setLoading(true);
        try {
            const [penaltiesData, claimsData] = await Promise.all([
                FirebaseService.getPenaltiesByChampionship(championshipId).catch(() => []),
                FirebaseService.getClaimsByChampionship(championshipId).catch(() => [])
            ]);
            setPenalties(penaltiesData);
            setClaims(claimsData);
        } catch (error) {
            console.error('Error loading penalties:', error);
        } finally {
            setLoading(false);
        }
    };

    // ── Guardar configuración ──
    const handleSaveConfig = async () => {
        setSaving(true);
        try {
            await FirebaseService.updateChampionship(championshipId, {
                penaltiesConfig: config
            });
            if (onUpdate) onUpdate();
            alert('✅ Configuración de sanciones guardada');
        } catch (error) {
            alert('❌ Error al guardar: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    // ── Toggle preset activo ──
    const handleTogglePreset = (presetId) => {
        setConfig(prev => ({
            ...prev,
            presets: prev.presets.map(p =>
                p.id === presetId ? { ...p, active: !p.active } : p
            )
        }));
    };

    // ── Editar valor de preset ──
    const handleEditPreset = (presetId, field, value) => {
        setConfig(prev => ({
            ...prev,
            presets: prev.presets.map(p =>
                p.id === presetId ? { ...p, [field]: value } : p
            )
        }));
    };

    // ── Revocar sanción ──
    const handleRevokePenalty = async (penaltyId) => {
        if (!confirm('¿Revocar esta sanción? Se eliminará su efecto en la clasificación.')) return;
        try {
            await FirebaseService.updatePenalty(championshipId, penaltyId, { status: 'revoked' });
            loadData();
            if (onUpdate) onUpdate();
        } catch (error) {
            alert('❌ Error: ' + error.message);
        }
    };

    // ── Eliminar sanción ──
    const handleDeletePenalty = async (penaltyId) => {
        if (!confirm('¿Eliminar permanentemente esta sanción?')) return;
        try {
            await FirebaseService.deletePenalty(championshipId, penaltyId);
            loadData();
            if (onUpdate) onUpdate();
        } catch (error) {
            alert('❌ Error: ' + error.message);
        }
    };

    // Obtener todos los pilotos
    const allDrivers = getAllDriversFromChampionship(championship, teams);
    const completedTracks = tracks.filter(t => t.points && Object.keys(t.points).length > 0);

    // Calcular resumen de warnings acumulados
    const warningsSummary = {};
    penalties.filter(p => p.status === 'applied').forEach(p => {
        if (!warningsSummary[p.driverName]) warningsSummary[p.driverName] = { warnings: 0, points: 0, count: 0 };
        warningsSummary[p.driverName].warnings += (p.warningPoints || 0);
        warningsSummary[p.driverName].points += (p.points || 0);
        warningsSummary[p.driverName].count += 1;
    });

    const pendingClaims = claims.filter(c => c.status === 'pending' || c.status === 'reviewing').length;

    if (loading) {
        return <div className="text-center py-12 text-gray-400">Cargando sanciones...</div>;
    }

    return (
        <div className="space-y-6">
            {/* Header con toggle principal */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                        ⚠️ Sistema de Sanciones
                    </h2>
                    <p className="text-gray-400 text-sm mt-1">
                        {penalties.filter(p => p.status === 'applied').length} sanciones activas
                        {pendingClaims > 0 && ` • ${pendingClaims} reclamaciones pendientes`}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={config.enabled}
                            onChange={(e) => setConfig(prev => ({ ...prev, enabled: e.target.checked }))}
                            className="w-5 h-5 rounded"
                        />
                        <span className="text-white font-medium">Sanciones habilitadas</span>
                    </label>
                    <button
                        onClick={handleSaveConfig}
                        disabled={saving}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium text-sm transition-all disabled:opacity-50"
                    >
                        {saving ? '⏳ Guardando...' : '💾 Guardar Config'}
                    </button>
                </div>
            </div>

            {!config.enabled && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-6 text-center">
                    <div className="text-4xl mb-2">⚠️</div>
                    <p className="text-yellow-300 font-medium">El sistema de sanciones está desactivado</p>
                    <p className="text-gray-400 text-sm mt-1">Actívalo para gestionar sanciones, amonestaciones y reclamaciones</p>
                </div>
            )}

            {config.enabled && (
                <>
                    {/* Sub-tabs */}
                    <div className="flex gap-2 border-b border-white/10 pb-2">
                        {[
                            { id: 'penalties', label: '⚠️ Sanciones', count: penalties.filter(p => p.status === 'applied').length },
                            { id: 'config', label: '⚙️ Configuración' },
                            { id: 'claims', label: '📩 Reclamaciones', count: pendingClaims || undefined }
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveSection(tab.id)}
                                className={`px-4 py-2 rounded-t-lg text-sm font-medium transition-all ${activeSection === tab.id
                                    ? 'bg-white/10 text-white border-b-2 border-orange-500'
                                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                                    }`}
                            >
                                {tab.label}
                                {tab.count > 0 && (
                                    <span className="ml-2 px-2 py-0.5 bg-red-500/30 text-red-300 text-xs rounded-full">{tab.count}</span>
                                )}
                            </button>
                        ))}
                    </div>

                    {/* ═══════ SECCIÓN: Sanciones ═══════ */}
                    {activeSection === 'penalties' && (
                        <div className="space-y-4">
                            {/* Botón aplicar nueva */}
                            <div className="flex justify-between items-center">
                                <h3 className="text-lg font-bold text-white">Historial de Sanciones</h3>
                                <button
                                    onClick={() => setShowApplyModal(true)}
                                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium text-sm transition-all"
                                >
                                    ➕ Aplicar Sanción
                                </button>
                            </div>

                            {/* Resumen de amonestaciones por piloto */}
                            {Object.keys(warningsSummary).length > 0 && (
                                <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                                    <h4 className="text-sm font-semibold text-gray-300 mb-3">📊 Amonestaciones Acumuladas</h4>
                                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                                        {Object.entries(warningsSummary)
                                            .sort(([, a], [, b]) => b.warnings - a.warnings)
                                            .map(([name, data]) => {
                                                const pct = config.warningThreshold > 0
                                                    ? Math.min(100, (data.warnings / config.warningThreshold) * 100)
                                                    : 0;
                                                const danger = pct >= 100;
                                                return (
                                                    <div key={name} className={`p-3 rounded-lg ${danger ? 'bg-red-500/20 border border-red-500/30' : 'bg-white/5'}`}>
                                                        <div className="text-white text-sm font-medium truncate">{name}</div>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                                                                <div
                                                                    className={`h-full rounded-full transition-all ${danger ? 'bg-red-500' : pct > 60 ? 'bg-orange-500' : 'bg-yellow-500'}`}
                                                                    style={{ width: `${pct}%` }}
                                                                />
                                                            </div>
                                                            <span className={`text-xs font-bold ${danger ? 'text-red-400' : 'text-gray-400'}`}>
                                                                {data.warnings}/{config.warningThreshold}
                                                            </span>
                                                        </div>
                                                        {data.points > 0 && (
                                                            <div className="text-red-400 text-xs mt-1">-{data.points} pts</div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                    </div>
                                </div>
                            )}

                            {/* Lista de sanciones */}
                            {penalties.length === 0 ? (
                                <div className="bg-white/5 border border-white/10 rounded-xl p-8 text-center">
                                    <div className="text-4xl mb-3">✅</div>
                                    <p className="text-gray-400">Sin sanciones registradas</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {penalties.map(penalty => {
                                        const typeConfig = PENALTY_TYPE_CONFIG[penalty.type] || PENALTY_TYPE_CONFIG.custom;
                                        const severityConfig = SEVERITY_CONFIG[penalty.severity] || SEVERITY_CONFIG.minor;
                                        const isRevoked = penalty.status === 'revoked';

                                        return (
                                            <div
                                                key={penalty.id}
                                                className={`bg-white/5 border rounded-xl p-4 transition-all ${isRevoked
                                                    ? 'border-gray-600/30 opacity-60'
                                                    : severityConfig.border
                                                    }`}
                                            >
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2 flex-wrap mb-1">
                                                            <span className="text-lg">{typeConfig.icon}</span>
                                                            <span className="text-white font-bold">{penalty.driverName}</span>
                                                            <span className={`text-xs px-2 py-0.5 rounded ${severityConfig.bg} ${severityConfig.color}`}>
                                                                {severityConfig.label}
                                                            </span>
                                                            {isRevoked && (
                                                                <span className="text-xs px-2 py-0.5 rounded bg-gray-500/30 text-gray-400 line-through">
                                                                    REVOCADA
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="text-white text-sm font-medium">{penalty.name}</div>
                                                        {penalty.description && (
                                                            <div className="text-gray-400 text-xs mt-1">{penalty.description}</div>
                                                        )}
                                                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                                                            {penalty.trackName && <span>🏁 R{penalty.round} - {penalty.trackName}</span>}
                                                            {penalty.lap && <span>🔄 Vuelta {penalty.lap}</span>}
                                                            <span>📅 {new Date(penalty.appliedAt).toLocaleDateString('es-ES')}</span>
                                                        </div>
                                                    </div>
                                                    <div className="text-right flex-shrink-0">
                                                        <div className="flex flex-col items-end gap-1">
                                                            {penalty.points > 0 && (
                                                                <span className="text-red-400 font-bold text-sm">-{penalty.points} pts</span>
                                                            )}
                                                            {penalty.warningPoints > 0 && (
                                                                <span className="text-yellow-400 text-xs">+{penalty.warningPoints} ⚠️</span>
                                                            )}
                                                            {penalty.timeSeconds > 0 && (
                                                                <span className="text-orange-400 text-xs">+{penalty.timeSeconds}s</span>
                                                            )}
                                                        </div>
                                                        {!isRevoked && (
                                                            <div className="flex gap-1 mt-2">
                                                                <button
                                                                    onClick={() => handleRevokePenalty(penalty.id)}
                                                                    className="text-xs px-2 py-1 bg-yellow-600/20 hover:bg-yellow-600/40 text-yellow-400 rounded transition-all"
                                                                    title="Revocar"
                                                                >
                                                                    ↩️
                                                                </button>
                                                                <button
                                                                    onClick={() => handleDeletePenalty(penalty.id)}
                                                                    className="text-xs px-2 py-1 bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded transition-all"
                                                                    title="Eliminar"
                                                                >
                                                                    🗑
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                {penalty.evidence && (
                                                    <div className="mt-2 pt-2 border-t border-white/10">
                                                        <span className="text-xs text-gray-500">📎 Evidencia: </span>
                                                        {penalty.evidence.startsWith('http') ? (
                                                            <a href={penalty.evidence} target="_blank" rel="noopener noreferrer"
                                                                className="text-xs text-blue-400 hover:underline">{penalty.evidence}</a>
                                                        ) : (
                                                            <span className="text-xs text-gray-300">{penalty.evidence}</span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ═══════ SECCIÓN: Configuración ═══════ */}
                    {activeSection === 'config' && (
                        <div className="space-y-6">
                            {/* Umbrales */}
                            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                                <h3 className="text-lg font-bold text-white mb-4">🔧 Configuración de Amonestaciones</h3>
                                <div className="grid sm:grid-cols-3 gap-4">
                                    <div>
                                        <label className="text-gray-400 text-sm block mb-1">Umbral de amonestaciones</label>
                                        <input
                                            type="number" min="1" max="50"
                                            value={config.warningThreshold}
                                            onChange={e => setConfig(prev => ({ ...prev, warningThreshold: parseInt(e.target.value) || 8 }))}
                                            className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white"
                                        />
                                        <p className="text-gray-500 text-xs mt-1">Al alcanzar este valor, se aplica penalización automática</p>
                                    </div>
                                    <div>
                                        <label className="text-gray-400 text-sm block mb-1">Puntos deducidos automáticamente</label>
                                        <input
                                            type="number" min="0" max="100"
                                            value={config.autoPointsPenalty}
                                            onChange={e => setConfig(prev => ({ ...prev, autoPointsPenalty: parseInt(e.target.value) || 10 }))}
                                            className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white"
                                        />
                                        <p className="text-gray-500 text-xs mt-1">Puntos restados al alcanzar umbral</p>
                                    </div>
                                    <div>
                                        <label className="text-gray-400 text-sm block mb-1">Umbral descalificación</label>
                                        <input
                                            type="number" min="1" max="100"
                                            value={config.autoDisqualifyThreshold}
                                            onChange={e => setConfig(prev => ({ ...prev, autoDisqualifyThreshold: parseInt(e.target.value) || 16 }))}
                                            className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white"
                                        />
                                        <p className="text-gray-500 text-xs mt-1">Puntos de amonestación para descalificación</p>
                                    </div>
                                </div>
                            </div>

                            {/* Toggle reclamaciones */}
                            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="text-lg font-bold text-white">📩 Reclamaciones Públicas</h3>
                                        <p className="text-gray-400 text-sm mt-1">
                                            Permitir que los pilotos envíen reportes de incidentes
                                        </p>
                                    </div>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={config.allowClaims}
                                            onChange={(e) => setConfig(prev => ({ ...prev, allowClaims: e.target.checked }))}
                                            className="w-5 h-5 rounded"
                                        />
                                        <span className="text-white">Activar</span>
                                    </label>
                                </div>
                            </div>

                            {/* Catálogo de Presets */}
                            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                                <h3 className="text-lg font-bold text-white mb-4">📋 Catálogo de Sanciones Predefinidas</h3>
                                <p className="text-gray-400 text-sm mb-4">
                                    Activa/desactiva y personaliza los valores de cada tipo de sanción
                                </p>
                                <div className="space-y-3">
                                    {config.presets.map(preset => (
                                        <div
                                            key={preset.id}
                                            className={`border rounded-xl p-4 transition-all ${preset.active
                                                ? 'bg-white/5 border-white/20'
                                                : 'bg-white/2 border-white/5 opacity-50'
                                                }`}
                                        >
                                            <div className="flex items-center justify-between gap-4">
                                                <div className="flex items-center gap-3 flex-1">
                                                    <label className="cursor-pointer flex items-center gap-3">
                                                        <input
                                                            type="checkbox"
                                                            checked={preset.active}
                                                            onChange={() => handleTogglePreset(preset.id)}
                                                            className="w-4 h-4 rounded"
                                                        />
                                                        <span className="text-xl">{preset.icon}</span>
                                                        <div>
                                                            <span className="text-white font-medium text-sm">{preset.name}</span>
                                                            <span className="text-gray-500 text-xs block">{preset.description}</span>
                                                        </div>
                                                    </label>
                                                </div>
                                                {preset.active && (
                                                    <div className="flex items-center gap-3 flex-shrink-0">
                                                        <div className="flex items-center gap-1">
                                                            <span className="text-red-400 text-xs">Pts:</span>
                                                            <input
                                                                type="number" min="0" max="50"
                                                                value={preset.points}
                                                                onChange={e => handleEditPreset(preset.id, 'points', parseInt(e.target.value) || 0)}
                                                                className="w-14 bg-white/10 border border-white/20 rounded px-2 py-1 text-white text-xs text-center"
                                                            />
                                                        </div>
                                                        <div className="flex items-center gap-1">
                                                            <span className="text-yellow-400 text-xs">⚠️:</span>
                                                            <input
                                                                type="number" min="0" max="10"
                                                                value={preset.warningPoints}
                                                                onChange={e => handleEditPreset(preset.id, 'warningPoints', parseInt(e.target.value) || 0)}
                                                                className="w-14 bg-white/10 border border-white/20 rounded px-2 py-1 text-white text-xs text-center"
                                                            />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="mt-4 text-right">
                                    <button
                                        onClick={() => setConfig(prev => ({
                                            ...prev,
                                            presets: DEFAULT_PENALTIES_CONFIG.presets.map(p => ({ ...p, active: true }))
                                        }))}
                                        className="text-xs text-gray-400 hover:text-white transition-colors"
                                    >
                                        🔄 Restaurar valores por defecto
                                    </button>
                                </div>
                            </div>

                            <div className="text-right">
                                <button
                                    onClick={handleSaveConfig}
                                    disabled={saving}
                                    className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold transition-all disabled:opacity-50"
                                >
                                    {saving ? '⏳ Guardando...' : '💾 Guardar Configuración'}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ═══════ SECCIÓN: Reclamaciones ═══════ */}
                    {activeSection === 'claims' && (
                        <ClaimsSection
                            claims={claims}
                            championshipId={championshipId}
                            allDrivers={allDrivers}
                            tracks={completedTracks}
                            config={config}
                            onReload={loadData}
                            onUpdate={onUpdate}
                        />
                    )}
                </>
            )}

            {/* ═══════ MODAL: Aplicar Sanción ═══════ */}
            {showApplyModal && (
                <ApplyPenaltyModal
                    championshipId={championshipId}
                    allDrivers={allDrivers}
                    tracks={completedTracks}
                    presets={config.presets.filter(p => p.active)}
                    onClose={() => setShowApplyModal(false)}
                    onSaved={() => { loadData(); if (onUpdate) onUpdate(); }}
                />
            )}
        </div>
    );
}

// ═══════════════════════════════════════════════
// MODAL: Aplicar Sanción
// ═══════════════════════════════════════════════
function ApplyPenaltyModal({ championshipId, allDrivers, tracks, presets, onClose, onSaved }) {
    const [mode, setMode] = useState('preset'); // preset | custom
    const [selectedPreset, setSelectedPreset] = useState(null);
    const [form, setForm] = useState({
        driverName: '',
        teamName: '',
        trackId: '',
        trackName: '',
        round: null,
        name: '',
        description: '',
        type: 'points',
        severity: 'moderate',
        points: 0,
        warningPoints: 0,
        timeSeconds: 0,
        lap: '',
        incident: '',
        evidence: ''
    });
    const [saving, setSaving] = useState(false);

    // Cuando selecciona un preset, rellenar el form
    const handleSelectPreset = (preset) => {
        setSelectedPreset(preset);
        setForm(prev => ({
            ...prev,
            name: preset.name,
            description: preset.description,
            type: preset.type,
            severity: preset.severity,
            points: preset.points || 0,
            warningPoints: preset.warningPoints || 0,
            timeSeconds: preset.timeSeconds || 0
        }));
    };

    // Cuando cambia el piloto, auto-rellenar equipo
    const handleDriverChange = (name) => {
        const driver = allDrivers.find(d => d.name === name);
        setForm(prev => ({ ...prev, driverName: name, teamName: driver?.team || '' }));
    };

    // Cuando cambia la carrera, auto-rellenar datos
    const handleTrackChange = (trackId) => {
        const track = tracks.find(t => t.id === trackId);
        setForm(prev => ({
            ...prev,
            trackId,
            trackName: track?.name || '',
            round: track?.round || null
        }));
    };

    const handleSubmit = async () => {
        if (!form.driverName) return alert('Selecciona un piloto');
        if (!form.name) return alert('Nombre de sanción requerido');

        setSaving(true);
        try {
            await FirebaseService.createPenalty(championshipId, {
                ...form,
                presetId: selectedPreset?.id || null,
                appliedAt: new Date().toISOString()
            });
            onSaved();
            onClose();
        } catch (error) {
            alert('❌ Error: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
            <div className="bg-slate-800 rounded-2xl border border-white/20 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <div className="p-6 border-b border-white/10">
                    <div className="flex justify-between items-center">
                        <h3 className="text-xl font-bold text-white">⚠️ Aplicar Sanción</h3>
                        <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl">✕</button>
                    </div>
                </div>

                <div className="p-6 space-y-4">
                    {/* Modo: Preset o Custom */}
                    <div className="flex gap-2">
                        <button
                            onClick={() => setMode('preset')}
                            className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all ${mode === 'preset' ? 'bg-orange-600 text-white' : 'bg-white/10 text-gray-300'}`}
                        >
                            📋 Usar Preset
                        </button>
                        <button
                            onClick={() => { setMode('custom'); setSelectedPreset(null); }}
                            className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all ${mode === 'custom' ? 'bg-purple-600 text-white' : 'bg-white/10 text-gray-300'}`}
                        >
                            ⚙️ Personalizada
                        </button>
                    </div>

                    {/* Selector de preset */}
                    {mode === 'preset' && (
                        <div className="grid grid-cols-2 gap-2">
                            {presets.map(preset => (
                                <button
                                    key={preset.id}
                                    onClick={() => handleSelectPreset(preset)}
                                    className={`p-3 rounded-lg text-left text-sm transition-all border ${selectedPreset?.id === preset.id
                                        ? 'bg-orange-600/20 border-orange-500/50 text-white'
                                        : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
                                        }`}
                                >
                                    <div className="flex items-center gap-2">
                                        <span>{preset.icon}</span>
                                        <span className="font-medium">{preset.name}</span>
                                    </div>
                                    <div className="text-xs text-gray-500 mt-1">
                                        {preset.points > 0 && <span className="text-red-400">-{preset.points}pts </span>}
                                        {preset.warningPoints > 0 && <span className="text-yellow-400">+{preset.warningPoints}⚠️</span>}
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Campos custom */}
                    {mode === 'custom' && (
                        <div className="grid grid-cols-2 gap-3">
                            <div className="col-span-2">
                                <label className="text-gray-400 text-sm block mb-1">Nombre de la sanción</label>
                                <input
                                    type="text"
                                    value={form.name}
                                    onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                                    className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm"
                                    placeholder="Ej: Contacto en curva 3"
                                />
                            </div>
                            <div>
                                <label className="text-gray-400 text-sm block mb-1">Tipo</label>
                                <select
                                    value={form.type}
                                    onChange={e => setForm(prev => ({ ...prev, type: e.target.value }))}
                                    className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm"
                                >
                                    {Object.entries(PENALTY_TYPE_CONFIG).map(([key, val]) => (
                                        <option key={key} value={key} className="bg-slate-800">{val.icon} {val.label}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="text-gray-400 text-sm block mb-1">Severidad</label>
                                <select
                                    value={form.severity}
                                    onChange={e => setForm(prev => ({ ...prev, severity: e.target.value }))}
                                    className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm"
                                >
                                    {Object.entries(SEVERITY_CONFIG).map(([key, val]) => (
                                        <option key={key} value={key} className="bg-slate-800">{val.label}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="text-gray-400 text-sm block mb-1">Puntos a deducir</label>
                                <input type="number" min="0" max="50"
                                    value={form.points}
                                    onChange={e => setForm(prev => ({ ...prev, points: parseInt(e.target.value) || 0 }))}
                                    className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm"
                                />
                            </div>
                            <div>
                                <label className="text-gray-400 text-sm block mb-1">Pts amonestación</label>
                                <input type="number" min="0" max="10"
                                    value={form.warningPoints}
                                    onChange={e => setForm(prev => ({ ...prev, warningPoints: parseInt(e.target.value) || 0 }))}
                                    className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm"
                                />
                            </div>
                        </div>
                    )}

                    {/* Campos comunes */}
                    <div className="border-t border-white/10 pt-4 space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-gray-400 text-sm block mb-1">Piloto *</label>
                                <select
                                    value={form.driverName}
                                    onChange={e => handleDriverChange(e.target.value)}
                                    className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm"
                                >
                                    <option value="" className="bg-slate-800">Seleccionar piloto...</option>
                                    {allDrivers.map(d => (
                                        <option key={d.name} value={d.name} className="bg-slate-800">{d.name} {d.team ? `(${d.team})` : ''}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="text-gray-400 text-sm block mb-1">Carrera (opcional)</label>
                                <select
                                    value={form.trackId}
                                    onChange={e => handleTrackChange(e.target.value)}
                                    className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm"
                                >
                                    <option value="" className="bg-slate-800">General (sin carrera)</option>
                                    {tracks.map(t => (
                                        <option key={t.id} value={t.id} className="bg-slate-800">R{t.round} - {t.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-gray-400 text-sm block mb-1">Vuelta (opcional)</label>
                                <input type="text" value={form.lap}
                                    onChange={e => setForm(prev => ({ ...prev, lap: e.target.value }))}
                                    className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm"
                                    placeholder="Ej: 15"
                                />
                            </div>
                            <div>
                                <label className="text-gray-400 text-sm block mb-1">Evidencia (URL)</label>
                                <input type="text" value={form.evidence}
                                    onChange={e => setForm(prev => ({ ...prev, evidence: e.target.value }))}
                                    className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm"
                                    placeholder="Link a video o imagen"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="text-gray-400 text-sm block mb-1">Descripción del incidente</label>
                            <textarea
                                value={form.incident || form.description}
                                onChange={e => setForm(prev => ({ ...prev, incident: e.target.value, description: e.target.value }))}
                                className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm h-20 resize-none"
                                placeholder="Describir qué pasó..."
                            />
                        </div>
                    </div>

                    {/* Resumen de la sanción */}
                    {form.driverName && form.name && (
                        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
                            <h4 className="text-red-400 font-bold text-sm mb-2">Resumen de Sanción</h4>
                            <div className="text-white text-sm space-y-1">
                                <div>👤 <strong>{form.driverName}</strong> {form.teamName && `(${form.teamName})`}</div>
                                <div>⚠️ {form.name}</div>
                                {form.trackName && <div>🏁 {form.trackName}</div>}
                                <div className="flex gap-4 mt-1">
                                    {form.points > 0 && <span className="text-red-400 font-bold">-{form.points} puntos</span>}
                                    {form.warningPoints > 0 && <span className="text-yellow-400">+{form.warningPoints} amonestación</span>}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-6 border-t border-white/10 flex gap-3 justify-end">
                    <button onClick={onClose}
                        className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all">
                        Cancelar
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={saving || !form.driverName || !form.name}
                        className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold transition-all disabled:opacity-50"
                    >
                        {saving ? '⏳ Aplicando...' : '⚠️ Aplicar Sanción'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════
// SECCIÓN: Reclamaciones
// ═══════════════════════════════════════════════
function ClaimsSection({ claims, championshipId, allDrivers, tracks, config, onReload, onUpdate }) {
    const [resolveModal, setResolveModal] = useState(null);

    if (!config.allowClaims) {
        return (
            <div className="bg-white/5 border border-white/10 rounded-xl p-8 text-center">
                <div className="text-4xl mb-3">📩</div>
                <p className="text-gray-400">Las reclamaciones públicas están desactivadas</p>
                <p className="text-gray-500 text-sm mt-1">Actívalas en la sección de Configuración</p>
            </div>
        );
    }

    const handleUpdateClaimStatus = async (claimId, status) => {
        try {
            await FirebaseService.updateClaim(championshipId, claimId, { status });
            onReload();
        } catch (error) {
            alert('❌ Error: ' + error.message);
        }
    };

    const handleResolveClaim = async (claimId, resolution, penaltyData) => {
        try {
            const updates = {
                status: 'resolved',
                resolution,
                resolvedAt: new Date().toISOString()
            };

            // Si se aplica sanción desde la reclamación
            if (penaltyData) {
                const result = await FirebaseService.createPenalty(championshipId, {
                    ...penaltyData,
                    claimId
                });
                updates.penaltyId = result.id;
                updates.status = 'accepted';
            } else {
                updates.status = 'rejected';
            }

            await FirebaseService.updateClaim(championshipId, claimId, updates);
            onReload();
            if (onUpdate) onUpdate();
            setResolveModal(null);
        } catch (error) {
            alert('❌ Error: ' + error.message);
        }
    };

    return (
        <div className="space-y-4">
            <h3 className="text-lg font-bold text-white">📩 Reclamaciones Recibidas</h3>

            {claims.length === 0 ? (
                <div className="bg-white/5 border border-white/10 rounded-xl p-8 text-center">
                    <div className="text-4xl mb-3">📭</div>
                    <p className="text-gray-400">Sin reclamaciones</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {claims.map(claim => {
                        const statusCfg = CLAIM_STATUS_CONFIG[claim.status] || CLAIM_STATUS_CONFIG.pending;
                        return (
                            <div key={claim.id} className="bg-white/5 border border-white/10 rounded-xl p-4">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 flex-wrap mb-1">
                                            <span className={`text-xs px-2 py-0.5 rounded ${statusCfg.bg} ${statusCfg.color}`}>
                                                {statusCfg.label}
                                            </span>
                                            <span className="text-white font-bold text-sm">
                                                {claim.reporterName} → {claim.accusedName}
                                            </span>
                                        </div>
                                        {claim.trackName && (
                                            <div className="text-gray-500 text-xs mb-1">🏁 R{claim.round} - {claim.trackName} {claim.lap && `• Vuelta ${claim.lap}`}</div>
                                        )}
                                        <p className="text-gray-300 text-sm">{claim.description}</p>
                                        {claim.evidence && (
                                            <div className="mt-1">
                                                {claim.evidence.startsWith('http') ? (
                                                    <a href={claim.evidence} target="_blank" rel="noopener noreferrer"
                                                        className="text-xs text-blue-400 hover:underline">📎 Ver evidencia</a>
                                                ) : (
                                                    <span className="text-xs text-gray-400">📎 {claim.evidence}</span>
                                                )}
                                            </div>
                                        )}
                                        {claim.resolution && (
                                            <div className="mt-2 p-2 bg-white/5 rounded text-xs text-gray-300">
                                                💬 <strong>Resolución:</strong> {claim.resolution}
                                            </div>
                                        )}
                                        <div className="text-gray-600 text-xs mt-2">
                                            📅 {new Date(claim.createdAt).toLocaleDateString('es-ES')}
                                        </div>
                                    </div>
                                    {(claim.status === 'pending' || claim.status === 'reviewing') && (
                                        <div className="flex flex-col gap-1">
                                            {claim.status === 'pending' && (
                                                <button
                                                    onClick={() => handleUpdateClaimStatus(claim.id, 'reviewing')}
                                                    className="text-xs px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 rounded transition-all"
                                                >
                                                    🔍 Revisar
                                                </button>
                                            )}
                                            <button
                                                onClick={() => setResolveModal(claim)}
                                                className="text-xs px-3 py-1.5 bg-green-600/20 hover:bg-green-600/40 text-green-400 rounded transition-all"
                                            >
                                                ✅ Resolver
                                            </button>
                                            <button
                                                onClick={() => handleResolveClaim(claim.id, 'Rechazada sin méritos', null)}
                                                className="text-xs px-3 py-1.5 bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded transition-all"
                                            >
                                                ❌ Rechazar
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Modal resolver reclamación */}
            {resolveModal && (
                <ResolveClaimModal
                    claim={resolveModal}
                    allDrivers={allDrivers}
                    tracks={tracks}
                    presets={config.presets?.filter(p => p.active) || []}
                    onClose={() => setResolveModal(null)}
                    onResolve={handleResolveClaim}
                />
            )}
        </div>
    );
}

// ═══════════════════════════════════════════════
// MODAL: Resolver Reclamación
// ═══════════════════════════════════════════════
function ResolveClaimModal({ claim, allDrivers, tracks, presets, onClose, onResolve }) {
    const [resolution, setResolution] = useState('');
    const [applyPenalty, setApplyPenalty] = useState(false);
    const [selectedPreset, setSelectedPreset] = useState(null);
    const [saving, setSaving] = useState(false);

    const handleSubmit = async () => {
        if (!resolution) return alert('Escribe una resolución');
        setSaving(true);

        let penaltyData = null;
        if (applyPenalty && selectedPreset) {
            penaltyData = {
                driverName: claim.accusedName,
                teamName: allDrivers.find(d => d.name === claim.accusedName)?.team || '',
                trackId: claim.trackId,
                trackName: claim.trackName,
                round: claim.round,
                name: selectedPreset.name,
                description: resolution,
                type: selectedPreset.type,
                severity: selectedPreset.severity,
                points: selectedPreset.points || 0,
                warningPoints: selectedPreset.warningPoints || 0,
                timeSeconds: selectedPreset.timeSeconds || 0,
                lap: claim.lap,
                incident: claim.description,
                evidence: claim.evidence
            };
        }

        await onResolve(claim.id, resolution, penaltyData);
        setSaving(false);
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
            <div className="bg-slate-800 rounded-2xl border border-white/20 w-full max-w-lg max-h-[90vh] overflow-y-auto">
                <div className="p-6 border-b border-white/10">
                    <div className="flex justify-between items-center">
                        <h3 className="text-lg font-bold text-white">✅ Resolver Reclamación</h3>
                        <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl">✕</button>
                    </div>
                </div>

                <div className="p-6 space-y-4">
                    {/* Resumen de la reclamación */}
                    <div className="bg-white/5 border border-white/10 rounded-lg p-3 text-sm">
                        <div className="text-gray-400">
                            <strong className="text-white">{claim.reporterName}</strong> reportó a{' '}
                            <strong className="text-white">{claim.accusedName}</strong>
                        </div>
                        <div className="text-gray-500 text-xs mt-1">{claim.description}</div>
                    </div>

                    <div>
                        <label className="text-gray-400 text-sm block mb-1">Resolución *</label>
                        <textarea
                            value={resolution}
                            onChange={e => setResolution(e.target.value)}
                            className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm h-20 resize-none"
                            placeholder="Describir la resolución..."
                        />
                    </div>

                    {/* Toggle aplicar sanción */}
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={applyPenalty}
                            onChange={e => setApplyPenalty(e.target.checked)}
                            className="w-4 h-4 rounded"
                        />
                        <span className="text-white text-sm">Aplicar sanción al piloto reportado</span>
                    </label>

                    {applyPenalty && (
                        <div className="grid grid-cols-2 gap-2">
                            {presets.map(preset => (
                                <button
                                    key={preset.id}
                                    onClick={() => setSelectedPreset(preset)}
                                    className={`p-2 rounded-lg text-left text-xs transition-all border ${selectedPreset?.id === preset.id
                                        ? 'bg-red-600/20 border-red-500/50'
                                        : 'bg-white/5 border-white/10 hover:bg-white/10'
                                        }`}
                                >
                                    <span>{preset.icon} {preset.name}</span>
                                    <div className="text-gray-500 mt-0.5">
                                        {preset.points > 0 && <span className="text-red-400">-{preset.points}pts </span>}
                                        {preset.warningPoints > 0 && <span className="text-yellow-400">+{preset.warningPoints}⚠️</span>}
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <div className="p-6 border-t border-white/10 flex gap-3 justify-end">
                    <button onClick={onClose}
                        className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all">
                        Cancelar
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={saving || !resolution}
                        className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold transition-all disabled:opacity-50"
                    >
                        {saving ? '⏳...' : applyPenalty ? '⚠️ Resolver + Sancionar' : '✅ Resolver'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════
// Helper: extraer pilotos del campeonato
// ═══════════════════════════════════════════════
function getAllDriversFromChampionship(championship, teams) {
    const drivers = [];
    if (teams.length > 0) {
        teams.forEach(team => {
            (team.drivers || []).forEach(d => {
                drivers.push({ name: d.name, team: team.name, teamColor: team.color });
            });
        });
    }
    if (championship?.drivers?.length > 0) {
        championship.drivers.forEach(d => {
            const name = typeof d === 'string' ? d : d.name;
            if (!drivers.find(x => x.name === name)) {
                drivers.push({ name, team: '', teamColor: '' });
            }
        });
    }
    return drivers;
}
