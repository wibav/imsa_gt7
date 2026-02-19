import { STATUS_COLORS, STATUS_LABELS } from '../../utils/constants';

/**
 * Badge de estado reutilizable para campeonatos, eventos, circuitos, etc.
 * 
 * @param {Object} props
 * @param {'active'|'draft'|'completed'|'archived'|'upcoming'|'live'|'in-progress'|string} props.status - Estado a mostrar
 * @param {'sm'|'md'|'lg'} [props.size='md'] - Tamaño del badge
 * @param {string} [props.className] - Clases adicionales
 * @param {boolean} [props.pulse] - Animación de pulso (útil para "EN VIVO")
 * @param {string} [props.icon] - Emoji/icono opcional antes del texto
 */
export default function StatusBadge({ status, size = 'md', className = '', pulse = false, icon }) {
    const EXTENDED_COLORS = {
        ...STATUS_COLORS,
        upcoming: 'bg-yellow-500',
        live: 'bg-red-500',
        'in-progress': 'bg-orange-500',
        pending: 'bg-yellow-500',
        approved: 'bg-green-500',
        rejected: 'bg-red-500',
    };

    const EXTENDED_LABELS = {
        ...STATUS_LABELS,
        upcoming: 'Próximo',
        live: 'EN VIVO',
        'in-progress': 'En Progreso',
        pending: 'Pendiente',
        approved: 'Aprobado',
        rejected: 'Rechazado',
    };

    const sizes = {
        sm: 'text-xs px-2 py-0.5',
        md: 'text-xs px-3 py-1',
        lg: 'text-sm px-4 py-1.5',
    };

    const colorClass = EXTENDED_COLORS[status] || 'bg-gray-500';
    const label = EXTENDED_LABELS[status] || status;
    const sizeClass = sizes[size] || sizes.md;

    return (
        <span
            className={`
                inline-flex items-center gap-1 rounded-full font-bold text-white
                ${colorClass} ${sizeClass}
                ${pulse ? 'animate-pulse' : ''}
                ${className}
            `.trim()}
        >
            {pulse && (
                <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
                </span>
            )}
            {icon && <span>{icon}</span>}
            {label}
        </span>
    );
}
