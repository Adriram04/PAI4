/**
 * Audit Log Service
 *
 * Logs security-relevant events to Firestore under users/{uid}/auditLog/{eventId}.
 * Supports querying with pagination, filtering by action type, and date ranges.
 */

import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  where,
  limit,
  startAfter,
  Timestamp,
  DocumentSnapshot,
} from "firebase/firestore";
import { db } from "../config/firebase";

export type AuditAction =
  | "UNAUTHORIZED_ACCESS"
  | "PASSWORD_CREATED"
  | "PASSWORD_UPDATED"
  | "PASSWORD_DELETED"
  | "PASSWORD_REVEALED"
  | "PASSWORD_COPIED"
  | "LOGIN_SUCCESS"
  | "LOGOUT"
  | "VAULT_UNLOCKED"
  | "EXPORT_BACKUP"
  | "MASTER_PASSWORD_CHANGED"
  | "RECOVERY_CODES_GENERATED"
  | "ACCOUNT_DELETED"
  | "BACKUP_RESTORED"
  | "SESSION_TIMEOUT"
  | "TOTP_ENABLED"
  | "TOTP_DISABLED";

export interface AuditLogEntry {
  id?: string;
  action: AuditAction;
  timestamp: Timestamp;
  metadata?: Record<string, string>;
}

function auditCollection(userId: string) {
  return collection(db, "users", userId, "auditLog");
}

/**
 * Write an audit log entry for the current user.
 */
export async function logAuditEvent(
  userId: string,
  action: AuditAction,
  metadata?: Record<string, string>
): Promise<void> {
  const deviceInfo =
    typeof navigator !== "undefined"
      ? navigator.userAgent.slice(0, 200)
      : "unknown";

  await addDoc(auditCollection(userId), {
    action,
    timestamp: Timestamp.now(),
    deviceInfo,
    ...(metadata ? { metadata } : {}),
  });
}

export interface AuditQueryOptions {
  actionFilter?: AuditAction;
  pageSize?: number;
  afterDoc?: DocumentSnapshot;
}

/**
 * Query audit log entries with optional filtering and pagination.
 */
export async function getAuditLog(
  userId: string,
  options: AuditQueryOptions = {}
): Promise<{ entries: AuditLogEntry[]; lastDoc: DocumentSnapshot | null }> {
  const { actionFilter, pageSize = 50, afterDoc } = options;

  const constraints: Parameters<typeof query>[1][] = [
    orderBy("timestamp", "desc"),
    limit(pageSize),
  ];

  if (actionFilter) {
    constraints.unshift(where("action", "==", actionFilter));
  }

  if (afterDoc) {
    constraints.push(startAfter(afterDoc));
  }

  const q = query(auditCollection(userId), ...constraints);
  const snapshot = await getDocs(q);

  const entries: AuditLogEntry[] = snapshot.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<AuditLogEntry, "id">),
  }));

  const lastDoc = snapshot.docs.length > 0
    ? snapshot.docs[snapshot.docs.length - 1]
    : null;

  return { entries, lastDoc };
}
