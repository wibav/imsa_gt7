"use client";
import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { FirebaseService } from "../services/firebaseService";
import { calculateAdvancedStandings } from "../utils/standingsCalculator";
import { formatDateFull } from "../utils/dateUtils";
import { getPositionDisplay, getPositionBg } from "../utils/constants";
import { buildGt7IdMap } from "../utils/championshipUtils";
import { buildPilotEventHistory, resumirEventos } from "../utils/pilotEvents";
import LoadingSkeleton from "../components/common/LoadingSkeleton";

/**
 * Página pública de Perfiles Globales de Piloto.
 * - Sin query param: muestra grid de todos los pilotos con stats globales
 * - Con ?name=XXX: muestra perfil detallado del piloto
 */
export default function PilotsPage() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const selectedPilot = searchParams.get('name');

    const [loading, setLoading] = useState(true);
    const [globalStats, setGlobalStats] = useState([]); // Array de stats globales por piloto
    const [championshipDetails, setChampionshipDetails] = useState([]); // Detalles por campeonato

    useEffect(() => {
        loadGlobalStats();
    }, []);

    const loadGlobalStats = async () => {
        setLoading(true);
        try {
            // Obtener todos los campeonatos (no drafts)
            const allChampionships = await FirebaseService.getChampionships();
            const championships = allChampionships.filter(c => c.status !== 'draft');

            // Para cada campeonato, cargar tracks y teams en paralelo
            const detailsPromises = championships.map(async (champ) => {
                const [teams, tracks, penalties] = await Promise.all([
                    FirebaseService.getTeamsByChampionship(champ.id).catch(() => []),
                    FirebaseService.getTracksByChampionship(champ.id).catch(() => []),
                    FirebaseService.getPenaltiesByChampionship(champ.id).catch(() => [])
                ]);
                return { championship: champ, teams, tracks, penalties };
            });

            const allDetails = await Promise.all(detailsPromises);
            setChampionshipDetails(allDetails);

            // Los eventos sueltos no entran en ninguna clasificación, así que
            // se cargan aparte para el historial del perfil.
            const events = await FirebaseService.getEvents().catch(() => []);

            // Agregar stats globales por piloto.
            // Se normaliza al GT7 ID (cotejando contra las inscripciones de
            // TODOS los campeonatos, igual que la clasificación): antes cada
            // piloto se listaba con el identificador con el que se hubiera
            // inscrito — normalmente el psnId — y uno que figurase por psnId
            // en un campeonato y por gt7Id en otro salía como dos pilotos.
            const gt7Map = buildGt7IdMap(allDetails.map(d => d.championship));
            const pilotMap = {};

            allDetails.forEach(({ championship, teams, tracks, penalties }) => {
                const { driverStandings } = calculateAdvancedStandings(championship, teams, tracks, penalties);

                driverStandings.forEach(driver => {
                    const nombre = gt7Map[driver.name] || driver.name;
                    if (!pilotMap[nombre]) {
                        pilotMap[nombre] = {
                            name: nombre,
                            aliases: new Set(),
                            totalPoints: 0,
                            totalWins: 0,
                            totalPodiums: 0,
                            totalPoles: 0,
                            totalFastestLaps: 0,
                            totalDNFs: 0,
                            totalRaces: 0,
                            championships: [],
                            bestPosition: null,
                            teams: new Set(),
                            categories: new Set()
                        };
                    }

                    const pilot = pilotMap[nombre];
                    // Se guardan los alias para que los enlaces antiguos
                    // (?name=psnId) sigan resolviendo al piloto correcto.
                    if (driver.name !== nombre) pilot.aliases.add(driver.name);
                    pilot.totalPoints += driver.totalPoints;
                    pilot.totalWins += driver.wins;
                    pilot.totalPodiums += driver.podiums;
                    pilot.totalPoles += driver.poles;
                    pilot.totalFastestLaps += driver.fastestLaps;
                    pilot.totalDNFs += driver.dnfs;
                    pilot.totalRaces += driver.races;

                    if (driver.bestPosition !== null) {
                        if (pilot.bestPosition === null || driver.bestPosition < pilot.bestPosition) {
                            pilot.bestPosition = driver.bestPosition;
                        }
                    }

                    if (driver.team) pilot.teams.add(driver.team);
                    if (driver.category) pilot.categories.add(driver.category);

                    // Posición final en este campeonato
                    const finalPosition = driverStandings.findIndex(d => d.name === driver.name) + 1;

                    pilot.championships.push({
                        id: championship.id,
                        name: championship.name,
                        shortName: championship.shortName,
                        season: championship.season,
                        status: championship.status,
                        points: driver.totalPoints,
                        wins: driver.wins,
                        podiums: driver.podiums,
                        poles: driver.poles,
                        fastestLaps: driver.fastestLaps,
                        dnfs: driver.dnfs,
                        races: driver.races,
                        finalPosition,
                        totalDrivers: driverStandings.length,
                        team: driver.team,
                        category: driver.category,
                        penaltyPoints: driver.penaltyPoints || 0
                    });
                });
            });

            const eventosPorPiloto = buildPilotEventHistory(events, gt7Map);

            // Un piloto que solo ha corrido eventos no aparece en ninguna
            // clasificación, así que no tenía ficha y su historial no se podía
            // consultar. Se le crea una entrada vacía para que exista perfil.
            Object.keys(eventosPorPiloto).forEach(nombre => {
                const yaConocido = pilotMap[nombre]
                    || Object.values(pilotMap).some(p => p.aliases.has(nombre));
                if (yaConocido) return;
                pilotMap[nombre] = {
                    name: nombre,
                    aliases: new Set(),
                    totalPoints: 0,
                    totalWins: 0,
                    totalPodiums: 0,
                    totalPoles: 0,
                    totalFastestLaps: 0,
                    totalDNFs: 0,
                    totalRaces: 0,
                    championships: [],
                    bestPosition: null,
                    teams: new Set(),
                    categories: new Set()
                };
            });

            // Convertir Sets a Arrays y ordenar por puntos totales
            const statsArray = Object.values(pilotMap).map(p => ({
                ...p,
                aliases: [...p.aliases],
                teams: [...p.teams],
                categories: [...p.categories],
                championsCount: p.championships.filter(c => c.finalPosition === 1).length,
                avgPointsPerRace: p.totalRaces > 0 ? (p.totalPoints / p.totalRaces).toFixed(1) : '0',
                // El piloto puede figurar en los eventos por su psnId aunque
                // aquí ya esté normalizado al GT7 ID. Se fusionan las listas de
                // todos sus alias (no basta con quedarse con la primera que
                // aparezca: puede haber participaciones repartidas) y se
                // deduplica por evento.
                events: Object.values(
                    [p.name, ...p.aliases]
                        .flatMap(alias => eventosPorPiloto[alias] || [])
                        .reduce((acc, evento) => ({ ...acc, [evento.id]: evento }), {})
                ).sort((a, b) => (b.date || '').localeCompare(a.date || ''))
            })).sort((a, b) => b.totalPoints - a.totalPoints || b.events.length - a.events.length);

            setGlobalStats(statsArray);
        } catch (error) {
            console.error("Error loading global pilot stats:", error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return <LoadingSkeleton variant="page" message="Cargando perfiles de pilotos..." />;
    }

    // ═══════════════════════════════════════
    // VISTA DETALLE DE UN PILOTO
    // ═══════════════════════════════════════
    if (selectedPilot) {
        const pilot = globalStats.find(p =>
            p.name === selectedPilot || (p.aliases || []).includes(selectedPilot)
        );

        if (!pilot) {
            return (
                <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 flex items-center justify-center">
                    <div className="text-center">
                        <div className="text-6xl mb-4">❌</div>
                        <div className="text-white text-xl font-bold mb-4">Piloto no encontrado</div>
                        <button
                            onClick={() => router.push('/pilots')}
                            className="bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white px-6 py-3 rounded-lg font-bold transition-all"
                        >
                            Ver todos los pilotos
                        </button>
                    </div>
                </div>
            );
        }

        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800">
                {/* Header */}
                <div className="bg-gradient-to-r from-orange-600 via-red-600 to-orange-600 py-8 px-4 sm:px-6">
                    <div className="max-w-6xl mx-auto">
                        <div className="flex items-center gap-2 text-sm text-white/70 mb-4">
                            <button onClick={() => router.push('/')} className="hover:text-white transition-colors">🏠 Inicio</button>
                            <span>/</span>
                            <button onClick={() => router.push('/pilots')} className="hover:text-white transition-colors">Pilotos</button>
                            <span>/</span>
                            <span className="text-white">{pilot.name}</span>
                        </div>
                        <div className="flex items-center gap-6">
                            <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center text-4xl backdrop-blur-sm">
                                🏎️
                            </div>
                            <div>
                                <h1 className="text-4xl sm:text-5xl font-bold text-white">{pilot.name}</h1>
                                <div className="flex items-center gap-4 mt-2 flex-wrap">
                                    {pilot.teams.length > 0 && (
                                        <span className="text-white/80 text-sm">🏢 {pilot.teams.join(', ')}</span>
                                    )}
                                    {pilot.categories.length > 0 && (
                                        <span className="text-white/80 text-sm">🏷️ {pilot.categories.join(', ')}</span>
                                    )}
                                    {pilot.championsCount > 0 && (
                                        <span className="bg-yellow-500 text-black text-xs px-2 py-1 rounded-full font-bold">
                                            🏆 {pilot.championsCount}x Campeón
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
                    {/* Stats Cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 mb-8">
                        {[
                            { icon: '🏁', value: pilot.totalRaces, label: 'Carreras' },
                            { icon: '🏆', value: pilot.totalWins, label: 'Victorias' },
                            { icon: '🥇', value: pilot.totalPodiums, label: 'Podiums' },
                            { icon: '⏱️', value: pilot.totalPoles, label: 'Poles' },
                            { icon: '⚡', value: pilot.totalFastestLaps, label: 'V. Rápidas' },
                            { icon: '💀', value: pilot.totalDNFs, label: 'DNFs' },
                            { icon: '📊', value: pilot.totalPoints, label: 'Pts Totales' },
                            { icon: '📈', value: pilot.avgPointsPerRace, label: 'Pts/Carrera' }
                        ].map((stat, idx) => (
                            <div key={idx} className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
                                <div className="text-2xl mb-1">{stat.icon}</div>
                                <div className="text-2xl font-bold text-white">{stat.value}</div>
                                <div className="text-gray-400 text-xs">{stat.label}</div>
                            </div>
                        ))}
                    </div>

                    {/* Historial de Campeonatos */}
                    <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                        📋 Historial de Campeonatos ({pilot.championships.length})
                    </h2>
                    {pilot.championships.length === 0 && (
                        <p className="text-gray-400 text-sm mb-4 bg-white/5 border border-white/10 rounded-xl p-4">
                            Este piloto aún no ha corrido ningún campeonato: las estadísticas de
                            arriba solo cuentan carreras de campeonato, por eso están a cero.
                        </p>
                    )}
                    <div className="space-y-4">
                        {pilot.championships.map((champ, idx) => (
                            <div
                                key={idx}
                                className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-5 border border-white/10 hover:border-orange-500/30 transition-all cursor-pointer"
                                onClick={() => router.push(`/championships?id=${champ.id}`)}
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2 flex-wrap">
                                            <h3 className="text-lg font-bold text-white">{champ.name}</h3>
                                            {champ.season && (
                                                <span className="text-orange-400 text-sm">📅 {champ.season}</span>
                                            )}
                                            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${champ.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                                                    champ.status === 'active' ? 'bg-blue-500/20 text-blue-400' :
                                                        'bg-gray-500/20 text-gray-400'
                                                }`}>
                                                {champ.status === 'completed' ? '✓ Finalizado' :
                                                    champ.status === 'active' ? '● Activo' : champ.status}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-4 text-sm text-gray-400 flex-wrap">
                                            {champ.team && <span>🏢 {champ.team}</span>}
                                            {champ.category && <span>🏷️ {champ.category}</span>}
                                            <span>🏁 {champ.races} carreras</span>
                                            {champ.penaltyPoints > 0 && (
                                                <span className="text-red-400">⚠️ -{champ.penaltyPoints} pts</span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="text-right flex-shrink-0">
                                        <div className={`inline-flex items-center justify-center w-10 h-10 rounded-full text-lg font-bold mb-1 ${getPositionBg(champ.finalPosition)}`}>
                                            {getPositionDisplay(champ.finalPosition)}
                                        </div>
                                        <div className="text-orange-400 font-bold text-lg">{champ.points} pts</div>
                                        <div className="text-gray-500 text-xs">de {champ.totalDrivers} pilotos</div>
                                    </div>
                                </div>
                                {/* Mini stats */}
                                <div className="flex items-center gap-4 mt-3 pt-3 border-t border-white/5 text-xs text-gray-400">
                                    {champ.wins > 0 && <span className="text-yellow-400">🏆 {champ.wins} victorias</span>}
                                    {champ.podiums > 0 && <span className="text-gray-300">🥇 {champ.podiums} podiums</span>}
                                    {champ.poles > 0 && <span className="text-purple-400">⏱️ {champ.poles} poles</span>}
                                    {champ.fastestLaps > 0 && <span className="text-cyan-400">⚡ {champ.fastestLaps} v. rápidas</span>}
                                    {champ.dnfs > 0 && <span className="text-red-400">💀 {champ.dnfs} DNFs</span>}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Historial de eventos sueltos. Solo se pinta si el
                        piloto ha corrido alguno: la mayoría de perfiles
                        antiguos no tienen ninguno y una sección vacía solo
                        estorba. */}
                    {pilot.events.length > 0 && (() => {
                        const resumen = resumirEventos(pilot.events);
                        return (
                            <>
                                <h2 className="text-2xl font-bold text-white mt-8 mb-4 flex items-center gap-2">
                                    🎪 Eventos disputados ({resumen.total})
                                </h2>
                                {resumen.conResultado > 0 && (
                                    <p className="text-gray-400 text-sm -mt-2 mb-4">
                                        {resumen.victorias > 0 && <span className="text-yellow-400 mr-3">🏆 {resumen.victorias} victorias</span>}
                                        {resumen.podios > 0 && <span className="text-gray-300 mr-3">🥇 {resumen.podios} podios</span>}
                                        <span>Resultados publicados en {resumen.conResultado} de {resumen.total}</span>
                                    </p>
                                )}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {pilot.events.map(evento => (
                                        <div
                                            key={evento.id}
                                            className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-5 border border-white/10 hover:border-orange-500/30 transition-all cursor-pointer"
                                            onClick={() => router.push(`/events?id=${evento.id}`)}
                                        >
                                            <div className="flex items-start justify-between gap-4">
                                                <div className="flex-1 min-w-0">
                                                    <h3 className="text-base font-bold text-white mb-1">{evento.title}</h3>
                                                    <div className="flex items-center gap-3 text-sm text-gray-400 flex-wrap">
                                                        {evento.date && <span>📅 {formatDateFull(evento.date)}</span>}
                                                        {evento.track && <span className="truncate">🏁 {evento.track}</span>}
                                                    </div>
                                                    <div className="flex items-center gap-3 text-xs text-gray-500 mt-2 flex-wrap">
                                                        {evento.category && <span>🏷️ {evento.category}</span>}
                                                        {evento.participantes > 0 && <span>👥 {evento.participantes} inscritos</span>}
                                                        {evento.pole && <span className="text-purple-400">⏱️ Pole</span>}
                                                        {evento.fastestLap && <span className="text-cyan-400">⚡ V. rápida</span>}
                                                    </div>
                                                </div>
                                                <div className="text-right flex-shrink-0">
                                                    {evento.dnf ? (
                                                        <span className="text-red-400 text-sm font-bold">💀 DNF</span>
                                                    ) : evento.position != null ? (
                                                        <>
                                                            <div className={`inline-flex items-center justify-center w-10 h-10 rounded-full text-lg font-bold ${getPositionBg(evento.position)}`}>
                                                                {getPositionDisplay(evento.position)}
                                                            </div>
                                                            <div className="text-gray-500 text-xs mt-1">de {evento.totalResultados}</div>
                                                        </>
                                                    ) : (
                                                        // Muchos eventos nunca llegan a publicar resultados:
                                                        // se dice, en vez de dejar el hueco vacío.
                                                        <span className="text-gray-500 text-xs">Sin resultados</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        );
                    })()}

                    {/* Botón volver */}
                    <div className="mt-8 flex gap-4">
                        <button
                            onClick={() => router.push('/pilots')}
                            className="bg-white/10 hover:bg-white/20 border border-white/30 text-white px-6 py-3 rounded-lg font-semibold transition-all"
                        >
                            ← Todos los Pilotos
                        </button>
                        <button
                            onClick={() => router.push('/')}
                            className="bg-white/10 hover:bg-white/20 border border-white/30 text-white px-6 py-3 rounded-lg font-semibold transition-all"
                        >
                            🏠 Inicio
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ═══════════════════════════════════════
    // VISTA LISTADO DE TODOS LOS PILOTOS
    // ═══════════════════════════════════════
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800">
            {/* Header */}
            <div className="bg-gradient-to-r from-orange-600 via-red-600 to-orange-600 py-8 px-4 sm:px-6">
                <div className="max-w-7xl mx-auto">
                    <div className="flex items-center gap-2 text-sm text-white/70 mb-4">
                        <button onClick={() => router.push('/')} className="hover:text-white transition-colors">🏠 Inicio</button>
                        <span>/</span>
                        <span className="text-white">Pilotos</span>
                    </div>
                    <h1 className="text-4xl sm:text-5xl font-bold text-white">🏎️ Pilotos</h1>
                    <p className="text-white/80 mt-2">Estadísticas globales acumuladas de campeonatos y eventos</p>
                    <div className="flex items-center gap-4 mt-3 text-sm text-white/70">
                        <span>👥 {globalStats.length} pilotos</span>
                        <span>📊 {championshipDetails.length} campeonatos analizados</span>
                        <span>🎪 {globalStats.filter(p => p.events.length > 0).length} con eventos</span>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
                {globalStats.length === 0 ? (
                    <div className="bg-white/5 border border-white/10 rounded-xl p-12 text-center">
                        <div className="text-6xl mb-4">🏎️</div>
                        <p className="text-gray-300 text-lg">No hay pilotos registrados aún</p>
                    </div>
                ) : (
                    <>
                        {/* Top 3 Podium */}
                        {globalStats.length >= 3 && (
                            <div className="grid md:grid-cols-3 gap-4 mb-8">
                                {[
                                    { idx: 1, pilot: globalStats[1], gradient: 'from-gray-400 to-gray-500', medal: '🥈', label: '2°' },
                                    { idx: 0, pilot: globalStats[0], gradient: 'from-yellow-500 to-amber-500', medal: '🥇', label: '1°', featured: true },
                                    { idx: 2, pilot: globalStats[2], gradient: 'from-amber-700 to-orange-700', medal: '🥉', label: '3°' }
                                ].map(({ pilot: p, gradient, medal, label, featured }) => (
                                    <div
                                        key={p.name}
                                        className={`bg-gradient-to-br ${gradient} rounded-xl p-6 text-white text-center cursor-pointer hover:scale-[1.02] transition-transform ${featured ? 'md:-mt-4 md:mb-4 shadow-2xl' : ''}`}
                                        onClick={() => router.push(`/pilots?name=${encodeURIComponent(p.name)}`)}
                                    >
                                        <div className="text-4xl mb-2">{medal}</div>
                                        <h3 className="text-xl font-bold mb-1">{p.name}</h3>
                                        <div className="text-3xl font-bold mb-2">{p.totalPoints} pts</div>
                                        <div className="flex justify-center gap-3 text-sm opacity-90">
                                            <span>🏆 {p.totalWins}</span>
                                            <span>🥇 {p.totalPodiums}</span>
                                            <span>🏁 {p.totalRaces}</span>
                                        </div>
                                        {p.championsCount > 0 && (
                                            <div className="mt-2 text-xs bg-black/20 rounded-full px-3 py-1 inline-block">
                                                🏆 {p.championsCount}x Campeón
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Tabla completa */}
                        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl overflow-hidden border border-white/10">
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-gradient-to-r from-orange-600 to-red-600 text-white">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-sm font-bold">#</th>
                                            <th className="px-4 py-3 text-left text-sm font-bold">Piloto</th>
                                            <th className="px-4 py-3 text-center text-sm font-bold">Camps</th>
                                            <th className="px-4 py-3 text-center text-sm font-bold">🎪 Ev</th>
                                            <th className="px-4 py-3 text-center text-sm font-bold">🏆</th>
                                            <th className="px-4 py-3 text-center text-sm font-bold">🏁</th>
                                            <th className="px-4 py-3 text-center text-sm font-bold">🏆 Vic</th>
                                            <th className="px-4 py-3 text-center text-sm font-bold">🥇 Pod</th>
                                            <th className="px-4 py-3 text-center text-sm font-bold">⏱️ Pole</th>
                                            <th className="px-4 py-3 text-center text-sm font-bold">⚡ VR</th>
                                            <th className="px-4 py-3 text-center text-sm font-bold">💀 DNF</th>
                                            <th className="px-4 py-3 text-center text-sm font-bold">📈 Avg</th>
                                            <th className="px-4 py-3 text-right text-sm font-bold">Puntos</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {globalStats.map((pilot, index) => (
                                            <tr
                                                key={pilot.name}
                                                className={`border-b border-white/5 hover:bg-white/5 cursor-pointer transition-colors ${index < 3 ? 'bg-white/[0.03]' : ''}`}
                                                onClick={() => router.push(`/pilots?name=${encodeURIComponent(pilot.name)}`)}
                                            >
                                                <td className="px-4 py-3">
                                                    <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${getPositionBg(index + 1)}`}>
                                                        {getPositionDisplay(index + 1)}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="text-white font-semibold">{pilot.name}</div>
                                                    {pilot.teams.length > 0 && (
                                                        <div className="text-gray-500 text-xs">{pilot.teams.join(', ')}</div>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-center text-gray-300 text-sm">{pilot.championships.length}</td>
                                                <td className="px-4 py-3 text-center text-gray-300 text-sm">{pilot.events.length || '-'}</td>
                                                <td className="px-4 py-3 text-center text-yellow-400 text-sm font-bold">{pilot.championsCount || '-'}</td>
                                                <td className="px-4 py-3 text-center text-gray-300 text-sm">{pilot.totalRaces}</td>
                                                <td className="px-4 py-3 text-center text-yellow-400 text-sm font-semibold">{pilot.totalWins || '-'}</td>
                                                <td className="px-4 py-3 text-center text-gray-300 text-sm">{pilot.totalPodiums || '-'}</td>
                                                <td className="px-4 py-3 text-center text-purple-400 text-sm">{pilot.totalPoles || '-'}</td>
                                                <td className="px-4 py-3 text-center text-cyan-400 text-sm">{pilot.totalFastestLaps || '-'}</td>
                                                <td className="px-4 py-3 text-center text-red-400 text-sm">{pilot.totalDNFs || '-'}</td>
                                                <td className="px-4 py-3 text-center text-gray-400 text-sm">{pilot.avgPointsPerRace}</td>
                                                <td className="px-4 py-3 text-right text-orange-400 font-bold text-lg">{pilot.totalPoints}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </>
                )}

                {/* Botón volver */}
                <div className="mt-8">
                    <button
                        onClick={() => router.push('/')}
                        className="bg-white/10 hover:bg-white/20 border border-white/30 text-white px-6 py-3 rounded-lg font-semibold transition-all"
                    >
                        ← Volver al Inicio
                    </button>
                </div>
            </div>
        </div>
    );
}
