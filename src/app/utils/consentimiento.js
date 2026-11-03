"use client";
import { useEffect, useState } from "react";

/**
 * Consentimiento de cookies (directiva ePrivacy, RGPD, LSSI art. 22.2).
 *
 * Google Analytics (Firebase Analytics) y Google AdSense no se cargan hasta
 * que el visitante los acepta en el aviso de cookies (AvisoCookies). Lo
 * técnico (el idioma elegido, el campeonato seleccionado, la sesión del
 * panel) no necesita consentimiento y funciona siempre.
 *
 * La elección se guarda en localStorage —eso sí es técnico— con una versión:
 * si cambian las categorías, se sube VERSION y se vuelve a preguntar.
 */

const CLAVE = 'gt7-cookies';
const VERSION = 1;
const EVENTO_CAMBIO = 'gt7:consentimiento';
const EVENTO_ABRIR = 'gt7:abrir-cookies';

// Cookies que dejan Google Analytics y AdSense, para borrarlas al retirar el
// consentimiento.
const PREFIJOS_COOKIES = {
    analitica: ['_ga', '_gid', '_gat', '_gcl'],
    publicidad: ['__gads', '__gpi', '__eoi', '_gcl', 'IDE', 'DSID'],
};

/** Elección guardada { analitica, publicidad, fecha, version }, o null si no hay. */
export function leerConsentimiento() {
    try {
        const valor = JSON.parse(localStorage.getItem(CLAVE) || 'null');
        return valor && valor.version === VERSION ? valor : null;
    } catch {
        return null;
    }
}

function borrarCookies(prefijos) {
    const dominios = ['', window.location.hostname, `.${window.location.hostname.split('.').slice(-2).join('.')}`];
    document.cookie.split(';').map(c => c.split('=')[0].trim()).forEach(nombre => {
        if (!prefijos.some(p => nombre.startsWith(p))) return;
        dominios.forEach(d => {
            document.cookie = `${nombre}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/${d ? `; domain=${d}` : ''}`;
        });
    });
}

/**
 * Guarda la elección. Si se retira un consentimiento que estaba dado, se
 * borran sus cookies y se recarga la página: los scripts de Google ya
 * cargados no se pueden descargar de otra forma.
 */
export function guardarConsentimiento({ analitica, publicidad }) {
    const anterior = leerConsentimiento();
    const nuevo = { analitica: !!analitica, publicidad: !!publicidad, fecha: new Date().toISOString(), version: VERSION };
    try { localStorage.setItem(CLAVE, JSON.stringify(nuevo)); } catch { /* modo privado: solo para esta visita */ }

    const retirados = ['analitica', 'publicidad'].filter(k => anterior?.[k] && !nuevo[k]);
    if (retirados.length > 0) {
        borrarCookies(retirados.flatMap(k => PREFIJOS_COOKIES[k]));
        window.location.reload();
        return;
    }
    window.dispatchEvent(new CustomEvent(EVENTO_CAMBIO, { detail: nuevo }));
}

/** Abre el panel de preferencias (enlace «Configurar cookies» del pie). */
export function abrirPreferenciasCookies() {
    window.dispatchEvent(new Event(EVENTO_ABRIR));
}

/** Elección actual, actualizada al cambiar. null hasta montar o si no hay. */
export function useConsentimiento() {
    const [consentimiento, setConsentimiento] = useState(null);
    useEffect(() => {
        setConsentimiento(leerConsentimiento());
        const alCambiar = (e) => setConsentimiento(e.detail);
        window.addEventListener(EVENTO_CAMBIO, alCambiar);
        return () => window.removeEventListener(EVENTO_CAMBIO, alCambiar);
    }, []);
    return consentimiento;
}

/** Suscripción a la orden de abrir las preferencias. */
export function useAbrirPreferencias(alAbrir) {
    useEffect(() => {
        window.addEventListener(EVENTO_ABRIR, alAbrir);
        return () => window.removeEventListener(EVENTO_ABRIR, alAbrir);
    }, [alAbrir]);
}
