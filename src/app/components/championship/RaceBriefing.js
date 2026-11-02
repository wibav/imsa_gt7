"use client";
import { useRef, useState } from "react";
import { toPng } from "html-to-image";
import { formatDateFull, getRaceTime } from "../../utils/dateUtils";
import { normalizarReglas, textoAjuste } from "../../utils/roomConfig";
import { traducirSala } from "../../utils/roomConfigI18n";
import { useI18n } from "../../i18n";

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
export default function RaceBriefing({ nextRace, championship, progress, transmisiones = [] }) {
    const briefingRef = useRef(null);
    const [exporting, setExporting] = useState(false);
    const [showBriefing, setShowBriefing] = useState(false);
    const { t, lang, locale } = useI18n();

    if (!nextRace) return null;

    // Valores con los nombres del juego, sea cual sea el formato guardado
    // (ver utils/roomConfig.js).
    const rules = normalizarReglas(nextRace.rules || {});
    const ajuste = (id) => textoAjuste(nextRace, id, rules, lang);
    const b = (clave, vars) => t(`componentes.briefing.${clave}`, vars);
    const weather = nextRace.weather || {};
    const timeOfDay = rules.timeOfDay || weather.timeOfDay;
    const timeMultiplier = rules.timeMultiplier || weather.multiplier;
    const weatherSlots = rules.weatherSlots || weather.slots;
    const damageLabel = ajuste('mechanicalDamage');
    const neumaticos = [
        ajuste('usableTyres') && `${b('utilizables')}: ${ajuste('usableTyres')}`,
        rules.usableCompounds?.length > 0 && `${b('tipos')}: ${ajuste('usableCompounds')}`,
        rules.requiredCompounds?.length > 0 && `${b('requeridos')}: ${ajuste('requiredCompounds')}`,
    ].filter(Boolean);

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
            alert(`✅ ${b('copiado')}`);
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
                📋 {b('titulo')}
            </button>

            {/* Modal del Briefing */}
            {showBriefing && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-start justify-center p-4 overflow-y-auto">
                    <div className="bg-slate-800 rounded-2xl border border-white/10 max-w-xl w-full my-8">
                        {/* Header */}
                        <div className="flex items-center justify-between p-4 border-b border-white/10">
                            <h3 className="text-white font-bold text-lg">📋 {b('titulo')}</h3>
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
                                {exporting ? `⏳ ${b('generando')}` : `💾 ${b('descargar')}`}
                            </button>
                            <button
                                onClick={handleCopyToClipboard}
                                disabled={exporting}
                                className="flex-1 inline-flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 text-white px-4 py-3 rounded-lg font-bold transition-all text-sm"
                            >
                                {exporting ? '⏳...' : `📋 ${b('copiar')}`}
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
                                            📋 {b('titulo')}
                                        </div>
                                        <div style={{ fontSize: '20px', fontWeight: 'bold', color: 'white' }}>
                                            {championship?.name || b('campeonato')}
                                        </div>
                                        {championship?.season && (
                                            <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.8)', marginTop: '2px' }}>
                                                {t('campeonato.temporada', { temporada: championship.season })}
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
                                            {b('rondaDe', { n: nextRace.round, total: progress?.total || '?' })}
                                        </div>
                                        <div style={{ fontSize: '22px', fontWeight: 'bold', color: 'white', marginBottom: '6px' }}>
                                            🏁 {nextRace.name}
                                        </div>
                                        {nextRace.country && (
                                            <div style={{ fontSize: '13px', color: '#9ca3af' }}>📍 {nextRace.country}</div>
                                        )}
                                        {nextRace.date && (
                                            <div style={{ fontSize: '14px', color: '#60a5fa', marginTop: '8px', fontWeight: '600' }}>
                                                📅 {formatDateFull(nextRace.date, locale)} · 🕐 {getRaceTime(championship, nextRace)}h ({t('campeonato.espana')})
                                                {daysUntil !== null && daysUntil > 0 && (
                                                    <span style={{ color: '#fbbf24', marginLeft: '8px' }}>
                                                        ({b('dias', { n: daysUntil })})
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
                                                title={b('formato')}
                                                items={[
                                                    nextRace.raceType === 'sprint_carrera' ? b('sprintCarrera') :
                                                        nextRace.raceType === 'resistencia' ? b('resistencia') : b('carrera'),
                                                    nextRace.laps ? b('vueltas', { n: nextRace.laps }) : null,
                                                    nextRace.duration ? `${nextRace.duration} min` : null
                                                ].filter(Boolean)}
                                            />
                                        )}

                                        {/* Categoría */}
                                        {nextRace.category && (
                                            <InfoBox
                                                icon="🏷️"
                                                title={b('categoria')}
                                                items={[nextRace.category]}
                                            />
                                        )}

                                        {/* Climatología */}
                                        {(timeOfDay || rules.weather || timeMultiplier) && (
                                            <InfoBox
                                                icon="🌦️"
                                                title={b('climatologia')}
                                                items={[
                                                    traducirSala(timeOfDay, lang),
                                                    timeMultiplier ? b('escalaTiempo', { x: timeMultiplier }) : null,
                                                    ajuste('weather')
                                                ].filter(Boolean)}
                                            />
                                        )}

                                        {/* Desgaste */}
                                        {(rules.tireWear || rules.fuelConsumption) && (
                                            <InfoBox
                                                icon="⚙️"
                                                title={b('desgaste')}
                                                items={[
                                                    rules.tireWear ? `${b('neumaticos')}: ${ajuste('tireWear')}` : null,
                                                    rules.fuelConsumption ? `${b('combustible')}: ${ajuste('fuelConsumption')}` : null,
                                                    rules.fuelRefillRate ? `${b('recarga')}: ${ajuste('fuelRefillRate')}` : null
                                                ].filter(Boolean)}
                                            />
                                        )}

                                        {/* Daños */}
                                        {damageLabel && (
                                            <InfoBox
                                                icon="💥"
                                                title={b('danos')}
                                                items={[damageLabel]}
                                            />
                                        )}

                                        {/* BOP / Ajustes */}
                                        {rules.tuningProhibited !== undefined && (
                                            <InfoBox
                                                icon="⚖️"
                                                title={b('configuracion')}
                                                items={[
                                                    `BoP: ${ajuste('tuningProhibited')}`,
                                                    rules.maxPR != null ? `${traducirSala('Límite de PR', lang)}: ${ajuste('maxPR')}` : null,
                                                    rules.maxCV != null ? `${traducirSala('Potencia de salida máx.', lang)}: ${ajuste('maxCV')}` : null,
                                                ].filter(Boolean)}
                                            />
                                        )}
                                    </div>

                                    {/* Neumáticos obligatorios */}
                                    {neumaticos.length > 0 && (
                                        <div style={{
                                            background: 'rgba(251,146,60,0.1)',
                                            border: '1px solid rgba(251,146,60,0.3)',
                                            borderRadius: '10px',
                                            padding: '14px',
                                            marginBottom: '12px'
                                        }}>
                                            <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#fb923c', marginBottom: '6px' }}>
                                                🛞 {b('neumaticos')}
                                            </div>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                                {neumaticos.map((label, idx) => (
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
                                                🚗 {b('cochesPermitidos')}
                                            </div>
                                            {nextRace.allowedCars.map((car, idx) => (
                                                <div key={idx} style={{ fontSize: '12px', color: '#93c5fd', marginBottom: '2px' }}>
                                                    • {car}
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Penalizaciones */}
                                    {(rules.penaltyShortcut || rules.penaltyWall || rules.penaltyPitLine || rules.penaltyCarCollision) && (
                                        <div style={{
                                            background: 'rgba(239,68,68,0.1)',
                                            border: '1px solid rgba(239,68,68,0.2)',
                                            borderRadius: '10px',
                                            padding: '14px',
                                            marginBottom: '12px'
                                        }}>
                                            <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#ef4444', marginBottom: '6px' }}>
                                                ⚠️ {b('penalizaciones')}
                                            </div>
                                            <div style={{ fontSize: '12px', color: '#fca5a5' }}>
                                                {rules.penaltyShortcut && <div>• {b('atajos')}: {ajuste('penaltyShortcut')}</div>}
                                                {rules.penaltyWall && <div>• {b('muros')}: {ajuste('penaltyWall')}</div>}
                                                {rules.penaltyPitLine && <div>• {b('lineaBoxes')}: {ajuste('penaltyPitLine')}</div>}
                                                {rules.penaltyCarCollision && <div>• {b('choqueAutos')}: {ajuste('penaltyCarCollision')}</div>}
                                                {rules.ghostCar !== undefined && <div>• {b('fantasmas')}: {ajuste('ghostCar')}</div>}
                                            </div>
                                        </div>
                                    )}

                                    {/* Streaming: todos los casters, uno por canal (ver streamingUtils) */}
                                    {transmisiones.length > 0 && (
                                        <div style={{
                                            background: 'rgba(139,92,246,0.1)',
                                            border: '1px solid rgba(139,92,246,0.3)',
                                            borderRadius: '10px',
                                            padding: '14px',
                                            marginBottom: '12px'
                                        }}>
                                            <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#a78bfa', marginBottom: '6px' }}>
                                                📺 {transmisiones.length > 1 ? b('transmisiones') : t('campeonato.transmision')}
                                            </div>
                                            {transmisiones.map(tm => (
                                                <div key={tm.url} style={{ fontSize: '12px', color: '#c4b5fd', marginTop: '4px' }}>
                                                    🎙️ <span style={{ color: 'white', fontWeight: 'bold' }}>{tm.caster}</span>
                                                    {tm.plataforma && <span> · {tm.plataforma.icon} {tm.plataforma.label}</span>}
                                                    {tm.salas.length > 0 && <span> · {tm.salas.map(x => x.name).join(', ')}</span>}
                                                    {tm.hosts.length > 0 && <span> · 🏠 {tm.hosts.join(', ')}</span>}
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Weather Slots */}
                                    {/* Un [] vacío también es "verdadero": antes salía «[]» en la imagen */}
                                    {Array.isArray(weatherSlots) && weatherSlots.length > 0 && (
                                        <div style={{
                                            background: 'rgba(255,255,255,0.03)',
                                            border: '1px solid rgba(255,255,255,0.08)',
                                            borderRadius: '10px',
                                            padding: '14px',
                                            marginBottom: '12px'
                                        }}>
                                            <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#9ca3af', marginBottom: '6px' }}>
                                                🌤️ {traducirSala('Clima durante la carrera', lang)}
                                            </div>
                                            <div style={{ fontSize: '12px', color: '#9ca3af' }}>
                                                {ajuste('weatherSlots')}
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
                                            {b('completadas', { a: progress?.completed || 0, total: progress?.total || 0 })}
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
