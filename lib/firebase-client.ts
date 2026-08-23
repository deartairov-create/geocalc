import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

// Firebase web configuration is public by design. Access is protected by
// Firebase Authentication rules and the project's Authorized domains list.
const firebaseConfig = {
  apiKey: "AIzaSyAlAkhctwyK52iZH0Wa57nMH_yM74A3HAU",
  authDomain: "geocalc-64d8b.firebaseapp.com",
  projectId: "geocalc-64d8b",
  storageBucket: "geocalc-64d8b.firebasestorage.app",
  messagingSenderId: "834604276162",
  appId: "1:834604276162:web:e9fe5688c5a3d0d8871e5b",
};

const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const firebaseAuth = getAuth(firebaseApp);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

