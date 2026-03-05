// Función helper para generar metadatos dinámicos con SEO optimizado
export function generateMetadata({
    title,
    description,
    images = ["/logo_gt7.png"],
    url,
    type = "website",
    keywords = [],
    author = "GT7 Championship",
    publishedTime,
    modifiedTime
}) {
    const baseUrl = "https://imsa.trenkit.com"; // URL real del proyecto
    const fullUrl = url ? `${baseUrl}${url}` : baseUrl;

    // Keywords base para SEO
    const baseKeywords = [
        "GT7 Championship", "Gran Turismo 7", "racing club", "carreras", "España",
        "campeonato", "simulación", "motorsport", "PlayStation", "GT7 España",
        "carreras online", "competición", "pilotos", "clasificación"
    ];

    const allKeywords = [...baseKeywords, ...keywords].join(", ");

    return {
        title: title ? `${title} | GT7 Championship` : "GT7 Championship",
        description: description || "Dashboard de resultados del campeonato GT7 Championship. Consulta estadísticas, clasificaciones y resultados de carreras en tiempo real.",
        keywords: allKeywords,
        authors: [{ name: author }],
        creator: author,
        publisher: "GT7 Championship",

        // Configuración de robots mejorada
        robots: {
            index: true,
            follow: true,
            nocache: false,
            googleBot: {
                index: true,
                follow: true,
                noimageindex: false,
                "max-video-preview": -1,
                "max-image-preview": "large",
                "max-snippet": -1,
            },
        },

        // Datos estructurados básicos
        alternates: {
            canonical: fullUrl,
            languages: {
                'es-ES': fullUrl,
                'x-default': fullUrl,
            },
        },

        openGraph: {
            title: title || "GT7 Championship",
            description: description || "Dashboard de resultados del campeonato GT7 Championship",
            url: fullUrl,
            siteName: "GT7 Championship",
            images: images.map(img => ({
                url: img.startsWith('/') ? img : `/${img}`,
                width: 1200,
                height: 630,
                alt: title || "GT7 Championship",
            })),
            locale: "es_ES",
            type,
            ...(publishedTime && { publishedTime }),
            ...(modifiedTime && { modifiedTime }),
        },

        twitter: {
            card: "summary_large_image",
            title: title || "GT7 Championship",
            description: description || "Dashboard de resultados del campeonato GT7 Championship",
            images: images,
        },
    };
}
