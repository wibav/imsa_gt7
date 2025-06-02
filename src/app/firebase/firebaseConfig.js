// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAnalytics, isSupported } from "firebase/analytics";

const firebaseConfig = {
    apiKey: "AIzaSyAkwr4sH48c2syY_BAfjWaaOTHl4nhqVmo",
    authDomain: "localhost",
    // authDomain: "imsa-bd5b6.firebaseapp.com",
    projectId: "imsa-bd5b6",
    storageBucket: "imsa-bd5b6.firebasestorage.app",
    messagingSenderId: "144914068113",
    appId: "1:144914068113:web:f45004e5cba1d614204530",
    measurementId: "G-K4DPRDLWLK"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Initialize Analytics only on the client and if supported
let analytics;
if (typeof window !== "undefined") {
    isSupported().then((supported) => {
        if (supported) {
            analytics = getAnalytics(app);
        }
    });
}

export { app, db, analytics };