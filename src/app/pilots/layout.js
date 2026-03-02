export const metadata = {
    title: "Área de Pilotos | GT7 ESP Racing Club",
    description:
        "Perfiles de los pilotos del GT7 ESP Racing Club. Estadísticas individuales, historial de carreras y rendimiento por temporada.",
    openGraph: {
        title: "Área de Pilotos | GT7 ESP Racing Club",
        description:
            "Perfiles, estadísticas y rendimiento de los pilotos del GT7 ESP Racing Club.",
        url: "https://imsa.trenkit.com/pilots/",
        siteName: "GT7 ESP Racing Club",
        images: [
            {
                url: "/og-pilots.png",
                width: 1200,
                height: 630,
                alt: "Área de Pilotos - GT7 ESP Racing Club",
            },
        ],
        locale: "es_ES",
        type: "website",
    },
    twitter: {
        card: "summary_large_image",
        title: "Área de Pilotos | GT7 ESP Racing Club",
        description:
            "Perfiles y estadísticas de los pilotos del GT7 ESP Racing Club.",
        images: ["/og-pilots.png"],
        creator: "@GT7ESPRacing",
    },
};

export default function PilotsLayout({ children }) {
    return children;
}
