import { Inter } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { AuthProvider } from "./context/AuthContext";
import { ChampionshipProvider } from "./context/ChampionshipContext";
import { OrganizationProvider } from "./context/OrganizationContext";
import ClientLayout from "./components/ClientLayout";
import { LanguageProvider } from "./i18n";
import Analytics from "../components/Analytics";
import AnalyticsDebugger from "../components/AnalyticsDebugger";
import { AdSenseConsentido } from "./components/ads/AdSense";

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
        url: "/og-image.png",
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
    images: ["/og-image.png"],
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
        {/* Google AdSense - solo si el visitante acepta las cookies de publicidad */}
        <AdSenseConsentido />
        {/* Service Worker - PWA */}
        <Script
          id="sw-register"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator && ${process.env.NODE_ENV !== 'production'}) {
                // En desarrollo el código no lleva versión en el nombre: un service
                // worker lo serviría viejo desde la caché. Se quita si quedó uno.
                navigator.serviceWorker.getRegistrations().then(function(rs) { rs.forEach(function(r) { r.unregister(); }); });
              } else if ('serviceWorker' in navigator) {
                var registrarSW = function() {
                  navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' })
                    .then(function(reg) { reg.update(); })
                    .catch(function(err) { console.error('SW registration failed:', err); });
                };
                // afterInteractive puede llegar después de 'load': entonces se registra ya
                if (document.readyState === 'complete') registrarSW();
                else window.addEventListener('load', registrarSW);
              }
              // Si falta un archivo de código de una versión anterior (la web se
              // publicó mientras la página estaba abierta o en caché), se vacía
              // la caché y se recarga una vez por sesión en vez de quedarse a medias.
              (function() {
                var esFalloDeCodigo = function(m) { return /ChunkLoadError|Loading chunk [\\w-]+ failed|Loading CSS chunk|dynamically imported module/i.test(String(m || '')); };
                var recuperar = function() {
                  try { if (sessionStorage.getItem('gt7-recarga-codigo')) return; sessionStorage.setItem('gt7-recarga-codigo', '1'); } catch (e) { return; }
                  var fin = function() { window.location.reload(); };
                  if (window.caches) caches.keys().then(function(k) { return Promise.all(k.map(function(x) { return caches.delete(x); })); }).then(fin, fin); else fin();
                };
                window.addEventListener('error', function(e) { if (esFalloDeCodigo(e && (e.message || (e.error && e.error.name)))) recuperar(); });
                window.addEventListener('unhandledrejection', function(e) { var r = e && e.reason; if (esFalloDeCodigo(r && (r.name + ' ' + r.message))) recuperar(); });
              })();
            `
          }}
        />
        <Analytics />
        {process.env.NODE_ENV === 'development' && <AnalyticsDebugger />}
        <LanguageProvider>
          <OrganizationProvider>
            <AuthProvider>
              <ChampionshipProvider>
                <ClientLayout>{children}</ClientLayout>
              </ChampionshipProvider>
            </AuthProvider>
          </OrganizationProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
