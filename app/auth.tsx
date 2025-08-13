// app/auth.tsx
"use client";

import React, { useState, useEffect } from 'react';
import { auth, db } from '@/lib/firebase';
import { FirebaseError } from 'firebase/app';

import {
  doc,
  setDoc,
  Timestamp,
  onSnapshot,
  updateDoc,
  collection,
  query, // NEW: Import query
  orderBy, // NEW: Import orderBy
} from 'firebase/firestore';

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  User,
  GoogleAuthProvider,
  signInWithPopup,
  AuthCredential,
  FacebookAuthProvider,
  fetchSignInMethodsForEmail,
  EmailAuthProvider,
  linkWithCredential
} from 'firebase/auth';

// Helper function to provide user-friendly error messages
const getFriendlyErrorMessage = (errorCode: string): string => {
  switch (errorCode) {
    case 'auth/invalid-email':
      return 'The email address is not valid.';
    case 'auth/user-disabled':
      return 'This account has been disabled.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Incorrect email or password.';
    case 'auth/email-already-in-use':
      return 'This email is already registered.';
    case 'auth/weak-password':
      return 'Password should be at least 6 characters.';
    case 'auth/network-request-failed':
      return 'Network error. Please check your internet connection.';
    case 'auth/too-many-requests':
      return 'Too many failed login attempts. Please try again later.';
    case 'auth/operation-not-allowed':
      return 'This sign-in method is not enabled. Please contact support.';
    case 'auth/popup-closed-by-user':
      return 'Sign-in was cancelled by the user.';
    case 'auth/cancelled-popup-request':
      return 'Sign-in cancelled. Perhaps a popup was already open or blocked.';
    case 'auth/credential-already-in-use':
      return 'This account is already linked to another user.';
    case 'auth/provider-already-linked':
      return 'The selected provider is already linked to your account.';
    default:
      return 'An unexpected error occurred. Please try again.';
  }
};


export default function AuthComponent() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [user, setUser] = useState<User | null>(null);
  const [firestoreUserData, setFirestoreUserData] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [linkingInfo, setLinkingInfo] = useState<{
    email: string;
    pendingCredential: AuthCredential;
    existingSignInMethods: string[];
  } | null>(null);

  // State for editable user profile fields
  const [displayInputName, setDisplayInputName] = useState<string>('');
  const [nativeLangInput, setNativeLangInput] = useState<string>('');
  const [isUpdatingProfile, setIsUpdatingProfile] = useState<boolean>(false);
  const [updateMessage, setUpdateMessage] = useState<string | null>(null);

  // State for stories
  const [stories, setStories] = useState<any[]>([]);
  const [storiesLoading, setStoriesLoading] = useState<boolean>(true);
  const [selectedStoryId, setSelectedStoryId] = useState<string | null>(null);

  // NEW: State for story pages
  const [storyPages, setStoryPages] = useState<any[]>([]);
  const [currentPageIndex, setCurrentPageIndex] = useState<number>(0);
  const [pagesLoading, setPagesLoading] = useState<boolean>(false);

  // State for clicked vocabulary word and its display
  const [clickedVocab, setClickedVocab] = useState<{ word: string; token: string; } | null>(null);
  const [vocabTranslation, setVocabTranslation] = useState<string | null>(null);


  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setFirestoreUserData(null);
      setDisplayInputName('');
      setNativeLangInput('');
      setUpdateMessage(null);
      setStories([]);
      setStoriesLoading(true);
      setSelectedStoryId(null);
      setStoryPages([]); // Clear pages
      setCurrentPageIndex(0); // Reset page index
      setPagesLoading(false); // Reset page loading
      setClickedVocab(null);
      setVocabTranslation(null);

      const unsubscribes: (() => void)[] = [];

      if (currentUser) {
        console.log("Current user:", currentUser.email, currentUser.uid);
        console.log("User's Photo URL from Firebase (onAuthStateChanged):", currentUser.photoURL);
        setLinkingInfo(null);
        setEmail('');
        setPassword('');
        setError(null);

        // Listener for User's Firestore document
        const userDocRef = doc(db, "users", currentUser.uid);
        const unsubscribeFirestoreUser = onSnapshot(userDocRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            console.log("User Firestore data received:", data);
            setFirestoreUserData(data);
            setDisplayInputName(data.displayName || '');
            setNativeLangInput(data.nativeLanguage || '');
          } else {
            console.log("No user document found in Firestore!");
            setFirestoreUserData(null);
          }
        }, (firestoreError) => {
          console.error("Error listening to user document:", firestoreError);
          setError("Failed to load user profile. Please try again.");
        });
        unsubscribes.push(unsubscribeFirestoreUser);


        // Listener for Stories Collection (top-level story metadata)
        const storiesCollectionRef = collection(db, "stories");
        const unsubscribeStories = onSnapshot(storiesCollectionRef, (querySnapshot) => {
          const fetchedStories: any[] = [];
          querySnapshot.forEach((doc) => {
            fetchedStories.push({ id: doc.id, ...doc.data() });
          });
          setStories(fetchedStories);
          setStoriesLoading(false);
          console.log("Stories data received:", fetchedStories);
        }, (storiesError) => {
          console.error("Error listening to stories collection:", storiesError);
          setError("Failed to load stories. Please try again.");
          setStoriesLoading(false);
        });
        unsubscribes.push(unsubscribeStories);

      } else {
        console.log("No user signed in.");
      }

      return () => unsubscribes.forEach(unsub => unsub());
    });

    return () => unsubscribeAuth();
  }, []);


  // NEW useEffect for fetching story pages when selectedStoryId changes
  useEffect(() => {
    let unsubscribePages: (() => void) | undefined;
    if (selectedStoryId) {
      setPagesLoading(true);
      setStoryPages([]); // Clear previous pages
      setCurrentPageIndex(0); // Reset to first page

      const pagesCollectionRef = collection(db, "stories", selectedStoryId, "pages");
      // Order pages by pageNumber to ensure correct sequence
      const pagesQuery = query(pagesCollectionRef, orderBy("pageNumber"));

      unsubscribePages = onSnapshot(pagesQuery, (querySnapshot) => {
        const fetchedPages: any[] = [];
        querySnapshot.forEach((doc) => {
          fetchedPages.push({ id: doc.id, ...doc.data() });
        });
        setStoryPages(fetchedPages);
        setPagesLoading(false);
        console.log(`Pages for story ${selectedStoryId} received:`, fetchedPages);
      }, (error) => {
        console.error("Error listening to story pages:", error);
        setError("Failed to load story pages. Please try again.");
        setPagesLoading(false);
      });
    }

    return () => {
      if (unsubscribePages) {
        unsubscribePages(); // Clean up page listener
      }
    };
  }, [selectedStoryId]); // Reruns when selectedStoryId changes


  const handleVocabClick = (vocabItem: { word: string; token: string; }) => {
    setClickedVocab(vocabItem);
    setVocabTranslation(`[AI Translation for '${vocabItem.word}' goes here]`);
  };

  const renderInteractiveText = (text: string, vocabTokens: { word: string; token: string; }[]) => {
    let parts: (string | React.ReactNode)[] = [text];

    vocabTokens.forEach(token => {
      const wordToMatch = token.word;
      const newParts: (string | React.ReactNode)[] = [];

      parts.forEach(part => {
        if (typeof part === 'string') {
          const regex = new RegExp(`\\b(${wordToMatch})\\b`, 'gi');
          let lastIndex = 0;

          part.replace(regex, (match, p1, offset) => {
            newParts.push(part.substring(lastIndex, offset));
            newParts.push(
              <span
                key={`${token.token}-${offset}`}
                style={{ cursor: 'pointer', textDecoration: 'underline', color: '#007bff', fontWeight: 'bold' }}
                onClick={() => handleVocabClick(token)}
              >
                {p1}
              </span>
            );
            lastIndex = offset + match.length;
            return match;
          });
          newParts.push(part.substring(lastIndex));
        } else {
          newParts.push(part);
        }
      });
      parts = newParts;
    });

    return <>{parts}</>;
  };


  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLinkingInfo(null);
    setUpdateMessage(null);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      console.log("User signed up successfully:", userCredential.user.email);

      const newUserUid = userCredential.user.uid;
      const userDocRef = doc(db, "users", newUserUid);

      await setDoc(userDocRef, {
        email: userCredential.user.email,
        displayName: userCredential.user.displayName || 'New Learner',
        photoURL: userCredential.user.photoURL || '',
        nativeLanguage: 'en',
        currentStreak: 0,
        totalXP: 0,
        lastLogin: Timestamp.now()
      });
      console.log("User document created in Firestore:", newUserUid);

    } catch (err: any) {
      if (err instanceof FirebaseError) {
        setError(getFriendlyErrorMessage(err.code));
      } else {
        setError(getFriendlyErrorMessage('unknown'));
      }
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLinkingInfo(null);
    setUpdateMessage(null);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      console.log("User signed in successfully:", userCredential.user.email);

      if (userCredential.user) {
        const userDocRef = doc(db, "users", userCredential.user.uid);
        await setDoc(userDocRef, { lastLogin: Timestamp.now() }, { merge: true });
        console.log("User lastLogin updated in Firestore:", userCredential.user.uid);
      }

    } catch (err: any) {
      if (err instanceof FirebaseError) {
        setError(getFriendlyErrorMessage(err.code));
      } else {
        setError(getFriendlyErrorMessage('unknown'));
      }
    }
  };

  const handleSignOut = async () => {
    setError(null);
    setLinkingInfo(null);
    setUpdateMessage(null);
    try {
      await auth.signOut();
      console.log("User signed out successfully.");
    } catch (err: any) {
      if (err instanceof FirebaseError) {
        setError(getFriendlyErrorMessage(err.code));
      } else {
        setError(getFriendlyErrorMessage('unknown'));
      }
    }
  };

  const handleSocialSignIn = async (providerInstance: GoogleAuthProvider | FacebookAuthProvider) => {
    setError(null);
    setLinkingInfo(null);
    setUpdateMessage(null);
    try {
      const result = await signInWithPopup(auth, providerInstance);
      const user = result.user;
      console.log(`Signed in with ${providerInstance.providerId}:`, user.email);
      console.log("User's Photo URL from Firebase (Social Sign-in):", user.photoURL);

      const userDocRef = doc(db, "users", user.uid);
      await setDoc(userDocRef, {
        email: user.email,
        displayName: user.displayName || user.email?.split('@')[0] || 'New Learner',
        photoURL: user.photoURL || '',
        nativeLanguage: 'en',
        currentStreak: 0,
        totalXP: 0,
        lastLogin: Timestamp.now()
      }, { merge: true });
      console.log("User document processed in Firestore for social sign-in:", user.uid);

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
              setError(getFriendlyErrorMessage(err.code) + ` Please sign in with one of your existing methods to link accounts.`);
          } catch (fetchErr: any) {
              setError(getFriendlyErrorMessage('unknown'));
          }
        } else {
          setError(getFriendlyErrorMessage(err.code));
        }
      } else {
        setError(getFriendlyErrorMessage('unknown'));
      }
    }
  };

  const handleGoogleSignIn = () => handleSocialSignIn(new GoogleAuthProvider());
  const handleFacebookSignIn = () => handleSocialSignIn(new FacebookAuthProvider());


  const handleSignInForLinking = async (method: string) => {
    setError(null);
    setUpdateMessage(null);
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
        userCredential = await signInWithPopup(auth, new GoogleAuthProvider());
      } else {
        setError("Unsupported linking method: " + method);
        return;
      }
      if (auth.currentUser) {
        console.log("Attempting to link new credential to current user:", auth.currentUser.email);
        console.log("Pending credential for linking:", linkingInfo.pendingCredential);
        await linkWithCredential(auth.currentUser, linkingInfo.pendingCredential);
        console.log("Accounts successfully linked!");
        setError(null);
        setLinkingInfo(null);
      } else {
        setError("Failed to sign in for linking. No active user after sign-in attempt.");
      }
    } catch (err: any) {
      if (err instanceof FirebaseError) {
        setError(getFriendlyErrorMessage(err.code));
        if (err.code === 'auth/credential-already-in-use') {
            setError("This account is already linked to another user.");
        } else if (err.code === 'auth/provider-already-linked') {
            setError(`The selected provider (${getProviderDisplayName(method)}) is already linked to your account.`);
        } else {
            setError(`Linking failed: ${getFriendlyErrorMessage(err.code)}. Please try again.`);
        }
      } else {
        setError(getFriendlyErrorMessage('unknown'));
      }
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setUpdateMessage(null);
    setIsUpdatingProfile(true);

    if (!user || !user.uid) {
      setError("No user is signed in to update profile.");
      setIsUpdatingProfile(false);
      return;
    }

    try {
      const userDocRef = doc(db, "users", user.uid);
      await updateDoc(userDocRef, {
        displayName: displayInputName,
        nativeLanguage: nativeLangInput,
      });
      setUpdateMessage("Profile updated successfully!");
      console.log("User profile updated in Firestore!");
    } catch (err: any) {
      console.error("Error updating profile:", err);
      if (err instanceof FirebaseError) {
        setError("Failed to update profile: " + getFriendlyErrorMessage(err.code));
      } else {
        setError("Failed to update profile: An unexpected error occurred.");
      }
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  // NEW: Navigation functions for story pages
  const handleNextPage = () => {
    if (currentPageIndex < storyPages.length - 1) {
      setCurrentPageIndex(prev => prev + 1);
      setClickedVocab(null); // Clear vocab pop-up on page change
      setVocabTranslation(null);
    }
  };

  const handlePrevPage = () => {
    if (currentPageIndex > 0) {
      setCurrentPageIndex(prev => prev - 1);
      setClickedVocab(null); // Clear vocab pop-up on page change
      setVocabTranslation(null);
    }
  };


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

  // Find the currently selected story from the stories array
  const selectedStory = selectedStoryId ? stories.find(s => s.id === selectedStoryId) : null;
  // Get the current page data
  const currentPageData = storyPages[currentPageIndex] || null;


  return (
    <div style={{ padding: '20px', border: '1px solid #eee', borderRadius: '8px', maxWidth: '400px', margin: '20px auto' }}>
      <h2 style={{ textAlign: 'center', marginBottom: '20px' }}>LinguaVerse</h2>

      {user ? (
        <div style={{ textAlign: 'center' }}>
          <p>Welcome, <strong style={{ color: '#0070f3' }}>{firestoreUserData?.displayName || user.email || "User"}</strong>!</p>
          {user.photoURL && (
            <img
              src={user.photoURL}
              alt="User profile"
              style={{
                width: '100px',
                height: '100px',
                borderRadius: '50%',
                objectFit: 'cover',
                marginTop: '10px',
                border: '2px solid #ccc',
                backgroundColor: 'transparent',
                display: 'block',
                margin: '0 auto 10px auto'
              }}
            />
          )}

          {/* User Profile & Edit Section */}
          {firestoreUserData ? (
            <div style={{ marginTop: '20px', borderTop: '1px solid #eee', paddingTop: '10px', textAlign: 'left' }}>
              <p><strong>Email:</strong> {firestoreUserData.email}</p>
              <p><strong>Current Streak:</strong> {firestoreUserData.currentStreak}</p>
              <p><strong>Total XP:</strong> {firestoreUserData.totalXP}</p>
              <p style={{fontSize: '0.8em', color: '#666'}}>Last Login: {firestoreUserData.lastLogin?.toDate().toLocaleString() || 'N/A'}</p>

              <h3 style={{ marginTop: '25px', marginBottom: '15px', textAlign: 'center' }}>Edit Profile</h3>
              <form onSubmit={handleUpdateProfile} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <label>
                  Display Name:
                  <input
                    type="text"
                    value={displayInputName}
                    onChange={(e) => setDisplayInputName(e.target.value)}
                    style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc', width: '100%', boxSizing: 'border-box', marginTop: '5px' }}
                    disabled={isUpdatingProfile}
                  />
                </label>
                <label>
                  Native Language (e.g., 'es', 'fr', 'ja'):
                  <input
                    type="text"
                    value={nativeLangInput}
                    onChange={(e) => setNativeLangInput(e.target.value)}
                    style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc', width: '100%', boxSizing: 'border-box', marginTop: '5px' }}
                    disabled={isUpdatingProfile}
                  />
                </label>
                <button
                  type="submit"
                  disabled={isUpdatingProfile}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#17a2b8',
                    color: 'white',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: isUpdatingProfile ? 'not-allowed' : 'pointer',
                    marginTop: '10px'
                  }}
                >
                  {isUpdatingProfile ? 'Updating...' : 'Save Profile Changes'}
                </button>
              </form>
              {updateMessage && <p style={{ color: 'green', textAlign: 'center', marginTop: '10px' }}>{updateMessage}</p>}
            </div>
          ) : (
            <p style={{ marginTop: '20px', color: '#888' }}>Loading user profile from Firestore...</p>
          )}

          {/* Story List OR Selected Story Detail */}
          {selectedStory ? (
            // Detailed Story View
            <div style={{ marginTop: '30px', borderTop: '1px solid #eee', paddingTop: '20px', textAlign: 'left' }}>
              <button
                onClick={() => { setSelectedStoryId(null); setClickedVocab(null); setVocabTranslation(null); }}
                style={{
                  padding: '8px 15px',
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  marginBottom: '15px'
                }}
              >
                ← Back to All Stories
              </button>
              <h3 style={{ textAlign: 'center', marginBottom: '10px' }}>{selectedStory.title}</h3>
              <p style={{ margin: '5px 0', fontSize: '0.9em', color: '#555', textAlign: 'center' }}>
                Level: {selectedStory.level} | Category: {selectedStory.category} | Est. Reading Time: {selectedStory.estimatedReadingTimeMinutes} min
              </p>

              {pagesLoading ? (
                <p style={{ textAlign: 'center', color: '#888' }}>Loading pages...</p>
              ) : storyPages.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#888' }}>No pages found for this story.</p>
              ) : (
                <div style={{ border: '1px solid #ddd', padding: '15px', borderRadius: '8px', backgroundColor: '#fdfdfd' }}>
                  {/* Page Number Display */}
                  <p style={{textAlign: 'right', fontSize: '0.9em', color: '#777'}}>Page {currentPageIndex + 1} of {storyPages.length}</p>

                  {/* Page Image */}
                  {currentPageData.imageUrl && (
                    <img
                      src={currentPageData.imageUrl}
                      alt={`Story image for page ${currentPageIndex + 1}`}
                      style={{ maxWidth: '100%', height: 'auto', marginBottom: '15px', borderRadius: '5px' }}
                    />
                  )}

                  {/* Page Text */}
                  <div style={{ lineHeight: '1.6', fontSize: '1.1em', marginBottom: '15px' }}>
                    {renderInteractiveText(currentPageData.textEnglish, currentPageData.vocabularyTokens || [])}
                  </div>

                  {/* Page Audio */}
                  {currentPageData.audioUrl && (
                    <div style={{ textAlign: 'center', marginBottom: '15px' }}>
                      <audio controls src={currentPageData.audioUrl} style={{ width: '100%' }}>
                        Your browser does not support the audio element.
                      </audio>
                    </div>
                  )}

                  {/* Page Navigation Buttons */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px' }}>
                    <button
                      onClick={handlePrevPage}
                      disabled={currentPageIndex === 0}
                      style={{
                        padding: '8px 15px',
                        backgroundColor: '#007bff',
                        color: 'white',
                        border: 'none',
                        borderRadius: '5px',
                        cursor: currentPageIndex === 0 ? 'not-allowed' : 'pointer',
                      }}
                    >
                      Previous
                    </button>
                    <button
                      onClick={handleNextPage}
                      disabled={currentPageIndex === storyPages.length - 1}
                      style={{
                        padding: '8px 15px',
                        backgroundColor: '#007bff',
                        color: 'white',
                        border: 'none',
                        borderRadius: '5px',
                        cursor: currentPageIndex === storyPages.length - 1 ? 'not-allowed' : 'pointer',
                      }}
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}

              {clickedVocab && vocabTranslation && (
                <div style={{
                  marginTop: '15px',
                  padding: '10px 15px',
                  backgroundColor: '#e9ecef',
                  border: '1px solid #ced4da',
                  borderRadius: '5px',
                  textAlign: 'center'
                }}>
                  <p><strong>{clickedVocab.word}</strong>: {vocabTranslation}</p>
                  <button
                    onClick={() => { setClickedVocab(null); setVocabTranslation(null); }}
                    style={{
                      marginTop: '5px',
                      padding: '5px 10px',
                      backgroundColor: '#adb5bd',
                      color: 'white',
                      border: 'none',
                      borderRadius: '3px',
                      cursor: 'pointer',
                      fontSize: '0.8em'
                    }}
                  >
                    Close
                  </button>
                </div>
              )}
            </div>
          ) : (
            // Original Story List
            <div style={{ marginTop: '30px', borderTop: '1px solid #eee', paddingTop: '20px' }}>
              <h3 style={{ textAlign: 'center', marginBottom: '15px' }}>Explore Stories</h3>
              {storiesLoading ? (
                <p style={{ textAlign: 'center', color: '#888' }}>Loading stories...</p>
              ) : stories.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#888' }}>No stories found. Start adding some!</p>
              ) : (
                <ul style={{ listStyle: 'none', padding: 0, textAlign: 'left' }}>
                  {stories.map((story) => (
                    <li
                      key={story.id}
                      onClick={() => setSelectedStoryId(story.id)}
                      style={{
                        backgroundColor: '#f8f8f8',
                        border: '1px solid #ddd',
                        borderRadius: '5px',
                        padding: '10px 15px',
                        marginBottom: '10px',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                        cursor: 'pointer'
                      }}
                    >
                      <h4>{story.title}</h4>
                      <p style={{ margin: '5px 0', fontSize: '0.9em', color: '#555' }}>
                        Level: {story.level} | Category: {story.category}
                      </p>
                      {/* Note: estimatedReadingTimeMinutes is now on the main story document */}
                      <p style={{ fontSize: '0.8em', color: '#777' }}>
                        Est. Reading Time: {story.estimatedReadingTimeMinutes} min
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <button
            onClick={handleSignOut}
            style={{
              padding: '10px 20px',
              backgroundColor: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              marginTop: '20px'
            }}
          >
            Sign Out
          </button>
        </div>
      ) : linkingInfo ? (
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
            onClick={() => { setLinkingInfo(null); setError(null); }}
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
      ) : (
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
            <button
              onClick={handleGoogleSignIn}
              style={{
                padding: '10px 20px',
                backgroundColor: '#db4437',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer',
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                margin: '0 auto 10px auto'
              }}
            >
              <img src="https://img.icons8.com/color/24/000000/google-logo.png" alt="Google logo" style={{ width: '18px', height: '18px' }}/>
              Sign in with Google
            </button>

            <button
              onClick={handleFacebookSignIn}
              style={{
                padding: '10px 20px',
                backgroundColor: '#4267B2',
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
