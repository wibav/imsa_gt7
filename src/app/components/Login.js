"use client";
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import ErrorMessage from './common/ErrorMessage';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();

    const handleSubmit = async (e) => {
        e.preventDefault();

        try {
            setError('');
            setLoading(true);

            const user = await login(email, password);
            if (user) {
                // Redirigir al usuario a la página de administración de campeonatos
                window.location.href = '/championshipsAdmin';
            }
        } catch (error) {
            let errorMessage = 'Error al iniciar sesión';

            switch (error.code) {
                case 'auth/user-not-found':
                    errorMessage = 'Usuario no encontrado';
                    break;
                case 'auth/wrong-password':
                    errorMessage = 'Contraseña incorrecta';
                    break;
                case 'auth/invalid-email':
                    errorMessage = 'Email inválido';
                    break;
                case 'auth/too-many-requests':
                    errorMessage = 'Demasiados intentos. Intenta más tarde';
                    break;
                default:
                    errorMessage = error.message;
            }

            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 flex items-center justify-center p-4">
            <div className="bg-white/10 backdrop-blur-sm border border-white/30 rounded-lg p-8 w-full max-w-md">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="text-6xl mb-4">🏁</div>
                    <h1 className="text-3xl font-bold text-white mb-2">
                        GT7 Championships Admin
                    </h1>
                    <p className="text-gray-300">
                        Acceso al panel de administración
                    </p>
                </div>

                {/* Error Message */}
                {error && (
                    <ErrorMessage errors={error} className="mb-6" />
                )}

                {/* Login Form */}
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
                            Correo Electrónico
                        </label>
                        <input
                            type="email"
                            id="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="w-full px-4 py-3 bg-white/10 border border-white/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                            placeholder="admin@imsagt7.com"
                        />
                    </div>

                    <div>
                        <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
                            Contraseña
                        </label>
                        <input
                            type="password"
                            id="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            className="w-full px-4 py-3 bg-white/10 border border-white/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                            placeholder="••••••••"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-gradient-to-r from-orange-600 to-red-600 text-white font-bold py-3 px-4 rounded-lg hover:from-orange-700 hover:to-red-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:ring-offset-slate-900 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? (
                            <div className="flex items-center justify-center gap-2">
                                <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
                                <span>Iniciando sesión...</span>
                            </div>
                        ) : (
                            'Iniciar Sesión'
                        )}
                    </button>
                </form>

                {/* Info */}
                <div className="mt-8 pt-6 border-t border-white/20 text-center">
                    <p className="text-gray-400 text-sm">
                        🔐 Área restringida para administradores
                    </p>
                </div>
            </div>
        </div>
    );
}