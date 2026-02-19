"use client";
import Image from "next/image";

/**
 * EventCard - Card para eventos únicos
 * Muestra información del evento con banner, detalles y acciones
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

    // Verificar si es evento especial
    const isSpecial = event.isSpecialEvent;

    // Verificar si el evento está activo (fecha futura o hoy)
    const isEventActive = () => {
        if (!event.date) return false;
        const eventDate = new Date(event.date + 'T23:59:59');
        const now = new Date();
        return eventDate >= now;
    };

    const eventActive = isEventActive();

    return (
        <div className={`
            bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl overflow-hidden shadow-2xl 
            border ${isSpecial ? 'border-yellow-500/50' : 'border-orange-500/30'} 
            hover:border-orange-500/60 transition-all duration-300 hover:scale-[1.02]
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

                {/* Badge especial */}
                {isSpecial && (
                    <div className="absolute top-4 right-4">
                        <span className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white text-xs px-3 py-1 rounded-full font-bold animate-pulse">
                            ⭐ Evento Especial
                        </span>
                    </div>
                )}
            </div>

            {/* Contenido */}
            <div className="p-6">
                {/* Título */}
                <h3 className="text-2xl font-bold text-white mb-3">
                    {event.title}
                </h3>

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
                    {event.maxParticipants && (
                        <div className="flex items-center gap-2 text-gray-300">
                            <span className="text-orange-400">👥</span>
                            <span className="text-sm">
                                {event.participants?.length || 0} / {event.maxParticipants} participantes
                            </span>
                        </div>
                    )}
                </div>

                {/* Descripción */}
                {event.description && (
                    <p className="text-gray-300 text-sm mb-4 line-clamp-3">
                        {event.description}
                    </p>
                )}

                {/* Carros específicos */}
                {event.specificCars && event.allowedCars && event.allowedCars.length > 0 && (
                    <div className="mb-4 bg-blue-600/20 border border-blue-400/50 rounded-lg p-3">
                        <div className="text-blue-300 font-semibold text-sm mb-2">
                            🏎️ Carros Permitidos ({event.allowedCars.length})
                        </div>
                        <div className="flex flex-wrap gap-1">
                            {event.allowedCars.slice(0, 3).map((car, idx) => (
                                <span
                                    key={idx}
                                    className="text-blue-200 text-xs bg-blue-900/30 px-2 py-1 rounded"
                                >
                                    {car}
                                </span>
                            ))}
                            {event.allowedCars.length > 3 && (
                                <span className="text-blue-200 text-xs bg-blue-900/30 px-2 py-1 rounded">
                                    +{event.allowedCars.length - 3} más
                                </span>
                            )}
                        </div>
                    </div>
                )}

                {/* Reglas destacadas */}
                {event.rules && (
                    <div className="mb-4 bg-white/5 border border-white/10 rounded-lg p-3">
                        <div className="text-gray-400 font-semibold text-xs mb-2">
                            📋 REGLAS
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs text-gray-300">
                            {event.rules.laps && (
                                <div>⏱️ {event.rules.laps} vueltas</div>
                            )}
                            {event.rules.weather && (
                                <div>🌤️ {event.rules.weather}</div>
                            )}
                            {typeof event.rules.tyreWear === 'number' && (
                                <div>🔧 Desgaste: x{event.rules.tyreWear}</div>
                            )}
                            {typeof event.rules.fuelWear === 'number' && (
                                <div>⛽ Combustible: x{event.rules.fuelWear}</div>
                            )}
                        </div>
                    </div>
                )}

                {/* Botones de acción */}
                <div className={`grid ${eventActive ? 'grid-cols-2' : 'grid-cols-1'} gap-3`}>
                    <button
                        onClick={() => onViewDetails && onViewDetails(event)}
                        className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-2 rounded-lg font-semibold text-sm hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-md hover:shadow-lg"
                    >
                        📄 Ver Detalles
                    </button>
                    {eventActive && (
                        <button
                            onClick={() => onRegister && onRegister(event)}
                            className="bg-gradient-to-r from-green-600 to-green-700 text-white px-4 py-2 rounded-lg font-semibold text-sm hover:from-green-700 hover:to-green-800 transition-all duration-200 shadow-md hover:shadow-lg"
                        >
                            ✍️ Inscribirse
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
