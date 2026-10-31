import { useEffect } from "react";
import { ConvexProvider } from "convex/react";
import { Stack, router } from "expo-router";
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
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { AppText as Text } from "@/components/app-text";
import { AppThemeProvider, useAppTheme } from "@/lib/theme";
import { convexClient } from "@/lib/convex";
import { configureNotificationHandler, subscribeToMaintenanceNotification } from "@/lib/notification-api";
import { NotificationSync } from "@/components/notification-sync";

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
  useEffect(() => {
    const subscription = subscribeToMaintenanceNotification(() => router.push("/(tabs)/maintenance"));
    return () => subscription.remove();
  }, []);

  return (
    <>
      <StatusBar style={resolved === "dark" ? "light" : "dark"} />
      {Platform.OS !== "web" ? <NotificationSync /> : null}
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: resolved === "dark" ? "#0a0a0f" : "#f8fafc" } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="setup" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="maintenance/[id]" />
        <Stack.Screen name="maintenance/edit" />
        <Stack.Screen name="log/[type]" />
        <Stack.Screen name="history/edit" />
        <Stack.Screen name="rides" />
        <Stack.Screen name="gallery" />
        <Stack.Screen name="achievements" />
        <Stack.Screen name="export" />
      </Stack>
    </>
  );
}

function Runtime() {
  if (!convexClient) return <ConfigRequired />;
  return <ConvexProvider client={convexClient}><Navigator /></ConvexProvider>;
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
