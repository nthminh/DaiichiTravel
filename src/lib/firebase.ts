import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase only if API key is present
const isConfigured = !!import.meta.env.VITE_FIREBASE_API_KEY;

// Use named database if provided, otherwise fall back to '(default)'
const databaseId = import.meta.env.VITE_FIREBASE_DATABASE_ID || '(default)';

export const app = isConfigured ? initializeApp(firebaseConfig) : null;
export const db = app ? getFirestore(app, databaseId) : null;
export const auth = app ? getAuth(app) : null;
export const storage = app ? getStorage(app) : null;
