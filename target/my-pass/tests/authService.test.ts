import {
  deleteUserAccount,
  loginWithGoogle,
  loginUser,
  logoutUser,
  onAuthChange,
  reloadCurrentUser,
  resendVerificationEmail,
  reauthenticateUser,
  registerUser,
  resetPassword,
} from "../src/services/authService";
import { auth } from "../src/config/firebase";
import {
  createUserWithEmailAndPassword,
  deleteUser,
  EmailAuthProvider,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  User,
  onAuthStateChanged,
  reauthenticateWithCredential,
} from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { Platform } from "react-native";

jest.mock("react-native", () => ({
  Platform: { OS: "web" },
}));

jest.mock("../src/config/firebase", () => ({
  auth: { currentUser: null },
  db: { name: "mock-firestore" },
}));

jest.mock("firebase/auth", () => ({
  createUserWithEmailAndPassword: jest.fn(),
  signInWithEmailAndPassword: jest.fn(),
  signOut: jest.fn(),
  onAuthStateChanged: jest.fn(),
  GoogleAuthProvider: jest.fn().mockImplementation(() => ({
    setCustomParameters: jest.fn(),
  })),
  signInWithPopup: jest.fn(),
  sendEmailVerification: jest.fn(),
  sendPasswordResetEmail: jest.fn(),
  deleteUser: jest.fn(),
  EmailAuthProvider: {
    credential: jest.fn((email: string, password: string) => ({
      email,
      password,
    })),
  },
  reauthenticateWithCredential: jest.fn(),
}));

jest.mock("firebase/firestore", () => ({
  doc: jest.fn((...segments: unknown[]) => ({
    type: "doc",
    path: segments.slice(1).join("/"),
  })),
  setDoc: jest.fn(),
  getDoc: jest.fn(),
  serverTimestamp: jest.fn(() => ({ type: "serverTimestamp" })),
}));

function user(overrides: Partial<User> = {}): User {
  return {
    uid: "user-1",
    email: "test@example.com",
    ...overrides,
  } as User;
}

describe("AuthService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (auth as { currentUser: User | null }).currentUser = null;
  });

  test("registerUser creates the Firebase user, initializes metadata, and sends verification email", async () => {
    const createdUser = user();
    jest.mocked(createUserWithEmailAndPassword).mockResolvedValueOnce({
      user: createdUser,
    } as never);
    jest.mocked(getDoc).mockResolvedValueOnce({
      exists: () => false,
    } as never);
    jest.mocked(setDoc).mockResolvedValueOnce(undefined as never);
    jest.mocked(sendEmailVerification).mockResolvedValueOnce(undefined as never);

    await expect(
      registerUser("test@example.com", "SecureP@ss123")
    ).resolves.toBe(createdUser);

    expect(createUserWithEmailAndPassword).toHaveBeenCalledWith(
      auth,
      "test@example.com",
      "SecureP@ss123"
    );
    expect(doc).toHaveBeenCalledWith(
      expect.anything(),
      "users/user-1/metadata/profile"
    );
    expect(serverTimestamp).toHaveBeenCalled();
    expect(setDoc).toHaveBeenCalledWith(
      { type: "doc", path: "users/user-1/metadata/profile" },
      {
        createdAt: { type: "serverTimestamp" },
        vaultInitialized: false,
        passwordCount: 0,
      }
    );
    expect(sendEmailVerification).toHaveBeenCalledWith(createdUser);
  });

  test("registerUser does not overwrite existing metadata", async () => {
    const createdUser = user();
    jest.mocked(createUserWithEmailAndPassword).mockResolvedValueOnce({
      user: createdUser,
    } as never);
    jest.mocked(getDoc).mockResolvedValueOnce({
      exists: () => true,
    } as never);
    jest.mocked(sendEmailVerification).mockResolvedValueOnce(undefined as never);

    await registerUser("test@example.com", "SecureP@ss123");

    expect(setDoc).not.toHaveBeenCalled();
    expect(sendEmailVerification).toHaveBeenCalledWith(createdUser);
  });

  test("loginUser returns the authenticated user", async () => {
    const existingUser = user();
    jest.mocked(signInWithEmailAndPassword).mockResolvedValueOnce({
      user: existingUser,
    } as never);

    await expect(
      loginUser("test@example.com", "SecureP@ss123")
    ).resolves.toBe(existingUser);

    expect(signInWithEmailAndPassword).toHaveBeenCalledWith(
      auth,
      "test@example.com",
      "SecureP@ss123"
    );
  });

  test("loginWithGoogle initializes metadata and returns the authenticated user on web", async () => {
    (Platform as { OS: string }).OS = "web";
    const googleUser = user({ uid: "google-user" });
    jest.mocked(signInWithPopup).mockResolvedValueOnce({
      user: googleUser,
    } as never);
    jest.mocked(getDoc).mockResolvedValueOnce({
      exists: () => false,
    } as never);
    jest.mocked(setDoc).mockResolvedValueOnce(undefined as never);

    await expect(loginWithGoogle()).resolves.toBe(googleUser);

    expect(signInWithPopup).toHaveBeenCalledWith(auth, expect.any(Object));
    expect(setDoc).toHaveBeenCalledWith(
      { type: "doc", path: "users/google-user/metadata/profile" },
      {
        createdAt: { type: "serverTimestamp" },
        vaultInitialized: false,
        passwordCount: 0,
      }
    );
  });

  test("loginWithGoogle rejects on non-web platforms", async () => {
    (Platform as { OS: string }).OS = "ios";

    await expect(loginWithGoogle()).rejects.toThrow(
      "Google Sign-In is only supported on Web"
    );

    expect(signInWithPopup).not.toHaveBeenCalled();
  });

  test("loginWithGoogle maps Firebase configuration errors to user-facing messages", async () => {
    (Platform as { OS: string }).OS = "web";
    jest.mocked(signInWithPopup).mockRejectedValueOnce({
      code: "auth/operation-not-allowed",
    });

    await expect(loginWithGoogle()).rejects.toThrow(
      "Google Sign-In is not enabled"
    );

    jest.mocked(signInWithPopup).mockRejectedValueOnce({
      code: "auth/unauthorized-domain",
    });

    await expect(loginWithGoogle()).rejects.toThrow("Domain not authorized");
  });

  test("logoutUser delegates to Firebase signOut", async () => {
    jest.mocked(signOut).mockResolvedValueOnce(undefined as never);

    await logoutUser();

    expect(signOut).toHaveBeenCalledWith(auth);
  });

  test("resetPassword sends the reset email through Firebase Auth", async () => {
    jest.mocked(sendPasswordResetEmail).mockResolvedValueOnce(undefined as never);

    await resetPassword("test@example.com");

    expect(sendPasswordResetEmail).toHaveBeenCalledWith(
      auth,
      "test@example.com"
    );
  });

  test("resendVerificationEmail requires an authenticated user", async () => {
    await expect(resendVerificationEmail()).rejects.toThrow(
      "No authenticated user"
    );
    expect(sendEmailVerification).not.toHaveBeenCalled();
  });

  test("resendVerificationEmail sends to the current user", async () => {
    const currentUser = user();
    (auth as { currentUser: User | null }).currentUser = currentUser;
    jest.mocked(sendEmailVerification).mockResolvedValueOnce(undefined as never);

    await resendVerificationEmail();

    expect(sendEmailVerification).toHaveBeenCalledWith(currentUser);
  });

  test("reloadCurrentUser returns null when there is no current user", async () => {
    await expect(reloadCurrentUser()).resolves.toBeNull();
  });

  test("reloadCurrentUser reloads and returns the current Firebase user", async () => {
    const reload = jest.fn().mockResolvedValue(undefined);
    const currentUser = user({ reload } as Partial<User>);
    (auth as { currentUser: User | null }).currentUser = currentUser;

    await expect(reloadCurrentUser()).resolves.toBe(currentUser);

    expect(reload).toHaveBeenCalled();
  });

  test("onAuthChange delegates to Firebase Auth state listener", () => {
    const unsubscribe = jest.fn();
    const callback = jest.fn();
    jest.mocked(onAuthStateChanged).mockReturnValueOnce(unsubscribe as never);

    expect(onAuthChange(callback)).toBe(unsubscribe);
    expect(onAuthStateChanged).toHaveBeenCalledWith(auth, callback);
  });

  test("reauthenticateUser builds an email credential for the current user", async () => {
    const currentUser = user();
    (auth as { currentUser: User | null }).currentUser = currentUser;
    jest
      .mocked(reauthenticateWithCredential)
      .mockResolvedValueOnce(undefined as never);

    await reauthenticateUser("SecureP@ss123");

    expect(EmailAuthProvider.credential).toHaveBeenCalledWith(
      "test@example.com",
      "SecureP@ss123"
    );
    expect(reauthenticateWithCredential).toHaveBeenCalledWith(currentUser, {
      email: "test@example.com",
      password: "SecureP@ss123",
    });
  });

  test("reauthenticateUser rejects without an authenticated email user", async () => {
    (auth as { currentUser: User | null }).currentUser = user({ email: null });

    await expect(reauthenticateUser("SecureP@ss123")).rejects.toThrow(
      "No authenticated user"
    );
    expect(reauthenticateWithCredential).not.toHaveBeenCalled();
  });

  test("deleteUserAccount rejects when no user is authenticated", async () => {
    await expect(deleteUserAccount()).rejects.toThrow("No authenticated user");
    expect(deleteUser).not.toHaveBeenCalled();
  });

  test("deleteUserAccount deletes the current Firebase user", async () => {
    const currentUser = user();
    (auth as { currentUser: User | null }).currentUser = currentUser;
    jest.mocked(deleteUser).mockResolvedValueOnce(undefined as never);

    await deleteUserAccount();

    expect(deleteUser).toHaveBeenCalledWith(currentUser);
  });
});
