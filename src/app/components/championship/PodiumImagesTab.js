"use client";
import { useI18n } from '../../i18n';
import { ESTADO_IMAGEN } from '../../utils/podiumImages';

export const MEDALLAS = { 1: '🥇', 2: '🥈', 3: '🥉' };

/** Imagen lista para mostrarse (no en generación ni fallida). */
export const imagenLista = (imagen) => !!imagen?.imageUrl && imagen.status !== ESTADO_IMAGEN.GENERANDO;

/**
 * Pestaña pública «Podios»: la imagen del podio final de cada sala, sus tres primeros
 * y el enlace de descarga. Solo lectura: generar con IA, subir o quitar
 * imágenes se hace desde el panel de administración (PodiumImagesAdmin),
 * para que nadie gaste créditos de Gemini desde la web pública.
 *
 * @param {Array} salas  [{ key, name, color, podium }]
 * @param {Array} images documentos de championships/{id}/podiumImages
 */
export default function PodiumImagesTab({ salas = [], images = [] }) {
    const { t } = useI18n();
    const im = (clave, vars) => t(`campeonato.imagenes.${clave}`, vars);
    const porClave = Object.fromEntries(images.map(i => [i.id, i]));
    const visibles = salas.filter(s => imagenLista(porClave[s.key]));

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
            <div>
                <h2 className="text-2xl font-bold text-white">🏆 {visibles.some(s => s.name) ? im('titulo') : im('tituloGeneral')}</h2>
                {visibles.some(s => s.name) && <p className="text-gray-300 text-sm mt-1">{im('subtitulo')}</p>}
            </div>
            <div className="grid md:grid-cols-2 gap-6">
                {visibles.map(sala => {
                    const imagen = porClave[sala.key];
                    const titulo = sala.name ? im('sala', { nombre: sala.name }) : im('campeones');
                    // El podio guardado con la imagen manda: la rotación cambia
                    // después a los pilotos de sala.
                    const podium = imagen.podium?.length ? imagen.podium : sala.podium;
                    return (
                        <article key={sala.key} className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                            <CabeceraSala color={sala.color} titulo={titulo} />
                            <a href={imagen.imageUrl} target="_blank" rel="noopener noreferrer" className="block bg-black/30">
                                {/* eslint-disable-next-line @next/next/no-img-element -- export estático: sin optimizador de imágenes */}
                                <img src={imagen.imageUrl} alt={im('alt', { sala: titulo })} loading="lazy" className="w-full aspect-square object-cover" />
                            </a>
                            <div className="p-4 space-y-3">
                                <ListaPodio podium={podium} puntos={n => im('puntos', { n })} />
                                <a href={imagen.imageUrl} download target="_blank" rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-sm text-blue-300 hover:text-blue-200">
                                    ⬇️ {im('descargar')}
                                </a>
                            </div>
                        </article>
                    );
                })}
            </div>
        </div>
    );
}

export function CabeceraSala({ color, titulo }) {
    return (
        <header className="flex items-center gap-2 px-4 py-3 border-b border-white/10">
            {color && <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: color }} aria-hidden="true" />}
            <h3 className="text-white font-bold">{titulo}</h3>
        </header>
    );
}

export function ListaPodio({ podium = [], puntos }) {
    return (
        <ol className="space-y-1">
            {(podium || []).map(p => (
                <li key={p.pos} className="flex items-center gap-2 text-sm">
                    <span aria-hidden="true">{MEDALLAS[p.pos]}</span>
                    <span className="text-white font-medium truncate">{p.name}</span>
                    <span className="ml-auto text-orange-300 font-bold whitespace-nowrap">{puntos(p.points)}</span>
                </li>
            ))}
        </ol>
    );
}
