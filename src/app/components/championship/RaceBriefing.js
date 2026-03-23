"use client";
import { useRef, useState } from "react";
import { toPng } from "html-to-image";
import { formatDateFull } from "../../utils/dateUtils";
import { TYRE_OPTIONS, DAMAGE_OPTIONS, STREAMING_PLATFORMS } from "../../utils/constants";

/**
 * Componente Briefing Pre-Carrera.
 * Muestra un resumen visual de la próxima carrera con toda su info
 * y permite exportarlo como imagen PNG para compartir.
 * 
 * @param {Object} props
 * @param {Object} props.nextRace - Track de la próxima carrera
 * @param {Object} props.championship - Datos del campeonato
 * @param {Object} props.progress - { completed, total, percentage }
 */
export default function RaceBriefing({ nextRace, championship, progress }) {
    const briefingRef = useRef(null);
    const [exporting, setExporting] = useState(false);
    const [showBriefing, setShowBriefing] = useState(false);

    if (!nextRace) return null;

    const rules = nextRace.rules || {};
    const weather = nextRace.weather || {};
    const weatherType = rules.weather || weather.weatherType;
    const timeOfDay = rules.timeOfDay || weather.timeOfDay;
    const timeMultiplier = rules.timeMultiplier || weather.multiplier;
    const weatherSlots = rules.weatherSlots || weather.slots;
    const streamPlatform = STREAMING_PLATFORMS.find(p => p.value === championship?.streaming?.platform);
    const mandatoryTyres = rules.mandatoryTyre || nextRace.mandatoryTyres || [];
    const tyreLabels = mandatoryTyres.map(t => {
        const opt = TYRE_OPTIONS.find(o => o.value === t);
        return opt ? opt.label : t;
    });
    const damageValue = rules.mechanicalDamage ?? rules.damages;
    const damageLabel = DAMAGE_OPTIONS.find(d => d.value === damageValue)?.label || damageValue;
    const tireWear = rules.tireWear ?? rules.tyreWear;
    const bopEnabled = rules.bop === 'yes' || rules.bop === true;
    const bopDisabled = rules.bop === 'no' || rules.bop === false;
    const adjustmentsDisabled = rules.adjustments === 'no' || rules.tuning === false;
    const adjustmentsEnabled = rules.adjustments === 'yes' || rules.tuning === true;

    const handleExport = async () => {
        if (!briefingRef.current) return;
        setExporting(true);
        try {
            const dataUrl = await toPng(briefingRef.current, {
                backgroundColor: '#0f172a',
                pixelRatio: 2,
                quality: 1
            });
            const link = document.createElement('a');
            link.download = `briefing-R${nextRace.round}-${nextRace.name?.replace(/\s+/g, '-') || 'carrera'}.png`;
            link.href = dataUrl;
            link.click();
        } catch (error) {
            console.error('Error exportando briefing:', error);
        } finally {
            setExporting(false);
        }
    };

    const handleCopyToClipboard = async () => {
        if (!briefingRef.current) return;
        setExporting(true);
        try {
            const dataUrl = await toPng(briefingRef.current, {
                backgroundColor: '#0f172a',
                pixelRatio: 2,
                quality: 1
            });
            const response = await fetch(dataUrl);
            const blob = await response.blob();
            await navigator.clipboard.write([
                new ClipboardItem({ 'image/png': blob })
            ]);
            alert('✅ Briefing copiado al portapapeles');
        } catch (error) {
            handleExport();
        } finally {
            setExporting(false);
        }
    };

    // Calcular countdown
    const raceDate = nextRace.date ? new Date(nextRace.date + 'T00:00:00') : null;
    const now = new Date();
    const daysUntil = raceDate ? Math.ceil((raceDate - now) / (1000 * 60 * 60 * 24)) : null;

    return (
        <>
            {/* Botón para abrir el briefing */}
            <button
                onClick={() => setShowBriefing(true)}
                className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-4 py-2 rounded-lg font-semibold text-sm transition-all"
            >
                📋 Briefing Pre-Carrera
            </button>

            {/* Modal del Briefing */}
            {showBriefing && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-start justify-center p-4 overflow-y-auto">
                    <div className="bg-slate-800 rounded-2xl border border-white/10 max-w-xl w-full my-8">
                        {/* Header */}
                        <div className="flex items-center justify-between p-4 border-b border-white/10">
                            <h3 className="text-white font-bold text-lg">📋 Briefing Pre-Carrera</h3>
                            <button
                                onClick={() => setShowBriefing(false)}
                                className="text-gray-400 hover:text-white transition-colors text-xl"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Botones de export */}
                        <div className="flex gap-3 p-4 border-b border-white/10">
                            <button
                                onClick={handleExport}
                                disabled={exporting}
                                className="flex-1 inline-flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 text-white px-4 py-3 rounded-lg font-bold transition-all text-sm"
                            >
                                {exporting ? '⏳ Generando...' : '💾 Descargar PNG'}
                            </button>
                            <button
                                onClick={handleCopyToClipboard}
                                disabled={exporting}
                                className="flex-1 inline-flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 text-white px-4 py-3 rounded-lg font-bold transition-all text-sm"
                            >
                                {exporting ? '⏳...' : '📋 Copiar'}
                            </button>
                        </div>

                        {/* Contenido exportable */}
                        <div className="p-4 overflow-auto max-h-[65vh]">
                            <div ref={briefingRef} style={{ width: '480px' }}>
                                <div style={{
                                    background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
                                    padding: '24px',
                                    fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
                                }}>
                                    {/* Header del campeonato */}
                                    <div style={{
                                        background: 'linear-gradient(135deg, #ea580c, #dc2626)',
                                        borderRadius: '12px',
                                        padding: '16px 20px',
                                        marginBottom: '16px',
                                        textAlign: 'center'
                                    }}>
                                        <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)', marginBottom: '4px', letterSpacing: '1px', textTransform: 'uppercase' }}>
                                            📋 Briefing Pre-Carrera
                                        </div>
                                        <div style={{ fontSize: '20px', fontWeight: 'bold', color: 'white' }}>
                                            {championship?.name || 'Campeonato'}
                                        </div>
                                        {championship?.season && (
                                            <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.8)', marginTop: '2px' }}>
                                                Temporada {championship.season}
                                            </div>
                                        )}
                                    </div>

                                    {/* Ronda y Circuito */}
                                    <div style={{
                                        background: 'rgba(255,255,255,0.05)',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        borderRadius: '12px',
                                        padding: '16px',
                                        marginBottom: '12px',
                                        textAlign: 'center'
                                    }}>
                                        <div style={{ fontSize: '14px', color: '#fb923c', fontWeight: 'bold', marginBottom: '4px' }}>
                                            Ronda {nextRace.round} de {progress?.total || '?'}
                                        </div>
                                        <div style={{ fontSize: '22px', fontWeight: 'bold', color: 'white', marginBottom: '6px' }}>
                                            🏁 {nextRace.name}
                                        </div>
                                        {nextRace.country && (
                                            <div style={{ fontSize: '13px', color: '#9ca3af' }}>📍 {nextRace.country}</div>
                                        )}
                                        {nextRace.date && (
                                            <div style={{ fontSize: '14px', color: '#60a5fa', marginTop: '8px', fontWeight: '600' }}>
                                                📅 {formatDateFull(nextRace.date)}
                                                {daysUntil !== null && daysUntil > 0 && (
                                                    <span style={{ color: '#fbbf24', marginLeft: '8px' }}>
                                                        ({daysUntil} día{daysUntil !== 1 ? 's' : ''})
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Grid de info */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                                        {/* Formato */}
                                        {(nextRace.laps || nextRace.duration || nextRace.raceType) && (
                                            <InfoBox
                                                icon="🏎️"
                                                title="Formato"
                                                items={[
                                                    nextRace.raceType === 'sprint_carrera' ? 'Sprint + Carrera' :
                                                        nextRace.raceType === 'resistencia' ? 'Resistencia' : 'Carrera',
                                                    nextRace.laps ? `${nextRace.laps} vueltas` : null,
                                                    nextRace.duration ? `${nextRace.duration} min` : null
                                                ].filter(Boolean)}
                                            />
                                        )}

                                        {/* Categoría */}
                                        {nextRace.category && (
                                            <InfoBox
                                                icon="🏷️"
                                                title="Categoría"
                                                items={[nextRace.category]}
                                            />
                                        )}

                                        {/* Climatología */}
                                        {(timeOfDay || weatherType || timeMultiplier) && (
                                            <InfoBox
                                                icon="🌦️"
                                                title="Climatología"
                                                items={[
                                                    timeOfDay,
                                                    timeMultiplier ? `x${timeMultiplier}` : null,
                                                    weatherType
                                                ].filter(Boolean)}
                                            />
                                        )}

                                        {/* Desgaste */}
                                        {(tireWear || rules.fuelConsumption) && (
                                            <InfoBox
                                                icon="⚙️"
                                                title="Desgaste"
                                                items={[
                                                    tireWear ? `Neumáticos: x${tireWear}` : null,
                                                    rules.fuelConsumption ? `Combustible: x${rules.fuelConsumption}` : null
                                                ].filter(Boolean)}
                                            />
                                        )}

                                        {/* Daños */}
                                        {damageLabel && (
                                            <InfoBox
                                                icon="💥"
                                                title="Daños"
                                                items={[damageLabel]}
                                            />
                                        )}

                                        {/* BOP / Ajustes */}
                                        {(rules.bop !== undefined || rules.adjustments !== undefined || rules.tuning !== undefined) && (
                                            <InfoBox
                                                icon="⚖️"
                                                title="Configuración"
                                                items={[
                                                    bopEnabled ? 'BOP: Activado' : bopDisabled ? 'BOP: Desactivado' : null,
                                                    adjustmentsDisabled ? 'Ajustes: Prohibidos' : adjustmentsEnabled ? 'Ajustes: Permitidos' : null
                                                ].filter(Boolean)}
                                            />
                                        )}
                                    </div>

                                    {/* Neumáticos obligatorios */}
                                    {tyreLabels.length > 0 && (
                                        <div style={{
                                            background: 'rgba(251,146,60,0.1)',
                                            border: '1px solid rgba(251,146,60,0.3)',
                                            borderRadius: '10px',
                                            padding: '14px',
                                            marginBottom: '12px'
                                        }}>
                                            <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#fb923c', marginBottom: '6px' }}>
                                                🛞 Neumáticos Obligatorios
                                            </div>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                                {tyreLabels.map((label, idx) => (
                                                    <span key={idx} style={{
                                                        background: 'rgba(251,146,60,0.2)',
                                                        color: '#fdba74',
                                                        fontSize: '12px',
                                                        padding: '3px 10px',
                                                        borderRadius: '12px',
                                                        fontWeight: '600'
                                                    }}>
                                                        {label}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Coches permitidos */}
                                    {nextRace.specificCars && nextRace.allowedCars?.length > 0 && (
                                        <div style={{
                                            background: 'rgba(59,130,246,0.1)',
                                            border: '1px solid rgba(59,130,246,0.3)',
                                            borderRadius: '10px',
                                            padding: '14px',
                                            marginBottom: '12px'
                                        }}>
                                            <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#60a5fa', marginBottom: '6px' }}>
                                                🚗 Coches Permitidos
                                            </div>
                                            {nextRace.allowedCars.map((car, idx) => (
                                                <div key={idx} style={{ fontSize: '12px', color: '#93c5fd', marginBottom: '2px' }}>
                                                    • {car}
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Penalizaciones */}
                                    {(rules.penaltyShortcut || rules.penaltyWall || rules.penaltyPitLine || rules.penaltyCarCollision || rules.shortcutPenalty || rules.wallHitPenalty || rules.pitLinePenalty) && (
                                        <div style={{
                                            background: 'rgba(239,68,68,0.1)',
                                            border: '1px solid rgba(239,68,68,0.2)',
                                            borderRadius: '10px',
                                            padding: '14px',
                                            marginBottom: '12px'
                                        }}>
                                            <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#ef4444', marginBottom: '6px' }}>
                                                ⚠️ Penalizaciones
                                            </div>
                                            <div style={{ fontSize: '12px', color: '#fca5a5' }}>
                                                {(rules.penaltyShortcut || rules.shortcutPenalty) && <div>• Atajos: {rules.penaltyShortcut || rules.shortcutPenalty}</div>}
                                                {(rules.penaltyWall || rules.wallHitPenalty) && <div>• Choque muro: {rules.penaltyWall || rules.wallHitPenalty}</div>}
                                                {(rules.penaltyPitLine || rules.pitLinePenalty) && <div>• Cruzar línea box: {rules.penaltyPitLine || rules.pitLinePenalty}</div>}
                                                {rules.penaltyCarCollision && <div>• Colisión entre coches: {rules.penaltyCarCollision}</div>}
                                                {rules.ghostCar !== undefined && <div>• Fantasma: {rules.ghostCar ? 'Sí' : 'No'}</div>}
                                            </div>
                                        </div>
                                    )}

                                    {/* Streaming */}
                                    {championship?.streaming?.casterName && (
                                        <div style={{
                                            background: 'rgba(139,92,246,0.1)',
                                            border: '1px solid rgba(139,92,246,0.3)',
                                            borderRadius: '10px',
                                            padding: '14px',
                                            marginBottom: '12px'
                                        }}>
                                            <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#a78bfa', marginBottom: '6px' }}>
                                                📺 Transmisión
                                            </div>
                                            <div style={{ fontSize: '12px', color: '#c4b5fd' }}>
                                                {championship.streaming.casterName && <div>🎙️ Caster: {championship.streaming.casterName}</div>}
                                                {championship.streaming.hostName && <div>🏠 Host: {championship.streaming.hostName}</div>}
                                                {streamPlatform && <div>{streamPlatform.icon} {streamPlatform.label}</div>}
                                            </div>
                                        </div>
                                    )}

                                    {/* Weather Slots */}
                                    {weatherSlots && (
                                        <div style={{
                                            background: 'rgba(255,255,255,0.03)',
                                            border: '1px solid rgba(255,255,255,0.08)',
                                            borderRadius: '10px',
                                            padding: '14px',
                                            marginBottom: '12px'
                                        }}>
                                            <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#9ca3af', marginBottom: '6px' }}>
                                                🌤️ Slots Climáticos
                                            </div>
                                            <div style={{ fontSize: '12px', color: '#6b7280', fontFamily: 'monospace' }}>
                                                {typeof weatherSlots === 'string' ? weatherSlots : JSON.stringify(weatherSlots)}
                                            </div>
                                        </div>
                                    )}

                                    {/* Footer */}
                                    <div style={{
                                        marginTop: '16px',
                                        paddingTop: '12px',
                                        borderTop: '1px solid rgba(255,255,255,0.1)',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center'
                                    }}>
                                        <div style={{ fontSize: '11px', color: '#6b7280' }}>
                                            GT7 Championships • imsa.trenkit.com
                                        </div>
                                        <div style={{ fontSize: '11px', color: '#6b7280' }}>
                                            {progress?.completed || 0}/{progress?.total || 0} completadas
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

/** Mini componente para las cajas de info del briefing */
function InfoBox({ icon, title, items }) {
    return (
        <div style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '10px',
            padding: '12px'
        }}>
            <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#9ca3af', marginBottom: '4px' }}>
                {icon} {title}
            </div>
            {items.map((item, idx) => (
                <div key={idx} style={{ fontSize: '12px', color: 'white', marginBottom: '1px' }}>
                    {item}
                </div>
            ))}
        </div>
    );
}
