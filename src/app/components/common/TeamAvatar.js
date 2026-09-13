"use client";

/**
 * Avatar de un equipo: su imagen o, si no tiene, las siglas sobre su color.
 *
 * Con `team` vacío pinta un hueco del mismo tamaño (`reservar`), para que en
 * una lista los nombres de los pilotos sin equipo queden alineados con el resto.
 */
const TAMANOS = {
    xs: 'w-5 h-5 rounded text-[7px]',
    sm: 'w-6 h-6 rounded-md text-[8px]',
    md: 'w-10 h-10 rounded-lg text-xs',
    lg: 'w-16 h-16 rounded-xl text-base',
    xl: 'w-24 h-24 rounded-2xl text-xl',
};

export default function TeamAvatar({ team, size = 'sm', reservar = false, className = '' }) {
    const base = `${TAMANOS[size] || TAMANOS.sm} flex-shrink-0 inline-flex items-center justify-center overflow-hidden font-mono font-bold ${className}`;

    if (!team) {
        return reservar ? <span className={`${base} border border-dashed border-white/10`} aria-hidden="true" /> : null;
    }

    const titulo = team.name ? `${team.name} (${team.tag})` : team.tag;
    if (team.avatarUrl) {
        return (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={team.avatarUrl} alt={titulo} title={titulo} className={`${base} object-cover bg-black/20`} />
        );
    }
    return (
        <span className={`${base} text-white`} style={{ backgroundColor: team.color || '#475569' }} title={titulo}>
            {team.tag || '?'}
        </span>
    );
}
