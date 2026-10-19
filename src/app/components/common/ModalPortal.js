"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Monta un modal directamente en <body>.
 *
 * Un `fixed inset-0` dentro de un contenedor con backdrop-filter, filter o
 * transform (los paneles `backdrop-blur-sm` del admin) se posiciona respecto a
 * ese contenedor y no a la ventana: el modal salía a mitad de una página larga.
 * Además bloquea el scroll del fondo mientras está abierto.
 */
export default function ModalPortal({ children }) {
    const [montado, setMontado] = useState(false);

    useEffect(() => {
        setMontado(true);
        const previo = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = previo; };
    }, []);

    return montado ? createPortal(children, document.body) : null;
}
