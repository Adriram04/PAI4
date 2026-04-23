/**
 * MasterPasswordModal Component
 *
 * Prompts the user to enter their master password at the start of each session.
 * Includes a "Use Recovery Code" fallback when the user forgets their password.
 */

import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ActivityIndicator,
  Platform,
  Animated,
} from "react-native";
import { theme } from "../utils/theme";
import { Feather } from "@expo/vector-icons";
import { EncryptedPayload } from "../types";
import { decrypt } from "../crypto/encryption";
import { verifyTOTPToken } from "../services/totpService";
import { normalizeCode } from "../services/recoveryService";
import { useI18n, TranslationKey } from "../i18n";

interface Props {
  visible: boolean;
  onSubmit: (masterPassword: string) => Promise<{ requires2FA?: boolean; encryptedSecret?: EncryptedPayload; masterKey?: CryptoKey } | void>;
  on2FASuccess?: (masterKey: CryptoKey) => void;
  onRecoveryCode?: (code: string) => Promise<boolean>;
  on2FAReset?: (masterKey: CryptoKey) => Promise<void>;
  isFirstTime?: boolean;
}

export function MasterPasswordModal({ visible, onSubmit, on2FASuccess, onRecoveryCode, on2FAReset, isFirstTime }: Props) {
  const { t } = useI18n();
  const [step, setStep] = useState<"PASSWORD" | "TOTP" | "RECOVERY">("PASSWORD");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Pending items for 2FA flow
  const [pendingKey, setPendingKey] = useState<CryptoKey | null>(null);
  const [pendingSecret, setPendingSecret] = useState<EncryptedPayload | null>(null);
  const [show2FAReset, setShow2FAReset] = useState(false);

  const scaleAnim = useRef(new Animated.Value(0.92)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setStep("PASSWORD");
      setPassword("");
      setConfirmPassword("");
      setTotpCode("");
      setRecoveryCode("");
      setError("");
      setShow2FAReset(false);
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 1, tension: 100, friction: 8, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      scaleAnim.setValue(0.92);
      opacityAnim.setValue(0);
    }
  }, [visible, scaleAnim, opacityAnim]);

  const handleSubmit = async () => {
    if (!password) {
      setError("Please enter your master password");
      return;
    }
    if (password.length < 8) {
      setError("Must be at least 8 characters");
      return;
    }
    if (isFirstTime && password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const result = await onSubmit(password);
      if (result && result.requires2FA && result.encryptedSecret && result.masterKey) {
        setPendingKey(result.masterKey);
        setPendingSecret(result.encryptedSecret);
        setStep("TOTP");
      } else {
        setPassword("");
        setConfirmPassword("");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to unlock vault";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyTOTP = async () => {
    if (!totpCode || totpCode.length !== 6) {
      setError("Please enter a 6-digit code");
      return;
    }
    if (!pendingKey || !pendingSecret || !on2FASuccess) return;

    setLoading(true);
    setError("");
    try {
      const decryptedSecret = await decrypt(pendingSecret, pendingKey);
      const isValid = verifyTOTPToken(decryptedSecret, totpCode);
      if (!isValid) {
        throw new Error("Invalid code. Please try again.");
      }
      // Validated!
      setPassword("");
      setTotpCode("");
      on2FASuccess(pendingKey);
    } catch (err: any) {
      if (err?.message?.includes("Decryption failed")) {
        setError(t("twofa.decryptionError" as TranslationKey));
        setShow2FAReset(true);
      } else {
        setError(err instanceof Error ? err.message : "Failed to verify 2FA code");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRecoverySubmit = async () => {
    const rawCode = recoveryCode.trim();
    if (!rawCode) {
      setError("Please enter a recovery code");
      return;
    }
    if (!onRecoveryCode) return;

    setLoading(true);
    setError("");
    try {
      // Use the exported normalizeCode to ensure consistent hashing/derivation
      const normalized = normalizeCode(rawCode);
      const success = await onRecoveryCode(normalized);
      if (!success) {
        setError("Invalid or already used recovery code.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Recovery failed");
    } finally {
      setLoading(false);
    }
  };

  const getTitle = () => {
    if (step === "TOTP") return "Two-Factor Authentication";
    if (step === "RECOVERY") return "Recovery Code";
    if (isFirstTime) return "Set Master Password";
    return "Unlock Vault";
  };

  const getSubtitle = () => {
    if (step === "TOTP") return "Open your Authenticator app and enter the 6-digit code.";
    if (step === "RECOVERY") return "Enter one of your single-use recovery codes to regain access to your vault.";
    if (isFirstTime) return "Choose a strong master password. It encrypts all your stored data and is never transmitted.";
    return "Enter your master password to decrypt your vault for this session.";
  };

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent>
      <View style={styles.overlay}>
        <Animated.View
          style={[
            styles.card,
            { opacity: opacityAnim, transform: [{ scale: scaleAnim }] },
          ]}
        >
          {/* Lock icon */}
          <View style={styles.lockWrap}>
            <Feather
              name={step === "RECOVERY" ? "shield" : "lock"}
              size={28}
              color={step === "RECOVERY" ? theme.colors.accent : theme.colors.primary}
            />
          </View>

           <Text style={styles.title}>{getTitle()}</Text>
          <Text style={styles.subtitle}>{getSubtitle()}</Text>

          {step === "PASSWORD" ? (
            <>
              <View style={styles.inputBlock}>
                <Text style={styles.inputLabel}>Master Password</Text>
                <TextInput
                  style={styles.input}
                  placeholder="••••••••••••"
                  placeholderTextColor={theme.colors.textMuted}
                  secureTextEntry
                  value={password}
                  onChangeText={(text) => { setPassword(text); setError(""); }}
                  onSubmitEditing={isFirstTime ? undefined : handleSubmit}
                  autoFocus
                />
              </View>

              {isFirstTime && (
                <View style={styles.inputBlock}>
                  <Text style={styles.inputLabel}>Confirm Password</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="••••••••••••"
                    placeholderTextColor={theme.colors.textMuted}
                    secureTextEntry
                    value={confirmPassword}
                    onChangeText={(text) => { setConfirmPassword(text); setError(""); }}
                    onSubmitEditing={handleSubmit}
                  />
                </View>
              )}
            </>
          ) : show2FAReset ? (
            <View style={styles.inputBlock}>
              <View style={styles.resetContainer}>
                 <Text style={styles.resetDesc}>
                  {t("twofa.emergencyResetDesc")}
                </Text>
                <TouchableOpacity
                  style={styles.resetButton}
                  onPress={async () => {
                    if (on2FAReset && pendingKey) {
                      setLoading(true);
                      try {
                        await on2FAReset(pendingKey);
                      } catch (err) {
                         setError(err instanceof Error ? err.message : "Reset failed");
                      } finally {
                        setLoading(false);
                      }
                    }
                  }}
                >
                  <Feather name="refresh-cw" size={14} color="#fff" style={{ marginRight: 8 }} />
                  <Text style={styles.resetButtonText}>
                    {t("twofa.emergencyReset" as TranslationKey)}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  onPress={() => setShow2FAReset(false)}
                  style={{ marginTop: 12 }}
                >
                   <Text style={{ color: theme.colors.textMuted, fontSize: 11, textAlign: "center" }}>
                      {t("common.back")}
                   </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : step === "TOTP" ? (
            <View style={styles.inputBlock}>
              <Text style={styles.inputLabel}>Authenticator Code</Text>
              <TextInput
                style={[styles.input, { textAlign: "center", letterSpacing: 8, fontSize: 24 }]}
                placeholder="000000"
                placeholderTextColor={theme.colors.textMuted}
                keyboardType="numeric"
                maxLength={6}
                value={totpCode}
                onChangeText={(text) => { setTotpCode(text.replace(/[^0-9]/g, "")); setError(""); }}
                onSubmitEditing={handleVerifyTOTP}
                autoFocus
              />
            </View>
          ) : (
            <View style={styles.inputBlock}>
              <Text style={styles.inputLabel}>Recovery Code</Text>
              <TextInput
                style={[styles.input, { textAlign: "center", letterSpacing: 4, fontSize: 18, textTransform: "uppercase" }]}
                placeholder="XXXXXXXX"
                placeholderTextColor={theme.colors.textMuted}
                maxLength={8}
                autoCapitalize="characters"
                value={recoveryCode}
                onChangeText={(text) => { setRecoveryCode(text); setError(""); }}
                onSubmitEditing={handleRecoverySubmit}
                autoFocus
              />
            </View>
          )}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          {!show2FAReset && (
            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled, step === "RECOVERY" && styles.recoveryBtn]}
              onPress={step === "TOTP" ? handleVerifyTOTP : step === "RECOVERY" ? handleRecoverySubmit : handleSubmit}
              disabled={loading || (step === "TOTP" && totpCode.length !== 6)}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color={theme.colors.textPrimary} />
              ) : (
                <Text style={styles.buttonText}>
                  {step === "TOTP" ? "Verify Code" : step === "RECOVERY" ? "Recover Access" : isFirstTime ? "Create Vault" : "Unlock"}
                </Text>
              )}
            </TouchableOpacity>
          )}

          {/* Toggle between password and recovery */}
          {!isFirstTime && step !== "TOTP" && onRecoveryCode && (
            <TouchableOpacity
              style={styles.recoveryToggle}
              onPress={() => {
                setError("");
                setStep(step === "RECOVERY" ? "PASSWORD" : "RECOVERY");
              }}
              activeOpacity={0.7}
            >
              <Feather
                name={step === "RECOVERY" ? "lock" : "shield"}
                size={13}
                color={theme.colors.primary}
                style={{ marginRight: 6 }}
              />
              <Text style={styles.recoveryToggleText}>
                {step === "RECOVERY" ? "Use Master Password" : "Forgot password? Use Recovery Code"}
              </Text>
            </TouchableOpacity>
          )}

          <View style={styles.noticeRow}>
            <Feather name="alert-triangle" size={12} color={theme.colors.warning} style={styles.noticeIcon} />
            <Text style={styles.notice}>
              This password is never stored. Forget it and your data is unrecoverable.
            </Text>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.88)",
    justifyContent: "center",
    alignItems: "center",
    padding: theme.spacing.lg,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.xl,
    width: "100%",
    maxWidth: 400,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...(Platform.OS === "web"
      ? {
          boxShadow:
            "0 32px 64px rgba(0,0,0,0.6), 0 0 0 1px rgba(139,92,246,0.1), inset 0 1px 0 rgba(255,255,255,0.04)",
        }
      : {
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 16 },
          shadowOpacity: 0.6,
          shadowRadius: 32,
          elevation: 24,
        }),
  },
  lockWrap: {
    alignSelf: "center",
    width: 64,
    height: 64,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.colors.primaryMuted,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: theme.spacing.lg,
    ...(Platform.OS === "web"
      ? { boxShadow: "0 0 24px rgba(139,92,246,0.2)" }
      : {}),
  },
  title: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.textPrimary,
    textAlign: "center",
    marginBottom: 8,
    letterSpacing: theme.letterSpacing.tight,
    ...theme.typography,
  },
  subtitle: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textSecondary,
    textAlign: "center",
    marginBottom: theme.spacing.xl,
    lineHeight: theme.lineHeight.relaxed,
    ...theme.typography,
  },

  inputBlock: {
    marginBottom: theme.spacing.md,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginBottom: 6,
    ...theme.typography,
  },
  input: {
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: theme.borderRadius.md,
    paddingVertical: 13,
    paddingHorizontal: theme.spacing.md,
    fontSize: theme.fontSize.md,
    color: theme.colors.textPrimary,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    ...theme.typography,
  },
  error: {
    color: theme.colors.error,
    fontSize: theme.fontSize.xs,
    marginBottom: theme.spacing.md,
    textAlign: "center",
    fontWeight: theme.fontWeight.medium,
    ...theme.typography,
  },
  button: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.md,
    paddingVertical: 14,
    alignItems: "center",
    ...(Platform.OS === "web"
      ? { boxShadow: "0 4px 20px rgba(139,92,246,0.4)", cursor: "pointer" }
      : {}),
  },
  recoveryBtn: {
    backgroundColor: theme.colors.accent,
    ...(Platform.OS === "web"
      ? { boxShadow: "0 4px 20px rgba(6,214,160,0.3)" }
      : {}),
  },
  buttonDisabled: { opacity: 0.55 },
  buttonText: {
    color: theme.colors.textPrimary,
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
    letterSpacing: 0.3,
    ...theme.typography,
  },
  recoveryToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: theme.spacing.md,
    paddingVertical: 8,
  },
  recoveryToggleText: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.primary,
    fontWeight: theme.fontWeight.medium,
    ...theme.typography,
  },
  noticeRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: theme.spacing.lg,
    gap: 8,
  },
  noticeIcon: {
    fontSize: 11,
    marginTop: 1,
  },
  notice: {
    flex: 1,
    fontSize: 11,
    color: theme.colors.textMuted,
    lineHeight: 16,
    ...theme.typography,
  },
  resetContainer: {
    backgroundColor: "rgba(239, 68, 68, 0.05)",
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.15)",
    marginTop: theme.spacing.sm,
  },
  resetDesc: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.md,
    textAlign: "center",
    lineHeight: 18,
    ...theme.typography,
  },
  resetButton: {
    backgroundColor: theme.colors.error,
    borderRadius: theme.borderRadius.md,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  resetButtonText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: theme.fontWeight.bold,
    ...theme.typography,
  },
});
