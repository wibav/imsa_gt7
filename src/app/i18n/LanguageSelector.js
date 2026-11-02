"use client";
import { IDIOMAS, useI18n } from "./index";

/** Selector ES / EN / PT de la cabecera pública. */
export default function LanguageSelector({ className = '' }) {
    const { lang, setLang, t } = useI18n();
    return (
        <div role="group" aria-label={t('nav.idioma')}
            className={`inline-flex rounded-lg bg-white/10 p-0.5 backdrop-blur-sm ${className}`}>
            {IDIOMAS.map(i => (
                <button
                    key={i.id}
                    type="button"
                    onClick={() => setLang(i.id)}
                    aria-pressed={lang === i.id}
                    title={i.etiqueta}
                    lang={i.id}
                    className={`px-2.5 py-1.5 rounded-md text-xs font-bold transition-colors ${lang === i.id
                        ? 'bg-white text-gray-900'
                        : 'text-white/80 hover:text-white hover:bg-white/10'}`}
                >
                    {i.corta}
                </button>
            ))}
        </div>
    );
}
