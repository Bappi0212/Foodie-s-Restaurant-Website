// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyCFWHbGtx-SPHY9pbk_T0EUY6OZnasq2sU",
    authDomain: "foodie-s-restaurant.firebaseapp.com",
    projectId: "foodie-s-restaurant",
    storageBucket: "foodie-s-restaurant.firebasestorage.app",
    messagingSenderId: "593354810549",
    appId: "1:593354810549:web:6b6eadce5c5c2d375a8afc",
    measurementId: "G-BLRK16XCVQ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Cloud Firestore and export it so our App.jsx can use it
export const db = getFirestore(app);