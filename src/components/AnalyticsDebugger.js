'use client';

import { useEffect, useState } from 'react';
import { useAnalytics } from '../hooks/useAnalytics';

export default function AnalyticsDebugger() {
    const { analytics, isInitialized, trackEvent } = useAnalytics();
    const [debugInfo, setDebugInfo] = useState({});

    useEffect(() => {
        const checkAnalytics = () => {
            const info = {
                initialized: isInitialized,
                analyticsInstance: !!analytics,
                gtagAvailable: typeof window !== 'undefined' && !!window.gtag,
                measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
                timestamp: new Date().toISOString()
            };

            setDebugInfo(info);
            console.log('🔍 Analytics Debug Info:', info);
        };

        checkAnalytics();
    }, [analytics, isInitialized]);

    const testEvent = () => {
        trackEvent('test_event', {
            test_param: 'analytics_working',
            timestamp: Date.now()
        });
        console.log('🧪 Test event sent');
    };

    const checkFirebaseConsole = () => {
        window.open('https://console.firebase.google.com/project/imsa-bd5b6/analytics', '_blank');
    };

    if (process.env.NODE_ENV !== 'development') {
        return null; // Only show in development
    }

    return (
        <div className="fixed bottom-4 right-4 bg-black/80 text-white p-4 rounded-lg max-w-sm z-50">
            <h3 className="font-bold mb-2">🔍 Analytics Debug</h3>
            <div className="text-xs space-y-1">
                <div>Initialized: {debugInfo.initialized ? '✅' : '❌'}</div>
                <div>Instance: {debugInfo.analyticsInstance ? '✅' : '❌'}</div>
                <div>gtag: {debugInfo.gtagAvailable ? '✅' : '❌'}</div>
                <div>Measurement ID: {debugInfo.measurementId || '❌'}</div>
            </div>
            <div className="mt-3 space-x-2">
                <button onClick={testEvent} className="bg-blue-600 px-2 py-1 rounded text-xs">
                    Test Event
                </button>
                <button onClick={checkFirebaseConsole} className="bg-green-600 px-2 py-1 rounded text-xs">
                    Firebase Console
                </button>
            </div>
        </div>
    );
}