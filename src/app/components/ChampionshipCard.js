"use client";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { calculateProgress, getNextRace } from "../utils/championshipUtils";
import { formatDateShort } from "../utils/dateUtils";
import { STATUS_COLORS, STATUS_LABELS } from "../utils/constants";

// Re-exportar calculateProgress para compatibilidad con código existente
export { calculateProgress } from "../utils/championshipUtils";

/**
 * ChampionshipCard - Card de campeonato con información y progreso
 * 
 * @param {Object} championship - Datos del campeonato
 * @param {Array} tracks - Pistas del campeonato para calcular progreso
 * @param {Function} onClick - Función para navegar al detalle (opcional)
 */
export default function ChampionshipCard({ championship, tracks = [], onClick }) {
    const router = useRouter();
    const progress = calculateProgress(tracks, championship);
    const nextRace = getNextRace(tracks);

    const handleClick = () => {
        if (onClick) {
            onClick(championship);
        } else {
            router.push(`/championships?id=${championship.id}`);
        }
    };

    return (
        <div
            className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl overflow-hidden shadow-2xl border border-orange-500/30 hover:border-orange-500/60 transition-all duration-300 hover:scale-105 cursor-pointer group"
            onClick={handleClick}
        >
            {/* Banner del campeonato */}
            {championship.banner && (
                <div className="relative w-full h-48 bg-black/50">
                    <Image
                        src={championship.banner}
                        alt={championship.name}
                        fill
                        className="object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-300"
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    />
                    {/* Badge de estado */}
                    <div className="absolute top-3 right-3">
                        <span className={`${STATUS_COLORS[championship.status] || 'bg-gray-500'} text-white text-xs px-2 py-1 rounded-full font-bold`}>
                            {STATUS_LABELS[championship.status] || championship.status}
                        </span>
                    </div>
                </div>
            )}

            {/* Contenido del card */}
            <div className="p-6">
                {/* Título y temporada */}
                <div className="mb-4">
                    <h3 className="text-2xl font-bold text-white mb-2">
                        {championship.name}
                    </h3>
                    {championship.season && (
                        <p className="text-orange-400 text-sm font-semibold">
                            📅 Temporada {championship.season}
                        </p>
                    )}
                </div>

                {/* Barra de progreso */}
                <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-gray-300 text-sm font-medium">
                            Progreso del Campeonato
                        </span>
                        <span className="text-white font-bold text-lg">
                            {progress.percentage}%
                        </span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
                        <div
                            className="bg-gradient-to-r from-green-500 to-emerald-500 h-full rounded-full transition-all duration-500 ease-out"
                            style={{ width: `${progress.percentage}%` }}
                        />
                    </div>
                    <p className="text-gray-400 text-sm mt-1">
                        {progress.completed} de {progress.total} carreras completadas
                    </p>
                </div>

                {/* Categorías */}
                {championship.categories && championship.categories.length > 0 && (
                    <div className="mb-4">
                        <div className="text-gray-400 font-semibold text-xs mb-2">
                            🏎️ CATEGORÍAS
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {championship.categories.map(cat => (
                                <span
                                    key={cat}
                                    className="bg-blue-600/30 border border-blue-400/50 text-blue-200 text-xs px-3 py-1 rounded-full font-semibold"
                                >
                                    {cat}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {/* Información adicional */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                        <div className="text-gray-400 text-xs mb-1">Tipo</div>
                        <div className="text-white font-semibold text-sm">
                            {championship.settings?.isTeamChampionship ? '👥 Por Equipos' : '👤 Individual'}
                        </div>
                    </div>
                    <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                        <div className="text-gray-400 text-xs mb-1">Carreras</div>
                        <div className="text-white font-semibold text-sm">
                            🏁 {progress.total} circuitos
                        </div>
                    </div>
                </div>

                {/* Próxima carrera */}
                {nextRace && (
                    <div className="bg-gradient-to-r from-orange-600/20 to-red-600/20 border border-orange-400/30 rounded-lg p-3 mb-4">
                        <div className="flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                                <div className="text-orange-300 text-xs font-semibold mb-1">🏁 Próxima Carrera</div>
                                <div className="text-white font-bold text-sm truncate">{nextRace.name}</div>
                            </div>
                            <div className="text-right ml-2">
                                <div className="text-orange-200 text-sm font-semibold">
                                    {formatDateShort(nextRace.date)}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Descripción */}
                {championship.description && (
                    <p className="text-gray-300 text-sm mb-4 line-clamp-2">
                        {championship.description}
                    </p>
                )}

                {/* Botón de acción */}
                <button
                    className="w-full bg-gradient-to-r from-orange-600 to-red-600 text-white px-4 py-3 rounded-lg font-bold hover:from-orange-700 hover:to-red-700 transition-all duration-200 shadow-lg hover:shadow-xl"
                >
                    🏆 Ver Campeonato
                </button>
            </div>
        </div>
    );
}
