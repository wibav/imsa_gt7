import Dashboard from './components/Dashboard'

// Metadatos específicos para la página principal
export const metadata = {
  title: "Dashboard - GT7 ESP Racing Club",
  description: "Consulta en tiempo real las estadísticas, clasificaciones y resultados del campeonato GT7 ESP Racing Club. Dashboard interactivo con datos actualizados.",
  openGraph: {
    title: "Dashboard - GT7 ESP Racing Club",
    description: "Consulta en tiempo real las estadísticas, clasificaciones y resultados del campeonato GT7 ESP Racing Club.",
    images: ["/og-image.jpg", "/logo_gt7.png"],
  },
}

export default function Home() {
  return <Dashboard />
}