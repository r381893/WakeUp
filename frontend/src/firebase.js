import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

export const firebaseConfig = {
    apiKey: "AIzaSyCzQHpp6_ZVfzfp2-OEkhsOoC1HbzUTIUc",
    authDomain: "wakeup-366cb.firebaseapp.com",
    databaseURL: "https://wakeup-366cb-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "wakeup-366cb",
    storageBucket: "wakeup-366cb.firebasestorage.app",
    messagingSenderId: "27008088057",
    appId: "1:27008088057:web:10e4705ee58d4a97702f28",
    measurementId: "G-TC2SCPCPRK"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
