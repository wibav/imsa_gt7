import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "./context/AuthContext";
import Footer from "./components/Footer";

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
        url: "/logo_gt7.png",
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
      <body className={`${inter.className} overflow-x-hidden`}>
        <AuthProvider>
          {children}
          <Footer />
        </AuthProvider>
      </body>
    </html>
  );
}
