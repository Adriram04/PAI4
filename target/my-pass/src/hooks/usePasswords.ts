/**
 * usePasswords Hook
 *
 * Manages the password entries lifecycle: fetching, adding,
 * updating, deleting, and decrypting.
 */

import { useState, useCallback } from "react";
import { PasswordEntry, PasswordFormData, EncryptedPayload } from "../types";
import {
  getPasswords,
  addPassword,
  deletePassword,
  updatePassword,
  subscribeToPasswords as subscribeToPasswordsService,
} from "../services/passwordService";
import { encrypt, decrypt } from "../crypto/encryption";

interface UsePasswordsReturn {
  passwords: PasswordEntry[];
  loading: boolean;
  error: string | null;
  subscribeToPasswords: (userId: string) => () => void;
  fetchPasswords: (userId: string) => Promise<void>;
  addNewPassword: (
    userId: string,
    data: PasswordFormData,
    masterKey: CryptoKey
  ) => Promise<string | undefined>;
  removePassword: (userId: string, passwordId: string) => Promise<void>;
  editPassword: (
    userId: string,
    passwordId: string,
    data: PasswordFormData,
    masterKey: CryptoKey
  ) => Promise<void>;
  decryptPassword: (entry: PasswordEntry, masterKey: CryptoKey) => Promise<string>;
  clearPasswords: () => void;
  clearError: () => void;
}

export function usePasswords(): UsePasswordsReturn {
  const [passwords, setPasswords] = useState<PasswordEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);
  const clearPasswords = useCallback(() => setPasswords([]), []);

  const subscribeToPasswords = useCallback((userId: string) => {
    setLoading(true);
    setError(null);

    return subscribeToPasswordsService(
      userId,
      (entries) => {
        setPasswords(entries);
        setLoading(false);
      },
      (err) => {
        const message =
          err instanceof Error ? err.message : "Failed to subscribe to passwords";
        setError(message);
        setLoading(false);
      }
    );
  }, []);

  const fetchPasswords = useCallback(async (userId: string) => {
    setLoading(true);
    setError(null);
    try {
      const entries = await getPasswords(userId);
      setPasswords(entries);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to fetch passwords";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const addNewPassword = useCallback(
    async (
      userId: string,
      data: PasswordFormData,
      masterKey: CryptoKey
    ): Promise<string | undefined> => {
      setLoading(true);
      setError(null);
      try {
        const encrypted: EncryptedPayload = await encrypt(data.password, masterKey);
        const docId = await addPassword(
          userId,
          encrypted,
          data.serviceName,
          data.username,
          data.url,
          data.category,
          data.expiresAt
        );
        return docId;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to add password";
        setError(message);
        return undefined;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const removePassword = useCallback(
    async (userId: string, passwordId: string) => {
      setLoading(true);
      setError(null);
      try {
        await deletePassword(userId, passwordId);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to delete password";
        setError(message);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const editPassword = useCallback(
    async (
      userId: string,
      passwordId: string,
      data: PasswordFormData,
      masterKey: CryptoKey
    ) => {
      setLoading(true);
      setError(null);
      try {
        const encrypted = await encrypt(data.password, masterKey);
        await updatePassword(
          userId,
          passwordId,
          encrypted,
          data.serviceName,
          data.username,
          data.url,
          data.category,
          data.expiresAt
        );
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to update password";
        setError(message);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const decryptPassword = useCallback(
    async (entry: PasswordEntry, masterKey: CryptoKey): Promise<string> => {
      return decrypt(
        {
          ciphertext: entry.encryptedData,
          iv: entry.iv,
          salt: entry.salt,
        },
        masterKey
      );
    },
    []
  );

  return {
    passwords,
    loading,
    error,
    subscribeToPasswords,
    fetchPasswords,
    addNewPassword,
    removePassword,
    editPassword,
    decryptPassword,
    clearPasswords,
    clearError,
  };
}
