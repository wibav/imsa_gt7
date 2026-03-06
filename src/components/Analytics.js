'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { getAnalytics, isSupported, logEvent } from 'firebase/analytics';
import { app } from '../app/api/firebase/firebaseConfig';

let analyticsInstance = null;

export default function Analytics() {
    const pathname = usePathname();

    // Inicializar Firebase Analytics una sola vez
    useEffect(() => {
        const initializeAnalytics = async () => {
            try {
                const supported = await isSupported();
                if (supported) {
                    analyticsInstance = getAnalytics(app);
                }
            } catch (error) {
                // Silenciar errores (ad blockers, navegadores sin soporte, etc.)
            }
        };
        initializeAnalytics();
    }, []);

    // Trackear page_view en cada cambio de ruta (navegación SPA)
    useEffect(() => {
        if (typeof window === 'undefined') return;

        const url = window.location.href;
        const title = document.title;

        // GA4 via gtag (Google Analytics)
        if (window.gtag) {
            window.gtag('event', 'page_view', {
                page_title: title,
                page_location: url,
                page_path: pathname,
            });
        }

        // Firebase Analytics SDK
        if (analyticsInstance) {
            try {
                logEvent(analyticsInstance, 'page_view', {
                    page_title: title,
                    page_location: url,
                    page_path: pathname,
                });
            } catch (e) { /* silenciar */ }
        }
    }, [pathname]);

    return null;
}