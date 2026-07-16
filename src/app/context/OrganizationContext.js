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

    const value = { org, orgId: org?.id || DEFAULT_ORG_ID, loading, notFound };

    return (
        <OrganizationContext.Provider value={value}>
            {children}
        </OrganizationContext.Provider>
    );
}
