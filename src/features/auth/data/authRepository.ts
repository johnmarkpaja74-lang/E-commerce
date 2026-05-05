import { auth, db, storage } from '@/src/features/auth/state/config';
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  signInWithCredential,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  User
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import type { UserSession } from '../model/types';

const mapFirebaseUser = (user: User): UserSession => ({
  id: user.uid,
  email: user.email ?? '',
  displayName: user.displayName,
  photoURL: user.photoURL,
});

const getAuthErrorMessage = (error: any): string => {
  switch (error.code) {
    case 'auth/email-already-in-use':
      return 'This email is already registered. Try logging in.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/weak-password':
      return 'The password is too weak. Please use at least 6 characters.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
      return 'Invalid email or password.';
    default:
      return error.message || 'An unexpected error occurred. Please try again.';
  }
};

export const authRepository = {
  ensureTables(): void {
    // No longer needed for Auth as Firebase handles infrastructure.
  },

  async register(email: string, password: string, displayName: string): Promise<UserSession> {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const uid = userCredential.user.uid;

      // Seed the avatar with the UID to ensure everyone is different
      const defaultPhotoURL = `https://api.dicebear.com/7.x/avataaars/png?seed=${uid}`;

      await updateProfile(userCredential.user, { displayName, photoURL: defaultPhotoURL });
      
      // Initialize a Firestore document for this user's cloud settings
      await setDoc(doc(db, 'users', uid), {
        email: userCredential.user.email,
        displayName: displayName,
        photoURL: defaultPhotoURL,
        address: '123 Main Street, New York, USA',
        notificationsEnabled: true,
        language: 'English',
        trustedDevice: true,
        role: 'user',
        currency: 'USD',
        createdAt: new Date().toISOString(),
      });

      return {
        id: userCredential.user.uid,
        email: userCredential.user.email ?? '',
        displayName: displayName,
        photoURL: defaultPhotoURL,
      };
    } catch (error) {
      throw new Error(getAuthErrorMessage(error));
    }
  },

  async login(email: string, password: string): Promise<UserSession> {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      return mapFirebaseUser(userCredential.user);
    } catch (error) {
      throw new Error(getAuthErrorMessage(error));
    }
  },

  async loginWithGoogle(idToken: string): Promise<UserSession> {
    try {
      const credential = GoogleAuthProvider.credential(idToken);
      const userCredential = await signInWithCredential(auth, credential);
      
      // Check if user document exists in Firestore, if not create it
      const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
      if (!userDoc.exists()) {
        await setDoc(doc(db, 'users', userCredential.user.uid), {
          email: userCredential.user.email,
          displayName: userCredential.user.displayName,
          photoURL: userCredential.user.photoURL,
          address: '123 Main Street, New York, USA',
          createdAt: new Date().toISOString(),
        });
      }

      return mapFirebaseUser(userCredential.user);
    } catch (error) {
      throw new Error('Google Sign-In failed');
    }
  },

  async sendPasswordReset(email: string): Promise<void> {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (error) {
      throw new Error('Failed to send reset email. Please check the address.');
    }
  },

  async updateProfilePicture(uri: string): Promise<string> {
    const user = auth.currentUser;
    if (!user) throw new Error('No authenticated user');

    // Convert URI to Blob for Firebase Storage
    const response = await fetch(uri);
    const blob = await response.blob();

    // Create a reference to 'avatars/uid.jpg'
    const storageRef = ref(storage, `avatars/${user.uid}`);
    
    await uploadBytes(storageRef, blob);
    const downloadURL = await getDownloadURL(storageRef);

    // Update both Auth Profile and Firestore
    await updateProfile(user, { photoURL: downloadURL });
    await setDoc(doc(db, 'users', user.uid), { photoURL: downloadURL }, { merge: true });

    return downloadURL;
  },

  persistSession(userId: string): void {
    // Firebase handles this automatically via the SDK.
  },

  async onSessionChange(callback: (session: UserSession | null) => void): Promise<void> {
  },

  async clearSession(): Promise<void> {
    await signOut(auth);
  },
};