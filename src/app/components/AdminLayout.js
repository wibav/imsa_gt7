"use client";

import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '../context/AuthContext';

export default function AdminLayout({ children }) {
    const router = useRouter();
    const pathname = usePathname();
    const { currentUser, logout } = useAuth();
    const [sidebarOpen, setSidebarOpen] = useState(true);

    const handleLogout = async () => {
        try {
            await logout();
            router.push('/login');
        } catch (error) {
            console.error('Error al cerrar sesión:', error);
        }
    };

    const menuItems = [
        {
            title: 'Gestión de Campeonatos',
            icon: '🏆',
            items: [
                { name: 'Campeonatos', path: '/championshipsAdmin', icon: '🏁' },
                { name: 'Crear Campeonato', path: '/championshipsAdmin/new', icon: '➕' },
            ]
        },
        {
            title: 'Catálogo de Pistas',
            icon: '🏎️',
            items: [
                { name: 'Pistas GT7', path: '/tracksAdmin', icon: '🏁' },
            ]
        },
        {
            title: 'Gestión de Eventos',
            icon: '📅',
            items: [
                { name: 'Eventos', path: '/eventsAdmin', icon: '🎪' },
            ]
        },
        {
            title: 'Herramientas',
            icon: '⚙️',
            items: [
                { name: 'Creador de Vinilos', path: '/tools', icon: '🎨' },
            ]
        }
    ];

    const isActive = (path) => {
        if (path === '/championshipsAdmin') {
            return pathname === path;
        }
        return pathname?.startsWith(path);
    };

    return (
        <div className="flex h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800">
            {/* Sidebar */}
            <aside className={`${sidebarOpen ? 'w-64' : 'w-20'} bg-slate-900/50 backdrop-blur-md border-r border-white/10 transition-all duration-300 flex flex-col`}>
                {/* Header */}
                <div className="p-4 border-b border-white/10">
                    <div className="flex items-center justify-between">
                        {sidebarOpen && (
                            <div>
                                <h1 className="text-xl font-bold text-white">Admin Panel</h1>
                                <p className="text-xs text-gray-400">{currentUser?.email}</p>
                            </div>
                        )}
                        <button
                            onClick={() => setSidebarOpen(!sidebarOpen)}
                            className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white"
                        >
                            {sidebarOpen ? '◀' : '▶'}
                        </button>
                    </div>
                </div>

                {/* Menu Items */}
                <nav className="flex-1 overflow-y-auto p-4 space-y-6">
                    {menuItems.map((section, idx) => (
                        <div key={idx}>
                            {sidebarOpen && (
                                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-2">
                                    {section.icon} {section.title}
                                </h3>
                            )}
                            <ul className="space-y-1">
                                {section.items.map((item) => (
                                    <li key={item.path}>
                                        <button
                                            onClick={() => router.push(item.path)}
                                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${isActive(item.path)
                                                ? 'bg-gradient-to-r from-orange-600 to-red-600 text-white shadow-lg'
                                                : 'text-gray-300 hover:bg-white/10 hover:text-white'
                                                }`}
                                            title={!sidebarOpen ? item.name : ''}
                                        >
                                            <span className="text-xl">{item.icon}</span>
                                            {sidebarOpen && (
                                                <span className="font-medium text-sm">{item.name}</span>
                                            )}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </nav>

                {/* Footer - Cerrar Sesión */}
                <div className="p-4 border-t border-white/10">
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-all"
                        title={!sidebarOpen ? 'Cerrar Sesión' : ''}
                    >
                        <span className="text-xl">🚪</span>
                        {sidebarOpen && <span className="font-medium text-sm">Cerrar Sesión</span>}
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-auto">
                {children}
            </main>
        </div>
    );
}
