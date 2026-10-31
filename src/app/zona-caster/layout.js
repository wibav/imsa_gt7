export const metadata = {
    title: "Zona Caster | GT7 Championship",
    description:
        "Los casters que retransmiten las carreras de GT7 Championships: dónde seguirlos en directo y en redes.",
    openGraph: {
        title: "Zona Caster | GT7 Championship",
        description: "Los casters que retransmiten nuestras carreras y dónde seguirlos.",
        url: "https://imsa.trenkit.com/zona-caster/",
        siteName: "GT7 Championship",
        images: [{ url: "/og-zona-caster.png", width: 1200, height: 630, alt: "Zona Caster - GT7 Championship" }],
        locale: "es_ES",
        type: "website",
    },
    twitter: {
        card: "summary_large_image",
        title: "Zona Caster | GT7 Championship",
        description: "Los casters que retransmiten nuestras carreras y dónde seguirlos.",
        images: ["/og-zona-caster.png"],
        creator: "@GT7ESPRacing",
    },
};

export default function ZonaCasterLayout({ children }) {
    return children;
}
