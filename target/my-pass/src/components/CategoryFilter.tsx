/**
 * CategoryFilter Component
 *
 * Horizontal scrollable pill bar for filtering passwords by category.
 */

import React from "react";
import { Text, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { theme } from "../utils/theme";
import { PasswordCategory, PASSWORD_CATEGORIES } from "../types";
import { useI18n } from "../i18n";
import { Feather } from "@expo/vector-icons";

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

interface Props {
  selected: PasswordCategory | "all";
  onSelect: (category: PasswordCategory | "all") => void;
}

export function CategoryFilter({ selected, onSelect }: Props) {
  const { t } = useI18n();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {/* All */}
      <TouchableOpacity
        style={[styles.pill, selected === "all" && styles.pillActive]}
        onPress={() => onSelect("all")}
        activeOpacity={0.7}
      >
        <Feather name="layers" size={14} color={selected === "all" ? theme.colors.primary : theme.colors.textMuted} />
        <Text style={[styles.pillText, selected === "all" && styles.pillTextActive]}>
          {t("common.all")}
        </Text>
      </TouchableOpacity>

      {PASSWORD_CATEGORIES.map(({ key, labelKey }) => {
        const active = selected === key;
        const colorData = theme.categoryColors[key] || theme.categoryColors.other;
        const iconName = CATEGORY_ICONS[key] || "folder";
        return (
          <TouchableOpacity
            key={key}
            style={[
              styles.pill,
              active && { backgroundColor: colorData.bg, borderColor: colorData.text },
            ]}
            onPress={() => onSelect(key)}
            activeOpacity={0.7}
          >
            <Feather
              name={iconName}
              size={13}
              color={active ? colorData.text : theme.colors.textMuted}
            />
            <Text
              style={[
                styles.pillText,
                active && { color: colorData.text, fontWeight: theme.fontWeight.semibold },
              ]}
            >
              {t(labelKey as any)}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: 8,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    minHeight: 54,
  },
  pill: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginRight: 6,
    flexShrink: 0,
    height: 34,
  },
  pillActive: {
    backgroundColor: theme.colors.primaryMuted,
    borderColor: theme.colors.border,
  },
  pillText: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.medium,
    letterSpacing: 0.2,
    ...theme.typography,
  },
  pillTextActive: {
    color: theme.colors.primary,
    fontWeight: theme.fontWeight.semibold,
  },
});

