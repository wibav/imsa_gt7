"use client";
import { useI18n } from '../../i18n';
import { enlaceComunidad } from '../../utils/comunidad';

const ICONO = 'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z';

export function IconoWhatsApp({ className = 'w-4 h-4' }) {
    return (
        <svg viewBox="0 0 24 24" className={`${className} fill-current flex-shrink-0`} aria-hidden="true">
            <path d={ICONO} />
        </svg>
    );
}

/**
 * Aviso para unirse a la comunidad de WhatsApp de la organización del
 * campeonato o evento (ver utils/comunidad.js). Sin enlace, no pinta nada.
 *
 * @param {string} orgId
 * @param {'tarjeta'|'compacto'|'ultimoPaso'} variante
 *   tarjeta: título, explicación y botón · compacto: una línea con botón
 *   (dentro de formularios) · ultimoPaso: confirmación de inscripción
 */
export default function AvisoComunidad({ orgId, org, variante = 'tarjeta', className = '' }) {
    const { t } = useI18n();
    const url = enlaceComunidad({ orgId, org });
    if (!url) return null;

    const boton = (
        <a href={url} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-1.5 bg-green-500 hover:bg-green-400 text-white text-sm font-bold px-4 py-2 rounded-full transition-colors whitespace-nowrap">
            <IconoWhatsApp />
            {t('comun.comunidad.boton')}
        </a>
    );

    if (variante === 'compacto') {
        return (
            <div className={`flex flex-wrap items-center gap-3 bg-green-500/10 border border-green-500/30 rounded-lg px-3 py-2 ${className}`}>
                <p className="text-green-100 text-xs flex-1 min-w-[12rem]">
                    💬 <strong>{t('comun.comunidad.titulo')}</strong>. {t('comun.comunidad.texto')}
                </p>
                {boton}
            </div>
        );
    }

    return (
        <div className={`bg-green-500/10 border border-green-500/40 rounded-xl p-4 text-left ${className}`}>
            <p className="text-green-200 font-semibold text-sm flex items-center gap-2">
                <IconoWhatsApp className="w-5 h-5 text-green-400" />
                {variante === 'ultimoPaso' ? t('comun.comunidad.ultimoPaso') : t('comun.comunidad.titulo')}
            </p>
            <p className="text-green-100/80 text-xs mt-1 mb-3">{t('comun.comunidad.texto')}</p>
            {boton}
        </div>
    );
}
