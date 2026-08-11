"use client";

import { useState } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import { useOrganization } from '../context/OrganizationContext';

export default function AdminLayout({ children }) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const { currentUser, logout, isAdmin, isPlatformOwner, currentOrgRole } = useAuth();
    const { org } = useOrganization();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' && window.innerWidth < 768);

    // Cada organización ve solo lo suyo al "volver al dashboard" — la raíz
    // '/' es la vista agregada de todas las organizaciones (por diseño, ver
    // README/SPEC-3), no el dashboard propio de esta organización.
    const dashboardPath = org?.slug ? `/l/${org.slug}` : '/';

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
            title: 'Navegación',
            icon: '🏠',
            items: [
                { name: 'Volver al Dashboard', path: dashboardPath, icon: '🏠' },
            ]
        },
        // Vista global de todas las organizaciones: exclusiva del
        // Administrador de Plataforma (antes solo se podía ver por consola
        // de Firestore).
        ...(isPlatformOwner() ? [{
            title: 'Plataforma',
            icon: '🌐',
            items: [
                { name: 'Organizaciones', path: '/organizacionesAdmin', icon: '🏢' },
            ]
        }] : []),
        {
            title: 'Gestión de Campeonatos',
            icon: '🏆',
            items: [
                { name: 'Campeonatos', path: '/championshipsAdmin', icon: '🏁' },
                // "Crear Campeonato" llevaba a un callejón sin salida para un
                // comisario (ChampionshipForm no gatea rol, pero firestore.rules
                // sí — la escritura siempre fallaba). ADR-009: gatear en el sidebar.
                ...(isAdmin() ? [{ name: 'Crear Campeonato', path: '/championshipsAdmin/new', icon: '➕' }] : []),
            ]
        },
        // Eventos: solo admins. /eventsAdmin ya gatea con
        // <ProtectedRoute requireAdmin> (un comisario ve "Acceso Denegado"),
        // así que mostrar el enlace en el sidebar era otro callejón sin
        // salida — ADR-009. Va justo después de Campeonatos: mismo tipo de
        // contenido (gestión de competiciones), no de cuenta/organización.
        ...(isAdmin() ? [{
            title: 'Gestión de Eventos',
            icon: '📅',
            items: [
                { name: 'Eventos', path: '/eventsAdmin', icon: '🎪' },
            ]
        }] : []),
        // Catálogo de pistas: gestión exclusiva del Administrador de
        // Plataforma (asignar imágenes es un recurso global compartido
        // entre todas las organizaciones, no de una liga en particular).
        ...(isPlatformOwner() ? [{
            title: 'Catálogo de Pistas',
            icon: '🏎️',
            items: [
                { name: 'Pistas GT7', path: '/tracksAdmin', icon: '🏁' },
            ]
        }] : []),
        // Cuenta/organización: agrupa lo que es de la cuenta en sí (usuarios,
        // plan y pago, branding), separado de la gestión de contenido de
        // arriba (campeonatos/eventos/pistas) — antes vivía mezclado dentro
        // de "Gestión de Campeonatos", lo que hacía parecer que Facturación
        // o Usuarios eran parte de un campeonato en particular.
        ...(isAdmin() ? [{
            title: 'Cuenta',
            icon: '🏢',
            items: [
                { name: 'Usuarios', path: '/usersAdmin', icon: '👥' },
                { name: 'Facturación', path: '/facturacion', icon: '💳' },
                // Branding (logo/colores): exclusivo del Organizador — un
                // director_liga administra campeonatos pero no la identidad
                // de la organización ni su plan.
                ...(currentOrgRole() === 'organizador' ? [{ name: 'Mi Organización', path: '/organizacionAdmin', icon: '🎨' }] : []),
            ]
        }] : []),
        {
            title: 'Herramientas',
            icon: '⚙️',
            items: [
                { name: 'Creador de Vinilos', path: '/tools', icon: '🎨' },
                ...(isPlatformOwner() ? [{ name: 'Equipamiento', path: '/equipamientoAdmin', icon: '🛒' }] : []),
            ]
        }
    ];

    const isActive = (path) => {
        const [basePath, query] = path.split('?');
        if (query) {
            const paramKey = query.split('=')[0];
            const paramVal = query.split('=')[1];
            return pathname === basePath && searchParams.get(paramKey) === paramVal;
        }
        if (path === '/') {
            return pathname === '/';
        }
        if (path === '/championshipsAdmin') {
            return pathname === path && !searchParams.get('section');
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
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <h1 className="text-lg md:text-xl font-bold text-white">Admin</h1>
                            <p className="text-xs text-gray-400 truncate">{currentUser?.email}</p>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/15 text-red-300 hover:bg-red-500/25 hover:text-red-200 transition-all text-xs font-medium"
                            title="Cerrar sesión"
                        >
                            <span className="text-sm">🚪</span>
                            <span className="hidden lg:inline">Salir</span>
                        </button>
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
                    className="absolute inset-0 bg-black/70 backdrop-blur-sm"
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
                    <button
                        onClick={handleLogout}
                        className="p-2 bg-red-500/15 hover:bg-red-500/25 rounded-lg transition-colors text-red-300"
                        title="Cerrar sesión"
                    >
                        🚪
                    </button>
                </div>
                {/* Scrollable Content Area */}
                <div className="flex-1 overflow-auto">
                    {children}
                </div>
            </main>
        </div>
    );
}
