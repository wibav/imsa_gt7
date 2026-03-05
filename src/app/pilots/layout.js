export const metadata = {
    title: "Área de Pilotos | GT7 Championship",
    description:
        "Perfiles de los pilotos del GT7 Championship. Estadísticas individuales, historial de carreras y rendimiento por temporada.",
    openGraph: {
        title: "Área de Pilotos | GT7 Championship",
        description:
            "Perfiles, estadísticas y rendimiento de los pilotos del GT7 Championship.",
        url: "https://imsa.trenkit.com/pilots/",
        siteName: "GT7 Championship",
        images: [
            {
                url: "/og-pilots.png",
                width: 1200,
                height: 630,
                alt: "Área de Pilotos - GT7 Championship",
            },
        ],
        locale: "es_ES",
        type: "website",
    },
    twitter: {
        card: "summary_large_image",
        title: "Área de Pilotos | GT7 Championship",
        description:
            "Perfiles y estadísticas de los pilotos del GT7 Championship.",
        images: ["/og-pilots.png"],
        creator: "@GT7ESPRacing",
    },
};

export default function PilotsLayout({ children }) {
    return children;
}
