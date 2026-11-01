/**
 * Native: asks Android to re-render every placed AdivWidget with the fresh
 * snapshot (the headless task handler draws it). Called by WidgetSync after
 * each data sync so the home-screen widget tracks the app.
 */
import { requestWidgetUpdate } from "react-native-android-widget";
import { AdivWidget, type WidgetSnapshot } from "./adiv-widget";

export const WIDGET_NAME = "AdivWidget";

export async function pushWidgetUpdate(snapshot: WidgetSnapshot): Promise<void> {
  try {
    await requestWidgetUpdate({
      widgetName: WIDGET_NAME,
      renderWidget: () => <AdivWidget snapshot={snapshot} />,
    });
  } catch {
    // No widget placed, or the headless render failed - harmless.
  }
}
