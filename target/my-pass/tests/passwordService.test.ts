import {
  addPassword,
  checkDuplicate,
  deletePassword,
  getExpiringPasswords,
  getPassword,
  getPasswordHistory,
  getPasswordSamples,
  getPasswords,
  subscribeToPasswords,
  updatePassword,
  VAULT_METADATA_DOC_ID,
} from "../src/services/passwordService";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";

jest.mock("../src/config/firebase", () => ({
  db: { name: "mock-firestore" },
}));

jest.mock("firebase/firestore", () => {
  const refPath = (segments: unknown[]) => segments.slice(1).join("/");

  return {
    collection: jest.fn((...segments: unknown[]) => ({
      type: "collection",
      path: refPath(segments),
    })),
    addDoc: jest.fn(),
    getDocs: jest.fn(),
    getDoc: jest.fn(),
    doc: jest.fn((...segments: unknown[]) => ({
      type: "doc",
      path: refPath(segments),
    })),
    deleteDoc: jest.fn(),
    updateDoc: jest.fn(),
    query: jest.fn((...args: unknown[]) => ({ type: "query", args })),
    orderBy: jest.fn((field: string, direction?: string) => ({
      type: "orderBy",
      field,
      direction,
    })),
    where: jest.fn((field: string, op: string, value: unknown) => ({
      type: "where",
      field,
      op,
      value,
    })),
    onSnapshot: jest.fn(),
    limit: jest.fn((count: number) => ({ type: "limit", count })),
    increment: jest.fn((value: number) => ({ type: "increment", value })),
    setDoc: jest.fn(),
    Timestamp: {
      now: jest.fn(() => ({ type: "timestamp", value: "now" })),
      fromDate: jest.fn((date: Date) => ({
        type: "timestamp",
        value: date.toISOString(),
      })),
    },
  };
});

const encrypted = {
  ciphertext: "ciphertext",
  iv: "iv",
  salt: "salt",
};

function snapshotDoc(id: string, data: Record<string, unknown>) {
  return {
    id,
    data: () => data,
  };
}

describe("PasswordService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("addPassword stores encrypted fields and increments metadata count", async () => {
    jest.mocked(addDoc).mockResolvedValueOnce({ id: "password-1" } as never);
    jest.mocked(setDoc).mockResolvedValueOnce(undefined as never);

    const id = await addPassword(
      "user-1",
      encrypted,
      "GitHub",
      "octocat",
      "https://github.com",
      "development",
      "2026-05-01",
      "users/user-1/files/attachment.enc"
    );

    expect(id).toBe("password-1");
    expect(collection).toHaveBeenCalledWith(
      expect.anything(),
      "users",
      "user-1",
      "passwords"
    );
    expect(addDoc).toHaveBeenCalledWith(
      { type: "collection", path: "users/user-1/passwords" },
      expect.objectContaining({
        encryptedData: "ciphertext",
        iv: "iv",
        salt: "salt",
        serviceName: "GitHub",
        username: "octocat",
        url: "https://github.com",
        category: "development",
        attachmentRef: "users/user-1/files/attachment.enc",
        createdAt: { type: "timestamp", value: "now" },
        updatedAt: { type: "timestamp", value: "now" },
      })
    );
    expect(setDoc).toHaveBeenCalledWith(
      { type: "doc", path: "users/user-1/metadata/profile" },
      { passwordCount: { type: "increment", value: 1 } },
      { merge: true }
    );
  });

  test("getPasswords returns entries ordered by creation date and hides the metadata document", async () => {
    jest.mocked(getDocs).mockResolvedValueOnce({
      docs: [
        snapshotDoc("password-1", { serviceName: "GitHub" }),
        snapshotDoc(VAULT_METADATA_DOC_ID, { serviceName: "Metadata" }),
      ],
    } as never);

    const result = await getPasswords("user-1");

    expect(query).toHaveBeenCalledWith(
      { type: "collection", path: "users/user-1/passwords" },
      expect.objectContaining({ field: "createdAt", direction: "desc" })
    );
    expect(result).toEqual([{ id: "password-1", serviceName: "GitHub" }]);
  });

  test("getPassword returns null when the document does not exist", async () => {
    jest.mocked(getDoc).mockResolvedValueOnce({
      exists: () => false,
    } as never);

    await expect(getPassword("user-1", "missing")).resolves.toBeNull();
  });

  test("getPassword returns the stored entry when the document exists", async () => {
    jest.mocked(getDoc).mockResolvedValueOnce({
      id: "password-1",
      exists: () => true,
      data: () => ({ serviceName: "GitHub", username: "octocat" }),
    } as never);

    await expect(getPassword("user-1", "password-1")).resolves.toEqual({
      id: "password-1",
      serviceName: "GitHub",
      username: "octocat",
    });
  });

  test("subscribeToPasswords forwards filtered snapshots and returns the unsubscribe function", () => {
    const unsubscribe = jest.fn();
    (onSnapshot as jest.Mock).mockImplementationOnce(
      (_q: unknown, onNext: unknown) => {
        const handleNext = onNext as (snapshot: {
          docs: ReturnType<typeof snapshotDoc>[];
        }) => void;
        handleNext({
          docs: [
            snapshotDoc("password-1", { serviceName: "GitHub" }),
            snapshotDoc(VAULT_METADATA_DOC_ID, { serviceName: "Metadata" }),
          ],
        });
        return unsubscribe;
      }
    );

    const onUpdate = jest.fn();
    const onError = jest.fn();
    const result = subscribeToPasswords("user-1", onUpdate, onError);

    expect(result).toBe(unsubscribe);
    expect(onUpdate).toHaveBeenCalledWith([
      { id: "password-1", serviceName: "GitHub" },
    ]);
    expect(onError).not.toHaveBeenCalled();
  });

  test("subscribeToPasswords forwards listener errors", () => {
    const unsubscribe = jest.fn();
    const error = new Error("listener failed");
    (onSnapshot as jest.Mock).mockImplementationOnce(
      (_q: unknown, _onNext: unknown, onError: unknown) => {
        const handleError = onError as (error: Error) => void;
        handleError(error);
        return unsubscribe;
      }
    );

    const onUpdate = jest.fn();
    const onError = jest.fn();
    subscribeToPasswords("user-1", onUpdate, onError);

    expect(onUpdate).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(error);
  });

  test("getPasswordSamples applies the requested limit and filters metadata", async () => {
    jest.mocked(getDocs).mockResolvedValueOnce({
      docs: [
        snapshotDoc(VAULT_METADATA_DOC_ID, {}),
        snapshotDoc("password-1", { serviceName: "One" }),
        snapshotDoc("password-2", { serviceName: "Two" }),
      ],
    } as never);

    await expect(getPasswordSamples("user-1", 1)).resolves.toEqual([
      { id: "password-1", serviceName: "One" },
    ]);

    expect(limit).toHaveBeenCalledWith(1);
  });

  test("updatePassword archives the previous version before updating the entry", async () => {
    jest.mocked(getDoc).mockResolvedValueOnce({
      id: "password-1",
      exists: () => true,
      data: () => ({
        encryptedData: "old-cipher",
        iv: "old-iv",
        salt: "old-salt",
        serviceName: "Old",
        username: "old@example.com",
      }),
    } as never);
    jest.mocked(addDoc).mockResolvedValueOnce({ id: "history-1" } as never);
    jest.mocked(updateDoc).mockResolvedValueOnce(undefined as never);

    await updatePassword(
      "user-1",
      "password-1",
      encrypted,
      "New",
      "new@example.com",
      "",
      undefined,
      "2026-05-01"
    );

    expect(addDoc).toHaveBeenCalledWith(
      { type: "collection", path: "users/user-1/passwords/password-1/history" },
      expect.objectContaining({
        encryptedData: "old-cipher",
        iv: "old-iv",
        salt: "old-salt",
        serviceName: "Old",
        username: "old@example.com",
        changedAt: { type: "timestamp", value: "now" },
      })
    );
    expect(updateDoc).toHaveBeenCalledWith(
      { type: "doc", path: "users/user-1/passwords/password-1" },
      expect.objectContaining({
        encryptedData: "ciphertext",
        iv: "iv",
        salt: "salt",
        serviceName: "New",
        username: "new@example.com",
        url: "",
        category: "other",
        updatedAt: { type: "timestamp", value: "now" },
        expiresAt: {
          type: "timestamp",
          value: "2026-05-01T00:00:00.000Z",
        },
      })
    );
  });

  test("updatePassword updates without history when the entry does not exist and stores attachments", async () => {
    jest.mocked(getDoc).mockResolvedValueOnce({
      exists: () => false,
    } as never);
    jest.mocked(updateDoc).mockResolvedValueOnce(undefined as never);

    await updatePassword(
      "user-1",
      "password-1",
      encrypted,
      "GitHub",
      "octocat",
      undefined,
      "development",
      undefined,
      "users/user-1/attachments/password-1"
    );

    expect(addDoc).not.toHaveBeenCalled();
    expect(updateDoc).toHaveBeenCalledWith(
      { type: "doc", path: "users/user-1/passwords/password-1" },
      expect.objectContaining({
        url: "",
        category: "development",
        attachmentRef: "users/user-1/attachments/password-1",
      })
    );
  });

  test("deletePassword removes the entry and decrements metadata count", async () => {
    jest.mocked(deleteDoc).mockResolvedValueOnce(undefined as never);
    jest.mocked(setDoc).mockResolvedValueOnce(undefined as never);

    await deletePassword("user-1", "password-1");

    expect(deleteDoc).toHaveBeenCalledWith({
      type: "doc",
      path: "users/user-1/passwords/password-1",
    });
    expect(increment).toHaveBeenCalledWith(-1);
    expect(setDoc).toHaveBeenCalledWith(
      { type: "doc", path: "users/user-1/metadata/profile" },
      { passwordCount: { type: "increment", value: -1 } },
      { merge: true }
    );
  });

  test("checkDuplicate ignores the vault metadata document and an excluded id", async () => {
    jest.mocked(getDocs).mockResolvedValueOnce({
      docs: [
        snapshotDoc(VAULT_METADATA_DOC_ID, {}),
        snapshotDoc("current-password", {}),
        snapshotDoc("other-password", {}),
      ],
    } as never);

    await expect(
      checkDuplicate("user-1", "GitHub", "octocat", "current-password")
    ).resolves.toBe(true);

    expect(where).toHaveBeenCalledWith("serviceName", "==", "GitHub");
    expect(where).toHaveBeenCalledWith("username", "==", "octocat");
  });

  test("getPasswordHistory returns entries ordered by change date", async () => {
    jest.mocked(getDocs).mockResolvedValueOnce({
      docs: [
        snapshotDoc("history-1", {
          encryptedData: "cipher",
          serviceName: "GitHub",
        }),
      ],
    } as never);

    await expect(
      getPasswordHistory("user-1", "password-1")
    ).resolves.toEqual([
      { id: "history-1", encryptedData: "cipher", serviceName: "GitHub" },
    ]);

    expect(query).toHaveBeenCalledWith(
      { type: "collection", path: "users/user-1/passwords/password-1/history" },
      expect.objectContaining({ field: "changedAt", direction: "desc" })
    );
  });

  test("getExpiringPasswords returns entries expiring within the requested window", async () => {
    const now = Date.now();
    const inThreeDays = new Date(now + 3 * 24 * 60 * 60 * 1000);
    const inTenDays = new Date(now + 10 * 24 * 60 * 60 * 1000);
    jest.mocked(getDocs).mockResolvedValueOnce({
      docs: [
        snapshotDoc("soon", {
          serviceName: "Soon",
          expiresAt: { toDate: () => inThreeDays },
        }),
        snapshotDoc("later", {
          serviceName: "Later",
          expiresAt: { toDate: () => inTenDays },
        }),
        snapshotDoc("never", { serviceName: "Never" }),
      ],
    } as never);

    await expect(getExpiringPasswords("user-1", 7)).resolves.toEqual([
      {
        id: "soon",
        serviceName: "Soon",
        expiresAt: { toDate: expect.any(Function) },
      },
    ]);
  });
});
