"use client";

import { usePathname } from 'next/navigation';
import Footer from './Footer';

export default function ClientLayout({ children }) {
    const pathname = usePathname();

    // Verificar si estamos en una página de administración
    const isAdminPage = pathname?.includes('Admin') || pathname?.includes('/login');

    return (
        <>
            {children}
            {/* Solo mostrar Footer en páginas de cliente */}
            {!isAdminPage && <Footer />}
        </>
    );
}
