"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../context/AuthContext";
import { FirebaseService } from "../services/firebaseService";
import {
    agruparCandidatos,
    conflictosDeGrupo,
    nombresPorCarrera,
    nucleoNombre,
} from "../utils/pilotIdentityMatcher";
import LoadingSkeleton from "../components/common/LoadingSkeleton";

/**
 * Fusión de identidades de piloto — solo Administrador de Plataforma.
 *
 * GT7 permite cambiar el GT7 ID tres veces, así que el mismo piloto termina
 * escrito de varias formas y sus estadísticas se parten. Aquí se unifican.
 *
 * La pantalla PROPONE; quien decide es la persona. Nada se fusiona solo, no
 * hay acción masiva, y la previsualización avisa de los dos casos peligrosos:
 * nombres que compartieron carrera (son dos personas) y alias que aparecen
 * juntos en la misma clasificación. Ver docs/PLAN_FUSION_PILOTOS.md.
 */
export default function PilotsAdminPage() {
    const router = useRouter();
    const { currentUser, isPlatformOwner, loading: authLoading } = useAuth();

    const [loading, setLoading] = useState(true);
    const [datos, setDatos] = useState({ apariciones: {}, carreras: [] });
    const [identities, setIdentities] = useState([]);
    const [seleccion, setSeleccion] = useState(null); // grupo abierto
    const [canonical, setCanonical] = useState('');
    const [incluidos, setIncluidos] = useState([]);
    const [nota, setNota] = useState('');
    const [busqueda, setBusqueda] = useState('');
    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!authLoading && !currentUser) router.push('/login');
    }, [currentUser, authLoading, router]);

    useEffect(() => { cargar(); }, []);

    const cargar = async () => {
        try {
            setLoading(true);
            const [champs, ids] = await Promise.all([
                FirebaseService.getChampionships(),
                FirebaseService.getPilotIdentities(),
            ]);
            setIdentities(ids);

            // Se cuentan las apariciones de cada nombre para poder ordenar los
            // candidatos por peso y proponer el canónico más usado.
            const apariciones = {};
            const carreras = [];
            const suma = (nombre, cuantas = 1) => {
                const n = String(nombre || '').trim();
                if (!n) return;
                apariciones[n] = (apariciones[n] || 0) + cuantas;
            };

            for (const champ of champs) {
                (champ.registrations || []).forEach(reg => {
                    const entradas = Array.isArray(reg.drivers) && reg.drivers.length ? reg.drivers : [reg];
                    entradas.forEach(e => [e.gt7Id, e.psnId, e.name].forEach(n => suma(n)));
                });
                (champ.drivers || []).forEach(d => suma(d.name));
                const tracks = await FirebaseService.getTracksByChampionship(champ.id).catch(() => []);
                tracks.forEach(t => {
                    Object.keys(t.points || {}).forEach(n => suma(n));
                    Object.values(t.results?.divisions || {}).forEach(div => {
                        Object.keys(div?.racePositions || {}).forEach(n => suma(n));
                        Object.keys(div?.racePoints || {}).forEach(n => suma(n));
                    });
                });
                carreras.push(...nombresPorCarrera(tracks));
            }

            // Los eventos aportan sus propios pilotos: hay quien solo corre eventos.
            const eventos = await FirebaseService.getEvents().catch(() => []);
            eventos.forEach(ev => {
                (ev.participants || []).forEach(p => [p.gt7Id, p.psnId, p.name].forEach(n => suma(n)));
                (ev.waitlist || []).forEach(p => [p.gt7Id, p.psnId].forEach(n => suma(n)));
                (ev.results || []).forEach(r => [r.driverName, r.psnId].forEach(n => suma(n)));
            });

            setDatos({ apariciones, carreras });
        } catch (e) {
            console.error('Error cargando identidades:', e);
            setError('No se pudieron cargar los datos: ' + e.message);
        } finally {
            setLoading(false);
        }
    };

    /** Nombres que ya pertenecen a una identidad confirmada. */
    const yaFusionados = useMemo(() => {
        const s = new Set();
        identities.forEach(i => { s.add(i.canonical); (i.aliases || []).forEach(a => s.add(a)); });
        return s;
    }, [identities]);

    const candidatos = useMemo(() => {
        const nombres = Object.keys(datos.apariciones);
        const grupos = agruparCandidatos(nombres, { yaFusionados });
        const peso = g => g.reduce((a, n) => a + (datos.apariciones[n] || 0), 0);
        return grupos
            .map(g => [...g].sort((a, b) => (datos.apariciones[b] || 0) - (datos.apariciones[a] || 0)))
            .sort((a, b) => peso(b) - peso(a));
    }, [datos, yaFusionados]);

    const candidatosVisibles = useMemo(() => {
        if (!busqueda.trim()) return candidatos;
        const t = busqueda.trim().toLowerCase();
        return candidatos.filter(g => g.some(n => n.toLowerCase().includes(t)));
    }, [candidatos, busqueda]);

    /**
     * Nombres sueltos que coinciden con la búsqueda.
     *
     * El heurístico agrupa por parecido, así que un piloto que ha escrito su
     * nombre de formas muy distintas sale repartido en varios grupos —o en
     * ninguno—. Buscando se ve todo lo que contiene ese texto y se añade a
     * mano lo que el parecido no juntó.
     */
    const nombresSueltos = useMemo(() => {
        const t = busqueda.trim().toLowerCase();
        if (t.length < 2) return [];
        return Object.keys(datos.apariciones)
            .filter(n => n.toLowerCase().includes(t) && !yaFusionados.has(n))
            .sort((a, b) => (datos.apariciones[b] || 0) - (datos.apariciones[a] || 0))
            .slice(0, 60);
    }, [busqueda, datos.apariciones, yaFusionados]);

    /**
     * Abre una selección para revisarla. Un grupo sugerido es solo el punto de
     * partida: una vez abierto se le pueden seguir añadiendo nombres desde el
     * buscador, que es lo que hace falta cuando el mismo piloto aparece
     * repartido en varios grupos ("NANO" y "NANO_VR2").
     */
    const abrirGrupo = (grupo, { conservarNota = false } = {}) => {
        setSeleccion(grupo);
        setCanonical(prev => (grupo.includes(prev) ? prev : grupo[0]));
        setIncluidos([...grupo]);
        if (!conservarNota) setNota('');
        setError('');
    };

    /** Añade o quita un nombre de la selección abierta, desde el buscador. */
    const alternarEnSeleccion = (nombre) => {
        const actual = seleccion || [];
        const nueva = actual.includes(nombre)
            ? actual.filter(n => n !== nombre)
            : [...actual, nombre];
        if (nueva.length === 0) { setSeleccion(null); return; }
        abrirGrupo(nueva, { conservarNota: true });
    };

    const conflictos = useMemo(
        () => (incluidos.length > 1 ? conflictosDeGrupo(incluidos, datos.carreras) : []),
        [incluidos, datos.carreras]
    );

    const alternar = (nombre) => {
        setIncluidos(prev => prev.includes(nombre) ? prev.filter(n => n !== nombre) : [...prev, nombre]);
    };

    const totalApariciones = incluidos.reduce((a, n) => a + (datos.apariciones[n] || 0), 0);

    const fusionar = async () => {
        setError('');
        if (conflictos.length > 0) {
            const detalle = conflictos.map(c => `"${c.a}" y "${c.b}" (${c.veces} carrera/s)`).join('\n');
            const seguir = confirm(
                `⚠️ Estos nombres puntuaron en la MISMA carrera, así que casi con seguridad son personas distintas:\n\n${detalle}\n\n¿Fusionarlos de todas formas?`
            );
            if (!seguir) return;
        }
        try {
            setGuardando(true);
            await FirebaseService.savePilotIdentity(
                { canonical, aliases: incluidos.filter(n => n !== canonical), note: nota },
                currentUser?.email || ''
            );
            setSeleccion(null);
            await cargar();
        } catch (e) {
            setError(e.message);
        } finally {
            setGuardando(false);
        }
    };

    const deshacer = async (ident) => {
        if (!confirm(`¿Deshacer la fusión de "${ident.canonical}"?\n\nLos nombres volverán a mostrarse por separado. No se toca ningún dato histórico.`)) return;
        try {
            await FirebaseService.deletePilotIdentity(ident.id);
            await cargar();
        } catch (e) {
            alert('No se pudo deshacer: ' + e.message);
        }
    };

    if (authLoading) return <div className="p-8 text-gray-400 text-sm">Cargando…</div>;
    if (!currentUser || !isPlatformOwner()) {
        return <div className="p-8 text-gray-400 text-sm">Acceso denegado. Esta sección solo la administra el Administrador de Plataforma.</div>;
    }
    if (loading) return <LoadingSkeleton variant="page" message="Analizando nombres de piloto..." />;

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 p-4 sm:p-8">
            <div className="max-w-7xl mx-auto">
                <div className="mb-8">
                    <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white flex items-center gap-3">
                        🧬 Identidades de Piloto
                    </h1>
                    <p className="text-gray-300 text-sm sm:text-base mt-2">
                        Unifica los nombres de un mismo piloto • {Object.keys(datos.apariciones).length} nombres distintos
                        <span className="mx-2">•</span>
                        <span className="text-orange-400">{candidatos.length} grupos propuestos</span>
                        <span className="mx-2">•</span>
                        <span className="text-green-400">{identities.length} fusiones activas</span>
                    </p>
                    <p className="text-gray-400 text-xs mt-2 max-w-3xl">
                        Nada se fusiona automáticamente: esto son sugerencias por parecido y se equivocan
                        con nombres genéricos. La fusión no modifica ningún dato histórico — solo dice qué
                        nombres son la misma persona — y se puede deshacer.
                    </p>
                </div>

                {error && (
                    <div className="mb-4 bg-red-500/10 border border-red-400/30 text-red-300 rounded-lg px-4 py-3 text-sm">
                        {error}
                    </div>
                )}

                <div className="grid lg:grid-cols-2 gap-6">
                    {/* ── Candidatos ── */}
                    <div>
                        <input
                            type="text"
                            value={busqueda}
                            onChange={(e) => setBusqueda(e.target.value)}
                            placeholder="🔍 Buscar un nombre..."
                            className="w-full px-4 py-2 mb-4 bg-white/10 border border-white/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
                        />

                        {/* Añadir a mano lo que el parecido no juntó. Aparece al
                            buscar porque es cuando se sabe qué se busca. */}
                        {nombresSueltos.length > 0 && (
                            <div className="mb-4 bg-white/5 border border-white/10 rounded-xl p-4">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm font-semibold text-white">
                                        Añadir a mano ({nombresSueltos.length} coinciden)
                                    </span>
                                    {seleccion && (
                                        <span className="text-xs text-orange-400">
                                            {seleccion.length} en la selección
                                        </span>
                                    )}
                                </div>
                                <p className="text-xs text-gray-500 mb-3">
                                    Pulsa un nombre para añadirlo o quitarlo de la selección de la derecha.
                                    Útil cuando el mismo piloto ha escrito su nombre de formas muy distintas
                                    y sale repartido en varios grupos.
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    {nombresSueltos.map(n => {
                                        const dentro = (seleccion || []).includes(n);
                                        return (
                                            <button
                                                key={n}
                                                onClick={() => alternarEnSeleccion(n)}
                                                className={`text-sm px-2 py-1 rounded transition-colors ${dentro
                                                    ? 'bg-orange-600 text-white'
                                                    : 'bg-white/10 text-gray-200 hover:bg-white/20'
                                                    }`}
                                            >
                                                {dentro ? '✓ ' : '+ '}{n}
                                                <span className={dentro ? 'text-orange-200' : 'text-gray-500'}> ({datos.apariciones[n]})</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
                            {candidatosVisibles.length === 0 ? (
                                <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-center text-gray-400 text-sm">
                                    {busqueda ? 'Ningún grupo coincide con la búsqueda.' : 'No hay grupos pendientes.'}
                                </div>
                            ) : candidatosVisibles.map((grupo, i) => {
                                const activo = seleccion && seleccion.join('|') === grupo.join('|');
                                const conflicto = conflictosDeGrupo(grupo, datos.carreras).length > 0;
                                return (
                                    <button
                                        key={i}
                                        onClick={() => abrirGrupo(grupo)}
                                        className={`w-full text-left bg-white/5 border rounded-xl p-4 transition-all hover:bg-white/10 ${activo ? 'border-orange-500' : conflicto ? 'border-red-400/40' : 'border-white/10'
                                            }`}
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-xs text-gray-500 font-mono">núcleo &ldquo;{nucleoNombre(grupo[0])}&rdquo;</span>
                                            {conflicto && (
                                                <span className="text-xs bg-red-500/20 text-red-300 px-2 py-0.5 rounded">
                                                    ⚠️ coincidieron en carrera
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {grupo.map(n => (
                                                <span key={n} className="text-sm bg-white/10 text-gray-200 px-2 py-1 rounded">
                                                    {n} <span className="text-gray-500">({datos.apariciones[n]})</span>
                                                </span>
                                            ))}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* ── Previsualización ── */}
                    <div>
                        {!seleccion ? (
                            <div className="bg-white/5 border border-white/10 rounded-xl p-8 text-center text-gray-400">
                                <div className="text-5xl mb-3">👈</div>
                                <p className="text-sm">Elige un grupo para revisarlo antes de fusionar.</p>
                                <p className="text-xs text-gray-500 mt-2">
                                    O busca un nombre y añádelo a mano: los grupos son sugerencias por
                                    parecido y no detectan a quien escribió su nombre de formas muy distintas.
                                </p>
                            </div>
                        ) : (
                            <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-white/20 rounded-xl p-5 space-y-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-xl font-bold text-white">Revisar fusión</h3>
                                    <span className="text-xs text-gray-500">
                                        busca arriba para añadir más nombres
                                    </span>
                                </div>

                                {conflictos.length > 0 && (
                                    <div className="bg-red-500/10 border border-red-400/40 rounded-lg p-3">
                                        <p className="text-red-300 text-sm font-semibold mb-1">⚠️ Probablemente son personas distintas</p>
                                        <ul className="text-red-200/80 text-xs space-y-1">
                                            {conflictos.map((c, i) => (
                                                <li key={i}>
                                                    &ldquo;{c.a}&rdquo; y &ldquo;{c.b}&rdquo; puntuaron en {c.veces} carrera(s) juntos.
                                                </li>
                                            ))}
                                        </ul>
                                        <p className="text-red-200/60 text-xs mt-2">
                                            Dos nombres no pueden ser el mismo piloto si compitieron en la misma carrera.
                                            Desmarca uno de ellos.
                                        </p>
                                    </div>
                                )}

                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">
                                        Nombres a unificar ({incluidos.length} de {seleccion.length})
                                    </label>
                                    <div className="space-y-2">
                                        {seleccion.map(n => (
                                            <label key={n} className="flex items-center gap-3 bg-white/5 rounded-lg px-3 py-2 cursor-pointer hover:bg-white/10">
                                                <input
                                                    type="checkbox"
                                                    checked={incluidos.includes(n)}
                                                    onChange={() => alternar(n)}
                                                    className="accent-orange-500"
                                                />
                                                <span className="text-white text-sm flex-1">{n}</span>
                                                <span className="text-gray-500 text-xs">{datos.apariciones[n]} apariciones</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">
                                        Nombre que se mostrará en toda la web
                                    </label>
                                    <select
                                        value={canonical}
                                        onChange={(e) => setCanonical(e.target.value)}
                                        className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                                    >
                                        {incluidos.map(n => (
                                            <option key={n} value={n} className="bg-slate-800">{n}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">Nota (opcional)</label>
                                    <input
                                        type="text"
                                        value={nota}
                                        onChange={(e) => setNota(e.target.value)}
                                        placeholder="Ej: cambió de GT7 ID en marzo de 2026"
                                        className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
                                    />
                                </div>

                                <div className="bg-white/5 border border-white/10 rounded-lg p-3 text-sm text-gray-300">
                                    Se unificarán <strong className="text-white">{incluidos.length} nombres</strong> con{' '}
                                    <strong className="text-white">{totalApariciones} apariciones</strong> bajo{' '}
                                    <strong className="text-orange-400">{canonical}</strong>.
                                    <span className="block text-gray-500 text-xs mt-1">
                                        No se modifica ningún dato: solo cambia cómo se muestran.
                                    </span>
                                </div>

                                <div className="flex flex-wrap gap-3">
                                    <button
                                        onClick={fusionar}
                                        disabled={guardando || incluidos.length < 2 || !canonical}
                                        className="flex-1 px-6 py-3 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white font-bold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {guardando ? '⏳ Fusionando...' : '🧬 Fusionar'}
                                    </button>
                                    <button
                                        onClick={() => setSeleccion(null)}
                                        className="px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white font-bold rounded-lg transition-all"
                                    >
                                        Cancelar
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* ── Fusiones activas ── */}
                        {identities.length > 0 && (
                            <div className="mt-6">
                                <h3 className="text-lg font-bold text-white mb-3">Fusiones activas ({identities.length})</h3>
                                <div className="space-y-2">
                                    {identities.map(ident => (
                                        <div key={ident.id} className="bg-white/5 border border-white/10 rounded-lg p-3">
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <div className="text-white font-semibold">{ident.canonical}</div>
                                                    <div className="text-gray-400 text-xs mt-1">
                                                        {(ident.aliases || []).join(' · ')}
                                                    </div>
                                                    {ident.note && <div className="text-gray-500 text-xs mt-1 italic">{ident.note}</div>}
                                                </div>
                                                <button
                                                    onClick={() => deshacer(ident)}
                                                    className="px-3 py-1.5 bg-red-600/20 text-red-400 hover:bg-red-600/40 rounded-lg text-sm transition-colors flex-shrink-0"
                                                >
                                                    Deshacer
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
