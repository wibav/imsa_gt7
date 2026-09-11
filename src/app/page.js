import DashboardRenovated from './components/DashboardRenovated'

// Metadatos específicos para la página principal
export const metadata = {
  title: "Dashboard - GT7 Championships",
  description: "Consulta en tiempo real las estadísticas, clasificaciones y resultados del campeonato GT7 Championships. Dashboard interactivo con datos actualizados.",
  openGraph: {
    title: "Dashboard - GT7 Championships",
    description: "Consulta en tiempo real las estadísticas, clasificaciones y resultados del campeonato GT7 Championships.",
    // La tarjeta 1200×630 y no el logo suelto: el logo cuadrado y claro
    // apenas se distinguía en la vista previa de WhatsApp.
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "GT7 Championships" }],
  },
}

export default function Home() {
  return <DashboardRenovated />
}