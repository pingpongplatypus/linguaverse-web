// lib/firebase-admin.ts

import * as admin from 'firebase-admin';

// Initialize Firebase Admin SDK only if it hasn't been initialized already
if (!admin.apps.length) {
  try {
    console.log('Attempting to initialize Firebase Admin SDK...');

    // Get the service account key JSON string from an environment variable.
    // In production (GitHub Actions), this will come from a GitHub Secret.
    // In local development, you'll put this in your .env.local file.
    const serviceAccountJsonString = process.env.FIREBASE_ADMIN_SDK_CONFIG;

    if (!serviceAccountJsonString) {
      // It's critical that this environment variable is set for the Admin SDK to work.
      throw new Error('FIREBASE_ADMIN_SDK_CONFIG environment variable is not set. Admin SDK cannot be initialized.');
    }

    let serviceAccount: admin.ServiceAccount;
    try {
      // Parse the JSON string into an object that matches admin.ServiceAccount
      const parsedServiceAccount = JSON.parse(serviceAccountJsonString);

      // Ensure the parsed object has the minimum required fields for credential.cert()
      if (
        !parsedServiceAccount.projectId ||
        !parsedServiceAccount.clientEmail ||
        !parsedServiceAccount.privateKey
      ) {
        throw new Error('Parsed service account JSON is missing required fields (projectId, clientEmail, privateKey).');
      }

      serviceAccount = {
        projectId: parsedServiceAccount.project_id || parsedServiceAccount.projectId, // Handle both snake_case and camelCase keys
        clientEmail: parsedServiceAccount.client_email || parsedServiceAccount.clientEmail,
        privateKey: parsedServiceAccount.private_key || parsedServiceAccount.privateKey,
      };

    } catch (jsonError) {
      console.error('Failed to parse FIREBASE_ADMIN_SDK_CONFIG environment variable as JSON:', jsonError);
      throw new Error('Invalid JSON format in FIREBASE_ADMIN_SDK_CONFIG environment variable.');
    }

    // Initialize the app with the credentials
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      // If you are using Firebase Realtime Database and need the URL for Admin SDK:
      // databaseURL: "https://<DATABASE_NAME>.firebaseio.com"
    });
    console.log('Firebase Admin SDK initialized successfully!');

  } catch (error) {
    console.error('Firebase Admin SDK Initialization Error:', error);
    // Re-throw the error to ensure the application doesn't proceed without Admin SDK
    throw error;
  }
} else {
  console.log('Firebase Admin SDK already initialized.');
}

// Export the initialized Admin SDK instances
export const authAdmin = admin.auth();
export const dbAdmin = admin.firestore();
export const storageAdmin = admin.storage(); // Added this export for consistency if you need storage admin
