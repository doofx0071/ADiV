import { useEffect } from "react";
import { ConvexProvider } from "convex/react";
import { Stack, router, useGlobalSearchParams, useSegments } from "expo-router";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import {
  Geist_400Regular,
  Geist_500Medium,
  Geist_600SemiBold,
  Geist_700Bold,
  Geist_800ExtraBold,
  Geist_900Black,
} from "@expo-google-fonts/geist";
import { Platform, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { AppText as Text } from "@/components/app-text";
import { BrandHeader } from "@/components/brand-header";
import { AppThemeProvider, useAppTheme } from "@/lib/theme";
import { convexClient } from "@/lib/convex";
import { configureNotificationHandler, subscribeToMaintenanceNotification } from "@/lib/notification-api";
import { NotificationSync } from "@/components/notification-sync";
import { WidgetSync } from "@/components/widget-sync";
import { RideSyncManager } from "@/components/ride-sync-manager";
import { RootErrorBoundary } from "@/components/root-error-boundary";
import "@/widgets/widget-task-handler";

configureNotificationHandler();

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

function ConfigRequired() {
  const { colors, resolved } = useAppTheme();
  return (
    <View style={{ flex: 1, padding: 28, justifyContent: "center", gap: 12, backgroundColor: colors.background }}>
      <StatusBar style={resolved === "dark" ? "light" : "dark"} />
      <Text style={{ color: colors.primary, fontSize: 12, fontWeight: "900", letterSpacing: 1.4 }}>ADIV MOBILE</Text>
      <Text style={{ color: colors.foreground, fontSize: 26, fontWeight: "900" }}>Connect your Convex deployment</Text>
      <Text style={{ color: colors.mutedForeground, fontSize: 15, lineHeight: 22 }}>
        Set EXPO_PUBLIC_CONVEX_URL in mobile/.env.local for local development or in the EAS build environment.
      </Text>
    </View>
  );
}

function Navigator() {
  const { resolved } = useAppTheme();
  const segments = useSegments();
  const routeParams = useGlobalSearchParams<{ mode?: string; fullscreen?: string; rideId?: string }>();
  // The brand header is persistent: pages transition beneath it instead of
  // carrying it. Setup is the one screen that runs headerless.
  const isSetup = segments[segments.length - 1] === "setup";
  const isNavigationRecord = segments[segments.length - 1] === "record" && routeParams.mode === "navigateAndRecord";
  const isImmersiveRecord = segments[segments.length - 1] === "record" && routeParams.fullscreen === "true";
  const isActivityShare = Boolean(routeParams.rideId);

  useEffect(() => {
    const subscription = subscribeToMaintenanceNotification(() => router.push("/(tabs)/maintenance"));
    return () => subscription.remove();
  }, []);

  return (
    <>
      <StatusBar style={resolved === "dark" ? "light" : "dark"} />
      {!isActivityShare && Platform.OS !== "web" ? <NotificationSync /> : null}
      {!isActivityShare && Platform.OS !== "web" ? <WidgetSync /> : null}
      {!isActivityShare && Platform.OS !== "web" ? <RideSyncManager /> : null}
      <SafeAreaView
        edges={["top"]}
        style={{ flex: 1, backgroundColor: resolved === "dark" ? "#0a0a0f" : "#f8fafc" }}
      >
        {!isSetup && !isNavigationRecord && !isImmersiveRecord && !isActivityShare && Platform.OS !== "web" ? <BrandHeader /> : null}
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: resolved === "dark" ? "#0a0a0f" : "#f8fafc" } }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="setup" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="maintenance/[id]" />
          <Stack.Screen name="maintenance/edit" />
          <Stack.Screen name="log/[type]" />
          <Stack.Screen name="history/edit" />
          <Stack.Screen name="expenses" />
          <Stack.Screen name="record" />
          <Stack.Screen name="share/[rideId]" />
          <Stack.Screen name="gallery" />
          <Stack.Screen name="achievements" />
          <Stack.Screen name="export" />
          <Stack.Screen name="offline-packs" />
          <Stack.Screen name="usage" />
        </Stack>
      </SafeAreaView>
    </>
  );
}

function Runtime() {
  if (!convexClient) return <ConfigRequired />;
  return (
    <ConvexProvider client={convexClient}>
      <RootErrorBoundary>
        <Navigator />
      </RootErrorBoundary>
    </ConvexProvider>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Geist_400Regular,
    Geist_500Medium,
    Geist_600SemiBold,
    Geist_700Bold,
    Geist_800ExtraBold,
    Geist_900Black,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) void SplashScreen.hideAsync();
  }, [fontError, fontsLoaded]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AppThemeProvider><Runtime /></AppThemeProvider>
    </GestureHandlerRootView>
  );
}
