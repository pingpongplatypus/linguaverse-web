// lib/firebase.ts

import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore'; // Import Firestore type
import { getStorage, FirebaseStorage } from 'firebase/storage'; // Import FirebaseStorage type

// --- APP CHECK IMPORTS (CURRENTLY COMMENTED OUT) ---
// We decided to defer App Check for now to focus on core features.
// import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';

// Your web app's Firebase configuration
// IMPORTANT: These values are crucial for connecting your app to your Firebase project.
// They have been updated with your Project X details.
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyD4Dk2gqmCwRoKirNZ_CkCaQhRqa8d716k",
  authDomain: "project-x-68603.firebaseapp.com",
  projectId: "project-x-68603",
  storageBucket: "project-x-68603.firebasestorage.app",
  messagingSenderId: "814338411344",
  appId: "1:814338411344:web:2b22e034c5b63d0f43ba55",
  measurementId: "G-YT8Q1VXJB4"
};

// Initialize Firebase App
// This ensures the Firebase app instance is created only once, which is important for Next.js (especially with hot reloading).
const app: FirebaseApp = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// --- APP CHECK INITIALIZATION (CURRENTLY COMMENTED OUT) ---
// This block is currently commented out to avoid issues related to reCAPTCHA Enterprise
// and focus on core authentication and Firestore. You can uncomment and configure this later
// if you decide to re-enable App Check for your web app.
/*
if (typeof window !== 'undefined') {
  (self as any).FIREBASE_APPCHECK_DEBUG_TOKEN = true;

  initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider("YOUR_RECAPTCHA_V3_SITE_KEY_HERE"),
    isTokenAutoRefreshEnabled: true,
  });
}
*/
// --- END APP CHECK INITIALIZATION ---

// Export Firebase service instances for easy access throughout your application.
// This allows you to import `auth`, `db`, `storage` from '@/lib/firebase' elsewhere.
export const auth: Auth = getAuth(app);
export const db: Firestore = getFirestore(app); // Changed from 'firestore' to 'db' for consistency with auth.tsx
export const storage: FirebaseStorage = getStorage(app);

// Optionally, export the Firebase app instance itself if needed.
export { app as firebaseApp };
