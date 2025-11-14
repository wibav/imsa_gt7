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
  title: "IMSA GT7 Racing Club ESP",
  description: "Dashboard de resultados del campeonato IMSA GT7 Racing Club ESP.",
  openGraph: {
    title: "GT7 ESP Racing Club",
    description: "Dashboard de resultados del campeonato GT7 ESP Racing Club",
    url: "https://imsa.trenkit.com",
    siteName: "GT7 ESP Racing Club",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "GT7 ESP Racing Club - Dashboard del Campeonato",
      },
    ],
    locale: "es_ES",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "GT7 ESP Racing Club",
    description: "Dashboard de resultados del campeonato GT7 ESP Racing Club",
    images: ["/og-image.png"],
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
