"use client";
import { formatDateFull, getPreQualyTime, formatTimeWindow, localTimeWindow } from '../../utils';
import RoomConfigView from './RoomConfigView';

/**
 * Ficha de la Pre-Qualy: fecha, hora, circuito, duración, autos, configuración
 * de sala (la misma vista que una carrera) y notas.
 *
 * Existe porque el mismo bloque estaba escrito tres veces —pestaña Calendario,
 * pestaña Pre-Qualy y pestaña Información— y habían ido divergiendo: una
 * formateaba la fecha con formatDateFull ("11/09/2026") y otra con
 * toLocaleDateString ("11/9/2026"), la de Pre-Qualy se había quedado sin los
 * badges de configuración de sesión, y sus notas perdían los saltos de línea
 * por no llevar `whitespace-pre-line`. El piloto veía datos distintos según por
 * dónde entrara.
 *
 * @param {Object} championship
 * @param {string} [subtitulo] - Texto bajo el título, propio de cada pestaña
 * @param {boolean} [conEtiquetaPrevia] - Píldora "Previa" (vista de calendario)
 * @param {{clasificados: number, total: number}} [resultados] - Solo la
 *        pestaña de Pre-Qualy muestra el recuento de clasificados
 */
export default function PreQualyInfo({
    championship,
    subtitulo = 'Sesión clasificatoria previa',
    conEtiquetaPrevia = false,
    resultados = null,
}) {
    const pq = championship?.preQualy;
    if (!pq?.enabled) return null;

    // La misma franja en la hora del visitante, como en la tarjeta de la
    // próxima carrera: muchos pilotos están en Latinoamérica.
    const ventana = getPreQualyTime(championship);
    const ventanaLocal = pq.date ? localTimeWindow(pq.date, ventana) : null;

    const tieneSala = pq.rules && Object.keys(pq.rules).length > 0;
    const salaComoCarrera = {
        rules: pq.rules,
        category: championship?.categories?.join(', '),
        victoria: `Límite de tiempo (${pq.duration ?? 15} min)`,
    };

    const celda = (etiqueta, valor) => (
        <div className="bg-white/5 rounded-lg p-3">
            <div className="text-gray-400 text-xs mb-1">{etiqueta}</div>
            <div className="text-white font-medium">{valor}</div>
        </div>
    );

    return (
        <div className="bg-gradient-to-br from-purple-900/60 to-indigo-900/60 rounded-xl p-6 border border-purple-400/40">
            <div className="flex items-center gap-3 mb-4">
                <span className="bg-purple-600 text-white text-xs font-bold px-2 py-1 rounded-full flex-shrink-0">PQ</span>
                <div className="min-w-0">
                    <h3 className="text-lg font-bold text-white">Pre-Qualy</h3>
                    <p className="text-purple-300 text-sm">{subtitulo}</p>
                </div>
                {conEtiquetaPrevia && (
                    <span className="ml-auto text-xs bg-purple-500/30 border border-purple-400/40 text-purple-200 px-2 py-1 rounded-full flex-shrink-0">
                        Previa
                    </span>
                )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 text-sm">
                {pq.date && celda('📅 Fecha', formatDateFull(pq.date))}
                {celda(
                    '🕐 Hora',
                    <>
                        {formatTimeWindow(ventana)}{' '}
                        <span className="text-gray-400 font-normal text-xs">(España)</span>
                        {ventanaLocal && (
                            <div className="text-gray-400 font-normal text-xs mt-0.5">
                                {formatTimeWindow(ventanaLocal)} tu hora
                            </div>
                        )}
                    </>
                )}
                {pq.track && celda('📍 Circuito', pq.track)}
                {celda('⏱️ Duración', `${pq.duration ?? 15} min`)}
                {resultados && celda('🏁 Clasificados', `${resultados.clasificados} / ${resultados.total}`)}
            </div>

            {pq.allowedCars?.length > 0 && (
                <div className="mt-3 inline-flex items-start gap-2 bg-orange-500/15 border border-orange-500/30 text-orange-100 px-3 py-2 rounded-lg text-sm">
                    <span className="font-semibold flex-shrink-0">🚗 Autos:</span>
                    <span className="text-orange-50">{pq.allowedCars.join(', ')}</span>
                </div>
            )}

            {tieneSala && (
                <details className="mt-4 group">
                    <summary className="cursor-pointer list-none inline-flex items-center gap-2 px-4 py-2 bg-purple-600/30 hover:bg-purple-600/50 border border-purple-400/40 text-purple-100 rounded-lg text-sm font-semibold transition-all">
                        🎮 <span className="group-open:hidden">Ver configuración de sala</span><span className="hidden group-open:inline">Ocultar configuración de sala</span>
                    </summary>
                    <div className="mt-3">
                        <RoomConfigView track={salaComoCarrera} />
                    </div>
                </details>
            )}

            {pq.notes && (
                <div className="mt-3 bg-purple-500/10 border border-purple-500/20 rounded-lg p-3">
                    <p className="text-purple-200 text-sm whitespace-pre-line">{pq.notes}</p>
                </div>
            )}
        </div>
    );
}
