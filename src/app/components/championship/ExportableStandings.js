"use client";
import { useRef, useState } from "react";
import { toPng } from "html-to-image";
import { getPositionDisplay } from "../../utils/constants";

/**
 * Componente para exportar la clasificación como imagen PNG.
 * Renderiza una versión optimizada para compartir en redes sociales.
 * 
 * @param {Object} props
 * @param {Array} props.standings - driverStandings del calculador avanzado
 * @param {Array} [props.teamStandings] - teamStandings (campeonatos por equipos)
 * @param {Object} props.championship - Datos del campeonato
 * @param {Object} props.progress - { completed, total, percentage }
 * @param {Array} [props.raceColumns] - Columnas de carreras
 */
export default function ExportableStandings({
    standings = [],
    teamStandings = [],
    championship,
    progress,
    raceColumns = []
}) {
    const exportRef = useRef(null);
    const [exporting, setExporting] = useState(false);
    const [showPreview, setShowPreview] = useState(false);

    const handleExport = async () => {
        if (!exportRef.current) return;
        setExporting(true);

        try {
            const dataUrl = await toPng(exportRef.current, {
                backgroundColor: '#0f172a',
                pixelRatio: 2,
                quality: 1,
                style: {
                    transform: 'scale(1)',
                    transformOrigin: 'top left'
                }
            });

            // Descargar la imagen
            const link = document.createElement('a');
            link.download = `clasificacion-${championship?.shortName || championship?.name || 'campeonato'}.png`;
            link.href = dataUrl;
            link.click();
        } catch (error) {
            console.error('Error exportando imagen:', error);
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
            // Fallback: descargar
            handleExport();
        } finally {
            setExporting(false);
        }
    };

    if (standings.length === 0) return null;

    const maxDrivers = 20; // Máximo de pilotos a mostrar en la imagen
    const displayStandings = standings.slice(0, maxDrivers);
    const displayTeams = teamStandings.slice(0, 10);
    const now = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });

    return (
        <>
            {/* Botones de exportación */}
            <div className="flex flex-wrap gap-2">
                <button
                    onClick={() => setShowPreview(true)}
                    className="inline-flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white px-4 py-2 rounded-lg font-semibold text-sm transition-all"
                >
                    📸 Exportar como Imagen
                </button>
            </div>

            {/* Modal de preview + export */}
            {showPreview && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-start justify-center p-4 overflow-y-auto">
                    <div className="bg-slate-800 rounded-2xl border border-white/10 max-w-2xl w-full my-8">
                        {/* Header del modal */}
                        <div className="flex items-center justify-between p-4 border-b border-white/10">
                            <h3 className="text-white font-bold text-lg">📸 Exportar Clasificación</h3>
                            <button
                                onClick={() => setShowPreview(false)}
                                className="text-gray-400 hover:text-white transition-colors text-xl"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Botones */}
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

                        {/* Preview de la imagen */}
                        <div className="p-4 overflow-auto max-h-[60vh]">
                            <div ref={exportRef} style={{ width: '540px' }}>
                                {/* ══ IMAGEN EXPORTABLE ══ */}
                                <div style={{
                                    background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
                                    padding: '24px',
                                    fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
                                }}>
                                    {/* Header del campeonato */}
                                    <div style={{
                                        background: 'linear-gradient(135deg, #ea580c, #dc2626)',
                                        borderRadius: '12px',
                                        padding: '20px',
                                        marginBottom: '16px',
                                        textAlign: 'center'
                                    }}>
                                        <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'white', marginBottom: '4px' }}>
                                            {championship?.name || 'Campeonato'}
                                        </div>
                                        {championship?.season && (
                                            <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.8)' }}>
                                                📅 Temporada {championship.season}
                                            </div>
                                        )}
                                        <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)', marginTop: '4px' }}>
                                            🏁 {progress?.completed || 0}/{progress?.total || 0} carreras completadas • {now}
                                        </div>
                                    </div>

                                    {/* Tabla de equipos (si aplica) */}
                                    {displayTeams.length > 0 && (
                                        <div style={{ marginBottom: '16px' }}>
                                            <div style={{ fontSize: '14px', fontWeight: 'bold', color: 'white', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                🏆 Clasificación por Equipos
                                            </div>
                                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                                <thead>
                                                    <tr style={{ background: 'linear-gradient(135deg, #2563eb, #4f46e5)' }}>
                                                        <th style={{ padding: '6px 10px', textAlign: 'left', fontSize: '11px', color: 'white', fontWeight: 'bold' }}>#</th>
                                                        <th style={{ padding: '6px 10px', textAlign: 'left', fontSize: '11px', color: 'white', fontWeight: 'bold' }}>Equipo</th>
                                                        <th style={{ padding: '6px 10px', textAlign: 'center', fontSize: '11px', color: 'white', fontWeight: 'bold' }}>Vic</th>
                                                        <th style={{ padding: '6px 10px', textAlign: 'center', fontSize: '11px', color: 'white', fontWeight: 'bold' }}>Pod</th>
                                                        <th style={{ padding: '6px 10px', textAlign: 'right', fontSize: '11px', color: 'white', fontWeight: 'bold' }}>Pts</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {displayTeams.map((team, idx) => (
                                                        <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: idx % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent' }}>
                                                            <td style={{ padding: '6px 10px', fontSize: '12px', color: idx < 3 ? '#fbbf24' : '#9ca3af', fontWeight: 'bold' }}>
                                                                {getPositionDisplay(idx + 1)}
                                                            </td>
                                                            <td style={{ padding: '6px 10px', fontSize: '12px' }}>
                                                                <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: team.color || '#6b7280', marginRight: '6px', verticalAlign: 'middle' }} />
                                                                <span style={{ color: 'white', fontWeight: '600' }}>{team.name}</span>
                                                            </td>
                                                            <td style={{ padding: '6px 10px', textAlign: 'center', fontSize: '12px', color: '#fbbf24' }}>{team.wins || '-'}</td>
                                                            <td style={{ padding: '6px 10px', textAlign: 'center', fontSize: '12px', color: '#9ca3af' }}>{team.podiums || '-'}</td>
                                                            <td style={{ padding: '6px 10px', textAlign: 'right', fontSize: '14px', color: '#fb923c', fontWeight: 'bold' }}>{team.totalPoints}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}

                                    {/* Tabla de pilotos */}
                                    <div>
                                        <div style={{ fontSize: '14px', fontWeight: 'bold', color: 'white', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            👤 Clasificación de Pilotos
                                        </div>
                                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                            <thead>
                                                <tr style={{ background: 'linear-gradient(135deg, #ea580c, #dc2626)' }}>
                                                    <th style={{ padding: '6px 10px', textAlign: 'left', fontSize: '11px', color: 'white', fontWeight: 'bold' }}>#</th>
                                                    <th style={{ padding: '6px 10px', textAlign: 'left', fontSize: '11px', color: 'white', fontWeight: 'bold' }}>Piloto</th>
                                                    {championship?.settings?.isTeamChampionship && (
                                                        <th style={{ padding: '6px 10px', textAlign: 'left', fontSize: '11px', color: 'white', fontWeight: 'bold' }}>Equipo</th>
                                                    )}
                                                    <th style={{ padding: '6px 10px', textAlign: 'center', fontSize: '11px', color: 'white', fontWeight: 'bold' }}>Vic</th>
                                                    <th style={{ padding: '6px 10px', textAlign: 'center', fontSize: '11px', color: 'white', fontWeight: 'bold' }}>Pod</th>
                                                    <th style={{ padding: '6px 10px', textAlign: 'right', fontSize: '11px', color: 'white', fontWeight: 'bold' }}>Pts</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {displayStandings.map((driver, idx) => (
                                                    <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: idx % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent' }}>
                                                        <td style={{ padding: '5px 10px', fontSize: '12px', color: idx < 3 ? '#fbbf24' : '#9ca3af', fontWeight: 'bold' }}>
                                                            {getPositionDisplay(idx + 1)}
                                                        </td>
                                                        <td style={{ padding: '5px 10px', fontSize: '12px', color: 'white', fontWeight: '600' }}>
                                                            {driver.name}
                                                        </td>
                                                        {championship?.settings?.isTeamChampionship && (
                                                            <td style={{ padding: '5px 10px', fontSize: '11px', color: '#6b7280' }}>
                                                                {driver.teamColor && (
                                                                    <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: driver.teamColor, marginRight: '4px', verticalAlign: 'middle' }} />
                                                                )}
                                                                {driver.team}
                                                            </td>
                                                        )}
                                                        <td style={{ padding: '5px 10px', textAlign: 'center', fontSize: '12px', color: driver.wins > 0 ? '#fbbf24' : '#6b7280' }}>
                                                            {driver.wins || '-'}
                                                        </td>
                                                        <td style={{ padding: '5px 10px', textAlign: 'center', fontSize: '12px', color: '#9ca3af' }}>
                                                            {driver.podiums || '-'}
                                                        </td>
                                                        <td style={{ padding: '5px 10px', textAlign: 'right', fontSize: '14px', color: '#fb923c', fontWeight: 'bold' }}>
                                                            {driver.totalPoints}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                        {standings.length > maxDrivers && (
                                            <div style={{ textAlign: 'center', fontSize: '11px', color: '#6b7280', padding: '8px 0' }}>
                                                +{standings.length - maxDrivers} pilotos más
                                            </div>
                                        )}
                                    </div>

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
                                            Actualizado: {now}
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
