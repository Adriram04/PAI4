import { getAuditLog, logAuditEvent } from "../src/services/auditLogService";
import {
  addDoc,
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  Timestamp,
  where,
} from "firebase/firestore";

jest.mock("../src/config/firebase", () => ({
  db: { name: "mock-firestore" },
}));

jest.mock("firebase/firestore", () => ({
  collection: jest.fn((...segments: unknown[]) => ({
    type: "collection",
    path: segments.slice(1).join("/"),
  })),
  addDoc: jest.fn(),
  getDocs: jest.fn(),
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
  limit: jest.fn((count: number) => ({ type: "limit", count })),
  startAfter: jest.fn((doc: unknown) => ({ type: "startAfter", doc })),
  Timestamp: {
    now: jest.fn(() => ({ type: "timestamp", value: "now" })),
  },
}));

function auditDoc(id: string, data: Record<string, unknown>) {
  return {
    id,
    data: () => data,
  };
}

describe("AuditLogService", () => {
  const originalNavigator = global.navigator;

  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(global, "navigator", {
      configurable: true,
      value: { userAgent: "MockBrowser/1.0 ".repeat(20) },
    });
  });

  afterAll(() => {
    Object.defineProperty(global, "navigator", {
      configurable: true,
      value: originalNavigator,
    });
  });

  test("logAuditEvent stores action, timestamp, device info, and metadata", async () => {
    jest.mocked(addDoc).mockResolvedValueOnce({ id: "event-1" } as never);

    await logAuditEvent("user-1", "PASSWORD_CREATED", {
      passwordId: "password-1",
    });

    expect(collection).toHaveBeenCalledWith(
      expect.anything(),
      "users",
      "user-1",
      "auditLog"
    );
    expect(Timestamp.now).toHaveBeenCalled();
    expect(addDoc).toHaveBeenCalledWith(
      { type: "collection", path: "users/user-1/auditLog" },
      expect.objectContaining({
        action: "PASSWORD_CREATED",
        timestamp: { type: "timestamp", value: "now" },
        deviceInfo: expect.stringMatching(/^MockBrowser/),
        metadata: { passwordId: "password-1" },
      })
    );
    expect(
      (jest.mocked(addDoc).mock.calls[0][1] as { deviceInfo: string }).deviceInfo
        .length
    ).toBeLessThanOrEqual(200);
  });

  test("logAuditEvent omits metadata when none is provided", async () => {
    jest.mocked(addDoc).mockResolvedValueOnce({ id: "event-1" } as never);

    await logAuditEvent("user-1", "LOGOUT");

    expect(jest.mocked(addDoc).mock.calls[0][1]).not.toHaveProperty(
      "metadata"
    );
  });

  test("getAuditLog applies filters, pagination, and returns the last document", async () => {
    const last = auditDoc("event-2", { action: "LOGOUT" });
    const afterDoc = auditDoc("previous", {});
    jest.mocked(getDocs).mockResolvedValueOnce({
      docs: [auditDoc("event-1", { action: "LOGIN_SUCCESS" }), last],
    } as never);

    await expect(
      getAuditLog("user-1", {
        actionFilter: "LOGIN_SUCCESS",
        pageSize: 10,
        afterDoc: afterDoc as never,
      })
    ).resolves.toEqual({
      entries: [
        { id: "event-1", action: "LOGIN_SUCCESS" },
        { id: "event-2", action: "LOGOUT" },
      ],
      lastDoc: last,
    });

    expect(where).toHaveBeenCalledWith("action", "==", "LOGIN_SUCCESS");
    expect(orderBy).toHaveBeenCalledWith("timestamp", "desc");
    expect(limit).toHaveBeenCalledWith(10);
    expect(startAfter).toHaveBeenCalledWith(afterDoc);
    expect(query).toHaveBeenCalledWith(
      { type: "collection", path: "users/user-1/auditLog" },
      { type: "where", field: "action", op: "==", value: "LOGIN_SUCCESS" },
      { type: "orderBy", field: "timestamp", direction: "desc" },
      { type: "limit", count: 10 },
      { type: "startAfter", doc: afterDoc }
    );
  });

  test("getAuditLog returns null lastDoc for empty result sets", async () => {
    jest.mocked(getDocs).mockResolvedValueOnce({ docs: [] } as never);

    await expect(getAuditLog("user-1")).resolves.toEqual({
      entries: [],
      lastDoc: null,
    });

    expect(limit).toHaveBeenCalledWith(50);
  });
});
