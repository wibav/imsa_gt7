"use client";
import { createContext, startTransition, useCallback, useContext, useEffect, useMemo, useState } from "react";
import TEXTOS from "./textos";

/**
 * Idioma de la parte pública (pilotos): español, inglés y portugués.
 *
 * El sitio es una exportación estática sin rutas dinámicas, así que el idioma
 * no va en la URL: se elige en el navegador (la primera vez por el idioma del
 * propio navegador) y se recuerda en localStorage. El HTML generado y el SEO
 * quedan en español. El panel de administración no se traduce.
 *
 * Los textos viven en ./textos/<área>.js, con los tres idiomas juntos para
 * que no se desincronicen. Uso:
 *
 *   const { t, lang, locale } = useI18n();
 *   t('nav.pilotos')                    → «🏎️ Pilotos»
 *   t('campeonato.pilotos', { n: 3 })   → «3 pilotos» (claves _one / _other)
 *
 * Una clave sin traducir cae al español; una que no existe devuelve la clave.
 */

export const IDIOMAS = [
    { id: 'es', etiqueta: 'Español', corta: 'ES', bandera: '🇪🇸', locale: 'es-ES' },
    { id: 'en', etiqueta: 'English', corta: 'EN', bandera: '🇬🇧', locale: 'en-GB' },
    { id: 'pt', etiqueta: 'Português', corta: 'PT', bandera: '🇵🇹', locale: 'pt-PT' },
];

const CLAVE_STORAGE = 'gt7-idioma';

const buscar = (lang, clave) => {
    const [area, ...resto] = clave.split('.');
    let nodo = TEXTOS[area]?.[lang];
    for (const parte of resto) {
        if (nodo == null) return undefined;
        nodo = nodo[parte];
    }
    return nodo;
};

/** Traducción sin React (para utilidades que reciben el idioma). */
export function traducir(lang, clave, vars) {
    let clavePlural = null;
    if (vars && typeof vars.n === 'number') clavePlural = `${clave}_${vars.n === 1 ? 'one' : 'other'}`;
    const valor = (clavePlural && (buscar(lang, clavePlural) ?? buscar('es', clavePlural)))
        ?? buscar(lang, clave) ?? buscar('es', clave);
    if (valor == null) return clave;
    if (typeof valor !== 'string' || !vars) return valor;
    return valor.replace(/\{(\w+)\}/g, (m, k) => (vars[k] ?? m));
}

/**
 * Nombre (o descripción) de una sanción en el idioma pedido. Las del
 * catálogo se traducen por su presetId; las personalizadas, y todas en
 * español, se muestran tal como las guardó el comisario.
 */
export function textoSancion(penalty, lang, campo = 'nombre') {
    const original = campo === 'nombre' ? (penalty?.name || '') : (penalty?.description || '');
    if (lang === 'es' || !penalty?.presetId) return original;
    return buscar(lang, `sanciones.presets.${penalty.presetId}.${campo}`) || original;
}

/** Idioma inicial: el guardado, o el del navegador si es uno de los nuestros. */
function idiomaInicial() {
    try {
        const guardado = localStorage.getItem(CLAVE_STORAGE);
        if (IDIOMAS.some(i => i.id === guardado)) return guardado;
    } catch { /* sin localStorage: modo privado, vista previa… */ }
    const delNavegador = (typeof navigator !== 'undefined' ? navigator.languages || [navigator.language] : [])
        .map(l => String(l || '').slice(0, 2).toLowerCase())
        .find(l => IDIOMAS.some(i => i.id === l));
    return delNavegador || 'es';
}

const I18nContext = createContext({
    lang: 'es',
    locale: 'es-ES',
    setLang: () => {},
    t: (clave, vars) => traducir('es', clave, vars),
});

export function LanguageProvider({ children }) {
    // Siempre 'es' en el primer render: es lo que trae el HTML estático, y así
    // la hidratación no choca. Justo después se pasa al idioma del visitante,
    // como transición: las partes que aún se están hidratando (las páginas con
    // useSearchParams van dentro de un Suspense) terminan antes con el español
    // del HTML, en vez de chocar con el texto ya traducido (error #418).
    const [lang, setLangState] = useState('es');

    useEffect(() => {
        const inicial = idiomaInicial();
        if (inicial !== 'es') startTransition(() => setLangState(inicial));
    }, []);

    useEffect(() => {
        document.documentElement.lang = lang;
    }, [lang]);

    const setLang = useCallback((nuevo) => {
        if (!IDIOMAS.some(i => i.id === nuevo)) return;
        setLangState(nuevo);
        try { localStorage.setItem(CLAVE_STORAGE, nuevo); } catch { /* ver idiomaInicial */ }
    }, []);

    const valor = useMemo(() => ({
        lang,
        locale: IDIOMAS.find(i => i.id === lang)?.locale || 'es-ES',
        setLang,
        t: (clave, vars) => traducir(lang, clave, vars),
    }), [lang, setLang]);

    return <I18nContext.Provider value={valor}>{children}</I18nContext.Provider>;
}

export const useI18n = () => useContext(I18nContext);
