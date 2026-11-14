"use client";
import { useEffect, useRef, useState } from 'react';
import { FirebaseService } from '../../services/firebaseService';
import { useI18n } from '../../i18n';
import { construirPromptPodio, ESTADO_IMAGEN } from '../../utils/podiumImages';

const MEDALLAS = { 1: '🥇', 2: '🥈', 3: '🥉' };
const MAX_BYTES = 5 * 1024 * 1024; // límite de storage.rules

/**
 * Pestaña «Imágenes»: la imagen de campeones de cada sala terminada.
 *
 * El público ve las imágenes ya listas. El administrador, en cada sala que
 * acaba de terminar, elige entre generarla con IA o subir una propia (no se
 * genera nada sin que lo pida: cada imagen de Gemini cuesta dinero).
 * Los controles de administración van en español, como el resto del admin.
 *
 * @param {Array} salas  [{ key, name, color, terminada, podium }]
 * @param {Array} images documentos de championships/{id}/podiumImages
 */
export default function PodiumImagesTab({ championshipId, championship, salas = [], images = [], esAdmin = false, onChange }) {
    const { t } = useI18n();
    const im = (clave, vars) => t(`campeonato.imagenes.${clave}`, vars);
    const porClave = Object.fromEntries(images.map(i => [i.id, i]));
    const generando = images.some(i => i.status === ESTADO_IMAGEN.GENERANDO);

    // Mientras la IA trabaja, se vuelve a leer cada pocos segundos
    useEffect(() => {
        if (!generando || !onChange) return undefined;
        const id = setInterval(onChange, 5000);
        return () => clearInterval(id);
    }, [generando, onChange]);

    const visibles = salas.filter(s => porClave[s.key]?.imageUrl || (esAdmin && (s.terminada || porClave[s.key])));

    if (visibles.length === 0) {
        return (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-10 text-center">
                <div className="text-5xl mb-3">🖼️</div>
                <p className="text-gray-300">{im('vacio')}</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-white">{im('titulo')}</h2>
            <div className="grid md:grid-cols-2 gap-6">
                {visibles.map(sala => (
                    <TarjetaSala
                        key={sala.key}
                        sala={sala}
                        imagen={porClave[sala.key]}
                        championshipId={championshipId}
                        championship={championship}
                        esAdmin={esAdmin}
                        onChange={onChange}
                        im={im}
                    />
                ))}
            </div>
        </div>
    );
}

function TarjetaSala({ sala, imagen, championshipId, championship, esAdmin, onChange, im }) {
    const [ocupado, setOcupado] = useState(false);
    const [error, setError] = useState('');
    const [copiado, setCopiado] = useState(false);
    const archivo = useRef(null);

    // Datos que se guardan con la imagen: el podio queda fijo aunque la
    // rotación cambie después a los pilotos de sala.
    const podium = imagen?.podium?.length ? imagen.podium : sala.podium;
    const datos = {
        salaName: sala.name || '',
        color: sala.color || '',
        championshipName: championship?.name || '',
        podium,
    };
    const titulo = sala.name ? im('sala', { nombre: sala.name }) : im('campeones');
    const estado = imagen?.status;

    const accion = async (fn) => {
        setOcupado(true);
        setError('');
        try {
            await fn();
            if (onChange) await onChange();
        } catch (e) {
            setError(e.message || String(e));
        } finally {
            setOcupado(false);
        }
    };

    const generar = () => {
        if (!window.confirm(`¿Generar con IA la imagen de campeones${sala.name ? ` de la sala ${sala.name}` : ''}?\n\nCada imagen tiene un coste en Gemini. Tarda alrededor de un minuto.`)) return;
        accion(() => FirebaseService.requestPodiumImage(championshipId, sala.key, datos));
    };

    const subir = (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        if (!file.type.startsWith('image/')) { setError('El archivo tiene que ser una imagen.'); return; }
        if (file.size > MAX_BYTES) { setError('La imagen pesa más de 5 MB: redúcela o expórtala como JPG.'); return; }
        accion(() => FirebaseService.uploadPodiumImage(championshipId, sala.key, file, datos));
    };

    const quitar = () => {
        if (!window.confirm('¿Quitar esta imagen de la pestaña? Podrás generar o subir otra.')) return;
        accion(() => FirebaseService.deletePodiumImage(championshipId, sala.key));
    };

    const copiarPrompt = async () => {
        try {
            await navigator.clipboard.writeText(construirPromptPodio(datos));
            setCopiado(true);
            setTimeout(() => setCopiado(false), 2000);
        } catch {
            setError('No se pudo copiar el prompt al portapapeles.');
        }
    };

    return (
        <article className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
            <header className="flex items-center gap-2 px-4 py-3 border-b border-white/10">
                {sala.color && <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: sala.color }} aria-hidden="true" />}
                <h3 className="text-white font-bold">{titulo}</h3>
            </header>

            {imagen?.imageUrl && estado !== ESTADO_IMAGEN.GENERANDO ? (
                <a href={imagen.imageUrl} target="_blank" rel="noopener noreferrer" className="block bg-black/30">
                    {/* eslint-disable-next-line @next/next/no-img-element -- export estático: sin optimizador de imágenes */}
                    <img src={imagen.imageUrl} alt={im('alt', { sala: titulo })} loading="lazy" className="w-full aspect-square object-cover" />
                </a>
            ) : estado === ESTADO_IMAGEN.GENERANDO ? (
                <div className="aspect-square flex flex-col items-center justify-center gap-3 bg-black/30 text-gray-300" role="status">
                    <div className="w-10 h-10 border-4 border-white/20 border-t-orange-500 rounded-full animate-spin" aria-hidden="true" />
                    <p className="text-sm">{im('generando')}</p>
                </div>
            ) : esAdmin ? (
                <div className="p-5 bg-orange-500/10 border-b border-orange-500/20">
                    <p className="text-white font-semibold">
                        {sala.name ? `🏁 La sala ${sala.name} ha terminado.` : '🏁 El campeonato ha terminado.'}
                    </p>
                    <p className="text-gray-300 text-sm mt-1">¿Cómo quieres crear la imagen de campeones?</p>
                    {estado === ESTADO_IMAGEN.ERROR && (
                        <p className="text-red-300 text-xs mt-2" role="alert">La IA falló: {imagen.error}</p>
                    )}
                </div>
            ) : null}

            <div className="p-4 space-y-3">
                <ol className="space-y-1">
                    {(podium || []).map(p => (
                        <li key={p.pos} className="flex items-center gap-2 text-sm">
                            <span aria-hidden="true">{MEDALLAS[p.pos]}</span>
                            <span className="text-white font-medium truncate">{p.name}</span>
                            <span className="ml-auto text-orange-300 font-bold whitespace-nowrap">{im('puntos', { n: p.points })}</span>
                        </li>
                    ))}
                </ol>

                {imagen?.imageUrl && estado !== ESTADO_IMAGEN.GENERANDO && (
                    <a href={imagen.imageUrl} download target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-sm text-blue-300 hover:text-blue-200">
                        ⬇️ {im('descargar')}
                    </a>
                )}

                {esAdmin && estado !== ESTADO_IMAGEN.GENERANDO && (
                    <div className="pt-3 border-t border-white/10 space-y-2">
                        <div className="flex flex-wrap gap-2">
                            <button type="button" onClick={generar} disabled={ocupado}
                                className="px-3 py-2 rounded-lg text-sm font-semibold bg-orange-600 hover:bg-orange-700 text-white disabled:opacity-50">
                                ✨ {imagen?.imageUrl ? 'Regenerar con IA' : 'Generar con IA'}
                            </button>
                            <button type="button" onClick={() => archivo.current?.click()} disabled={ocupado}
                                className="px-3 py-2 rounded-lg text-sm font-semibold bg-white/10 hover:bg-white/20 text-white disabled:opacity-50">
                                ⬆️ {imagen?.imageUrl ? 'Cambiar imagen' : 'Subir imagen'}
                            </button>
                            <button type="button" onClick={copiarPrompt}
                                className="px-3 py-2 rounded-lg text-sm bg-white/5 hover:bg-white/10 text-gray-200">
                                {copiado ? '✅ Copiado' : '📋 Copiar prompt'}
                            </button>
                            {imagen && (
                                <button type="button" onClick={quitar} disabled={ocupado}
                                    className="px-3 py-2 rounded-lg text-sm bg-red-900/30 hover:bg-red-800/50 text-red-200 disabled:opacity-50">
                                    🗑️ Quitar
                                </button>
                            )}
                        </div>
                        <input ref={archivo} type="file" accept="image/png,image/jpeg,image/webp" onChange={subir} className="hidden" aria-label="Subir imagen de campeones" />
                        {ocupado && <p className="text-gray-400 text-xs" role="status">⏳ Guardando…</p>}
                        {error && <p className="text-red-300 text-xs" role="alert">❌ {error}</p>}
                        <p className="text-gray-500 text-xs">«Copiar prompt» te da el texto para generarla tú mismo fuera de la web y subirla después.</p>
                    </div>
                )}
            </div>
        </article>
    );
}
