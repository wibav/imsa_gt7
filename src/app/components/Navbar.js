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
        { label: '🏎️ Equipos', href: '/?view=teams' },
        { label: '👤 Pilotos', href: '/?view=drivers' },
        { label: '🏁 Pistas', href: '/?view=tracks' },
        { label: '🎉 Eventos', href: '/?view=events' },
        { label: '🛠️ Herramientas', href: '/tools', gradient: true }
    ];

    return (
        <div className="bg-gradient-to-r from-orange-600 via-red-600 to-orange-600 px-4 py-6 sm:p-8">
            <div className="max-w-7xl mx-auto w-full">
                {/* Header con Logo */}
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
                    <div className="cursor-pointer" onClick={() => window.location.href = '/'}>
                        <h1 className="text-3xl sm:text-4xl font-bold text-white flex items-center gap-4">
                            <Image
                                src="/logo_gt7.png"
                                alt="IMSA GT7 Racing Club ESP Logo"
                                width={64}
                                height={64}
                                className="w-16 h-16 object-contain"
                                onError={(e) => {
                                    e.target.style.display = 'none';
                                }}
                            />
                            IMSA GT7 Racing Club ESP
                            <span className="text-4xl sm:text-5xl">🏆</span>
                        </h1>
                        <p className="text-orange-100 text-lg mt-2">Temporada 2025 - Dashboard de Resultados</p>
                    </div>
                </div>

                {/* Botón Hamburguesa (solo móvil) */}
                <button
                    onClick={() => setMenuOpen(!menuOpen)}
                    className="lg:hidden w-full bg-white/20 text-white px-6 py-3 rounded-lg font-bold hover:bg-white/30 transition-all duration-200 flex items-center justify-between"
                >
                    <span>☰ Menú</span>
                    <span className={`transform transition-transform duration-200 ${menuOpen ? 'rotate-180' : ''}`}>▼</span>
                </button>

                {/* Menú Desktop (siempre visible en pantallas grandes) */}
                <div className="hidden lg:flex flex-wrap gap-4 items-center w-full">
                    {navItems.map((item, index) => (
                        <button
                            key={index}
                            onClick={() => window.location.href = item.href}
                            className={item.gradient
                                ? "bg-gradient-to-r from-teal-600 to-cyan-600 text-white px-6 py-3 rounded-lg font-bold hover:from-teal-700 hover:to-cyan-700 transition-all duration-200"
                                : "bg-white/20 text-white px-6 py-3 rounded-lg font-bold hover:bg-white/30 transition-all duration-200"
                            }
                        >
                            {item.label}
                        </button>
                    ))}

                    {/* Admin Controls Desktop */}
                    <div className="flex items-center gap-4 ml-auto">
                        {currentUser ? (
                            <>
                                <div className="flex items-center gap-2 bg-white/10 rounded-lg px-4 py-2">
                                    <span className="text-white text-sm">
                                        👤 {currentUser.email}
                                    </span>
                                    {isAdmin() && (
                                        <span className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white text-xs px-2 py-1 rounded-full font-bold">
                                            ADMIN
                                        </span>
                                    )}
                                </div>

                                {isAdmin() && (
                                    <>
                                        <button
                                            onClick={() => window.location.href = '/teamsAdmin'}
                                            className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-4 py-2 rounded-lg font-bold hover:from-purple-700 hover:to-indigo-700 transition-all duration-200"
                                        >
                                            ⚙️ Admin Equipos
                                        </button>
                                        <button
                                            onClick={() => window.location.href = '/tracksAdmin'}
                                            className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-4 py-2 rounded-lg font-bold hover:from-purple-700 hover:to-indigo-700 transition-all duration-200"
                                        >
                                            🏁 Admin Pistas
                                        </button>
                                        <button
                                            onClick={() => window.location.href = '/eventsAdmin'}
                                            className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-4 py-2 rounded-lg font-bold hover:from-purple-700 hover:to-indigo-700 transition-all duration-200"
                                        >
                                            🎉 Admin Eventos
                                        </button>
                                    </>
                                )}

                                <button
                                    onClick={handleLogout}
                                    className="bg-gradient-to-r from-red-600 to-red-700 text-white px-4 py-2 rounded-lg font-bold hover:from-red-700 hover:to-red-800 transition-all duration-200"
                                >
                                    🚪 Cerrar Sesión
                                </button>
                            </>
                        ) : (
                            <button
                                onClick={() => window.location.href = '/login'}
                                className="bg-gradient-to-r from-green-600 to-emerald-600 text-white px-6 py-3 rounded-lg font-bold hover:from-green-700 hover:to-emerald-700 transition-all duration-200 flex items-center gap-2"
                            >
                                🔐 Admin Login
                            </button>
                        )}
                    </div>
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
                                className={item.gradient
                                    ? "w-full bg-gradient-to-r from-teal-600 to-cyan-600 text-white px-6 py-3 rounded-lg font-bold hover:from-teal-700 hover:to-cyan-700 transition-all duration-200"
                                    : "w-full bg-white/20 text-white px-6 py-3 rounded-lg font-bold hover:bg-white/30 transition-all duration-200"
                                }
                            >
                                {item.label}
                            </button>
                        ))}

                        {/* Separador */}
                        <div className="border-t border-white/20 my-3"></div>

                        {/* Admin Controls Móvil */}
                        {currentUser ? (
                            <>
                                <div className="bg-white/10 rounded-lg px-4 py-3 text-center">
                                    <span className="text-white text-sm block mb-2">
                                        👤 {currentUser.email}
                                    </span>
                                    {isAdmin() && (
                                        <span className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white text-xs px-3 py-1 rounded-full font-bold inline-block">
                                            ADMIN
                                        </span>
                                    )}
                                </div>

                                {isAdmin() && (
                                    <>
                                        <button
                                            onClick={() => window.location.href = '/teamsAdmin'}
                                            className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-4 py-3 rounded-lg font-bold hover:from-purple-700 hover:to-indigo-700 transition-all duration-200"
                                        >
                                            ⚙️ Admin Equipos
                                        </button>
                                        <button
                                            onClick={() => window.location.href = '/tracksAdmin'}
                                            className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-4 py-3 rounded-lg font-bold hover:from-purple-700 hover:to-indigo-700 transition-all duration-200"
                                        >
                                            🏁 Admin Pistas
                                        </button>
                                        <button
                                            onClick={() => window.location.href = '/eventsAdmin'}
                                            className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-4 py-3 rounded-lg font-bold hover:from-purple-700 hover:to-indigo-700 transition-all duration-200"
                                        >
                                            🎉 Admin Eventos
                                        </button>
                                    </>
                                )}

                                <button
                                    onClick={handleLogout}
                                    className="w-full bg-gradient-to-r from-red-600 to-red-700 text-white px-4 py-3 rounded-lg font-bold hover:from-red-700 hover:to-red-800 transition-all duration-200"
                                >
                                    🚪 Cerrar Sesión
                                </button>
                            </>
                        ) : (
                            <button
                                onClick={() => window.location.href = '/login'}
                                className="w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white px-6 py-3 rounded-lg font-bold hover:from-green-700 hover:to-emerald-700 transition-all duration-200 flex items-center justify-center gap-2"
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
