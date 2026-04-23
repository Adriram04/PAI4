/**
 * Master Key Context
 *
 * Holds the user's imported master key material in memory for the session.
 *
 * SECURITY NOTES:
 * - The raw master password is NOT retained after unlock
 * - Only non-extractable PBKDF2 key material is stored in React state
 * - Nothing is written to localStorage, sessionStorage, or any persistent store
 * - It is cleared on page unload, logout, or explicit clear
 * - A new session requires re-entering the master password
 * - Session timeout automatically clears the key after inactivity
 */

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";

interface MasterKeyContextType {
  hasMasterKey: boolean;
  getMasterKey: () => CryptoKey | null;
  setMasterKey: (key: CryptoKey) => void;
  clearMasterKey: () => void;
  touchActivity: () => void;
  sessionTimeoutMinutes: number;
  setSessionTimeoutMinutes: (minutes: number) => void;
}

const MasterKeyContext = createContext<MasterKeyContextType | null>(null);

export function MasterKeyProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [masterKey, setMasterKeyState] = useState<CryptoKey | null>(null);
  const [sessionTimeoutMinutes, setSessionTimeoutMinutes] = useState(15);
  const lastActivityRef = useRef<number>(0);
  useEffect(() => {
    lastActivityRef.current = Date.now();
  }, []);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const getMasterKey = useCallback(() => {
    return masterKey;
  }, [masterKey]);

  const setMasterKey = useCallback((key: CryptoKey) => {
    setMasterKeyState(key);
    lastActivityRef.current = Date.now();
  }, []);

  const clearMasterKey = useCallback(() => {
    setMasterKeyState(null);
  }, []);

  const touchActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
  }, []);

  // Session timeout check
  useEffect(() => {
    if (!masterKey || sessionTimeoutMinutes <= 0) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - lastActivityRef.current;
      const timeoutMs = sessionTimeoutMinutes * 60 * 1000;
      if (elapsed >= timeoutMs) {
        setMasterKeyState(null);
      }
    }, 30_000); // check every 30 seconds

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [masterKey, sessionTimeoutMinutes]);

  return (
    <MasterKeyContext.Provider
      value={{
        hasMasterKey: masterKey !== null,
        getMasterKey,
        setMasterKey,
        clearMasterKey,
        touchActivity,
        sessionTimeoutMinutes,
        setSessionTimeoutMinutes,
      }}
    >
      {children}
    </MasterKeyContext.Provider>
  );
}

export function useMasterKey() {
  const context = useContext(MasterKeyContext);
  if (!context) {
    throw new Error("useMasterKey must be used within a MasterKeyProvider");
  }
  return context;
}
