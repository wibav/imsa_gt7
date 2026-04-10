"use client";
import { createContext, useContext, useEffect, useState } from 'react';
import {
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged
} from 'firebase/auth';
import { auth } from '../api/firebase/firebaseConfig';
import { FirebaseService } from '../services/firebaseService';

const AuthContext = createContext();

export const ADMIN_EMAILS = [
    'eric.jce@gmail.com',
    'wolcutor@gmail.com',
    'yecherm@hotmail.com',
    'storricosan@gmail.com',
    'ojervoley@hotmail.com'
];

export function useAuth() {
    return useContext(AuthContext);
}

export function AuthProvider({ children }) {
    const [currentUser, setCurrentUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [userRole, setUserRole] = useState(null); // null | 'comisario'

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
            setUserRole(null);
        } catch (error) {
            throw error;
        }
    };

    // Check if user is admin
    const isAdmin = () => {
        return currentUser && ADMIN_EMAILS.includes(currentUser.email);
    };

    // Check if user is comisario (puede ver pistas y reclamaciones)
    // Los admins también son comisarios automáticamente
    const isComisario = () => {
        if (!currentUser) return false;
        if (isAdmin()) return true; // Admins siempre tienen permisos de comisario
        return userRole === 'comisario';
    };

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            setCurrentUser(user);
            if (user) {
                // Cargar rol desde Firestore (solo si no es admin hardcodeado)
                try {
                    const roleData = await FirebaseService.getUserRoleByEmail(user.email);
                    setUserRole(roleData?.role || null);
                } catch {
                    setUserRole(null);
                }
            } else {
                setUserRole(null);
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
        userRole,
        loading
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
}