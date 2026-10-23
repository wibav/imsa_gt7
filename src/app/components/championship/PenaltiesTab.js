"use client";
import { useState, useEffect, useRef } from 'react';
import { FirebaseService } from '../../services/firebaseService';
import {
    PENALTY_PRESETS, DEFAULT_PENALTIES_CONFIG,
    PENALTY_TYPE_CONFIG, SEVERITY_CONFIG, CLAIM_STATUS_CONFIG, APPEAL_STATUS_CONFIG,
    isPenaltyCounting, NIVELES_DANOS,
} from '../../models/Penalty';
import { notifyPenaltyApplied, notifyClaimResolved, notifyAppealResolved } from '../../utils/telegram';
import { useAuth } from '../../context/AuthContext';
import ModalPortal from '../common/ModalPortal';
import SancionDetalle, { puntosBase, resumenPreset, cambiaResultado, EfectoSancion } from './SancionDetalle';

/**
 * Tab de Sanciones para el admin de campeonatos.
 * Incluye: configuración, catálogo de presets, aplicar sanciones, historial y reclamaciones.
 */
export default function PenaltiesTab({
    championshipId,
    championship,
    teams = [],
    tracks = [],
    onUpdate,
    isAdminUser = false
}) {
    const [penalties, setPenalties] = useState([]);
    const [claims, setClaims] = useState([]);
    const [appeals, setAppeals] = useState([]);
    const [loading, setLoading] = useState(true);
    // Comisarios aterrizan en 'claims'; admins en 'penalties'
    const [activeSection, setActiveSection] = useState(isAdminUser ? 'penalties' : 'claims'); // penalties | config | claims
    const activeTabRef = useRef(null);
    // Auto-scroll a la pestaña activa (relevante para el comisario, que
    // aterriza en 'claims' — la última de la lista). `block:'nearest'` evita
    // que el navegador desplace verticalmente toda la página al montar.
    useEffect(() => {
        activeTabRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }, [activeSection]);
    const [showApplyModal, setShowApplyModal] = useState(false);
    const [showClaimResolveModal, setShowClaimResolveModal] = useState(null);
    const [saving, setSaving] = useState(false);
    // La organización de ESTE campeonato, no la de la sesión del usuario que
    // lo está administrando — useOrganization() resolvía por los claims del
    // caller (con fallback ambiguo para usuarios multi-org/platformOwner),
    // lo que podía mostrar el plan/billingExempt de la org equivocada (ej.
    // el botón de sugerencia de IA reflejando gt7-esp en vez del campeonato
    // real que se está viendo). El backend ya resolvía correctamente por
    // championship.orgId; esto alinea el frontend con el mismo criterio.
    const [org, setOrg] = useState(null);
    useEffect(() => {
        if (!championship?.orgId) { setOrg(null); return; }
        FirebaseService.getOrganization(championship.orgId).then(setOrg);
    }, [championship?.orgId]);

    // Config local del sistema de sanciones
    // ⚠️ handleSaveConfig sobrescribe TODO el objeto penaltiesConfig con este
    // useState (sin merge). Cualquier campo que exista en Firestore pero no
    // esté declarado aquí se BORRA en silencio al guardar — por eso
    // allowAppeals/appealWindowHours deben estar aquí, no solo en el JSX.
    const [config, setConfig] = useState({
        enabled: championship?.penaltiesConfig?.enabled ?? false,
        warningThreshold: championship?.penaltiesConfig?.warningThreshold ?? 8,
        autoDisqualifyThreshold: championship?.penaltiesConfig?.autoDisqualifyThreshold ?? 16,
        autoPointsPenalty: championship?.penaltiesConfig?.autoPointsPenalty ?? 10,
        allowClaims: championship?.penaltiesConfig?.allowClaims ?? false,
        allowAppeals: championship?.penaltiesConfig?.allowAppeals ?? DEFAULT_PENALTIES_CONFIG.allowAppeals,
        appealWindowHours: championship?.penaltiesConfig?.appealWindowHours ?? DEFAULT_PENALTIES_CONFIG.appealWindowHours,
        presets: championship?.penaltiesConfig?.presets || DEFAULT_PENALTIES_CONFIG.presets,
        // Criterio no escrito de los comisarios: la IA lo recibe junto al reglamento
        stewardCriteria: championship?.penaltiesConfig?.stewardCriteria || ''
    });

    useEffect(() => {
        if (championshipId) loadData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [championshipId]);

    // silencioso: refresca sin pasar por el esqueleto de carga, que desmontaría
    // un modal abierto (p. ej. al añadir evidencia mientras se resuelve).
    const loadData = async (silencioso = false) => {
        if (!championshipId) return;
        if (!silencioso) setLoading(true);
        try {
            const [penaltiesData, claimsData, appealsData] = await Promise.all([
                FirebaseService.getPenaltiesByChampionship(championshipId).catch(() => []),
                FirebaseService.getClaimsByChampionship(championshipId).catch(() => []),
                FirebaseService.getAppealsByChampionship(championshipId).catch(() => [])
            ]);
            setPenalties(penaltiesData);
            setClaims(claimsData);
            setAppeals(appealsData);
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
    penalties.filter(p => isPenaltyCounting(p)).forEach(p => {
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
                        {penalties.filter(p => isPenaltyCounting(p)).length} sanciones activas
                        {pendingClaims > 0 && ` • ${pendingClaims} reclamaciones pendientes`}
                    </p>
                </div>
                <div className="flex items-center gap-3 flex-wrap w-full sm:w-auto justify-end">
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
                    <div className="flex gap-2 overflow-x-auto border-b border-white/10 pb-2">
                        {[
                            { id: 'penalties', label: '⚠️ Sanciones', count: penalties.filter(p => isPenaltyCounting(p)).length },
                            ...(isAdminUser ? [{ id: 'config', label: '⚙️ Configuración' }] : []),
                            { id: 'claims', label: '📩 Reclamaciones', count: pendingClaims || undefined }
                        ].map(tab => (
                            <button
                                key={tab.id}
                                ref={activeSection === tab.id ? activeTabRef : null}
                                onClick={() => setActiveSection(tab.id)}
                                className={`px-4 py-2 rounded-t-lg text-sm font-medium whitespace-nowrap flex-shrink-0 transition-all ${activeSection === tab.id
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
                                                            {penalty.status === 'appealed' && (
                                                                <span className="text-xs px-2 py-0.5 rounded bg-purple-500/20 text-purple-300">
                                                                    ⚖️ En disputa
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
                                                        <EfectoSancion penalty={penalty} />
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
                                                        <span className="inline-flex flex-wrap gap-x-3">
                                                            {penalty.evidence.split('\n').filter(Boolean).map((url, i) => (
                                                                url.startsWith('http') ? (
                                                                    <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                                                                        className="text-xs text-blue-400 hover:underline">{url}</a>
                                                                ) : (
                                                                    <span key={i} className="text-xs text-gray-300">{url}</span>
                                                                )
                                                            ))}
                                                        </span>
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
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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

                            {/* Toggle alegaciones (apelaciones) — CA-3.4/CA-3.7 */}
                            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                    <div>
                                        <h3 className="text-lg font-bold text-white">⚖️ Alegaciones</h3>
                                        <p className="text-gray-400 text-sm mt-1">
                                            Permitir que el piloto sancionado (o el reclamante rechazado) alegue contra una resolución
                                        </p>
                                    </div>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={config.allowAppeals}
                                            onChange={(e) => setConfig(prev => ({ ...prev, allowAppeals: e.target.checked }))}
                                            className="w-5 h-5 rounded"
                                        />
                                        <span className="text-white">Activar</span>
                                    </label>
                                </div>
                                {config.allowAppeals && (
                                    <div className="mt-4">
                                        <label className="text-gray-400 text-sm block mb-1">Plazo para alegar (horas desde la resolución)</label>
                                        <input
                                            type="number" min="1" max="720"
                                            value={config.appealWindowHours}
                                            onChange={e => setConfig(prev => ({ ...prev, appealWindowHours: parseInt(e.target.value) || 48 }))}
                                            className="w-32 bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white"
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Criterio de los comisarios: contexto extra para la sugerencia con IA */}
                            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                                <h3 className="text-lg font-bold text-white">🧭 Criterio de los comisarios</h3>
                                <p className="text-gray-400 text-sm mt-1 mb-3">
                                    Reglas no escritas con las que soléis decidir. La sugerencia con IA las tiene en cuenta junto al reglamento y a las resoluciones anteriores.
                                </p>
                                <textarea
                                    value={config.stewardCriteria}
                                    onChange={e => setConfig(prev => ({ ...prev, stewardCriteria: e.target.value }))}
                                    rows={5}
                                    maxLength={4000}
                                    placeholder={'Ej.:\n- Contacto en la primera curva de la salida: incidente de carrera salvo que sea claramente evitable.\n- Devolver la posición en la misma vuelta evita la sanción.'}
                                    className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500"
                                />
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
                                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                                <label className="cursor-pointer flex items-center gap-3 flex-1 min-w-0">
                                                    <input
                                                        type="checkbox"
                                                        checked={preset.active}
                                                        onChange={() => handleTogglePreset(preset.id)}
                                                        className="w-4 h-4 rounded flex-shrink-0"
                                                    />
                                                    <span className="text-xl flex-shrink-0">{preset.icon}</span>
                                                    <div className="min-w-0">
                                                        <span className="text-white font-medium text-sm">{preset.name}</span>
                                                        <span className="text-gray-500 text-xs block truncate">{preset.description}</span>
                                                    </div>
                                                </label>
                                                {preset.active && (
                                                    <div className="flex items-center gap-3 flex-shrink-0 pl-10 sm:pl-0">
                                                        {Array.isArray(preset.damagePoints) ? (
                                                            // Según daños: sin / leves / moderados / graves
                                                            <div className="flex items-center gap-1" title="Puntos según daños: sin, leves, moderados, graves">
                                                                <span className="text-red-400 text-xs">Daños:</span>
                                                                {preset.damagePoints.map((v, i) => (
                                                                    <input
                                                                        key={i}
                                                                        type="number" min="0" max="50"
                                                                        value={v}
                                                                        aria-label={`Puntos con nivel de daños ${i}`}
                                                                        onChange={e => handleEditPreset(preset.id, 'damagePoints', preset.damagePoints.map((x, k) => (k === i ? (parseInt(e.target.value) || 0) : x)))}
                                                                        className="w-11 bg-white/10 border border-white/20 rounded px-1 py-1 text-white text-xs text-center"
                                                                    />
                                                                ))}
                                                            </div>
                                                        ) : preset.type === 'position' ? (
                                                            <div className="flex items-center gap-1">
                                                                <span className="text-orange-400 text-xs">Posiciones:</span>
                                                                <input
                                                                    type="number" min="1" max="30"
                                                                    value={preset.positionsLost || 0}
                                                                    onChange={e => handleEditPreset(preset.id, 'positionsLost', parseInt(e.target.value) || 1)}
                                                                    className="w-14 bg-white/10 border border-white/20 rounded px-2 py-1 text-white text-xs text-center"
                                                                />
                                                            </div>
                                                        ) : preset.type === 'disqualification' ? (
                                                            <span className="text-red-400 text-xs font-bold">DSQ</span>
                                                        ) : (
                                                            <div className="flex items-center gap-1">
                                                                <span className="text-red-400 text-xs">Pts:</span>
                                                                <input
                                                                    type="number" min="0" max="50"
                                                                    value={preset.points}
                                                                    onChange={e => handleEditPreset(preset.id, 'points', parseInt(e.target.value) || 0)}
                                                                    className="w-14 bg-white/10 border border-white/20 rounded px-2 py-1 text-white text-xs text-center"
                                                                />
                                                            </div>
                                                        )}
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
                            appeals={appeals}
                            penalties={penalties}
                            championshipId={championshipId}
                            championship={championship}
                            org={org}
                            allDrivers={allDrivers}
                            tracks={completedTracks}
                            config={config}
                            isAdminUser={isAdminUser}
                            onReload={() => loadData()}
                            onRefresh={() => loadData(true)}
                            onUpdate={onUpdate}
                        />
                    )}
                </>
            )}

            {/* ═══════ MODAL: Aplicar Sanción ═══════ */}
            {showApplyModal && (
                <ApplyPenaltyModal
                    championshipId={championshipId}
                    championship={championship}
                    org={org}
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
function ApplyPenaltyModal({ championshipId, championship, org, allDrivers, tracks, presets, onClose, onSaved }) {
    const [mode, setMode] = useState('preset'); // preset | custom
    const [selectedPreset, setSelectedPreset] = useState(null);
    const [extraPoints, setExtraPoints] = useState(0);
    const [extraPointsReason, setExtraPointsReason] = useState('');
    const [nivelDanos, setNivelDanos] = useState(null);
    const [posiciones, setPosiciones] = useState(0);
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
        setExtraPoints(0);
        setExtraPointsReason('');
        setNivelDanos(null);
        setPosiciones(preset.positionsLost || 0);
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
        if (mode === 'preset' && Array.isArray(selectedPreset?.damagePoints) && nivelDanos == null) return alert('Indica el nivel de daños');
        if (mode === 'preset' && cambiaResultado(selectedPreset) && !form.trackId) return alert('Esta sanción cambia el resultado de una carrera: elige la carrera');
        const base = mode === 'preset' && selectedPreset ? puntosBase(selectedPreset, nivelDanos) : form.points;
        const totalPoints = base + (extraPoints || 0);
        const description = extraPointsReason
            ? `${form.description || form.name}. Puntos adicionales: ${extraPointsReason}`
            : form.description;

        setSaving(true);
        try {
            await FirebaseService.createPenalty(championshipId, {
                ...form,
                points: totalPoints,
                description,
                extraPoints: extraPoints || 0,
                extraPointsReason: extraPointsReason || '',
                presetId: selectedPreset?.id || null,
                ...(mode === 'preset' && selectedPreset ? {
                    damageLevel: nivelDanos,
                    positionsLost: selectedPreset.type === 'position' ? posiciones : 0,
                    article: selectedPreset.article || '',
                } : {}),
                appliedAt: new Date().toISOString()
            });
            notifyPenaltyApplied({
                championshipName: championship?.name || championshipId,
                driverName: form.driverName,
                penaltyName: form.name,
                points: totalPoints,
                severity: form.severity,
                trackName: form.trackName || null,
                round: form.round || null,
                orgName: org?.name,
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
        <ModalPortal>
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
                                        {resumenPreset(preset) && <span className="text-red-400">{resumenPreset(preset)} </span>}
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

                    {mode === 'preset' && selectedPreset && (
                        <SancionDetalle preset={selectedPreset} nivel={nivelDanos}
                            onNivel={(n) => { setNivelDanos(n); setForm(prev => ({ ...prev, points: puntosBase(selectedPreset, n) })); }}
                            posiciones={posiciones} onPosiciones={setPosiciones} />
                    )}

                    {/* Puntos adicionales sobre preset */}
                    {mode === 'preset' && selectedPreset && (
                        <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-4 space-y-3">
                            <div className="flex items-center justify-between">
                                <h4 className="text-orange-300 font-semibold text-sm">➕ Puntos adicionales</h4>
                                <span className="text-gray-400 text-xs">Base: <span className="text-red-400 font-bold">-{puntosBase(selectedPreset, nivelDanos)} pts</span></span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="text-gray-400 text-xs block mb-1">Puntos extra a descontar</label>
                                    <input
                                        type="number" min="0" max="100"
                                        value={extraPoints}
                                        onChange={e => setExtraPoints(parseInt(e.target.value) || 0)}
                                        className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm"
                                        placeholder="0"
                                    />
                                </div>
                                <div>
                                    <label className="text-gray-400 text-xs block mb-1">Motivo (opcional)</label>
                                    <input
                                        type="text"
                                        value={extraPointsReason}
                                        onChange={e => setExtraPointsReason(e.target.value)}
                                        className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm"
                                        placeholder="Ej: perdió 3 posiciones"
                                    />
                                </div>
                            </div>
                            {extraPoints > 0 && (
                                <div className="text-center">
                                    <span className="text-gray-400 text-xs">Total: </span>
                                    <span className="text-red-400 font-bold">-{puntosBase(selectedPreset, nivelDanos) + extraPoints} pts</span>
                                    <span className="text-gray-500 text-xs"> ({puntosBase(selectedPreset, nivelDanos)} base + {extraPoints} extra)</span>
                                </div>
                            )}
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
                                <div className="flex flex-wrap gap-4 mt-1">
                                    {(form.points + (extraPoints || 0)) > 0 && (
                                        <span className="text-red-400 font-bold">
                                            -{form.points + (extraPoints || 0)} puntos
                                            {extraPoints > 0 && <span className="text-red-300 font-normal text-xs ml-1">({form.points}+{extraPoints})</span>}
                                        </span>
                                    )}
                                    {form.warningPoints > 0 && <span className="text-yellow-400">+{form.warningPoints} amonestación</span>}
                                    {extraPointsReason && <span className="text-gray-400 text-xs italic">&ldquo;{extraPointsReason}&rdquo;</span>}
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
        </ModalPortal>
    );
}

// ═══════════════════════════════════════════════
// SECCIÓN: Reclamaciones
// ═══════════════════════════════════════════════
/** Texto plano de una reclamación, para compartir con comisarios (WhatsApp, copiar/pegar) */
function formatClaimForShare(claim, championshipName) {
    const accused = Array.isArray(claim.accusedNames) ? claim.accusedNames.join(', ') : (claim.accusedNames || claim.accusedName || '?');
    const trackInfo = claim.trackName
        ? `🏁 R${claim.round || '?'} — ${claim.trackName}${claim.lap ? ` • Vuelta ${claim.lap}` : ''}${claim.minute ? ` • Min. ${claim.minute}` : ''}\n`
        : '';
    const evidenceLines = (claim.evidence || []).map(url => `🎥 ${url}`).join('\n');
    return (
        `📩 Reclamación — ${championshipName}\n` +
        `👤 ${claim.reporterName} → ${accused}\n` +
        trackInfo +
        `📝 ${claim.description}` +
        (evidenceLines ? `\n${evidenceLines}` : '')
    );
}

function ClaimsSection({ claims, appeals = [], penalties = [], championshipId, championship, org, allDrivers, tracks, config, isAdminUser = false, onReload, onRefresh, onUpdate }) {
    const { currentUser, isAdmin } = useAuth();
    const [resolveModal, setResolveModal] = useState(null);
    const [rejectModal, setRejectModal] = useState(null);
    const [rejectReason, setRejectReason] = useState('');
    const [rejectSaving, setRejectSaving] = useState(false);
    const [copiedAll, setCopiedAll] = useState(false);
    const [copiedId, setCopiedId] = useState(null);
    const [resolveAppealModal, setResolveAppealModal] = useState(null);
    const [admittingId, setAdmittingId] = useState(null);

    const championshipName = championship?.name || championshipId;
    const pendingClaims = claims.filter(c => c.status === 'pending' || c.status === 'reviewing');

    const handleCopyPending = async () => {
        const text = pendingClaims
            .map(c => formatClaimForShare(c, championshipName))
            .join('\n\n———\n\n');
        await navigator.clipboard.writeText(text);
        setCopiedAll(true);
        setTimeout(() => setCopiedAll(false), 2000);
    };

    const handleCopyClaim = async (claim) => {
        await navigator.clipboard.writeText(formatClaimForShare(claim, championshipName));
        setCopiedId(claim.id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const whatsappShareUrl = (claim) =>
        `https://wa.me/?text=${encodeURIComponent(formatClaimForShare(claim, championshipName))}`;

    // E3.10: si se desactivó allowClaims mientras había alegaciones abiertas,
    // estas siguen siendo resolubles desde el admin — solo se cierra la
    // creación de nuevas reclamaciones/alegaciones.
    if (!config.allowClaims && appeals.length === 0) {
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

    const handleResolveClaim = async (claimId, resolution, penaltyData, ia = null) => {
        try {
            // D3.3: resolvedBy nunca se persistía pese a existir en el modelo
            // y ser vigilado por firestore.rules en el create — sin este dato
            // es imposible aplicar "la alegación la revisa alguien distinto
            // de quien resolvió" (CA-3.11). Se guarda el uid (no el email):
            // es lo que compara firestore.rules y lo que canRefereeChampionship
            // ya usa en toda la app.
            const updates = {
                resolution,
                resolvedAt: new Date().toISOString(),
                resolvedBy: currentUser?.uid || ''
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

            // Lo que sugirió la IA frente a lo que decidió el comisario: las
            // resoluciones en que se la corrigió pesan más como precedente.
            if (ia) {
                const decisionFinal = updates.status === 'accepted' ? 'aceptar' : 'rechazar';
                const presetFinal = penaltyData?.presetId || null;
                updates.ia = {
                    decision: ia.decision || null,
                    presetId: ia.presetId || null,
                    valoracion: ia.valoracion || null,
                    coincide: ia.decision === decisionFinal && (decisionFinal === 'rechazar' || (ia.presetId || null) === presetFinal),
                    at: new Date().toISOString(),
                };
            }

            await FirebaseService.updateClaim(championshipId, claimId, updates);
            notifyClaimResolved({
                championshipName: championship?.name || championshipId,
                status: updates.status,
                reporterName: resolveModal?.reporterName || '?',
                accusedNames: resolveModal?.accusedNames || [resolveModal?.accusedName || '?'],
                trackName: resolveModal?.trackName || null,
                round: resolveModal?.round || null,
                resolution,
                orgName: org?.name,
            });
            onReload();
            if (onUpdate) onUpdate();
            setResolveModal(null);
        } catch (error) {
            alert('❌ Error: ' + error.message);
        }
    };

    // ── Alegaciones (apelaciones) ──
    // S3.8: la transición de claim/penalty a 'appealed' la ejecuta el
    // comisario/admin al ADMITIR A TRÁMITE la alegación — no automáticamente
    // al crearla (el `create` público de `appeals` no puede tocar `claims`
    // ni `penalties`, CA-3.19). Es también el único filtro humano de
    // admisibilidad, dado que no hay autenticación de pilotos (P3.1).
    const handleAdmitAppeal = async (appeal) => {
        const claim = claims.find(c => c.id === appeal.claimId);
        if (!claim) { alert('❌ La reclamación asociada ya no existe'); return; }
        setAdmittingId(appeal.id);
        try {
            await FirebaseService.updateAppeal(championshipId, appeal.id, { status: 'reviewing' });
            await FirebaseService.updateClaim(championshipId, claim.id, { status: 'appealed' });
            if (claim.penaltyId) {
                await FirebaseService.updatePenalty(championshipId, claim.penaltyId, {
                    status: 'appealed',
                    appealReason: appeal.reason || ''
                });
            }
            onReload();
            if (onUpdate) onUpdate();
        } catch (error) {
            alert('❌ Error al admitir la alegación: ' + error.message);
        } finally {
            setAdmittingId(null);
        }
    };

    // CA-3.11: resuelve un director_liga/organizador — nunca un comisario, y
    // nunca quien dictó la resolución original de la reclamación.
    const canResolveAppeal = (appeal) => {
        const claim = claims.find(c => c.id === appeal.claimId);
        if (!isAdmin()) return false;
        if (claim?.resolvedBy && currentUser?.uid && claim.resolvedBy === currentUser.uid) return false;
        return true;
    };

    const handleResolveAppeal = async (appeal, { outcome, resolution, newPenaltyData }) => {
        const claim = claims.find(c => c.id === appeal.claimId);
        const originalPenalty = claim?.penaltyId ? penalties.find(p => p.id === claim.penaltyId) : null;
        try {
            // E3.7: resolución transaccional — re-lee y exige status='pending'
            // antes de escribir, para que dos admins resolviendo a la vez no
            // generen dos sanciones sustitutivas duplicadas.
            await FirebaseService.resolveAppealTransactional(championshipId, appeal.id, {
                status: outcome === 'uphold' ? 'upheld' : outcome === 'dismiss' ? 'dismissed' : 'overturned',
                resolution,
                resolvedBy: currentUser?.uid || ''
            });

            if (outcome === 'uphold' || outcome === 'dismiss') {
                // Vuelve a la resolución original (accepted/rejected) y la
                // sanción (si existe) vuelve a 'applied'.
                if (claim) {
                    await FirebaseService.updateClaim(championshipId, claim.id, {
                        status: claim.penaltyId ? 'accepted' : 'rejected'
                    });
                }
                if (originalPenalty) {
                    await FirebaseService.updatePenalty(championshipId, originalPenalty.id, { status: 'applied', appealReason: '' });
                }
            } else if (outcome === 'revoke' || outcome === 'modify') {
                if (claim) {
                    await FirebaseService.updateClaim(championshipId, claim.id, { status: 'overturned' });
                }
                if (originalPenalty) {
                    await FirebaseService.updatePenalty(championshipId, originalPenalty.id, { status: 'revoked' });
                }
                if (outcome === 'modify' && newPenaltyData) {
                    await FirebaseService.createPenalty(championshipId, {
                        ...newPenaltyData,
                        claimId: claim?.id || null
                    });
                }
            }

            notifyAppealResolved({
                championshipName: championship?.name || championshipId,
                appellantName: appeal.appellantName,
                status: outcome === 'uphold' ? 'upheld' : outcome === 'dismiss' ? 'dismissed' : 'overturned',
                resolution,
                orgName: org?.name,
            });

            onReload();
            if (onUpdate) onUpdate();
            setResolveAppealModal(null);
        } catch (error) {
            alert('❌ Error al resolver la alegación: ' + error.message);
        }
    };

    return (
        <div className="space-y-4">
            {/* ═══════ Alegaciones (apelaciones) ═══════ */}
            {config.allowAppeals && appeals.length > 0 && (
                <div className="space-y-3">
                    <h3 className="text-lg font-bold text-white">⚖️ Alegaciones</h3>
                    <div className="space-y-3">
                        {appeals.map(appeal => {
                            const statusCfg = APPEAL_STATUS_CONFIG[appeal.status] || APPEAL_STATUS_CONFIG.pending;
                            const claim = claims.find(c => c.id === appeal.claimId);
                            return (
                                <div key={appeal.id} className="bg-white/5 border border-purple-500/20 rounded-xl p-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 flex-wrap mb-1">
                                                <span className={`text-xs px-2 py-0.5 rounded ${statusCfg.bg} ${statusCfg.color}`}>
                                                    {statusCfg.label}
                                                </span>
                                                <span className="text-white font-bold text-sm">{appeal.appellantName}</span>
                                                {claim && <span className="text-gray-500 text-xs">sobre reclamación de {claim.reporterName}</span>}
                                            </div>
                                            <p className="text-gray-300 text-sm">{appeal.reason}</p>
                                            {appeal.resolution && (
                                                <div className="mt-2 p-2 bg-white/5 rounded text-xs text-gray-300">
                                                    💬 <strong>Resolución:</strong> {appeal.resolution}
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex flex-col gap-1 flex-shrink-0">
                                            {appeal.status === 'pending' && (
                                                <button
                                                    onClick={() => handleAdmitAppeal(appeal)}
                                                    disabled={admittingId === appeal.id}
                                                    className="text-xs px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/40 disabled:opacity-50 text-blue-400 rounded transition-all"
                                                >
                                                    📋 Admitir a trámite
                                                </button>
                                            )}
                                            {(appeal.status === 'pending' || appeal.status === 'reviewing') && (
                                                canResolveAppeal(appeal) ? (
                                                    <button
                                                        onClick={() => setResolveAppealModal(appeal)}
                                                        className="text-xs px-3 py-1.5 bg-green-600/20 hover:bg-green-600/40 text-green-400 rounded transition-all"
                                                    >
                                                        ⚖️ Resolver
                                                    </button>
                                                ) : (
                                                    <span className="text-xs px-3 py-1.5 text-gray-500" title="Solo un director de liga/organizador distinto de quien resolvió la reclamación original puede resolver la alegación">
                                                        🔒 Sin permiso
                                                    </span>
                                                )
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="text-lg font-bold text-white">📩 Reclamaciones Recibidas</h3>
                {pendingClaims.length > 0 && (
                    <button
                        onClick={handleCopyPending}
                        className="text-xs px-3 py-1.5 bg-white/10 hover:bg-white/20 text-gray-300 rounded-lg transition-all"
                        title="Copia el texto de todas las reclamaciones pendientes, para pegar en el grupo de WhatsApp de comisarios"
                    >
                        {copiedAll ? '✅ Copiado' : `📋 Copiar pendientes (${pendingClaims.length})`}
                    </button>
                )}
            </div>

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
                                                {claim.reporterName} → {(claim.accusedNames?.length > 0 ? claim.accusedNames : [claim.accusedName]).join(', ')}
                                            </span>
                                        </div>
                                        {claim.trackName && (
                                            <div className="text-gray-500 text-xs mb-1">
                                                🏁 R{claim.round} - {claim.trackName}
                                                {claim.lap && ` • Vuelta ${claim.lap}`}
                                                {claim.minute && ` • Min. ${claim.minute}`}
                                            </div>
                                        )}
                                        <p className="text-gray-300 text-sm">{claim.description}</p>
                                        {claim.evidence?.length > 0 && (
                                            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                                                {claim.evidence.map((url, i) => (
                                                    url.startsWith('http') ? (
                                                        <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                                                            className="text-xs text-blue-400 hover:underline">📎 Ver evidencia {claim.evidence.length > 1 ? i + 1 : ''}</a>
                                                    ) : (
                                                        <span key={i} className="text-xs text-gray-400">📎 {url}</span>
                                                    )
                                                ))}
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
                                                onClick={() => { setRejectReason(''); setRejectModal(claim); }}
                                                className="text-xs px-3 py-1.5 bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded transition-all"
                                            >
                                                ❌ Rechazar
                                            </button>
                                            <div className="flex gap-1 mt-1 pt-1 border-t border-white/10">
                                                <a
                                                    href={whatsappShareUrl(claim)}
                                                    rel="noopener noreferrer"
                                                    className="text-xs px-2 py-1 bg-green-700/20 hover:bg-green-700/40 text-green-300 rounded transition-all"
                                                    title="Compartir esta reclamación en WhatsApp (para deliberar con comisarios)"
                                                >
                                                    📤
                                                </a>
                                                <button
                                                    onClick={() => handleCopyClaim(claim)}
                                                    className="text-xs px-2 py-1 bg-white/10 hover:bg-white/20 text-gray-300 rounded transition-all"
                                                    title="Copiar texto de esta reclamación"
                                                >
                                                    {copiedId === claim.id ? '✅' : '📋'}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Modal rechazar reclamación */}
            {rejectModal && (
                <ModalPortal>
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setRejectModal(null)}>
                    <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl border border-white/10 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-5 border-b border-white/10">
                            <h3 className="text-lg font-bold text-white">❌ Rechazar reclamación</h3>
                            <button onClick={() => setRejectModal(null)} className="text-gray-400 hover:text-white p-1 rounded hover:bg-white/10 transition-colors">✕</button>
                        </div>
                        <div className="p-5 space-y-4">
                            <div className="bg-red-900/20 border border-red-400/30 rounded-lg p-3 text-sm text-red-200">
                                <span className="font-bold">{rejectModal.reporterName}</span> → {(rejectModal.accusedNames?.length > 0 ? rejectModal.accusedNames : [rejectModal.accusedName]).join(', ')}
                                {rejectModal.trackName && <div className="text-red-300 text-xs mt-1">🏁 R{rejectModal.round} - {rejectModal.trackName}</div>}
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-300 mb-2">
                                    Motivo del rechazo <span className="text-red-400">*</span>
                                </label>
                                <textarea
                                    value={rejectReason}
                                    onChange={e => setRejectReason(e.target.value)}
                                    rows={3}
                                    placeholder="Ej: No se aporta evidencia suficiente, el incidente no infringe el reglamento..."
                                    className="w-full bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-red-400/60 resize-none"
                                />
                            </div>
                        </div>
                        <div className="flex gap-3 p-5 border-t border-white/10">
                            <button
                                onClick={() => setRejectModal(null)}
                                className="flex-1 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm font-medium transition-all"
                            >
                                Cancelar
                            </button>
                            <button
                                disabled={!rejectReason.trim() || rejectSaving}
                                onClick={async () => {
                                    setRejectSaving(true);
                                    try {
                                        await handleResolveClaim(rejectModal.id, rejectReason.trim(), null);
                                        setRejectModal(null);
                                    } finally {
                                        setRejectSaving(false);
                                    }
                                }}
                                className="flex-1 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-bold transition-all"
                            >
                                {rejectSaving ? 'Guardando...' : '❌ Confirmar rechazo'}
                            </button>
                        </div>
                    </div>
                </div>
                </ModalPortal>
            )}

            {/* Modal resolver reclamación */}
            {resolveModal && (
                <ResolveClaimModal
                    claim={resolveModal}
                    championshipId={championshipId}
                    org={org}
                    allDrivers={allDrivers}
                    tracks={tracks}
                    presets={config.presets?.filter(p => p.active) || []}
                    onClose={() => setResolveModal(null)}
                    onResolve={handleResolveClaim}
                    onEvidenceSaved={onRefresh}
                />
            )}

            {/* Modal resolver alegación (apelación) */}
            {resolveAppealModal && (
                <ResolveAppealModal
                    appeal={resolveAppealModal}
                    allDrivers={allDrivers}
                    presets={config.presets?.filter(p => p.active) || []}
                    onClose={() => setResolveAppealModal(null)}
                    onResolve={(payload) => handleResolveAppeal(resolveAppealModal, payload)}
                />
            )}
        </div>
    );
}

// ═══════════════════════════════════════════════
// MODAL: Resolver Alegación (apelación)
// ═══════════════════════════════════════════════
/**
 * CA-3.12: el resolutor elige exactamente uno de 4 resultados. En todos los
 * casos la motivación es obligatoria, mismo patrón que el modal de rechazo
 * de reclamaciones.
 */
function ResolveAppealModal({ appeal, allDrivers, presets, onClose, onResolve }) {
    const [outcome, setOutcome] = useState('uphold'); // uphold | revoke | modify | dismiss
    const [resolution, setResolution] = useState('');
    const [saving, setSaving] = useState(false);
    // Solo se usa si outcome === 'modify'
    const [newPenalty, setNewPenalty] = useState({ driverName: '', name: '', points: 0, warningPoints: 0, type: 'points', severity: 'moderate' });

    const OUTCOMES = [
        { id: 'uphold', label: '✅ Confirmar resolución original', hint: 'La sanción vuelve a "applied" (o sigue sin existir)' },
        { id: 'revoke', label: '🚫 Revocar la sanción', hint: 'La sanción original pasa a "revocada"' },
        { id: 'modify', label: '✏️ Modificar la sanción', hint: 'Revoca la original y crea una nueva con los valores corregidos' },
        { id: 'dismiss', label: '🗂️ Inadmitir por forma', hint: 'Fuera de plazo, sin legitimación o duplicada' },
    ];

    const handleSubmit = async () => {
        if (!resolution.trim()) return alert('Escribe una motivación');
        if (outcome === 'modify' && (!newPenalty.driverName || !newPenalty.name)) {
            return alert('Completa el piloto y el nombre de la sanción modificada');
        }
        setSaving(true);
        try {
            await onResolve({
                outcome,
                resolution: resolution.trim(),
                newPenaltyData: outcome === 'modify' ? newPenalty : null
            });
        } finally {
            setSaving(false);
        }
    };

    return (
        <ModalPortal>
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
            <div className="bg-slate-800 rounded-2xl border border-white/20 w-full max-w-lg max-h-[90vh] overflow-y-auto">
                <div className="p-6 border-b border-white/10">
                    <div className="flex justify-between items-center">
                        <h3 className="text-lg font-bold text-white">⚖️ Resolver Alegación</h3>
                        <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl">✕</button>
                    </div>
                </div>
                <div className="p-6 space-y-4">
                    <div className="bg-white/5 border border-white/10 rounded-lg p-3 text-sm">
                        <div className="text-white font-bold">{appeal.appellantName}</div>
                        <div className="text-gray-400 text-xs mt-1">{appeal.reason}</div>
                    </div>

                    <div className="space-y-2">
                        {OUTCOMES.map(o => (
                            <button
                                key={o.id}
                                type="button"
                                onClick={() => setOutcome(o.id)}
                                className={`w-full text-left p-3 rounded-lg border transition-all ${outcome === o.id
                                    ? 'bg-purple-600/20 border-purple-500/50 text-white'
                                    : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
                                    }`}
                            >
                                <div className="font-semibold text-sm">{o.label}</div>
                                <div className="text-gray-500 text-xs mt-0.5">{o.hint}</div>
                            </button>
                        ))}
                    </div>

                    {outcome === 'modify' && (
                        <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-3 space-y-2">
                            <div>
                                <label className="text-gray-400 text-xs block mb-1">Piloto *</label>
                                <select
                                    value={newPenalty.driverName}
                                    onChange={e => setNewPenalty(prev => ({ ...prev, driverName: e.target.value }))}
                                    className="w-full bg-white/10 border border-white/20 rounded px-2 py-1.5 text-white text-xs"
                                >
                                    <option value="" className="bg-slate-800">Seleccionar...</option>
                                    {allDrivers.map(d => (
                                        <option key={d.name} value={d.name} className="bg-slate-800">{d.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="text-gray-400 text-xs block mb-1">Nombre de la sanción corregida *</label>
                                <input
                                    type="text"
                                    value={newPenalty.name}
                                    onChange={e => setNewPenalty(prev => ({ ...prev, name: e.target.value }))}
                                    className="w-full bg-white/10 border border-white/20 rounded px-2 py-1.5 text-white text-xs"
                                    placeholder="Ej: Contacto menor (reducida)"
                                    list="appeal-presets"
                                />
                                <datalist id="appeal-presets">
                                    {presets.map(p => <option key={p.id} value={p.name} />)}
                                </datalist>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="text-gray-400 text-xs block mb-1">Puntos a deducir</label>
                                    <input type="number" min="0" max="50" value={newPenalty.points}
                                        onChange={e => setNewPenalty(prev => ({ ...prev, points: parseInt(e.target.value) || 0 }))}
                                        className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-white text-xs" />
                                </div>
                                <div>
                                    <label className="text-gray-400 text-xs block mb-1">Pts amonestación</label>
                                    <input type="number" min="0" max="10" value={newPenalty.warningPoints}
                                        onChange={e => setNewPenalty(prev => ({ ...prev, warningPoints: parseInt(e.target.value) || 0 }))}
                                        className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-white text-xs" />
                                </div>
                            </div>
                        </div>
                    )}

                    <div>
                        <label className="text-gray-400 text-sm block mb-1">Motivación *</label>
                        <textarea
                            value={resolution}
                            onChange={e => setResolution(e.target.value)}
                            className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm h-24 resize-none"
                            placeholder="Explica la decisión tomada sobre la alegación..."
                        />
                    </div>
                </div>
                <div className="p-6 border-t border-white/10 flex gap-3 justify-end">
                    <button onClick={onClose} className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all">
                        Cancelar
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={saving || !resolution.trim()}
                        className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold transition-all disabled:opacity-50"
                    >
                        {saving ? '⏳...' : '⚖️ Resolver Alegación'}
                    </button>
                </div>
            </div>
        </div>
        </ModalPortal>
    );
}

// ═══════════════════════════════════════════════
// MODAL: Resolver Reclamación
// ═══════════════════════════════════════════════
function ResolveClaimModal({ claim, championshipId, org, allDrivers, tracks, presets, onClose, onResolve, onEvidenceSaved }) {
    // Gemini tiene coste por llamada, así que la sugerencia con IA solo está
    // disponible en el plan 'pro_ia' (Pro + IA) o para orgs exentas de
    // facturación — el backend también lo valida (402/429), esto solo evita
    // la llamada inútil cuando ya sabemos que no aplica.
    const aiAvailable = Boolean(org?.billingExempt || org?.plan === 'pro_ia');
    const [resolution, setResolution] = useState('');
    const [aiSuggestion, setAiSuggestion] = useState(null);
    const [aiLoading, setAiLoading] = useState(false);
    const [aiError, setAiError] = useState('');
    const [applyPenalty, setApplyPenalty] = useState(false);
    const [selectedPreset, setSelectedPreset] = useState(null);
    const [customMode, setCustomMode] = useState(false);
    const [extraPoints, setExtraPoints] = useState(0);
    const [extraPointsReason, setExtraPointsReason] = useState('');
    const [nivelDanos, setNivelDanos] = useState(null);
    const [posiciones, setPosiciones] = useState(0);
    const [customForm, setCustomForm] = useState({ name: '', points: 0, warningPoints: 0, type: 'points', severity: 'moderate' });
    const [saving, setSaving] = useState(false);
    // Muchos pilotos mandan el video por privado en vez de pegar la URL: el
    // comisario lo sube a YouTube y lo añade aquí, que es lo que la IA
    // necesita para poder analizarlo.
    const [evidencias, setEvidencias] = useState(claim.evidence || []);
    const [nuevaEvidencia, setNuevaEvidencia] = useState('');
    const [guardandoEvidencia, setGuardandoEvidencia] = useState(false);
    const [errorEvidencia, setErrorEvidencia] = useState('');
    const esYouTube = (u) => /youtube\.com|youtu\.be/i.test(u);
    const hayYouTube = evidencias.some(esYouTube);

    const guardarEvidencias = async (lista) => {
        setGuardandoEvidencia(true);
        setErrorEvidencia('');
        try {
            await FirebaseService.updateClaim(championshipId, claim.id, { evidence: lista });
            setEvidencias(lista);
            setNuevaEvidencia('');
            // Refresca la lista: sin esto, al reabrir la reclamación la
            // evidencia recién añadida no aparecía hasta recargar la página.
            onEvidenceSaved?.();
        } catch (e) {
            setErrorEvidencia('No se pudo guardar: ' + (e.message || e));
        } finally {
            setGuardandoEvidencia(false);
        }
    };

    const anadirEvidencia = () => {
        const url = nuevaEvidencia.trim();
        if (!url) return;
        if (!/^https?:\/\//i.test(url)) { setErrorEvidencia('Pega el enlace completo, empezando por https://'); return; }
        if (evidencias.includes(url)) { setErrorEvidencia('Ese enlace ya está.'); return; }
        guardarEvidencias([...evidencias, url]);
    };

    // Backward compat: accusedNames[] o legacy accusedName string
    const accusedList = claim.accusedNames?.length > 0 ? claim.accusedNames : (claim.accusedName ? [claim.accusedName] : []);
    const [selectedAccused, setSelectedAccused] = useState(accusedList[0] || '');

    const handleAskAi = async () => {
        setAiLoading(true);
        setAiError('');
        setAiSuggestion(null);
        try {
            const data = await FirebaseService.suggestClaimResolution(championshipId, claim.id);
            setAiSuggestion(data);
        } catch (err) {
            setAiError(err.message || 'No se pudo obtener la sugerencia');
        } finally {
            setAiLoading(false);
        }
    };

    const handleSelectPreset = (preset) => {
        setSelectedPreset(preset);
        setCustomMode(false);
        setExtraPoints(0);
        setExtraPointsReason('');
        setNivelDanos(null);
        setPosiciones(preset.positionsLost || 0);
    };

    const handleSubmit = async () => {
        if (!resolution) return alert('Escribe una resolución');
        if (applyPenalty && !selectedAccused) return alert('Selecciona el piloto a sancionar');
        if (applyPenalty && !customMode && !selectedPreset) return alert('Selecciona una sanción');
        if (applyPenalty && customMode && !customForm.name) return alert('Escribe el nombre de la sanción');
        if (applyPenalty && !customMode && Array.isArray(selectedPreset?.damagePoints) && nivelDanos == null) return alert('Indica el nivel de daños');
        if (applyPenalty && !customMode && cambiaResultado(selectedPreset) && !claim.trackId) return alert('La reclamación no tiene carrera asociada: esta sanción no se puede aplicar');
        setSaving(true);

        let penaltyData = null;
        if (applyPenalty) {
            if (customMode) {
                penaltyData = {
                    driverName: selectedAccused,
                    teamName: allDrivers.find(d => d.name === selectedAccused)?.team || '',
                    trackId: claim.trackId,
                    trackName: claim.trackName,
                    round: claim.round,
                    name: customForm.name,
                    description: resolution,
                    type: customForm.type,
                    severity: customForm.severity,
                    points: customForm.points || 0,
                    warningPoints: customForm.warningPoints || 0,
                    timeSeconds: 0,
                    lap: claim.lap,
                    incident: claim.description,
                    // `evidencias` y no claim.evidence: la del comisario añadida en
                    // este modal no estaba en el objeto con que se abrió.
                    evidence: evidencias.join('\n')
                };
            } else if (selectedPreset) {
                const totalPoints = puntosBase(selectedPreset, nivelDanos) + (extraPoints || 0);
                const desc = extraPointsReason
                    ? `${resolution}. Pts adicionales: ${extraPointsReason}`
                    : resolution;
                penaltyData = {
                    driverName: selectedAccused,
                    teamName: allDrivers.find(d => d.name === selectedAccused)?.team || '',
                    trackId: claim.trackId,
                    trackName: claim.trackName,
                    round: claim.round,
                    name: selectedPreset.name,
                    presetId: selectedPreset.id || null,
                    description: desc,
                    type: selectedPreset.type,
                    severity: selectedPreset.severity,
                    points: totalPoints,
                    warningPoints: selectedPreset.warningPoints || 0,
                    timeSeconds: selectedPreset.timeSeconds || 0,
                    damageLevel: nivelDanos,
                    positionsLost: selectedPreset.type === 'position' ? posiciones : 0,
                    article: selectedPreset.article || '',
                    extraPoints: extraPoints || 0,
                    extraPointsReason: extraPointsReason || '',
                    lap: claim.lap,
                    incident: claim.description,
                    // `evidencias` y no claim.evidence: la del comisario añadida en
                    // este modal no estaba en el objeto con que se abrió.
                    evidence: evidencias.join('\n')
                };
            }
        }

        await onResolve(claim.id, resolution, penaltyData, aiSuggestion?.structured || null);
        setSaving(false);
    };

    return (
        <ModalPortal>
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
                            <strong className="text-white">{accusedList.join(', ')}</strong>
                        </div>
                        <div className="text-gray-500 text-xs mt-1">{claim.description}</div>
                    </div>

                    {/* Selector de infractor a sancionar (si hay múltiples) */}
                    {accusedList.length > 1 && (
                        <div>
                            <label className="text-gray-400 text-sm block mb-1">¿A quién sancionar? *</label>
                            <select
                                value={selectedAccused}
                                onChange={e => setSelectedAccused(e.target.value)}
                                className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm"
                            >
                                {accusedList.map(name => (
                                    <option key={name} value={name} className="bg-slate-800">{name}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Evidencia: se puede añadir aquí (video que llegó por privado) */}
                    <div className="bg-white/5 border border-white/10 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-gray-400 text-sm">🎥 Evidencia en video</span>
                            {evidencias.length > 0 && (
                                <span className={`text-xs ${hayYouTube ? 'text-green-300' : 'text-orange-300'}`}>
                                    {hayYouTube ? 'La IA puede analizarla' : 'Solo se analizan enlaces de YouTube'}
                                </span>
                            )}
                        </div>
                        {evidencias.length > 0 ? (
                            <ul className="space-y-1 mb-2">
                                {evidencias.map(url => (
                                    <li key={url} className="flex items-center gap-2 text-xs">
                                        <span>{esYouTube(url) ? '▶️' : '🔗'}</span>
                                        <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-300 hover:underline truncate flex-1">{url}</a>
                                        <button
                                            type="button"
                                            onClick={() => guardarEvidencias(evidencias.filter(u => u !== url))}
                                            disabled={guardandoEvidencia}
                                            className="text-gray-500 hover:text-red-400 disabled:opacity-40"
                                            aria-label="Quitar evidencia"
                                        >✕</button>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-gray-500 text-xs mb-2">
                                Sin evidencia. Si el piloto te mandó el video por privado, súbelo a YouTube como «Oculto» y pega aquí el enlace.
                            </p>
                        )}
                        <div className="flex gap-2">
                            <input
                                type="url"
                                value={nuevaEvidencia}
                                onChange={e => { setNuevaEvidencia(e.target.value); setErrorEvidencia(''); }}
                                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); anadirEvidencia(); } }}
                                placeholder="https://youtube.com/watch?v=..."
                                className="flex-1 min-w-0 bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-white text-xs"
                            />
                            <button
                                type="button"
                                onClick={anadirEvidencia}
                                disabled={guardandoEvidencia || !nuevaEvidencia.trim()}
                                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-lg text-xs font-semibold"
                            >
                                {guardandoEvidencia ? '⏳' : 'Añadir'}
                            </button>
                        </div>
                        {errorEvidencia && <p className="text-orange-300 text-xs mt-1">⚠️ {errorEvidencia}</p>}
                    </div>

                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <label className="text-gray-400 text-sm">Resolución *</label>
                            <button
                                type="button"
                                onClick={handleAskAi}
                                disabled={aiLoading || !aiAvailable || !hayYouTube}
                                className="text-xs px-2.5 py-1 bg-purple-600/20 hover:bg-purple-600/40 disabled:opacity-50 text-purple-300 rounded-lg transition-all"
                                title={!aiAvailable
                                    ? "Disponible en el plan Pro + IA — actualiza el plan en Facturación"
                                    : !hayYouTube
                                        ? "Añade arriba un enlace de YouTube con el video del incidente"
                                        : "Analiza el video de evidencia (solo YouTube) con el reglamento, el catálogo de sanciones y el historial del piloto — no reemplaza tu criterio"}
                            >
                                {aiLoading ? '🤖 Analizando video...' : !aiAvailable ? '🔒 Sugerencia IA (Pro + IA)' : !hayYouTube ? '🤖 Sugerencia (falta YouTube)' : '🤖 Pedir sugerencia'}
                            </button>
                        </div>
                        <textarea
                            value={resolution}
                            onChange={e => setResolution(e.target.value)}
                            className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm h-20 resize-none"
                            placeholder="Describir la resolución..."
                        />

                        {aiError && (
                            <p className="text-orange-300 text-xs mt-1">⚠️ {aiError}</p>
                        )}
                        {aiSuggestion && (
                            <div className="mt-2 p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-purple-300 text-xs font-semibold">🤖 Sugerencia de Gemini (revísala, no es un fallo automático)</span>
                                    <button
                                        type="button"
                                        onClick={() => setResolution(aiSuggestion.structured?.resolucion || aiSuggestion.suggestion)}
                                        className="text-xs px-2 py-0.5 bg-purple-600 hover:bg-purple-700 text-white rounded transition-all"
                                    >
                                        Usar como resolución
                                    </button>
                                </div>
                                <p className="text-gray-300 text-xs whitespace-pre-line">{aiSuggestion.suggestion}</p>
                                {(() => {
                                    const sugerido = presets.find(p => p.id === aiSuggestion.structured?.presetId);
                                    if (!sugerido) return null;
                                    return (
                                        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 bg-red-500/10 border border-red-500/30 rounded-lg px-2 py-1.5">
                                            <span className="text-xs text-red-200">⚖️ Sanción sugerida: {sugerido.icon} {sugerido.name}
                                                {Array.isArray(sugerido.damagePoints) && Number.isInteger(aiSuggestion.structured?.nivelDanos) && (
                                                    <> · {NIVELES_DANOS[aiSuggestion.structured.nivelDanos]} (-{sugerido.damagePoints[aiSuggestion.structured.nivelDanos]} pts)</>
                                                )}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setApplyPenalty(true);
                                                    handleSelectPreset(sugerido);
                                                    const nivel = aiSuggestion.structured?.nivelDanos;
                                                    if (Array.isArray(sugerido.damagePoints) && Number.isInteger(nivel) && nivel >= 0 && nivel <= 3) setNivelDanos(nivel);
                                                    if (aiSuggestion.structured?.resolucion) setResolution(aiSuggestion.structured.resolucion);
                                                }}
                                                className="text-xs px-2 py-0.5 bg-red-600 hover:bg-red-700 text-white rounded transition-all"
                                            >
                                                Preseleccionar
                                            </button>
                                        </div>
                                    );
                                })()}
                                {aiSuggestion.context && (
                                    <p className="text-gray-500 text-xs mt-2">
                                        ⓘ Se basó en: {[
                                            aiSuggestion.context.reglamentoCampeonato && 'reglamento del campeonato',
                                            aiSuggestion.context.reglamentoOrganizacion && 'reglamento de la organización',
                                            aiSuggestion.context.sanciones > 0 && `${aiSuggestion.context.sanciones} sanciones del catálogo`,
                                            ...Object.entries(aiSuggestion.context.historial || {}).map(([piloto, h]) =>
                                                `historial de ${piloto} (${h.sanciones} sanción(es), ${h.amonestacion} pts de amonestación)`),
                                            aiSuggestion.context.salaCarrera && 'configuración de sala de la carrera',
                                            aiSuggestion.context.criterio && 'criterio de los comisarios',
                                            aiSuggestion.context.precedentes > 0 && `${aiSuggestion.context.precedentes} resoluciones anteriores`,
                                        ].filter(Boolean).join(' · ') || 'solo el video y la descripción (no hay reglamento ni sanciones configurados)'}
                                        {aiSuggestion.context.recortado && ' · el reglamento se recortó por longitud'}
                                    </p>
                                )}
                                {aiSuggestion.structured?.precedentesCitados?.length > 0 && (
                                    <div className="mt-2 text-xs text-gray-400">
                                        <p className="text-gray-300 font-medium">📚 Precedentes en que se apoya:</p>
                                        <ul className="mt-1 space-y-1">
                                            {aiSuggestion.structured.precedentesCitados.map(p => (
                                                <li key={p.ref} className="bg-white/5 rounded px-2 py-1">{p.ref} · {p.texto}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                                {aiSuggestion.skippedUrls?.length > 0 && (
                                    <p className="text-gray-500 text-xs mt-2">
                                        ⓘ No se analizaron (no son de YouTube): {aiSuggestion.skippedUrls.join(', ')}
                                    </p>
                                )}
                            </div>
                        )}
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
                        <div className="space-y-3">
                            {/* Grid de presets + opción personalizada */}
                            <div className="grid grid-cols-2 gap-2">
                                {presets.map(preset => (
                                    <button
                                        key={preset.id}
                                        onClick={() => handleSelectPreset(preset)}
                                        className={`p-2 rounded-lg text-left text-xs transition-all border ${!customMode && selectedPreset?.id === preset.id
                                            ? 'bg-red-600/20 border-red-500/50'
                                            : 'bg-white/5 border-white/10 hover:bg-white/10'
                                            }`}
                                    >
                                        <span>{preset.icon} {preset.name}</span>
                                        <div className="text-gray-500 mt-0.5">
                                            {resumenPreset(preset) && <span className="text-red-400">{resumenPreset(preset)} </span>}
                                            {preset.warningPoints > 0 && <span className="text-yellow-400">+{preset.warningPoints}⚠️</span>}
                                        </div>
                                    </button>
                                ))}
                                {/* Opción personalizada */}
                                <button
                                    onClick={() => { setCustomMode(true); setSelectedPreset(null); setExtraPoints(0); setExtraPointsReason(''); }}
                                    className={`p-2 rounded-lg text-left text-xs transition-all border border-dashed ${customMode
                                        ? 'bg-purple-600/20 border-purple-500/50 text-purple-300'
                                        : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-white'
                                        }`}
                                >
                                    <span>🎛️ Personalizada</span>
                                    <div className="text-gray-500 mt-0.5">Sanción libre</div>
                                </button>
                            </div>

                            {!customMode && selectedPreset && (
                                <SancionDetalle preset={selectedPreset} nivel={nivelDanos} onNivel={setNivelDanos} posiciones={posiciones} onPosiciones={setPosiciones} />
                            )}

                            {/* Puntos adicionales cuando hay preset seleccionado */}
                            {!customMode && selectedPreset && (
                                <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-3 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-orange-300 text-xs font-semibold">➕ Puntos adicionales</span>
                                        <span className="text-gray-400 text-xs">Base: <span className="text-red-400 font-bold">-{puntosBase(selectedPreset, nivelDanos)} pts</span></span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className="text-gray-400 text-xs block mb-1">Pts extra</label>
                                            <input
                                                type="number" min="0" max="100"
                                                value={extraPoints}
                                                onChange={e => setExtraPoints(parseInt(e.target.value) || 0)}
                                                className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-white text-xs"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-gray-400 text-xs block mb-1">Motivo</label>
                                            <input
                                                type="text"
                                                value={extraPointsReason}
                                                onChange={e => setExtraPointsReason(e.target.value)}
                                                className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-white text-xs"
                                                placeholder="Ej: perdió 3 posiciones"
                                            />
                                        </div>
                                    </div>
                                    {extraPoints > 0 && (
                                        <div className="text-center text-xs">
                                            <span className="text-gray-400">Total: </span>
                                            <span className="text-red-400 font-bold">-{puntosBase(selectedPreset, nivelDanos) + extraPoints} pts</span>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Form personalizado */}
                            {customMode && (
                                <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-3 space-y-2">
                                    <div>
                                        <label className="text-gray-400 text-xs block mb-1">Nombre de la sanción *</label>
                                        <input
                                            type="text"
                                            value={customForm.name}
                                            onChange={e => setCustomForm(prev => ({ ...prev, name: e.target.value }))}
                                            className="w-full bg-white/10 border border-white/20 rounded px-2 py-1.5 text-white text-xs"
                                            placeholder="Ej: Bloqueo deliberado"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className="text-gray-400 text-xs block mb-1">Puntos a deducir</label>
                                            <input
                                                type="number" min="0" max="50"
                                                value={customForm.points}
                                                onChange={e => setCustomForm(prev => ({ ...prev, points: parseInt(e.target.value) || 0 }))}
                                                className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-white text-xs"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-gray-400 text-xs block mb-1">Pts amonestación</label>
                                            <input
                                                type="number" min="0" max="10"
                                                value={customForm.warningPoints}
                                                onChange={e => setCustomForm(prev => ({ ...prev, warningPoints: parseInt(e.target.value) || 0 }))}
                                                className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-white text-xs"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}
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
                        disabled={saving || !resolution || (applyPenalty && !customMode && !selectedPreset) || (applyPenalty && customMode && !customForm.name)}
                        className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold transition-all disabled:opacity-50"
                    >
                        {saving ? '⏳...' : applyPenalty ? '⚠️ Resolver + Sancionar' : '✅ Resolver'}
                    </button>
                </div>
            </div>
        </div>
        </ModalPortal>
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
