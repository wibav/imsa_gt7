"use client";
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import Image from 'next/image';

export default function Navbar() {
    const [menuOpen, setMenuOpen] = useState(false);
    const { currentUser, logout, isAdmin } = useAuth();

    const handleLogout = async () => {
        try {
            await logout();
            window.location.href = '/';
        } catch (error) {
            console.error('Error al cerrar sesión:', error);
        }
    };

    const navItems = [
        { label: '🎨 Creador de vinilos', href: '/tools', gradient: true }
    ];

    return (
        <div className="bg-gradient-to-r from-orange-600 via-red-600 to-orange-600 px-4 py-4 sm:py-6 sticky top-0 z-50 backdrop-blur-lg bg-opacity-95">
            <div className="max-w-7xl mx-auto w-full">
                {/* Header con Logo */}
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-4">
                    <div className="cursor-pointer group" onClick={() => window.location.href = '/'}>
                        <div className="flex items-center gap-3 sm:gap-4">
                            <div className="relative">
                                <Image
                                    src="/logo_gt7.png"
                                    alt="GT7 Championships"
                                    width={56}
                                    height={56}
                                    className="w-12 h-12 sm:w-14 sm:h-14 object-contain transition-transform duration-300 group-hover:scale-110"
                                    onError={(e) => {
                                        e.target.style.display = 'none';
                                    }}
                                />
                                <div className="absolute inset-0 bg-orange-500/20 rounded-full blur-xl group-hover:bg-orange-500/40 transition-all duration-300"></div>
                            </div>
                            <div>
                                <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-2 group-hover:text-orange-400 transition-colors duration-300">
                                    GT7 Championships
                                    <span className="text-orange-500">🏆</span>
                                </h1>
                                <p className="text-gray-400 text-sm sm:text-base">Campeonatos y Eventos</p>
                            </div>
                        </div>
                    </div>

                    {/* User Info Desktop - Movido al header */}
                    <div className="hidden lg:flex items-center gap-3">
                        {currentUser ? (
                            <>
                                <div className="flex items-center gap-2 bg-white/10 rounded-lg px-4 py-2 backdrop-blur-sm">
                                    <span className="text-white text-sm">
                                        👤 {currentUser.email?.split('@')[0]}
                                    </span>
                                    {isAdmin() && (
                                        <span className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white text-xs px-2 py-1 rounded-full font-bold">
                                            ADMIN
                                        </span>
                                    )}
                                </div>
                                <button
                                    onClick={handleLogout}
                                    className="bg-gradient-to-r from-red-600 to-red-700 text-white px-4 py-2 rounded-lg font-semibold hover:from-red-700 hover:to-red-800 transition-all duration-200 text-sm"
                                >
                                    🚪 Salir
                                </button>
                            </>
                        ) : (
                            <button
                                onClick={() => window.location.href = '/login'}
                                className="bg-white/20 text-white px-5 py-2 rounded-lg font-semibold hover:bg-white/30 transition-all duration-200 flex items-center gap-2 text-sm"
                            >
                                🔐 Login
                            </button>
                        )}
                    </div>
                </div>

                {/* Botón Hamburguesa (solo móvil) */}
                <button
                    onClick={() => setMenuOpen(!menuOpen)}
                    className="lg:hidden w-full bg-white/5 border border-white/10 text-white px-4 py-3 rounded-lg font-semibold hover:bg-white/10 transition-all duration-200 flex items-center justify-between"
                >
                    <span>☰ Menú de Navegación</span>
                    <span className={`transform transition-transform duration-200 ${menuOpen ? 'rotate-180' : ''}`}>▼</span>
                </button>

                {/* Menú Desktop (siempre visible en pantallas grandes) */}
                <div className="hidden lg:flex flex-wrap gap-3 items-center w-full">
                    {navItems.map((item, index) => (
                        <button
                            key={index}
                            onClick={() => window.location.href = item.href}
                            className="bg-white/20 text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-white/30 transition-all duration-200 text-sm"
                        >
                            {item.label}
                        </button>
                    ))}

                    {/* Admin Button Desktop */}
                    {isAdmin() && (
                        <button
                            onClick={() => window.location.href = '/championshipsAdmin'}
                            className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-5 py-2.5 rounded-lg font-semibold hover:from-purple-700 hover:to-indigo-700 transition-all duration-200 text-sm"
                        >
                            ⚙️ Admin
                        </button>
                    )}
                </div>

                {/* Menú Móvil (desplegable) */}
                <div className={`lg:hidden overflow-hidden transition-all duration-300 ${menuOpen ? 'max-h-[2000px] opacity-100 mt-4' : 'max-h-0 opacity-0'}`}>
                    <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 space-y-3">
                        {/* Navegación principal */}
                        {navItems.map((item, index) => (
                            <button
                                key={index}
                                onClick={() => {
                                    window.location.href = item.href;
                                    setMenuOpen(false);
                                }}
                                className="w-full bg-white/20 text-white px-5 py-3 rounded-lg font-semibold hover:bg-white/30 transition-all duration-200"
                            >
                                {item.label}
                            </button>
                        ))}

                        {isAdmin() && (
                            <button
                                onClick={() => window.location.href = '/championshipsAdmin'}
                                className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-5 py-3 rounded-lg font-semibold hover:from-purple-700 hover:to-indigo-700 transition-all duration-200"
                            >
                                ⚙️ Admin
                            </button>
                        )}

                        {/* Separador */}
                        <div className="border-t border-white/20 my-3"></div>

                        {/* Admin Controls Móvil */}
                        {currentUser ? (
                            <>
                                <div className="bg-white/10 rounded-lg px-4 py-3 text-center">
                                    <span className="text-white text-sm block mb-2">
                                        👤 {currentUser.email?.split('@')[0]}
                                    </span>
                                    {isAdmin() && (
                                        <span className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white text-xs px-3 py-1 rounded-full font-bold inline-block">
                                            ADMIN
                                        </span>
                                    )}
                                </div>

                                <button
                                    onClick={handleLogout}
                                    className="w-full bg-gradient-to-r from-red-600 to-red-700 text-white px-4 py-3 rounded-lg font-semibold hover:from-red-700 hover:to-red-800 transition-all duration-200"
                                >
                                    🚪 Cerrar Sesión
                                </button>
                            </>
                        ) : (
                            <button
                                onClick={() => window.location.href = '/login'}
                                className="w-full bg-white/20 text-white px-5 py-3 rounded-lg font-semibold hover:bg-white/30 transition-all duration-200 flex items-center justify-center gap-2"
                            >
                                🔐 Admin Login
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
