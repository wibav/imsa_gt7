import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "./context/AuthContext";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  metadataBase: new URL('https://imsa.trenkit.com'),
  title: "IMSA GT7 Racing Club ESP",
  description: "Dashboard de resultados del campeonato IMSA GT7 Racing Club ESP.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <head />
      <body className={inter.className}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
