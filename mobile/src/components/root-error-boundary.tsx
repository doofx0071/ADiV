/**
 * Top-level safety net: if a screen render throws (e.g. the app bundle is
 * newer than the deployed Convex functions and a query fails server-side),
 * show a recovery screen instead of closing the app.
 */
import React from "react";
import { Pressable, View } from "react-native";
import { AppText as Text } from "@/components/app-text";
import { useAppTheme } from "@/lib/theme";
import { AppButton } from "@/components/ui";

interface State {
  error: Error | null;
}

export class RootErrorBoundary extends React.Component<
  React.PropsWithChildren,
  State
> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.warn("Render error caught at root:", error.message);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return <ErrorFallback message={error.message} onRetry={() => this.setState({ error: null })} />;
  }
}

function ErrorFallback({ message, onRetry }: { message: string; onRetry: () => void }) {
  const { colors } = useAppTheme();
  return (
    <View style={{ flex: 1, backgroundColor: colors.background, padding: 24, justifyContent: "center", gap: 12 }}>
      <Text style={{ color: colors.primary, fontSize: 12, fontWeight: "900", letterSpacing: 1.4 }}>ADIV</Text>
      <Text style={{ color: colors.foreground, fontSize: 22, fontWeight: "900" }}>Something went wrong</Text>
      <Text style={{ color: colors.mutedForeground, fontSize: 14, lineHeight: 21 }}>
        The app could not load this screen. If the problem persists, update the app or check your
        connection.
      </Text>
      <Text style={{ color: colors.mutedForeground, fontSize: 11 }} numberOfLines={4}>
        {message}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Try again"
        onPress={onRetry}
        style={{ marginTop: 8 }}
      >
        <AppButton label="Try again" onPress={onRetry} />
      </Pressable>
    </View>
  );
}
