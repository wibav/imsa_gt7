"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useI18n } from "../i18n";
import { leerConsentimiento, guardarConsentimiento, useAbrirPreferencias, abrirPreferenciasCookies } from "../utils/consentimiento";

/**
 * Aviso de cookies: aparece en la primera visita (y al subir la versión del
 * consentimiento) y desde el enlace «Configurar cookies» del pie.
 *
 * «Rechazar» y «Aceptar» tienen el mismo peso visual, como pide la guía de
 * cookies de la AEPD: rechazar no puede costar más que aceptar.
 */
export default function AvisoCookies() {
    const { t } = useI18n();
    const [visible, setVisible] = useState(false);
    const [detalle, setDetalle] = useState(false);
    const [analitica, setAnalitica] = useState(false);
    const [publicidad, setPublicidad] = useState(false);

    // Solo en el cliente: el HTML estático no lleva el aviso
    useEffect(() => {
        if (!leerConsentimiento()) setVisible(true);
    }, []);

    const abrir = useCallback(() => {
        const actual = leerConsentimiento();
        setAnalitica(!!actual?.analitica);
        setPublicidad(!!actual?.publicidad);
        setDetalle(true);
        setVisible(true);
    }, []);
    useAbrirPreferencias(abrir);

    if (!visible) return null;

    const decidir = (valores) => {
        setVisible(false);
        setDetalle(false);
        guardarConsentimiento(valores);
    };

    const boton = 'px-4 py-2 rounded-lg text-sm font-semibold transition-colors';
    const secundario = `${boton} bg-white/10 hover:bg-white/20 border border-white/25 text-white`;

    return (
        <div className="fixed inset-x-0 bottom-0 z-[60] p-3 sm:p-4" role="dialog" aria-modal="false" aria-labelledby="aviso-cookies-titulo">
            <div className="max-w-3xl mx-auto bg-slate-900/95 backdrop-blur border border-white/15 rounded-2xl shadow-2xl p-4 sm:p-5 text-sm text-gray-200">
                <h2 id="aviso-cookies-titulo" className="text-white font-bold text-base mb-1">🍪 {t('cookies.titulo')}</h2>
                <p className="text-gray-300">
                    {t('cookies.texto')}{' '}
                    <Link href="/privacidad#cookies" className="text-orange-300 underline hover:text-orange-200">{t('cookies.masInfo')}</Link>
                </p>

                {detalle && (
                    <div className="mt-4 space-y-2">
                        <Opcion titulo={t('cookies.necesarias')} texto={t('cookies.necesariasTexto')} activa bloqueada etiqueta={t('cookies.siempre')} />
                        <Opcion titulo={t('cookies.analitica')} texto={t('cookies.analiticaTexto')} activa={analitica} onCambiar={setAnalitica} />
                        <Opcion titulo={t('cookies.publicidad')} texto={t('cookies.publicidadTexto')} activa={publicidad} onCambiar={setPublicidad} />
                    </div>
                )}

                <div className="mt-4 flex flex-col-reverse sm:flex-row sm:flex-wrap sm:justify-end gap-2">
                    {detalle ? (
                        <button onClick={() => decidir({ analitica, publicidad })} className={secundario}>
                            {t('cookies.guardar')}
                        </button>
                    ) : (
                        <button onClick={abrir} className={secundario}>{t('cookies.configurar')}</button>
                    )}
                    <button onClick={() => decidir({ analitica: false, publicidad: false })} className={secundario}>
                        {t('cookies.rechazar')}
                    </button>
                    <button onClick={() => decidir({ analitica: true, publicidad: true })} className={secundario}>
                        {t('cookies.aceptar')}
                    </button>
                </div>
            </div>
        </div>
    );
}

function Opcion({ titulo, texto, activa, bloqueada = false, etiqueta, onCambiar }) {
    return (
        <label className={`flex items-start gap-3 rounded-lg border border-white/10 bg-white/5 p-3 ${bloqueada ? '' : 'cursor-pointer'}`}>
            <input
                type="checkbox"
                checked={activa}
                disabled={bloqueada}
                onChange={e => onCambiar?.(e.target.checked)}
                className="mt-1 w-4 h-4 accent-orange-500"
            />
            <span className="flex-1">
                <span className="text-white font-semibold">{titulo}</span>
                {etiqueta && <span className="ml-2 text-xs text-gray-400">{etiqueta}</span>}
                <span className="block text-gray-400 text-xs mt-0.5">{texto}</span>
            </span>
        </label>
    );
}

/** Botón para reabrir las preferencias desde páginas de servidor (privacidad). */
export function BotonPreferenciasCookies() {
    return (
        <button
            type="button"
            onClick={abrirPreferenciasCookies}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-white/10 hover:bg-white/20 border border-white/25 text-white transition-colors"
        >
            🍪 Configurar cookies
        </button>
    );
}
