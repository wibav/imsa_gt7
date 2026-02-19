/**
 * Skeleton de carga reutilizable con múltiples variantes.
 * 
 * @param {Object} props
 * @param {'card'|'table'|'text'|'banner'|'form'|'list'|'custom'} [props.variant='card'] - Tipo de skeleton
 * @param {number} [props.rows=3] - Filas para variantes table/list/text
 * @param {string} [props.className] - Clases adicionales
 * @param {string} [props.message] - Texto de carga opcional (ej: "Cargando campeonatos...")
 */
export default function LoadingSkeleton({ variant = 'card', rows = 3, className = '', message }) {
    const shimmer = 'animate-pulse bg-white/10 rounded';

    // Página completa centrada
    if (variant === 'page') {
        return (
            <div className={`min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 flex items-center justify-center ${className}`}>
                <div className="text-center">
                    <div className="inline-block w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mb-4" />
                    <p className="text-white text-xl">{message || 'Cargando...'}</p>
                </div>
            </div>
        );
    }

    // Inline spinner simple
    if (variant === 'spinner') {
        return (
            <div className={`flex items-center justify-center gap-3 py-8 ${className}`}>
                <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
                {message && <span className="text-gray-300">{message}</span>}
            </div>
        );
    }

    // Banner/imagen
    if (variant === 'banner') {
        return (
            <div className={`space-y-4 ${className}`}>
                <div className={`${shimmer} h-48 w-full rounded-xl`} />
                <div className={`${shimmer} h-8 w-2/3`} />
                <div className={`${shimmer} h-4 w-1/2`} />
            </div>
        );
    }

    // Líneas de texto
    if (variant === 'text') {
        return (
            <div className={`space-y-3 ${className}`}>
                {Array.from({ length: rows }).map((_, i) => (
                    <div key={i} className={`${shimmer} h-4`} style={{ width: `${85 - i * 10}%` }} />
                ))}
            </div>
        );
    }

    // Tabla
    if (variant === 'table') {
        return (
            <div className={`bg-white/5 border border-white/10 rounded-xl overflow-hidden ${className}`}>
                <div className={`${shimmer} h-12 rounded-none`} />
                {Array.from({ length: rows }).map((_, i) => (
                    <div key={i} className="flex items-center gap-4 px-6 py-4 border-b border-white/5">
                        <div className={`${shimmer} h-6 w-8`} />
                        <div className={`${shimmer} h-6 flex-1`} />
                        <div className={`${shimmer} h-6 w-16`} />
                    </div>
                ))}
            </div>
        );
    }

    // Lista
    if (variant === 'list') {
        return (
            <div className={`space-y-3 ${className}`}>
                {Array.from({ length: rows }).map((_, i) => (
                    <div key={i} className="flex items-center gap-4 bg-white/5 border border-white/10 rounded-lg p-4">
                        <div className={`${shimmer} h-10 w-10 rounded-full`} />
                        <div className="flex-1 space-y-2">
                            <div className={`${shimmer} h-4 w-3/4`} />
                            <div className={`${shimmer} h-3 w-1/2`} />
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    // Formulario
    if (variant === 'form') {
        return (
            <div className={`space-y-6 ${className}`}>
                {Array.from({ length: rows }).map((_, i) => (
                    <div key={i} className="space-y-2">
                        <div className={`${shimmer} h-4 w-24`} />
                        <div className={`${shimmer} h-10 w-full`} />
                    </div>
                ))}
                <div className={`${shimmer} h-12 w-32`} />
            </div>
        );
    }

    // Card (default)
    return (
        <div className={`bg-white/5 border border-white/10 rounded-xl p-6 space-y-4 ${className}`}>
            <div className="flex items-center gap-4">
                <div className={`${shimmer} h-12 w-12 rounded-full`} />
                <div className="flex-1 space-y-2">
                    <div className={`${shimmer} h-5 w-2/3`} />
                    <div className={`${shimmer} h-3 w-1/3`} />
                </div>
            </div>
            {Array.from({ length: rows }).map((_, i) => (
                <div key={i} className={`${shimmer} h-4`} style={{ width: `${90 - i * 15}%` }} />
            ))}
        </div>
    );
}
