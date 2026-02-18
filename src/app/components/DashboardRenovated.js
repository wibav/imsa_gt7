"use client";
import { useEffect, useState } from "react";
import { FirebaseService } from "../services/firebaseService";
import { useChampionship } from "../context/ChampionshipContext";
import { useAuth } from '../context/AuthContext';
import Navbar from './Navbar';
import ChampionshipCard from './ChampionshipCard';
import EventCard from './EventCard';
import { isInCurrentWeek } from '../utils/dateUtils';
import { BannerAd } from './ads';

export default function DashboardRenovated() {
    const [events, setEvents] = useState([]);
    const [championshipTracks, setChampionshipTracks] = useState({});
    const [loading, setLoading] = useState(true);
    const { championships, loading: championshipsLoading } = useChampionship();
    const { currentUser, isAdmin } = useAuth();

    useEffect(() => {
        fetchData();
    }, []);

    // Cargar tracks de cada campeonato para calcular progreso
    useEffect(() => {
        if (championships && championships.length > 0) {
            loadChampionshipsTracks();
        }
    }, [championships]);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Cargar eventos únicos (colección global)
            const eventsResponse = await FirebaseService.getEvents().catch(() => []);
            setEvents(eventsResponse || []);
        } catch (error) {
            console.error("Error fetching data:", error);
        } finally {
            setLoading(false);
        }
    };

    // FIX: Usar Promise.all para cargar tracks en paralelo (antes era for...of secuencial = N+1 queries)
    const loadChampionshipsTracks = async () => {
        try {
            const entries = await Promise.all(
                championships.map(async (championship) => {
                    const tracks = await FirebaseService.getTracksByChampionship(championship.id);
                    return [championship.id, tracks || []];
                })
            );
            setChampionshipTracks(Object.fromEntries(entries));
        } catch (error) {
            console.error("Error loading championship tracks:", error);
        }
    };

    // Obtener eventos de la semana actual (usa isInCurrentWeek de utils)
    const getWeeklyEvents = () => {
        if (!events || events.length === 0) return [];
        return events
            .filter(ev => isInCurrentWeek(ev.date))
            .sort((a, b) => new Date(a.date) - new Date(b.date));
    };

    // Obtener todos los campeonatos para mostrar en el dashboard
    const getAllChampionships = () => {
        if (!championships || championships.length === 0) return [];
        return championships; // Mostrar TODOS los campeonatos
    };

    // Obtener eventos pasados (no de la semana actual)
    const getPastEvents = () => {
        if (!events || events.length === 0) return [];
        return events
            .filter(ev => !isInCurrentWeek(ev.date) && new Date(ev.date) < new Date())
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, 6); // Mostrar últimos 6 eventos pasados
    };

    const handleViewEventDetails = (event) => {
        // Navegar a página de detalle del evento (cuando exista)
        // Por ahora redirigir al dashboard de admin si es admin, o mostrar alerta
        if (isAdmin()) {
            window.location.href = `/eventsAdmin/${event.id}`;
        } else {
            alert(`Evento: ${event.title}\nFecha: ${event.date}\nCircuito: ${event.track || 'Por definir'}`);
        }
    };

    const handleRegisterToEvent = (event) => {
        // TODO: Implementar lógica de registro
        console.log("Registrarse al evento:", event);
    };

    if (loading || championshipsLoading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 flex items-center justify-center">
                <div className="text-center">
                    <div className="text-6xl mb-4 animate-bounce">🏁</div>
                    <div className="text-white text-xl font-bold">Cargando Dashboard...</div>
                </div>
            </div>
        );
    }

    const weeklyEvents = getWeeklyEvents();
    const activeChampionships = getAllChampionships();

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800">
            {/* Navbar */}
            <Navbar />

            {/* Banner Ad */}
            <div className="max-w-7xl mx-auto px-4 py-4">
                <BannerAd />
            </div>

            <div className="max-w-7xl mx-auto px-4 py-8">
                {/* Main Content - Full Width */}
                <div className="space-y-12">

                    {/* SECCIÓN 1: EVENTOS ÚNICOS DE LA SEMANA (solo si hay eventos) */}
                    {weeklyEvents.length > 0 && (
                        <>
                            <section>
                                <div className="flex items-center justify-between mb-6">
                                    <h2 className="text-3xl sm:text-4xl font-bold text-white flex items-center gap-3">
                                        <span className="text-4xl">🎉</span>
                                        Eventos Únicos de la Semana
                                    </h2>
                                </div>

                                <div className="grid md:grid-cols-2 gap-6">
                                    {weeklyEvents.map(event => (
                                        <EventCard
                                            key={event.id}
                                            event={event}
                                            onViewDetails={handleViewEventDetails}
                                            onRegister={handleRegisterToEvent}
                                        />
                                    ))}
                                </div>
                            </section>

                            {/* Separador */}
                            <div className="border-t border-white/20"></div>
                        </>
                    )}

                    {/* SECCIÓN 2: TODOS LOS CAMPEONATOS */}
                    <section>
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-3xl sm:text-4xl font-bold text-white flex items-center gap-3">
                                <span className="text-4xl">🏆</span>
                                Campeonatos
                            </h2>
                        </div>

                        {activeChampionships.length === 0 ? (
                            <div className="bg-white/5 border border-white/10 rounded-xl p-12 text-center">
                                <div className="text-6xl mb-4">🏁</div>
                                <p className="text-gray-300 text-lg">
                                    No hay campeonatos activos en este momento.
                                </p>
                                <p className="text-gray-400 text-sm mt-2">
                                    Los campeonatos en curso aparecerán aquí.
                                </p>
                                {isAdmin() && (
                                    <button
                                        onClick={() => window.location.href = '/championshipsAdmin'}
                                        className="mt-6 bg-gradient-to-r from-orange-600 to-red-600 text-white px-6 py-3 rounded-lg font-bold hover:from-orange-700 hover:to-red-700 transition-all duration-200"
                                    >
                                        + Crear Primer Campeonato
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div className="grid md:grid-cols-2 gap-6">
                                {activeChampionships.map(championship => (
                                    <ChampionshipCard
                                        key={championship.id}
                                        championship={championship}
                                        tracks={championshipTracks[championship.id] || []}
                                    />
                                ))}
                            </div>
                        )}
                    </section>

                    {/* SECCIÓN 3: EVENTOS ÚNICOS PASADOS (después de campeonatos) */}
                    {getPastEvents().length > 0 && (
                        <>
                            {/* Separador */}
                            <div className="border-t border-white/20"></div>

                            <section>
                                <div className="flex items-center justify-between mb-6">
                                    <h2 className="text-3xl sm:text-4xl font-bold text-white flex items-center gap-3">
                                        <span className="text-4xl">📚</span>
                                        Eventos Pasados
                                    </h2>
                                </div>

                                <div className="grid md:grid-cols-2 gap-6">
                                    {getPastEvents().map(event => (
                                        <EventCard
                                            key={event.id}
                                            event={event}
                                            onViewDetails={handleViewEventDetails}
                                            onRegister={handleRegisterToEvent}
                                        />
                                    ))}
                                </div>
                            </section>
                        </>
                    )}

                    {/* Info adicional */}
                    {(weeklyEvents.length > 0 || activeChampionships.length > 0) && (
                        <div className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-400/30 rounded-xl p-6">
                            <div className="flex items-start gap-4">
                                <div className="text-4xl">ℹ️</div>
                                <div>
                                    <h3 className="text-white font-bold text-lg mb-2">
                                        ¿Cómo funciona?
                                    </h3>
                                    <ul className="text-gray-300 text-sm space-y-1">
                                        <li>• <strong>Eventos Únicos:</strong> Carreras especiales independientes de los campeonatos</li>
                                        <li>• <strong>Campeonatos:</strong> Temporadas completas con múltiples carreras y clasificación</li>
                                        <li>• Haz clic en cualquier card para ver más detalles</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
