export default function Head() {
    const title = "Dashboard - GT7 ESP Racing Club";
    const description =
        "Consulta en tiempo real las estadísticas, clasificaciones y resultados del campeonato GT7 ESP Racing Club. Dashboard interactivo con datos actualizados.";
    const siteName = "GT7 ESP Racing Club";
    const url = "https://imsa.trenkit.com/";
    const image = "https://imsa.trenkit.com/og-image.png"; // PNG 1200x630 para previews

    const fbAppId = process.env.NEXT_PUBLIC_FB_APP_ID;

    return (
        <>
            <title>{title}</title>
            <meta name="description" content={description} />

            {/* Google Analytics (gtag) - Required for Firebase Analytics */}
            <script async src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID}`}></script>
            <script
                dangerouslySetInnerHTML={{
                    __html: `
                        window.dataLayer = window.dataLayer || [];
                        function gtag(){dataLayer.push(arguments);}
                        gtag('js', new Date());
                        gtag('config', '${process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID}', {
                            page_title: document.title,
                            page_location: window.location.href
                        });
                    `,
                }}
            />

            {/* Open Graph */}
            <meta property="og:type" content="website" />
            <meta property="og:url" content={url} />
            <meta property="og:site_name" content={siteName} />
            <meta property="og:title" content={title} />
            <meta property="og:description" content={description} />
            <meta property="og:image" content={image} />
            <meta property="og:image:secure_url" content={image} />
            <meta property="og:image:width" content="1200" />
            <meta property="og:image:height" content="630" />

            {/* Twitter */}
            <meta name="twitter:card" content="summary_large_image" />
            <meta name="twitter:title" content={siteName} />
            <meta name="twitter:description" content="Dashboard de resultados del campeonato GT7 ESP Racing Club" />
            <meta name="twitter:image" content={image} />

            {fbAppId ? (
                <meta property="fb:app_id" content={fbAppId} />
            ) : null}

            <link rel="icon" href="/favicon.ico" />
            <link rel="canonical" href={url} />
        </>
    );
}
