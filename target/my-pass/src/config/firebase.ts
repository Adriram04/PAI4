import { initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectFirestoreEmulator, initializeFirestore } from "firebase/firestore";
import { connectStorageEmulator, getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyAVQR_Vb4sABEErUSYU5BqGFTP4AA7oRy4",
  authDomain: "my-pass-6551e.firebaseapp.com",
  projectId: "my-pass-6551e",
  storageBucket: "my-pass-6551e.firebasestorage.app",
  messagingSenderId: "504320723180",
  appId: "1:504320723180:web:87652fe69e4d101d6cbdc9",
  measurementId: "G-PKXV3QQFKS",
};

const app = initializeApp(firebaseConfig);
const useFirebaseEmulators = process.env.EXPO_PUBLIC_USE_FIREBASE_EMULATORS === "1";

function parseEmulatorHost(
  value: string | undefined,
  fallbackHost: string,
  fallbackPort: number
) {
  if (!value) {
    return { host: fallbackHost, port: fallbackPort };
  }

  const withoutProtocol = value.replace(/^https?:\/\//, "");
  const [host = fallbackHost, port = String(fallbackPort)] =
    withoutProtocol.split(":");

  return { host, port: Number(port) };
}

// ─── App Check ──────────────────────────────────────────────────────────────
// App Check requires a valid reCAPTCHA Enterprise site key registered in
// the Firebase Console.  Until that key is set, we skip initialisation
// so Firestore requests are not blocked with a 403.
//
// To enable App Check:
// 1. Create a reCAPTCHA Enterprise key at https://console.cloud.google.com/
// 2. Register it in Firebase Console → App Check
// 3. Replace the placeholder below and uncomment the block
//
// import {
//   initializeAppCheck,
//   ReCaptchaEnterpriseProvider,
// } from "firebase/app-check";
//
// if (typeof window !== "undefined" && __DEV__) {
//   (self as any).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
// }
//
// initializeAppCheck(app, {
//   provider: new ReCaptchaEnterpriseProvider("YOUR_REAL_SITE_KEY"),
//   isTokenAutoRefreshEnabled: true,
// });

export const auth = getAuth(app);
export const db = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true,
});
export const storage = getStorage(app);

if (useFirebaseEmulators) {
  const authEmulator = parseEmulatorHost(
    process.env.FIREBASE_AUTH_EMULATOR_HOST,
    "127.0.0.1",
    9099
  );
  const firestoreEmulator = parseEmulatorHost(
    process.env.FIRESTORE_EMULATOR_HOST,
    "127.0.0.1",
    8080
  );
  const storageEmulator = parseEmulatorHost(
    process.env.FIREBASE_STORAGE_EMULATOR_HOST,
    "127.0.0.1",
    9199
  );

  connectAuthEmulator(
    auth,
    `http://${authEmulator.host}:${authEmulator.port}`,
    { disableWarnings: true }
  );
  connectFirestoreEmulator(
    db,
    firestoreEmulator.host,
    firestoreEmulator.port
  );
  connectStorageEmulator(storage, storageEmulator.host, storageEmulator.port);
}
export default app;
