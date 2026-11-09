/**
 * Descargo del piloto acusado (reglamento general, 6.6.3 y 8.3.1).
 *
 * Cada reclamación se publica en la web en cuanto se presenta. Desde ese
 * momento, cada piloto acusado tiene PLAZO_DESCARGO_HORAS para dar su versión
 * y aportar su vídeo antes de que los comisarios resuelvan. Un descargo por
 * piloto y reclamación: el id del documento lo garantiza.
 */
import { claveNombre } from './nombresPiloto.js';

export const PLAZO_DESCARGO_HORAS = 24;
export const DESCARGO_MIN = 10;
export const DESCARGO_MAX = 4000;
export const ESTADOS_EN_ESTUDIO = ['pending', 'reviewing'];

/** Pilotos acusados en una reclamación (también el formato antiguo, accusedName). */
export function acusadosDe(claim) {
    if (claim?.accusedNames?.length > 0) return claim.accusedNames;
    return claim?.accusedName ? [claim.accusedName] : [];
}

/** Id del documento: uno por reclamación y piloto. */
export function idDescargo(claimId, piloto) {
    const slug = claveNombre(piloto).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'piloto';
    return `${claimId}__${slug}`.slice(0, 200);
}

/** Fecha de un descargo o reclamación: ISO o Timestamp de Firestore. */
export function aFecha(valor) {
    if (!valor) return null;
    if (typeof valor.toDate === 'function') return valor.toDate();
    const d = new Date(valor);
    return isNaN(d.getTime()) ? null : d;
}

/**
 * Plazo de descargo de una reclamación: abierto mientras esté en estudio y
 * no hayan pasado PLAZO_DESCARGO_HORAS desde que se publicó.
 */
export function plazoDescargo(claim, ahora = new Date()) {
    const publicada = aFecha(claim?.createdAt);
    if (!publicada) return { abierto: false, vence: null };
    const vence = new Date(publicada.getTime() + PLAZO_DESCARGO_HORAS * 3600000);
    return {
        abierto: ESTADOS_EN_ESTUDIO.includes(claim?.status || 'pending') && ahora <= vence,
        vence,
    };
}

/** Descargos presentados en una reclamación. */
export const descargosDe = (claim, defenses = []) => defenses.filter(d => d.claimId === claim?.id);

/** Acusados que aún no han presentado descargo. */
export function acusadosSinDescargo(claim, defenses = []) {
    const hechos = new Set(descargosDe(claim, defenses).map(d => claveNombre(d.accusedName)));
    return acusadosDe(claim).filter(n => !hechos.has(claveNombre(n)));
}
