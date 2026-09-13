export const metadata = {
    title: "Equipos | GT7 Championship",
    description:
        "Los equipos de la comunidad GT7 Championships: sus pilotos y lo que han conseguido en campeonatos y eventos.",
    openGraph: {
        title: "Equipos | GT7 Championship",
        description: "Los equipos de la comunidad y lo que han conseguido sus pilotos.",
        url: "https://imsa.trenkit.com/equipos/",
        siteName: "GT7 Championship",
        images: [{ url: "/og-equipos.png", width: 1200, height: 630, alt: "Equipos - GT7 Championship" }],
        locale: "es_ES",
        type: "website",
    },
    twitter: {
        card: "summary_large_image",
        title: "Equipos | GT7 Championship",
        description: "Los equipos de la comunidad y lo que han conseguido sus pilotos.",
        images: ["/og-equipos.png"],
        creator: "@GT7ESPRacing",
    },
};

export default function EquiposLayout({ children }) {
    return children;
}
