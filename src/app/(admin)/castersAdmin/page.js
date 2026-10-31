"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../context/AuthContext";
import { FirebaseService } from "../../services/firebaseService";
import { PLATAFORMAS, detectarPlataforma, normalizarEnlace, redesDe, estiloRed } from "../../utils/casterLinks";
import { validateImageFile, compressImage } from "../../utils/imageCompression";
import ImageSpecHint from "../../components/common/ImageSpecHint";
import LoadingSkeleton from "../../components/common/LoadingSkeleton";

/**
 * Zona Caster — solo Administrador de Plataforma.
 *
 * Alta y edición de los casters que aparecen en /zona-caster: nombre, banner
 * y la lista de sus redes (Twitch, YouTube, Kick… u otra web cualquiera). Un
 * caster desactivado se conserva aquí pero no sale en la página pública.
 */

const VACIO = { name: '', bannerUrl: '', redes: [], active: true };
const filaVacia = () => ({ plataforma: 'twitch', url: '', etiqueta: '' });

export default function CastersAdminPage() {
    const router = useRouter();
    const { currentUser, isPlatformOwner, loading: authLoading } = useAuth();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [casters, setCasters] = useState([]);
    const [form, setForm] = useState(null);
    const [guardando, setGuardando] = useState(false);
    const [subiendo, setSubiendo] = useState(false);
    // Banner tal como estaba guardado al abrir el formulario: si se cambia o
    // se quita, se borra de Storage al guardar.
    const [bannerGuardado, setBannerGuardado] = useState('');
    // Subidas de esta edición aún sin guardar: se borran si se cancela.
    const subidasSinGuardar = useRef([]);
    const panelRef = useRef(null);

    useEffect(() => {
        if (!authLoading && !currentUser) router.push('/login');
    }, [currentUser, authLoading, router]);

    useEffect(() => { cargar(); }, []);

    const cargar = async () => {
        try {
            setLoading(true);
            const lista = await FirebaseService.getCasters();
            setCasters([...lista].sort((a, b) => a.name.localeCompare(b.name, 'es')));
        } catch (e) {
            setError('No se pudieron cargar los casters: ' + e.message);
        } finally {
            setLoading(false);
        }
    };

    const abrir = (caster) => {
        descartarSubidas();
        setError('');
        const redes = caster ? redesDe(caster).map(r => ({ ...r })) : [];
        setForm({ ...VACIO, ...(caster || {}), redes: redes.length ? redes : [filaVacia()] });
        setBannerGuardado(caster?.bannerUrl || '');
        setTimeout(() => panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    };

    const descartarSubidas = () => {
        subidasSinGuardar.current.forEach(url => FirebaseService.deleteCasterImageIfUnused(url));
        subidasSinGuardar.current = [];
    };

    const cerrar = () => {
        descartarSubidas();
        setForm(null);
        setError('');
    };

    const cambiar = (campo, valor) => setForm(f => ({ ...f, [campo]: valor }));

    const cambiarRed = (i, cambios) => setForm(f => ({
        ...f,
        redes: f.redes.map((r, j) => {
            if (j !== i) return r;
            const nueva = { ...r, ...cambios };
            // Al pegar un enlace de una plataforma conocida, se elige sola
            if ('url' in cambios) {
                const detectada = detectarPlataforma(cambios.url);
                if (detectada) nueva.plataforma = detectada;
            }
            return nueva;
        }),
    }));
    const anadirRed = () => setForm(f => ({ ...f, redes: [...f.redes, filaVacia()] }));
    const quitarRed = (i) => setForm(f => ({ ...f, redes: f.redes.filter((_, j) => j !== i) }));

    const subirBanner = async (file) => {
        if (!file) return;
        try {
            setSubiendo(true);
            validateImageFile(file);
            const comprimida = await compressImage(file);
            const { url, reused } = await FirebaseService.uploadImageDeduped(comprimida, 'casters', `${form.name || 'caster'}-banner.png`);
            const anterior = form.bannerUrl;
            cambiar('bannerUrl', url);
            if (!reused) subidasSinGuardar.current.push(url);
            quitarSubida(anterior, url);
        } catch (e) {
            setError('No se pudo subir la imagen: ' + e.message);
        } finally {
            setSubiendo(false);
        }
    };

    // La subida sustituida antes de guardar ya no la va a usar nadie.
    const quitarSubida = (url, enUso = '') => {
        if (!url || !subidasSinGuardar.current.includes(url)) return;
        subidasSinGuardar.current = subidasSinGuardar.current.filter(u => u !== url);
        FirebaseService.deleteCasterImageIfUnused(url, [enUso].filter(Boolean));
    };

    const quitarBanner = () => {
        const anterior = form.bannerUrl;
        cambiar('bannerUrl', '');
        quitarSubida(anterior);
    };

    const guardar = async () => {
        setError('');
        try {
            setGuardando(true);
            await FirebaseService.saveCaster(form, currentUser?.email || '');
            subidasSinGuardar.current = subidasSinGuardar.current.filter(u => u !== form.bannerUrl);
            if (bannerGuardado && bannerGuardado !== form.bannerUrl) {
                await FirebaseService.deleteCasterImageIfUnused(bannerGuardado, [form.bannerUrl]);
            }
            cerrar();
            await cargar();
        } catch (e) {
            setError(e.message);
        } finally {
            setGuardando(false);
        }
    };

    const eliminar = async () => {
        if (!form?.id) return;
        if (!confirm(`¿Eliminar a ${form.name} de la Zona Caster?`)) return;
        try {
            await FirebaseService.deleteCaster(form.id);
            for (const url of [bannerGuardado, form.bannerUrl]) {
                if (url) await FirebaseService.deleteCasterImageIfUnused(url);
            }
            cerrar();
            await cargar();
        } catch (e) {
            setError('No se pudo eliminar: ' + e.message);
        }
    };

    const alternarActivo = async (caster) => {
        try {
            await FirebaseService.saveCaster({ ...caster, active: caster.active === false }, currentUser?.email || '');
            await cargar();
        } catch (e) {
            setError(e.message);
        }
    };

    if (authLoading) return <div className="p-8 text-gray-400 text-sm">Cargando…</div>;
    if (!currentUser || !isPlatformOwner()) {
        return <div className="p-8 text-gray-400 text-sm">Acceso denegado. Esta sección solo la administra el Administrador de Plataforma.</div>;
    }
    if (loading) return <LoadingSkeleton variant="page" message="Cargando casters..." />;

    const inputCls = "w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500";

    // Aviso en vivo de un enlace mal escrito, antes de pulsar Guardar
    const avisoEnlace = (red) => {
        try { normalizarEnlace(red.plataforma, red.url); return ''; } catch (e) { return e.message; }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 p-4 sm:p-8">
            <div className="max-w-7xl mx-auto">
                <div className="mb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white">🎙️ Zona Caster</h1>
                        <p className="text-gray-300 text-sm sm:text-base mt-2">
                            Los casters que salen en la página pública, con su banner y sus redes.
                        </p>
                        <p className="text-gray-400 text-xs mt-2 max-w-3xl">
                            En la web se muestran en un orden distinto en cada visita. Un caster desactivado se
                            conserva aquí, pero no aparece en la página pública.
                        </p>
                    </div>
                    <div className="flex gap-2 self-start sm:self-auto">
                        <a href="/zona-caster" target="_blank" rel="noopener noreferrer"
                            className="bg-white/10 hover:bg-white/20 border border-white/30 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all">
                            Ver página ↗
                        </a>
                        <button onClick={() => abrir(null)}
                            className="bg-orange-600 hover:bg-orange-500 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all">
                            + Añadir caster
                        </button>
                    </div>
                </div>

                {error && !form && (
                    <div className="mb-4 bg-red-500/10 border border-red-400/30 text-red-300 rounded-lg px-4 py-3 text-sm">{error}</div>
                )}

                <div className="grid lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-6 items-start">
                    {/* ── Lista ── */}
                    <div>
                        {casters.length === 0 ? (
                            <div className="bg-white/5 border border-white/10 rounded-xl p-8 text-center text-gray-400 text-sm">
                                Aún no hay casters. Pulsa «Añadir caster» para crear el primero.
                            </div>
                        ) : (
                            <ul className="grid sm:grid-cols-2 gap-4">
                                {casters.map(c => (
                                    <li key={c.id}
                                        className={`bg-white/5 border rounded-xl overflow-hidden transition-colors ${form?.id === c.id ? 'border-orange-500' : 'border-white/10'} ${c.active === false ? 'opacity-60' : ''}`}>
                                        <button onClick={() => abrir(c)} className="block w-full text-left">
                                            <div className="aspect-video bg-black/40">
                                                {c.bannerUrl
                                                    ? <img src={c.bannerUrl} alt="" className="w-full h-full object-cover" />
                                                    : <div className="w-full h-full flex items-center justify-center text-4xl">🎙️</div>}
                                            </div>
                                            <div className="p-3">
                                                <p className="text-white font-semibold truncate">{c.name}</p>
                                                <p className="text-xs text-gray-400 mt-1">
                                                    {redesDe(c).map(r => estiloRed(r).etiqueta).join(' · ') || 'Sin redes'}
                                                </p>
                                            </div>
                                        </button>
                                        <div className="px-3 pb-3 flex items-center justify-between">
                                            <span className={`text-xs ${c.active === false ? 'text-gray-500' : 'text-green-400'}`}>
                                                {c.active === false ? 'Oculto' : 'Visible'}
                                            </span>
                                            <button onClick={() => alternarActivo(c)} className="text-xs text-orange-300 hover:text-orange-200">
                                                {c.active === false ? 'Mostrar' : 'Ocultar'}
                                            </button>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    {/* ── Formulario ── */}
                    <div ref={panelRef} className="lg:sticky lg:top-4">
                        {form ? (
                            <div className="bg-white/5 border border-white/10 rounded-xl p-4 sm:p-5 space-y-4">
                                <div className="flex items-center justify-between">
                                    <h2 className="text-lg font-bold text-white">{form.id ? 'Editar caster' : 'Nuevo caster'}</h2>
                                    <button onClick={cerrar} className="text-gray-400 hover:text-white text-sm">Cerrar ✕</button>
                                </div>

                                <div>
                                    <label className="block text-xs text-gray-400 mb-1">Nombre <span className="text-red-300">*</span></label>
                                    <input value={form.name} onChange={e => cambiar('name', e.target.value)} className={inputCls} placeholder="Nombre del caster o del canal" />
                                </div>

                                <div>
                                    <label className="block text-xs text-gray-400 mb-1">Banner</label>
                                    <div className="aspect-video bg-black/40 rounded-lg overflow-hidden border border-white/10">
                                        {form.bannerUrl
                                            ? <img src={form.bannerUrl} alt="" className="w-full h-full object-cover" />
                                            : <div className="w-full h-full flex items-center justify-center text-gray-500 text-sm">Sin banner</div>}
                                    </div>
                                    <div className="flex items-center gap-3 mt-2">
                                        <label className="cursor-pointer text-xs text-orange-300 hover:text-orange-200">
                                            <input type="file" accept="image/*" className="hidden" disabled={subiendo}
                                                onChange={e => { subirBanner(e.target.files?.[0]); e.target.value = ''; }} />
                                            {subiendo ? 'Subiendo…' : form.bannerUrl ? 'Cambiar banner' : 'Subir banner'}
                                        </label>
                                        {form.bannerUrl && (
                                            <button onClick={quitarBanner} className="text-xs text-gray-500 hover:text-red-300">Quitar banner</button>
                                        )}
                                    </div>
                                    <ImageSpecHint spec="casterBanner" className="mt-1" />
                                </div>

                                <div>
                                    <label className="block text-xs text-gray-400 mb-1">Redes y plataformas</label>
                                    <p className="text-xs text-gray-500 mb-2">
                                        Pega el enlace al perfil (la plataforma se reconoce sola) o elige la plataforma y escribe
                                        el usuario. Para cualquier otra web, usa «Otra» y ponle nombre.
                                    </p>
                                    <div className="space-y-2">
                                        {form.redes.map((r, i) => {
                                            const aviso = avisoEnlace(r);
                                            const plat = PLATAFORMAS.find(p => p.id === r.plataforma);
                                            return (
                                                <div key={i} className="bg-black/20 border border-white/10 rounded-lg p-2">
                                                    <div className="flex flex-wrap sm:flex-nowrap gap-2">
                                                        <select value={r.plataforma} onChange={e => cambiarRed(i, { plataforma: e.target.value })}
                                                            className={`${inputCls} sm:w-36 shrink-0`}>
                                                            {PLATAFORMAS.map(p => <option key={p.id} value={p.id} className="bg-slate-800">{p.etiqueta}</option>)}
                                                        </select>
                                                        <input value={r.url} onChange={e => cambiarRed(i, { url: e.target.value })}
                                                            className={`${inputCls} min-w-0 flex-1 ${aviso ? 'border-red-400/60' : ''}`}
                                                            placeholder={plat?.base ? `Enlace o ${plat.arroba ? '@' : ''}usuario` : 'https://…'} />
                                                        <button onClick={() => quitarRed(i)} title="Quitar"
                                                            className="px-2 text-gray-500 hover:text-red-300 shrink-0">✕</button>
                                                    </div>
                                                    {r.plataforma === 'otra' && (
                                                        <input value={r.etiqueta} onChange={e => cambiarRed(i, { etiqueta: e.target.value })}
                                                            className={`${inputCls} mt-2`} placeholder="Nombre que sale en el botón (ej. Rumble, Web)" />
                                                    )}
                                                    {aviso && <p className="text-xs text-red-300 mt-1">{aviso}</p>}
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <button onClick={anadirRed} className="mt-2 text-xs text-orange-300 hover:text-orange-200">+ Añadir red</button>
                                </div>

                                <label className="flex items-center gap-2 text-sm text-gray-200">
                                    <input type="checkbox" checked={form.active !== false} onChange={e => cambiar('active', e.target.checked)} />
                                    Visible en la Zona Caster
                                </label>

                                {error && (
                                    <div className="bg-red-500/10 border border-red-400/30 text-red-300 rounded-lg px-3 py-2 text-sm">{error}</div>
                                )}

                                <div className="flex flex-wrap gap-2 justify-between pt-2">
                                    {form.id ? (
                                        <button onClick={eliminar} className="text-sm text-red-300 hover:text-red-200">Eliminar</button>
                                    ) : <span />}
                                    <div className="flex gap-2">
                                        <button onClick={cerrar} className="px-4 py-2 rounded-lg text-sm text-gray-300 hover:text-white">Cancelar</button>
                                        <button onClick={guardar} disabled={guardando || subiendo}
                                            className="bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-semibold">
                                            {guardando ? 'Guardando…' : 'Guardar'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-white/5 border border-dashed border-white/15 rounded-xl p-6 text-center text-gray-400 text-sm">
                                Elige un caster para editarlo o añade uno nuevo.
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
