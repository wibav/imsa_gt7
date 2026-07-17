"use client";
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    sendPasswordResetEmail,
    signOut,
    onIdTokenChanged
} from 'firebase/auth';
import { auth } from '../api/firebase/firebaseConfig';
import { useOrganization } from './OrganizationContext';

const AuthContext = createContext();

// Jerarquía de roles dentro de una organización (ADR-006 resuelto —
// Fase 2). Un rol superior incluye los permisos de los inferiores en esa
// misma organización.
const ROLE_RANK = { comisario: 1, director_liga: 2, organizador: 3 };

export function useAuth() {
    return useContext(AuthContext);
}

export function AuthProvider({ children }) {
    const [currentUser, setCurrentUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [claims, setClaims] = useState({}); // { platformOwner?: true, orgs?: { [orgId]: role } }
    // AuthProvider vive DENTRO de OrganizationProvider (ver layout.js), así
    // que puede leer qué organización está activa para hacer los checks de
    // rol org-scoped sin que cada call site (Navbar, ProtectedRoute,
    // championshipsAdmin, etc.) tenga que pasar el orgId explícitamente.
    const { orgId } = useOrganization();

    // Login function
    const login = async (email, password) => {
        try {
            const result = await signInWithEmailAndPassword(auth, email, password);
            return result;
        } catch (error) {
            throw error;
        }
    };

    // Crear cuenta nueva (flujo self-service de alta de organización —
    // ver /signup). No asigna ningún rol por sí sola: la Cloud Function
    // create_organization es quien otorga 'organizador' tras crear la org.
    const signup = async (email, password) => {
        try {
            const result = await createUserWithEmailAndPassword(auth, email, password);
            return result;
        } catch (error) {
            throw error;
        }
    };

    // Enviar email de recuperación de contraseña (Firebase se encarga del
    // envío y del flujo de reseteo, no hay página propia que mantener).
    const resetPassword = async (email) => {
        try {
            await sendPasswordResetEmail(auth, email);
        } catch (error) {
            throw error;
        }
    };

    // Logout function
    const logout = async () => {
        try {
            await signOut(auth);
            setClaims({});
        } catch (error) {
            throw error;
        }
    };

    const currentOrgRole = () => (claims.orgs || {})[orgId] || null;
    const currentOrgRank = () => ROLE_RANK[currentOrgRole()] || 0;

    // Check if user administra la organización activa (director_liga u
    // organizador) — fuente de verdad: Custom Claim del token, org-scoped
    // (asignado por la Cloud Function manage_user_role, Admin SDK).
    const isAdmin = () => {
        return !!(currentUser && currentOrgRank() >= ROLE_RANK.director_liga);
    };

    // Check if user es comisario de la organización activa (puede ver
    // pistas y reclamaciones). director_liga/organizador también cuentan.
    const isComisario = () => {
        return !!(currentUser && currentOrgRank() >= ROLE_RANK.comisario);
    };

    // Administrador de Plataforma (dueño de trenkit) — rol de plataforma,
    // por encima de todas las organizaciones. Distinto de isAdmin() (que es
    // por-organización). Solo wolcutor@gmail.com lo tiene (otorgado una
    // única vez, no vía el flujo normal de gestión de roles — ver ADR-006 y
    // scripts/grant-platform-owner.js).
    const isPlatformOwner = () => {
        return !!(currentUser && claims.platformOwner);
    };

    // Fuerza refrescar el token para tomar cambios de rol recientes
    // (los custom claims solo viajan en el ID token tras un refresh).
    const refreshClaims = async () => {
        if (!currentUser) return;
        const result = await currentUser.getIdTokenResult(true);
        setClaims(result.claims || {});
    };

    // Solo fuerza un refresh la PRIMERA vez que el listener ve un usuario
    // real por carga de página — forzar en cada disparo del listener
    // re-dispararía onIdTokenChanged indefinidamente (un refresh forzado
    // mintea un token nuevo, lo que a su vez dispara el evento otra vez).
    const forcedOnceRef = useRef(false);

    useEffect(() => {
        // onIdTokenChanged (no onAuthStateChanged): dispara en login/logout Y en
        // cada refresco automático del ID token (~1h), que es el único momento
        // en que los custom claims recién asignados por un admin llegan al
        // cliente. Con onAuthStateChanged, un rol otorgado mientras la pestaña
        // ya estaba abierta no se reflejaría hasta recargar la página.
        const unsubscribe = onIdTokenChanged(auth, async (user) => {
            setCurrentUser(user);
            if (user) {
                try {
                    // Forzado solo la primera vez: un claim recién otorgado
                    // (ej. al crear una organización en /signup) puede no
                    // estar todavía en el token persistido si esta es la
                    // primera carga de página tras el cambio — sin esto,
                    // isAdmin() devolvía false pese a que el rol ya estaba
                    // bien asignado en el servidor.
                    const forceThisTime = !forcedOnceRef.current;
                    forcedOnceRef.current = true;
                    const result = await user.getIdTokenResult(forceThisTime);
                    setClaims(result.claims || {});
                } catch {
                    setClaims({});
                }
            } else {
                setClaims({});
            }
            setLoading(false);
        });

        return unsubscribe;
    }, []);

    const value = {
        currentUser,
        login,
        signup,
        resetPassword,
        logout,
        isAdmin,
        isComisario,
        isPlatformOwner,
        currentOrgRole,
        refreshClaims,
        loading
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
}
