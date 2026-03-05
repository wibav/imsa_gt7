import { Inter } from "next/font/google";
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
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <head>
        <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-3229768467294527"
          crossOrigin="anonymous"
        />
      </head>
      <body className={`${inter.className} overflow-x-hidden`}>
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
