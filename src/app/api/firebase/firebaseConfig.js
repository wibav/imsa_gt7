// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAnalytics, isSupported } from "firebase/analytics";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Initialize Analytics with better error handling
let analytics = null;

const initializeAnalytics = async () => {
    if (typeof window !== "undefined" && !analytics) {
        try {
            const supported = await isSupported();
            if (supported) {
                const { getAnalytics } = await import("firebase/analytics");
                analytics = getAnalytics(app);
                console.log("✅ Firebase Analytics initialized successfully");
                return analytics;
            } else {
                console.warn("⚠️ Firebase Analytics not supported in this environment");
            }
        } catch (error) {
            console.error("❌ Error initializing Firebase Analytics:", error);
        }
    }
    return analytics;
};

// Auto-initialize analytics
initializeAnalytics();

export { app, db, auth, analytics, initializeAnalytics };