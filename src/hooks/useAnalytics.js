'use client';

import { useEffect, useState } from 'react';
import { getAnalytics, logEvent, isSupported } from 'firebase/analytics';
import { app } from '../app/api/firebase/firebaseConfig';

export function useAnalytics() {
    const [analytics, setAnalytics] = useState(null);
    const [isInitialized, setIsInitialized] = useState(false);

    useEffect(() => {
        const initializeAnalytics = async () => {
            try {
                const supported = await isSupported();
                if (supported) {
                    const analyticsInstance = getAnalytics(app);
                    setAnalytics(analyticsInstance);
                    setIsInitialized(true);
                    console.log('✅ Firebase Analytics hook initialized');
                } else {
                    console.warn('⚠️ Firebase Analytics not supported');
                }
            } catch (error) {
                console.error('❌ Error initializing Analytics hook:', error);
            }
        };

        initializeAnalytics();
    }, []);

    const trackEvent = (eventName, parameters = {}) => {
        if (analytics && isInitialized) {
            try {
                logEvent(analytics, eventName, parameters);
                console.log(`📊 Event tracked: ${eventName}`, parameters);
            } catch (error) {
                console.error('❌ Error tracking event:', error);
            }
        } else {
            console.warn('⚠️ Analytics not initialized, event not tracked:', eventName);
        }
    };

    const trackPageView = (pageName) => {
        trackEvent('page_view', {
            page_title: pageName,
            page_location: window.location.href
        });
    };

    const trackUserAction = (action, category = 'engagement') => {
        trackEvent('user_action', {
            action: action,
            category: category
        });
    };

    return {
        analytics,
        isInitialized,
        trackEvent,
        trackPageView,
        trackUserAction
    };
}