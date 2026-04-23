/**
 * Password Service
 *
 * Handles CRUD operations for encrypted password entries in Firestore.
 * Path: users/{userId}/passwords/{passwordId}
 */

import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  deleteDoc,
  updateDoc,
  query,
  orderBy,
  where,
  onSnapshot,
  Timestamp,
  limit,
  increment,
  setDoc,
} from "firebase/firestore";
import { db } from "../config/firebase";
import { PasswordEntry, EncryptedPayload, PasswordCategory, PasswordHistoryEntry } from "../types";

export const VAULT_METADATA_DOC_ID = "vault-meta";

/**
 * Get a reference to the passwords subcollection for a user.
 */
function passwordsCollection(userId: string) {
  return collection(db, "users", userId, "passwords");
}

/**
 * Get a reference to the password history subcollection.
 */
function historyCollection(userId: string, passwordId: string) {
  return collection(db, "users", userId, "passwords", passwordId, "history");
}

/**
 * Add a new encrypted password entry.
 */
export async function addPassword(
  userId: string,
  encrypted: EncryptedPayload,
  serviceName: string,
  username: string,
  url?: string,
  category?: PasswordCategory,
  expiresAt?: string,
  attachmentRef?: string
): Promise<string> {
  const now = Timestamp.now();
  const data: Record<string, unknown> = {
    encryptedData: encrypted.ciphertext,
    iv: encrypted.iv,
    salt: encrypted.salt,
    serviceName,
    username,
    url: url || "",
    category: category || "other",
    createdAt: now,
    updatedAt: now,
  };
  if (expiresAt) {
    data.expiresAt = Timestamp.fromDate(new Date(expiresAt));
  }
  if (attachmentRef) {
    data.attachmentRef = attachmentRef;
  }
  const docRef = await addDoc(passwordsCollection(userId), data);

  // Update password count in user metadata (Spark plan / Client-side)
  const metadataRef = doc(db, `users/${userId}/metadata/profile`);
  await setDoc(metadataRef, { passwordCount: increment(1) }, { merge: true });

  return docRef.id;
}

/**
 * Get all password entries for a user (metadata only — no decryption).
 */
export async function getPasswords(userId: string): Promise<PasswordEntry[]> {
  const q = query(passwordsCollection(userId), orderBy("createdAt", "desc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })).filter((entry) => entry.id !== VAULT_METADATA_DOC_ID) as PasswordEntry[];
}

export function subscribeToPasswords(
  userId: string,
  onUpdate: (entries: PasswordEntry[]) => void,
  onError: (error: Error) => void
): () => void {
  const q = query(passwordsCollection(userId), orderBy("createdAt", "desc"));

  return onSnapshot(
    q,
    (snapshot) => {
      const entries = snapshot.docs.map((document) => ({
        id: document.id,
        ...document.data(),
      })).filter((entry) => entry.id !== VAULT_METADATA_DOC_ID) as PasswordEntry[];
      onUpdate(entries);
    },
    (error) => onError(error)
  );
}

/**
 * Get a single password entry by ID.
 */
export async function getPassword(
  userId: string,
  passwordId: string
): Promise<PasswordEntry | null> {
  const docRef = doc(db, "users", userId, "passwords", passwordId);
  const snapshot = await getDoc(docRef);
  if (!snapshot.exists()) return null;
  return { id: snapshot.id, ...snapshot.data() } as PasswordEntry;
}

export async function getPasswordSamples(
  userId: string,
  sampleSize = 3
): Promise<PasswordEntry[]> {
  const q = query(
    passwordsCollection(userId),
    orderBy("createdAt", "desc"),
    limit(sampleSize)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((document) => ({
    id: document.id,
    ...document.data(),
  })).filter((entry) => entry.id !== VAULT_METADATA_DOC_ID).slice(0, sampleSize) as PasswordEntry[];
}

/**
 * Update an existing password entry with new encrypted data.
 * Also saves the previous version to the history subcollection.
 */
export async function updatePassword(
  userId: string,
  passwordId: string,
  encrypted: EncryptedPayload,
  serviceName: string,
  username: string,
  url?: string,
  category?: PasswordCategory,
  expiresAt?: string,
  attachmentRef?: string
): Promise<void> {
  // Save current version to history before overwriting
  const current = await getPassword(userId, passwordId);
  if (current) {
    await addDoc(historyCollection(userId, passwordId), {
      encryptedData: current.encryptedData,
      iv: current.iv,
      salt: current.salt,
      serviceName: current.serviceName,
      username: current.username,
      changedAt: Timestamp.now(),
    });
  }

  const docRef = doc(db, "users", userId, "passwords", passwordId);
  const updateData: Record<string, unknown> = {
    encryptedData: encrypted.ciphertext,
    iv: encrypted.iv,
    salt: encrypted.salt,
    serviceName,
    username,
    url: url || "",
    category: category || "other",
    updatedAt: Timestamp.now(),
  };
  if (expiresAt) {
    updateData.expiresAt = Timestamp.fromDate(new Date(expiresAt));
  }
  if (attachmentRef) {
    updateData.attachmentRef = attachmentRef;
  }
  await updateDoc(docRef, updateData);
}

/**
 * Delete a password entry.
 */
export async function deletePassword(
  userId: string,
  passwordId: string
): Promise<void> {
  const docRef = doc(db, "users", userId, "passwords", passwordId);
  await deleteDoc(docRef);

  // Update password count in user metadata (Spark plan / Client-side)
  const metadataRef = doc(db, `users/${userId}/metadata/profile`);
  await setDoc(metadataRef, { passwordCount: increment(-1) }, { merge: true });
}

/**
 * Get the password history for a specific entry.
 */
export async function getPasswordHistory(
  userId: string,
  passwordId: string
): Promise<PasswordHistoryEntry[]> {
  const q = query(historyCollection(userId, passwordId), orderBy("changedAt", "desc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  })) as PasswordHistoryEntry[];
}

/**
 * Check if a password entry already exists for the same service + username.
 */
export async function checkDuplicate(
  userId: string,
  serviceName: string,
  username: string,
  excludeId?: string
): Promise<boolean> {
  const q = query(
    passwordsCollection(userId),
    where("serviceName", "==", serviceName),
    where("username", "==", username)
  );
  const snapshot = await getDocs(q);
  const docs = snapshot.docs.filter(
    (d) => d.id !== VAULT_METADATA_DOC_ID && d.id !== excludeId
  );
  return docs.length > 0;
}

/**
 * Get passwords that expire within N days from now.
 */
export async function getExpiringPasswords(
  userId: string,
  daysAhead: number = 7
): Promise<PasswordEntry[]> {
  const allPasswords = await getPasswords(userId);
  const now = new Date();
  const futureDate = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

  return allPasswords.filter((p) => {
    if (!p.expiresAt) return false;
    const expiryDate = p.expiresAt.toDate();
    return expiryDate <= futureDate;
  });
}
