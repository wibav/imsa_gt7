"use client";

import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '../context/AuthContext';

export default function AdminLayout({ children }) {
    const router = useRouter();
    const pathname = usePathname();
    const { currentUser, logout } = useAuth();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' && window.innerWidth < 768);

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

    const handleSidebarToggle = () => {
        setSidebarOpen(!sidebarOpen);
    };

    return (
        <div className="flex h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800">
            {/* Sidebar - Desktop */}
            <aside className={`hidden md:flex md:w-64 h-screen bg-slate-900/50 backdrop-blur-md border-r border-white/10 flex-col transition-all duration-300`}>
                {/* Header */}
                <div className="p-4 border-b border-white/10">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-lg md:text-xl font-bold text-white">Admin</h1>
                            <p className="text-xs text-gray-400 truncate">{currentUser?.email}</p>
                        </div>
                    </div>
                </div>

                {/* Menu Items */}
                <nav className="flex-1 overflow-y-auto p-3 md:p-4 space-y-4 md:space-y-6">
                    {menuItems.map((section, idx) => (
                        <div key={idx}>
                            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-2">
                                {section.icon} {section.title}
                            </h3>
                            <ul className="space-y-1">
                                {section.items.map((item) => (
                                    <li key={item.path}>
                                        <button
                                            onClick={() => router.push(item.path)}
                                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-sm ${isActive(item.path)
                                                ? 'bg-gradient-to-r from-orange-600 to-red-600 text-white shadow-lg'
                                                : 'text-gray-300 hover:bg-white/10 hover:text-white'
                                                }`}
                                        >
                                            <span className="text-lg md:text-xl">{item.icon}</span>
                                            <span className="font-medium text-xs md:text-sm">{item.name}</span>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </nav>

                {/* Footer - Cerrar Sesión */}
                <div className="p-3 md:p-4 border-t border-white/10">
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-all text-sm"
                    >
                        <span className="text-lg md:text-xl">🚪</span>
                        <span className="font-medium text-xs md:text-sm">Cerrar Sesión</span>
                    </button>
                </div>
            </aside>

            {/* Sidebar - Mobile (Drawer) */}
            <div className={`fixed inset-0 z-40 md:hidden ${sidebarOpen ? 'block' : 'hidden'}`}>
                {/* Overlay */}
                <div
                    className="absolute inset-0 bg-black/50"
                    onClick={() => setSidebarOpen(false)}
                ></div>
                {/* Drawer */}
                <aside className="absolute left-0 top-0 h-screen w-64 bg-slate-900 backdrop-blur-md border-r border-white/10 flex flex-col z-50">
                    {/* Header */}
                    <div className="p-4 border-b border-white/10 flex items-center justify-between">
                        <div>
                            <h1 className="text-xl font-bold text-white">Admin</h1>
                            <p className="text-xs text-gray-400 truncate">{currentUser?.email}</p>
                        </div>
                        <button
                            onClick={() => setSidebarOpen(false)}
                            className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white"
                        >
                            ✕
                        </button>
                    </div>

                    {/* Menu Items */}
                    <nav className="flex-1 overflow-y-auto p-4 space-y-6">
                        {menuItems.map((section, idx) => (
                            <div key={idx}>
                                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-2">
                                    {section.icon} {section.title}
                                </h3>
                                <ul className="space-y-1">
                                    {section.items.map((item) => (
                                        <li key={item.path}>
                                            <button
                                                onClick={() => {
                                                    router.push(item.path);
                                                    setSidebarOpen(false);
                                                }}
                                                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-sm ${isActive(item.path)
                                                    ? 'bg-gradient-to-r from-orange-600 to-red-600 text-white shadow-lg'
                                                    : 'text-gray-300 hover:bg-white/10 hover:text-white'
                                                    }`}
                                            >
                                                <span className="text-xl">{item.icon}</span>
                                                <span className="font-medium">{item.name}</span>
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
                            onClick={() => {
                                handleLogout();
                                setSidebarOpen(false);
                            }}
                            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-all text-sm"
                        >
                            <span className="text-xl">🚪</span>
                            <span className="font-medium">Cerrar Sesión</span>
                        </button>
                    </div>
                </aside>
            </div>

            {/* Main Content */}
            <main className="flex-1 flex flex-col overflow-hidden">
                {/* Mobile Header with Menu Button */}
                <div className="md:hidden bg-slate-900/50 backdrop-blur-md border-b border-white/10 p-4 flex items-center justify-between">
                    <button
                        onClick={handleSidebarToggle}
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white text-xl"
                    >
                        ☰
                    </button>
                    <h2 className="text-white font-bold text-sm">GT7 Admin</h2>
                    <div className="w-10"></div>
                </div>
                {/* Scrollable Content Area */}
                <div className="flex-1 overflow-auto">
                    {children}
                </div>
            </main>
        </div>
    );
}
