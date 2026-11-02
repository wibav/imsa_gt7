"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { FirebaseService } from "../services/firebaseService";
import { cargarEstadisticasPilotos } from "../utils/globalPilotStats";
import { estadisticasDeEquipo } from "../utils/teamStats";
import { miembrosActuales } from "../utils/teamTagMatcher";
import Link from "next/link";
import Navbar from "../components/Navbar";
import PageHeader from "../components/PageHeader";
import TeamAvatar from "../components/common/TeamAvatar";
import ShareButton from "../components/ShareButton";
import TeamRequestForm from "../components/common/TeamRequestForm";
import LoadingSkeleton from "../components/common/LoadingSkeleton";
import { useI18n } from "../i18n";

/**
 * Equipos de la comunidad.
 * - Sin parámetros: listado de los equipos confirmados.
 * - Con ?id=XXX: ficha del equipo.
 *
 * Solo aparecen los equipos que el Administrador de Plataforma ha confirmado
 * en /equiposAdmin. Las estadísticas suman el historial completo de los
 * miembros actuales. Ver docs/PLAN_EQUIPOS.md.
 */
function EquiposContent() {
    const { t } = useI18n();
    const searchParams = useSearchParams();
    const router = useRouter();
    const equipoId = searchParams.get('id');

    const [loading, setLoading] = useState(true);
    const [equipos, setEquipos] = useState([]);
    const [statsPilotos, setStatsPilotos] = useState([]);
    const [busqueda, setBusqueda] = useState('');
    const [orden, setOrden] = useState('victorias');

    useEffect(() => {
        (async () => {
            try {
                // Equipos y estadísticas de toda la plataforma: un equipo corre
                // en ligas de varias organizaciones.
                const [teams, { statsArray }] = await Promise.all([
                    FirebaseService.getRacingTeams(),
                    cargarEstadisticasPilotos({ allOrgs: true }),
                ]);
                setEquipos(teams);
                setStatsPilotos(statsArray);
            } catch (e) {
                console.error('Error cargando equipos:', e);
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    const conStats = useMemo(
        () => equipos.map(eq => ({ equipo: eq, ...estadisticasDeEquipo(eq, statsPilotos) })),
        [equipos, statsPilotos]
    );

    if (loading) return <LoadingSkeleton variant="page" message={t('equipos.cargando')} />;

    const seleccionado = equipoId ? conStats.find(e => e.equipo.id === equipoId) : null;

    if (equipoId) {
        return seleccionado
            ? <FichaEquipo datos={seleccionado} router={router} />
            : <NoEncontrado router={router} />;
    }

    const texto = busqueda.trim().toLowerCase();
    const visibles = conStats
        .filter(e => !texto || e.equipo.name.toLowerCase().includes(texto) || e.equipo.tag.toLowerCase().includes(texto)
            || miembrosActuales(e.equipo).some(m => m.pilot.toLowerCase().includes(texto)))
        .sort(comparadorEquipos(orden));

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800">
            <PageHeader
                migas={[{ label: t('equipos.titulo') }]}
                icono="🛡️"
                titulo={t('equipos.titulo')}
                subtitulo={t('equipos.subtitulo')}
            />
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">

                {conStats.length === 0 ? (
                    <div className="bg-white/5 border border-white/10 rounded-xl p-12 text-center">
                        <div className="text-6xl mb-4">🛡️</div>
                        <p className="text-gray-300 text-lg">{t('equipos.sinEquipos')}</p>
                    </div>
                ) : (
                    <>
                        <input
                            type="search"
                            value={busqueda}
                            onChange={e => setBusqueda(e.target.value)}
                            placeholder={t('equipos.buscar')}
                            className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
                        />
                        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                            <span className="text-gray-400">{t('equipos.ordenar')}:</span>
                            {Object.entries(CRITERIOS).map(([clave, c]) => (
                                <button
                                    key={clave}
                                    type="button"
                                    onClick={() => setOrden(clave)}
                                    aria-pressed={orden === clave}
                                    className={`px-3 py-1 rounded-full border transition-colors ${orden === clave
                                        ? 'bg-orange-600 border-orange-500 text-white'
                                        : 'bg-white/5 border-white/20 text-gray-300 hover:bg-white/10'}`}
                                >
                                    {c.icono} {t(`equipos.criterio.${clave}`)}
                                </button>
                            ))}
                        </div>
                        {visibles.length === 0 ? (
                            <p className="mt-6 text-gray-400">{t('equipos.sinCoincidencias')}</p>
                        ) : (
                            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                {visibles.map((e, i) => <TarjetaEquipo key={e.equipo.id} datos={e} posicion={texto ? null : i + 1} orden={orden} />)}
                            </div>
                        )}
                    </>
                )}

                <TeamRequestForm />
            </div>
        </div>
    );
}

/**
 * Criterios del ranking de equipos. Cada uno desempata con los siguientes,
 * como un medallero: victorias, luego podios, luego puntos.
 */
const CRITERIOS = {
    victorias: { icono: '🥇', claves: ['victorias', 'podios', 'puntos'] },
    podios: { icono: '🏅', claves: ['podios', 'victorias', 'puntos'] },
    puntos: { icono: '⭐', claves: ['puntos', 'victorias', 'podios'] },
    titulos: { icono: '🏆', claves: ['titulos', 'victorias', 'podios', 'puntos'] },
};

function comparadorEquipos(orden) {
    const claves = (CRITERIOS[orden] || CRITERIOS.victorias).claves;
    return (a, b) => {
        for (const k of claves) {
            const d = (b.total[k] || 0) - (a.total[k] || 0);
            if (d) return d;
        }
        return a.equipo.name.localeCompare(b.equipo.name);
    };
}

function BannerEquipo({ equipo, className }) {
    return (
        <div className={`relative bg-black/40 overflow-hidden ${className}`}
            style={!equipo.bannerUrl ? { background: `linear-gradient(110deg, ${equipo.color || '#475569'}cc, rgba(15,23,42,.4))` } : undefined}>
            {equipo.bannerUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={equipo.bannerUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
            )}
        </div>
    );
}

function TarjetaEquipo({ datos, posicion, orden }) {
    const { t } = useI18n();
    const { equipo, total, plantilla } = datos;
    return (
        // Enlace y no <button>: un botón centra su contenido en vertical, y
        // como la rejilla iguala la altura de las tarjetas de cada fila, las
        // más cortas bajaban el banner y dejaban una franja vacía encima, que
        // parecía una segunda cabecera.
        <Link
            href={`/equipos?id=${equipo.id}`}
            className="flex flex-col text-left bg-white/5 border border-white/10 hover:border-white/25 hover:bg-white/10 rounded-xl overflow-hidden transition-all"
        >
            <BannerEquipo equipo={equipo} className="h-20" />
            {/* relative + z-10: el banner es `relative` y, al ir antes, se
                pintaba encima del avatar y del nombre que suben sobre él. El
                avatar se superpone al banner; el nombre queda debajo del borde. */}
            <div className="relative z-10 px-4 pb-4">
                <div className="flex items-start gap-3">
                    <TeamAvatar team={equipo} size="lg" className="-mt-8 ring-4 ring-slate-900 shadow-lg" />
                    <div className="min-w-0 pt-2 flex-1">
                        <div className="text-white font-bold leading-tight truncate">{equipo.name}</div>
                        <div className="text-gray-400 text-xs">{equipo.tag} · {t('campeonato.pilotos', { n: total.pilotos })}</div>
                    </div>
                    {posicion && (
                        <span className={`pt-2 text-lg font-bold tabular-nums ${posicion <= 3 ? 'text-orange-400' : 'text-gray-500'}`}>#{posicion}</span>
                    )}
                </div>
                <div className="grid grid-cols-4 gap-2 mt-4 text-center">
                    {orden === 'titulos'
                        ? <Dato valor={total.titulos} label={t('equipos.dato.titulos')} activo />
                        : <Dato valor={total.campeonatos} label={t('equipos.dato.campeonatos')} />}
                    <Dato valor={total.victorias} label={t('equipos.dato.victorias')} activo={orden === 'victorias'} />
                    <Dato valor={total.podios} label={t('equipos.dato.podios')} activo={orden === 'podios'} />
                    <Dato valor={total.puntos} label={t('equipos.dato.puntos')} activo={orden === 'puntos'} />
                </div>
                {plantilla.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-4">
                        {plantilla.slice(0, 4).map(m => (
                            <span key={m.pilot} className="text-xs bg-white/10 text-gray-300 px-2 py-0.5 rounded">{m.pilot}</span>
                        ))}
                        {plantilla.length > 4 && <span className="text-xs text-gray-500 px-1">+{plantilla.length - 4}</span>}
                    </div>
                )}
            </div>
        </Link>
    );
}

function Dato({ valor, label, activo = false }) {
    return (
        <div>
            <div className={`text-xl font-bold tabular-nums ${activo ? 'text-orange-400' : 'text-white'}`}>{valor}</div>
            <div className="text-gray-400 text-[11px]">{label}</div>
        </div>
    );
}

function FichaEquipo({ datos, router }) {
    const { t, locale } = useI18n();
    const { equipo, total, plantilla, exMiembros, campeonatos, eventos } = datos;
    const fmtMes = (d) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString(locale, { month: 'short', year: 'numeric' }) : '—');

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800">
            <Navbar />
            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
                <div className="flex items-center gap-2 text-sm text-gray-400 mb-4">
                    <button onClick={() => router.push('/')} className="hover:text-white transition-colors">{t('nav.inicio')}</button>
                    <span>/</span>
                    <button onClick={() => router.push('/equipos')} className="hover:text-white transition-colors">{t('equipos.titulo')}</button>
                    <span>/</span>
                    <span className="text-white">{equipo.name}</span>
                </div>

                <div className="rounded-2xl overflow-hidden border border-white/10 bg-slate-900/60">
                    <BannerEquipo equipo={equipo} className="h-36 sm:h-52" />
                    <div className="relative z-10 px-5 sm:px-8 pb-6 flex flex-col sm:flex-row sm:items-start gap-4">
                        <TeamAvatar team={equipo} size="xl" className="-mt-12 ring-4 ring-slate-900 shadow-lg" />
                        <div className="flex-1 min-w-0 sm:pt-3">
                            <h1 className="text-3xl sm:text-4xl font-bold text-white">{equipo.name}</h1>
                            <p className="text-gray-400 text-sm mt-1">
                                {t('equipos.siglas', { tag: equipo.tag })} · {t('campeonato.pilotos', { n: total.pilotos })}
                                {exMiembros.length > 0 && ` · ${t('equipos.exMiembros', { n: exMiembros.length })}`}
                            </p>
                            {equipo.description && <p className="text-gray-300 text-sm mt-2 max-w-2xl">{equipo.description}</p>}
                        </div>
                        {/* /share/team/{id} lo sirve share_page con el banner y el nombre del equipo */}
                        <ShareButton type="team" id={equipo.id} title={equipo.name} version={equipo.updatedAt} />
                    </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-6">
                    {[
                        [t('equipos.ficha.campeonatos'), total.campeonatos],
                        [t('equipos.ficha.titulos'), total.titulos],
                        [t('equipos.ficha.victorias'), total.victorias],
                        [t('equipos.ficha.podios'), total.podios],
                        [t('equipos.ficha.eventos'), total.eventos],
                        [t('equipos.ficha.puntos'), total.puntos.toLocaleString(locale)],
                    ].map(([label, valor]) => (
                        <div key={label} className="bg-white/5 border border-white/10 rounded-xl p-4">
                            <div className="text-white text-2xl font-bold tabular-nums">{valor}</div>
                            <div className="text-gray-400 text-xs">{label}</div>
                        </div>
                    ))}
                </div>
                <p className="text-gray-500 text-xs mt-2">{t('equipos.suma')}</p>

                {/* min-w-0 en cada columna: sin él, la tabla (que tiene su propio scroll)
                    y los títulos largos de los eventos ensanchaban la rejilla y toda
                    la página se salía de la pantalla en el móvil. */}
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mt-8">
                    <section className="lg:col-span-3 min-w-0">
                        <h2 className="text-white font-bold text-lg mb-3">{t('equipos.plantilla')}</h2>
                        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl border border-white/10 overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-xs text-gray-400 border-b border-white/10 bg-white/5">
                                        <th className="px-4 py-2 text-left font-medium">{t('componentes.tabla.piloto')}</th>
                                        <th className="px-3 py-2 text-right font-medium">{t('pilotos.stats.carreras')}</th>
                                        <th className="px-3 py-2 text-right font-medium">{t('equipos.ficha.victorias')}</th>
                                        <th className="px-3 py-2 text-right font-medium">{t('equipos.ficha.podios')}</th>
                                        <th className="px-4 py-2 text-right font-medium">{t('equipos.ficha.puntos')}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5 tabular-nums">
                                    {plantilla.map(m => (
                                        // Sin estadísticas = aún no ha corrido: no tiene ficha en Pilotos
                                        // ("Piloto no encontrado"), así que la fila no enlaza.
                                        <tr key={m.pilot} className={m.stats ? 'hover:bg-white/5 cursor-pointer' : ''}
                                            onClick={m.stats ? () => router.push(`/pilots?name=${encodeURIComponent(m.pilot)}`) : undefined}>
                                            <td className="px-4 py-2 text-white font-semibold">
                                                {m.pilot}
                                                {!m.stats && (
                                                    <span className="ml-2 text-[11px] font-normal text-gray-400 bg-white/5 border border-white/10 rounded-full px-2 py-0.5 whitespace-nowrap">
                                                        {t('equipos.sinCarreras')}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-3 py-2 text-right text-gray-300">{m.stats?.totalRaces ?? 0}</td>
                                            <td className="px-3 py-2 text-right text-yellow-400">{m.stats?.totalWins || '-'}</td>
                                            <td className="px-3 py-2 text-right text-gray-300">{m.stats?.totalPodiums || '-'}</td>
                                            <td className="px-4 py-2 text-right text-orange-400 font-bold">{m.stats?.totalPoints ?? 0}</td>
                                        </tr>
                                    ))}
                                    {exMiembros.map(m => (
                                        <tr key={`ex-${m.pilot}`} className="text-gray-500">
                                            <td className="px-4 py-2">
                                                {m.pilot} <span className="text-[11px] bg-white/5 border border-white/10 rounded-full px-2 py-0.5 ml-1">{t('equipos.exNoSuma')}</span>
                                            </td>
                                            <td className="px-3 py-2 whitespace-nowrap text-right" colSpan={4}>{t('equipos.hasta', { fecha: fmtMes(m.to) })}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>

                    <section className="lg:col-span-2 min-w-0">
                        <h2 className="text-white font-bold text-lg mb-3">{t('equipos.trayectoria')}</h2>
                        <div className="bg-white/5 border border-white/10 rounded-xl divide-y divide-white/5">
                            {campeonatos.length === 0 && eventos.length === 0 && (
                                <p className="p-4 text-gray-400 text-sm">{t('equipos.aunNo')}</p>
                            )}
                            {campeonatos.map(c => (
                                <button key={c.id} onClick={() => router.push(`/championships?id=${c.id}`)}
                                    className="w-full text-left p-3 hover:bg-white/5">
                                    <div className="text-white text-sm font-semibold break-words">🏆 {c.name}</div>
                                    <div className="text-gray-400 text-xs mt-0.5">
                                        {t('campeonato.pilotos', { n: c.pilotos.length })}
                                        {c.mejor && <> · {t('equipos.mejor')}: {c.mejor.pilot}, <span className={c.mejor.posicion === 1 ? 'text-yellow-400 font-bold' : 'text-gray-200'}>P{c.mejor.posicion}</span></>}
                                    </div>
                                </button>
                            ))}
                            {eventos.map(ev => (
                                <button key={ev.id} onClick={() => router.push(`/events?id=${ev.id}`)}
                                    className="w-full text-left p-3 hover:bg-white/5">
                                    <div className="text-white text-sm font-semibold break-words">🎪 {ev.title}</div>
                                    <div className="text-gray-400 text-xs mt-0.5">
                                        {ev.date && `${fmtMes(ev.date)} · `}{t('campeonato.pilotos', { n: ev.pilotos.length })}
                                        {ev.mejor && <> · {t('equipos.mejor')}: {ev.mejor.pilot}, <span className={ev.mejor.posicion === 1 ? 'text-yellow-400 font-bold' : 'text-gray-200'}>P{ev.mejor.posicion}</span></>}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
}

function NoEncontrado({ router }) {
    const { t } = useI18n();
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 flex items-center justify-center">
            <div className="text-center">
                <div className="text-6xl mb-4">🛡️</div>
                <div className="text-white text-xl font-bold mb-4">{t('equipos.noEncontrado')}</div>
                <button onClick={() => router.push('/equipos')}
                    className="bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white px-6 py-3 rounded-lg font-bold transition-all">
                    {t('equipos.verTodos')}
                </button>
            </div>
        </div>
    );
}

export default function EquiposPage() {
    const { t } = useI18n();
    return (
        <Suspense fallback={<LoadingSkeleton variant="page" message={t('equipos.cargando')} />}>
            <EquiposContent />
        </Suspense>
    );
}
