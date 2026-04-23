/**
 * Storage Service
 *
 * Handles uploading and downloading encrypted file attachments
 * to/from Firebase Storage under users/{uid}/attachments/{fileId}.
 */

import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import { storage } from "../config/firebase";

/**
 * Upload an encrypted file blob to Firebase Storage.
 *
 * @param userId - The authenticated user's UID
 * @param fileId - Unique identifier for this attachment (e.g., password doc ID)
 * @param encryptedBlob - The encrypted file data as a Uint8Array
 * @returns The storage path of the uploaded file
 */
export async function uploadEncryptedFile(
  userId: string,
  fileId: string,
  encryptedBlob: Uint8Array
): Promise<string> {
  const storagePath = `users/${userId}/attachments/${fileId}`;
  const fileRef = ref(storage, storagePath);
  await uploadBytes(fileRef, encryptedBlob, {
    contentType: "application/octet-stream",
  });
  return storagePath;
}

/**
 * Download an encrypted file from Firebase Storage.
 *
 * @param storagePath - The full storage path
 * @returns The encrypted file data as a Uint8Array
 */
export async function downloadEncryptedFile(
  storagePath: string
): Promise<Uint8Array> {
  const fileRef = ref(storage, storagePath);
  const url = await getDownloadURL(fileRef);
  const response = await fetch(url);
  const buffer = await response.arrayBuffer();
  return new Uint8Array(buffer);
}

/**
 * Delete an encrypted file from Firebase Storage.
 *
 * @param storagePath - The full storage path to delete
 */
export async function deleteEncryptedFile(
  storagePath: string
): Promise<void> {
  const fileRef = ref(storage, storagePath);
  await deleteObject(fileRef);
}
