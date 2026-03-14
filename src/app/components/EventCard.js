"use client";
import { useMemo } from "react";
import Image from "next/image";
import { EVENT_STATUSES, EVENT_CATEGORIES } from "../utils";

/**
 * EventCard - Card pública para eventos únicos
 * Muestra información del evento con banner, detalles, streaming, countdown y acciones
 *
 * @param {Object} event - Datos del evento
 * @param {Function} onViewDetails - Callback para ver detalles
 * @param {Function} onRegister - Callback para inscribirse
 */
export default function EventCard({ event, onViewDetails, onRegister }) {
    // Formatear fecha
    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        const date = new Date(dateStr + 'T00:00:00');
        return date.toLocaleDateString('es-ES', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    // Compute status
    const eventStatus = useMemo(() => {
        if (event.status === 'live') return 'live';
        if (event.status === 'completed') return 'completed';
        if (!event.date) return 'upcoming';
        const eventDate = new Date(event.date + 'T23:59:59');
        return eventDate < new Date() ? 'completed' : 'upcoming';
    }, [event.date, event.status]);

    // Countdown
    const countdown = useMemo(() => {
        if (!event.date || eventStatus !== 'upcoming') return null;
        const target = new Date(`${event.date}T${event.hour || '00:00'}:00`);
        const diff = target - new Date();
        if (diff <= 0) return null;
        const days = Math.floor(diff / 86400000);
        const hours = Math.floor((diff % 86400000) / 3600000);
        const mins = Math.floor((diff % 3600000) / 60000);
        if (days > 0) return `${days}d ${hours}h`;
        if (hours > 0) return `${hours}h ${mins}m`;
        return `${mins}m`;
    }, [event.date, event.hour, eventStatus]);

    const isSpecial = event.isSpecialEvent || event.category === 'special';
    const eventActive = eventStatus === 'upcoming' || eventStatus === 'live';
    const statusConfig = EVENT_STATUSES[eventStatus] || EVENT_STATUSES.upcoming;
    const cat = EVENT_CATEGORIES.find(c => c.value === event.category);
    const hasStreaming = event.streaming?.url;
    const participantCount = event.participants?.length || event.participantCount || 0;
    const maxP = event.maxParticipants || 0;
    const isFull = maxP > 0 && participantCount >= maxP;

    return (
        <div className={`
            bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl overflow-hidden shadow-2xl 
            border transition-all duration-300 hover:scale-[1.02]
            ${eventStatus === 'live' ? 'border-green-500/60 ring-2 ring-green-500/20' : isSpecial ? 'border-yellow-500/50' : 'border-orange-500/30 hover:border-orange-500/60'}
        `}>
            {/* Header con banner */}
            <div className="relative">
                {event.banner ? (
                    <div className="relative w-full h-48 bg-black/50">
                        <Image
                            src={event.banner}
                            alt={event.title}
                            fill
                            className="object-cover"
                            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                        />
                    </div>
                ) : (
                    <div className="w-full h-48 bg-gradient-to-br from-orange-600 to-red-600 flex items-center justify-center">
                        <span className="text-8xl">🏁</span>
                    </div>
                )}

                {/* Status badge */}
                <div className="absolute top-4 left-4">
                    <span className={`inline-flex items-center gap-1 px-3 py-1 text-xs font-bold rounded-full ${statusConfig.color} text-white shadow-lg`}>
                        {statusConfig.icon} {statusConfig.label}
                    </span>
                </div>

                {/* Live indicator */}
                {eventStatus === 'live' && (
                    <div className="absolute top-4 right-4">
                        <span className="inline-flex items-center gap-1.5 bg-red-600 text-white text-xs px-3 py-1 rounded-full font-bold animate-pulse shadow-lg">
                            <span className="w-2 h-2 bg-white rounded-full animate-ping" />
                            EN VIVO
                        </span>
                    </div>
                )}

                {/* Countdown */}
                {countdown && eventStatus === 'upcoming' && (
                    <div className="absolute top-4 right-4">
                        <span className="bg-black/70 backdrop-blur-sm text-white text-xs px-3 py-1.5 rounded-full font-medium shadow-lg">
                            ⏳ {countdown}
                        </span>
                    </div>
                )}

                {/* Special event badge */}
                {isSpecial && eventStatus !== 'live' && (
                    <div className="absolute bottom-4 right-4">
                        <span className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white text-xs px-3 py-1 rounded-full font-bold animate-pulse shadow-lg">
                            ⭐ Evento Especial
                        </span>
                    </div>
                )}

                {/* Bottom gradient */}
                <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-slate-800/80 to-transparent" />
            </div>

            {/* Contenido */}
            <div className="p-6">
                {/* Título */}
                <h3 className="text-2xl font-bold text-white mb-2">{event.title}</h3>

                {/* Category & Format badges */}
                <div className="flex flex-wrap gap-2 mb-4">
                    {cat && (
                        <span className="inline-flex items-center gap-1 text-xs bg-white/10 text-gray-300 px-2.5 py-1 rounded-full font-medium">
                            {cat.icon} {cat.label}
                        </span>
                    )}
                    {event.format && event.format !== 'race' && (
                        <span className="text-xs bg-purple-500/20 text-purple-300 px-2.5 py-1 rounded-full font-medium">
                            {event.format === 'sprint+race' ? '🏎️ Sprint + Carrera' :
                                event.format === 'endurance' ? '⏱️ Resistencia' :
                                    event.format === 'time-attack' ? '⚡ Time Attack' :
                                        event.format === 'drift' ? '🌪️ Drift' : event.format}
                        </span>
                    )}
                    {event.registration?.enabled && (
                        <span className="text-xs bg-green-500/20 text-green-300 px-2.5 py-1 rounded-full font-medium">
                            📝 Inscripción abierta
                        </span>
                    )}
                </div>

                {/* Información básica */}
                <div className="space-y-2 mb-4">
                    {/* Fecha y hora */}
                    <div className="flex items-center gap-2 text-gray-300">
                        <span className="text-orange-400">📅</span>
                        <span className="text-sm">{formatDate(event.date)}</span>
                        {event.hour && (
                            <>
                                <span className="text-gray-500">•</span>
                                <span className="text-sm">🕐 {event.hour}</span>
                            </>
                        )}
                    </div>

                    {/* Circuito */}
                    {event.track && (
                        <div className="flex items-center gap-2 text-gray-300">
                            <span className="text-orange-400">🏁</span>
                            <span className="text-sm font-semibold">{event.track}</span>
                        </div>
                    )}

                    {/* Participantes */}
                    {maxP > 0 && (
                        <div className="flex items-center gap-2 text-gray-300">
                            <span className="text-orange-400">👥</span>
                            <span className="text-sm">
                                {participantCount} / {maxP} participantes
                            </span>
                            {isFull && <span className="text-xs bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded font-medium">LLENO</span>}
                        </div>
                    )}

                    {/* Streaming info */}
                    {event.streaming?.casterName && (
                        <div className="flex items-center gap-2 text-gray-300">
                            <span className="text-orange-400">🎙️</span>
                            <span className="text-sm">Caster: {event.streaming.casterName}</span>
                        </div>
                    )}
                    {event.streaming?.hostName && (
                        <div className="flex items-center gap-2 text-gray-300">
                            <span className="text-orange-400">🎮</span>
                            <span className="text-sm">Host: {event.streaming.hostName}</span>
                        </div>
                    )}
                </div>

                {/* Descripción */}
                {event.description && (
                    <p className="text-gray-300 text-sm mb-4 line-clamp-3">
                        {event.description}
                    </p>
                )}

                {/* Premios */}
                {event.prizes && (
                    <div className="mb-4 bg-yellow-600/10 border border-yellow-500/30 rounded-lg p-3">
                        <div className="text-yellow-300 font-semibold text-sm mb-1">🏆 Premios</div>
                        <p className="text-yellow-200/80 text-xs line-clamp-2">{event.prizes}</p>
                    </div>
                )}

                {/* Carros específicos */}
                {event.specificCars && event.allowedCars && event.allowedCars.length > 0 && (
                    <div className="mb-4 bg-blue-600/20 border border-blue-400/50 rounded-lg p-3">
                        <div className="text-blue-300 font-semibold text-sm mb-2">
                            🏎️ Coches Permitidos ({event.allowedCars.length})
                        </div>
                        <div className="flex flex-wrap gap-1">
                            {event.allowedCars.slice(0, 3).map((car, idx) => (
                                <span key={idx} className="text-blue-200 text-xs bg-blue-900/30 px-2 py-1 rounded">{car}</span>
                            ))}
                            {event.allowedCars.length > 3 && (
                                <span className="text-blue-200 text-xs bg-blue-900/30 px-2 py-1 rounded">+{event.allowedCars.length - 3} más</span>
                            )}
                        </div>
                    </div>
                )}

                {/* Reglas highlights */}
                {event.rules && (
                    <div className="mb-4 bg-white/5 border border-white/10 rounded-lg p-3">
                        <div className="text-gray-400 font-semibold text-xs mb-2">📋 REGLAS</div>
                        <div className="grid grid-cols-2 gap-2 text-xs text-gray-300">
                            {event.rules.laps && <div>⏱️ {event.rules.laps} vueltas</div>}
                            {event.rules.duration && <div>⏱️ {event.rules.duration}</div>}
                            {event.weather?.timeOfDay && <div>🌤️ {event.weather.timeOfDay}{event.weather.timeMultiplier > 1 ? ` x${event.weather.timeMultiplier}` : ''}</div>}
                            {typeof event.rules.tyreWear === 'number' && event.rules.tyreWear > 0 && <div>🔧 Desgaste: x{event.rules.tyreWear}</div>}
                            {typeof event.rules.fuelWear === 'number' && event.rules.fuelWear > 0 && <div>⛽ Combustible: x{event.rules.fuelWear}</div>}
                            {(event.rules.mandatoryTyres?.length > 0 || event.rules.mandatoryTyre) && <div>🛞 Neumáticos: {event.rules.mandatoryTyres?.join(', ') || event.rules.mandatoryTyre}</div>}
                        </div>
                    </div>
                )}

                {/* Results (completed events) */}
                {eventStatus === 'completed' && event.results?.length > 0 && (
                    <div className="mb-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
                        <div className="text-yellow-400 font-semibold text-xs mb-2">🏆 RESULTADOS</div>
                        <div className="space-y-1">
                            {event.results.slice(0, 3).map((r, i) => (
                                <div key={i} className="text-gray-300 text-sm flex items-center gap-2">
                                    <span>{i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}</span>
                                    <span className="font-semibold">{r.driverName || 'Sin nombre'}</span>
                                    {r.psnId && <span className="text-gray-500 text-xs">({r.psnId})</span>}
                                </div>
                            ))}
                            {event.results.length > 3 && (
                                <div className="text-gray-500 text-xs mt-1">+{event.results.length - 3} más</div>
                            )}
                        </div>
                    </div>
                )}

                {/* Botones de acción */}
                <div className={`grid gap-3 ${eventActive ? (hasStreaming && eventStatus === 'live' ? 'grid-cols-3' : 'grid-cols-2') : 'grid-cols-1'}`}>
                    <button
                        onClick={() => onViewDetails && onViewDetails(event)}
                        className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-2.5 rounded-lg font-semibold text-sm hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-md hover:shadow-lg"
                    >
                        📄 Ver Detalles
                    </button>
                    {eventActive && !isFull && (
                        <button
                            onClick={() => onRegister && onRegister(event)}
                            className="bg-gradient-to-r from-green-600 to-green-700 text-white px-4 py-2.5 rounded-lg font-semibold text-sm hover:from-green-700 hover:to-green-800 transition-all duration-200 shadow-md hover:shadow-lg"
                        >
                            ✍️ Inscribirse
                        </button>
                    )}
                    {hasStreaming && eventStatus === 'live' && (
                        <a
                            href={event.streaming.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-gradient-to-r from-red-600 to-red-700 text-white px-4 py-2.5 rounded-lg font-semibold text-sm hover:from-red-700 hover:to-red-800 transition-all duration-200 shadow-md hover:shadow-lg text-center flex items-center justify-center gap-1"
                        >
                            📺 Ver en Vivo
                        </a>
                    )}
                </div>
            </div>
        </div>
    );
}
