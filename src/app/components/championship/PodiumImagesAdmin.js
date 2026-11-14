"use client";
import { useEffect, useRef, useState } from 'react';
import { FirebaseService } from '../../services/firebaseService';
import { construirPromptPodio, ESTADO_IMAGEN, salasConPodio } from '../../utils/podiumImages';
import { CabeceraSala, ListaPodio, imagenLista } from './PodiumImagesTab';

const MAX_BYTES = 5 * 1024 * 1024; // límite de storage.rules
const puntos = (n) => `${n} pts`;

/**
 * Pestaña «Imágenes» del panel de administración: en cada sala terminada,
 * el administrador elige entre generar la imagen de campeones con IA o
 * subir una propia. Nada se genera sin pedirlo: cada imagen de Gemini
 * cuesta dinero. La web pública solo muestra el resultado (PodiumImagesTab).
 *
 * @param {Array}    images   documentos de championships/{id}/podiumImages
 * @param {Function} onChange vuelve a leer las imágenes
 */
export default function PodiumImagesAdmin({ championshipId, championship, teams, tracks, penalties, divisions, declarations, images = [], onChange }) {
    const [identidades, setIdentidades] = useState(null);

    useEffect(() => {
        FirebaseService.getPilotIdentities().then(setIdentidades).catch(() => setIdentidades([]));
    }, []);

    const generando = images.some(i => i.status === ESTADO_IMAGEN.GENERANDO);
    // Mientras la IA trabaja, se vuelve a leer cada pocos segundos
    useEffect(() => {
        if (!generando || !onChange) return undefined;
        const id = setInterval(onChange, 5000);
        return () => clearInterval(id);
    }, [generando, onChange]);

    if (identidades === null) {
        return <p className="text-gray-300">Cargando clasificaciones…</p>;
    }

    const porClave = Object.fromEntries(images.map(i => [i.id, i]));
    const salas = salasConPodio({ championship, teams, tracks, penalties, divisions, pilotIdentities: identidades, declarations });
    const visibles = salas.filter(s => s.terminada || porClave[s.key]);
    const enCurso = salas.filter(s => !s.terminada && !porClave[s.key]);

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-white">🖼️ Imágenes de campeones</h2>
                <p className="text-gray-300 text-sm mt-1">
                    Cuando una sala corre todas sus carreras, aquí eliges cómo crear su imagen. En la web pública
                    los pilotos solo ven la imagen y pueden descargarla.
                </p>
            </div>

            {visibles.length === 0 ? (
                <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center text-gray-300">
                    Ninguna sala ha terminado todavía.
                </div>
            ) : (
                <div className="grid md:grid-cols-2 gap-6">
                    {visibles.map(sala => (
                        <TarjetaSala key={sala.key} sala={sala} imagen={porClave[sala.key]}
                            championshipId={championshipId} championship={championship} onChange={onChange} />
                    ))}
                </div>
            )}

            {enCurso.length > 0 && (
                <p className="text-gray-400 text-sm">
                    En curso: {enCurso.map(s => s.name ? `Sala ${s.name}` : 'el campeonato').join(', ')}. Su imagen se podrá crear al terminar.
                </p>
            )}
        </div>
    );
}

function TarjetaSala({ sala, imagen, championshipId, championship, onChange }) {
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
    const titulo = sala.name ? `Sala ${sala.name}` : 'Campeones';
    const estado = imagen?.status;
    const lista = imagenLista(imagen);

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
        if (!window.confirm('¿Quitar esta imagen? Dejará de verse en la web pública y podrás generar o subir otra.')) return;
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
            <CabeceraSala color={sala.color} titulo={titulo} />

            {lista ? (
                <a href={imagen.imageUrl} target="_blank" rel="noopener noreferrer" className="block bg-black/30">
                    {/* eslint-disable-next-line @next/next/no-img-element -- export estático: sin optimizador de imágenes */}
                    <img src={imagen.imageUrl} alt={`Imagen de campeones de ${titulo}`} loading="lazy" className="w-full aspect-square object-cover" />
                </a>
            ) : estado === ESTADO_IMAGEN.GENERANDO ? (
                <div className="aspect-square flex flex-col items-center justify-center gap-3 bg-black/30 text-gray-300" role="status">
                    <div className="w-10 h-10 border-4 border-white/20 border-t-orange-500 rounded-full animate-spin" aria-hidden="true" />
                    <p className="text-sm">Generando la imagen…</p>
                </div>
            ) : (
                <div className="p-5 bg-orange-500/10 border-b border-orange-500/20">
                    <p className="text-white font-semibold">
                        {sala.name ? `🏁 La sala ${sala.name} ha terminado.` : '🏁 El campeonato ha terminado.'}
                    </p>
                    <p className="text-gray-300 text-sm mt-1">¿Cómo quieres crear la imagen de campeones?</p>
                    {estado === ESTADO_IMAGEN.ERROR && (
                        <p className="text-red-300 text-xs mt-2" role="alert">La IA falló: {imagen.error}</p>
                    )}
                </div>
            )}

            <div className="p-4 space-y-3">
                <ListaPodio podium={podium} puntos={puntos} />

                {estado !== ESTADO_IMAGEN.GENERANDO && (
                    <div className="pt-3 border-t border-white/10 space-y-2">
                        <div className="flex flex-wrap gap-2">
                            <button type="button" onClick={generar} disabled={ocupado}
                                className="px-3 py-2 rounded-lg text-sm font-semibold bg-orange-600 hover:bg-orange-700 text-white disabled:opacity-50">
                                ✨ {lista ? 'Regenerar con IA' : 'Generar con IA'}
                            </button>
                            <button type="button" onClick={() => archivo.current?.click()} disabled={ocupado}
                                className="px-3 py-2 rounded-lg text-sm font-semibold bg-white/10 hover:bg-white/20 text-white disabled:opacity-50">
                                ⬆️ {lista ? 'Cambiar imagen' : 'Subir imagen'}
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
