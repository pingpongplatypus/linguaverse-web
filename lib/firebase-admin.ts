// lib/firebase-admin.ts

import * as admin from 'firebase-admin';
// Import the JSON file. We'll give it a different name to avoid confusion with the transformed object.
import serviceAccountJson from '../service-account-key.json';

// Transform the imported JSON object to match the 'admin.ServiceAccount' type's expected structure (camelCase)
const serviceAccount: admin.ServiceAccount = {
  projectId: serviceAccountJson.project_id,
  clientEmail: serviceAccountJson.client_email,
  privateKey: serviceAccountJson.private_key,
  // The ServiceAccount interface only strictly requires these three.
  // Other fields from the JSON are not directly needed for credential.cert() if these three are provided.
};

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  try {
    console.log('Attempting to initialize Firebase Admin SDK...');
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount), // Now 'serviceAccount' is correctly typed
    });
    console.log('Firebase Admin SDK initialized successfully!');
  } catch (error) {
    console.error('Firebase Admin SDK Initialization Error:', error);
    // This is where you would see errors if the key itself is bad or permissions are wrong
  }
} else {
  console.log('Firebase Admin SDK already initialized.');
}

// Export the initialized Admin SDK instances
export const authAdmin = admin.auth();
export const dbAdmin = admin.firestore();
export const storageAdmin = admin.storage();
