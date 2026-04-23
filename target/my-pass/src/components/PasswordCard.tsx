/**
 * PasswordCard Component
 *
 * Displays a password entry with service name, username,
 * category badge, expiry, and actions (show/copy/edit/delete).
 */

import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ActivityIndicator,
} from "react-native";
import { theme } from "../utils/theme";
import { PasswordEntry } from "../types";
import { logAuditEvent } from "../services/auditLogService";
import { downloadEncryptedFile } from "../services/storageService";
import { decryptFile } from "../crypto/encryption";
import { useI18n } from "../i18n";
import { Feather } from "@expo/vector-icons";

interface Props {
  entry: PasswordEntry;
  userId: string;
  masterKey: CryptoKey | null;
  onDecrypt: () => Promise<string>;
  onDelete: () => void;
  onEdit: () => void;
}

type CopyStatus = "idle" | "success" | "error";

const CATEGORY_ICONS: Record<string, keyof typeof Feather.glyphMap> = {
  social: "message-circle",
  email: "mail",
  finance: "dollar-sign",
  work: "briefcase",
  entertainment: "tv",
  shopping: "shopping-bag",
  development: "code",
  other: "folder",
};

function getServiceInitials(serviceName: string): string {
  const name = serviceName.toLowerCase();
  if (name.includes("google") || name.includes("gmail")) return "G";
  if (name.includes("github")) return "GH";
  if (name.includes("twitter") || name.includes("x.com")) return "X";
  if (name.includes("facebook") || name.includes("meta")) return "FB";
  if (name.includes("amazon") || name.includes("aws")) return "AZ";
  if (name.includes("apple") || name.includes("icloud")) return "AP";
  if (name.includes("microsoft") || name.includes("outlook")) return "MS";
  if (name.includes("netflix")) return "NF";
  if (name.includes("spotify")) return "SP";
  if (name.includes("discord")) return "DC";
  if (name.includes("slack")) return "SL";
  if (name.includes("linkedin")) return "LI";
  if (name.includes("instagram")) return "IG";
  if (name.includes("bank") || name.includes("paypal")) return "$$";
  return serviceName.substring(0, 2).toUpperCase();
}

function getServiceAccent(serviceName: string): string {
  const name = serviceName.toLowerCase();
  if (name.includes("google") || name.includes("gmail")) return "#ea4335";
  if (name.includes("github")) return "#a78bfa";
  if (name.includes("twitter") || name.includes("x.com")) return "#60a5fa";
  if (name.includes("facebook") || name.includes("meta")) return "#60a5fa";
  if (name.includes("netflix")) return "#ef4444";
  if (name.includes("spotify")) return "#34d399";
  return theme.colors.primary;
}

function fallbackCopyTextToClipboard(text: string): boolean {
  if (typeof document === "undefined" || !document.body) return false;

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.top = "0";
  textarea.style.left = "0";
  textarea.style.opacity = "0";

  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();

  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    document.body.removeChild(textarea);
  }
}

async function writeTextToClipboard(text: string): Promise<boolean> {
  if (Platform.OS !== "web") return false;

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Some browsers reject async clipboard writes after decrypting.
  }

  return fallbackCopyTextToClipboard(text);
}

async function writePendingTextToClipboard(textPromise: Promise<string>): Promise<boolean> {
  if (Platform.OS !== "web") {
    await textPromise.catch(() => {});
    return false;
  }

  try {
    if (navigator.clipboard?.write && typeof ClipboardItem !== "undefined") {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/plain": textPromise.then(
            (text) => new Blob([text], { type: "text/plain" })
          ),
        }),
      ]);
      return true;
    }
  } catch {
    // Fall through to the broader clipboard helper below.
  }

  const text = await textPromise;
  return writeTextToClipboard(text);
}

export function PasswordCard({ entry, userId, masterKey, onDecrypt, onDelete, onEdit }: Props) {
  const { t } = useI18n();
  const [revealed, setRevealed] = useState(false);
  const [decryptedPassword, setDecryptedPassword] = useState("");
  const [decrypting, setDecrypting] = useState(false);
  const [copyStatus, setCopyStatus] = useState<CopyStatus>("idle");
  const [downloading, setDownloading] = useState(false);

  const isExpired = entry.expiresAt && entry.expiresAt.toDate() < new Date();
  const isExpiringSoon =
    entry.expiresAt &&
    !isExpired &&
    entry.expiresAt.toDate() < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const initials = getServiceInitials(entry.serviceName);
  const accent = getServiceAccent(entry.serviceName);
  const categoryKey = entry.category || "other";
  const categoryColor = theme.categoryColors[categoryKey] || theme.categoryColors.other;
  const categoryIcon = CATEGORY_ICONS[categoryKey] || "folder";

  const handleReveal = async () => {
    if (revealed) {
      setRevealed(false);
      setDecryptedPassword("");
      return;
    }
    setDecrypting(true);
    try {
      const password = await onDecrypt();
      setDecryptedPassword(password);
      setRevealed(true);
      logAuditEvent(userId, "PASSWORD_REVEALED", { serviceName: entry.serviceName }).catch(() => {});
      setTimeout(() => {
        setRevealed(false);
        setDecryptedPassword("");
      }, 30_000);
    } catch {
      setDecryptedPassword(t("card.decryptionFailed"));
      setRevealed(true);
    } finally {
      setDecrypting(false);
    }
  };

  const handleCopy = async () => {
    try {
      const passwordPromise = (revealed ? Promise.resolve(decryptedPassword) : onDecrypt()).then(
        (password) => {
          if (!password || password === t("card.decryptionFailed")) {
            throw new Error("Password is not available to copy.");
          }
          return password;
        }
      );

      const didCopy = await writePendingTextToClipboard(passwordPromise);
      if (!didCopy) {
        setCopyStatus("error");
        setTimeout(() => setCopyStatus("idle"), 2000);
        return;
      }

      setCopyStatus("success");
      logAuditEvent(userId, "PASSWORD_COPIED", { serviceName: entry.serviceName }).catch(() => {});
      setTimeout(() => setCopyStatus("idle"), 2000);
      setTimeout(() => writeTextToClipboard("").catch(() => {}), 30_000);
    } catch {
      setCopyStatus("error");
      setTimeout(() => setCopyStatus("idle"), 2000);
    }
  };

  const handleDownloadAttachment = async () => {
    if (!entry.attachmentRef || !masterKey) return;
    setDownloading(true);
    try {
      const encryptedData = await downloadEncryptedFile(entry.attachmentRef);
      const decryptedData = await decryptFile(encryptedData, masterKey);
      if (Platform.OS === "web") {
        const blob = new Blob([decryptedData]);
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${entry.serviceName}-attachment`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch {
      // silently fail
    } finally {
      setDownloading(false);
    }
  };

  return (
    <View style={styles.card}>
      {/* ── Top row ──────────────────────────────────────────────────────── */}
      <View style={styles.topRow}>
        {/* Avatar */}
        <View style={[styles.avatar, { backgroundColor: accent + "1a", borderColor: accent + "33" }]}>
          <Text style={[styles.avatarText, { color: accent }]}>{initials}</Text>
        </View>

        {/* Name + username */}
        <View style={styles.nameBlock}>
          <Text style={styles.serviceName} numberOfLines={1}>{entry.serviceName}</Text>
          <Text style={styles.username} numberOfLines={1}>{entry.username}</Text>
        </View>

        {/* Badges */}
        <View style={styles.badges}>
          {entry.category && entry.category !== "other" && (
            <View style={[styles.badge, { backgroundColor: categoryColor.bg }]}>
              <Feather name={categoryIcon} size={10} color={categoryColor.text} />
              <Text style={[styles.badgeText, { color: categoryColor.text }]}>{entry.category}</Text>
            </View>
          )}
          {isExpired && (
            <View style={[styles.badge, styles.badgeError]}>
              <Text style={[styles.badgeText, { color: theme.colors.error }]}>{t("card.expired")}</Text>
            </View>
          )}
          {isExpiringSoon && (
            <View style={[styles.badge, styles.badgeWarning]}>
              <Text style={[styles.badgeText, { color: theme.colors.warning }]}>{t("card.expiresSoon")}</Text>
            </View>
          )}
        </View>
      </View>

      {/* ── Revealed password ───────────────────────────────────────────── */}
      {revealed && (
        <View style={styles.passwordBox}>
          <Text
            style={[
              styles.passwordText,
              decryptedPassword === t("card.decryptionFailed") && { color: theme.colors.error },
            ]}
            selectable
          >
            {decryptedPassword}
          </Text>
        </View>
      )}

      {/* ── Actions ─────────────────────────────────────────────────────── */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={handleReveal}
          disabled={decrypting}
          activeOpacity={0.75}
        >
          {decrypting ? (
            <ActivityIndicator size="small" color={theme.colors.primary} />
          ) : (
            <>
              <Feather name={revealed ? "eye-off" : "eye"} size={14} color={theme.colors.textSecondary} />
              <Text style={styles.actionText}>
                {revealed ? t("card.hide") : t("card.show")}
              </Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.actionBtn,
            copyStatus === "success" && styles.actionBtnSuccess,
            copyStatus === "error" && styles.actionBtnError,
          ]}
          onPress={handleCopy}
          activeOpacity={0.75}
        >
          <Feather
            name={copyStatus === "success" ? "check" : copyStatus === "error" ? "x-circle" : "copy"}
            size={14}
            color={
              copyStatus === "success"
                ? theme.colors.accent
                : copyStatus === "error"
                  ? theme.colors.error
                  : theme.colors.textSecondary
            }
          />
          <Text
            style={[
              styles.actionText,
              copyStatus === "success" && { color: theme.colors.accent },
              copyStatus === "error" && { color: theme.colors.error },
            ]}
          >
            {copyStatus === "success"
              ? t("common.copied")
              : copyStatus === "error"
                ? t("common.error")
                : t("card.copy")}
          </Text>
        </TouchableOpacity>

        {entry.attachmentRef && (
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={handleDownloadAttachment}
            disabled={downloading}
            activeOpacity={0.75}
          >
            {downloading ? (
              <ActivityIndicator size="small" color={theme.colors.primary} />
            ) : (
              <>
                <Feather name="download" size={14} color={theme.colors.textSecondary} />
                <Text style={styles.actionText}>{t("card.download")}</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.actionBtn} onPress={onEdit} activeOpacity={0.75}>
          <Feather name="edit-2" size={14} color={theme.colors.textSecondary} />
          <Text style={styles.actionText}>{t("card.edit")}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.actionBtn, styles.actionBtnDelete]} onPress={onDelete} activeOpacity={0.75}>
          <Feather name="trash-2" size={14} color={theme.colors.error} />
          <Text style={[styles.actionText, { color: theme.colors.error }]}>{t("card.delete")}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    ...(Platform.OS === "web"
      ? { boxShadow: "0 2px 12px rgba(0,0,0,0.25)" }
      : {
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.2,
          shadowRadius: 8,
          elevation: 4,
        }),
  },

  // ── Top row ───────────────────────────────────────────────────────────────
  topRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    flexShrink: 0,
  },
  avatarText: {
    fontSize: 11,
    fontWeight: theme.fontWeight.bold,
    letterSpacing: 0.5,
    ...theme.typography,
  },
  nameBlock: {
    flex: 1,
    marginRight: 8,
  },
  serviceName: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.textPrimary,
    letterSpacing: theme.letterSpacing.tight,
    ...theme.typography,
  },
  username: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    marginTop: 2,
    ...theme.typography,
  },
  badges: {
    flexDirection: "column",
    gap: 3,
    alignItems: "flex-end",
  },
  badge: {
    paddingVertical: 2,
    paddingHorizontal: 7,
    borderRadius: theme.borderRadius.full,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  badgeError: {
    backgroundColor: theme.colors.errorMuted,
  },
  badgeWarning: {
    backgroundColor: theme.colors.warningMuted,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: theme.fontWeight.bold,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    ...theme.typography,
  },

  // ── Password box ──────────────────────────────────────────────────────────
  passwordBox: {
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: theme.borderRadius.sm,
    paddingVertical: 10,
    paddingHorizontal: theme.spacing.md,
    marginTop: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  passwordText: {
    fontFamily: Platform.OS === "web"
      ? "'JetBrains Mono', 'Fira Code', 'Courier New', monospace"
      : "monospace",
    fontSize: theme.fontSize.sm,
    color: theme.colors.accent,
    letterSpacing: 1.5,
  },

  // ── Actions ───────────────────────────────────────────────────────────────
  actions: {
    flexDirection: "row",
    marginTop: theme.spacing.md,
    gap: 6,
    flexWrap: "wrap",
  },
  actionBtn: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  actionBtnSuccess: {
    borderColor: "rgba(6, 214, 160, 0.3)",
    backgroundColor: theme.colors.accentMuted,
  },
  actionBtnError: {
    borderColor: "rgba(242, 82, 98, 0.3)",
    backgroundColor: theme.colors.errorMuted,
  },
  actionBtnDelete: {
    borderColor: "rgba(242, 82, 98, 0.2)",
    backgroundColor: theme.colors.errorMuted,
  },
  actionText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontWeight: theme.fontWeight.medium,
    ...theme.typography,
  },
});
