/**
 * Android widget task handler — renders the widget whenever Android adds,
 * updates, resizes, or clicks it. Registered from the root layout (native
 * only). The widget data comes from the AsyncStorage snapshot the app keeps
 * fresh in components/widget-sync.tsx.
 */
import { registerWidgetTaskHandler } from "react-native-android-widget";
import { AdivWidget, readWidgetSnapshot } from "./adiv-widget";

registerWidgetTaskHandler(async ({ widgetAction, renderWidget, widgetInfo }) => {
  // Debug: visible in `adb logcat -s ReactNativeJS` and the Metro terminal
  // when the app is connected. If you place the widget and NEVER see
  // "widget task:" here, the headless task is not booting at all.
  console.log("[widget] task:", widgetAction, widgetInfo?.widgetName);
  if (widgetAction === "WIDGET_DELETED") return;
  // Always render something — even a missing snapshot shows the branded
  // placeholder so the widget never appears blank.
  try {
    const snapshot = await readWidgetSnapshot();
    console.log("[widget] snapshot:", snapshot ? "loaded" : "none");
    renderWidget(<AdivWidget snapshot={snapshot} />);
  } catch (error) {
    console.warn("[widget] render failed:", error instanceof Error ? error.message : error);
    renderWidget(<AdivWidget snapshot={null} />);
  }
});
