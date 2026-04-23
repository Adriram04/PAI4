import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  ScrollView,
  Modal,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { theme } from "../utils/theme";
import {
  generatePassword,
  estimateStrength,
  DEFAULT_OPTIONS,
  PasswordOptions,
} from "../utils/passwordGenerator";
import { PasswordCategory, PASSWORD_CATEGORIES } from "../types";
import { checkDuplicate } from "../services/passwordService";
import { useI18n } from "../i18n";
import { isValidEmail } from "../utils/validation";
import { Feather } from "@expo/vector-icons";

export interface PasswordFormSubmitData {
  serviceName: string;
  username: string;
  password: string;
  url?: string;
  category?: PasswordCategory;
  expiresAt?: string;
  attachmentUri?: string;
  attachmentName?: string;
}

interface Props {
  onSubmit: (data: PasswordFormSubmitData) => Promise<void>;
  initialValues?: {
    serviceName: string;
    username: string;
    url?: string;
    category?: PasswordCategory;
    expiresAt?: string;
  };
  initialPassword?: string;
  hasAttachment?: boolean;
  submitLabel?: string;
  loading?: boolean;
  userId?: string;
  editingId?: string;
  scrollEnabled?: boolean;
}

export function PasswordForm({
  onSubmit,
  initialValues,
  initialPassword,
  hasAttachment,
  submitLabel,
  loading,
  userId,
  editingId,
  scrollEnabled = true,
}: Props) {
  const { t } = useI18n();
  const [serviceName, setServiceName] = useState(
    initialValues?.serviceName || ""
  );
  const [username, setUsername] = useState(initialValues?.username || "");
  const [password, setPassword] = useState(initialPassword || "");
  const [url, setUrl] = useState(initialValues?.url || "");
  const [category, setCategory] = useState<PasswordCategory>(
    initialValues?.category || "other"
  );
  const [expiresAt, setExpiresAt] = useState(initialValues?.expiresAt || "");
  const [showGenerator, setShowGenerator] = useState(false);
  const [genOptions, setGenOptions] = useState<PasswordOptions>(DEFAULT_OPTIONS);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [attachmentUri, setAttachmentUri] = useState<string | undefined>();
  const [attachmentName, setAttachmentName] = useState<string | undefined>();
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);

  // Sync state to props during render (React recommended pattern instead of useEffect)
  const [prevInitialPassword, setPrevInitialPassword] = useState(initialPassword);
  if (initialPassword !== prevInitialPassword) {
    setPrevInitialPassword(initialPassword);
    setPassword(initialPassword || "");
  }

  const [prevInitialValues, setPrevInitialValues] = useState(initialValues);
  if (initialValues !== prevInitialValues) {
    setPrevInitialValues(initialValues);
    setServiceName(initialValues?.serviceName || "");
    setUsername(initialValues?.username || "");
    setUrl(initialValues?.url || "");
    setCategory(initialValues?.category || "other");
    setExpiresAt(initialValues?.expiresAt || "");
  }

  const strength = password ? estimateStrength(password) : null;

  const handleGenerate = () => {
    const generated = generatePassword(genOptions);
    setPassword(generated);
    setShowPassword(true);
  };

  const handlePickAttachment = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets.length > 0) {
        const asset = result.assets[0];
        setAttachmentUri(asset.uri);
        setAttachmentName(asset.name);
      }
    } catch {
      // user cancelled
    }
  };

  const doSubmit = async () => {
    setError("");
    try {
      await onSubmit({
        serviceName: serviceName.trim(),
        username: username.trim(),
        password,
        url: url.trim() || undefined,
        category,
        expiresAt: expiresAt || undefined,
        attachmentUri: attachmentUri,
        attachmentName: attachmentName,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to save";
      setError(message);
    }
  };

  const handleSubmit = async () => {
    if (!serviceName.trim()) {
      setError(t("form.serviceRequired"));
      return;
    }
    if (!username.trim()) {
      setError(t("form.usernameRequired"));
      return;
    }
    if (!password) {
      setError(t("form.passwordRequired"));
      return;
    }
    
    // Check if username looks like an email and validate it
    const trimmedUsername = username.trim();
    if (trimmedUsername.includes("@")) {
      if (!isValidEmail(trimmedUsername)) {
        setError(t("validation.invalidEmail"));
        return;
      }
    }

    // URL Validation
    if (url.trim()) {
      const tUrl = url.trim();
      const lowerUrl = tUrl.toLowerCase();
      if (!lowerUrl.startsWith("http://") && !lowerUrl.startsWith("https://")) {
        setError(t("form.invalidUrlProtocol"));
        return;
      }
      const urlPattern = /^(https?:\/\/)([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(:\d+)?(\/.*)?$/i;
      if (!urlPattern.test(lowerUrl)) {
        setError(t("form.invalidUrl"));
        return;
      }
    }

    if (expiresAt) {
      if (expiresAt.length !== 10) {
        setError(t("validation.invalidDate"));
        return;
      }
      const expDate = new Date(expiresAt);
      if (isNaN(expDate.getTime())) {
        setError(t("validation.invalidDate"));
        return;
      }
      if (expDate <= new Date()) {
        setError(t("validation.expiredDate"));
        return;
      }
    }

    // Check for duplicates
    if (userId) {
      try {
        const isDuplicate = await checkDuplicate(
          userId,
          serviceName.trim(),
          username.trim(),
          editingId
        );
        if (isDuplicate) {
          setShowDuplicateModal(true);
          return;
        }
      } catch {
        // skip duplicate check if it fails
      }
    }

    await doSubmit();
  };

  const resolvedSubmitLabel = submitLabel || t("form.encryptSave");

  const formContent = (
    <>
      <View style={styles.field}>
        <Text style={styles.label}>{t("form.serviceName")} *</Text>
        <TextInput
          style={styles.input}
          placeholder={t("form.serviceNamePlaceholder")}
          placeholderTextColor={theme.colors.textMuted}
          value={serviceName}
          onChangeText={setServiceName}
          autoFocus
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>{t("form.username")} *</Text>
        <TextInput
          style={styles.input}
          placeholder={t("form.usernamePlaceholder")}
          placeholderTextColor={theme.colors.textMuted}
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          keyboardType="email-address"
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>{t("form.url")} ({t("common.optional")})</Text>
        <TextInput
          style={styles.input}
          placeholder={t("form.urlPlaceholder")}
          placeholderTextColor={theme.colors.textMuted}
          value={url}
          onChangeText={setUrl}
          autoCapitalize="none"
          keyboardType="url"
        />
      </View>

      {/* Category Picker */}
      <View style={styles.field}>
        <Text style={styles.label}>{t("form.category")}</Text>
        <TouchableOpacity
          style={styles.input}
          onPress={() => setShowCategoryPicker(!showCategoryPicker)}
          activeOpacity={0.7}
        >
          <Text style={styles.pickerText}>
            {t(PASSWORD_CATEGORIES.find(c => c.key === category)?.labelKey as any || "categories.other")}
          </Text>
        </TouchableOpacity>
        {showCategoryPicker && (
          <View style={styles.categoryGrid}>
            {PASSWORD_CATEGORIES.map(({ key, labelKey }) => (
              <TouchableOpacity
                key={key}
                style={[
                  styles.categoryChip,
                  category === key && styles.categoryChipActive,
                ]}
                onPress={() => {
                  setCategory(key);
                  setShowCategoryPicker(false);
                }}
              >
                <Text
                  style={[
                    styles.categoryChipText,
                    category === key && styles.categoryChipTextActive,
                  ]}
                >
                  {t(labelKey as any)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* Expiration Date */}
      <View style={styles.field}>
        <Text style={styles.label}>{t("form.expiresAt")} ({t("common.optional")})</Text>
        <TextInput
          style={styles.input}
          placeholder={t("form.expiresAtPlaceholder")}
          placeholderTextColor={theme.colors.textMuted}
          value={expiresAt}
          onChangeText={(text) => {
            const digits = text.replace(/\D/g, "").slice(0, 8);
            let formatted = digits;
            if (digits.length > 4 && digits.length <= 6) {
              formatted = `${digits.slice(0, 4)}-${digits.slice(4)}`;
            } else if (digits.length > 6) {
              formatted = `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`;
            }
            // Fix deletion edge cases
            if (text.endsWith("-") && text.length < expiresAt.length) {
              formatted = formatted.slice(0, -1);
            }
            setExpiresAt(formatted);
          }}
          autoCapitalize="none"
          keyboardType="numeric"
          maxLength={10}
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>{t("form.password")} *</Text>
        <View style={styles.passwordRow}>
          <TextInput
            style={[styles.input, styles.passwordInput]}
            placeholder={t("form.passwordPlaceholder")}
            placeholderTextColor={theme.colors.textMuted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
          />
          <TouchableOpacity
            style={styles.eyeButton}
            onPress={() => setShowPassword(!showPassword)}
          >
            <Text style={styles.eyeText}>{showPassword ? "Hide" : "Show"}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Password Strength Indicator */}
      {strength && (
        <View style={styles.strengthContainer}>
          <View style={styles.strengthBar}>
            {[0, 1, 2, 3, 4].map((i) => (
              <View
                key={i}
                style={[
                  styles.strengthSegment,
                  {
                    backgroundColor:
                      i <= strength.score
                        ? strength.color
                        : theme.colors.surfaceElevated,
                  },
                ]}
              />
            ))}
          </View>
          <Text style={[styles.strengthLabel, { color: strength.color }]}>
            {strength.label}
          </Text>
        </View>
      )}

      {/* Password Generator Toggle */}
      <TouchableOpacity
        style={styles.generatorToggle}
        onPress={() => setShowGenerator(!showGenerator)}
        activeOpacity={0.7}
      >
        <Text style={styles.generatorToggleText}>
          {showGenerator ? t("form.hideGenerator") : t("form.generatePassword")}
        </Text>
      </TouchableOpacity>

      {showGenerator && (
        <View style={styles.generatorPanel}>
          <View style={styles.genOption}>
            <Text style={styles.genLabel}>
              {t("form.length")}: {genOptions.length}
            </Text>
            <View style={styles.lengthButtons}>
              <TouchableOpacity
                style={styles.lengthBtn}
                onPress={() =>
                  setGenOptions((o) => ({
                    ...o,
                    length: Math.max(8, o.length - 2),
                  }))
                }
              >
                <Text style={styles.lengthBtnText}>-</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.lengthBtn}
                onPress={() =>
                  setGenOptions((o) => ({
                    ...o,
                    length: Math.min(64, o.length + 2),
                  }))
                }
              >
                <Text style={styles.lengthBtnText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>

          {([
            { key: "includeLowercase" as const, labelKey: "form.lowercase" as const },
            { key: "includeUppercase" as const, labelKey: "form.uppercase" as const },
            { key: "includeDigits" as const, labelKey: "form.digits" as const },
            { key: "includeSymbols" as const, labelKey: "form.symbols" as const },
          ] as const).map(({ key, labelKey }) => (
            <TouchableOpacity
              key={key}
              style={styles.genOption}
              onPress={() =>
                setGenOptions((o) => ({ ...o, [key]: !o[key] }))
              }
            >
              <Text style={styles.genLabel}>{t(labelKey)}</Text>
              <View style={[styles.toggle, genOptions[key] && styles.toggleActive]}>
                <View style={[styles.toggleDot, genOptions[key] && styles.toggleDotActive]} />
              </View>
            </TouchableOpacity>
          ))}

          <TouchableOpacity
            style={styles.generateBtn}
            onPress={handleGenerate}
            activeOpacity={0.7}
          >
            <Text style={styles.generateBtnText}>{t("form.generate")}</Text>
          </TouchableOpacity>
        </View>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {/* Attachment Picker */}
      <View style={styles.field}>
        <Text style={styles.label}>{t("form.attachment")} ({t("common.optional")})</Text>
        <TouchableOpacity
          style={styles.attachButton}
          onPress={handlePickAttachment}
          activeOpacity={0.7}
        >
          <Text style={styles.attachButtonText}>
            {attachmentName
              ? attachmentName
              : hasAttachment
                ? t("form.replaceAttachment")
                : t("form.attachFile")}
          </Text>
        </TouchableOpacity>
        {attachmentName && (
          <TouchableOpacity
            onPress={() => {
              setAttachmentUri(undefined);
              setAttachmentName(undefined);
            }}
          >
            <Text style={styles.removeAttach}>{t("form.removeAttachment")}</Text>
          </TouchableOpacity>
        )}
      </View>

      <TouchableOpacity
        style={[styles.submitButton, loading && styles.submitDisabled]}
        onPress={handleSubmit}
        disabled={loading}
        activeOpacity={0.8}
      >
        {loading ? (
          <ActivityIndicator color={theme.colors.textPrimary} />
        ) : (
          <Text style={styles.submitText}>{resolvedSubmitLabel}</Text>
        )}
      </TouchableOpacity>

      {/* Duplicate Warning Modal */}
      <Modal visible={showDuplicateModal} transparent animationType="fade" statusBarTranslucent>
        <View style={styles.dupOverlay}>
          <View style={styles.dupCard}>
            <View style={styles.dupIconWrap}>
              <Feather name="alert-triangle" size={28} color={theme.colors.warning} />
            </View>
            <Text style={styles.dupTitle}>{t("form.duplicateWarning")}</Text>
            <Text style={styles.dupDesc}>
              {serviceName} — {username}
            </Text>
            <View style={styles.dupActions}>
              <TouchableOpacity
                style={styles.dupCancelBtn}
                onPress={() => setShowDuplicateModal(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.dupCancelText}>{t("common.cancel")}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.dupConfirmBtn}
                onPress={() => { setShowDuplicateModal(false); doSubmit(); }}
                activeOpacity={0.8}
              >
                <Text style={styles.dupConfirmText}>{t("common.confirm")}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );

  if (!scrollEnabled) {
    return <View style={[styles.formBody, styles.contentContainer]}>{formContent}</View>;
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      {formContent}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  formBody: {
    width: "100%",
  },
  contentContainer: {
    paddingHorizontal: 2,
    paddingBottom: theme.spacing.xxl,
  },
  field: {
    marginBottom: theme.spacing.lg,
  },
  label: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    ...theme.typography,
  },
  input: {
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    fontSize: theme.fontSize.md,
    color: theme.colors.textPrimary,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    ...theme.typography,
  },
  pickerText: {
    color: theme.colors.textPrimary,
    fontSize: theme.fontSize.md,
    ...theme.typography,
  },
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  categoryChip: {
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
  },
  categoryChipActive: {
    backgroundColor: theme.colors.primaryMuted,
    borderColor: theme.colors.primary,
  },
  categoryChipText: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.sm,
    ...theme.typography,
  },
  categoryChipTextActive: {
    color: theme.colors.primary,
    fontWeight: theme.fontWeight.semibold,
    ...theme.typography,
  },
  passwordRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  passwordInput: {
    flex: 1,
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
  },
  eyeButton: {
    backgroundColor: theme.colors.surfaceElevated,
    padding: theme.spacing.md,
    borderTopRightRadius: theme.borderRadius.md,
    borderBottomRightRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderLeftWidth: 0,
    borderColor: theme.colors.borderSubtle,
  },
  eyeText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.primary,
    fontWeight: theme.fontWeight.medium,
    ...theme.typography,
  },
  strengthContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  strengthBar: {
    flexDirection: "row",
    flex: 1,
    gap: 4,
  },
  strengthSegment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  strengthLabel: {
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.semibold,
    minWidth: 70,
    textAlign: "right",
    ...theme.typography,
  },
  generatorToggle: {
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.accentMuted,
    alignItems: "center",
    marginBottom: theme.spacing.md,
  },
  generatorToggleText: {
    color: theme.colors.accent,
    fontWeight: theme.fontWeight.semibold,
    fontSize: theme.fontSize.sm,
    ...theme.typography,
  },
  generatorPanel: {
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  genOption: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderSubtle,
  },
  genLabel: {
    color: theme.colors.textPrimary,
    fontSize: theme.fontSize.sm,
    ...theme.typography,
  },
  toggle: {
    width: 40,
    height: 22,
    borderRadius: 11,
    backgroundColor: theme.colors.surface,
    justifyContent: "center",
    paddingHorizontal: 2,
  },
  toggleActive: {
    backgroundColor: theme.colors.primary,
  },
  toggleDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: theme.colors.textMuted,
  },
  toggleDotActive: {
    backgroundColor: theme.colors.textPrimary,
    alignSelf: "flex-end",
  },
  lengthButtons: {
    flexDirection: "row",
    gap: theme.spacing.sm,
  },
  lengthBtn: {
    width: 36,
    height: 36,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.primaryMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  lengthBtnText: {
    color: theme.colors.primary,
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.bold,
    ...theme.typography,
  },
  generateBtn: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.borderRadius.sm,
    padding: theme.spacing.md,
    alignItems: "center",
    marginTop: theme.spacing.md,
  },
  generateBtnText: {
    color: theme.colors.background,
    fontWeight: theme.fontWeight.bold,
    fontSize: theme.fontSize.sm,
    ...theme.typography,
  },
  error: {
    color: theme.colors.error,
    fontSize: theme.fontSize.sm,
    marginBottom: theme.spacing.md,
    textAlign: "center",
    ...theme.typography,
  },
  submitButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.lg,
    alignItems: "center",
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.xxl,
    ...(Platform.OS === "web"
      ? { boxShadow: "0 4px 15px rgba(139, 92, 246, 0.3)" }
      : {
          shadowColor: theme.colors.primary,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
          elevation: 5,
        }),
  },
  submitDisabled: {
    opacity: 0.6,
  },
  submitText: {
    color: theme.colors.textPrimary,
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.bold,
    ...theme.typography,
  },
  attachButton: {
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    borderStyle: "dashed",
  },
  attachButtonText: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,
    ...theme.typography,
  },
  removeAttach: {
    color: theme.colors.error,
    fontSize: theme.fontSize.sm,
    marginTop: theme.spacing.xs,
    textAlign: "center",
    ...theme.typography,
  },

  // Duplicate warning modal
  dupOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.85)",
    justifyContent: "center",
    alignItems: "center",
    padding: theme.spacing.lg,
  },
  dupCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.xl,
    width: "100%",
    maxWidth: 400,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: "center",
    ...(Platform.OS === "web"
      ? { boxShadow: "0 24px 48px rgba(0,0,0,0.5)" }
      : { elevation: 20 }),
  },
  dupIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(245, 158, 11, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.2)",
  },
  dupTitle: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.textPrimary,
    textAlign: "center",
    marginBottom: theme.spacing.sm,
    lineHeight: theme.lineHeight.relaxed,
    ...theme.typography,
  },
  dupDesc: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textMuted,
    textAlign: "center",
    marginBottom: theme.spacing.xl,
    ...theme.typography,
  },
  dupActions: {
    flexDirection: "row",
    gap: theme.spacing.md,
    width: "100%",
  },
  dupCancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: "center",
  },
  dupCancelText: {
    color: theme.colors.textSecondary,
    fontWeight: theme.fontWeight.semibold,
    fontSize: theme.fontSize.sm,
    ...theme.typography,
  },
  dupConfirmBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.warning,
    alignItems: "center",
  },
  dupConfirmText: {
    color: theme.colors.background,
    fontWeight: theme.fontWeight.bold,
    fontSize: theme.fontSize.sm,
    ...theme.typography,
  },
});
