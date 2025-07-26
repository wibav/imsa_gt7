// Función helper para generar metadatos dinámicos con SEO optimizado
export function generateMetadata({
    title,
    description,
    images = ["/og-image.jpg"],
    url,
    type = "website",
    keywords = [],
    author = "GT7 ESP Racing Club",
    publishedTime,
    modifiedTime
}) {
    const baseUrl = "https://imsa.trenkit.com"; // URL real del proyecto
    const fullUrl = url ? `${baseUrl}${url}` : baseUrl;

    // Keywords base para SEO
    const baseKeywords = [
        "IMSA GT7", "Gran Turismo 7", "racing club", "carreras", "España",
        "campeonato", "simulación", "motorsport", "PlayStation", "GT7 España",
        "carreras online", "competición", "pilotos", "clasificación"
    ];

    const allKeywords = [...baseKeywords, ...keywords].join(", ");

    return {
        title: title ? `${title} | IMSA GT7 Racing Club ESP` : "IMSA GT7 Racing Club ESP",
        description: description || "Dashboard de resultados del campeonato IMSA GT7 Racing Club ESP. Consulta estadísticas, clasificaciones y resultados de carreras en tiempo real.",
        keywords: allKeywords,
        authors: [{ name: author }],
        creator: author,
        publisher: "IMSA GT7 Racing Club ESP",

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
            title: title || "IMSA GT7 Racing Club ESP",
            description: description || "Dashboard de resultados del campeonato IMSA GT7 Racing Club ESP",
            url: fullUrl,
            siteName: "IMSA GT7 Racing Club ESP",
            images: images.map(img => ({
                url: img.startsWith('/') ? img : `/${img}`,
                width: 1200,
                height: 630,
                alt: title || "IMSA GT7 Racing Club ESP",
            })),
            locale: "es_ES",
            type,
            ...(publishedTime && { publishedTime }),
            ...(modifiedTime && { modifiedTime }),
        },

        twitter: {
            card: "summary_large_image",
            title: title || "IMSA GT7 Racing Club ESP",
            description: description || "Dashboard de resultados del campeonato IMSA GT7 Racing Club ESP",
            images: images,
        },
    };
}

// Ejemplos de uso:
/*
// En una página de piloto:
export const metadata = generateMetadata({
  title: "Perfil de Piloto - Juan Pérez",
  description: "Estadísticas y resultados de Juan Pérez en el campeonato IMSA GT7",
  url: "/pilots/juan-perez"
});

// En una página de carrera:
export const metadata = generateMetadata({
  title: "Carrera Silverstone - Resultados",
  description: "Resultados y clasificación de la carrera en Silverstone del campeonato IMSA GT7",
  url: "/races/silverstone-2025"
});

// En una página de clasificación general:
export const metadata = generateMetadata({
  title: "Clasificación General",
  description: "Tabla de posiciones y puntuación del campeonato IMSA GT7 Racing Club ESP",
  url: "/standings"
});
*/
