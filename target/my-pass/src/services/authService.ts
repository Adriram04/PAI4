/**
 * Authentication Service
 *
 * Wraps Firebase Auth operations for email/password and Google authentication.
 * Includes email verification, password reset, account deletion, and TOTP 2FA.
 */

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  sendEmailVerification,
  sendPasswordResetEmail,
  deleteUser,
  EmailAuthProvider,
  reauthenticateWithCredential,
  User,
} from "firebase/auth";
import { Platform } from "react-native";
import { auth, db } from "../config/firebase";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

/**
 * Initialize user metadata document in Firestore.
 * This document tracks vault status and password count.
 */
async function initializeUserMetadata(userId: string): Promise<void> {
  const metadataRef = doc(db, `users/${userId}/metadata/profile`);
  const snapshot = await getDoc(metadataRef);

  if (!snapshot.exists()) {
    await setDoc(metadataRef, {
      createdAt: serverTimestamp(),
      vaultInitialized: false,
      passwordCount: 0,
    });
  }
}

/**
 * Register a new user with email and password.
 * Sends a verification email after registration.
 */
export async function registerUser(
  email: string,
  password: string
): Promise<User> {
  const credential = await createUserWithEmailAndPassword(
    auth,
    email,
    password
  );
  // Initialize metadata for Spark plan users (since Cloud Functions are disabled)
  await initializeUserMetadata(credential.user.uid);
  // Send email verification
  await sendEmailVerification(credential.user);
  return credential.user;
}

/**
 * Sign in an existing user with email and password.
 */
export async function loginUser(
  email: string,
  password: string
): Promise<User> {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  return credential.user;
}

/**
 * Sign in with Google via popup.
 * Works on web; for native, a different flow would be needed.
 */
export async function loginWithGoogle(): Promise<User> {
  if (Platform.OS !== "web") {
    throw new Error("Google Sign-In is only supported on Web in this version. For Native support, use expo-auth-session.");
  }
  try {
    const credential = await signInWithPopup(auth, googleProvider);
    // Initialize metadata if it doesn't exist
    await initializeUserMetadata(credential.user.uid);
    return credential.user;
  } catch (error: any) {
    if (error.code === "auth/operation-not-allowed") {
      throw new Error("Google Sign-In is not enabled in the Firebase Console. Please enable it in Authentication > Sign-in method.");
    }
    if (error.code === "auth/unauthorized-domain") {
      throw new Error("Domain not authorized in Firebase Console. Add this domain to 'Authorized domains' in Firebase Authentication.");
    }
    throw error;
  }
}

/**
 * Resend the email verification link to the current user.
 */
export async function resendVerificationEmail(): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error("No authenticated user");
  await sendEmailVerification(user);
}

/**
 * Reload the current user to refresh emailVerified status.
 */
export async function reloadCurrentUser(): Promise<User | null> {
  const user = auth.currentUser;
  if (!user) return null;
  await user.reload();
  return auth.currentUser;
}

/**
 * Send a password reset email.
 */
export async function resetPassword(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email);
}

/**
 * Sign out the current user.
 */
export async function logoutUser(): Promise<void> {
  await signOut(auth);
}

/**
 * Subscribe to authentication state changes.
 * @returns Unsubscribe function
 */
export function onAuthChange(
  callback: (user: User | null) => void
): () => void {
  return onAuthStateChanged(auth, callback);
}

/**
 * Re-authenticate the current user before sensitive operations.
 */
export async function reauthenticateUser(password: string): Promise<void> {
  const user = auth.currentUser;
  if (!user || !user.email) throw new Error("No authenticated user");
  const credential = EmailAuthProvider.credential(user.email, password);
  await reauthenticateWithCredential(user, credential);
}

/**
 * Delete the current user's Firebase Auth account.
 */
export async function deleteUserAccount(): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error("No authenticated user");
  await deleteUser(user);
}

