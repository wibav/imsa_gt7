import { Inter } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { AuthProvider } from "./context/AuthContext";
import { ChampionshipProvider } from "./context/ChampionshipContext";
import ClientLayout from "./components/ClientLayout";
import Analytics from "../components/Analytics";
import AnalyticsDebugger from "../components/AnalyticsDebugger";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  metadataBase: new URL('https://imsa.trenkit.com'),
  title: "GT7 Championship",
  description: "Dashboard de resultados del campeonato GT7 Championship.",
  openGraph: {
    title: "GT7 Championship",
    description: "Dashboard de resultados del campeonato GT7 Championship",
    url: "https://imsa.trenkit.com",
    siteName: "GT7 Championship",
    images: [
      {
        url: "/logo_gt7.png",
        width: 1200,
        height: 630,
        alt: "GT7 Championships - Dashboard del Campeonato",
      },
    ],
    locale: "es_ES",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "GT7 Championship",
    description: "Dashboard de resultados del campeonato GT7 Championship",
    images: ["/logo_gt7.png"],
    creator: "@GT7ESPRacing",
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/icon-192.png",
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "GT7 Championships",
  },
};

export const viewport = {
  themeColor: "#1e3a5f",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <head>
        <meta name="theme-color" content="#1e3a5f" />
      </head>
      <body className={`${inter.className} overflow-x-hidden`}>
        {/* Google AdSense - cargado después de que la página es interactiva */}
        <Script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-3229768467294527"
          crossOrigin="anonymous"
          strategy="afterInteractive"
        />
        {/* Service Worker - PWA */}
        <Script
          id="sw-register"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js')
                    .catch(function(err) { console.error('SW registration failed:', err); });
                });
              }
            `
          }}
        />
        <Analytics />
        <AnalyticsDebugger />
        <AuthProvider>
          <ChampionshipProvider>
            <ClientLayout>{children}</ClientLayout>
          </ChampionshipProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
