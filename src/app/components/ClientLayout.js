"use client";

import { usePathname } from 'next/navigation';
import Footer from './Footer';
import { useOrganization } from '../context/OrganizationContext';

export default function ClientLayout({ children }) {
    const pathname = usePathname();
    const { notFound, loading } = useOrganization();

    // Verificar si estamos en una página de administración
    const isAdminPage = pathname?.includes('Admin') || pathname?.includes('/login');

    // /l/{slug} que no resuelve a ninguna organización → 404 propio
    if (!loading && notFound) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 text-center px-4">
                <div>
                    <div className="text-6xl mb-4">🔍</div>
                    <h1 className="text-2xl font-bold text-white mb-2">Organización no encontrada</h1>
                    <p className="text-gray-400 mb-6">La liga que buscas no existe o cambió de dirección.</p>
                    <button
                        onClick={() => window.location.href = '/'}
                        className="inline-block px-6 py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-semibold transition-all"
                    >
                        ← Ir al inicio
                    </button>
                </div>
            </div>
        );
    }

    return (
        <>
            {children}
            {/* Solo mostrar Footer en páginas de cliente */}
            {!isAdminPage && <Footer />}
        </>
    );
}
