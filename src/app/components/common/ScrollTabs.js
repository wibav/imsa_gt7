"use client";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Barra de pestañas con scroll horizontal que se nota.
 *
 * En el móvil las pestañas del campeonato no caben y los pilotos no veían que
 * había más a la derecha. Cuando queda contenido oculto se muestra a ese lado
 * un degradado con una flecha (que además desplaza la barra), y la primera vez
 * un aviso «Desliza» que desaparece en cuanto se desplaza. La pestaña activa
 * se lleva siempre a la vista.
 *
 * @param {string} activeKey - cambia al cambiar de pestaña; se centra la activa
 * @param {string} [fadeFrom] - color del degradado (clase `from-*` de Tailwind)
 */
export default function ScrollTabs({ children, activeKey, className = '', fadeFrom = 'from-slate-900' }) {
    const ref = useRef(null);
    const [izq, setIzq] = useState(false);
    const [der, setDer] = useState(false);
    const [desplazado, setDesplazado] = useState(false);

    const medir = useCallback(() => {
        const el = ref.current;
        if (!el) return;
        setIzq(el.scrollLeft > 4);
        setDer(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
    }, []);

    useEffect(() => {
        medir();
        const el = ref.current;
        if (!el) return;
        const alDesplazar = () => {
            medir();
            if (el.scrollLeft > 4) setDesplazado(true);
        };
        el.addEventListener('scroll', alDesplazar, { passive: true });
        const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(medir) : null;
        ro?.observe(el);
        window.addEventListener('resize', medir);
        return () => {
            el.removeEventListener('scroll', alDesplazar);
            ro?.disconnect();
            window.removeEventListener('resize', medir);
        };
    }, [medir, children]);

    // La pestaña activa (aria-selected o data-active) siempre visible
    useEffect(() => {
        const el = ref.current;
        const activa = el?.querySelector('[aria-selected="true"], [data-active="true"]');
        if (!el || !activa) return;
        const { left, right } = activa.getBoundingClientRect();
        const caja = el.getBoundingClientRect();
        if (left < caja.left + 24 || right > caja.right - 24) {
            el.scrollBy({ left: left - caja.left - caja.width / 2 + (right - left) / 2, behavior: 'smooth' });
        }
    }, [activeKey]);

    // El aviso es para descubrir el gesto: se va solo a los pocos segundos
    useEffect(() => {
        const t = setTimeout(() => setDesplazado(true), 6000);
        return () => clearTimeout(t);
    }, []);

    const mover = (sentido) => {
        const el = ref.current;
        if (el) el.scrollBy({ left: sentido * el.clientWidth * 0.7, behavior: 'smooth' });
    };

    return (
        <div className={`relative ${className}`}>
            <div ref={ref} className="flex gap-1 overflow-x-auto" role="tablist">
                {children}
            </div>

            {izq && (
                <button
                    type="button"
                    onClick={() => mover(-1)}
                    aria-label="Ver pestañas anteriores"
                    className={`absolute left-0 top-0 bottom-0 w-10 flex items-center justify-start pl-1 bg-gradient-to-r ${fadeFrom} to-transparent text-white text-xl`}
                >
                    ‹
                </button>
            )}
            {der && (
                <button
                    type="button"
                    onClick={() => mover(1)}
                    aria-label="Ver más pestañas"
                    className={`absolute right-0 top-0 bottom-0 w-14 flex items-center justify-end pr-1 bg-gradient-to-l ${fadeFrom} via-slate-900/80 to-transparent text-white`}
                >
                    <span className="flex items-center justify-center w-7 h-7 rounded-full bg-orange-600 shadow-lg text-lg leading-none animate-pulse">›</span>
                </button>
            )}
            {der && !desplazado && (
                <span className="pointer-events-none absolute right-14 -bottom-6 text-[11px] text-orange-300 bg-slate-900/90 px-2 py-0.5 rounded md:hidden">
                    Desliza para ver más →
                </span>
            )}
        </div>
    );
}
