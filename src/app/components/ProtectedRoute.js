"use client";
import { useAuth } from '../context/AuthContext';
import Login from './Login';

export default function ProtectedRoute({ children, requireAdmin = false }) {
    const { currentUser, isAdmin, loading } = useAuth();

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 flex items-center justify-center">
                <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-orange-500"></div>
                    <p className="text-white mt-4 text-xl">Verificando acceso...</p>
                </div>
            </div>
        );
    }

    // Si no hay usuario autenticado, mostrar login
    if (!currentUser) {
        return <Login />;
    }

    // Si se requiere admin y el usuario no es admin
    if (requireAdmin && !isAdmin()) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 flex items-center justify-center p-4">
                <div className="bg-red-500/20 border border-red-500 rounded-lg p-8 max-w-md w-full text-center">
                    <div className="text-6xl mb-4">🚫</div>
                    <h1 className="text-2xl font-bold text-white mb-4">
                        Acceso Denegado
                    </h1>
                    <p className="text-red-200 mb-6">
                        No tienes permisos para acceder a esta área. Contacta al administrador si necesitas acceso.
                    </p>
                    <button
                        onClick={() => window.location.href = '/'}
                        className="bg-gradient-to-r from-orange-600 to-red-600 text-white font-bold py-2 px-4 rounded-lg hover:from-orange-700 hover:to-red-700 transition-all duration-200"
                    >
                        Volver al Dashboard
                    </button>
                </div>
            </div>
        );
    }

    return children;
}