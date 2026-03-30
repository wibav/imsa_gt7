"use client";

import { useState, useMemo } from 'react';
import { FirebaseService } from '../../services/firebaseService';
import { DEFAULT_DIVISION_COLORS } from '../../utils/constants';
import { calculateAdvancedStandings } from '../../utils/standingsCalculator';

/** Convierte "M:SS.mmm" o "SS.mmm" a milisegundos para comparación correcta de tiempos */
function parseTimeToMs(str) {
    if (!str) return Infinity;
    const parts = str.trim().split(':');
    if (parts.length === 2) {
        const mins = parseInt(parts[0], 10) || 0;
        const secs = parseFloat(parts[1]) || 0;
        return mins * 60000 + Math.round(secs * 1000);
    }
    return Math.round((parseFloat(parts[0]) || 0) * 1000);
}

export default function DivisionsTab({
    championshipId,
    championship,
    divisions,
    teams,
    tracks = [],
    penalties = [],
    registrations = [],
    onUpdate
}) {
    const [creating, setCreating] = useState(false);
    const [newDivName, setNewDivName] = useState('');
    const [saving, setSaving] = useState(false);
    const [savingTimes, setSavingTimes] = useState(false);
    const [editingDiv, setEditingDiv] = useState(null);
    const [showPromotions, setShowPromotions] = useState(false);
    const [promotionPreview, setPromotionPreview] = useState(null);
    const [showPreQualyModal, setShowPreQualyModal] = useState(false);
    const [preQualyAssignPreview, setPreQualyAssignPreview] = useState([]);

    // Estado local de tiempos Pre-Qualy: driverName → time
    const [pqTimes, setPqTimes] = useState(() => {
        const map = {};
        (championship?.preQualy?.results || []).forEach(r => {
            if (r.driverName) map[r.driverName] = r.time || '';
        });
        return map;
    });

    // Snapshot inicial para detectar cambios pendientes
    const [pqTimesSnapshot] = useState(() => {
        const map = {};
        (championship?.preQualy?.results || []).forEach(r => {
            if (r.driverName) map[r.driverName] = r.time || '';
        });
        return map;
    });

    // ── Datos derivados ──────────────────────────────────────────

    const approvedRegs = useMemo(
        () => registrations.filter(r => r.status === 'approved'),
        [registrations]
    );

    // driverName → { gt7Id, psnId }
    const regMap = useMemo(() => {
        const map = {};
        approvedRegs.forEach(r => {
            const key = r.name || r.psnId || r.gt7Id || '';
            if (key) map[key] = { gt7Id: r.gt7Id || '', psnId: r.psnId || '' };
        });
        return map;
    }, [approvedRegs]);

    // driverName → divId
    const divisionMap = useMemo(() => {
        const map = {};
        divisions.forEach(div => {
            (div.drivers || []).forEach(name => { map[name] = div.id; });
        });
        return map;
    }, [divisions]);

    const assignedCount = useMemo(() => {
        const s = new Set();
        divisions.forEach(div => (div.drivers || []).forEach(d => s.add(d)));
        return s.size;
    }, [divisions]);

    const pqTimesHaveChanges = useMemo(() => {
        const keys = new Set([...Object.keys(pqTimes), ...Object.keys(pqTimesSnapshot)]);
        for (const k of keys) {
            if ((pqTimes[k] || '') !== (pqTimesSnapshot[k] || '')) return true;
        }
        return false;
    }, [pqTimes, pqTimesSnapshot]);

    // Pilotos con tiempo registrado, ordenados fastest first (para modal Pre-Qualy)
    const classifiedByTime = useMemo(() => {
        return approvedRegs
            .map(r => {
                const name = r.name || r.psnId || r.gt7Id || '';
                return { driverName: name, time: pqTimes[name] || '', gt7Id: r.gt7Id || '' };
            })
            .filter(r => r.time)
            .sort((a, b) => parseTimeToMs(a.time) - parseTimeToMs(b.time));
    }, [approvedRegs, pqTimes]);

    // ── Handlers ───────────────────────────────────────────────

    const handleCreateDivision = async () => {
        if (!newDivName.trim()) return;
        setSaving(true);
        try {
            const order = divisions.length + 1;
            await FirebaseService.createDivision(championshipId, {
                name: newDivName.trim(),
                order,
                color: DEFAULT_DIVISION_COLORS[(order - 1) % DEFAULT_DIVISION_COLORS.length],
                drivers: [],
                maxDrivers: championship?.divisionsConfig?.maxDriversPerDivision || 15
            });
            setNewDivName('');
            setCreating(false);
            await onUpdate();
        } catch (error) {
            console.error('Error creando división:', error);
            alert('Error al crear la división');
        } finally {
            setSaving(false);
        }
    };

    // Eliminar división
    const handleDeleteDivision = async (divId, divName) => {
        if (!confirm(`¿Eliminar la división "${divName}"? Los pilotos quedarán sin asignar.`)) return;
        try {
            await FirebaseService.deleteDivision(championshipId, divId);
            await onUpdate();
        } catch (error) {
            console.error('Error eliminando división:', error);
        }
    };

    // Asignar piloto a división
    const handleAssignDriver = async (divId, driverName) => {
        const division = divisions.find(d => d.id === divId);
        if (!division) return;
        const updatedDrivers = [...(division.drivers || []), driverName];
        try {
            await FirebaseService.updateDivision(championshipId, divId, { drivers: updatedDrivers });
            await onUpdate();
        } catch (error) {
            console.error('Error asignando piloto:', error);
        }
    };

    // Remover piloto de división
    const handleRemoveDriver = async (divId, driverName) => {
        const division = divisions.find(d => d.id === divId);
        if (!division) return;
        const updatedDrivers = (division.drivers || []).filter(d => d !== driverName);
        try {
            await FirebaseService.updateDivision(championshipId, divId, { drivers: updatedDrivers });
            await onUpdate();
        } catch (error) {
            console.error('Error removiendo piloto:', error);
        }
    };

    // Cambia la división de un piloto desde la tabla global (inmediato)
    const handleChangeDriverDivision = async (driverName, newDivId) => {
        const currentDivId = divisionMap[driverName];
        if (currentDivId === (newDivId || undefined)) return;
        try {
            if (currentDivId && !newDivId) {
                // Quitar de su división
                await handleRemoveDriver(currentDivId, driverName);
            } else if (!currentDivId && newDivId) {
                // Asignar a nueva división
                await handleAssignDriver(newDivId, driverName);
            } else if (currentDivId && newDivId) {
                // Mover de división a división
                const fromDiv = divisions.find(d => d.id === currentDivId);
                const toDiv = divisions.find(d => d.id === newDivId);
                if (!fromDiv || !toDiv) return;
                await FirebaseService.updateDivision(championshipId, currentDivId, {
                    drivers: (fromDiv.drivers || []).filter(d => d !== driverName)
                });
                await FirebaseService.updateDivision(championshipId, newDivId, {
                    drivers: [...(toDiv.drivers || []), driverName]
                });
                await onUpdate();
            }
        } catch (error) {
            console.error('Error cambiando división:', error);
        }
    };

    const handleMoveDriver = async (driverName, fromDivId, toDivId) => {
        if (fromDivId === toDivId) return;
        try {
            const fromDiv = divisions.find(d => d.id === fromDivId);
            const toDiv = divisions.find(d => d.id === toDivId);
            if (!fromDiv || !toDiv) return;
            await FirebaseService.updateDivision(championshipId, fromDivId, {
                drivers: (fromDiv.drivers || []).filter(d => d !== driverName)
            });
            await FirebaseService.updateDivision(championshipId, toDivId, {
                drivers: [...(toDiv.drivers || []), driverName]
            });
            await onUpdate();
        } catch (error) {
            console.error('Error moviendo piloto:', error);
        }
    };

    const handleUpdateDivField = async (divId, field, value) => {
        try {
            await FirebaseService.updateDivision(championshipId, divId, { [field]: value });
            await onUpdate();
        } catch (error) {
            console.error('Error actualizando división:', error);
        }
    };

    // Guardar tiempos Pre-Qualy desde la tabla global
    const handleSavePqTimes = async () => {
        setSavingTimes(true);
        try {
            const existingResults = championship?.preQualy?.results || [];
            const allNames = new Set([
                ...Object.keys(pqTimes),
                ...existingResults.map(r => r.driverName)
            ]);
            const results = [...allNames]
                .filter(name => pqTimes[name])
                .map(name => {
                    const existing = existingResults.find(r => r.driverName === name);
                    return {
                        driverName: name,
                        time: pqTimes[name],
                        classified: existing?.classified !== undefined ? existing.classified : true
                    };
                })
                .sort((a, b) => parseTimeToMs(a.time) - parseTimeToMs(b.time));
            await FirebaseService.savePreQualyResults(championshipId, results);
            await onUpdate();
        } catch (error) {
            console.error('Error guardando tiempos:', error);
            alert('Error al guardar tiempos: ' + error.message);
        } finally {
            setSavingTimes(false);
        }
    };

    // Abrir modal de auto-asignación por Pre-Qualy
    const handleOpenPreQualyAssign = () => {
        if (classifiedByTime.length === 0) {
            alert('No hay pilotos con tiempo registrado. Ingresa los tiempos primero y guárdalos.');
            return;
        }
        if (divisions.length === 0) {
            alert('Primero crea al menos una división.');
            return;
        }
        const sortedDivs = [...divisions].sort((a, b) => a.order - b.order);
        const groupSize = Math.ceil(classifiedByTime.length / sortedDivs.length);
        const preview = classifiedByTime.map((r, idx) => ({
            driverName: r.driverName,
            time: r.time,
            divId: sortedDivs[Math.min(Math.floor(idx / groupSize), sortedDivs.length - 1)].id
        }));
        setPreQualyAssignPreview(preview);
        setShowPreQualyModal(true);
    };

    // Confirmar asignación desde modal Pre-Qualy
    const handleConfirmPreQualyAssign = async () => {
        setSaving(true);
        try {
            const involvedDivIds = new Set(preQualyAssignPreview.map(p => p.divId));
            const assignedNames = new Set(preQualyAssignPreview.map(p => p.driverName));
            const divDriversMap = {};
            // Conservar pilotos existentes que no están en el preview
            divisions.forEach(div => {
                if (involvedDivIds.has(div.id)) {
                    divDriversMap[div.id] = (div.drivers || []).filter(d => !assignedNames.has(d));
                }
            });
            preQualyAssignPreview.forEach(p => {
                if (divDriversMap[p.divId]) divDriversMap[p.divId].push(p.driverName);
            });
            for (const [divId, drivers] of Object.entries(divDriversMap)) {
                await FirebaseService.updateDivision(championshipId, divId, { drivers });
            }
            setShowPreQualyModal(false);
            setPreQualyAssignPreview([]);
            await onUpdate();
        } catch (error) {
            console.error('Error asignando desde Pre-Qualy:', error);
            alert('Error al asignar: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    const handleGeneratePromotions = (standings) => {
        if (!standings || divisions.length < 2) return;
        const promoCount = championship?.divisionsConfig?.promotionCount ?? 5;
        const releCount = championship?.divisionsConfig?.relegationCount ?? 5;
        const sorted = [...divisions].sort((a, b) => a.order - b.order);
        const preview = [];
        for (let i = 0; i < sorted.length; i++) {
            const div = sorted[i];
            const divStandings = standings[div.id] || [];
            if (i < sorted.length - 1 && divStandings.length > releCount) {
                divStandings.slice(-releCount).forEach(d => {
                    preview.push({ driver: d.name, from: div.name, fromId: div.id, to: sorted[i + 1].name, toId: sorted[i + 1].id, type: 'relegation' });
                });
            }
            if (i > 0 && divStandings.length > 0) {
                divStandings.slice(0, promoCount).forEach(d => {
                    preview.push({ driver: d.name, from: div.name, fromId: div.id, to: sorted[i - 1].name, toId: sorted[i - 1].id, type: 'promotion' });
                });
            }
        }
        setPromotionPreview(preview);
        setShowPromotions(true);
    };

    const handleApplyPromotions = async () => {
        if (!promotionPreview || promotionPreview.length === 0) return;
        if (!confirm(`¿Aplicar ${promotionPreview.length} movimientos de ascenso/descenso? Esta acción reorganizará los pilotos entre divisiones.`)) return;
        setSaving(true);
        try {
            const divDriversMap = {};
            divisions.forEach(d => { divDriversMap[d.id] = [...(d.drivers || [])]; });
            const movedDrivers = new Set(promotionPreview.map(p => p.driver));
            Object.keys(divDriversMap).forEach(divId => {
                divDriversMap[divId] = divDriversMap[divId].filter(d => !movedDrivers.has(d));
            });
            promotionPreview.forEach(p => {
                if (divDriversMap[p.toId]) divDriversMap[p.toId].push(p.driver);
            });
            for (const [divId, drivers] of Object.entries(divDriversMap)) {
                await FirebaseService.updateDivision(championshipId, divId, { drivers });
            }
            setShowPromotions(false);
            setPromotionPreview(null);
            await onUpdate();
            alert('✅ Ascensos/descensos aplicados correctamente');
        } catch (error) {
            console.error('Error aplicando promociones:', error);
            alert('Error al aplicar los movimientos');
        } finally {
            setSaving(false);
        }
    };

    // ── Render ─────────────────────────────────────────────────

    const sortedDivisions = [...divisions].sort((a, b) => a.order - b.order);
    const totalSlots = divisions.reduce((s, d) => s + (d.maxDrivers || 15), 0);

    return (
        <div className="space-y-6">

            {/* ── Header ── */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-white">🏆 Divisiones del Campeonato</h2>
                    <p className="text-gray-400 text-sm mt-1">
                        {divisions.length} divisiones • {assignedCount}/{approvedRegs.length} pilotos asignados • {totalSlots} cupos totales
                    </p>
                </div>
                <div className="flex gap-2">
                    {classifiedByTime.length > 0 && divisions.length > 0 && (
                        <button onClick={handleOpenPreQualyAssign} disabled={saving}
                            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
                            🏁 Auto-asignar por Pre-Qualy
                        </button>
                    )}
                    <button onClick={() => setCreating(true)}
                        className="px-4 py-2 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white font-bold rounded-lg transition-all">
                        ➕ Nueva División
                    </button>
                </div>
            </div>

            {/* ── Crear nueva división ── */}
            {creating && (
                <div className="bg-white/5 border border-white/20 rounded-xl p-4">
                    <div className="flex gap-3">
                        <input type="text" value={newDivName}
                            onChange={(e) => setNewDivName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleCreateDivision()}
                            placeholder="Nombre de la división (ej: División A)"
                            className="flex-1 px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
                            autoFocus
                        />
                        <button onClick={handleCreateDivision} disabled={saving || !newDivName.trim()}
                            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg disabled:opacity-50">
                            ✓ Crear
                        </button>
                        <button onClick={() => { setCreating(false); setNewDivName(''); }}
                            className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg">
                            ✕
                        </button>
                    </div>
                </div>
            )}

            {/* ── Tabla global: todos los inscritos aprobados ── */}
            {approvedRegs.length > 0 ? (
                <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                        <h3 className="text-white font-semibold text-sm">
                            📋 Pilotos inscritos aprobados
                            <span className="ml-2 text-gray-400 font-normal text-xs">
                                ({approvedRegs.length} en total • {assignedCount} asignados)
                            </span>
                        </h3>
                        {pqTimesHaveChanges && (
                            <button onClick={handleSavePqTimes} disabled={savingTimes}
                                className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs rounded-lg font-medium disabled:opacity-50 transition-colors">
                                {savingTimes ? '⏳ Guardando...' : '💾 Guardar tiempos Pre-Qualy'}
                            </button>
                        )}
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-xs text-gray-400 border-b border-white/10 bg-white/5">
                                    <th className="px-4 py-2.5 font-medium w-8">#</th>
                                    <th className="px-4 py-2.5 font-medium">GT7 ID</th>
                                    <th className="px-4 py-2.5 font-medium">PSN ID</th>
                                    <th className="px-4 py-2.5 font-medium">⏱ Tiempo Pre-Qualy</th>
                                    <th className="px-4 py-2.5 font-medium">División</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {approvedRegs.map((r, idx) => {
                                    const driverName = r.name || r.psnId || r.gt7Id || '';
                                    const currentDivId = divisionMap[driverName] || '';
                                    const currentDiv = divisions.find(d => d.id === currentDivId);
                                    return (
                                        <tr key={r.id} className="hover:bg-white/5 transition-colors">
                                            <td className="px-4 py-2.5 text-gray-500 font-mono text-xs">{idx + 1}</td>
                                            <td className="px-4 py-2.5 text-white font-medium">
                                                {r.gt7Id || <span className="text-gray-600 italic text-xs">—</span>}
                                            </td>
                                            <td className="px-4 py-2.5 text-gray-300">
                                                {r.psnId || <span className="text-gray-600 italic text-xs">—</span>}
                                            </td>
                                            <td className="px-4 py-2.5">
                                                <input
                                                    type="text"
                                                    value={pqTimes[driverName] || ''}
                                                    onChange={e => setPqTimes(prev => ({ ...prev, [driverName]: e.target.value }))}
                                                    placeholder="1:23.456"
                                                    className="w-28 px-2 py-1 bg-white/10 border border-white/20 rounded text-yellow-200 text-xs font-mono placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-yellow-400"
                                                />
                                            </td>
                                            <td className="px-4 py-2.5">
                                                <select
                                                    value={currentDivId}
                                                    onChange={e => handleChangeDriverDivision(driverName, e.target.value)}
                                                    className={`px-2 py-1 rounded text-xs font-medium border focus:outline-none ${currentDiv
                                                            ? 'bg-white/10 border-white/20 text-white'
                                                            : 'bg-yellow-500/10 border-yellow-500/30 text-yellow-300'
                                                        }`}
                                                    style={currentDiv ? { borderLeftColor: currentDiv.color, borderLeftWidth: 3 } : {}}
                                                >
                                                    <option value="" className="bg-slate-800 text-gray-300">Sin división</option>
                                                    {sortedDivisions.map(div => (
                                                        <option key={div.id} value={div.id} className="bg-slate-800">{div.name}</option>
                                                    ))}
                                                </select>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 text-yellow-300 text-sm text-center">
                    ⚠️ No hay inscripciones aprobadas aún. Aprueba pilotos en la pestaña <strong>Inscripciones</strong>.
                </div>
            )}

            {/* ── Lista de divisiones ── */}
            {divisions.length === 0 ? (
                <div className="bg-white/5 border border-white/10 rounded-xl p-12 text-center">
                    <div className="text-6xl mb-4">🏆</div>
                    <p className="text-gray-300 text-lg mb-2">No hay divisiones creadas</p>
                    <p className="text-gray-500 text-sm">Crea divisiones para organizar a los pilotos en salas competitivas separadas</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {sortedDivisions.map((division) => (
                        <DivisionCard
                            key={division.id}
                            division={division}
                            divisions={divisions}
                            regMap={regMap}
                            editing={editingDiv === division.id}
                            onEdit={() => setEditingDiv(editingDiv === division.id ? null : division.id)}
                            onRemove={(driver) => handleRemoveDriver(division.id, driver)}
                            onMove={(driver, toDivId) => handleMoveDriver(driver, division.id, toDivId)}
                            onUpdate={(field, value) => handleUpdateDivField(division.id, field, value)}
                            onDelete={() => handleDeleteDivision(division.id, division.name)}
                        />
                    ))}
                </div>
            )}

            {/* ── Ascensos/Descensos (solo campeonatos completados) ── */}
            {divisions.length >= 2 && championship?.status === 'completed' && (
                <div className="bg-gradient-to-br from-purple-600/20 to-pink-600/20 border border-purple-500/30 rounded-xl p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-white font-bold text-lg">🔄 Ascensos y Descensos</h3>
                            <p className="text-gray-300 text-sm mt-1">
                                Los primeros {championship?.divisionsConfig?.promotionCount ?? 5} suben,
                                los últimos {championship?.divisionsConfig?.relegationCount ?? 5} bajan.
                            </p>
                        </div>
                        <button onClick={() => {
                            const standingsByDiv = {};
                            divisions.forEach(div => {
                                const { driverStandings } = calculateAdvancedStandings(
                                    championship, teams, tracks, penalties,
                                    { divisionDrivers: div.drivers || [] }
                                );
                                standingsByDiv[div.id] = driverStandings;
                            });
                            handleGeneratePromotions(standingsByDiv);
                        }}
                            className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold rounded-lg transition-all">
                            📊 Vista Previa
                        </button>
                    </div>
                </div>
            )}

            {/* ── Modal: Auto-asignar por Pre-Qualy ── */}
            {showPreQualyModal && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-white/30 rounded-xl p-6 w-full max-w-2xl max-h-[85vh] flex flex-col">
                        <div className="flex items-center justify-between mb-4 flex-shrink-0">
                            <div>
                                <h3 className="text-xl font-bold text-white">🏁 Auto-asignar por Pre-Qualy</h3>
                                <p className="text-gray-400 text-sm mt-0.5">
                                    {classifiedByTime.length} pilotos ordenados por tiempo · grupos secuenciales
                                </p>
                            </div>
                            <button onClick={() => setShowPreQualyModal(false)}
                                className="text-gray-400 hover:text-white text-xl">✕</button>
                        </div>
                        <div className="overflow-y-auto flex-1">
                            <table className="w-full text-sm">
                                <thead className="sticky top-0 bg-slate-800 z-10">
                                    <tr className="text-left text-xs text-gray-400 border-b border-white/10">
                                        <th className="pb-2 px-3 py-2 font-medium">#</th>
                                        <th className="pb-2 px-3 py-2 font-medium">GT7 ID</th>
                                        <th className="pb-2 px-3 py-2 font-medium">⏱ Tiempo</th>
                                        <th className="pb-2 px-3 py-2 font-medium">División asignada</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {preQualyAssignPreview.map((row, idx) => (
                                        <tr key={row.driverName} className="hover:bg-white/5">
                                            <td className="py-2.5 px-3 text-gray-500 font-mono text-xs">{idx + 1}</td>
                                            <td className="py-2.5 px-3 text-white font-medium text-sm">{row.driverName}</td>
                                            <td className="py-2.5 px-3 font-mono text-yellow-300 text-sm">{row.time}</td>
                                            <td className="py-2.5 px-3">
                                                <select
                                                    value={row.divId}
                                                    onChange={e => setPreQualyAssignPreview(prev =>
                                                        prev.map((p, i) => i === idx ? { ...p, divId: e.target.value } : p)
                                                    )}
                                                    className="px-2 py-1 bg-white/10 border border-white/20 rounded text-white text-xs focus:outline-none">
                                                    {sortedDivisions.map(div => (
                                                        <option key={div.id} value={div.id} className="bg-slate-800">{div.name}</option>
                                                    ))}
                                                </select>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="flex gap-3 mt-4 pt-4 border-t border-white/20 flex-shrink-0">
                            <button onClick={() => setShowPreQualyModal(false)}
                                className="flex-1 px-4 py-2.5 bg-gray-600 hover:bg-gray-700 text-white rounded-lg text-sm">
                                Cancelar
                            </button>
                            <button onClick={handleConfirmPreQualyAssign} disabled={saving}
                                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold rounded-lg text-sm disabled:opacity-50">
                                {saving ? '⏳ Asignando...' : `✅ Confirmar (${preQualyAssignPreview.length} pilotos)`}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Modal: Ascensos/Descensos ── */}
            {showPromotions && promotionPreview && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-white/30 rounded-xl p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-bold text-white">🔄 Preview de Ascensos/Descensos</h3>
                            <button onClick={() => setShowPromotions(false)}
                                className="text-gray-400 hover:text-white text-xl">✕</button>
                        </div>
                        {promotionPreview.length === 0 ? (
                            <p className="text-gray-400 text-center py-8">No hay movimientos que procesar</p>
                        ) : (
                            <div className="space-y-3">
                                {promotionPreview.filter(p => p.type === 'promotion').length > 0 && (<>
                                    <h4 className="text-green-400 font-bold text-sm">⬆️ ASCIENDEN</h4>
                                    {promotionPreview.filter(p => p.type === 'promotion').map((p, i) => (
                                        <div key={i} className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 flex items-center justify-between">
                                            <span className="text-white font-medium">{p.driver}</span>
                                            <span className="text-green-300 text-sm">{p.from} → {p.to}</span>
                                        </div>
                                    ))}
                                </>)}
                                {promotionPreview.filter(p => p.type === 'relegation').length > 0 && (<>
                                    <h4 className="text-red-400 font-bold text-sm mt-4">⬇️ DESCIENDEN</h4>
                                    {promotionPreview.filter(p => p.type === 'relegation').map((p, i) => (
                                        <div key={i} className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex items-center justify-between">
                                            <span className="text-white font-medium">{p.driver}</span>
                                            <span className="text-red-300 text-sm">{p.from} → {p.to}</span>
                                        </div>
                                    ))}
                                </>)}
                            </div>
                        )}
                        <div className="flex gap-3 mt-6 pt-4 border-t border-white/20">
                            <button onClick={() => setShowPromotions(false)}
                                className="flex-1 px-4 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg">
                                Cancelar
                            </button>
                            <button onClick={handleApplyPromotions} disabled={saving || promotionPreview.length === 0}
                                className="flex-1 px-4 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold rounded-lg disabled:opacity-50">
                                {saving ? '⏳ Aplicando...' : '✅ Aplicar Movimientos'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

/**
 * Tarjeta individual de división — tabla GT7 ID + PSN ID
 */
function DivisionCard({
    division,
    divisions,
    regMap,
    editing,
    onEdit,
    onRemove,
    onMove,
    onUpdate,
    onDelete
}) {
    const driverCount = (division.drivers || []).length;

    return (
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-white/20 rounded-xl overflow-hidden">
            {/* Header con color de división */}
            <div className="p-4 flex items-center justify-between" style={{ borderLeft: `4px solid ${division.color}` }}>
                <div className="flex items-center gap-3">
                    <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: division.color }} />
                    <div>
                        <h3 className="text-white font-bold text-lg">{division.name}</h3>
                        <p className="text-gray-400 text-sm">
                            {driverCount}/{division.maxDrivers} pilotos • Orden #{division.order}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {division.casterName && (
                        <span className="text-xs bg-purple-500/20 text-purple-300 px-2 py-1 rounded">
                            📺 {division.casterName}
                        </span>
                    )}
                    <button onClick={onEdit}
                        className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${editing ? 'bg-orange-600 text-white' : 'bg-white/10 text-gray-300 hover:bg-white/20'}`}>
                        {editing ? '✕ Cerrar' : '⚙️ Editar'}
                    </button>
                    <button onClick={onDelete}
                        className="px-3 py-1.5 bg-red-600/20 text-red-400 hover:bg-red-600/40 rounded-lg text-sm transition-colors">
                        🗑️
                    </button>
                </div>
            </div>

            {/* Panel de edición */}
            {editing && (
                <div className="p-4 bg-white/5 border-t border-white/10 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">Nombre</label>
                            <input type="text" defaultValue={division.name}
                                onBlur={(e) => e.target.value !== division.name && onUpdate('name', e.target.value)}
                                className="w-full px-3 py-2 bg-white/10 border border-white/30 rounded-lg text-white text-sm" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">Color</label>
                            <input type="color" defaultValue={division.color}
                                onChange={(e) => onUpdate('color', e.target.value)}
                                className="w-full h-10 rounded-lg cursor-pointer bg-transparent" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">Max Pilotos</label>
                            <input type="number" min="1" max="30" defaultValue={division.maxDrivers}
                                onBlur={(e) => onUpdate('maxDrivers', parseInt(e.target.value) || 15)}
                                className="w-full px-3 py-2 bg-white/10 border border-white/30 rounded-lg text-white text-sm" />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">📺 Caster</label>
                            <input type="text" defaultValue={division.casterName}
                                onBlur={(e) => onUpdate('casterName', e.target.value)}
                                placeholder="Nombre del comentarista"
                                className="w-full px-3 py-2 bg-white/10 border border-white/30 rounded-lg text-white text-sm placeholder-gray-500" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">🏠 Host</label>
                            <input type="text" defaultValue={division.hostName}
                                onBlur={(e) => onUpdate('hostName', e.target.value)}
                                placeholder="Nombre del anfitrión"
                                className="w-full px-3 py-2 bg-white/10 border border-white/30 rounded-lg text-white text-sm placeholder-gray-500" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">🔗 Stream URL</label>
                            <input type="text" defaultValue={division.streamUrl}
                                onBlur={(e) => onUpdate('streamUrl', e.target.value)}
                                placeholder="https://..."
                                className="w-full px-3 py-2 bg-white/10 border border-white/30 rounded-lg text-white text-sm placeholder-gray-500" />
                        </div>
                    </div>
                </div>
            )}

            {/* Tabla de pilotos: GT7 ID + PSN ID */}
            <div className="border-t border-white/10">
                {driverCount === 0 ? (
                    <p className="px-4 py-4 text-gray-500 text-sm italic text-center">Sin pilotos asignados</p>
                ) : (
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left text-xs text-gray-500 border-b border-white/5 bg-white/[0.02]">
                                <th className="px-4 py-2 font-normal w-8">#</th>
                                <th className="px-4 py-2 font-normal">GT7 ID</th>
                                <th className="px-4 py-2 font-normal">PSN ID</th>
                                <th className="px-4 py-2 font-normal w-20"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {(division.drivers || []).map((driver, idx) => {
                                const info = regMap?.[driver] || {};
                                return (
                                    <tr key={driver} className="group hover:bg-white/5 transition-colors">
                                        <td className="px-4 py-2.5 text-gray-500 font-mono text-xs">{idx + 1}</td>
                                        <td className="px-4 py-2.5 text-white font-medium text-sm">
                                            {info.gt7Id || <span className="text-gray-500 italic text-xs">{driver}</span>}
                                        </td>
                                        <td className="px-4 py-2.5 text-gray-300 text-sm">
                                            {info.psnId || <span className="text-gray-600 text-xs">—</span>}
                                        </td>
                                        <td className="px-4 py-2.5">
                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                                                {divisions.length > 1 && (
                                                    <select onChange={(e) => {
                                                        if (e.target.value) onMove(driver, e.target.value);
                                                        e.target.value = '';
                                                    }}
                                                        className="bg-transparent border-none text-xs text-blue-400 cursor-pointer"
                                                        title="Mover a otra división">
                                                        <option value="">→</option>
                                                        {divisions.filter(d => d.id !== division.id).sort((a, b) => a.order - b.order).map(d => (
                                                            <option key={d.id} value={d.id} className="bg-slate-800">{d.name}</option>
                                                        ))}
                                                    </select>
                                                )}
                                                <button onClick={() => onRemove(driver)}
                                                    className="text-red-400 hover:text-red-300 text-xs px-1"
                                                    title="Quitar de división">✕</button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
