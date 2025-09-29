import React, { memo } from 'react';
import Image from 'next/image';

const EventsView = memo(({ sortedEvents }) => {
    return (
        <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-8 flex items-center gap-3">
                🎉 Todos los Eventos
            </h2>
            {sortedEvents.length === 0 ? (
                <div className="text-gray-300">No hay eventos disponibles.</div>
            ) : (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {sortedEvents.map((ev, idx) => {
                        const participants = ev.participants || [];
                        return (
                            <div key={ev.id ?? idx} className="bg-white/10 backdrop-blur-sm border border-white/30 rounded-lg overflow-hidden hover:bg-white/15 transition-all duration-300 shadow-lg hover:shadow-xl">
                                {/* Banner */}
                                <div className="relative h-40 bg-gradient-to-br from-gray-800 to-gray-900">
                                    {ev.banner ? (
                                        <Image src={ev.banner} alt={ev.title || `Evento ${ev.id}`} fill className="object-contain p-2" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-5xl">🏁</div>
                                    )}
                                    <div className="absolute top-2 left-2 bg-orange-600 text-white px-2 py-1 rounded-full text-sm font-bold">#{ev.id || idx + 1}</div>
                                </div>

                                <div className="p-6 space-y-4">
                                    <div>
                                        <h3 className="text-xl font-bold text-white">{ev.title || 'Evento sin título'}</h3>
                                        <div className="text-orange-200 text-sm mt-1 flex flex-wrap items-center gap-2">
                                            {ev.date && (
                                                <span>📅 {new Date(ev.date).toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                                            )}
                                            {ev.hour && <span>• 🕢 {ev.hour}h</span>}
                                            {ev.track && <span>• 🏁 {ev.track}</span>}
                                        </div>
                                    </div>

                                    {ev.description && (
                                        <p className="text-white/90 text-sm">{ev.description}</p>
                                    )}

                                    {/* Reglas */}
                                    <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                                        <div className="text-white font-semibold mb-2">Reglamento</div>
                                        <ul className="text-xs text-gray-200 space-y-1">
                                            {ev?.rules?.duration && <li>• Carrera: {ev.rules.duration}</li>}
                                            {ev?.rules?.bop && <li>• BOP: {ev.rules.bop}</li>}
                                            {ev?.rules?.adjustments && <li>• Ajustes: {ev.rules.adjustments}</li>}
                                            {ev?.rules?.damage && <li>• Daños: {ev.rules.damage}</li>}
                                            {ev?.rules?.engineSwap && <li>• Swap de motor: {ev.rules.engineSwap}</li>}
                                            {ev?.rules?.penalties && <li>• Penalizaciones: {ev.rules.penalties}</li>}
                                            {ev?.rules?.wear && <li>• Desgaste y consumo: {ev.rules.wear}</li>}
                                            {typeof ev?.rules?.tyreWear === 'number' && <li>• Desgaste de neumáticos: x{ev.rules.tyreWear}</li>}
                                            {typeof ev?.rules?.fuelWear === 'number' && <li>• Desgaste de combustible: x{ev.rules.fuelWear}</li>}
                                            {typeof ev?.rules?.fuelWear === 'number' && ev.rules.fuelWear > 0 && typeof ev?.rules?.fuelRefillRate === 'number' && (
                                                <li>• Velocidad de recarga de combustible: {ev.rules.fuelRefillRate} L/s</li>
                                            )}
                                            {ev?.rules?.mandatoryTyre && <li>• Neumático obligatorio: {ev.rules.mandatoryTyre}</li>}
                                        </ul>
                                    </div>

                                    {/* Participantes */}
                                    <div>
                                        <div className="text-green-300 font-semibold mb-2 text-sm">Participantes ({participants.length}/{ev.maxParticipants || 16})</div>
                                        {participants.length === 0 ? (
                                            <div className="text-gray-300 text-xs">Aún no hay inscritos.</div>
                                        ) : (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1">
                                                {participants.map((p, pIdx) => (
                                                    <div key={p.id || pIdx} className="bg-white/10 rounded px-3 py-2 text-white flex items-center gap-2">
                                                        <div className="w-6 h-6 rounded-full bg-orange-600/70 text-xs flex items-center justify-center">{pIdx + 1}</div>
                                                        <div className="flex-1">
                                                            <div className="font-semibold text-sm">{p.name}</div>
                                                            {p.team ? <div className="text-xs text-gray-300">{p.team}</div> : null}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
});

EventsView.displayName = 'EventsView';

export default EventsView;