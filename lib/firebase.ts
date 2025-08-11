// lib/firebase.ts

import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth'; // Import Auth type for clarity
import { getFirestore, Firestore } from 'firebase/firestore'; // Import Firestore type
import { getStorage, FirebaseStorage } from 'firebase/storage'; // Import FirebaseStorage type

// --- APP CHECK IMPORTS (COMMENTED OUT FOR DIAGNOSTIC TEST) ---
// import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';

// Your web app's Firebase configuration
// IMPORTANT: Replace these placeholder values with your ACTUAL values from the Firebase Console!
// Go to Project settings (the gear icon next to "Project X") -> General tab -> Scroll down to "Your apps"
// Select your Web app, then click "Config" under "Firebase SDK snippet".
// Copy the values from there.
const firebaseConfig = {
  apiKey: "AIzaSyAZPkEYf3vNM6G6ujrxHb_R_FHWVEW9QOs", // <--- REPLACE THIS: Copy from Firebase Console
  authDomain: "project-x-68603.firebaseapp.com", // This should be correct based on your Project ID
  projectId: "project-x-68603", // This is correct
  storageBucket: "project-x-68603.firebasestorage.app", // This should be correct based on your Project ID
  messagingSenderId: "814338411344", // <--- This is your Project Number, which you provided.
  appId: "1:814338411344:web:e694c646fe9ee75f43ba55", // <--- REPLACE THIS: Copy from Firebase Console
  measurementId: "G-6LSNGDNNXS" // <--- OPTIONAL: ONLY include this line if you configured Google Analytics for your web app. If so, replace with your actual Measurement ID from the Firebase Console.
};

// Initialize Firebase
// This ensures that the app is initialized only once, even with Next.js hot reloading.
const app: FirebaseApp = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// --- APP CHECK INITIALIZATION (COMMENTED OUT FOR DIAGNOSTIC TEST) ---
/*
// This block is currently commented out to avoid issues related to reCAPTCHA Enterprise
// and focus on core authentication. You can uncomment and configure this later
// if you decide to re-enable App Check for your web app.
if (typeof window !== 'undefined') {
  // Setting this to true will log an App Check debug token in your browser console
  // during local development. You'll need to register this token in the Firebase Console
  // App Check settings for your web app if you want to test App Check locally.
  (self as any).FIREBASE_APPCHECK_DEBUG_TOKEN = true;

  initializeAppCheck(app, {
    // IMPORTANT: If you enable App Check, replace "YOUR_RECAPTCHA_V3_SITE_KEY_HERE"
    // with your actual reCAPTCHA v3 Site Key. This key comes from Google Cloud reCAPTCHA Enterprise.
    provider: new ReCaptchaV3Provider("YOUR_RECAPTCHA_V3_SITE_KEY_HERE"),
    isTokenAutoRefreshEnabled: true,
  });
}
*/
// --- END APP CHECK INITIALIZATION ---

// Export Firebase service instances directly for easy import in other components
// This makes them readily available as `auth`, `firestore`, `storage` when you import from this file.
export const auth: Auth = getAuth(app);
export const firestore: Firestore = getFirestore(app);
export const storage: FirebaseStorage = getStorage(app);

// Optionally, export the app instance itself if needed (e.g., for other Firebase module initializations)
export { app as firebaseApp };
