import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, getReactNativePersistence, initializeAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { Platform } from 'react-native';

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
const db = getFirestore(app);

// Initialize Storage
const storage = getStorage(app);

// Initialize Auth with persistence based on the platform
// We use a conditional check to ensure initializeAuth is only called once
const auth = (() => {
  if (Platform.OS === 'web') {
    return getAuth(app);
  }
  // For Native, try to get existing auth first, otherwise initialize
  try {
    return getAuth(app);
  } catch (e) {
    return initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  }
})();

export { auth, db, storage };

