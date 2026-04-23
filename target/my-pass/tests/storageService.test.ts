import {
  deleteEncryptedFile,
  downloadEncryptedFile,
  uploadEncryptedFile,
} from "../src/services/storageService";
import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytes,
} from "firebase/storage";

jest.mock("../src/config/firebase", () => ({
  __esModule: true,
  storage: { type: "storage" },
}));

jest.mock("firebase/storage", () => ({
  ref: jest.fn((_storage: unknown, path: string) => ({ type: "ref", path })),
  uploadBytes: jest.fn(),
  getDownloadURL: jest.fn(),
  deleteObject: jest.fn(),
}));

describe("StorageService", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  test("uploadEncryptedFile uploads bytes and returns the storage path", async () => {
    const encryptedBlob = new Uint8Array([1, 2, 3]);
    jest.mocked(uploadBytes).mockResolvedValueOnce({} as never);

    await expect(
      uploadEncryptedFile("user-1", "file-1", encryptedBlob)
    ).resolves.toBe("users/user-1/attachments/file-1");

    expect(ref).toHaveBeenCalledWith(
      { type: "storage" },
      "users/user-1/attachments/file-1"
    );
    expect(uploadBytes).toHaveBeenCalledWith(
      { type: "ref", path: "users/user-1/attachments/file-1" },
      encryptedBlob,
      { contentType: "application/octet-stream" }
    );
  });

  test("downloadEncryptedFile resolves the download URL and returns bytes", async () => {
    jest.mocked(getDownloadURL).mockResolvedValueOnce(
      "https://storage.local/file-1" as never
    );
    global.fetch = jest.fn().mockResolvedValueOnce({
      arrayBuffer: jest
        .fn()
        .mockResolvedValueOnce(new Uint8Array([4, 5, 6]).buffer),
    }) as never;

    await expect(
      downloadEncryptedFile("users/user-1/attachments/file-1")
    ).resolves.toEqual(new Uint8Array([4, 5, 6]));

    expect(ref).toHaveBeenCalledWith(
      { type: "storage" },
      "users/user-1/attachments/file-1"
    );
    expect(getDownloadURL).toHaveBeenCalledWith({
      type: "ref",
      path: "users/user-1/attachments/file-1",
    });
    expect(global.fetch).toHaveBeenCalledWith("https://storage.local/file-1");
  });

  test("deleteEncryptedFile deletes the referenced object", async () => {
    jest.mocked(deleteObject).mockResolvedValueOnce(undefined as never);

    await deleteEncryptedFile("users/user-1/attachments/file-1");

    expect(deleteObject).toHaveBeenCalledWith({
      type: "ref",
      path: "users/user-1/attachments/file-1",
    });
  });
});
