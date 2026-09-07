"use client";
import { useEffect, useState } from 'react';
import { FirebaseService } from '../../services/firebaseService';
import { nombresParecidosA } from '../../utils/pilotIdentityMatcher';

/**
 * Aviso bajo el campo de GT7 ID cuando lo escrito se parece a un piloto que ya
 * corre en la liga.
 *
 * GT7 permite cambiar el GT7 ID tres veces, así que el mismo piloto acaba
 * inscrito con nombres distintos temporada tras temporada y sus estadísticas
 * se parten. Limpiarlo después es trabajo manual (ver /pilotsAdmin); es mucho
 * más barato preguntárselo aquí a quien lo sabe seguro.
 *
 * Es informativo a propósito: no bloquea ni corrige el campo. Un piloto nuevo
 * puede llamarse parecido a otro y tiene todo el derecho a inscribirse.
 */
export default function SimilarPilotHint({ value, onUsar }) {
    const [conocidos, setConocidos] = useState([]);
    const [descartado, setDescartado] = useState(false);

    useEffect(() => {
        let vivo = true;
        FirebaseService.getKnownPilotNames()
            .then(n => { if (vivo) setConocidos(n); })
            .catch(() => { }); // el aviso es una ayuda: si no carga, no pasa nada
        return () => { vivo = false; };
    }, []);

    // Si el piloto cambia lo escrito, el descarte anterior deja de aplicar.
    useEffect(() => { setDescartado(false); }, [value]);

    const parecidos = descartado ? [] : nombresParecidosA(value, conocidos);
    if (parecidos.length === 0) return null;

    return (
        <div className="mt-2 bg-blue-500/10 border border-blue-400/30 rounded-lg px-3 py-2">
            <p className="text-blue-200 text-xs">
                ¿Eres tú? Ya corre en la liga{' '}
                {parecidos.map((n, i) => (
                    <span key={n}>
                        {i > 0 && ', '}
                        <button
                            type="button"
                            onClick={() => onUsar?.(n)}
                            className="font-semibold underline hover:text-white"
                        >
                            {n}
                        </button>
                    </span>
                ))}
                .
            </p>
            <p className="text-blue-200/60 text-xs mt-1">
                Si es tu caso, usa el mismo nombre para que no se te partan las estadísticas.
                Si eres otro piloto, sigue con el tuyo.{' '}
                <button
                    type="button"
                    onClick={() => setDescartado(true)}
                    className="underline hover:text-white"
                >
                    No soy yo
                </button>
            </p>
        </div>
    );
}
