"use client";
import { createContext, useContext, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { onIdTokenChanged } from 'firebase/auth';
import { auth } from '../api/firebase/firebaseConfig';
import { FirebaseService } from '../services/firebaseService';
import { parseOrgSlugFromPath } from '../utils/orgRouting';

const OrganizationContext = createContext();

export const DEFAULT_ORG_ID = 'gt7-esp';

// Rutas de panel admin: no usan el prefijo /l/{slug} (son internas, no
// públicas), así que sin este listado SIEMPRE resolverían a gt7-esp sin
// importar la organización real del usuario logueado — un organizador de
// cualquier otra org jamás podría gestionar la suya. Ver "resolve()" abajo:
// para estas rutas, la organización activa se toma de los propios claims
// del usuario en vez de la URL.
const ADMIN_ROUTE_PREFIXES = [
    '/usersAdmin', '/championshipsAdmin', '/eventsAdmin', '/tracksAdmin',
    '/teamsAdmin', '/facturacion', '/equipamientoAdmin',
];

function isAdminRoute(pathname) {
    return ADMIN_ROUTE_PREFIXES.some(p => pathname?.startsWith(p));
}

export function useOrganization() {
    return useContext(OrganizationContext);
}

/**
 * Resuelve la organización activa (Fase 3 — SPEC-3, extendido en Fase 4
 * para rutas admin).
 *
 * - Si el path usa el prefijo /l/{slug}, resuelve esa organización contra
 *   Firestore (por su campo `slug`) — páginas públicas de una org concreta.
 * - Si es una ruta de panel admin (ADMIN_ROUTE_PREFIXES) y el usuario tiene
 *   sesión con claims de UNA sola organización, se usa esa — así el
 *   organizador de cualquier org (no solo gt7-esp) administra la suya.
 *   Con cero o más de una org en los claims, se usa el default (ambiguo;
 *   pendiente un selector de organización para usuarios multi-org).
 * - Cualquier otra ruta (/, /championships, /reglamento…): organización por
 *   defecto (`gt7-esp`) — comportamiento idéntico al de antes del tenant
 *   routing, y a propósito (la vista raíz agrega todas las orgs con GT7 ESP
 *   priorizada).
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
    // null = todavía no se sabe (esperar antes de resolver rutas admin);
    // [] = sin sesión o sin organizaciones.
    const [authOrgIds, setAuthOrgIds] = useState(null);

    useEffect(() => {
        const unsubscribe = onIdTokenChanged(auth, async (user) => {
            if (!user) {
                setAuthOrgIds([]);
                return;
            }
            try {
                const result = await user.getIdTokenResult();
                setAuthOrgIds(Object.keys(result.claims.orgs || {}));
            } catch {
                setAuthOrgIds([]);
            }
        });
        return unsubscribe;
    }, []);

    useEffect(() => {
        let cancelled = false;
        const needsAuthOrg = isAdminRoute(pathname) && !parseOrgSlugFromPath(pathname);

        // En rutas admin, esperar a saber los claims del usuario antes de
        // resolver — si no, se vería brevemente (o se filtraría) gt7-esp.
        if (needsAuthOrg && authOrgIds === null) {
            setLoading(true);
            return;
        }

        async function resolve() {
            setLoading(true);
            setNotFound(false);

            const slug = parseOrgSlugFromPath(pathname);
            let orgId;
            if (slug) {
                orgId = slug;
            } else if (needsAuthOrg && authOrgIds.length === 1) {
                orgId = authOrgIds[0];
            } else {
                orgId = DEFAULT_ORG_ID;
            }

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
    }, [pathname, authOrgIds]);

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
