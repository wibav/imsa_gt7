/**
 * Componente de mensaje de error reutilizable.
 * 
 * @param {Object} props
 * @param {string|string[]} props.errors - Error(es) a mostrar
 * @param {string} [props.title] - Título del bloque de error
 * @param {Function} [props.onDismiss] - Callback para cerrar el mensaje
 * @param {'error'|'warning'|'info'} [props.variant='error'] - Variante visual
 * @param {string} [props.className] - Clases adicionales
 */
export default function ErrorMessage({ errors, title, onDismiss, variant = 'error', className = '' }) {
    if (!errors || (Array.isArray(errors) && errors.length === 0)) return null;

    const errorList = Array.isArray(errors) ? errors : [errors];

    const variants = {
        error: {
            bg: 'bg-red-500/20',
            border: 'border-red-500',
            text: 'text-red-200',
            icon: '❌',
            defaultTitle: 'Error',
        },
        warning: {
            bg: 'bg-yellow-500/20',
            border: 'border-yellow-500',
            text: 'text-yellow-200',
            icon: '⚠️',
            defaultTitle: 'Advertencia',
        },
        info: {
            bg: 'bg-blue-500/20',
            border: 'border-blue-500',
            text: 'text-blue-200',
            icon: 'ℹ️',
            defaultTitle: 'Información',
        },
    };

    const v = variants[variant] || variants.error;
    const displayTitle = title || (errorList.length > 1 ? v.defaultTitle : null);

    return (
        <div className={`${v.bg} border ${v.border} ${v.text} px-4 py-3 rounded-lg ${className}`}>
            <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                    {displayTitle && (
                        <p className="font-bold mb-1 flex items-center gap-2">
                            <span>{v.icon}</span>
                            {displayTitle}
                        </p>
                    )}
                    {errorList.length === 1 ? (
                        <p className="text-sm flex items-center gap-2">
                            {!displayTitle && <span>{v.icon}</span>}
                            {errorList[0]}
                        </p>
                    ) : (
                        <ul className="list-disc list-inside text-sm space-y-1">
                            {errorList.map((error, index) => (
                                <li key={index}>{error}</li>
                            ))}
                        </ul>
                    )}
                </div>
                {onDismiss && (
                    <button
                        onClick={onDismiss}
                        className="text-current opacity-60 hover:opacity-100 transition-opacity text-lg leading-none"
                    >
                        ×
                    </button>
                )}
            </div>
        </div>
    );
}
