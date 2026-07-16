"use client";
import { createContext, useContext, useEffect, useState } from 'react';
import {
    signInWithEmailAndPassword,
    signOut,
    onIdTokenChanged
} from 'firebase/auth';
import { auth } from '../api/firebase/firebaseConfig';

const AuthContext = createContext();

export function useAuth() {
    return useContext(AuthContext);
}

export function AuthProvider({ children }) {
    const [currentUser, setCurrentUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [claims, setClaims] = useState({}); // { admin?: true, comisario?: true }

    // Login function
    const login = async (email, password) => {
        try {
            const result = await signInWithEmailAndPassword(auth, email, password);
            return result;
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

    // Check if user is admin — fuente de verdad: Custom Claim del token
    // (asignado por la Cloud Function manage_user_role, Admin SDK).
    const isAdmin = () => {
        return !!(currentUser && claims.admin);
    };

    // Check if user is comisario (puede ver pistas y reclamaciones)
    // Los admins también son comisarios automáticamente
    const isComisario = () => {
        if (!currentUser) return false;
        return !!(claims.admin || claims.comisario);
    };

    // Fuerza refrescar el token para tomar cambios de rol recientes
    // (los custom claims solo viajan en el ID token tras un refresh).
    const refreshClaims = async () => {
        if (!currentUser) return;
        const result = await currentUser.getIdTokenResult(true);
        setClaims(result.claims || {});
    };

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
                    const result = await user.getIdTokenResult();
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
        logout,
        isAdmin,
        isComisario,
        refreshClaims,
        loading
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
}
