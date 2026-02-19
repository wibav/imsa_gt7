"use client";

import { useState } from 'react';
import { FirebaseService } from '../../services/firebaseService';
import { DEFAULT_DIVISION_COLORS } from '../../utils/constants';
import { calculateAdvancedStandings } from '../../utils/standingsCalculator';

/**
 * DivisionsTab — Gestión de divisiones del campeonato (admin)
 * 
 * Permite crear, editar, eliminar divisiones y asignar pilotos.
 * Incluye sistema de ascensos/descensos entre divisiones.
 */
export default function DivisionsTab({
    championshipId,
    championship,
    divisions,
    teams,
    tracks = [],
    penalties = [],
    onUpdate
}) {
    const [creating, setCreating] = useState(false);
    const [newDivName, setNewDivName] = useState('');
    const [saving, setSaving] = useState(false);
    const [editingDiv, setEditingDiv] = useState(null);
    const [showPromotions, setShowPromotions] = useState(false);
    const [promotionPreview, setPromotionPreview] = useState(null);

    // Obtener todos los pilotos del campeonato
    const allDriverNames = (() => {
        const names = new Set();
        if (championship?.settings?.isTeamChampionship || teams?.length > 0) {
            teams.forEach(team => {
                (team.drivers || []).forEach(d => names.add(d.name));
            });
        }
        if (championship?.drivers?.length > 0) {
            championship.drivers.forEach(d => {
                const name = typeof d === 'string' ? d : d.name;
                names.add(name);
            });
        }
        return [...names].sort();
    })();

    // Pilotos ya asignados a alguna división
    const assignedDrivers = new Set();
    divisions.forEach(div => {
        (div.drivers || []).forEach(d => assignedDrivers.add(d));
    });

    // Pilotos sin asignar
    const unassignedDrivers = allDriverNames.filter(d => !assignedDrivers.has(d));

    // Crear nueva división
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

    // Mover piloto entre divisiones (drag & drop simplificado)
    const handleMoveDriver = async (driverName, fromDivId, toDivId) => {
        if (fromDivId === toDivId) return;
        try {
            // Remover de origen
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

    // Actualizar campo de división (nombre, color, maxDrivers, streaming)
    const handleUpdateDivField = async (divId, field, value) => {
        try {
            await FirebaseService.updateDivision(championshipId, divId, { [field]: value });
            await onUpdate();
        } catch (error) {
            console.error('Error actualizando división:', error);
        }
    };

    // Auto-asignar todos los drivers equitativamente
    const handleAutoAssign = async () => {
        if (divisions.length === 0) {
            alert('Primero crea al menos una división');
            return;
        }
        if (!confirm(`¿Auto-asignar ${unassignedDrivers.length} pilotos sin asignar equitativamente entre ${divisions.length} divisiones?`)) return;

        setSaving(true);
        try {
            const sorted = [...divisions].sort((a, b) => a.order - b.order);
            const assignments = sorted.map(d => ({ id: d.id, drivers: [...(d.drivers || [])] }));

            unassignedDrivers.forEach((driver, idx) => {
                const targetIdx = idx % sorted.length;
                assignments[targetIdx].drivers.push(driver);
            });

            for (const assignment of assignments) {
                await FirebaseService.updateDivision(championshipId, assignment.id, { drivers: assignment.drivers });
            }
            await onUpdate();
        } catch (error) {
            console.error('Error auto-asignando:', error);
        } finally {
            setSaving(false);
        }
    };

    // Generar preview de ascensos/descensos
    const handleGeneratePromotions = (standings) => {
        if (!standings || divisions.length < 2) return;

        const promoCount = championship?.divisionsConfig?.promotionCount ?? 5;
        const releCount = championship?.divisionsConfig?.relegationCount ?? 5;
        const sorted = [...divisions].sort((a, b) => a.order - b.order);

        const preview = [];

        for (let i = 0; i < sorted.length; i++) {
            const div = sorted[i];
            const divStandings = standings[div.id] || [];

            // Pilotos que bajan (últimos N de esta división, excepto la última)
            if (i < sorted.length - 1 && divStandings.length > releCount) {
                const relegados = divStandings.slice(-releCount);
                relegados.forEach(d => {
                    preview.push({
                        driver: d.name,
                        from: div.name,
                        fromId: div.id,
                        to: sorted[i + 1].name,
                        toId: sorted[i + 1].id,
                        type: 'relegation'
                    });
                });
            }

            // Pilotos que suben (primeros N de esta división, excepto la primera)
            if (i > 0 && divStandings.length > 0) {
                const promovidos = divStandings.slice(0, promoCount);
                promovidos.forEach(d => {
                    preview.push({
                        driver: d.name,
                        from: div.name,
                        fromId: div.id,
                        to: sorted[i - 1].name,
                        toId: sorted[i - 1].id,
                        type: 'promotion'
                    });
                });
            }
        }

        setPromotionPreview(preview);
        setShowPromotions(true);
    };

    // Aplicar ascensos/descensos
    const handleApplyPromotions = async () => {
        if (!promotionPreview || promotionPreview.length === 0) return;
        if (!confirm(`¿Aplicar ${promotionPreview.length} movimientos de ascenso/descenso? Esta acción reorganizará los pilotos entre divisiones.`)) return;

        setSaving(true);
        try {
            // Construir nuevo mapa de pilotos por división
            const divDriversMap = {};
            divisions.forEach(d => {
                divDriversMap[d.id] = [...(d.drivers || [])];
            });

            // Primero remover todos los pilotos involucrados de sus divisiones actuales
            const movedDrivers = new Set(promotionPreview.map(p => p.driver));
            Object.keys(divDriversMap).forEach(divId => {
                divDriversMap[divId] = divDriversMap[divId].filter(d => !movedDrivers.has(d));
            });

            // Luego agregar a sus nuevas divisiones
            promotionPreview.forEach(p => {
                if (divDriversMap[p.toId]) {
                    divDriversMap[p.toId].push(p.driver);
                }
            });

            // Guardar cambios
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

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-white">🏆 Divisiones del Campeonato</h2>
                    <p className="text-gray-400 text-sm mt-1">
                        {divisions.length} divisiones • {assignedDrivers.size}/{allDriverNames.length} pilotos asignados
                    </p>
                </div>
                <div className="flex gap-2">
                    {unassignedDrivers.length > 0 && divisions.length > 0 && (
                        <button onClick={handleAutoAssign} disabled={saving}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors disabled:opacity-50">
                            🔀 Auto-asignar ({unassignedDrivers.length})
                        </button>
                    )}
                    <button onClick={() => setCreating(true)}
                        className="px-4 py-2 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white font-bold rounded-lg transition-all">
                        ➕ Nueva División
                    </button>
                </div>
            </div>

            {/* Crear nueva división */}
            {creating && (
                <div className="bg-white/5 border border-white/20 rounded-xl p-4">
                    <div className="flex gap-3">
                        <input type="text" value={newDivName}
                            onChange={(e) => setNewDivName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleCreateDivision()}
                            placeholder="Nombre de la división (ej: División 1)"
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

            {/* Pilotos sin asignar */}
            {unassignedDrivers.length > 0 && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
                    <h4 className="text-yellow-300 font-bold text-sm mb-2">
                        ⚠️ {unassignedDrivers.length} pilotos sin división
                    </h4>
                    <div className="flex flex-wrap gap-2">
                        {unassignedDrivers.map(driver => (
                            <div key={driver} className="bg-yellow-500/20 border border-yellow-500/40 rounded-lg px-3 py-1.5 text-sm text-yellow-200 flex items-center gap-2">
                                <span>{driver}</span>
                                {divisions.length > 0 && (
                                    <select
                                        onChange={(e) => {
                                            if (e.target.value) handleAssignDriver(e.target.value, driver);
                                            e.target.value = '';
                                        }}
                                        className="bg-transparent border border-yellow-500/30 rounded text-xs px-1 py-0.5 text-yellow-300">
                                        <option value="" className="bg-slate-800">Asignar a...</option>
                                        {divisions.sort((a, b) => a.order - b.order).map(div => (
                                            <option key={div.id} value={div.id} className="bg-slate-800">{div.name}</option>
                                        ))}
                                    </select>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Lista de divisiones */}
            {divisions.length === 0 ? (
                <div className="bg-white/5 border border-white/10 rounded-xl p-12 text-center">
                    <div className="text-6xl mb-4">🏆</div>
                    <p className="text-gray-300 text-lg mb-2">No hay divisiones creadas</p>
                    <p className="text-gray-500 text-sm">Crea divisiones para organizar a los pilotos en salas competitivas separadas</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {[...divisions].sort((a, b) => a.order - b.order).map((division) => (
                        <DivisionCard
                            key={division.id}
                            division={division}
                            divisions={divisions}
                            allDriverNames={allDriverNames}
                            assignedDrivers={assignedDrivers}
                            editing={editingDiv === division.id}
                            onEdit={() => setEditingDiv(editingDiv === division.id ? null : division.id)}
                            onAssign={(driver) => handleAssignDriver(division.id, driver)}
                            onRemove={(driver) => handleRemoveDriver(division.id, driver)}
                            onMove={(driver, toDivId) => handleMoveDriver(driver, division.id, toDivId)}
                            onUpdate={(field, value) => handleUpdateDivField(division.id, field, value)}
                            onDelete={() => handleDeleteDivision(division.id, division.name)}
                        />
                    ))}
                </div>
            )}

            {/* Botón de ascensos/descensos */}
            {divisions.length >= 2 && championship?.status === 'completed' && (
                <div className="bg-gradient-to-br from-purple-600/20 to-pink-600/20 border border-purple-500/30 rounded-xl p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-white font-bold text-lg">🔄 Ascensos y Descensos</h3>
                            <p className="text-gray-300 text-sm mt-1">
                                Procesa los movimientos de pilotos entre divisiones basado en la clasificación final.
                                Los primeros {championship?.divisionsConfig?.promotionCount ?? 5} suben,
                                los últimos {championship?.divisionsConfig?.relegationCount ?? 5} bajan.
                            </p>
                        </div>
                        <button onClick={() => {
                            // Calcular standings por división
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

            {/* Modal de ascensos/descensos */}
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
                                {promotionPreview.filter(p => p.type === 'promotion').length > 0 && (
                                    <>
                                        <h4 className="text-green-400 font-bold text-sm">⬆️ ASCIENDEN</h4>
                                        {promotionPreview.filter(p => p.type === 'promotion').map((p, i) => (
                                            <div key={i} className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 flex items-center justify-between">
                                                <span className="text-white font-medium">{p.driver}</span>
                                                <span className="text-green-300 text-sm">{p.from} → {p.to}</span>
                                            </div>
                                        ))}
                                    </>
                                )}
                                {promotionPreview.filter(p => p.type === 'relegation').length > 0 && (
                                    <>
                                        <h4 className="text-red-400 font-bold text-sm mt-4">⬇️ DESCIENDEN</h4>
                                        {promotionPreview.filter(p => p.type === 'relegation').map((p, i) => (
                                            <div key={i} className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex items-center justify-between">
                                                <span className="text-white font-medium">{p.driver}</span>
                                                <span className="text-red-300 text-sm">{p.from} → {p.to}</span>
                                            </div>
                                        ))}
                                    </>
                                )}
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
 * Tarjeta individual de división con gestión de pilotos
 */
function DivisionCard({
    division,
    divisions,
    editing,
    onEdit,
    onAssign,
    onRemove,
    onMove,
    onUpdate,
    onDelete
}) {
    const [addingDriver, setAddingDriver] = useState('');
    const driverCount = (division.drivers || []).length;

    return (
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-white/20 rounded-xl overflow-hidden">
            {/* Header con color de división */}
            <div
                className="p-4 flex items-center justify-between"
                style={{ borderLeft: `4px solid ${division.color}` }}
            >
                <div className="flex items-center gap-3">
                    <div
                        className="w-4 h-4 rounded-full flex-shrink-0"
                        style={{ backgroundColor: division.color }}
                    />
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

            {/* Lista de pilotos */}
            <div className="p-4 border-t border-white/10">
                <div className="flex flex-wrap gap-2">
                    {(division.drivers || []).map((driver, idx) => (
                        <div key={driver}
                            className="group bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 flex items-center gap-2 text-sm">
                            <span className="text-gray-500 text-xs w-4">{idx + 1}</span>
                            <span className="text-white">{driver}</span>
                            <div className="hidden group-hover:flex items-center gap-1">
                                {/* Mover a otra división */}
                                {divisions.length > 1 && (
                                    <select onChange={(e) => {
                                        if (e.target.value) onMove(driver, e.target.value);
                                        e.target.value = '';
                                    }}
                                        className="bg-transparent border-none text-xs text-blue-400 cursor-pointer w-5 px-0"
                                        title="Mover a otra división">
                                        <option value="">→</option>
                                        {divisions.filter(d => d.id !== division.id).sort((a, b) => a.order - b.order).map(d => (
                                            <option key={d.id} value={d.id} className="bg-slate-800">{d.name}</option>
                                        ))}
                                    </select>
                                )}
                                <button onClick={() => onRemove(driver)}
                                    className="text-red-400 hover:text-red-300 text-xs" title="Remover">✕</button>
                            </div>
                        </div>
                    ))}
                    {driverCount === 0 && (
                        <p className="text-gray-500 text-sm italic">Sin pilotos asignados</p>
                    )}
                </div>
            </div>
        </div>
    );
}
