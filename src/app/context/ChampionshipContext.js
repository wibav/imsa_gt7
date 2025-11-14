"use client";

import { createContext, useContext, useState, useEffect } from 'react';
import { FirebaseService } from '../services/firebaseService';

const ChampionshipContext = createContext();

/**
 * Hook personalizado para usar el contexto de campeonatos
 */
export function useChampionship() {
    const context = useContext(ChampionshipContext);
    if (!context) {
        throw new Error('useChampionship debe ser usado dentro de ChampionshipProvider');
    }
    return context;
}

/**
 * Provider del contexto de campeonatos
 * Gestiona el estado global de campeonatos y el campeonato seleccionado
 */
export function ChampionshipProvider({ children }) {
    // Estado
    const [championships, setChampionships] = useState([]);
    const [selectedChampionship, setSelectedChampionship] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    /**
     * Cargar todos los campeonatos al montar el componente
     */
    useEffect(() => {
        loadChampionships();
    }, []);

    /**
     * Recuperar campeonato seleccionado desde localStorage al montar
     */
    useEffect(() => {
        const savedChampionshipId = localStorage.getItem('selectedChampionshipId');
        if (savedChampionshipId && championships.length > 0) {
            const championship = championships.find(c => c.id === savedChampionshipId);
            if (championship) {
                setSelectedChampionship(championship);
            } else {
                // Si no existe, seleccionar el primer campeonato activo
                selectFirstActiveChampionship();
            }
        } else if (championships.length > 0) {
            // Si no hay campeonato guardado, seleccionar el primero activo
            selectFirstActiveChampionship();
        }
    }, [championships]);

    /**
     * Guardar campeonato seleccionado en localStorage cuando cambie
     */
    useEffect(() => {
        if (selectedChampionship) {
            localStorage.setItem('selectedChampionshipId', selectedChampionship.id);
        }
    }, [selectedChampionship]);

    /**
     * Cargar todos los campeonatos desde Firebase
     */
    const loadChampionships = async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await FirebaseService.getChampionships();
            setChampionships(data);
        } catch (err) {
            console.error('Error cargando campeonatos:', err);
            setError('Error al cargar los campeonatos');
        } finally {
            setLoading(false);
        }
    };

    /**
     * Seleccionar el primer campeonato activo
     */
    const selectFirstActiveChampionship = () => {
        const activeChampionship = championships.find(c => c.status === 'active');
        if (activeChampionship) {
            setSelectedChampionship(activeChampionship);
        } else if (championships.length > 0) {
            // Si no hay activos, seleccionar el primero
            setSelectedChampionship(championships[0]);
        }
    };

    /**
     * Seleccionar un campeonato por ID
     */
    const selectChampionship = (championshipId) => {
        const championship = championships.find(c => c.id === championshipId);
        if (championship) {
            setSelectedChampionship(championship);
            return true;
        }
        return false;
    };

    /**
     * Crear un nuevo campeonato
     */
    const createChampionship = async (championshipData) => {
        try {
            const result = await FirebaseService.createChampionship(championshipData);
            if (result.success) {
                await loadChampionships(); // Recargar lista
                return result;
            }
        } catch (err) {
            console.error('Error creando campeonato:', err);
            throw err;
        }
    };

    /**
     * Actualizar un campeonato
     */
    const updateChampionship = async (championshipId, updates) => {
        try {
            const result = await FirebaseService.updateChampionship(championshipId, updates);
            if (result.success) {
                await loadChampionships(); // Recargar lista

                // Si el campeonato actualizado es el seleccionado, actualizarlo
                if (selectedChampionship?.id === championshipId) {
                    const updated = championships.find(c => c.id === championshipId);
                    if (updated) {
                        setSelectedChampionship(updated);
                    }
                }

                return result;
            }
        } catch (err) {
            console.error('Error actualizando campeonato:', err);
            throw err;
        }
    };

    /**
     * Eliminar un campeonato
     */
    const deleteChampionship = async (championshipId) => {
        try {
            const result = await FirebaseService.deleteChampionship(championshipId);
            if (result.success) {
                // Si se eliminó el campeonato seleccionado, seleccionar otro
                if (selectedChampionship?.id === championshipId) {
                    setSelectedChampionship(null);
                }

                await loadChampionships(); // Recargar lista
                return result;
            }
        } catch (err) {
            console.error('Error eliminando campeonato:', err);
            throw err;
        }
    };

    /**
     * Obtener campeonatos activos
     */
    const getActiveChampionships = () => {
        return championships.filter(c => c.status === 'active');
    };

    /**
     * Obtener campeonatos por estado
     */
    const getChampionshipsByStatus = (status) => {
        return championships.filter(c => c.status === status);
    };

    /**
     * Refrescar campeonatos
     */
    const refreshChampionships = async () => {
        await loadChampionships();
    };

    // Valor del contexto
    const value = {
        // Estado
        championships,
        selectedChampionship,
        loading,
        error,

        // Acciones
        selectChampionship,
        createChampionship,
        updateChampionship,
        deleteChampionship,
        refreshChampionships,

        // Utilidades
        getActiveChampionships,
        getChampionshipsByStatus,
    };

    return (
        <ChampionshipContext.Provider value={value}>
            {children}
        </ChampionshipContext.Provider>
    );
}
