import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "./context/AuthContext";
import Head from 'next/head';

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  metadataBase: new URL('https://imsa.trenkit.com'),
  title: "IMSA GT7 Racing Club ESP",
  description: "Dashboard de resultados del campeonato IMSA GT7 Racing Club ESP.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <Head>
        <title>{metadata.title}</title>
        <meta name="description" content={metadata.description} />
        <link rel="icon" type="image/x-icon" href="/favicon.ico" />
        <meta property="og:title" content="GT7 ESP Racing Club" />
        <meta property="og:description" content="Dashboard de resultados del campeonato GT7 ESP Racing Club" />
        <meta property="og:image" content="https://imsa.trenkit.com/og-image.svg" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:alt" content="GT7 ESP Racing Club - Dashboard del Campeonato" />
        <meta property="og:url" content="https://imsa.trenkit.com" />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="GT7 ESP Racing Club" />
        <meta property="og:locale" content="es_ES" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="GT7 ESP Racing Club" />
        <meta name="twitter:description" content="Dashboard de resultados del campeonato GT7 ESP Racing Club" />
        <meta name="twitter:image" content="https://imsa.trenkit.com/og-image.svg" />
        <meta name="twitter:creator" content="@GT7ESPRacing" />
      </Head>
      <body className={inter.className}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
