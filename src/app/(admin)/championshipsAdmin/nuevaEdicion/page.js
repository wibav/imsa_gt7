"use client";

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import ProtectedRoute from '../../../components/ProtectedRoute';
import LoadingSkeleton from '../../../components/common/LoadingSkeleton';
import { FirebaseService } from '../../../services/firebaseService';
import { calculateAdvancedStandings, applyPilotIdentities } from '../../../utils';
import {
    aplicarIdentidadesACampeonato,
    aplicarIdentidadesAEquipos,
    aplicarIdentidadesAPistas,
    aplicarIdentidadesADivisiones,
} from '../../../utils/pilotIdentityApply';
import {
    MOVIMIENTO,
    planificarMovimientos,
    inscripcionesVeteranos,
    tiemposVeteranos,
    divisionesBase,
} from '../../../utils/newEdition';

/**
 * Asistente «Nueva edición»: crea el campeonato de la siguiente temporada a
 * partir de uno terminado.
 *
 * 1. Datos de la edición (nombre, temporada, fechas, plazo de confirmación).
 * 2. Pilotos de la edición anterior con su división, posición final y el
 *    ascenso/descenso que les toca; el admin marca quién continúa.
 * 3. Resumen y creación como borrador.
 *
 * Se copia la configuración (puntos, sanciones, reglamento, uso de autos,
 * divisiones y su configuración) y la Pre-Qualy entera salvo la fecha: los
 * tiempos que se conservan tienen que valer lo mismo que los de los nuevos.
 * NO se copian circuitos ni resultados.
 * Quien continúa queda inscrito pendiente de confirmar, con su tiempo de
 * Pre-Qualy anterior. Ver utils/newEdition.js.
 */

const ETIQUETA_MOV = {
    [MOVIMIENTO.SUBE]: { texto: '▲ Sube', clase: 'text-green-400' },
    [MOVIMIENTO.BAJA]: { texto: '▼ Baja', clase: 'text-red-400' },
    [MOVIMIENTO.QUEDA]: { texto: '= Se queda', clase: 'text-gray-300' },
};

const siguienteTemporada = (season) => {
    const n = parseInt(season, 10);
    return Number.isFinite(n) ? String(n + 1) : '';
};

function NuevaEdicion() {
    const router = useRouter();
    const championshipId = useSearchParams().get('id');

    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState('');
    const [anterior, setAnterior] = useState(null);
    const [divisiones, setDivisiones] = useState([]);
    const [filas, setFilas] = useState([]);
    const [canonDe, setCanonDe] = useState({});
    const [paso, setPaso] = useState(1);
    const [creando, setCreando] = useState(false);

    const [datos, setDatos] = useState({ name: '', shortName: '', season: '', startDate: '', endDate: '', continuityDeadline: '' });
    // { [nombre]: { continua: bool, movement } }
    const [decision, setDecision] = useState({});

    useEffect(() => {
        if (!championshipId) return;
        (async () => {
            try {
                const [champ, teams, tracks, penalties, divs, identidades] = await Promise.all([
                    FirebaseService.getChampionship(championshipId),
                    FirebaseService.getTeamsByChampionship(championshipId).catch(() => []),
                    FirebaseService.getTracksByChampionship(championshipId).catch(() => []),
                    FirebaseService.getPenaltiesByChampionship(championshipId).catch(() => []),
                    FirebaseService.getDivisionsByChampionship(championshipId).catch(() => []),
                    FirebaseService.getPilotIdentities(),
                ]);
                if (!champ) { setError('Campeonato no encontrado'); return; }

                // Misma clasificación que la página pública: con las fusiones de
                // identidad aplicadas y por división.
                const mapa = applyPilotIdentities({}, identidades);
                const campF = aplicarIdentidadesACampeonato(champ, mapa);
                const teamsF = aplicarIdentidadesAEquipos(teams, mapa);
                const tracksF = aplicarIdentidadesAPistas(tracks, mapa);
                const divsF = aplicarIdentidadesADivisiones(divs, mapa)
                    .slice().sort((a, b) => (a.order || 0) - (b.order || 0));

                const porDivision = divsF.map(division => ({
                    division,
                    standings: calculateAdvancedStandings(campF, teamsF, tracksF, penalties, { divisionDrivers: division.drivers || [] }).driverStandings,
                }));
                const cfg = champ.divisionsConfig || {};
                const plan = planificarMovimientos(porDivision, {
                    promotionCount: cfg.promotionCount || 0,
                    relegationCount: cfg.relegationCount || 0,
                });

                const canon = {};
                Object.entries(mapa).forEach(([alias, c]) => { canon[alias.trim().toLowerCase()] = c; });

                setAnterior(champ);
                setDivisiones(divsF);
                setFilas(plan);
                setCanonDe(canon);
                // Quien no corrió ninguna carrera viene desmarcado: casi siempre es una
                // baja o un nombre antiguo que sigue en la lista de la división.
                setDecision(Object.fromEntries(plan.map(f => [f.name, { continua: f.raced, movement: f.movement }])));
                setDatos({
                    name: champ.name,
                    shortName: champ.shortName || '',
                    season: siguienteTemporada(champ.season),
                    startDate: '',
                    endDate: '',
                    continuityDeadline: '',
                });
            } catch (e) {
                console.error(e);
                setError('No se pudo cargar el campeonato: ' + e.message);
            } finally {
                setCargando(false);
            }
        })();
    }, [championshipId]);

    const continuan = useMemo(
        () => filas.filter(f => decision[f.name]?.continua).map(f => ({ ...f, movement: decision[f.name].movement })),
        [filas, decision]
    );
    const tiempos = useMemo(
        () => tiemposVeteranos(anterior?.preQualy?.results || [], continuan.map(f => f.name), canonDe),
        [anterior, continuan, canonDe]
    );

    const marcarTodos = (valor) => setDecision(prev => Object.fromEntries(Object.entries(prev).map(([n, d]) => [n, { ...d, continua: valor }])));

    const crear = async () => {
        if (!datos.name.trim() || !datos.season.trim()) { setError('Pon nombre y temporada a la nueva edición.'); setPaso(1); return; }
        setCreando(true);
        setError('');
        try {
            const ahora = new Date().toISOString();
            const veteranos = inscripcionesVeteranos(continuan, anterior.registrations || [], {
                championshipIdAnterior: anterior.id,
                canonDe,
                ahora,
            });
            const pq = anterior.preQualy || {};
            const nuevo = {
                name: datos.name.trim(),
                shortName: datos.shortName.trim(),
                description: anterior.description || '',
                season: datos.season.trim(),
                status: 'draft',
                startDate: datos.startDate ? new Date(datos.startDate).toISOString() : null,
                endDate: datos.endDate ? new Date(datos.endDate).toISOString() : null,
                banner: anterior.banner || '',
                logo: anterior.logo || '',
                categories: anterior.categories,
                settings: anterior.settings,
                drivers: [],
                registration: anterior.registration ? { ...anterior.registration, deadline: '' } : null,
                registrations: veteranos,
                streaming: anterior.streaming || null,
                penaltiesConfig: anterior.penaltiesConfig || null,
                regulations: anterior.regulations || null,
                regulationsFormat: anterior.regulationsFormat || null,
                carUsageTracking: anterior.carUsageTracking
                    ? { ...anterior.carUsageTracking, declarationDeadline: null }
                    : null,
                // Misma Pre-Qualy que la anterior (circuito, autos, duración y
                // configuración de sala): los veteranos conservan su tiempo y
                // los nuevos tienen que marcarlo en las mismas condiciones.
                // Solo cambia la fecha.
                preQualy: {
                    ...pq,
                    date: '',
                    results: tiempos,
                },
                divisionsConfig: anterior.divisionsConfig || null,
                comisarioUids: anterior.comisarioUids ?? null,
                edition: {
                    previousChampionshipId: anterior.id,
                    previousName: anterior.name,
                    continuityDeadline: datos.continuityDeadline || null,
                    createdAt: ahora,
                },
            };
            const { id } = await FirebaseService.createChampionship(nuevo, { orgId: anterior.orgId });
            for (const div of divisionesBase(divisiones)) {
                await FirebaseService.createDivision(id, div);
            }
            router.push(`/championshipsAdmin?id=${id}`);
        } catch (e) {
            console.error(e);
            setError('No se pudo crear la nueva edición: ' + e.message);
            setCreando(false);
        }
    };

    if (cargando) return <LoadingSkeleton variant="page" message="Cargando la edición anterior..." />;

    const input = 'w-full px-3 py-2 bg-white/10 border border-white/30 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500';
    const porDivision = divisiones.map(d => ({ division: d, filas: filas.filter(f => f.divisionId === d.id) }));

    return (
        <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
            <div>
                <button onClick={() => router.push(`/championshipsAdmin?id=${championshipId}`)} className="text-gray-400 hover:text-white text-sm">← Volver</button>
                <h1 className="text-2xl md:text-3xl font-bold text-white mt-2">🔁 Nueva edición</h1>
                {anterior && <p className="text-gray-400 text-sm">A partir de <strong className="text-white">{anterior.name}</strong> ({anterior.season})</p>}
            </div>

            <ol className="flex flex-wrap gap-2 text-sm">
                {['Datos de la edición', 'Pilotos que continúan', 'Resumen'].map((t, i) => (
                    <li key={t}>
                        <button
                            type="button"
                            onClick={() => setPaso(i + 1)}
                            className={`px-3 py-1.5 rounded-full border ${paso === i + 1 ? 'bg-orange-600 border-orange-500 text-white' : 'bg-white/5 border-white/20 text-gray-300 hover:bg-white/10'}`}
                        >
                            {i + 1}. {t}
                        </button>
                    </li>
                ))}
            </ol>

            {error && <div className="px-4 py-3 bg-red-900/40 border border-red-500/40 rounded-lg text-red-200 text-sm">{error}</div>}

            {paso === 1 && anterior && (
                <section className="bg-white/5 border border-white/15 rounded-xl p-5 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <label className="block">
                            <span className="text-sm text-gray-300">Nombre *</span>
                            <input className={input} value={datos.name} onChange={e => setDatos(p => ({ ...p, name: e.target.value }))} />
                        </label>
                        <label className="block">
                            <span className="text-sm text-gray-300">Nombre corto</span>
                            <input className={input} maxLength={10} value={datos.shortName} onChange={e => setDatos(p => ({ ...p, shortName: e.target.value }))} />
                        </label>
                        <label className="block">
                            <span className="text-sm text-gray-300">Temporada *</span>
                            <input className={input} value={datos.season} onChange={e => setDatos(p => ({ ...p, season: e.target.value }))} />
                        </label>
                        <label className="block">
                            <span className="text-sm text-gray-300">Plazo para confirmar la continuidad</span>
                            <input type="date" className={input} value={datos.continuityDeadline} onChange={e => setDatos(p => ({ ...p, continuityDeadline: e.target.value }))} />
                            <span className="text-xs text-gray-500">Hasta las 23:59 de ese día (España). Quien no confirme causará baja.</span>
                        </label>
                        <label className="block">
                            <span className="text-sm text-gray-300">Fecha de inicio</span>
                            <input type="date" className={input} value={datos.startDate} onChange={e => setDatos(p => ({ ...p, startDate: e.target.value }))} />
                        </label>
                        <label className="block">
                            <span className="text-sm text-gray-300">Fecha de fin</span>
                            <input type="date" className={input} value={datos.endDate} onChange={e => setDatos(p => ({ ...p, endDate: e.target.value }))} />
                        </label>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                        <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-3 text-green-100">
                            <p className="font-semibold mb-1">Se copia (y lo podrás cambiar)</p>
                            <p>Categorías, sistema de puntos, sanciones, reglamento, uso de autos, divisiones ({divisiones.map(d => d.name).join(', ') || 'ninguna'}) con sus ascensos y descensos, inscripción pública y transmisión.</p>
                            <p className="mt-1">La <strong>Pre-Qualy se mantiene igual</strong> (circuito{anterior.preQualy?.track ? `: ${anterior.preQualy.track}` : ''}, autos, duración y configuración de sala) para que los nuevos compitan en las mismas condiciones que los tiempos que se conservan. Solo tendrás que ponerle fecha.</p>
                        </div>
                        <div className="bg-white/5 border border-white/15 rounded-lg p-3 text-gray-300">
                            <p className="font-semibold mb-1 text-white">No se copia</p>
                            <p>Circuitos y sus resultados, sanciones aplicadas, reclamaciones, declaraciones de autos y la fecha de la Pre-Qualy. La edición se crea como borrador.</p>
                        </div>
                    </div>
                    <div className="flex justify-end">
                        <button onClick={() => setPaso(2)} className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-semibold">Siguiente →</button>
                    </div>
                </section>
            )}

            {paso === 2 && (
                <section className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3 bg-white/5 border border-white/15 rounded-xl p-4 text-sm">
                        <p className="text-gray-300">
                            Marca quién <strong className="text-white">continúa</strong>. Después cada uno tendrá que confirmarlo desde la web.
                            El movimiento sale de la clasificación final; puedes cambiarlo.
                        </p>
                        <div className="flex gap-3 text-xs">
                            <button onClick={() => marcarTodos(true)} className="text-orange-300 hover:text-orange-200">Marcar todos</button>
                            <button onClick={() => marcarTodos(false)} className="text-gray-400 hover:text-white">Desmarcar todos</button>
                        </div>
                    </div>

                    {porDivision.map(({ division, filas: fd }) => (
                        <div key={division.id} className="bg-white/5 border border-white/15 rounded-xl overflow-hidden">
                            <h2 className="px-4 py-2.5 font-bold text-white flex items-center gap-2 border-b border-white/10">
                                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: division.color || '#f97316' }} />
                                {division.name}
                                <span className="text-xs text-gray-400 font-normal">{fd.filter(f => decision[f.name]?.continua).length}/{fd.length} continúan</span>
                            </h2>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="text-gray-400 text-xs">
                                        <tr>
                                            <th className="text-left px-4 py-2 w-10">Pos</th>
                                            <th className="text-left px-2 py-2">Piloto</th>
                                            <th className="text-right px-2 py-2">Pts</th>
                                            <th className="text-left px-4 py-2">Movimiento</th>
                                            <th className="text-center px-4 py-2">Continúa</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {fd.map(f => {
                                            const d = decision[f.name] || {};
                                            return (
                                                <tr key={f.name} className={`border-t border-white/5 ${d.continua ? '' : 'opacity-50'}`}>
                                                    <td className="px-4 py-2 text-gray-400">{f.raced ? f.position : '—'}</td>
                                                    <td className="px-2 py-2 text-white">{f.name}{!f.raced && <span className="text-xs text-amber-300/80"> · no corrió ninguna carrera</span>}</td>
                                                    <td className="px-2 py-2 text-right text-orange-300">{f.points}</td>
                                                    <td className="px-4 py-2">
                                                        <select
                                                            value={d.movement}
                                                            onChange={e => setDecision(p => ({ ...p, [f.name]: { ...p[f.name], movement: e.target.value } }))}
                                                            className={`bg-white/10 border border-white/20 rounded px-2 py-1 text-xs ${ETIQUETA_MOV[d.movement]?.clase}`}
                                                            disabled={!d.continua}
                                                        >
                                                            {Object.entries(ETIQUETA_MOV).map(([v, e]) => <option key={v} value={v} className="bg-slate-800 text-white">{e.texto}</option>)}
                                                        </select>
                                                        {d.movement !== f.movement && <span className="text-[11px] text-amber-300 ml-2">cambiado</span>}
                                                    </td>
                                                    <td className="px-4 py-2 text-center">
                                                        <input
                                                            type="checkbox"
                                                            checked={Boolean(d.continua)}
                                                            onChange={e => setDecision(p => ({ ...p, [f.name]: { ...p[f.name], continua: e.target.checked } }))}
                                                            className="w-4 h-4"
                                                            aria-label={`${f.name} continúa`}
                                                        />
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ))}
                    {filas.length === 0 && <p className="text-gray-400 text-sm">Este campeonato no tiene pilotos en divisiones.</p>}
                    <div className="flex justify-between">
                        <button onClick={() => setPaso(1)} className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm">← Anterior</button>
                        <button onClick={() => setPaso(3)} className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-semibold">Siguiente →</button>
                    </div>
                </section>
            )}

            {paso === 3 && anterior && (
                <section className="bg-white/5 border border-white/15 rounded-xl p-5 space-y-4 text-sm">
                    <dl className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div><dt className="text-gray-400">Nueva edición</dt><dd className="text-white font-semibold">{datos.name} · {datos.season}</dd></div>
                        <div><dt className="text-gray-400">Plazo de confirmación</dt><dd className="text-white">{datos.continuityDeadline ? new Date(`${datos.continuityDeadline}T12:00:00`).toLocaleDateString('es-ES') : <span className="text-amber-300">Sin fijar (puedes ponerlo después)</span>}</dd></div>
                        <div><dt className="text-gray-400">Continúan (pendientes de confirmar)</dt><dd className="text-white">{continuan.length} de {filas.length}</dd></div>
                        <div><dt className="text-gray-400">Tiempos de Pre-Qualy que se conservan</dt><dd className="text-white">{tiempos.length}</dd></div>
                        <div>
                            <dt className="text-gray-400">Movimientos</dt>
                            <dd className="text-white">
                                <span className="text-green-400">▲ {continuan.filter(f => f.movement === MOVIMIENTO.SUBE).length} suben</span> ·{' '}
                                <span className="text-red-400">▼ {continuan.filter(f => f.movement === MOVIMIENTO.BAJA).length} bajan</span> ·{' '}
                                {continuan.filter(f => f.movement === MOVIMIENTO.QUEDA).length} se quedan
                            </dd>
                        </div>
                        <div><dt className="text-gray-400">No continúan</dt><dd className="text-white">{filas.length - continuan.length}</dd></div>
                    </dl>
                    <p className="text-gray-400">
                        Después de crearla: añade circuitos, revisa la configuración, abre inscripciones y la Pre-Qualy para los nuevos.
                        La edición anterior no se modifica.
                    </p>
                    <div className="flex justify-between">
                        <button onClick={() => setPaso(2)} className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg">← Anterior</button>
                        <button onClick={crear} disabled={creando} className="px-5 py-2 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 disabled:opacity-50 text-white rounded-lg font-bold">
                            {creando ? '⏳ Creando…' : '🔁 Crear nueva edición'}
                        </button>
                    </div>
                </section>
            )}
        </div>
    );
}

export default function NuevaEdicionPage() {
    return (
        <ProtectedRoute requireAdmin>
            <Suspense fallback={<LoadingSkeleton variant="page" message="Cargando..." />}>
                <NuevaEdicion />
            </Suspense>
        </ProtectedRoute>
    );
}
