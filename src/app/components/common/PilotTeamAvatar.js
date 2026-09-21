"use client";
import { useEffect, useState } from "react";
import { FirebaseService } from "../../services/firebaseService";
import { mapaEquipoPorPiloto } from "../../utils/teamTagMatcher";
import { applyPilotIdentities } from "../../utils/championshipUtils";
import TeamAvatar from "./TeamAvatar";

/**
 * Avatar del equipo de un piloto, para ponerlo delante de su nombre en
 * cualquier lista.
 *
 * El equipo es el CONFIRMADO en /equiposAdmin, no el de las siglas del GT7 ID:
 * quien sigue llamándose "HGT_…" pero ya corre en RRT muestra el avatar de RRT.
 *
 * Los equipos se leen una sola vez para toda la página (getRacingTeams está
 * cacheado y la promesa se comparte), no una consulta por fila.
 */

let mapaCompartido = null;
let promesa = null;

function cargarMapa() {
    if (!promesa) {
        // Con las fusiones de Identidad de pilotos, un piloto que aparece con un
        // GT7 ID antiguo también muestra su equipo.
        promesa = Promise.all([FirebaseService.getRacingTeams(), FirebaseService.getPilotIdentities()]).then(([equipos, identidades]) => {
            mapaCompartido = { porPiloto: mapaEquipoPorPiloto(equipos, applyPilotIdentities({}, identidades)), hay: equipos.length > 0 };
            return mapaCompartido;
        });
    }
    return promesa;
}

export function usePilotTeams() {
    const [mapa, setMapa] = useState(mapaCompartido);
    useEffect(() => {
        if (mapaCompartido) return;
        let vivo = true;
        cargarMapa().then(m => { if (vivo) setMapa(m); });
        return () => { vivo = false; };
    }, []);
    return mapa || { porPiloto: {}, hay: false };
}

/**
 * @param {string} name - Nombre tal cual se muestra (GT7 ID unificado)
 * @param {string[]} [aliases] - Otros nombres del mismo piloto, por si el
 *        miembro se guardó con uno de ellos
 * @param {boolean} [enlazar=true] - Pulsar lleva a la ficha del equipo
 */
export default function PilotTeamAvatar({ name, aliases = [], size = 'sm', enlazar = true, className = '' }) {
    const { porPiloto, hay } = usePilotTeams();
    // Sin ningún equipo publicado la lista se queda como estaba: ni avatar ni hueco.
    if (!hay) return null;

    const equipo = [name, ...aliases].map(n => porPiloto[n]).find(Boolean) || null;
    // Sin equipo, un hueco del mismo tamaño para que los nombres no bailen.
    if (!equipo) return <TeamAvatar team={null} size={size} reservar className={className} />;

    const avatar = <TeamAvatar team={equipo} size={size} className={className} />;
    if (!enlazar) return avatar;
    return (
        <a
            href={`/equipos?id=${equipo.id}`}
            onClick={e => e.stopPropagation()}
            className="inline-flex flex-shrink-0 rounded hover:ring-2 hover:ring-white/40 transition-shadow"
            title={`${equipo.name} (${equipo.tag})`}
        >
            {avatar}
        </a>
    );
}

/**
 * Nombre del equipo de la comunidad del piloto (el confirmado en
 * /equiposAdmin), enlazado a su ficha. null si no tiene equipo.
 *
 * No confundir con los equipos de un campeonato por equipos (IMSA GT7 2025):
 * esos son solo de ese campeonato y no se muestran fuera de él.
 */
export function PilotTeamName({ name, aliases = [], className = '' }) {
    const { porPiloto, hay } = usePilotTeams();
    if (!hay) return null;
    const equipo = [name, ...aliases].map(n => porPiloto[n]).find(Boolean);
    if (!equipo) return null;
    return (
        <a href={`/equipos?id=${equipo.id}`} onClick={e => e.stopPropagation()} className={`hover:underline ${className}`}>
            {equipo.name}
        </a>
    );
}

/**
 * Versión para las imágenes exportables (clasificación y resultados en PNG).
 *
 * Siempre las siglas sobre el color del equipo, nunca el avatar: html-to-image
 * necesita que las imágenes externas permitan CORS, y Firebase Storage no lo
 * permite en este bucket, así que un <img> del avatar rompería la exportación.
 * Estilos en línea porque la captura no ve Tailwind en todos los casos.
 */
export function PilotTeamTagExport({ name, aliases = [] }) {
    const { porPiloto, hay } = usePilotTeams();
    if (!hay) return null;
    const equipo = [name, ...aliases].map(n => porPiloto[n]).find(Boolean);
    if (!equipo) return null;
    return (
        <span style={{
            display: 'inline-block', minWidth: '28px', padding: '1px 4px', marginRight: '6px',
            borderRadius: '4px', backgroundColor: equipo.color || '#475569', color: 'white',
            fontSize: '9px', fontWeight: 'bold', fontFamily: 'monospace', textAlign: 'center', verticalAlign: 'middle',
        }}>
            {equipo.tag}
        </span>
    );
}
