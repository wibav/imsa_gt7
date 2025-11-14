"use client";
import Image from "next/image";
import { useRouter } from "next/navigation";

/**
 * Calcula el progreso del campeonato
 * @param {Array} tracks - Array de pistas del campeonato
 * @param {Object} championship - Datos del campeonato (para fechas)
 * @returns {Object} { completed, total, percentage }
 */
export const calculateProgress = (tracks, championship) => {
    if (!tracks || tracks.length === 0) {
        // Si no hay tracks, calcular por fechas si están disponibles
        if (championship?.startDate && championship?.endDate) {
            const now = new Date();
            const start = new Date(championship.startDate);
            const end = new Date(championship.endDate);

            // Si aún no ha comenzado
            if (now < start) return { completed: 0, total: 0, percentage: 0 };

            // Si ya terminó o está completado
            if (now > end || championship.status === 'completed') {
                return { completed: 0, total: 0, percentage: 100 };
            }

            // Calcular progreso basado en el tiempo transcurrido
            const total = end.getTime() - start.getTime();
            const elapsed = now.getTime() - start.getTime();
            const percentage = Math.round((elapsed / total) * 100);

            return { completed: 0, total: 0, percentage: Math.min(100, Math.max(0, percentage)) };
        }

        return { completed: 0, total: 0, percentage: 0 };
    }

    const now = new Date();
    now.setHours(0, 0, 0, 0); // Inicio del día de hoy

    // Una pista se considera completada si:
    // 1. Su fecha ya pasó
    // 2. Tiene puntos asignados (campo points con al menos un valor)
    const completed = tracks.filter(track => {
        const trackDate = new Date(track.date + 'T00:00:00');
        const dateHasPassed = trackDate < now;
        const hasPoints = track.points && Object.keys(track.points).length > 0;

        return dateHasPassed && hasPoints;
    }).length;

    const total = tracks.length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    return { completed, total, percentage };
};

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

    // Obtener próxima carrera
    const getNextRace = () => {
        if (!tracks || tracks.length === 0) return null;

        const now = new Date();
        now.setHours(0, 0, 0, 0); // Inicio del día de hoy

        const upcomingRaces = tracks
            .filter(t => {
                const trackDate = new Date(t.date + 'T00:00:00');
                return trackDate >= now && t.status !== 'completed';
            })
            .sort((a, b) => new Date(a.date) - new Date(b.date));

        return upcomingRaces[0] || null;
    };

    const nextRace = getNextRace();

    const handleClick = () => {
        if (onClick) {
            onClick(championship);
        } else {
            router.push(`/championships?id=${championship.id}`);
        }
    };

    // Color del badge según estado
    const statusColors = {
        'active': 'bg-green-500',
        'draft': 'bg-gray-500',
        'completed': 'bg-blue-500',
        'archived': 'bg-gray-600'
    };

    const statusLabels = {
        'active': 'Activo',
        'draft': 'Borrador',
        'completed': 'Finalizado',
        'archived': 'Archivado'
    };

    // Formatear fecha
    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        const date = new Date(dateStr + 'T00:00:00');
        return date.toLocaleDateString('es-ES', {
            day: '2-digit',
            month: 'short'
        });
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
                        <span className={`${statusColors[championship.status] || 'bg-gray-500'} text-white text-xs px-2 py-1 rounded-full font-bold`}>
                            {statusLabels[championship.status] || championship.status}
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
                                    {formatDate(nextRace.date)}
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
