"use client";
import Link from "next/link";
import Navbar, { useHeaderBackground } from "./Navbar";

/**
 * Cabecera estándar del área pública: la barra de navegación y el título de
 * la sección forman UNA sola banda.
 *
 * Antes cada página resolvía la cabecera a su manera (auditoría 2026-09-13):
 * Pilotos tenía banda naranja propia pero no barra de navegación, Equipos
 * tenía barra más un título sobre fondo oscuro —que se leía como dos
 * cabeceras—, Reglamento y Equipamiento una banda translúcida, y los textos
 * legales un título suelto. Solo la mitad llevaba migas.
 *
 * La barra sigue siendo la única parte fija al hacer scroll; el título va
 * justo debajo con el mismo fondo, así que no se nota el corte.
 *
 * Las fichas con banner (campeonato, evento, equipo) no usan esto: llevan
 * <Navbar /> y debajo su banner, con las migas dentro.
 *
 * @param {Array<{label: string, href?: string}>} migas - Sin «Inicio», se añade solo
 * @param {React.ReactNode} titulo
 * @param {string} [icono]
 * @param {React.ReactNode} [subtitulo]
 * @param {React.ReactNode} [children] - Datos o acciones bajo el subtítulo
 */
export default function PageHeader({ migas = [], titulo, icono, subtitulo, children, ancho = 'max-w-7xl' }) {
    const fondo = useHeaderBackground();
    const todas = [{ label: '🏠 Inicio', href: '/' }, ...migas];

    return (
        <>
            <Navbar />
            <header className={`${fondo.className} px-4 pb-8 pt-1 sm:pb-10`} style={fondo.style}>
                <div className={`${ancho} mx-auto w-full`}>
                    <nav aria-label="Migas de pan" className="flex flex-wrap items-center gap-2 text-sm text-white/70 mb-3">
                        {todas.map((m, i) => (
                            <span key={i} className="flex items-center gap-2">
                                {i > 0 && <span aria-hidden="true">/</span>}
                                {m.href && i < todas.length - 1
                                    ? <Link href={m.href} className="hover:text-white transition-colors">{m.label}</Link>
                                    : <span className="text-white" aria-current={i === todas.length - 1 ? 'page' : undefined}>{m.label}</span>}
                            </span>
                        ))}
                    </nav>
                    <h1 className="text-3xl sm:text-5xl font-bold text-white flex items-center gap-3 flex-wrap">
                        {icono && <span aria-hidden="true">{icono}</span>}
                        {titulo}
                    </h1>
                    {subtitulo && <p className="text-white/80 mt-2 max-w-3xl">{subtitulo}</p>}
                    {children && <div className="mt-3">{children}</div>}
                </div>
            </header>
        </>
    );
}
