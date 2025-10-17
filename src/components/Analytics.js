'use client';

import { useEffect } from 'react';
import { getAnalytics, isSupported } from 'firebase/analytics';
import { app } from '../app/api/firebase/firebaseConfig';

export default function Analytics() {
    useEffect(() => {
        const initializeAnalytics = async () => {
            try {
                const supported = await isSupported();
                if (supported) {
                    getAnalytics(app);
                    console.log('✅ Firebase Analytics initialized in client component');

                    // Log a page view event
                    if (typeof window !== 'undefined' && window.gtag) {
                        window.gtag('config', process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID, {
                            page_title: document.title,
                            page_location: window.location.href
                        });
                    }
                } else {
                    console.warn('⚠️ Firebase Analytics not supported in this browser');
                }
            } catch (error) {
                console.error('❌ Error initializing Firebase Analytics:', error);
            }
        };

        initializeAnalytics();
    }, []);

    return null; // This component doesn't render anything
}