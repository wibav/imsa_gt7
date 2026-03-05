export const metadata = {
    title: "Eventos | GT7 Championship",
    description:
        "Calendario de eventos, carreras especiales e inscripciones del GT7 Championship.",
    openGraph: {
        title: "Eventos | GT7 Championship",
        description:
            "Calendario de eventos, carreras especiales e inscripciones del GT7 Championship.",
        url: "https://imsa.trenkit.com/events/",
        siteName: "GT7 Championship",
        images: [
            {
                url: "/og-events.png",
                width: 1200,
                height: 630,
                alt: "Eventos - GT7 Championship",
            },
        ],
        locale: "es_ES",
        type: "website",
    },
    twitter: {
        card: "summary_large_image",
        title: "Eventos | GT7 Championship",
        description:
            "Calendario de eventos, carreras especiales e inscripciones del GT7 Championship.",
        images: ["/og-events.png"],
        creator: "@GT7ESPRacing",
    },
};

export default function EventsLayout({ children }) {
    return children;
}
