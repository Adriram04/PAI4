import { initializeApp, deleteApp, FirebaseApp } from "firebase/app";
import {
  Auth,
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  deleteUser,
  getAuth,
  User,
} from "firebase/auth";
import {
  addDoc,
  collection,
  connectFirestoreEmulator,
  deleteDoc,
  doc,
  Firestore,
  getDoc,
  initializeFirestore,
  setDoc,
  terminate,
  Timestamp,
  updateDoc,
} from "firebase/firestore";
import {
  connectStorageEmulator,
  deleteObject,
  FirebaseStorage,
  getBytes,
  getStorage,
  ref,
  uploadBytes,
} from "firebase/storage";

const projectId = process.env.FIREBASE_TEST_PROJECT_ID ?? "demo-my-pass-test";
const storageBucket = `${projectId}.appspot.com`;
const password = "E2ePassword123!";
const runId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

function emulatorHubUrl() {
  let hubUrl = process.env.FIREBASE_EMULATOR_HUB ?? "127.0.0.1:4400";
  if (!hubUrl.startsWith("http://") && !hubUrl.startsWith("https://")) {
    hubUrl = `http://${hubUrl}`;
  }
  if (!hubUrl.endsWith("/emulators")) {
    hubUrl = `${hubUrl.replace(/\/$/, "")}/emulators`;
  }
  return hubUrl;
}

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

interface EmulatedClient {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
  storage: FirebaseStorage;
  user: User;
}

async function requireEmulators() {
  const response = await fetch(emulatorHubUrl());
  if (!response.ok) {
    throw new Error(`Firebase Emulator Hub is not responding at ${emulatorHubUrl()}`);
  }

  const emulators = await response.json();
  for (const name of ["auth", "firestore", "storage"]) {
    if (!emulators[name]) {
      throw new Error(`Firebase ${name} emulator is not running`);
    }
  }
}

async function createClient(label: string): Promise<EmulatedClient> {
  const app = initializeApp(
    {
      apiKey: "demo-api-key",
      authDomain: `${projectId}.firebaseapp.com`,
      projectId,
      storageBucket,
      appId: `e2e-${label}`,
    },
    `e2e-${label}-${runId}`
  );
  const auth = getAuth(app);
  const authEmulator = parseEmulatorHost(
    process.env.FIREBASE_AUTH_EMULATOR_HOST,
    "127.0.0.1",
    9099
  );
  connectAuthEmulator(auth, `http://${authEmulator.host}:${authEmulator.port}`, {
    disableWarnings: true,
  });

  const db = initializeFirestore(app, {
    experimentalAutoDetectLongPolling: true,
  });
  const firestoreEmulator = parseEmulatorHost(
    process.env.FIRESTORE_EMULATOR_HOST,
    "127.0.0.1",
    8080
  );
  connectFirestoreEmulator(
    db,
    firestoreEmulator.host,
    firestoreEmulator.port
  );

  const storage = getStorage(app);
  const storageEmulator = parseEmulatorHost(
    process.env.FIREBASE_STORAGE_EMULATOR_HOST,
    "127.0.0.1",
    9199
  );
  connectStorageEmulator(storage, storageEmulator.host, storageEmulator.port);

  const credential = await createUserWithEmailAndPassword(
    auth,
    `e2e-${label}-${runId}@example.com`,
    password
  );

  return { app, auth, db, storage, user: credential.user };
}

async function destroyClient(client: EmulatedClient) {
  await Promise.allSettled([
    client.auth.currentUser ? deleteUser(client.auth.currentUser) : undefined,
  ]);
  await Promise.allSettled([terminate(client.db), deleteApp(client.app)]);
}

describe("Firebase emulators e2e", () => {
  let owner: EmulatedClient;
  let outsider: EmulatedClient;
  let warnSpy: jest.SpyInstance;
  const originalWarn = console.warn.bind(console);

  beforeAll(async () => {
    warnSpy = jest.spyOn(console, "warn").mockImplementation((...args) => {
      const message = args.map(String).join(" ");
      if (message.includes("PERMISSION_DENIED")) return;
      originalWarn(...args);
    });

    await requireEmulators();
    owner = await createClient("owner");
    outsider = await createClient("outsider");
  });

  afterAll(async () => {
    await Promise.allSettled([destroyClient(owner), destroyClient(outsider)]);
    warnSpy.mockRestore();
  });

  test("creates authenticated users in the Auth emulator", () => {
    expect(owner.user.uid).toBeTruthy();
    expect(owner.user.email).toBe(`e2e-owner-${runId}@example.com`);
    expect(outsider.user.uid).toBeTruthy();
    expect(outsider.user.uid).not.toBe(owner.user.uid);
  });

  test("enforces Firestore owner-only password rules with the app password schema", async () => {
    const passwordRef = doc(
      owner.db,
      "users",
      owner.user.uid,
      "passwords",
      `password-${runId}`
    );

    await setDoc(passwordRef, {
      encryptedData: "ciphertext",
      iv: "iv",
      salt: "salt",
      serviceName: "GitHub",
      username: "octocat",
      url: "https://github.com",
      category: "development",
      attachmentRef: `users/${owner.user.uid}/attachments/file-${runId}`,
      expiresAt: Timestamp.fromDate(new Date("2030-01-01T00:00:00.000Z")),
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

    await expect(getDoc(passwordRef)).resolves.toMatchObject({
      exists: expect.any(Function),
    });

    const outsiderRead = getDoc(
      doc(outsider.db, "users", owner.user.uid, "passwords", `password-${runId}`)
    );
    await expect(outsiderRead).rejects.toMatchObject({
      code: "permission-denied",
    });

    const invalidRef = doc(
      owner.db,
      "users",
      owner.user.uid,
      "passwords",
      `invalid-${runId}`
    );
    await expect(
      setDoc(invalidRef, {
        encryptedData: "ciphertext",
        iv: "iv",
        salt: "salt",
        updatedAt: Timestamp.now(),
        plaintextPassword: "must-not-be-stored",
      })
    ).rejects.toMatchObject({ code: "permission-denied" });

    await deleteDoc(passwordRef);
  });

  test("allows the owner to create the vault verifier metadata document", async () => {
    const vaultMetaRef = doc(
      owner.db,
      "users",
      owner.user.uid,
      "passwords",
      "vault-meta"
    );

    await setDoc(vaultMetaRef, {
      verificationCiphertext: "verifier-ciphertext",
      verificationIv: "verifier-iv",
      verificationSalt: "verifier-salt",
      version: 1,
      serviceName: "__mypass_vault_meta__",
      username: "",
      url: "",
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

    await expect(getDoc(vaultMetaRef)).resolves.toMatchObject({
      exists: expect.any(Function),
    });

    await deleteDoc(vaultMetaRef);
  });

  test("allows the owner to read and update settings after vault creation", async () => {
    const settingsRef = doc(
      owner.db,
      "users",
      owner.user.uid,
      "settings",
      "preferences"
    );

    await setDoc(settingsRef, {
      language: "en",
      sessionTimeoutMinutes: 15,
      defaultCategory: "other",
      totpEnabled: false,
      totpSecret: null,
    });

    await expect(getDoc(settingsRef)).resolves.toMatchObject({
      exists: expect.any(Function),
    });

    await setDoc(
      settingsRef,
      {
        totpEnabled: true,
        totpSecret: {
          ciphertext: "cipher",
          iv: "iv",
          salt: "salt",
        },
      },
      { merge: true }
    );

    await expect(
      getDoc(doc(outsider.db, "users", owner.user.uid, "settings", "preferences"))
    ).rejects.toMatchObject({ code: "permission-denied" });

    await deleteDoc(settingsRef);
  });

  test("keeps audit logs append-only in Firestore", async () => {
    const auditRef = await addDoc(
      collection(owner.db, "users", owner.user.uid, "auditLog"),
      {
        action: "PASSWORD_CREATED",
        timestamp: Timestamp.now(),
        deviceInfo: "e2e",
      }
    );

    await expect(
      updateDoc(auditRef, { action: "PASSWORD_DELETED" })
    ).rejects.toMatchObject({ code: "permission-denied" });
  });

  test("enforces Storage attachment ownership rules", async () => {
    const storagePath = `users/${owner.user.uid}/attachments/file-${runId}`;
    const ownerRef = ref(owner.storage, storagePath);
    const outsiderRef = ref(outsider.storage, storagePath);

    await uploadBytes(ownerRef, new Uint8Array([1, 2, 3]), {
      contentType: "application/octet-stream",
    });

    const downloaded = new Uint8Array(await getBytes(ownerRef));
    expect(Array.from(downloaded)).toEqual([1, 2, 3]);
    await expect(getBytes(outsiderRef)).rejects.toMatchObject({
      code: "storage/unauthorized",
    });

    await deleteObject(ownerRef);
  });
});
