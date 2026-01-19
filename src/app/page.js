import DashboardRenovated from './components/DashboardRenovated'

// Metadatos específicos para la página principal
export const metadata = {
  title: "Dashboard - GT7 Championships",
  description: "Consulta en tiempo real las estadísticas, clasificaciones y resultados del campeonato GT7 Championships. Dashboard interactivo con datos actualizados.",
  openGraph: {
    title: "Dashboard - GT7 Championships",
    description: "Consulta en tiempo real las estadísticas, clasificaciones y resultados del campeonato GT7 Championships.",
    images: ["/logo_gt7.png"],
  },
}

export default function Home() {
  return <DashboardRenovated />
}