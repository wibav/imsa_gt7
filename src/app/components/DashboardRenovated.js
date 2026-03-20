"use client";
import { useEffect, useState } from "react";
import { FirebaseService } from "../services/firebaseService";
import { useChampionship } from "../context/ChampionshipContext";
import { useAuth } from '../context/AuthContext';
import Navbar from './Navbar';
import ChampionshipCard from './ChampionshipCard';
import EventCard from './EventCard';
import RegistrationModal from './RegistrationModal';
import { isInCurrentWeek } from '../utils/dateUtils';
import { BannerAd } from './ads';
import LoadingSkeleton from './common/LoadingSkeleton';

export default function DashboardRenovated() {
    const [events, setEvents] = useState([]);
    const [championshipTracks, setChampionshipTracks] = useState({});
    const [loading, setLoading] = useState(true);
    const [selectedEvent, setSelectedEvent] = useState(null);
    const [isRegistrationModalOpen, setIsRegistrationModalOpen] = useState(false);
    const [isRegistering, setIsRegistering] = useState(false);
    const [registrationMessage, setRegistrationMessage] = useState("");
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
    // Se filtran los que ya pasaron o están finalizados ("completed")
    const getWeeklyEvents = () => {
        if (!events || events.length === 0) return [];
        return events
            .filter(ev => {
                const eventDate = new Date(ev.date + 'T23:59:59'); // final del día
                const now = new Date();
                return isInCurrentWeek(ev.date) && ev.status !== 'completed' && eventDate >= now;
            })
            .sort((a, b) => new Date(a.date) - new Date(b.date));
    };

    // Obtener campeonatos visibles (excluir borradores)
    const getAllChampionships = () => {
        if (!championships || championships.length === 0) return [];
        return championships.filter(c => c.status !== 'draft');
    };

    // Obtener eventos pasados
    const getPastEvents = () => {
        if (!events || events.length === 0) return [];
        return events
            .filter(ev => {
                const isCompleted = ev.status === 'completed';
                const eventDate = new Date(ev.date + 'T23:59:59');
                const isPast = eventDate < new Date();
                return isCompleted || isPast;
            })
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, 6); // Mostrar últimos 6 eventos pasados
    };

    const handleViewEventDetails = (event) => {
        window.location.href = `/events?id=${event.id}`;
    };

    const handleRegisterToEvent = (event) => {
        setSelectedEvent(event);
        setIsRegistrationModalOpen(true);
    };

    const handleRegistration = async (participantData) => {
        if (!selectedEvent) return;
        setIsRegistering(true);
        try {
            const result = await FirebaseService.addEventParticipant(selectedEvent.id, participantData);

            if (result.waitlisted) {
                setRegistrationMessage(`⏳ Cupo lleno. Quedaste en lista de reservas en la posición #${result.position}. Te avisaremos si se libera un lugar.`);
            } else {
                setRegistrationMessage("✅ ¡Inscripción exitosa! Bienvenido al evento.");
            }

            // Recargar eventos para actualizar la lista de participantes
            await fetchData();
        } catch (error) {
            const errorMessage = error.message || "Error al inscribirse. Intenta de nuevo.";
            setRegistrationMessage(`❌ ${errorMessage}`);
        } finally {
            setIsRegistering(false);
        }
    };

    const handleModalClose = () => {
        setIsRegistrationModalOpen(false);
        setSelectedEvent(null);
        setRegistrationMessage("");
        window.scrollTo(0, 0); // Scroll to top of page
    };

    if (loading || championshipsLoading) {
        return <LoadingSkeleton variant="page" message="Cargando Dashboard..." />;
    }

    const weeklyEvents = getWeeklyEvents();
    const activeChampionships = getAllChampionships();

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800">
            {/* Navbar */}
            <Navbar />

            {/* Community Banner */}
            <div className="border-b border-white/10">
                <div className="max-w-7xl mx-auto px-4 py-3 grid grid-cols-2 divide-x divide-white/10">
                    {/* WhatsApp */}
                    <div className="flex items-center justify-between gap-3 pr-4">
                        <p className="text-green-300 text-xs sm:text-sm font-medium hidden sm:block">
                            ¡Únete a la comunidad! Recibe avisos de eventos y novedades.
                        </p>
                        <a
                            href="https://chat.whatsapp.com/LSKsgLvzwCg06me2uXMizo?mode=gi_t"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full sm:w-auto flex items-center justify-center gap-1.5 bg-green-500 hover:bg-green-400 text-white text-xs sm:text-sm font-bold px-3 sm:px-4 py-2 rounded-full transition-colors whitespace-nowrap"
                        >
                            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current flex-shrink-0" aria-hidden="true">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                            </svg>
                            <span className="sm:inline">Unirse a WhatsApp</span>
                        </a>
                    </div>

                    {/* Buy Me a Coffee */}
                    <div className="flex items-center justify-between gap-3 pl-4">
                        <p className="text-yellow-300 text-xs sm:text-sm font-medium hidden sm:block">
                            Organizamos eventos y campeonatos cada semana. ¡Un cafecito nos ayuda a seguir!
                        </p>
                        <a
                            href="https://buymeacoffee.com/wolcutorb"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full sm:w-auto flex items-center justify-center gap-1.5 bg-yellow-400 hover:bg-yellow-300 text-gray-900 text-xs sm:text-sm font-bold px-3 sm:px-4 py-2 rounded-full transition-colors whitespace-nowrap"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 flex-shrink-0" aria-hidden="true">
                                <path d="M20.216 6.415l-.132-.666c-.119-.598-.388-1.163-.766-1.615a3.19 3.19 0 0 0-1.548-1.066c-.611-.195-1.28-.242-1.94-.12a4.19 4.19 0 0 0-1.675.637l-.343.236-.343-.236a4.19 4.19 0 0 0-1.675-.637c-.66-.122-1.329-.075-1.94.12a3.19 3.19 0 0 0-1.548 1.066c-.378.452-.647 1.017-.766 1.615l-.132.666c-.15.754-.09 1.535.17 2.256.26.721.706 1.365 1.288 1.856l4.468 3.764c.165.14.407.14.572 0l4.468-3.764a4.24 4.24 0 0 0 1.288-1.856c.26-.721.32-1.502.17-2.256zM7.288 18.675h9.424v1.5H7.288v-1.5z" />
                            </svg>
                            <span className="sm:inline">Invitar un café</span>
                        </a>
                    </div>
                </div>
            </div>

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

            {/* Registration notification */}
            {registrationMessage && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 max-w-md w-full px-4">
                    <div className={`p-4 rounded-lg text-center font-semibold shadow-2xl ${registrationMessage.startsWith("✅")
                        ? "bg-green-600/90 border border-green-400/50 text-white"
                        : "bg-red-600/90 border border-red-400/50 text-white"
                        }`}>
                        {registrationMessage}
                    </div>
                </div>
            )}

            {/* Registration Modal */}
            <RegistrationModal
                event={selectedEvent}
                isOpen={isRegistrationModalOpen}
                onClose={handleModalClose}
                onSubmit={handleRegistration}
                isLoading={isRegistering}
                registrationMessage={registrationMessage}
            />
        </div>
    );
}
