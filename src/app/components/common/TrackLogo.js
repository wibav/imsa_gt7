"use client";
import { useEffect, useState } from "react";
import { FirebaseService } from "../../services/firebaseService";

/**
 * Logo oficial del circuito (gran-turismo.com), sobre una pastilla clara:
 * el logo es oscuro con fondo transparente y no se lee sobre el tema oscuro.
 *
 * Los circuitos de un campeonato son copias del catálogo, así que el logo se
 * busca por nombre en `tracks` (una sola carga por página). Si el doc ya trae
 * `logo`, se usa directamente.
 */

let promesaLogos = null;
function cargarLogos() {
    if (!promesaLogos) {
        promesaLogos = FirebaseService.getTracks()
            .then(tracks => new Map(tracks.filter(t => t.logo).map(t => [String(t.name).trim().toLowerCase(), t.logo])))
            .catch(() => { promesaLogos = null; return new Map(); });
    }
    return promesaLogos;
}

const TAMANOS = {
    sm: 'h-11 w-24',
    md: 'h-14 w-32',
    lg: 'h-20 w-40',
};

export default function TrackLogo({ name, logo, size = 'md', className = '' }) {
    const [url, setUrl] = useState(logo || null);
    const [fallo, setFallo] = useState(false);

    useEffect(() => {
        if (logo) { setUrl(logo); return; }
        let vivo = true;
        cargarLogos().then(m => { if (vivo) setUrl(m.get(String(name || '').trim().toLowerCase()) || null); });
        return () => { vivo = false; };
    }, [name, logo]);

    if (!url || fallo) return null;
    return (
        <span className={`inline-flex flex-shrink-0 items-center justify-center rounded-lg bg-white/90 px-1.5 ${TAMANOS[size] || TAMANOS.md} ${className}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt={`Logo de ${name}`} loading="lazy" className="max-h-full max-w-full object-contain" onError={() => setFallo(true)} />
        </span>
    );
}
