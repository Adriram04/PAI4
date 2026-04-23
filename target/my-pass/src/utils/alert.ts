import { Alert, Platform } from "react-native";

/**
 * Universal alert utility for MyPass.
 * Shows a browser-native alert on Web and a React Native alert on Mobile.
 */
export function showUniversalAlert(title: string, message: string) {
  if (Platform.OS === "web") {
    // Web: Use standard browser alert
    window.alert(`${title}\n\n${message}`);
  } else {
    // Mobile: Use React Native alert
    Alert.alert(title, message);
  }
}
