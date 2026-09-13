"use client";
import { useEffect, useState } from 'react';
import { FirebaseService } from '../../services/firebaseService';
import { nombresParecidosA } from '../../utils/pilotIdentityMatcher';
import { extraerSiglas, claveSiglas } from '../../utils/teamTagMatcher';
import TeamAvatar from './TeamAvatar';

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
    const [equipos, setEquipos] = useState([]);
    const [descartado, setDescartado] = useState(false);

    useEffect(() => {
        let vivo = true;
        FirebaseService.getKnownPilotNames()
            .then(n => { if (vivo) setConocidos(n); })
            .catch(() => { }); // el aviso es una ayuda: si no carga, no pasa nada
        FirebaseService.getRacingTeams()
            .then(e => { if (vivo) setEquipos(e); })
            .catch(() => { });
        return () => { vivo = false; };
    }, []);

    // Si el piloto cambia lo escrito, el descarte anterior deja de aplicar.
    useEffect(() => { setDescartado(false); }, [value]);

    const parecidos = descartado ? [] : nombresParecidosA(value, conocidos);

    // Siglas de un equipo conocido al principio del GT7 ID. Solo informa:
    // pertenecer a un equipo lo confirma la organización en /equiposAdmin,
    // y quien se inscribe con estas siglas aparece allí para revisarlo.
    const siglas = extraerSiglas(value);
    const equipo = siglas && equipos.find(e =>
        [e.tag, ...(e.tagVariants || [])].some(v => claveSiglas(v) === siglas.tag));

    if (parecidos.length === 0 && !equipo) return null;

    return (
        <>
        {equipo && (
            <div className="mt-2 flex items-center gap-2 bg-white/5 border border-white/15 rounded-lg px-3 py-2">
                <TeamAvatar team={equipo} size="sm" />
                <p className="text-gray-300 text-xs">
                    <span className="font-mono font-semibold text-white">{siglas.tag}</span> son las siglas de{' '}
                    <span className="font-semibold text-white">{equipo.name}</span>. La organización confirma
                    los miembros de cada equipo.
                </p>
            </div>
        )}
        {parecidos.length > 0 && (
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
        )}
        </>
    );
}
