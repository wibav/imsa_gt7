export const metadata = {
    title: "Creador de Vinilos | GT7 ESP Racing Club",
    description:
        "Herramienta para crear y optimizar vinilos personalizados para Gran Turismo 7. Convierte imágenes a formato SVG vectorial listo para importar.",
    openGraph: {
        title: "Creador de Vinilos | GT7 ESP Racing Club",
        description:
            "Convierte imágenes a vinilos SVG optimizados para Gran Turismo 7. Herramienta gratuita del GT7 ESP Racing Club.",
        url: "https://imsa.trenkit.com/tools/",
        siteName: "GT7 ESP Racing Club",
        images: [
            {
                url: "/og-tools.png",
                width: 1200,
                height: 630,
                alt: "Creador de Vinilos - GT7 ESP Racing Club",
            },
        ],
        locale: "es_ES",
        type: "website",
    },
    twitter: {
        card: "summary_large_image",
        title: "Creador de Vinilos | GT7 ESP Racing Club",
        description:
            "Convierte imágenes a vinilos SVG para Gran Turismo 7.",
        images: ["/og-tools.png"],
        creator: "@GT7ESPRacing",
    },
};

export default function ToolsLayout({ children }) {
    return children;
}
