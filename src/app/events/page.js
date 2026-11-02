"use client";
import { useEffect, useState, useMemo, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Image from "next/image";
import { FirebaseService } from "../services/firebaseService";
import Navbar from "../components/Navbar";
import RegistrationModal from "../components/RegistrationModal";
import DynamicOGTags from "../components/DynamicOGTags";
import ExportableEventResults from "../components/ExportableEventResults";
import ShareButton from "../components/ShareButton";
import { notifyEventRegistration } from "../utils/telegram";
import {
    EVENT_STATUSES,
    EVENT_CATEGORIES,
    EVENT_FORMATS,
    STREAMING_PLATFORMS,
    TYRE_OPTIONS,
    WEATHER_TIME_OPTIONS,
    EVENT_TYPES,
    localRaceTime,
    raceDateTime,
} from "../utils";
import PilotTeamAvatar from "../components/common/PilotTeamAvatar";
import RoomConfigView from "../components/championship/RoomConfigView";
import { salaDeEvento, resumenSalaEvento } from "../utils/roomConfig";
import { useI18n } from "../i18n";

function EventDetailContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const eventId = searchParams.get("id");
    const { t, lang, locale } = useI18n();

    const [event, setEvent] = useState(null);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);
    const [isRegistrationModalOpen, setIsRegistrationModalOpen] = useState(false);
    const [isRegistering, setIsRegistering] = useState(false);
    const [registrationMessage, setRegistrationMessage] = useState("");
    const [activeRound, setActiveRound] = useState(0);
    const [roomTabs, setRoomTabs] = useState({}); // Track active tab per room
    const [verSala, setVerSala] = useState(false);

    useEffect(() => {
        if (eventId) {
            loadEvent();
        } else {
            setLoading(false);
            setNotFound(true);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
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
            const result = await FirebaseService.addEventParticipant(eventId, participantData);

            if (result.waitlisted) {
                setRegistrationMessage(`⏳ ${t('portada.listaReservas', { pos: result.position })}`);
            } else {
                setRegistrationMessage(`✅ ${t('portada.inscripcionOk')}`);
            }

            // Notificar al admin vía Telegram (best-effort)
            const org = event?.orgId ? await FirebaseService.getOrganization(event.orgId).catch(() => null) : null;
            notifyEventRegistration({
                eventTitle: event?.title || 'Evento',
                gt7Id: participantData.gt7Id,
                psnId: participantData.psnId,
                name: participantData.name,
                waitlisted: result.waitlisted,
                position: result.position,
                orgName: org?.name,
            });
        } catch (error) {
            const errorMessage = error.message || t('portada.errInscripcion');
            setRegistrationMessage(`❌ ${errorMessage}`);
            console.error("Error during registration:", error);
        } finally {
            setIsRegistering(false);
        }
    };

    const handleModalClose = () => {
        setIsRegistrationModalOpen(false);
        setRegistrationMessage("");
        loadEvent();
        window.scrollTo(0, 0); // Scroll to top of page
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
        // Hora española, no la del navegador (ver EventCard)
        const target = raceDateTime(event.date, event.hour || "00:00");
        if (!target) return null;
        const diff = target - new Date();
        if (diff <= 0) return null;
        const days = Math.floor(diff / 86400000);
        const hours = Math.floor((diff % 86400000) / 3600000);
        const mins = Math.floor((diff % 3600000) / 60000);
        if (days > 0) return t('eventos.cuentaDias', { d: days, h: hours });
        if (hours > 0) return t('eventos.cuentaHoras', { h: hours, m: mins });
        return t('eventos.cuentaMinutos', { m: mins });
    }, [event, eventStatus, t]);

    const isDeadlinePassed = useMemo(() => {
        if (!event?.registration?.deadline) return false;
        const deadline = event.registration.deadline;
        const eventDate = event.date;
        if (deadline === eventDate && event.hour) {
            // Cerrar en el momento exacto del evento, en hora española: leída
            // como hora del navegador, desde América la inscripción seguía
            // abierta horas después de empezar el evento.
            const closeTime = raceDateTime(eventDate, event.hour);
            return closeTime ? new Date() >= closeTime : false;
        }
        return new Date(`${deadline}T23:59:59`) < new Date();
    }, [event]);

    const formatDate = (dateStr) => {
        if (!dateStr) return "";
        const date = new Date(dateStr + "T00:00:00");
        return date.toLocaleDateString(locale, {
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
                    <div className="text-white text-xl font-bold">{t('eventos.cargando')}</div>
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
                    <h1 className="text-3xl font-bold text-white mb-4">{t('eventos.noEncontrado')}</h1>
                    <p className="text-gray-400 mb-8">
                        {t('eventos.noExiste')}
                    </p>
                    <button
                        onClick={() => router.push("/")}
                        className="bg-gradient-to-r from-orange-600 to-red-600 text-white px-6 py-3 rounded-lg font-bold hover:from-orange-700 hover:to-red-700 transition-all"
                    >
                        ← {t('reglamento.volver')}
                    </button>
                </div>
            </div>
        );
    }

    // --- Derived data ---
    const statusConfig = EVENT_STATUSES[eventStatus] || EVENT_STATUSES.upcoming;
    const cat = EVENT_CATEGORIES.find((c) => c.value === event.category);
    const fmt = EVENT_FORMATS?.find((f) => f.value === event.format);
    const evType = EVENT_TYPES?.find((ty) => ty.value === event.eventType);
    const isMultiRound = event.eventType && event.eventType !== 'standard' && event.rounds?.length > 0;
    const hasStreaming = event.streaming?.url;
    const participantCount = event.participants?.length || event.participantCount || 0;
    const maxP = event.maxParticipants || 0;
    const waitlistCount = event.waitlist?.length || event.waitlistCount || 0;
    const isFull = maxP > 0 && participantCount >= maxP;
    const resumenSala = resumenSalaEvento(event, lang);
    const salaEvento = salaDeEvento(event, lang);
    const hasRoomConfig = (event.rules && Object.keys(event.rules).length > 0) || resumenSala.length > 0;
    const hasResults = event.results?.length > 0;

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800">
            <Navbar />
            <DynamicOGTags
                title={event.title}
                description={event.description || `${event.track ? event.track + ' — ' : ''}${formatDate(event.date)}`}
                image={event.banner || 'https://imsa.trenkit.com/og-events.png'}
                url={`https://imsa.trenkit.com/events?id=${eventId}`}
            />

            {/* Hero Banner */}
            <div className="relative">
                {event.banner ? (
                    <div className="relative w-full h-64 sm:h-80 md:h-96 lg:h-[450px] bg-black/50">
                        <Image
                            src={event.banner}
                            alt={event.title}
                            fill
                            className="object-cover"
                            sizes="100vw"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/50 to-transparent" />
                    </div>
                ) : (
                    <div className="w-full h-64 sm:h-80 md:h-96 lg:h-[450px] bg-gradient-to-br from-orange-600 to-red-700 flex items-center justify-center">
                        <span className="text-[120px]">🏁</span>
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent" />
                    </div>
                )}

                {/* Status & Countdown overlay */}
                <div className="absolute top-3 left-3 sm:top-6 sm:left-6 flex flex-wrap gap-2 sm:gap-3">
                    <span className={`inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-4 py-1 sm:py-2 text-xs sm:text-sm font-bold rounded-full ${statusConfig.color} text-white shadow-lg`}>
                        {statusConfig.icon} {t(`eventos.estado.${EVENT_STATUSES[eventStatus] ? eventStatus : 'upcoming'}`)}
                    </span>
                    {cat && (
                        <span className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-4 py-1 sm:py-2 text-xs sm:text-sm font-semibold rounded-full bg-white/20 backdrop-blur-sm text-white shadow-lg">
                            {cat.icon} {t(`eventos.categoria.${cat.value}`)}
                        </span>
                    )}
                    {evType && event.eventType !== 'standard' && (
                        <span className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-4 py-1 sm:py-2 text-xs sm:text-sm font-semibold rounded-full bg-orange-500/30 backdrop-blur-sm text-orange-200 shadow-lg">
                            {evType.icon} {t(`eventos.tipo.${evType.value}`)}
                        </span>
                    )}
                </div>

                {eventStatus === "live" && (
                    <div className="absolute top-3 right-3 sm:top-6 sm:right-6">
                        <span className="inline-flex items-center gap-2 bg-red-600 text-white text-sm px-4 py-2 rounded-full font-bold animate-pulse shadow-lg">
                            <span className="w-3 h-3 bg-white rounded-full animate-ping" />
                            {t('campeonato.enVivo')}
                        </span>
                    </div>
                )}

                {/* Title overlay — solo título */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-slate-900 via-slate-900/70 to-transparent p-4 sm:p-6 md:p-8">
                    <div className="max-w-5xl mx-auto">
                        {/* Migas, igual que en las fichas de campeonato y de equipo.
                            No hay listado de eventos: están en Inicio. */}
                        <div className="flex items-center gap-2 text-sm text-gray-300 mb-2">
                            <button onClick={() => router.push("/")} className="hover:text-white transition-colors">{t('nav.inicio')}</button>
                            <span>/</span>
                            <span className="text-white/90 truncate">{t('eventos.migas')}</span>
                        </div>
                        <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-extrabold text-white drop-shadow-lg line-clamp-2">
                            {event.title}
                        </h1>
                        <div className="mt-4">
                            <ShareButton
                                type="event"
                                id={eventId}
                                title={event.title}
                                version={event.updatedAt}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">

                {/* Description — siempre debajo del banner */}
                {event.description && (
                    <div className="bg-white/5 border border-white/10 rounded-xl p-5">
                        <p className="text-gray-300 text-sm sm:text-base leading-relaxed">{event.description}</p>
                    </div>
                )}

                {/* Countdown banner */}
                {countdown && eventStatus === "upcoming" && (
                    <div className="bg-gradient-to-r from-blue-600/30 to-purple-600/30 border border-blue-400/40 rounded-xl p-5 text-center">
                        <div className="text-gray-400 text-sm font-semibold uppercase tracking-wider mb-1">{t('eventos.comienzaEn')}</div>
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
                            📺 {t('eventos.verTransmision')}
                        </div>
                        {event.streaming.platform && (
                            <div className="text-red-200 text-sm mt-1">
                                {t('eventos.enPlataforma', { plataforma: STREAMING_PLATFORMS?.find(p => p.value === event.streaming.platform)?.label || event.streaming.platform })}
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
                                📋 {t('eventos.informacion')}
                            </h2>
                            <div className="space-y-4">
                                <InfoRow icon="📅" label={t('componentes.prequaly.fecha')} value={formatDate(event.date)} />
                                {event.hour && (() => {
                                    // Igual que en la ficha de campeonato: hora española
                                    // y, si el visitante está en otra zona, su hora local.
                                    const local = localRaceTime(event.date, event.hour);
                                    return (
                                        <InfoRow icon="🕐" label={t('componentes.prequaly.hora')}
                                            value={`${event.hour}h (${t('campeonato.espana')})${local ? ` · ${t('campeonato.tuHora', { hora: local })}` : ''}`} />
                                    );
                                })()}
                                {event.track && <InfoRow icon="🏁" label={t('componentes.prequaly.circuito')} value={event.track} />}
                                {fmt && <InfoRow icon="🎮" label={t('componentes.briefing.formato')} value={`${fmt.icon ? `${fmt.icon} ` : ''}${t(`eventos.formato.${fmt.value}`)}`} />}
                                {maxP > 0 && (
                                    <InfoRow
                                        icon="👥"
                                        label={t('eventos.participantes')}
                                        value={`${participantCount} / ${maxP}${isFull ? ` (${t('portada.tarjeta.lleno')})` : ""}${waitlistCount > 0 ? ` · ${t('eventos.enReserva', { n: waitlistCount })}` : ""}`}
                                    />
                                )}
                                {event.registration?.enabled && (
                                    <InfoRow
                                        icon="📝"
                                        label={t('eventos.inscripcion.titulo')}
                                        value={
                                            eventStatus === "completed" || eventStatus === "live" || !event.registration?.enabled
                                                ? t('eventos.inscripcion.cerrada')
                                                : isDeadlinePassed
                                                    ? t('eventos.inscripcion.plazoVencido')
                                                    : isFull ? t('eventos.inscripcion.enReserva')
                                                        : event.registration.requiresApproval
                                                            ? t('eventos.inscripcion.conAprobacion')
                                                            : t('eventos.inscripcion.automatica')
                                        }
                                    />
                                )}
                                {event.registration?.deadline && (
                                    <InfoRow icon="⏰" label={t('eventos.cierreInscripcion')} value={formatDate(event.registration.deadline)} />
                                )}
                            </div>
                        </div>

                        {/* Streaming & Caster */}
                        {(event.streaming?.casterName || event.streaming?.hostName || event.streaming?.url) && (
                            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                                <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                    📺 {t('campeonato.transmision')}
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
                                            label={t('eventos.plataforma')}
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
                                                📺 {t('eventos.irCanal')}
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
                                    🏆 {t('eventos.tarjeta.premios')}
                                </h2>
                                <p className="text-yellow-200/80 text-sm whitespace-pre-line">{event.prizes}</p>
                            </div>
                        )}
                    </div>

                    {/* Right Column - Rules, Weather, Cars */}
                    <div className="space-y-6">

                        {/* Sala: resumen aquí y la configuración completa, como en el juego, en un modal */}
                        {hasRoomConfig && (
                            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                                <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                    🎮 {t('campeonato.configuracionSala')}
                                </h2>
                                {resumenSala.length > 0 && (
                                    <div className="flex flex-wrap gap-2 mb-4">
                                        {resumenSala.map(item => (
                                            <span key={item.id} className="text-xs bg-white/10 text-gray-200 px-2 py-1 rounded">{item.icono} {item.texto}</span>
                                        ))}
                                    </div>
                                )}
                                <button
                                    onClick={() => setVerSala(true)}
                                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600/30 hover:bg-blue-600/50 border border-blue-400/40 text-blue-200 rounded-lg text-sm font-semibold transition-all"
                                >
                                    🎮 {t('campeonato.verSala')}
                                </button>
                            </div>
                        )}

                        {/* Allowed Cars */}
                        {event.specificCars && event.allowedCars?.length > 0 && (
                            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                                <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                    🏎️ {t('componentes.briefing.cochesPermitidos')} ({event.allowedCars.length})
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
                                    🛞 {t('eventos.compuestos')}
                                </h2>
                                <div className="flex flex-wrap gap-2">
                                    {event.mandatoryTyres.map((tyre, idx) => {
                                        const tyreInfo = TYRE_OPTIONS?.find(op => op.value === tyre);
                                        return (
                                            <span
                                                key={idx}
                                                className="text-sm bg-orange-500/20 text-orange-300 px-3 py-1.5 rounded-lg font-medium"
                                            >
                                                {tyreInfo ? t(`eventos.neumatico.${tyre}`) : tyre}
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
                            👥 {t('eventos.participantes')} ({event.participants.length}{maxP > 0 ? ` / ${maxP}` : ""})
                        </h2>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-white/10 text-gray-400">
                                        <th className="text-left py-2 px-3">#</th>
                                        <th className="text-left py-2 px-3">GT7 ID</th>
                                        <th className="text-left py-2 px-3">PSN ID</th>
                                        {event.participants.some(p => p.country) && (
                                            <th className="text-left py-2 px-3">{t('formularios.inscripcion.pais')}</th>
                                        )}
                                    </tr>
                                </thead>
                                <tbody>
                                    {event.participants.map((p, idx) => (
                                        <tr key={idx} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                            <td className="py-2.5 px-3 text-gray-500 font-mono">{idx + 1}</td>
                                            <td className="py-2.5 px-3 text-white font-semibold"><span className="flex items-center gap-2"><PilotTeamAvatar name={p.gt7Id || p.name} aliases={[p.psnId, p.name].filter(Boolean)} size="xs" />{p.gt7Id || p.name || "-"}</span></td>
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

                {/* Sala Única (eventos estándar) — CA-1.8: bloque con participantes
                    y, si hay resultados, pestañas Participantes/Resultados
                    equivalentes a las de las salas de eliminatoria. No se
                    renderiza si no hay ni participantes ni resultados. */}
                {!isMultiRound && (hasResults || participantCount > 0) && (
                    <div className="bg-gradient-to-br from-yellow-600/10 to-orange-600/10 border border-yellow-500/30 rounded-xl overflow-hidden">
                        <div className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 px-4 py-3 border-b border-white/10">
                            <h3 className="text-white font-bold flex items-center gap-2">
                                🏟️ {t('eventos.salaUnica')}
                                {event.streaming?.casterName && <span className="text-xs bg-white/10 text-gray-300 px-2 py-0.5 rounded-full">🎙️ {event.streaming.casterName}</span>}
                                {event.streaming?.hostName && <span className="text-xs bg-white/10 text-gray-300 px-2 py-0.5 rounded-full">🎮 {event.streaming.hostName}</span>}
                            </h3>
                            {event.streaming?.url && (
                                <a href={event.streaming.url} target="_blank" rel="noopener noreferrer" className="text-xs text-red-400 hover:text-red-300 mt-1 inline-flex items-center gap-1">
                                    📺 {t('campeonato.verStream')}
                                </a>
                            )}
                        </div>
                        <div className="p-4">
                            {/* Tabs — solo si hay resultados, igual que en las salas de eliminatoria */}
                            {hasResults && (
                                <div className="flex gap-2 mb-4 border-b border-white/10 pb-2">
                                    <button
                                        onClick={() => setRoomTabs({ ...roomTabs, standard: 'participants' })}
                                        className={`px-3 py-2 text-sm font-semibold transition-colors ${roomTabs.standard !== 'results' ? 'text-orange-400 border-b-2 border-orange-400' : 'text-gray-400 hover:text-gray-300'}`}
                                    >
                                        👥 {t('eventos.participantes')} ({participantCount})
                                    </button>
                                    <button
                                        onClick={() => setRoomTabs({ ...roomTabs, standard: 'results' })}
                                        className={`px-3 py-2 text-sm font-semibold transition-colors ${roomTabs.standard === 'results' ? 'text-orange-400 border-b-2 border-orange-400' : 'text-gray-400 hover:text-gray-300'}`}
                                    >
                                        🏆 {t('campeonato.resultados')} ({event.results.length})
                                    </button>
                                </div>
                            )}

                            {/* Participantes */}
                            {roomTabs.standard !== 'results' && event.participants?.length > 0 && (
                                <ul className="space-y-2.5">
                                    {event.participants.map((p, pIdx) => (
                                        <li key={p.id || pIdx} className="flex items-start gap-3">
                                            <span className="text-orange-400 text-lg leading-none pt-0.5">•</span>
                                            <span className="text-white font-medium inline-flex items-center gap-2"><PilotTeamAvatar name={p.gt7Id || p.psnId} aliases={[p.psnId].filter(Boolean)} size="xs" />{p.gt7Id || p.psnId || t('formularios.inscripcion.piloto', { n: pIdx + 1 })}</span>
                                        </li>
                                    ))}
                                </ul>
                            )}

                            {/* Resultados */}
                            {hasResults && roomTabs.standard === 'results' && (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-yellow-500/20 text-gray-400">
                                                <th className="text-left py-2 px-3">{t('campeonato.pos')}</th>
                                                <th className="text-left py-2 px-3">{t('componentes.tabla.piloto')}</th>
                                                {event.results.some(r => r.psnId) && <th className="text-left py-2 px-3">PSN ID</th>}
                                                {event.results.some(r => r.points) && <th className="text-center py-2 px-3">{t('eventos.puntos')}</th>}
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
                                                    <td className="py-3 px-3 text-white font-semibold"><span className="flex items-center gap-2"><PilotTeamAvatar name={r.driverName} size="xs" />{r.driverName || "-"}</span></td>
                                                    {event.results.some(r => r.psnId) && (
                                                        <td className="py-3 px-3 text-gray-400">{r.psnId || "-"}</td>
                                                    )}
                                                    {event.results.some(r => r.points) && (
                                                        <td className="py-3 px-3 text-center text-orange-300 font-bold">{r.points || "-"}</td>
                                                    )}
                                                    <td className="py-3 px-3 text-center">
                                                        <div className="flex items-center justify-center gap-2">
                                                            {r.fastestLap && <span title={t('campeonato.vueltaRapida')} className="text-purple-400">⚡</span>}
                                                            {r.polePosition && <span title="Pole Position" className="text-yellow-400">🅿️</span>}
                                                            {r.dnf && <span title="DNF" className="text-red-400 text-xs font-bold">DNF</span>}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Multi-Round Results */}
                {isMultiRound && (
                    <div className="space-y-6">
                        <div className="bg-gradient-to-br from-orange-600/10 to-red-600/10 border border-orange-500/30 rounded-xl p-6">
                            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                🏟️ {t('eventos.rondas')}
                                {evType && <span className="text-sm font-normal text-orange-300">({t(`eventos.tipo.${evType.value}`)})</span>}
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
                                                        📺 {t('campeonato.verStream')}
                                                    </a>
                                                )}
                                            </div>

                                            {/* Room results */}
                                            {room.results?.length > 0 || room.participants?.length > 0 ? (
                                                <div className="p-4">
                                                    {/* Tabs - only show if there are results */}
                                                    {room.results?.length > 0 && (
                                                        <div className="flex gap-2 mb-4 border-b border-white/10 pb-2">
                                                            <button
                                                                onClick={() => setRoomTabs({ ...roomTabs, [`${activeRound}-${rmIdx}`]: 'participants' })}
                                                                className={`px-3 py-2 text-sm font-semibold transition-colors ${roomTabs[`${activeRound}-${rmIdx}`] !== 'results' ? 'text-orange-400 border-b-2 border-orange-400' : 'text-gray-400 hover:text-gray-300'}`}
                                                            >
                                                                👥 {t('eventos.participantes')} ({room.participants?.length || 0})
                                                            </button>
                                                            <button
                                                                onClick={() => setRoomTabs({ ...roomTabs, [`${activeRound}-${rmIdx}`]: 'results' })}
                                                                className={`px-3 py-2 text-sm font-semibold transition-colors ${roomTabs[`${activeRound}-${rmIdx}`] === 'results' ? 'text-orange-400 border-b-2 border-orange-400' : 'text-gray-400 hover:text-gray-300'}`}
                                                            >
                                                                🏆 {t('campeonato.resultados')} ({room.results?.length || 0})
                                                            </button>
                                                        </div>
                                                    )}

                                                    {/* Participantes Tab (visible si no estamos en pestaña resultados) */}
                                                    {roomTabs[`${activeRound}-${rmIdx}`] !== 'results' && room.participants?.length > 0 && (
                                                        <ul className="space-y-2.5">
                                                            {room.participants.map((p, pIdx) => (
                                                                <li key={pIdx} className="flex items-start gap-3">
                                                                    <span className="text-orange-400 text-lg leading-none pt-0.5">•</span>
                                                                    <span className="text-white font-medium inline-flex items-center gap-2"><PilotTeamAvatar name={p.gt7Id || p.name} aliases={[p.psnId, p.name].filter(Boolean)} size="xs" />{p.gt7Id || p.name || t('formularios.inscripcion.piloto', { n: pIdx + 1 })}</span>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    )}

                                                    {/* Resultados Tab */}
                                                    {room.results?.length > 0 && roomTabs[`${activeRound}-${rmIdx}`] === 'results' && (
                                                        <table className="w-full text-sm">
                                                            <thead>
                                                                <tr className="border-b border-white/10 text-gray-400">
                                                                    <th className="text-left py-2 px-2 w-10">{t('campeonato.pos')}</th>
                                                                    <th className="text-left py-2 px-2">{t('componentes.tabla.piloto')}</th>
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
                                                                        <td className="py-2.5 px-2 text-white font-semibold"><span className="flex items-center gap-2"><PilotTeamAvatar name={r.driverName} size="xs" />{r.driverName || "-"}</span></td>
                                                                        {room.results.some(r => r.psnId) && (
                                                                            <td className="py-2.5 px-2 text-gray-400 text-xs">{r.psnId || "-"}</td>
                                                                        )}
                                                                        <td className="py-2.5 px-2 text-center">
                                                                            <div className="flex items-center justify-center gap-1.5">
                                                                                {r.fastestLap && <span title={t('campeonato.vueltaRapida')} className="text-purple-400">⚡</span>}
                                                                                {r.polePosition && <span title="Pole Position" className="text-yellow-400">🅿️</span>}
                                                                                {r.dnf && <span title="DNF" className="text-red-400 text-xs font-bold">DNF</span>}
                                                                            </div>
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    )}

                                                </div>
                                            ) : (
                                                <div className="p-4 text-center text-gray-500 text-sm">
                                                    {t('eventos.sinDatos')}
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
                            📸 {t('eventos.galeria')}
                        </h2>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            {event.gallery.map((img, idx) => (
                                <div key={idx} className="relative aspect-video rounded-lg overflow-hidden bg-black/30">
                                    <Image
                                        src={img}
                                        alt={t('eventos.captura', { n: idx + 1 })}
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
                        ← {t('reglamento.volver')}
                    </button>
                    <button
                        onClick={loadEvent}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-all"
                    >
                        🔃 {t('eventos.refrescar')}
                    </button>
                    {eventStatus === "upcoming" && event.registration?.enabled && !isDeadlinePassed && !isFull && (
                        <button
                            onClick={() => setIsRegistrationModalOpen(true)}
                            className="bg-gradient-to-r from-green-600 to-green-700 text-white px-6 py-3 rounded-lg font-bold hover:from-green-700 hover:to-green-800 transition-all shadow-lg"
                        >
                            ✍️ {t('eventos.modal.titulo')}
                        </button>
                    )}
                    {eventStatus === "upcoming" && event.registration?.enabled && !isDeadlinePassed && isFull && (
                        <button
                            onClick={() => setIsRegistrationModalOpen(true)}
                            className="bg-gradient-to-r from-yellow-600 to-orange-600 text-white px-6 py-3 rounded-lg font-bold hover:from-yellow-700 hover:to-orange-700 transition-all shadow-lg"
                        >
                            ⏳ {t('eventos.irReservas')}{waitlistCount > 0 ? ` (${waitlistCount})` : ""}
                        </button>
                    )}
                    {eventStatus === "upcoming" && event.registration?.enabled && isDeadlinePassed && (
                        <div className="bg-gray-700/50 border border-gray-600/50 text-gray-400 px-6 py-3 rounded-lg font-semibold text-sm">
                            🔒 {t('eventos.inscripcionesCerradas')}
                        </div>
                    )}
                    {hasStreaming && (
                        <a
                            href={event.streaming.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-gradient-to-r from-red-600 to-red-700 text-white px-6 py-3 rounded-lg font-bold hover:from-red-700 hover:to-red-800 transition-all shadow-lg text-center"
                        >
                            📺 {eventStatus === "live" ? t('campeonato.verEnVivo') : t('eventos.irCanal')}
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
            {verSala && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setVerSala(false)}>
                    <div
                        className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl border border-white/10 w-full max-w-5xl max-h-[90vh] overflow-y-auto shadow-2xl"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between p-6 border-b border-white/10">
                            <div className="min-w-0">
                                <h2 className="text-2xl font-bold text-white">🎮 {t('campeonato.configuracionSala')}</h2>
                                <p className="text-gray-400 text-sm">{event.title}{event.track ? ` · ${event.track}` : ''}</p>
                            </div>
                            <button onClick={() => setVerSala(false)} className="text-gray-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/10" aria-label={t('campeonato.cerrar')}>✕</button>
                        </div>
                        <div className="p-6">
                            <RoomConfigView track={salaEvento} />
                        </div>
                    </div>
                </div>
            )}

            <RegistrationModal
                event={event}
                isOpen={isRegistrationModalOpen}
                onClose={handleModalClose}
                onSubmit={handleRegistration}
                isLoading={isRegistering}
                registrationMessage={registrationMessage}
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

/* ---------- Page wrapper with Suspense ---------- */

export default function EventDetailPage() {
    const { t } = useI18n();
    return (
        <Suspense
            fallback={
                <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 flex items-center justify-center">
                    <div className="text-center">
                        <div className="text-6xl mb-4 animate-bounce">🏁</div>
                        <div className="text-white text-xl font-bold">{t('eventos.cargando')}</div>
                    </div>
                </div>
            }
        >
            <EventDetailContent />
        </Suspense>
    );
}
