"use client";
import { createContext, useContext, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { FirebaseService } from '../services/firebaseService';
import { parseOrgSlugFromPath } from '../utils/orgRouting';

const OrganizationContext = createContext();

export const DEFAULT_ORG_ID = 'gt7-esp';

export function useOrganization() {
    return useContext(OrganizationContext);
}

/**
 * Resuelve la organización activa a partir de la URL (Fase 3 — SPEC-3).
 *
 * - Si el path usa el prefijo /l/{slug}, resuelve esa organización contra
 *   Firestore (por su campo `slug`).
 * - Si no (todas las rutas existentes hoy: /, /championships, /reglamento…),
 *   usa la organización por defecto (`gt7-esp`) — comportamiento idéntico al
 *   que tenía la app antes de que existiera tenant routing.
 *
 * FirebaseService es una clase estática (no puede leer contexto de React
 * directamente), así que apenas se resuelve la organización se llama a
 * FirebaseService.setCurrentOrgId() para que las queries existentes
 * (getChampionships, getEvents, getTeams…) queden scopeadas correctamente.
 */
export function OrganizationProvider({ children }) {
    const pathname = usePathname();
    const [org, setOrg] = useState(null);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);

    useEffect(() => {
        let cancelled = false;

        async function resolve() {
            setLoading(true);
            setNotFound(false);

            const slug = parseOrgSlugFromPath(pathname);
            const orgId = slug || DEFAULT_ORG_ID;

            const data = await FirebaseService.getOrganization(orgId);

            if (cancelled) return;

            if (!data) {
                // orgId inexistente: se fija igual. Ningún documento real
                // tendrá jamás ese orgId, así que cualquier query de un
                // provider hijo (aunque ClientLayout ya muestre el 404 en
                // vez de children) devuelve vacío de forma segura, nunca
                // datos de otra organización.
                FirebaseService.setCurrentOrgId(orgId);
                setNotFound(true);
                setOrg(null);
                setLoading(false);
                return;
            }

            FirebaseService.setCurrentOrgId(data.id);
            setOrg(data);
            setLoading(false);
        }

        resolve();
        return () => { cancelled = true; };
    }, [pathname]);

    // isRootView: true cuando la URL NO usa el prefijo /l/{slug} (la raíz y
    // todas las demás rutas del sistema). En ese caso el Dashboard muestra
    // una vista agregada de todas las organizaciones (ver DashboardRenovated),
    // mientras que /l/{slug} muestra únicamente los datos de esa organización.
    const value = {
        org,
        orgId: org?.id || DEFAULT_ORG_ID,
        slug: parseOrgSlugFromPath(pathname),
        isRootView: !parseOrgSlugFromPath(pathname),
        loading,
        notFound,
    };

    // Crítico para el aislamiento multi-tenant: no montar nada por debajo
    // (ChampionshipProvider, DashboardRenovated, etc.) hasta que se resuelva
    // la organización y FirebaseService.setCurrentOrgId() ya se haya
    // llamado. Sin este gate, los efectos de fetch de los providers hijos
    // corren en paralelo con esta resolución async y pueden alcanzar a leer
    // el orgId por defecto anterior — se detectó como fuga real de datos
    // entre organizaciones al probar con una segunda org real.
    return (
        <OrganizationContext.Provider value={value}>
            {!loading && children}
        </OrganizationContext.Provider>
    );
}
