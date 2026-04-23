import { checkBreached, generateHealthReport } from "../src/services/auditService";
import { decrypt } from "../src/crypto/encryption";
import { estimateStrength } from "../src/utils/passwordGenerator";

jest.mock("../src/crypto/encryption", () => ({
  decrypt: jest.fn(),
}));

jest.mock("../src/utils/passwordGenerator", () => ({
  estimateStrength: jest.fn(),
}));

jest.mock("firebase/firestore", () => ({
  Timestamp: {
    now: jest.fn(() => ({ type: "timestamp", value: "now" })),
  },
}));

function entry(
  id: string,
  serviceName: string,
  updatedAt: Date = new Date()
) {
  return {
    id,
    encryptedData: `cipher-${id}`,
    iv: `iv-${id}`,
    salt: `salt-${id}`,
    serviceName,
    username: `${serviceName.toLowerCase()}@example.com`,
    createdAt: { toDate: () => updatedAt },
    updatedAt: { toDate: () => updatedAt },
  };
}

describe("AuditService", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      text: jest.fn(),
    }) as never;
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  test("checkBreached returns the breach count when HIBP returns the matching SHA-1 suffix", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      text: jest
        .fn()
        .mockResolvedValueOnce("1E4C9B93F3F0682250B6CF8331B7EE68FD8:3303003\r\nABC:1"),
    }) as never;

    await expect(checkBreached("password")).resolves.toBe(3303003);
    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.pwnedpasswords.com/range/5BAA6"
    );
  });

  test("checkBreached returns zero on failed responses and fetch errors", async () => {
    await expect(checkBreached("not-found")).resolves.toBe(0);

    const consoleSpy = jest.spyOn(console, "error").mockImplementation();
    global.fetch = jest.fn().mockRejectedValueOnce(new Error("network")) as never;

    await expect(checkBreached("network-error")).resolves.toBe(0);
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  test("generateHealthReport reports weak, reused, and old passwords", async () => {
    const oldDate = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000);
    jest.mocked(decrypt).mockResolvedValue("weak-shared");
    jest.mocked(estimateStrength).mockReturnValue({ score: 1 } as never);
    const onProgress = jest.fn();

    const report = await generateHealthReport(
      [
        entry("password-1", "GitHub", oldDate),
        entry("password-2", "GitLab", oldDate),
      ] as never,
      { id: "master-key" } as unknown as CryptoKey,
      onProgress
    );

    expect(report).toEqual(
      expect.objectContaining({
        score: 30,
        totalPasswords: 2,
        compromisedCount: 0,
        weakCount: 2,
        reusedCount: 2,
        oldCount: 2,
        lastAuditAt: { type: "timestamp", value: "now" },
      })
    );
    expect(report.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ passwordId: "password-1", type: "weak" }),
        expect.objectContaining({ passwordId: "password-1", type: "old" }),
        expect.objectContaining({
          passwordId: "password-1",
          type: "reused",
          reusedWith: ["password-2"],
        }),
      ])
    );
    expect(onProgress).toHaveBeenCalledWith(1, 2);
    expect(onProgress).toHaveBeenCalledWith(2, 2);
  });

  test("generateHealthReport records breached passwords", async () => {
    jest.mocked(decrypt).mockResolvedValue("password");
    jest.mocked(estimateStrength).mockReturnValue({ score: 4 } as never);
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      text: jest
        .fn()
        .mockResolvedValueOnce("1E4C9B93F3F0682250B6CF8331B7EE68FD8:99"),
    }) as never;

    const report = await generateHealthReport(
      [entry("password-1", "GitHub") as never],
      { id: "master-key" } as unknown as CryptoKey
    );

    expect(report.compromisedCount).toBe(1);
    expect(report.score).toBe(50);
    expect(report.issues).toContainEqual(
      expect.objectContaining({
        passwordId: "password-1",
        type: "breached",
        breachCount: 99,
      })
    );
  });

  test("generateHealthReport continues when an entry cannot be decrypted", async () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation();
    jest.mocked(decrypt).mockRejectedValueOnce(new Error("bad key"));

    await expect(
      generateHealthReport(
        [entry("password-1", "GitHub") as never],
        { id: "master-key" } as unknown as CryptoKey
      )
    ).resolves.toEqual(
      expect.objectContaining({
        score: 100,
        totalPasswords: 1,
        issues: [],
      })
    );
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });
});
