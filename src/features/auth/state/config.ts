import { getAnalytics, isSupported } from 'firebase/analytics';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// TODO: Replace these placeholders with your actual Firebase project keys
// You can find these in your Firebase Console: Project Settings > General > Your apps (Web app)
const firebaseConfig = {
  apiKey: "AIzaSyD3SbdjW6LBk82quh-2A_iNEAFuSCNdJOA",
  authDomain: "ebuy-7bda2.firebaseapp.com",
  projectId: "ebuy-7bda2",
  storageBucket: "ebuy-7bda2.firebasestorage.app",
  messagingSenderId: "581497630541",
  appId: "1:581497630541:web:c5a846c53fb0c6ab141104",
  measurementId: "G-YYM8ZQP16R"
};

// Initialize Firebase App
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Firestore
export const db = getFirestore(app);

// Initialize Analytics Promise for safe usage across platforms
export const analyticsPromise = isSupported().then(yes => yes ? getAnalytics(app) : null);

// Initialize Storage
export const storage = getStorage(app);

export const auth = getAuth(app);


