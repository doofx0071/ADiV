/**
 * Platform-neutral entry for the widget task handler. The native handler
 * (registerWidgetTaskHandler) only loads on Android/iOS builds; web skips it.
 * Same pattern as lib/notification-api(.native/.web).
 */
import { Platform } from "react-native";

if (Platform.OS !== "web") {
  // Metro resolves the platform-specific file at bundle time.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require("./widget-task-handler.native");
}
