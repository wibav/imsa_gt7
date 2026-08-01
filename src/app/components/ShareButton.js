/**
 * Botón de compartición social que copia la URL de share al portapapeles.
 * 
 * Genera URLs /share/championship/{id} o /share/event/{id} que tienen
 * metadata OG/Twitter pre-generada para que crawlers sociales muestren
 * previews correctos sin ejecutar JS.
 * 
 * Uso:
 *   <ShareButton type="championship" id={championshipId} title="Campeonato X" />
 *   <ShareButton type="event" id={eventId} title="Evento Y" />
 */

"use client";
import { useState } from "react";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://imsa.trenkit.com';

export default function ShareButton({ type, id, title = '' }) {
    const [copied, setCopied] = useState(false);
    const [error, setError] = useState(false);

    if (!type || !id) {
        return null;
    }

    const shareUrl = `${BASE_URL}/share/${type}/${id}/`;

    const handleShare = async () => {
        try {
            setError(false);
            // Intentar usar la Web Share API nativa si está disponible (móvil)
            if (navigator.share) {
                await navigator.share({
                    title: title || `GT7 Championships - ${type}`,
                    url: shareUrl,
                });
                return;
            }

            // Fallback: copiar al portapapeles
            await navigator.clipboard.writeText(shareUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Error al compartir:', err);
            setError(true);
            setTimeout(() => setError(false), 3000);
        }
    };

    return (
        <button
            onClick={handleShare}
            className={`
                inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium
                transition-all duration-200 
                ${error
                    ? 'bg-red-500 text-white'
                    : copied
                        ? 'bg-green-500 text-white'
                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                }
            `}
            title="Compartir en redes sociales"
            aria-label={`Compartir ${title || type} en redes sociales`}
        >
            {error ? (
                <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    <span>Error</span>
                </>
            ) : copied ? (
                <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>¡Copiado!</span>
                </>
            ) : (
                <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                        />
                    </svg>
                    <span>Compartir</span>
                </>
            )}
        </button>
    );
}
