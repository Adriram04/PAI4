import { getSettings, updateSettings } from "../src/services/settingsService";
import { DEFAULT_USER_SETTINGS } from "../src/types";
import { doc, getDoc, setDoc } from "firebase/firestore";

jest.mock("../src/config/firebase", () => ({
  db: { name: "mock-firestore" },
}));

jest.mock("firebase/firestore", () => ({
  doc: jest.fn((...segments: unknown[]) => ({
    type: "doc",
    path: segments.slice(1).join("/"),
  })),
  getDoc: jest.fn(),
  setDoc: jest.fn(),
}));

describe("SettingsService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("getSettings returns defaults when preferences do not exist", async () => {
    jest.mocked(getDoc).mockResolvedValueOnce({
      exists: () => false,
    } as never);

    await expect(getSettings("user-1")).resolves.toEqual(DEFAULT_USER_SETTINGS);
  });

  test("getSettings merges stored preferences over defaults", async () => {
    jest.mocked(getDoc).mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ language: "es", sessionTimeoutMinutes: 30 }),
    } as never);

    await expect(getSettings("user-1")).resolves.toEqual({
      ...DEFAULT_USER_SETTINGS,
      language: "es",
      sessionTimeoutMinutes: 30,
    });
  });

  test("updateSettings writes preferences with merge semantics", async () => {
    jest.mocked(setDoc).mockResolvedValueOnce(undefined as never);

    await updateSettings("user-1", { language: "es" });

    expect(doc).toHaveBeenCalledWith(
      expect.anything(),
      "users",
      "user-1",
      "settings",
      "preferences"
    );
    expect(setDoc).toHaveBeenCalledWith(
      { type: "doc", path: "users/user-1/settings/preferences" },
      { language: "es" },
      { merge: true }
    );
  });
});
