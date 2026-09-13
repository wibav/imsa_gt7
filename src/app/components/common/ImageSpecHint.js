/**
 * Medidas recomendadas bajo cada campo de subida de imagen.
 *
 * Sin ellas cada organizador subía lo que tenía a mano: hay banners de
 * evento en vertical (1024×1536) que la cabecera, apaisada, recorta hasta
 * dejar irreconocibles. Las medidas salen de cómo se muestra cada imagen en
 * la web, y viven aquí para que todos los formularios digan lo mismo.
 */

// compressImage (utils/imageCompression.js) guarda siempre en PNG, a 1600 px
// de ancho como mucho: la transparencia se conserva.
const AVISO_TRANSPARENCIA = 'Se guarda en PNG y conserva la transparencia.';

export const IMAGE_SPECS = {
    championshipBanner: {
        medidas: '1600 × 900 px',
        formato: 'horizontal 16:9 (se guarda en PNG)',
        nota: 'La cabecera recorta arriba y abajo: deja el nombre y lo importante en la franja central. También es la imagen al compartir el enlace.',
    },
    eventBanner: {
        medidas: '1600 × 900 px',
        formato: 'horizontal 16:9 (se guarda en PNG)',
        nota: 'Evita imágenes verticales: la tarjeta y la cabecera las recortan. También es la imagen al compartir el enlace.',
    },
    trackLayout: {
        medidas: '1000 px por el lado mayor',
        formato: 'PNG con fondo transparente, trazado en blanco o color claro',
        nota: `Se muestra sobre fondo oscuro y sin recortar. ${AVISO_TRANSPARENCIA}`,
    },
    teamAvatar: {
        medidas: '512 × 512 px',
        formato: 'PNG cuadrado, mejor con fondo transparente',
        nota: `Se muestra pequeño junto a cada piloto del equipo: que se reconozca a 26 px. ${AVISO_TRANSPARENCIA}`,
    },
    teamBanner: {
        medidas: '1600 × 500 px',
        formato: 'horizontal (se guarda en PNG)',
        nota: 'Va en la cabecera de la ficha del equipo y en su tarjeta, con el avatar encima por la izquierda.',
    },
    orgLogo: {
        medidas: '512 × 512 px',
        formato: 'PNG cuadrado con fondo transparente',
        nota: `En la cabecera se muestra dentro de un círculo: deja margen alrededor. ${AVISO_TRANSPARENCIA}`,
    },
};

export default function ImageSpecHint({ spec, className = '' }) {
    const s = IMAGE_SPECS[spec];
    if (!s) return null;
    return (
        <p className={`text-xs text-gray-400 mt-2 leading-relaxed ${className}`}>
            📐 <span className="text-gray-200 font-medium">{s.medidas}</span> · {s.formato}. {s.nota} Máximo 10 MB.
        </p>
    );
}
