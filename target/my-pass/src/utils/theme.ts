/**
 * Shared theme constants for the MyPass application.
 * Premium dark theme — refined, minimal, professional.
 */

import { Platform } from "react-native";
import { PasswordCategory } from "../types";

export const theme = {
  colors: {
    // Core palette
    background: "#07071a",
    surface: "#0d0d24",
    surfaceElevated: "#141432",
    surfaceGlass: "rgba(20, 20, 50, 0.72)",

    // Brand
    primaryStart: "#6c5ce7",
    primaryEnd: "#a855f7",
    primary: "#8b5cf6",
    primaryMuted: "rgba(139, 92, 246, 0.12)",
    primaryHover: "rgba(139, 92, 246, 0.2)",

    // Accent
    accent: "#06d6a0",
    accentMuted: "rgba(6, 214, 160, 0.12)",

    // Text
    textPrimary: "#eeeeff",
    textSecondary: "#7878a0",
    textMuted: "#44445a",

    // Status
    error: "#f25262",
    errorMuted: "rgba(242, 82, 98, 0.12)",
    success: "#06d6a0",
    warning: "#f59e0b",
    warningMuted: "rgba(245, 158, 11, 0.12)",

    // Borders
    border: "rgba(139, 92, 246, 0.18)",
    borderSubtle: "rgba(255, 255, 255, 0.05)",
    borderFocus: "rgba(139, 92, 246, 0.5)",
  },

  categoryColors: {
    social: { bg: "rgba(59, 130, 246, 0.15)", text: "#60a5fa" }, // Blue
    email: { bg: "rgba(239, 68, 68, 0.15)", text: "#f87171" }, // Red
    finance: { bg: "rgba(16, 185, 129, 0.15)", text: "#34d399" }, // Green
    work: { bg: "rgba(245, 158, 11, 0.15)", text: "#fbbf24" }, // Yellow/Orange
    entertainment: { bg: "rgba(139, 92, 246, 0.15)", text: "#a78bfa" }, // Purple
    shopping: { bg: "rgba(236, 72, 153, 0.15)", text: "#f472b6" }, // Pink
    development: { bg: "rgba(168, 85, 247, 0.15)", text: "#c084fc" }, // Violet
    other: { bg: "rgba(156, 163, 175, 0.15)", text: "#9ca3af" }, // Gray
  } as Record<PasswordCategory, { bg: string; text: string }>,


  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },

  borderRadius: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
    full: 999,
  },

  fontSize: {
    xs: 11,
    sm: 13,
    md: 15,
    lg: 19,
    xl: 26,
    xxl: 34,
  },

  fontWeight: {
    normal: "400" as const,
    medium: "500" as const,
    semibold: "600" as const,
    bold: "700" as const,
    extrabold: "800" as const,
  },

  typography: {
    fontFamily: Platform.OS === "web" ? '"Outfit", "Plus Jakarta Sans", system-ui, sans-serif' : undefined,
  },

  letterSpacing: {
    tight: -0.5,
    normal: 0,
    wide: 0.5,
    wider: 1,
    widest: 2,
  },

  lineHeight: {
    tight: 16,
    normal: 20,
    relaxed: 24,
    loose: 28,
  },

  // Web-only shadow helpers
  shadow: {
    sm: Platform.OS === "web"
      ? { boxShadow: "0 2px 8px rgba(0,0,0,0.3)" }
      : {
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.3,
          shadowRadius: 4,
          elevation: 3,
        },
    md: Platform.OS === "web"
      ? { boxShadow: "0 4px 16px rgba(0,0,0,0.4)" }
      : {
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.4,
          shadowRadius: 8,
          elevation: 6,
        },
    primary: Platform.OS === "web"
      ? { boxShadow: "0 4px 20px rgba(139, 92, 246, 0.35)" }
      : {
          shadowColor: "#8b5cf6",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.35,
          shadowRadius: 10,
          elevation: 6,
        },
    accent: Platform.OS === "web"
      ? { boxShadow: "0 4px 20px rgba(6, 214, 160, 0.25)" }
      : {
          shadowColor: "#06d6a0",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.25,
          shadowRadius: 10,
          elevation: 6,
        },
  },
};
