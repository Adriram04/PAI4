import {
  generateRecoveryCodes,
  getRecoveryCodes,
  hasRecoveryCodes,
  normalizeCode,
  validateRecoveryCode,
} from "../src/services/recoveryService";
import {
  addDoc,
  deleteDoc,
  getDocs,
  orderBy,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { decrypt, encrypt } from "../src/crypto/encryption";
import { importMasterPassword } from "../src/crypto/keyDerivation";

jest.mock("../src/config/firebase", () => ({
  db: { name: "mock-firestore" },
}));

jest.mock("../src/crypto/encryption", () => ({
  encrypt: jest.fn(),
  decrypt: jest.fn(),
}));

jest.mock("../src/crypto/keyDerivation", () => ({
  importMasterPassword: jest.fn(async (password: string) => ({
    type: "mock-key",
    password,
  })),
}));

jest.mock("firebase/firestore", () => ({
  collection: jest.fn((...segments: unknown[]) => ({
    type: "collection",
    path: segments.slice(1).join("/"),
  })),
  addDoc: jest.fn(),
  getDocs: jest.fn(),
  updateDoc: jest.fn(),
  deleteDoc: jest.fn(),
  doc: jest.fn((...segments: unknown[]) => ({
    type: "doc",
    path: segments.slice(1).join("/"),
  })),
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
  Timestamp: {
    now: jest.fn(() => ({ type: "timestamp", value: "now" })),
  },
}));

function recoveryDoc(id: string, data: Record<string, unknown>) {
  return {
    id,
    data: () => data,
  };
}

describe("RecoveryService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(encrypt).mockImplementation(async (plaintext: string) => ({
      ciphertext: `encrypted:${plaintext}`,
      iv: "iv",
      salt: "salt",
    }));
  });

  test("normalizeCode strips separators and uppercases input", () => {
    expect(normalizeCode(" abcd-2345 ef ")).toBe("ABCD2345EF");
  });

  test("generateRecoveryCodes replaces existing codes and stores eight encrypted codes", async () => {
    jest.mocked(getDocs).mockResolvedValueOnce({
      docs: [recoveryDoc("old-code", {})],
    } as never);
    jest.mocked(deleteDoc).mockResolvedValue(undefined as never);
    jest.mocked(addDoc).mockResolvedValue({ id: "new-code" } as never);

    const codes = await generateRecoveryCodes("user-1", "MasterPassword123!");

    expect(codes).toHaveLength(8);
    for (const code of codes) {
      expect(code).toMatch(/^[A-Z2-9]{8}$/);
    }
    expect(deleteDoc).toHaveBeenCalledWith({
      type: "doc",
      path: "users/user-1/recoveryCodes/old-code",
    });
    expect(importMasterPassword).toHaveBeenCalledTimes(8);
    expect(encrypt).toHaveBeenCalledTimes(8);
    expect(addDoc).toHaveBeenCalledTimes(8);
    expect(jest.mocked(addDoc).mock.calls[0][1]).toEqual(
      expect.objectContaining({
        encryptedPassword: "encrypted:MasterPassword123!",
        iv: "iv",
        salt: "salt",
        codeHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        used: false,
        createdAt: { type: "timestamp", value: "now" },
      })
    );
  });

  test("hasRecoveryCodes reports whether any code documents exist", async () => {
    jest.mocked(getDocs).mockResolvedValueOnce({
      docs: [recoveryDoc("code-1", {})],
    } as never);

    await expect(hasRecoveryCodes("user-1")).resolves.toBe(true);
  });

  test("getRecoveryCodes returns ordered recovery code documents", async () => {
    jest.mocked(getDocs).mockResolvedValueOnce({
      docs: [
        recoveryDoc("code-1", {
          encryptedPassword: "cipher",
          used: false,
        }),
      ],
    } as never);

    await expect(getRecoveryCodes("user-1")).resolves.toEqual([
      { id: "code-1", encryptedPassword: "cipher", used: false },
    ]);

    expect(query).toHaveBeenCalledWith(
      { type: "collection", path: "users/user-1/recoveryCodes" },
      { type: "orderBy", field: "createdAt", direction: "asc" }
    );
    expect(orderBy).toHaveBeenCalledWith("createdAt", "asc");
  });

  test("validateRecoveryCode returns null when the lookup finds no unused code", async () => {
    jest.mocked(getDocs).mockResolvedValueOnce({
      empty: true,
      docs: [],
    } as never);

    await expect(validateRecoveryCode("user-1", "abcd-2345")).resolves.toBeNull();

    expect(where).toHaveBeenCalledWith(
      "codeHash",
      "==",
      expect.stringMatching(/^[a-f0-9]{64}$/)
    );
    expect(where).toHaveBeenCalledWith("used", "==", false);
    expect(updateDoc).not.toHaveBeenCalled();
  });

  test("validateRecoveryCode decrypts the master password and marks the code used", async () => {
    jest.mocked(getDocs).mockResolvedValueOnce({
      empty: false,
      docs: [
        recoveryDoc("code-1", {
          encryptedPassword: "cipher",
          iv: "iv",
          salt: "salt",
        }),
      ],
    } as never);
    jest.mocked(decrypt).mockResolvedValueOnce("MasterPassword123!");

    await expect(
      validateRecoveryCode("user-1", "abcd-2345")
    ).resolves.toBe("MasterPassword123!");

    expect(decrypt).toHaveBeenCalledWith(
      { ciphertext: "cipher", iv: "iv", salt: "salt" },
      { type: "mock-key", password: "ABCD2345" }
    );
    expect(updateDoc).toHaveBeenCalledWith(
      { type: "doc", path: "users/user-1/recoveryCodes/code-1" },
      { used: true }
    );
  });

  test("validateRecoveryCode returns null when decryption fails", async () => {
    jest.mocked(getDocs).mockResolvedValueOnce({
      empty: false,
      docs: [
        recoveryDoc("code-1", {
          encryptedPassword: "cipher",
          iv: "iv",
          salt: "salt",
        }),
      ],
    } as never);
    jest.mocked(decrypt).mockRejectedValueOnce(new Error("bad code"));

    await expect(validateRecoveryCode("user-1", "abcd-2345")).resolves.toBeNull();
    expect(updateDoc).not.toHaveBeenCalled();
  });
});
