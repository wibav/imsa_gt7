// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAnalytics, isSupported } from "firebase/analytics";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
    apiKey: "AIzaSyAkwr4sH48c2syY_BAfjWaaOTHl4nhqVmo",
    authDomain: "imsa.trenit.com",
    projectId: "imsa-bd5b6",
    storageBucket: "imsa-bd5b6.firebasestorage.app",
    messagingSenderId: "144914068113",
    appId: "1:144914068113:web:f45004e5cba1d614204530",
    measurementId: "G-K4DPRDLWLK"
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