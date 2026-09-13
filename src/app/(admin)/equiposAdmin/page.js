"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../context/AuthContext";
import { FirebaseService } from "../../services/firebaseService";
import { buildGt7IdMap } from "../../utils/championshipUtils";
import { recolectarNombres, primeraFecha } from "../../utils/pilotNameCollector";
import {
    sugerirEquipos,
    pilotosConSiglasDe,
    mapaEquipoPorPiloto,
    conflictosDeMiembros,
    miembrosActuales,
    claveSiglas,
} from "../../utils/teamTagMatcher";
import { validateImageFile, compressImage } from "../../utils/imageCompression";
import ImageSpecHint from "../../components/common/ImageSpecHint";
import LoadingSkeleton from "../../components/common/LoadingSkeleton";
import TeamAvatar from "../../components/common/TeamAvatar";

/**
 * Equipos de la comunidad — solo Administrador de Plataforma.
 *
 * Las siglas de los GT7 ID ("HGT_ALEX94") PROPONEN equipos y miembros, pero
 * nunca deciden: GT7 solo deja cambiar el GT7 ID tres veces, así que quien se
 * va de un equipo puede seguir llevando sus siglas. Cada miembro lo confirma
 * la persona. Ver docs/PLAN_EQUIPOS.md.
 */

const COLORES = ['#dc2626', '#ea580c', '#f59e0b', '#16a34a', '#0891b2', '#2563eb', '#7c3aed', '#db2777', '#475569'];

// Estado de cada piloto en el panel. "pendiente" no se guarda: queda para
// decidir más tarde y el piloto se volverá a proponer.
const ESTADOS = {
    miembro: 'Miembro',
    exMiembro: 'Ex-miembro',
    noEs: 'No es del equipo',
    pendiente: 'Sin decidir',
};

const hoy = () => new Date().toISOString().slice(0, 10);

export default function EquiposAdminPage() {
    const router = useRouter();
    const { currentUser, isPlatformOwner, loading: authLoading } = useAuth();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [datos, setDatos] = useState({ apariciones: {}, fechas: {}, resolver: {} });
    const [equipos, setEquipos] = useState([]);
    const [descartes, setDescartes] = useState([]);
    const [pestana, setPestana] = useState('sugeridos');
    const [form, setForm] = useState(null); // equipo abierto en el panel
    const [filas, setFilas] = useState([]); // [{pilot, nombres, estado, from, to, source, nota, aviso}]
    const [busqueda, setBusqueda] = useState('');
    const [guardando, setGuardando] = useState(false);
    const [subiendo, setSubiendo] = useState('');
    const [nuevaVariante, setNuevaVariante] = useState('');

    useEffect(() => {
        if (!authLoading && !currentUser) router.push('/login');
    }, [currentUser, authLoading, router]);

    useEffect(() => { cargar(); }, []);

    const cargar = async () => {
        try {
            setLoading(true);
            // Los equipos son de toda la plataforma: se miran todas las organizaciones.
            const [champs, identities, teams, dism, eventos] = await Promise.all([
                FirebaseService.getChampionships({ allOrgs: true }),
                FirebaseService.getPilotIdentities(),
                FirebaseService.getRacingTeams(),
                FirebaseService.getTeamTagDismissals().catch(() => []),
                FirebaseService.getEvents({ allOrgs: true }).catch(() => []),
            ]);
            const conPistas = await Promise.all(champs.map(async championship => ({
                championship,
                tracks: await FirebaseService.getTracksByChampionship(championship.id).catch(() => []),
            })));
            const { apariciones, fechas } = recolectarNombres(conPistas, eventos);
            setDatos({ apariciones, fechas, resolver: buildGt7IdMap(champs, identities) });
            setEquipos(teams);
            setDescartes(dism);
        } catch (e) {
            console.error('Error cargando equipos:', e);
            setError('No se pudieron cargar los datos: ' + e.message);
        } finally {
            setLoading(false);
        }
    };

    const nombres = useMemo(() => Object.keys(datos.apariciones), [datos.apariciones]);

    /** Nombres de cada piloto unificado, para mostrar con qué GT7 ID ha corrido. */
    const nombresDePiloto = useMemo(() => {
        const m = {};
        nombres.forEach(n => { const p = datos.resolver[n] || n; (m[p] ||= []).push(n); });
        return m;
    }, [nombres, datos.resolver]);

    const sugeridos = useMemo(() => sugerirEquipos(nombres, {
        resolver: datos.resolver,
        equipos,
        descartadas: descartes.map(d => d.tag),
        apariciones: datos.apariciones,
    }), [nombres, datos, equipos, descartes]);

    const equipoDe = useMemo(() => mapaEquipoPorPiloto(equipos), [equipos]);

    const pendientesDe = (eq) => pilotosConSiglasDe(eq, nombres, { resolver: datos.resolver, equipos });

    // ── Abrir el panel ──

    const filaDe = (pilot, nombresPiloto, extra = {}) => ({
        pilot,
        nombres: nombresPiloto || nombresDePiloto[pilot] || [pilot],
        estado: 'pendiente',
        from: primeraFecha(nombresPiloto || nombresDePiloto[pilot] || [pilot], datos.fechas) || '',
        to: '',
        source: 'siglas',
        nota: '',
        aviso: '',
        ...extra,
    });

    const abrirSugerencia = (g) => {
        setForm({
            id: null,
            name: '',
            tag: g.tag,
            tagVariants: g.variantes,
            color: COLORES[0],
            avatarUrl: '',
            bannerUrl: '',
            description: '',
        });
        setFilas(g.pilotos.map(p => {
            const otro = equipoDe[p.pilot];
            return filaDe(p.pilot, p.nombres, otro
                ? { estado: 'noEs', nota: `ahora en ${otro.tag}`, aviso: `Lleva las siglas, pero ya es miembro de ${otro.name} (${otro.tag}).` }
                : { estado: 'miembro' });
        }));
        setError('');
        setBusqueda('');
        window.scrollTo({ top: 0, behavior: 'auto' });
    };

    const abrirEquipo = (eq) => {
        setForm({
            id: eq.id,
            name: eq.name || '',
            tag: eq.tag || '',
            tagVariants: eq.tagVariants || [eq.tag],
            color: eq.color || COLORES[0],
            avatarUrl: eq.avatarUrl || '',
            bannerUrl: eq.bannerUrl || '',
            description: eq.description || '',
        });
        const guardadas = [
            ...(eq.members || []).map(m => filaDe(m.pilot, null, {
                estado: m.to ? 'exMiembro' : 'miembro', from: m.from || '', to: m.to || '', source: m.source || 'manual',
            })),
            ...(eq.notMembers || []).map(m => filaDe(m.pilot, null, { estado: 'noEs', nota: m.note || '' })),
        ];
        const { nuevos, deOtroEquipo } = pendientesDe(eq);
        setFilas([
            ...guardadas,
            ...nuevos.map(p => filaDe(p.pilot, p.nombres, { aviso: 'Nuevo con estas siglas desde la última vez.' })),
            ...deOtroEquipo.map(p => filaDe(p.pilot, p.nombres, {
                estado: 'pendiente',
                aviso: `Lleva las siglas, pero ya es miembro de ${p.equipo.name} (${p.equipo.tag}).`,
            })),
        ]);
        setError('');
        setBusqueda('');
        window.scrollTo({ top: 0, behavior: 'auto' });
    };

    const nuevoManual = () => {
        setForm({ id: null, name: '', tag: '', tagVariants: [], color: COLORES[0], avatarUrl: '', bannerUrl: '', description: '' });
        setFilas([]);
        setError('');
    };

    const cerrar = () => { setForm(null); setFilas([]); setError(''); setBusqueda(''); };

    // ── Edición ──

    const cambiar = (campo, valor) => setForm(f => ({ ...f, [campo]: valor }));
    const cambiarFila = (pilot, cambios) => setFilas(fs => fs.map(f => f.pilot === pilot ? { ...f, ...cambios } : f));

    const ponerEstado = (fila, estado) => {
        const cambios = { estado };
        if (estado === 'exMiembro' && !fila.to) cambios.to = hoy();
        if (estado === 'miembro') cambios.to = '';
        cambiarFila(fila.pilot, cambios);
    };

    const anadirVariante = () => {
        const v = nuevaVariante.trim().replace(/[_\-.\s]+$/, '');
        if (!v) return;
        setForm(f => ({ ...f, tagVariants: [...new Set([...(f.tagVariants || []), v])] }));
        setNuevaVariante('');
    };

    /** Pilotos que coinciden con la búsqueda, para añadir a quien no lleva siglas. */
    const resultadosBusqueda = useMemo(() => {
        const t = busqueda.trim().toLowerCase();
        if (t.length < 2 || !form) return [];
        const yaEn = new Set(filas.map(f => f.pilot));
        return Object.keys(nombresDePiloto)
            .filter(p => !yaEn.has(p) && [p, ...nombresDePiloto[p]].some(n => n.toLowerCase().includes(t)))
            .sort((a, b) => a.localeCompare(b))
            .slice(0, 30);
    }, [busqueda, nombresDePiloto, filas, form]);

    const anadirManual = (pilot) => {
        const otro = equipoDe[pilot];
        setFilas(fs => [...fs, filaDe(pilot, null, {
            estado: otro && otro.id !== form?.id ? 'pendiente' : 'miembro',
            source: 'manual',
            aviso: otro && otro.id !== form?.id ? `Ya es miembro de ${otro.name} (${otro.tag}).` : '',
        })]);
        setBusqueda('');
    };

    const subirImagen = async (campo, file) => {
        if (!file) return;
        try {
            setSubiendo(campo);
            validateImageFile(file);
            const comprimida = await compressImage(file);
            const nombre = `${form.tag || 'equipo'}-${campo === 'avatarUrl' ? 'avatar' : 'banner'}.png`;
            const { url } = await FirebaseService.uploadImageDeduped(comprimida, 'teams', nombre);
            cambiar(campo, url);
        } catch (e) {
            setError('No se pudo subir la imagen: ' + e.message);
        } finally {
            setSubiendo('');
        }
    };

    // ── Guardar ──

    const equipoDelFormulario = () => ({
        ...form,
        tag: claveSiglas(form.tag),
        members: filas
            .filter(f => f.estado === 'miembro' || f.estado === 'exMiembro')
            .map(f => ({ pilot: f.pilot, from: f.from || null, to: f.estado === 'exMiembro' ? (f.to || hoy()) : null, source: f.source })),
        notMembers: filas.filter(f => f.estado === 'noEs').map(f => ({ pilot: f.pilot, note: f.nota })),
    });

    const conflictos = useMemo(
        () => (form ? conflictosDeMiembros(equipoDelFormulario(), equipos) : []),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [form, filas, equipos]
    );

    const guardar = async () => {
        setError('');
        if (!form.name.trim()) { setError('Escribe el nombre real del equipo: qué significan sus siglas.'); return; }
        if (!claveSiglas(form.tag)) { setError('Faltan las siglas.'); return; }
        try {
            setGuardando(true);
            await FirebaseService.saveRacingTeam(equipoDelFormulario(), currentUser?.email || '');
            cerrar();
            setPestana('confirmados');
            await cargar();
        } catch (e) {
            setError(e.message);
        } finally {
            setGuardando(false);
        }
    };

    const eliminar = async () => {
        if (!form?.id) return;
        if (!confirm(`¿Eliminar el equipo ${form.name}?\n\nSolo se borra la ficha del equipo. No se toca ningún resultado.`)) return;
        try {
            await FirebaseService.deleteRacingTeam(form.id);
            cerrar();
            await cargar();
        } catch (e) {
            setError('No se pudo eliminar: ' + e.message);
        }
    };

    const descartarSiglas = async (tag) => {
        try {
            await FirebaseService.dismissTeamTag(tag, currentUser?.email || '');
            if (form && !form.id && claveSiglas(form.tag) === tag) cerrar();
            await cargar();
        } catch (e) {
            setError('No se pudo descartar: ' + e.message);
        }
    };

    const recuperarSiglas = async (tag) => {
        try {
            await FirebaseService.deleteTeamTagDismissal(tag);
            await cargar();
        } catch (e) {
            setError('No se pudo recuperar: ' + e.message);
        }
    };

    if (authLoading) return <div className="p-8 text-gray-400 text-sm">Cargando…</div>;
    if (!currentUser || !isPlatformOwner()) {
        return <div className="p-8 text-gray-400 text-sm">Acceso denegado. Esta sección solo la administra el Administrador de Plataforma.</div>;
    }
    if (loading) return <LoadingSkeleton variant="page" message="Buscando siglas de equipo..." />;

    const inputCls = "w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500";
    const pestanas = [
        ['sugeridos', 'Sugeridos', sugeridos.length],
        ['confirmados', 'Confirmados', equipos.length],
        ['descartados', 'Descartados', descartes.length],
    ];

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 p-4 sm:p-8">
            <div className="max-w-7xl mx-auto">
                <div className="mb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white">🛡️ Equipos</h1>
                        <p className="text-gray-300 text-sm sm:text-base mt-2">
                            Confirma los equipos a partir de las siglas de los GT7 ID.
                        </p>
                        <p className="text-gray-400 text-xs mt-2 max-w-3xl">
                            Las siglas solo proponen: GT7 permite cambiar el GT7 ID tres veces, y quien se va de un
                            equipo puede seguir llevándolas. Cada miembro lo decides tú. Nada toca los resultados.
                        </p>
                    </div>
                    <button onClick={nuevoManual}
                        className="bg-white/10 hover:bg-white/20 border border-white/30 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all self-start sm:self-auto">
                        + Crear equipo sin siglas detectadas
                    </button>
                </div>

                {error && (
                    <div className="mb-4 bg-red-500/10 border border-red-400/30 text-red-300 rounded-lg px-4 py-3 text-sm">{error}</div>
                )}

                <div className="flex gap-1 border-b border-white/10 mb-6 overflow-x-auto">
                    {pestanas.map(([id, label, n]) => (
                        <button key={id} onClick={() => setPestana(id)}
                            className={`px-4 py-2 text-sm font-semibold border-b-2 whitespace-nowrap transition-colors ${pestana === id ? 'text-white border-orange-500' : 'text-gray-400 border-transparent hover:text-gray-200'}`}>
                            {label} <span className="text-gray-500 font-normal">{n}</span>
                        </button>
                    ))}
                </div>

                <div className="grid lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-6 items-start">
                    {/* ── Lista ── */}
                    <div className="space-y-3 lg:max-h-[75vh] lg:overflow-y-auto lg:pr-1">
                        {pestana === 'sugeridos' && (sugeridos.length === 0 ? (
                            <Vacio texto="No quedan siglas por revisar." />
                        ) : sugeridos.map(g => {
                            const activo = form && !form.id && claveSiglas(form.tag) === g.tag;
                            return (
                                <div key={g.tag} className={`bg-white/5 border rounded-xl p-4 ${activo ? 'border-orange-500' : 'border-white/10'}`}>
                                    <button onClick={() => abrirSugerencia(g)} className="w-full text-left">
                                        <div className="flex items-center justify-between gap-2 mb-2">
                                            <span className="font-mono font-bold text-white bg-white/10 px-2 py-0.5 rounded">{g.tag}</span>
                                            <span className="text-xs text-amber-300 bg-amber-400/10 border border-amber-400/30 px-2 py-0.5 rounded-full">
                                                {g.pilotos.length} pilotos
                                            </span>
                                        </div>
                                        <div className="text-xs text-gray-400 font-mono leading-relaxed">
                                            {g.pilotos.map(p => p.pilot).join(' · ')}
                                        </div>
                                    </button>
                                    <div className="mt-3 pt-3 border-t border-white/5">
                                        <button onClick={() => descartarSiglas(g.tag)}
                                            className="text-xs text-gray-400 hover:text-red-300 transition-colors"
                                            title="Deja de proponerse. Se puede recuperar.">
                                            ✕ No es un equipo
                                        </button>
                                    </div>
                                </div>
                            );
                        }))}

                        {pestana === 'confirmados' && (equipos.length === 0 ? (
                            <Vacio texto="Aún no has confirmado ningún equipo." />
                        ) : [...equipos].sort((a, b) => a.name.localeCompare(b.name)).map(eq => {
                            const { nuevos, deOtroEquipo } = pendientesDe(eq);
                            const pend = nuevos.length + deOtroEquipo.length;
                            return (
                                <button key={eq.id} onClick={() => abrirEquipo(eq)}
                                    className={`w-full text-left bg-white/5 border rounded-xl p-4 flex items-center gap-3 ${form?.id === eq.id ? 'border-orange-500' : 'border-white/10 hover:border-white/20'}`}>
                                    <TeamAvatar team={eq} size="md" />
                                    <div className="min-w-0 flex-1">
                                        <div className="text-white font-semibold truncate">{eq.name}</div>
                                        <div className="text-xs text-gray-400">{miembrosActuales(eq).length} miembros · siglas {eq.tag}</div>
                                    </div>
                                    {pend > 0 && (
                                        <span className="text-xs text-amber-300 bg-amber-400/10 border border-amber-400/30 px-2 py-0.5 rounded-full whitespace-nowrap">
                                            {pend} por revisar
                                        </span>
                                    )}
                                </button>
                            );
                        }))}

                        {pestana === 'descartados' && (descartes.length === 0 ? (
                            <Vacio texto="No hay siglas descartadas." />
                        ) : descartes.map(d => (
                            <div key={d.id} className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center justify-between gap-3">
                                <span className="font-mono font-bold text-gray-300">{d.tag}</span>
                                <button onClick={() => recuperarSiglas(d.tag)} className="text-xs text-orange-300 hover:text-orange-200">
                                    Volver a proponer
                                </button>
                            </div>
                        )))}
                    </div>

                    {/* ── Panel ── */}
                    {!form ? (
                        <div className="bg-white/5 border border-white/10 rounded-xl p-8 text-center text-gray-400">
                            <div className="text-5xl mb-3">🛡️</div>
                            <p className="text-sm">Elige unas siglas sugeridas o un equipo confirmado para revisarlo.</p>
                        </div>
                    ) : (
                        <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-white/20 rounded-xl p-5 space-y-5">
                            <div className="flex items-center justify-between gap-3">
                                <h3 className="text-xl font-bold text-white">{form.id ? 'Editar equipo' : 'Confirmar equipo'}</h3>
                                <button onClick={cerrar} className="text-gray-400 hover:text-white text-sm">Cerrar ✕</button>
                            </div>

                            <div className="grid sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-3">
                                <div>
                                    <label className="block text-xs text-gray-400 mb-1">Nombre real del equipo (qué significan las siglas)</label>
                                    <input className={inputCls} value={form.name} placeholder="Ej.: Hispania GT"
                                        onChange={e => cambiar('name', e.target.value)} />
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-400 mb-1">Siglas</label>
                                    <input className={`${inputCls} font-mono uppercase`} value={form.tag}
                                        onChange={e => cambiar('tag', e.target.value.toUpperCase())} />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs text-gray-400 mb-1">Variantes con las que aparecen en los GT7 ID</label>
                                <div className="flex flex-wrap items-center gap-2">
                                    {(form.tagVariants || []).map(v => (
                                        <span key={v} className="font-mono text-sm bg-white/10 text-gray-200 pl-2 pr-1 py-0.5 rounded flex items-center gap-1">
                                            {v}
                                            <button onClick={() => cambiar('tagVariants', form.tagVariants.filter(x => x !== v))}
                                                className="text-gray-500 hover:text-red-300 px-1" aria-label={`Quitar ${v}`}>×</button>
                                        </span>
                                    ))}
                                    <input className="px-2 py-1 bg-white/10 border border-white/20 rounded text-white text-sm font-mono w-28"
                                        placeholder="+ variante" value={nuevaVariante}
                                        onChange={e => setNuevaVariante(e.target.value)}
                                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); anadirVariante(); } }} />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs text-gray-400 mb-1">Color (se usa si no hay avatar)</label>
                                <div className="flex flex-wrap items-center gap-2">
                                    {COLORES.map(c => (
                                        <button key={c} onClick={() => cambiar('color', c)} aria-label={`Color ${c}`}
                                            className={`w-7 h-7 rounded-md border-2 ${form.color === c ? 'border-white' : 'border-transparent'}`}
                                            style={{ backgroundColor: c }} />
                                    ))}
                                    <input type="color" value={form.color} onChange={e => cambiar('color', e.target.value)}
                                        className="w-9 h-7 bg-transparent cursor-pointer" aria-label="Otro color" />
                                </div>
                            </div>

                            <div className="grid sm:grid-cols-[auto_minmax(0,1fr)] gap-4">
                                <div>
                                    <label className="block text-xs text-gray-400 mb-1">Avatar</label>
                                    <label className="block cursor-pointer">
                                        <TeamAvatar team={form} size="xl" />
                                        <input type="file" accept="image/*" className="hidden" disabled={!!subiendo}
                                            onChange={e => subirImagen('avatarUrl', e.target.files?.[0])} />
                                        <span className="block text-xs text-orange-300 mt-1">{subiendo === 'avatarUrl' ? 'Subiendo…' : form.avatarUrl ? 'Cambiar' : 'Subir'}</span>
                                    </label>
                                    {form.avatarUrl && (
                                        <button onClick={() => cambiar('avatarUrl', '')} className="text-xs text-gray-500 hover:text-red-300">Quitar</button>
                                    )}
                                </div>
                                <div className="min-w-0">
                                    <label className="block text-xs text-gray-400 mb-1">Banner</label>
                                    <label className="block cursor-pointer">
                                        <div className="h-24 rounded-lg border border-white/20 overflow-hidden bg-black/30 flex items-center justify-center"
                                            style={!form.bannerUrl ? { background: `linear-gradient(110deg, ${form.color}99, rgba(15,23,42,.4))` } : undefined}>
                                            {form.bannerUrl
                                                // eslint-disable-next-line @next/next/no-img-element
                                                ? <img src={form.bannerUrl} alt="Banner" className="w-full h-full object-cover" />
                                                : <span className="text-xs text-white/80">{subiendo === 'bannerUrl' ? 'Subiendo…' : 'Subir banner'}</span>}
                                        </div>
                                        <input type="file" accept="image/*" className="hidden" disabled={!!subiendo}
                                            onChange={e => subirImagen('bannerUrl', e.target.files?.[0])} />
                                    </label>
                                    {form.bannerUrl && (
                                        <button onClick={() => cambiar('bannerUrl', '')} className="text-xs text-gray-500 hover:text-red-300 mt-1">Quitar banner</button>
                                    )}
                                </div>
                            </div>
                            <div className="-mt-3">
                                <ImageSpecHint spec="teamAvatar" />
                                <ImageSpecHint spec="teamBanner" className="mt-1" />
                            </div>

                            <div>
                                <label className="block text-xs text-gray-400 mb-1">Descripción (opcional)</label>
                                <textarea className={`${inputCls} text-sm`} rows={2} value={form.description}
                                    onChange={e => cambiar('description', e.target.value)} />
                            </div>

                            {/* ── Pilotos ── */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs text-gray-400">Pilotos · decide cada uno</span>
                                    <span className="text-xs text-gray-500">
                                        {filas.filter(f => f.estado === 'miembro').length} miembros
                                    </span>
                                </div>
                                {filas.length === 0 && (
                                    <p className="text-sm text-gray-500 py-2">Busca pilotos abajo para añadirlos.</p>
                                )}
                                <div className="divide-y divide-white/5">
                                    {filas.map(f => (
                                        <div key={f.pilot} className="py-3 space-y-2">
                                            <div className="flex flex-wrap items-start justify-between gap-2">
                                                <div className="min-w-0">
                                                    <div className="text-white font-semibold break-all">{f.pilot}</div>
                                                    {f.nombres.filter(n => n !== f.pilot).length > 0 && (
                                                        <div className="text-xs text-gray-500 font-mono break-all">
                                                            también como {f.nombres.filter(n => n !== f.pilot).join(' · ')}
                                                        </div>
                                                    )}
                                                </div>
                                                <select value={f.estado} onChange={e => ponerEstado(f, e.target.value)}
                                                    className={`text-sm rounded-lg px-2 py-1 border bg-slate-800 ${f.estado === 'miembro' ? 'border-green-400/50 text-green-300'
                                                        : f.estado === 'noEs' ? 'border-red-400/40 text-red-300'
                                                            : f.estado === 'exMiembro' ? 'border-white/20 text-gray-300'
                                                                : 'border-amber-400/40 text-amber-300'}`}>
                                                    {Object.entries(ESTADOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                                                </select>
                                            </div>
                                            {f.aviso && <p className="text-xs text-amber-300">⚠️ {f.aviso}</p>}
                                            {(f.estado === 'miembro' || f.estado === 'exMiembro') && (
                                                <div className="flex flex-wrap items-center gap-2 text-xs text-gray-400">
                                                    <span>Desde</span>
                                                    <input type="date" value={f.from || ''} onChange={e => cambiarFila(f.pilot, { from: e.target.value })}
                                                        className="bg-white/10 border border-white/20 rounded px-2 py-1 text-white" />
                                                    {f.estado === 'exMiembro' && (
                                                        <>
                                                            <span>hasta</span>
                                                            <input type="date" value={f.to || ''} onChange={e => cambiarFila(f.pilot, { to: e.target.value })}
                                                                className="bg-white/10 border border-white/20 rounded px-2 py-1 text-white" />
                                                        </>
                                                    )}
                                                    <span className="text-gray-500">· {f.source === 'siglas' ? 'por siglas' : 'añadido a mano'}</span>
                                                </div>
                                            )}
                                            {f.estado === 'noEs' && (
                                                <input value={f.nota} onChange={e => cambiarFila(f.pilot, { nota: e.target.value })}
                                                    placeholder="Nota (opcional): p. ej. ahora en RRT"
                                                    className="w-full px-2 py-1 bg-white/5 border border-white/10 rounded text-sm text-gray-200 placeholder-gray-500" />
                                            )}
                                        </div>
                                    ))}
                                </div>

                                <div className="mt-3">
                                    <input className={inputCls} value={busqueda} onChange={e => setBusqueda(e.target.value)}
                                        placeholder="🔍 Añadir piloto (también sin siglas): buscar por GT7 ID…" />
                                    {resultadosBusqueda.length > 0 && (
                                        <div className="flex flex-wrap gap-2 mt-2">
                                            {resultadosBusqueda.map(p => (
                                                <button key={p} onClick={() => anadirManual(p)}
                                                    className="text-sm px-2 py-1 rounded bg-white/10 text-gray-200 hover:bg-white/20">
                                                    + {p}{equipoDe[p] && equipoDe[p].id !== form.id ? <span className="text-gray-500"> ({equipoDe[p].tag})</span> : null}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {conflictos.length > 0 && (
                                <div className="bg-red-500/10 border border-red-400/40 rounded-lg p-3 text-sm text-red-300">
                                    Un piloto no puede estar en dos equipos a la vez: {conflictos.join(', ')}.
                                    Márcalo como ex-miembro en su otro equipo, o aquí como «No es del equipo».
                                </div>
                            )}
                            {filas.some(f => f.estado === 'pendiente') && (
                                <p className="text-xs text-gray-400">
                                    Los pilotos «Sin decidir» no se guardan y se volverán a proponer.
                                </p>
                            )}

                            <div className="flex flex-wrap gap-2 justify-end pt-2 border-t border-white/10">
                                {form.id ? (
                                    <button onClick={eliminar} className="mr-auto text-sm text-red-300 hover:text-red-200 px-3 py-2">Eliminar equipo</button>
                                ) : claveSiglas(form.tag) && sugeridos.some(g => g.tag === claveSiglas(form.tag)) ? (
                                    <button onClick={() => descartarSiglas(claveSiglas(form.tag))}
                                        className="mr-auto text-sm text-red-300 bg-red-500/10 border border-red-400/30 hover:bg-red-500/20 rounded-lg px-3 py-2">
                                        No es un equipo
                                    </button>
                                ) : null}
                                <button onClick={cerrar} className="bg-white/10 hover:bg-white/20 border border-white/20 text-gray-200 px-4 py-2 rounded-lg text-sm font-semibold">
                                    Cancelar
                                </button>
                                <button onClick={guardar} disabled={guardando || !!subiendo || conflictos.length > 0}
                                    className="bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white px-4 py-2 rounded-lg text-sm font-bold disabled:opacity-50">
                                    {guardando ? 'Guardando…' : form.id ? 'Guardar cambios' : 'Crear equipo'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function Vacio({ texto }) {
    return <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-center text-gray-400 text-sm">{texto}</div>;
}
