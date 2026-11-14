import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyD4BQaF68jcrTLUkIFg3Bubfgk3bFmLpFw",
  authDomain: "medora-55cfd.firebaseapp.com",
  projectId: "medora-55cfd",
  storageBucket: "medora-55cfd.firebasestorage.app",
  messagingSenderId: "1029910166277",
  appId: "1:1029910166277:web:455f80d7ac346d13c9156c",
  measurementId: "G-B5S8FHC47N"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

let firestoreDb = null;
try {
  firestoreDb = getFirestore(app);
} catch (e) {
  console.warn("Firestore initialization error:", e);
}
export const db = firestoreDb;

let analytics = null;
if (typeof window !== "undefined") {
  try {
    analytics = getAnalytics(app);
  } catch (e) {
    console.warn("Analytics initialization error:", e);
  }
}
export { analytics };
export default app;
