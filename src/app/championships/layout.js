export const metadata = {
    title: "Campeonatos | GT7 Championship",
    description:
        "Consulta todos los campeonatos, clasificaciones y resultados del GT7 Championship. Temporadas, pilotos y estadísticas en tiempo real.",
    openGraph: {
        title: "Campeonatos | GT7 Championship",
        description:
            "Clasificaciones, resultados y estadísticas de todos los campeonatos del GT7 Championship.",
        url: "https://imsa.trenkit.com/championships/",
        siteName: "GT7 Championship",
        images: [
            {
                url: "/og-championships.png",
                width: 1200,
                height: 630,
                alt: "Campeonatos - GT7 Championship",
            },
        ],
        locale: "es_ES",
        type: "website",
    },
    twitter: {
        card: "summary_large_image",
        title: "Campeonatos | GT7 Championship",
        description:
            "Clasificaciones, resultados y estadísticas de todos los campeonatos.",
        images: ["/og-championships.png"],
        creator: "@GT7ESPRacing",
    },
};

export default function ChampionshipsLayout({ children }) {
    return children;
}
