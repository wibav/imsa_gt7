"use client";
import { useEffect, useState, useMemo, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Image from "next/image";
import { FirebaseService } from "../services/firebaseService";
import Navbar from "../components/Navbar";
import RegistrationModal from "../components/RegistrationModal";
import DynamicOGTags from "../components/DynamicOGTags";
import ExportableEventResults from "../components/ExportableEventResults";
import {
    EVENT_STATUSES,
    EVENT_CATEGORIES,
    EVENT_FORMATS,
    STREAMING_PLATFORMS,
    TYRE_OPTIONS,
    DAMAGE_OPTIONS,
    WEATHER_TIME_OPTIONS,
    EVENT_TYPES,
} from "../utils";

function EventDetailContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const eventId = searchParams.get("id");

    const [event, setEvent] = useState(null);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);
    const [isRegistrationModalOpen, setIsRegistrationModalOpen] = useState(false);
    const [isRegistering, setIsRegistering] = useState(false);
    const [registrationMessage, setRegistrationMessage] = useState("");
    const [activeRound, setActiveRound] = useState(0);

    useEffect(() => {
        if (eventId) {
            loadEvent();
        } else {
            setLoading(false);
            setNotFound(true);
        }
    }, [eventId]);

    const loadEvent = async () => {
        setLoading(true);
        try {
            const data = await FirebaseService.getEvent(eventId);
            if (data) {
                setEvent(data);
            } else {
                setNotFound(true);
            }
        } catch (error) {
            console.error("Error loading event:", error);
            setNotFound(true);
        } finally {
            setLoading(false);
        }
    };

    const handleRegistration = async (participantData) => {
        setIsRegistering(true);
        try {
            await FirebaseService.addEventParticipant(eventId, participantData);
            setRegistrationMessage("✅ ¡Inscripción exitosa! Bienvenido al evento.");

            // Recargar el evento para mostrar el nuevo participante
            await loadEvent();

            // Cerrar modal después de 2 segundos
            setTimeout(() => {
                setIsRegistrationModalOpen(false);
                setRegistrationMessage("");
            }, 2000);
        } catch (error) {
            const errorMessage = error.message || "Error al inscribirse. Intenta de nuevo.";
            setRegistrationMessage(`❌ ${errorMessage}`);
            console.error("Error during registration:", error);

            // Limpiar mensaje después de 5 segundos
            setTimeout(() => {
                setRegistrationMessage("");
            }, 5000);
        } finally {
            setIsRegistering(false);
        }
    };

    // Compute status
    const eventStatus = useMemo(() => {
        if (!event) return "upcoming";
        if (event.status === "live") return "live";
        if (event.status === "completed") return "completed";
        if (!event.date) return "upcoming";
        const eventDate = new Date(event.date + "T23:59:59");
        return eventDate < new Date() ? "completed" : "upcoming";
    }, [event]);

    // Countdown
    const countdown = useMemo(() => {
        if (!event?.date || eventStatus !== "upcoming") return null;
        const target = new Date(`${event.date}T${event.hour || "00:00"}:00`);
        const diff = target - new Date();
        if (diff <= 0) return null;
        const days = Math.floor(diff / 86400000);
        const hours = Math.floor((diff % 86400000) / 3600000);
        const mins = Math.floor((diff % 3600000) / 60000);
        if (days > 0) return `${days} días, ${hours} horas`;
        if (hours > 0) return `${hours} horas, ${mins} minutos`;
        return `${mins} minutos`;
    }, [event, eventStatus]);

    const formatDate = (dateStr) => {
        if (!dateStr) return "";
        const date = new Date(dateStr + "T00:00:00");
        return date.toLocaleDateString("es-ES", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
        });
    };

    // --- Loading ---
    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 flex items-center justify-center">
                <div className="text-center">
                    <div className="text-6xl mb-4 animate-bounce">🏁</div>
                    <div className="text-white text-xl font-bold">Cargando Evento...</div>
                </div>
            </div>
        );
    }

    // --- Not Found ---
    if (notFound || !event) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800">
                <Navbar />
                <div className="max-w-4xl mx-auto px-4 py-20 text-center">
                    <div className="text-8xl mb-6">🔍</div>
                    <h1 className="text-3xl font-bold text-white mb-4">Evento no encontrado</h1>
                    <p className="text-gray-400 mb-8">
                        El evento que buscas no existe o fue eliminado.
                    </p>
                    <button
                        onClick={() => router.push("/")}
                        className="bg-gradient-to-r from-orange-600 to-red-600 text-white px-6 py-3 rounded-lg font-bold hover:from-orange-700 hover:to-red-700 transition-all"
                    >
                        ← Volver al Dashboard
                    </button>
                </div>
            </div>
        );
    }

    // --- Derived data ---
    const statusConfig = EVENT_STATUSES[eventStatus] || EVENT_STATUSES.upcoming;
    const cat = EVENT_CATEGORIES.find((c) => c.value === event.category);
    const fmt = EVENT_FORMATS?.find((f) => f.value === event.format);
    const evType = EVENT_TYPES?.find((t) => t.value === event.eventType);
    const isMultiRound = event.eventType && event.eventType !== 'standard' && event.rounds?.length > 0;
    const hasStreaming = event.streaming?.url;
    const participantCount = event.participants?.length || 0;
    const maxP = event.maxParticipants || 0;
    const isFull = maxP > 0 && participantCount >= maxP;
    const hasRules = event.rules && Object.keys(event.rules).length > 0;
    const hasWeather = event.weather && (event.weather.timeOfDay || event.weather.weatherSlots);
    const hasResults = event.results?.length > 0;

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800">
            <Navbar />
            <DynamicOGTags
                title={event.title}
                description={event.description || `${event.track ? event.track + ' — ' : ''}${formatDate(event.date)}`}
                image={event.banner || 'https://imsa.trenkit.com/logo_gt7.png'}
                url={`https://imsa.trenkit.com/events?id=${eventId}`}
            />

            {/* Hero Banner */}
            <div className="relative">
                {event.banner ? (
                    <div className="relative w-full h-64 sm:h-80 md:h-96 bg-black/50">
                        <Image
                            src={event.banner}
                            alt={event.title}
                            fill
                            className="object-cover"
                            sizes="100vw"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent" />
                    </div>
                ) : (
                    <div className="w-full h-64 sm:h-80 bg-gradient-to-br from-orange-600 to-red-700 flex items-center justify-center">
                        <span className="text-[120px]">🏁</span>
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent" />
                    </div>
                )}

                {/* Status & Countdown overlay */}
                <div className="absolute top-3 left-3 sm:top-6 sm:left-6 flex flex-wrap gap-2 sm:gap-3">
                    <span className={`inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-4 py-1 sm:py-2 text-xs sm:text-sm font-bold rounded-full ${statusConfig.color} text-white shadow-lg`}>
                        {statusConfig.icon} {statusConfig.label}
                    </span>
                    {cat && (
                        <span className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-4 py-1 sm:py-2 text-xs sm:text-sm font-semibold rounded-full bg-white/20 backdrop-blur-sm text-white shadow-lg">
                            {cat.icon} {cat.label}
                        </span>
                    )}
                    {evType && event.eventType !== 'standard' && (
                        <span className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-4 py-1 sm:py-2 text-xs sm:text-sm font-semibold rounded-full bg-orange-500/30 backdrop-blur-sm text-orange-200 shadow-lg">
                            {evType.icon} {evType.label}
                        </span>
                    )}
                </div>

                {eventStatus === "live" && (
                    <div className="absolute top-3 right-3 sm:top-6 sm:right-6">
                        <span className="inline-flex items-center gap-2 bg-red-600 text-white text-sm px-4 py-2 rounded-full font-bold animate-pulse shadow-lg">
                            <span className="w-3 h-3 bg-white rounded-full animate-ping" />
                            EN VIVO
                        </span>
                    </div>
                )}

                {/* Title overlay — only title, no description on mobile */}
                <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6 md:p-8">
                    <div className="max-w-5xl mx-auto">
                        <h1 className="text-2xl sm:text-3xl md:text-5xl font-extrabold text-white drop-shadow-lg line-clamp-2">
                            {event.title}
                        </h1>
                        {event.description && (
                            <p className="hidden md:block text-gray-200 text-base max-w-3xl drop-shadow mt-2 line-clamp-3">{event.description}</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">

                {/* Description — visible on mobile/tablet below banner */}
                {event.description && (
                    <div className="md:hidden bg-white/5 border border-white/10 rounded-xl p-5">
                        <p className="text-gray-300 text-sm leading-relaxed">{event.description}</p>
                    </div>
                )}

                {/* Countdown banner */}
                {countdown && eventStatus === "upcoming" && (
                    <div className="bg-gradient-to-r from-blue-600/30 to-purple-600/30 border border-blue-400/40 rounded-xl p-5 text-center">
                        <div className="text-gray-400 text-sm font-semibold uppercase tracking-wider mb-1">Comienza en</div>
                        <div className="text-white text-2xl sm:text-3xl font-bold">⏳ {countdown}</div>
                    </div>
                )}

                {/* Live streaming CTA */}
                {eventStatus === "live" && hasStreaming && (
                    <a
                        href={event.streaming.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block bg-gradient-to-r from-red-600 to-red-700 rounded-xl p-5 text-center hover:from-red-700 hover:to-red-800 transition-all shadow-lg"
                    >
                        <div className="text-white text-xl font-bold flex items-center justify-center gap-3">
                            📺 Ver Transmisión en Vivo
                        </div>
                        {event.streaming.platform && (
                            <div className="text-red-200 text-sm mt-1">
                                En {STREAMING_PLATFORMS?.find(p => p.value === event.streaming.platform)?.label || event.streaming.platform}
                            </div>
                        )}
                    </a>
                )}

                {/* Info Grid */}
                <div className="grid md:grid-cols-2 gap-6">

                    {/* Left Column - Event Info */}
                    <div className="space-y-6">

                        {/* Date, Track & Details */}
                        <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                📋 Información del Evento
                            </h2>
                            <div className="space-y-4">
                                <InfoRow icon="📅" label="Fecha" value={formatDate(event.date)} />
                                {event.hour && <InfoRow icon="🕐" label="Hora" value={event.hour} />}
                                {event.track && <InfoRow icon="🏁" label="Circuito" value={event.track} />}
                                {fmt && <InfoRow icon="🎮" label="Formato" value={`${fmt.icon} ${fmt.label}`} />}
                                {maxP > 0 && (
                                    <InfoRow
                                        icon="👥"
                                        label="Participantes"
                                        value={`${participantCount} / ${maxP}${isFull ? " (LLENO)" : ""}`}
                                    />
                                )}
                                {event.registration?.enabled && (
                                    <InfoRow
                                        icon="📝"
                                        label="Inscripción"
                                        value={
                                            eventStatus === "completed" || eventStatus === "live" || isFull
                                                ? isFull ? "Cerrada (cupo lleno)" : "Cerrada"
                                                : event.registration.deadline && new Date(event.registration.deadline) < new Date()
                                                    ? "Cerrada (plazo vencido)"
                                                    : event.registration.requiresApproval
                                                        ? "Abierta (con aprobación)"
                                                        : "Abierta (automática)"
                                        }
                                    />
                                )}
                                {event.registration?.deadline && (
                                    <InfoRow icon="⏰" label="Cierre inscripción" value={formatDate(event.registration.deadline)} />
                                )}
                            </div>
                        </div>

                        {/* Streaming & Caster */}
                        {(event.streaming?.casterName || event.streaming?.hostName || event.streaming?.url) && (
                            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                                <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                    📺 Transmisión
                                </h2>
                                <div className="space-y-4">
                                    {event.streaming.casterName && (
                                        <InfoRow icon="🎙️" label="Caster" value={event.streaming.casterName} />
                                    )}
                                    {event.streaming.hostName && (
                                        <InfoRow icon="🎮" label="Host" value={event.streaming.hostName} />
                                    )}
                                    {event.streaming.platform && (
                                        <InfoRow
                                            icon="📡"
                                            label="Plataforma"
                                            value={STREAMING_PLATFORMS?.find(p => p.value === event.streaming.platform)?.label || event.streaming.platform}
                                        />
                                    )}
                                    {event.streaming.url && (
                                        <div className="pt-2">
                                            <a
                                                href={event.streaming.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-2 bg-red-600/20 border border-red-500/30 text-red-300 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-red-600/30 transition-colors"
                                            >
                                                📺 Ir al Canal
                                            </a>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Prizes */}
                        {event.prizes && (
                            <div className="bg-gradient-to-br from-yellow-600/10 to-orange-600/10 border border-yellow-500/30 rounded-xl p-6">
                                <h2 className="text-lg font-bold text-yellow-300 mb-3 flex items-center gap-2">
                                    🏆 Premios
                                </h2>
                                <p className="text-yellow-200/80 text-sm whitespace-pre-line">{event.prizes}</p>
                            </div>
                        )}
                    </div>

                    {/* Right Column - Rules, Weather, Cars */}
                    <div className="space-y-6">

                        {/* Race Rules */}
                        {hasRules && (
                            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                                <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                    ⚙️ Reglas de Carrera
                                </h2>
                                <div className="grid grid-cols-2 gap-3">
                                    {event.rules.laps && <RulePill label="Vueltas" value={event.rules.laps} />}
                                    {event.rules.duration && <RulePill label="Duración" value={event.rules.duration} />}
                                    {event.rules.bop !== undefined && (
                                        <RulePill label="BOP" value={event.rules.bop ? "Sí" : "No"} />
                                    )}
                                    {event.rules.damage && (
                                        <RulePill
                                            label="Daños"
                                            value={DAMAGE_OPTIONS?.find(d => d.value === event.rules.damage)?.label || event.rules.damage}
                                        />
                                    )}
                                    {typeof event.rules.tyreWear === "number" && (
                                        <RulePill label="Desg. Neumáticos" value={event.rules.tyreWear > 0 ? `x${event.rules.tyreWear}` : "Sin"} />
                                    )}
                                    {typeof event.rules.fuelWear === "number" && (
                                        <RulePill label="Desg. Combustible" value={event.rules.fuelWear > 0 ? `x${event.rules.fuelWear}` : "Sin"} />
                                    )}
                                    {event.rules.penalties !== undefined && (
                                        <RulePill label="Penalizaciones" value={event.rules.penalties ? "Sí" : "No"} />
                                    )}
                                    {event.rules.ghostCar !== undefined && (
                                        <RulePill label="Coche Fantasma" value={event.rules.ghostCar ? "Sí" : "No"} />
                                    )}
                                    {(event.rules.mandatoryTyres?.length > 0 || event.rules.mandatoryTyre) && (
                                        <RulePill label="Neumáticos Oblig." value={event.rules.mandatoryTyres?.join(', ') || event.rules.mandatoryTyre} />
                                    )}
                                    {event.rules.startType && (
                                        <RulePill label="Salida" value={event.rules.startType === 'rolling' ? 'Lanzada' : 'Parrilla'} />
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Weather */}
                        {hasWeather && (
                            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                                <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                    🌤️ Climatología
                                </h2>
                                <div className="space-y-3">
                                    {event.weather.timeOfDay && (
                                        <InfoRow icon="☀️" label="Hora del día" value={event.weather.timeOfDay} />
                                    )}
                                    {event.weather.timeMultiplier && (
                                        <InfoRow icon="⏩" label="Multiplicador" value={`x${event.weather.timeMultiplier}`} />
                                    )}
                                    {event.weather.weatherSlots && (
                                        <InfoRow icon="🌦️" label="Slots Climáticos" value={event.weather.weatherSlots} />
                                    )}
                                    {event.weather.rainProbability && (
                                        <InfoRow icon="🌧️" label="Prob. Lluvia" value={event.weather.rainProbability} />
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Allowed Cars */}
                        {event.specificCars && event.allowedCars?.length > 0 && (
                            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                                <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                    🏎️ Coches Permitidos ({event.allowedCars.length})
                                </h2>
                                <div className="flex flex-wrap gap-2">
                                    {event.allowedCars.map((car, idx) => (
                                        <span
                                            key={idx}
                                            className="text-sm bg-blue-500/20 text-blue-300 px-3 py-1.5 rounded-lg font-medium"
                                        >
                                            {car}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Mandatory Tyres */}
                        {event.mandatoryTyres?.length > 0 && (
                            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                                <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                    🛞 Compuestos Obligatorios
                                </h2>
                                <div className="flex flex-wrap gap-2">
                                    {event.mandatoryTyres.map((tyre, idx) => {
                                        const tyreInfo = TYRE_OPTIONS?.find(t => t.value === tyre);
                                        return (
                                            <span
                                                key={idx}
                                                className="text-sm bg-orange-500/20 text-orange-300 px-3 py-1.5 rounded-lg font-medium"
                                            >
                                                {tyreInfo?.label || tyre}
                                            </span>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Participants Table */}
                {event.participants?.length > 0 && (
                    <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                            👥 Participantes ({event.participants.length}{maxP > 0 ? ` / ${maxP}` : ""})
                        </h2>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-white/10 text-gray-400">
                                        <th className="text-left py-2 px-3">#</th>
                                        <th className="text-left py-2 px-3">GT7 ID</th>
                                        <th className="text-left py-2 px-3">PSN ID</th>
                                        {event.participants.some(p => p.country) && (
                                            <th className="text-left py-2 px-3">País</th>
                                        )}
                                    </tr>
                                </thead>
                                <tbody>
                                    {event.participants.map((p, idx) => (
                                        <tr key={idx} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                            <td className="py-2.5 px-3 text-gray-500 font-mono">{idx + 1}</td>
                                            <td className="py-2.5 px-3 text-white font-semibold">{p.gt7Id || p.name || "-"}</td>
                                            <td className="py-2.5 px-3 text-gray-300">{p.psnId || "-"}</td>
                                            {event.participants.some(p => p.country) && (
                                                <td className="py-2.5 px-3 text-gray-300">{p.country || "-"}</td>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Results (standard events) */}
                {hasResults && eventStatus === "completed" && !isMultiRound && (
                    <div className="bg-gradient-to-br from-yellow-600/10 to-orange-600/10 border border-yellow-500/30 rounded-xl p-6">
                        <h2 className="text-lg font-bold text-yellow-300 mb-4 flex items-center gap-2">
                            🏆 Resultados
                        </h2>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-yellow-500/20 text-gray-400">
                                        <th className="text-left py-2 px-3">Pos</th>
                                        <th className="text-left py-2 px-3">Piloto</th>
                                        {event.results.some(r => r.psnId) && <th className="text-left py-2 px-3">PSN ID</th>}
                                        {event.results.some(r => r.points) && <th className="text-center py-2 px-3">Puntos</th>}
                                        <th className="text-center py-2 px-3">Extras</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {event.results.map((r, idx) => (
                                        <tr
                                            key={idx}
                                            className={`border-b border-white/5 transition-colors ${idx === 0 ? "bg-yellow-500/10" : idx === 1 ? "bg-gray-400/10" : idx === 2 ? "bg-orange-500/10" : "hover:bg-white/5"
                                                }`}
                                        >
                                            <td className="py-3 px-3 font-bold text-white">
                                                {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `${idx + 1}°`}
                                            </td>
                                            <td className="py-3 px-3 text-white font-semibold">{r.driverName || "-"}</td>
                                            {event.results.some(r => r.psnId) && (
                                                <td className="py-3 px-3 text-gray-400">{r.psnId || "-"}</td>
                                            )}
                                            {event.results.some(r => r.points) && (
                                                <td className="py-3 px-3 text-center text-orange-300 font-bold">{r.points || "-"}</td>
                                            )}
                                            <td className="py-3 px-3 text-center">
                                                <div className="flex items-center justify-center gap-2">
                                                    {r.fastestLap && <span title="Vuelta Rápida" className="text-purple-400">⚡</span>}
                                                    {r.polePosition && <span title="Pole Position" className="text-yellow-400">🅿️</span>}
                                                    {r.dnf && <span title="DNF" className="text-red-400 text-xs font-bold">DNF</span>}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Multi-Round Results */}
                {isMultiRound && (
                    <div className="space-y-6">
                        <div className="bg-gradient-to-br from-orange-600/10 to-red-600/10 border border-orange-500/30 rounded-xl p-6">
                            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                🏟️ Rondas del Evento
                                {evType && <span className="text-sm font-normal text-orange-300">({evType.label})</span>}
                            </h2>

                            {/* Round tabs */}
                            <div className="flex gap-2 mb-6">
                                {event.rounds.map((round, rIdx) => (
                                    <button
                                        key={rIdx}
                                        onClick={() => setActiveRound(rIdx)}
                                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeRound === rIdx
                                            ? 'bg-orange-500 text-white shadow-lg'
                                            : 'bg-white/10 text-gray-300 hover:bg-white/20'
                                            }`}
                                    >
                                        <span className="mr-1.5">{rIdx === 0 ? '1️⃣' : '2️⃣'}</span>
                                        {round.name}
                                    </button>
                                ))}
                            </div>

                            {/* Active round rooms */}
                            {event.rounds[activeRound] && (
                                <div className={`grid gap-6 ${event.rounds[activeRound].rooms?.length > 1 ? 'md:grid-cols-2' : ''}`}>
                                    {event.rounds[activeRound].rooms?.map((room, rmIdx) => (
                                        <div key={rmIdx} className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
                                            {/* Room header */}
                                            <div className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 px-4 py-3 border-b border-white/10">
                                                <h3 className="text-white font-bold flex items-center gap-2">
                                                    🏟️ {room.name}
                                                    {room.caster && <span className="text-xs bg-white/10 text-gray-300 px-2 py-0.5 rounded-full">🎙️ {room.caster}</span>}
                                                    {room.host && <span className="text-xs bg-white/10 text-gray-300 px-2 py-0.5 rounded-full">🎮 {room.host}</span>}
                                                </h3>
                                                {room.streamUrl && (
                                                    <a href={room.streamUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-red-400 hover:text-red-300 mt-1 inline-flex items-center gap-1">
                                                        📺 Ver Stream
                                                    </a>
                                                )}
                                            </div>

                                            {/* Room results */}
                                            {room.results?.length > 0 ? (
                                                <div className="p-4">
                                                    <table className="w-full text-sm">
                                                        <thead>
                                                            <tr className="border-b border-white/10 text-gray-400">
                                                                <th className="text-left py-2 px-2 w-10">Pos</th>
                                                                <th className="text-left py-2 px-2">Piloto</th>
                                                                {room.results.some(r => r.psnId) && <th className="text-left py-2 px-2">PSN</th>}
                                                                <th className="text-center py-2 px-2 w-20">Extras</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {room.results.map((r, idx) => (
                                                                <tr
                                                                    key={idx}
                                                                    className={`border-b border-white/5 transition-colors ${idx === 0 ? "bg-yellow-500/10" : idx === 1 ? "bg-gray-400/10" : idx === 2 ? "bg-orange-500/10" : "hover:bg-white/5"}`}
                                                                >
                                                                    <td className="py-2.5 px-2 font-bold text-white">
                                                                        {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `${idx + 1}°`}
                                                                    </td>
                                                                    <td className="py-2.5 px-2 text-white font-semibold">{r.driverName || "-"}</td>
                                                                    {room.results.some(r => r.psnId) && (
                                                                        <td className="py-2.5 px-2 text-gray-400 text-xs">{r.psnId || "-"}</td>
                                                                    )}
                                                                    <td className="py-2.5 px-2 text-center">
                                                                        <div className="flex items-center justify-center gap-1.5">
                                                                            {r.fastestLap && <span title="Vuelta Rápida" className="text-purple-400">⚡</span>}
                                                                            {r.polePosition && <span title="Pole Position" className="text-yellow-400">🅿️</span>}
                                                                            {r.dnf && <span title="DNF" className="text-red-400 text-xs font-bold">DNF</span>}
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            ) : room.participants?.length > 0 ? (
                                                <div className="p-4">
                                                    <p className="text-gray-500 text-xs mb-2 uppercase font-semibold">Participantes ({room.participants.length})</p>
                                                    <div className="flex flex-wrap gap-2">
                                                        {room.participants.map((p, pIdx) => (
                                                            <span key={pIdx} className="text-xs bg-white/5 text-gray-300 px-2.5 py-1 rounded-full">
                                                                {p.gt7Id || p.name || `Piloto ${pIdx + 1}`}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="p-4 text-center text-gray-500 text-sm">
                                                    Sin datos aún
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Gallery (post-event images) */}
                {event.gallery?.length > 0 && (
                    <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                            📸 Galería
                        </h2>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            {event.gallery.map((img, idx) => (
                                <div key={idx} className="relative aspect-video rounded-lg overflow-hidden bg-black/30">
                                    <Image
                                        src={img}
                                        alt={`Captura ${idx + 1}`}
                                        fill
                                        className="object-cover hover:scale-105 transition-transform duration-300"
                                        sizes="(max-width: 768px) 50vw, 33vw"
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Action buttons */}
                <div className="flex flex-wrap gap-4 justify-center pt-4">
                    <button
                        onClick={() => router.push("/")}
                        className="bg-white/10 border border-white/20 text-white px-6 py-3 rounded-lg font-semibold hover:bg-white/20 transition-all"
                    >
                        ← Volver al Dashboard
                    </button>
                    <button
                        onClick={loadEvent}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-all"
                    >
                        🔃 Refrescar Evento
                    </button>
                    {eventStatus === "upcoming" && event.registration?.enabled && !isFull && (
                        <button
                            onClick={() => setIsRegistrationModalOpen(true)}
                            className="bg-gradient-to-r from-green-600 to-green-700 text-white px-6 py-3 rounded-lg font-bold hover:from-green-700 hover:to-green-800 transition-all shadow-lg"
                        >
                            ✍️ Inscribirse al Evento
                        </button>
                    )}
                    {hasStreaming && (
                        <a
                            href={event.streaming.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-gradient-to-r from-red-600 to-red-700 text-white px-6 py-3 rounded-lg font-bold hover:from-red-700 hover:to-red-800 transition-all shadow-lg text-center"
                        >
                            📺 {eventStatus === "live" ? "Ver en Vivo" : "Ir al Canal"}
                        </a>
                    )}
                </div>

                {/* Export Results as Image (completed events) */}
                {eventStatus === "completed" && (
                    <div className="flex justify-center pt-2">
                        <ExportableEventResults event={event} />
                    </div>
                )}

                {/* Notification Message */}
                {registrationMessage && (
                    <div className={`mt-6 p-4 rounded-lg text-center font-semibold text-white ${registrationMessage.startsWith("✅")
                        ? "bg-green-600/20 border border-green-500/30 text-green-300"
                        : "bg-red-600/20 border border-red-500/30 text-red-300"
                        }`}>
                        {registrationMessage}
                    </div>
                )}
            </div>

            {/* Registration Modal */}
            <RegistrationModal
                event={event}
                isOpen={isRegistrationModalOpen}
                onClose={() => setIsRegistrationModalOpen(false)}
                onSubmit={handleRegistration}
                isLoading={isRegistering}
            />
        </div>
    );
}

/* ---------- Sub-components ---------- */

function InfoRow({ icon, label, value }) {
    return (
        <div className="flex items-start gap-3">
            <span className="text-orange-400 mt-0.5">{icon}</span>
            <div>
                <div className="text-gray-500 text-xs uppercase tracking-wider font-semibold">{label}</div>
                <div className="text-white text-sm font-medium">{value}</div>
            </div>
        </div>
    );
}

function RulePill({ label, value }) {
    return (
        <div className="bg-white/5 rounded-lg p-3 text-center">
            <div className="text-gray-500 text-xs uppercase tracking-wider font-semibold mb-1">{label}</div>
            <div className="text-white text-sm font-bold">{value}</div>
        </div>
    );
}

/* ---------- Page wrapper with Suspense ---------- */

export default function EventDetailPage() {
    return (
        <Suspense
            fallback={
                <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 flex items-center justify-center">
                    <div className="text-center">
                        <div className="text-6xl mb-4 animate-bounce">🏁</div>
                        <div className="text-white text-xl font-bold">Cargando Evento...</div>
                    </div>
                </div>
            }
        >
            <EventDetailContent />
        </Suspense>
    );
}
