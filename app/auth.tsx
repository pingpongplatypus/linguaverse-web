// app/auth.tsx
"use client";

import React, { useState, useEffect } from 'react';
import { auth } from '@/lib/firebase';
import { FirebaseError } from 'firebase/app'; // Import FirebaseError from 'firebase/app'
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  User,
  // Google Sign-In specific imports
  GoogleAuthProvider,
  signInWithPopup,
  AuthCredential,
  // Facebook Sign-In specific imports
  FacebookAuthProvider,
  // Imports for Account Linking
  fetchSignInMethodsForEmail, // To get existing methods for a conflicting email
  EmailAuthProvider,          // To identify Email/Password as a linking option
  linkWithCredential          // To link the new credential to the existing user
} from 'firebase/auth';

export default function AuthComponent() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);
  // NEW STATE: To manage the account linking flow
  const [linkingInfo, setLinkingInfo] = useState<{
    email: string; // The email of the conflicting account
    pendingCredential: AuthCredential; // The credential (e.g., Google/Facebook) the user just tried to sign in with
    existingSignInMethods: string[]; // List of methods Firebase knows for that email
  } | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        console.log("Current user:", currentUser.email, currentUser.uid);
        console.log("User's Photo URL from Firebase (onAuthStateChanged):", currentUser.photoURL); // Log for debugging
        // Clear linking info and form fields if user successfully signed in (or linked)
        setLinkingInfo(null);
        setEmail('');
        setPassword('');
        setError(null); // Clear error on successful auth state change
      } else {
        console.log("No user signed in.");
      }
    });
    return () => unsubscribe();
  }, []);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); // Clear error at start of new attempt
    setLinkingInfo(null); // Clear any linking state
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      console.log("User signed up successfully:", userCredential.user.email);
    } catch (err: any) {
      console.error("Error signing up:", err.code, err.message); // Keep as error for unexpected signup issues
      setError(err.message);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); // Clear error at start of new attempt
    setLinkingInfo(null); // Clear any linking state
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      console.log("User signed in successfully:", userCredential.user.email);
    } catch (err: any) {
      console.error("Error signing in:", err.code, err.message); // Keep as error for unexpected signin issues
      setError(err.message);
    }
  };

  const handleSignOut = async () => {
    setError(null); // Clear error at start of new attempt
    setLinkingInfo(null); // Clear any linking state
    try {
      await auth.signOut();
      console.log("User signed out successfully.");
    } catch (err: any) {
      console.error("Error signing out:", err.message); // Keep as error for unexpected signout issues
      setError(err.message);
    }
  };

  // Generic handler for social sign-in (Google, Facebook)
  // Contains logic to detect and initiate account linking
  const handleSocialSignIn = async (providerInstance: GoogleAuthProvider | FacebookAuthProvider) => {
    setError(null); // Clear error at start of new attempt
    setLinkingInfo(null); // Always clear linking state before a new sign-in attempt
    try {
      const result = await signInWithPopup(auth, providerInstance);
      const user = result.user; // Get the user from the result
      console.log(`Signed in with ${providerInstance.providerId}:`, user.email);
      console.log("User's Photo URL from Firebase (Social Sign-in):", user.photoURL); // Log for debugging
      // onAuthStateChanged will handle updating the user state and clearing errors
    } catch (err: any) {
      if (err instanceof FirebaseError) {
        if (err.code === 'auth/account-exists-with-different-credential') {
          console.warn(`Account exists conflict detected for ${err.customData?.email}. Initiating linking flow.`);

          const conflictEmail = err.customData?.email as string;
          let pendingCredential: AuthCredential | null = null;
          if (providerInstance instanceof GoogleAuthProvider) {
              pendingCredential = GoogleAuthProvider.credentialFromError(err);
          } else if (providerInstance instanceof FacebookAuthProvider) {
              pendingCredential = FacebookAuthProvider.credentialFromError(err);
          }

          if (!pendingCredential) {
              setError("Could not retrieve pending credential for linking. Please try again.");
              return;
          }

          try {
              let methods = await fetchSignInMethodsForEmail(auth, conflictEmail);
              console.log("Existing sign-in methods for", conflictEmail, ":", methods);

              if (methods.length === 0) {
                  console.warn("fetchSignInMethodsForEmail returned empty for a conflicting account. Inferring common providers.");
                  if (conflictEmail.endsWith('@gmail.com') || conflictEmail.endsWith('@googlemail.com')) {
                      methods = [GoogleAuthProvider.PROVIDER_ID, EmailAuthProvider.EMAIL_PASSWORD_SIGN_IN_METHOD];
                  } else {
                      methods = [EmailAuthProvider.EMAIL_PASSWORD_SIGN_IN_METHOD, FacebookAuthProvider.PROVIDER_ID];
                  }
                  methods = methods.filter(m => m !== providerInstance.providerId);
              }

              setLinkingInfo({
                  email: conflictEmail,
                  pendingCredential: pendingCredential,
                  existingSignInMethods: methods,
              });
              setError(`An account with this email (${conflictEmail}) already exists. Please sign in with one of your existing methods to link accounts.`); // This sets the error for our custom UI
          } catch (fetchErr: any) {
              console.error("Error fetching sign-in methods:", fetchErr.message); // Keep as error for fetching issues
              setError("Failed to determine existing sign-in methods. Please try again.");
          }
        } else if (err.code === 'auth/popup-closed-by-user') {
          console.warn('Sign-in was canceled by the user (popup closed).');
          setError('Sign-in was canceled by the user.');
        } else if (err.code === 'auth/cancelled-popup-request') {
          console.warn('Sign-in cancelled: a popup request was already in progress or blocked.');
          setError('Sign-in cancelled. Perhaps a popup was already open or blocked.');
        } else if (err.code === 'auth/operation-not-allowed') {
          console.error(`This sign-in method (${providerInstance.providerId}) is not enabled in Firebase Authentication.`);
          setError(`This sign-in method is not enabled in Firebase Authentication. Please enable ${providerInstance.providerId} in your Firebase console.`);
        } else {
          console.error(`Unexpected Firebase Auth error during social sign-in (${providerInstance.providerId}):`, err.code, err.message);
          setError(err.message);
        }
      } else {
        console.error(`An unknown error occurred during social sign-in (${providerInstance.providerId}):`, err);
        setError(`An unknown error occurred: ${err.message || 'Please try again.'}`);
      }
    }
  };

  const handleGoogleSignIn = () => handleSocialSignIn(new GoogleAuthProvider());
  const handleFacebookSignIn = () => handleSocialSignIn(new FacebookAuthProvider());

  // NEW FUNCTION: Handles sign-in to link accounts
  const handleSignInForLinking = async (method: string) => {
    setError(null); // Clear error at start of new attempt
    if (!linkingInfo || !linkingInfo.email || !linkingInfo.pendingCredential) {
      setError("No account linking process is active.");
      return;
    }

    try {
      let userCredential;
      if (method === EmailAuthProvider.EMAIL_PASSWORD_SIGN_IN_METHOD) {
        if (!email || !password) {
            setError("Please enter your email and password to sign in for linking.");
            return;
        }
        userCredential = await signInWithEmailAndPassword(auth, linkingInfo.email, password);
      } else if (method === GoogleAuthProvider.PROVIDER_ID) {
        userCredential = await signInWithPopup(auth, new GoogleAuthProvider());
      } else if (method === FacebookAuthProvider.PROVIDER_ID) {
        userCredential = await signInWithPopup(auth, new FacebookAuthProvider());
      } else {
        setError("Unsupported linking method: " + method);
        return;
      }

      if (auth.currentUser) {
        console.log("Attempting to link new credential to current user:", auth.currentUser.email);
        console.log("Pending credential for linking:", linkingInfo.pendingCredential);
        await linkWithCredential(auth.currentUser, linkingInfo.pendingCredential);
        console.log("Accounts successfully linked!");
        setError(null); // Clear error on successful link!
        setLinkingInfo(null); // Clear linking state, will also trigger useEffect to update UI
      } else {
        setError("Failed to sign in for linking. No active user after sign-in attempt.");
      }
    } catch (err: any) {
      console.error("Error during linking sign-in:", err.code, err.message);
      setError(err.message);
      if (err instanceof FirebaseError && err.code === 'auth/credential-already-in-use') {
          setError("This account is already linked to another user.");
      } else if (err instanceof FirebaseError && err.code === 'auth/provider-already-linked') {
          setError(`The selected provider (${getProviderDisplayName(method)}) is already linked to your account.`);
      } else {
          setError(`Linking failed: ${err.message}. Please try again.`);
      }
    }
  };

  // Helper to render provider names for display
  const getProviderDisplayName = (providerId: string) => {
    switch (providerId) {
      case EmailAuthProvider.EMAIL_PASSWORD_SIGN_IN_METHOD:
        return "Email/Password";
      case GoogleAuthProvider.PROVIDER_ID:
        return "Google";
      case FacebookAuthProvider.PROVIDER_ID:
        return "Facebook";
      default:
        return providerId;
    }
  };


  return (
    <div style={{ padding: '20px', border: '1px solid #eee', borderRadius: '8px', maxWidth: '400px', margin: '20px auto' }}>
      <h2 style={{ textAlign: 'center', marginBottom: '20px' }}>LinguaVerse Authentication</h2>

      {user ? (
        <div style={{ textAlign: 'center' }}>
          <p>Welcome, <strong style={{ color: '#0070f3' }}>{user.email}</strong>!</p>
          <p>Your Photo URL: {user.photoURL || "Not available"}</p> {/* Display the Photo URL */}
          {/* Robust image rendering for profile picture */}
          <img
            src={user.photoURL || ''} // Provide empty string if photoURL is null
            alt={user.photoURL ? "User profile" : "No profile picture"} // Better alt text
            style={{
              width: '100px',
              height: '100px',
              borderRadius: '50%',
              objectFit: 'cover',
              marginTop: '10px',
              border: '2px solid #ccc',
              // Optional: Add a background color if no image to show a circle placeholder
              backgroundColor: user.photoURL ? 'transparent' : '#f0f0f0',
              display: user.photoURL || user ? 'block' : 'none' // Ensure it's hidden if no user at all
            }}
          />
          <button
            onClick={handleSignOut}
            style={{
              padding: '10px 20px',
              backgroundColor: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              marginTop: '10px'
            }}
          >
            Sign Out
          </button>
        </div>
      ) : linkingInfo ? ( // If an account linking process is active
        <div style={{ textAlign: 'center' }}>
          <h3>Account Linking Required</h3>
          <p>An account with the email <strong style={{ color: '#0070f3' }}>{linkingInfo.email}</strong> already exists.</p>
          <p>Please sign in using one of your existing methods to link your new account:</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '20px' }}>
            {linkingInfo.existingSignInMethods.map(method => (
              <button
                key={method}
                onClick={() => handleSignInForLinking(method)}
                style={{
                  padding: '10px 20px',
                  backgroundColor: method === EmailAuthProvider.EMAIL_PASSWORD_SIGN_IN_METHOD ? '#007bff' : (method === GoogleAuthProvider.PROVIDER_ID ? '#db4437' : '#4267B2'),
                  color: 'white',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  margin: '0 auto'
                }}
              >
                {method === EmailAuthProvider.EMAIL_PASSWORD_SIGN_IN_METHOD ? (
                    getProviderDisplayName(method)
                ) : (
                    <>
                        <img
                            src={method === GoogleAuthProvider.PROVIDER_ID ? "https://img.icons8.com/color/24/000000/google-logo.png" : "https://img.icons8.com/ios-filled/24/ffffff/facebook-new.png"}
                            alt={`${getProviderDisplayName(method)} logo`}
                            style={{ width: '18px', height: '18px' }}
                        />
                        Sign in with {getProviderDisplayName(method)}
                    </>
                )}
              </button>
            ))}
          </div>

          {/* Show email/password fields if it's an existing method for linking */}
          {linkingInfo.existingSignInMethods.includes(EmailAuthProvider.EMAIL_PASSWORD_SIGN_IN_METHOD) && (
              <div style={{ marginTop: '20px', borderTop: '1px solid #eee', paddingTop: '20px' }}>
                  <p>If using Email/Password, enter your password below and click the Email/Password button above:</p>
                  <input
                    type="email"
                    placeholder="Email"
                    value={linkingInfo.email}
                    readOnly
                    style={{ padding: '10px', borderRadius: '5px', border: '1px solid #ccc', width: '100%', marginBottom: '10px', backgroundColor: '#f0f0f0' }}
                  />
                  <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    style={{ padding: '10px', borderRadius: '5px', border: '1px solid #ccc', width: '100%', marginBottom: '10px' }}
                  />
              </div>
          )}
          <button
            onClick={() => { setLinkingInfo(null); setError(null); }} // Clear linking state AND error on cancel
            style={{
              padding: '8px 15px',
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              marginTop: '20px'
            }}
          >
            Cancel Linking
          </button>
        </div>
      ) : ( // Default view: regular sign-up/sign-in forms
        <>
          {/* Email/Password Sign Up Form */}
          <form onSubmit={handleSignUp} style={{ marginBottom: '30px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <h3 style={{ margin: '0', textAlign: 'center' }}>Sign Up with Email</h3>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{ padding: '10px', borderRadius: '5px', border: '1px solid #ccc' }}
            />
            <input
              type="password"
              placeholder="Password (min 6 characters)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{ padding: '10px', borderRadius: '5px', border: '1px solid #ccc' }}
            />
            <button
              type="submit"
              style={{
                padding: '10px 20px',
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer'
              }}
            >
              Sign Up
            </button>
          </form>

          {/* Email/Password Sign In Form */}
          <form onSubmit={handleSignIn} style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
            <h3 style={{ margin: '0', textAlign: 'center' }}>Sign In with Email</h3>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{ padding: '10px', borderRadius: '5px', border: '1px solid #ccc' }}
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{ padding: '10px', borderRadius: '5px', border: '1px solid #ccc' }}
            />
            <button
              type="submit"
              style={{
                padding: '10px 20px',
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer'
              }}
            >
              Sign In
            </button>
          </form>

          {/* Social Sign-In Buttons */}
          <div style={{ textAlign: 'center', marginTop: '20px' }}>
            <p style={{ marginBottom: '10px' }}>Or sign in with:</p>
            {/* Google Sign-In Button */}
            <button
              onClick={handleGoogleSignIn}
              style={{
                padding: '10px 20px',
                backgroundColor: '#db4437', // Google Red
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer',
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                margin: '0 auto 10px auto' // Center and add bottom margin
              }}
            >
              <img src="https://img.icons8.com/color/24/000000/google-logo.png" alt="Google logo" style={{ width: '18px', height: '18px' }}/>
              Sign in with Google
            </button>

            {/* Facebook Sign-In Button */}
            <button
              onClick={handleFacebookSignIn}
              style={{
                padding: '10px 20px',
                backgroundColor: '#4267B2', // Facebook Blue
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer',
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                margin: '0 auto' // Center the button
              }}
            >
              <img src="https://img.icons8.com/ios-filled/24/ffffff/facebook-new.png" alt="Facebook logo" style={{ width: '18px', height: '18px' }}/>
              Sign in with Facebook
            </button>
          </div>
        </>
      )}

      {error && <p style={{ color: 'red', textAlign: 'center', marginTop: '20px' }}>Error: {error}</p>}
    </div>
  );
}
