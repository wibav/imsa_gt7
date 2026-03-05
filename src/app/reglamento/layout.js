export const metadata = {
    title: "Reglamento | GT7 Championship",
    description:
        "Normativa oficial del GT7 Championship. Reglas de conducta, sistema de sanciones por puntos, procedimientos de carrera y reclamaciones.",
    openGraph: {
        title: "Reglamento | GT7 Championship",
        description:
            "Normativa oficial: conducta en pista, sanciones, reclamaciones y reglas de carrera del GT7 Championship.",
        url: "https://imsa.trenkit.com/reglamento/",
        siteName: "GT7 Championship",
        images: [
            {
                url: "/og-reglamento.png",
                width: 1200,
                height: 630,
                alt: "Reglamento - GT7 Championship",
            },
        ],
        locale: "es_ES",
        type: "website",
    },
    twitter: {
        card: "summary_large_image",
        title: "Reglamento | GT7 Championship",
        description:
            "Normativa oficial y sistema de sanciones del GT7 Championship.",
        images: ["/og-reglamento.png"],
        creator: "@GT7ESPRacing",
    },
};

export default function ReglamentoLayout({ children }) {
    return children;
}
