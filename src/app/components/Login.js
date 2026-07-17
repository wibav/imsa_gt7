"use client";
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import ErrorMessage from './common/ErrorMessage';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [resetMode, setResetMode] = useState(false);
    const [resetSent, setResetSent] = useState(false);
    const [resetLoading, setResetLoading] = useState(false);
    const { login, resetPassword } = useAuth();

    const handleResetSubmit = async (e) => {
        e.preventDefault();
        try {
            setError('');
            setResetLoading(true);
            await resetPassword(email);
            setResetSent(true);
        } catch (error) {
            setError(error.code === 'auth/invalid-email' ? 'Email inválido' : 'No se pudo enviar el correo de recuperación');
        } finally {
            setResetLoading(false);
        }
    };

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

                {resetMode ? (
                    resetSent ? (
                        <div className="text-center space-y-4">
                            <p className="text-green-300 text-sm">
                                ✅ Si existe una cuenta con ese correo, te enviamos un enlace para restablecer tu contraseña. Revisa tu bandeja de entrada (y spam).
                            </p>
                            <button
                                onClick={() => { setResetMode(false); setResetSent(false); }}
                                className="text-orange-400 hover:text-orange-300 text-sm font-medium"
                            >
                                ← Volver a iniciar sesión
                            </button>
                        </div>
                    ) : (
                        <form onSubmit={handleResetSubmit} className="space-y-6">
                            <p className="text-gray-300 text-sm">
                                Ingresa tu correo y te enviaremos un enlace para restablecer tu contraseña.
                            </p>
                            <div>
                                <label htmlFor="reset-email" className="block text-sm font-medium text-gray-300 mb-2">
                                    Correo Electrónico
                                </label>
                                <input
                                    type="email"
                                    id="reset-email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    className="w-full px-4 py-3 bg-white/10 border border-white/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                                    placeholder="admin@imsagt7.com"
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={resetLoading}
                                className="w-full bg-gradient-to-r from-orange-600 to-red-600 text-white font-bold py-3 px-4 rounded-lg hover:from-orange-700 hover:to-red-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {resetLoading ? 'Enviando…' : 'Enviar enlace de recuperación'}
                            </button>
                            <button
                                type="button"
                                onClick={() => setResetMode(false)}
                                className="w-full text-gray-400 hover:text-white text-sm"
                            >
                                ← Volver a iniciar sesión
                            </button>
                        </form>
                    )
                ) : (
                <>
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
                        <div className="relative">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                id="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                className="w-full px-4 py-3 pr-12 bg-white/10 border border-white/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                                placeholder="••••••••"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                                title={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                                tabIndex={-1}
                            >
                                {showPassword ? '🙈' : '👁️'}
                            </button>
                        </div>
                        <div className="text-right mt-2">
                            <button
                                type="button"
                                onClick={() => { setResetMode(true); setError(''); }}
                                className="text-orange-400 hover:text-orange-300 text-xs font-medium"
                            >
                                ¿Olvidaste tu contraseña?
                            </button>
                        </div>
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
                </>
                )}
            </div>
        </div>
    );
}