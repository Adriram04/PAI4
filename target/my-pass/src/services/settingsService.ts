/**
 * Settings Service
 *
 * CRUD for user settings stored at users/{uid}/settings/preferences.
 */

import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../config/firebase";
import { UserSettings, DEFAULT_USER_SETTINGS } from "../types";

function settingsDoc(userId: string) {
  return doc(db, "users", userId, "settings", "preferences");
}

/**
 * Get user settings, returning defaults if none exist.
 */
export async function getSettings(userId: string): Promise<UserSettings> {
  const snapshot = await getDoc(settingsDoc(userId));
  if (!snapshot.exists()) {
    return { ...DEFAULT_USER_SETTINGS };
  }
  return { ...DEFAULT_USER_SETTINGS, ...snapshot.data() } as UserSettings;
}

/**
 * Update user settings (merge).
 */
export async function updateSettings(
  userId: string,
  settings: Partial<UserSettings>
): Promise<void> {
  await setDoc(settingsDoc(userId), settings, { merge: true });
}
