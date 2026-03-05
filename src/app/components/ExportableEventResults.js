"use client";
import { useRef, useState } from "react";
import { toPng } from "html-to-image";

/**
 * Componente exportable de resultados de evento como imagen PNG.
 * Soporta eventos estándar y multi-ronda (eliminatoria / doble eliminatoria).
 *
 * @param {Object} props
 * @param {Object} props.event - Datos completos del evento
 */
export default function ExportableEventResults({ event }) {
    const exportRef = useRef(null);
    const [exporting, setExporting] = useState(false);
    const [showPreview, setShowPreview] = useState(false);

    if (!event) return null;

    const isMultiRound = event.eventType && event.eventType !== 'standard' && event.rounds?.length > 0;
    const hasStandardResults = event.results?.length > 0;
    const hasRoundResults = isMultiRound && event.rounds.some(r => r.rooms?.some(rm => rm.results?.length > 0));

    if (!hasStandardResults && !hasRoundResults) return null;

    const handleExport = async () => {
        if (!exportRef.current) return;
        setExporting(true);
        try {
            const dataUrl = await toPng(exportRef.current, {
                backgroundColor: '#0f172a',
                pixelRatio: 2,
                quality: 1,
                style: { transform: 'scale(1)', transformOrigin: 'top left' }
            });
            const link = document.createElement('a');
            link.download = `resultados-${event.title?.replace(/\s+/g, '-') || 'evento'}.png`;
            link.href = dataUrl;
            link.click();
        } catch (error) {
            console.error('Error exportando resultados:', error);
            alert('Error al exportar la imagen. Intente de nuevo.');
        } finally {
            setExporting(false);
        }
    };

    const handleCopyToClipboard = async () => {
        if (!exportRef.current) return;
        setExporting(true);
        try {
            const dataUrl = await toPng(exportRef.current, {
                backgroundColor: '#0f172a',
                pixelRatio: 2,
                quality: 1
            });
            const response = await fetch(dataUrl);
            const blob = await response.blob();
            await navigator.clipboard.write([
                new ClipboardItem({ 'image/png': blob })
            ]);
            alert('✅ Imagen copiada al portapapeles');
        } catch (error) {
            console.error('Error copiando al clipboard:', error);
            handleExport();
        } finally {
            setExporting(false);
        }
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        const date = new Date(dateStr + 'T00:00:00');
        return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    const positionDisplay = (idx) => {
        if (idx === 0) return '🥇';
        if (idx === 1) return '🥈';
        if (idx === 2) return '🥉';
        return `${idx + 1}°`;
    };

    const EVENT_TYPE_LABELS = {
        eliminatoria: '🔥 Eliminatoria',
        doble_eliminatoria: '⚔️ Doble Eliminatoria'
    };

    return (
        <>
            {/* Export buttons */}
            <div className="flex flex-wrap gap-2">
                <button
                    onClick={() => setShowPreview(true)}
                    className="inline-flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white px-4 py-2 rounded-lg font-semibold text-sm transition-all"
                >
                    📸 Exportar Resultados
                </button>
            </div>

            {/* Modal preview + export */}
            {showPreview && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-start justify-center p-4 overflow-y-auto">
                    <div className="bg-slate-800 rounded-2xl border border-white/10 max-w-2xl w-full my-8">
                        {/* Header */}
                        <div className="flex items-center justify-between p-4 border-b border-white/10">
                            <h3 className="text-white font-bold text-lg">📸 Exportar Resultados</h3>
                            <button onClick={() => setShowPreview(false)} className="text-gray-400 hover:text-white transition-colors text-xl">✕</button>
                        </div>

                        {/* Buttons */}
                        <div className="flex gap-3 p-4 border-b border-white/10">
                            <button
                                onClick={handleExport}
                                disabled={exporting}
                                className="flex-1 inline-flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 text-white px-4 py-3 rounded-lg font-bold transition-all"
                            >
                                {exporting ? '⏳ Generando...' : '💾 Descargar PNG'}
                            </button>
                            <button
                                onClick={handleCopyToClipboard}
                                disabled={exporting}
                                className="flex-1 inline-flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 text-white px-4 py-3 rounded-lg font-bold transition-all"
                            >
                                {exporting ? '⏳ Copiando...' : '📋 Copiar al Clipboard'}
                            </button>
                        </div>

                        {/* Preview */}
                        <div className="p-4 overflow-auto max-h-[70vh]">
                            <div ref={exportRef} style={{ width: '540px' }}>
                                <div style={{
                                    background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
                                    padding: '24px',
                                    fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
                                }}>
                                    {/* Event header */}
                                    <div style={{
                                        background: 'linear-gradient(135deg, #ea580c, #dc2626)',
                                        borderRadius: '12px',
                                        padding: '20px',
                                        marginBottom: '16px',
                                        textAlign: 'center'
                                    }}>
                                        <div style={{ fontSize: '22px', fontWeight: 'bold', color: 'white', marginBottom: '4px' }}>
                                            {event.title || 'Evento'}
                                        </div>
                                        {event.track && (
                                            <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.85)', marginBottom: '2px' }}>
                                                🏁 {event.track}
                                            </div>
                                        )}
                                        <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)', display: 'flex', justifyContent: 'center', gap: '12px' }}>
                                            {event.date && <span>📅 {formatDate(event.date)}</span>}
                                            {isMultiRound && <span>{EVENT_TYPE_LABELS[event.eventType] || event.eventType}</span>}
                                        </div>
                                    </div>

                                    {/* Standard results */}
                                    {!isMultiRound && hasStandardResults && (
                                        <div>
                                            <div style={{ fontSize: '14px', fontWeight: 'bold', color: 'white', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                🏆 Resultados Finales
                                            </div>
                                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                                <thead>
                                                    <tr style={{ background: 'linear-gradient(135deg, #ea580c, #dc2626)' }}>
                                                        <th style={{ padding: '6px 10px', textAlign: 'left', fontSize: '11px', color: 'white', fontWeight: 'bold', width: '40px' }}>Pos</th>
                                                        <th style={{ padding: '6px 10px', textAlign: 'left', fontSize: '11px', color: 'white', fontWeight: 'bold' }}>Piloto</th>
                                                        <th style={{ padding: '6px 10px', textAlign: 'center', fontSize: '11px', color: 'white', fontWeight: 'bold', width: '60px' }}>Extras</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {event.results.map((r, idx) => (
                                                        <tr key={idx} style={{
                                                            borderBottom: '1px solid rgba(255,255,255,0.05)',
                                                            background: idx === 0 ? 'rgba(234,179,8,0.1)' : idx === 1 ? 'rgba(156,163,175,0.1)' : idx === 2 ? 'rgba(249,115,22,0.1)' : idx % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent'
                                                        }}>
                                                            <td style={{ padding: '6px 10px', fontSize: '13px', fontWeight: 'bold', color: idx < 3 ? '#fbbf24' : '#9ca3af' }}>
                                                                {positionDisplay(idx)}
                                                            </td>
                                                            <td style={{ padding: '6px 10px', fontSize: '13px', color: 'white', fontWeight: '600' }}>
                                                                {r.driverName || '-'}
                                                            </td>
                                                            <td style={{ padding: '6px 10px', textAlign: 'center', fontSize: '12px' }}>
                                                                {r.fastestLap && <span style={{ marginRight: '2px' }}>⚡</span>}
                                                                {r.polePosition && <span style={{ marginRight: '2px' }}>🅿️</span>}
                                                                {r.dnf && <span style={{ color: '#ef4444', fontSize: '10px', fontWeight: 'bold' }}>DNF</span>}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}

                                    {/* Multi-round results */}
                                    {isMultiRound && event.rounds.map((round, rIdx) => (
                                        <div key={rIdx} style={{ marginBottom: rIdx < event.rounds.length - 1 ? '16px' : '0' }}>
                                            <div style={{
                                                fontSize: '13px', fontWeight: 'bold', color: 'white',
                                                marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px',
                                                background: 'linear-gradient(135deg, rgba(37,99,235,0.2), rgba(79,70,229,0.2))',
                                                padding: '8px 12px', borderRadius: '8px'
                                            }}>
                                                <span style={{
                                                    background: '#ea580c', color: 'white', width: '22px', height: '22px',
                                                    borderRadius: '50%', display: 'inline-flex', alignItems: 'center',
                                                    justifyContent: 'center', fontSize: '11px', fontWeight: 'bold'
                                                }}>{rIdx + 1}</span>
                                                {round.name}
                                            </div>

                                            {round.rooms?.map((room, rmIdx) => {
                                                if (!room.results?.length) return null;
                                                return (
                                                    <div key={rmIdx} style={{ marginBottom: '8px' }}>
                                                        <div style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 'bold', marginBottom: '4px', paddingLeft: '4px' }}>
                                                            🏟️ {room.name}
                                                            {room.caster && <span style={{ marginLeft: '8px', color: '#6b7280' }}>🎙️ {room.caster}</span>}
                                                        </div>
                                                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                                            <thead>
                                                                <tr style={{ background: rIdx === 0 ? 'linear-gradient(135deg, #2563eb, #4f46e5)' : 'linear-gradient(135deg, #ea580c, #dc2626)' }}>
                                                                    <th style={{ padding: '4px 8px', textAlign: 'left', fontSize: '10px', color: 'white', fontWeight: 'bold', width: '35px' }}>Pos</th>
                                                                    <th style={{ padding: '4px 8px', textAlign: 'left', fontSize: '10px', color: 'white', fontWeight: 'bold' }}>Piloto</th>
                                                                    <th style={{ padding: '4px 8px', textAlign: 'center', fontSize: '10px', color: 'white', fontWeight: 'bold', width: '50px' }}>Extras</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {room.results.map((r, idx) => (
                                                                    <tr key={idx} style={{
                                                                        borderBottom: '1px solid rgba(255,255,255,0.05)',
                                                                        background: idx === 0 ? 'rgba(234,179,8,0.08)' : idx % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent'
                                                                    }}>
                                                                        <td style={{ padding: '4px 8px', fontSize: '11px', fontWeight: 'bold', color: idx < 3 ? '#fbbf24' : '#9ca3af' }}>
                                                                            {positionDisplay(idx)}
                                                                        </td>
                                                                        <td style={{ padding: '4px 8px', fontSize: '11px', color: 'white', fontWeight: '600' }}>
                                                                            {r.driverName || '-'}
                                                                        </td>
                                                                        <td style={{ padding: '4px 8px', textAlign: 'center', fontSize: '11px' }}>
                                                                            {r.fastestLap && <span>⚡</span>}
                                                                            {r.polePosition && <span>🅿️</span>}
                                                                            {r.dnf && <span style={{ color: '#ef4444', fontSize: '9px', fontWeight: 'bold' }}>DNF</span>}
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ))}

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
                                            imsa.trenkit.com
                                        </div>
                                        <div style={{ fontSize: '11px', color: '#6b7280' }}>
                                            GT7 Championship
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
