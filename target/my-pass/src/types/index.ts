// TypeScript interfaces for the MyPass application

import { Timestamp } from "firebase/firestore";

/**
 * Predefined categories for organizing password entries.
 */
export type PasswordCategory =
  | "social"
  | "email"
  | "finance"
  | "work"
  | "entertainment"
  | "shopping"
  | "development"
  | "other";

export const PASSWORD_CATEGORIES: { key: PasswordCategory; labelKey: string }[] = [
  { key: "social", labelKey: "categories.social" },
  { key: "email", labelKey: "categories.email" },
  { key: "finance", labelKey: "categories.finance" },
  { key: "work", labelKey: "categories.work" },
  { key: "entertainment", labelKey: "categories.entertainment" },
  { key: "shopping", labelKey: "categories.shopping" },
  { key: "development", labelKey: "categories.development" },
  { key: "other", labelKey: "categories.other" },
];

/**
 * Represents a stored password entry as it exists in Firestore.
 * The actual password is encrypted — only ciphertext, IV, and salt are stored.
 */
export interface PasswordEntry {
  id?: string;
  encryptedData: string; // base64-encoded AES-256-GCM ciphertext
  iv: string; // base64-encoded initialization vector
  salt: string; // base64-encoded PBKDF2 salt
  serviceName: string; // e.g. "GitHub", "Gmail"
  username: string; // e.g. "user@example.com"
  url?: string; // optional service URL
  attachmentRef?: string; // optional Firebase Storage path for encrypted attachment
  category?: PasswordCategory; // organizational category
  expiresAt?: Timestamp; // optional password expiration date
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface VaultStatus {
  requiresSetup: boolean;
}

/**
 * Data required to create a new password entry (before encryption).
 */
export interface PasswordFormData {
  serviceName: string;
  username: string;
  password: string; // plaintext — never stored
  url?: string;
  category?: PasswordCategory;
  expiresAt?: string; // ISO date string
}

/**
 * The encrypted payload ready to be stored in Firestore.
 */
export interface EncryptedPayload {
  ciphertext: string; // base64
  iv: string; // base64
  salt: string; // base64
}

/**
 * Decrypted password entry for display in the UI.
 */
export interface DecryptedPasswordEntry {
  id: string;
  serviceName: string;
  username: string;
  url?: string;
  password: string; // decrypted plaintext
  category?: PasswordCategory;
  expiresAt?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * Auth form data for login/register.
 */
export interface AuthFormData {
  email: string;
  password: string;
}

/**
 * User context state.
 */
export interface AuthState {
  user: import("firebase/auth").User | null;
  loading: boolean;
}

/**
 * A historical version of a password entry, stored as a subcollection.
 */
export interface PasswordHistoryEntry {
  id?: string;
  encryptedData: string;
  iv: string;
  salt: string;
  changedAt: Timestamp;
  serviceName: string;
  username: string;
}

/**
 * Recovery code stored encrypted in Firestore.
 */
export interface RecoveryCode {
  id?: string;
  encryptedPassword: string; // AES-256-GCM encrypted Master Password
  iv: string;
  salt: string;
  codeHash: string; // SHA-256 fast lookup index
  used: boolean;
  createdAt: Timestamp;
}

/**
 * User settings stored in Firestore.
 */
export interface UserSettings {
  language: "en" | "es";
  sessionTimeoutMinutes: number;
  defaultCategory: PasswordCategory;
  totpEnabled?: boolean;
  totpSecret?: EncryptedPayload | null;
}

export const DEFAULT_USER_SETTINGS: UserSettings = {
  language: "en",
  sessionTimeoutMinutes: 15,
  defaultCategory: "other",
  totpEnabled: false,
  totpSecret: null,
};

/**
 * Security Audit Issues.
 */
export type AuditIssueType = "breached" | "weak" | "reused" | "old";

export interface AuditIssue {
  passwordId: string;
  type: AuditIssueType;
  serviceName: string;
  username: string;
  breachCount?: number; // For HIBP
  reusedWith?: string[]; // IDs of other passwords using the same plaintext
}

export interface VaultHealthReport {
  score: number; // 0-100
  totalPasswords: number;
  compromisedCount: number;
  weakCount: number;
  reusedCount: number;
  oldCount: number;
  issues: AuditIssue[];
  lastAuditAt: Timestamp;
}
