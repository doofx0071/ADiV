/**
 * Android widget task handler — renders the widget whenever Android adds,
 * updates, resizes, or clicks it. Registered from the root layout (native
 * only). The widget data comes from the AsyncStorage snapshot the app keeps
 * fresh in components/widget-sync.tsx.
 */
import { registerWidgetTaskHandler } from "react-native-android-widget";
import { AdivWidget, readWidgetSnapshot } from "./adiv-widget";

registerWidgetTaskHandler(async ({ widgetAction, renderWidget }) => {
  if (widgetAction === "WIDGET_DELETED") return;
  // Always render something — even a missing snapshot shows the branded
  // placeholder so the widget never appears blank.
  try {
    const snapshot = await readWidgetSnapshot();
    renderWidget(<AdivWidget snapshot={snapshot} />);
  } catch {
    renderWidget(<AdivWidget snapshot={null} />);
  }
});
