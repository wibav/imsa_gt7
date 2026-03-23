"use client";
import { createContext, useContext, useEffect, useState } from 'react';
import {
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged
} from 'firebase/auth';
import { auth } from '../api/firebase/firebaseConfig';

const AuthContext = createContext();

export function useAuth() {
    return useContext(AuthContext);
}

export function AuthProvider({ children }) {
    const [currentUser, setCurrentUser] = useState(null);
    const [loading, setLoading] = useState(true);

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
        } catch (error) {
            throw error;
        }
    };

    // Check if user is admin
    const isAdmin = () => {
        // Lista de emails autorizados como admin
        const adminEmails = [
            'eric.jce@gmail.com',
            'wolcutor@gmail.com',
            'yecherm@hotmail.com',
            'storricosan@gmail.com',
            'ojervoley@hotmail.com',
            'griffi@mail.com'
        ];

        return currentUser && adminEmails.includes(currentUser.email);
    };

    // Check if user is comisario (puede ver pistas y reclamaciones)
    // Los admins también son comisarios automáticamente
    const isComisario = () => {
        const comisarioEmails = [
            // Agregar emails de comisarios aquí
        ];

        return currentUser && (
            comisarioEmails.includes(currentUser.email) ||
            isAdmin()  // Los admins siempre tienen permisos de comisario
        );
    };

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setCurrentUser(user);
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
        loading
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
}