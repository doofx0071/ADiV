import { ArrowLeft, LoaderCircle } from "lucide-react-native";
import { router } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  type TextInputProps,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppText as Text } from "@/components/app-text";
import { BrandHeader } from "@/components/brand-header";
import { useAppTheme, type AppColors } from "@/lib/theme";

export function Page({
  title,
  subtitle,
  eyebrow,
  children,
  scroll = true,
  back = false,
  right,
  showBrandHeader = true,
}: React.PropsWithChildren<{
  title?: string;
  subtitle?: string;
  eyebrow?: string;
  scroll?: boolean;
  back?: boolean;
  right?: React.ReactNode;
  showBrandHeader?: boolean;
}>) {
  const { colors } = useAppTheme();
  const body = (
    <View style={styles.pageContent}>
      {(title || back || right) && (
        <View style={styles.headerRow}>
          {back && (
            <Pressable
              onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)"))}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              style={[styles.backButton, { backgroundColor: colors.secondary }]}
            >
              <ArrowLeft size={20} color={colors.foreground} />
            </Pressable>
          )}
          <View style={styles.titleBlock}>
            {eyebrow ? <Text style={[styles.eyebrow, { color: colors.primary }]}>{eyebrow}</Text> : null}
            {title ? <Text style={[styles.pageTitle, { color: colors.foreground }]}>{title}</Text> : null}
            {subtitle ? <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>{subtitle}</Text> : null}
          </View>
          {right}
        </View>
      )}
      {children}
    </View>
  );

  return (
    <SafeAreaView edges={["top"]} style={[styles.safeArea, { backgroundColor: colors.background }]}>
      {showBrandHeader ? <BrandHeader /> : null}
      {scroll ? (
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {body}
        </ScrollView>
      ) : (
        body
      )}
    </SafeAreaView>
  );
}

export function Card({ children, style }: React.PropsWithChildren<{ style?: object }>) {
  const { colors } = useAppTheme();
  return <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, style]}>{children}</View>;
}

export function AppButton({
  label,
  onPress,
  variant = "primary",
  disabled = false,
  busy = false,
  icon,
  compact = false,
}: {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "outline" | "danger" | "ghost";
  disabled?: boolean;
  busy?: boolean;
  icon?: React.ReactNode;
  compact?: boolean;
}) {
  const { colors } = useAppTheme();
  const background = variant === "primary" ? colors.primary : variant === "danger" ? colors.danger : variant === "secondary" ? colors.secondary : "transparent";
  const foreground = variant === "primary" || variant === "danger" ? "#ffffff" : colors.foreground;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        compact && styles.buttonCompact,
        { backgroundColor: background, borderColor: colors.border, opacity: disabled ? 0.5 : pressed ? 0.82 : 1 },
        variant === "outline" && styles.outlineButton,
        variant === "ghost" && styles.ghostButton,
      ]}
    >
      {busy ? <ActivityIndicator color={foreground} /> : icon}
      <Text style={[styles.buttonText, { color: foreground }]}>{label}</Text>
    </Pressable>
  );
}

export function Field({ label, error, helper, style, ...props }: TextInputProps & { label: string; error?: string; helper?: string }) {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.fieldWrap, style]}>
      <Text style={[styles.fieldLabel, { color: colors.foreground }]}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.mutedForeground}
        accessibilityLabel={label}
        style={[styles.input, { backgroundColor: colors.card, borderColor: error ? colors.danger : colors.border, color: colors.foreground }]}
        {...props}
      />
      {error ? <Text style={[styles.helper, { color: colors.danger }]}>{error}</Text> : helper ? <Text style={[styles.helper, { color: colors.mutedForeground }]}>{helper}</Text> : null}
    </View>
  );
}

export function ChoiceRow<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.choiceRow}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected }}
            key={option.value}
            onPress={() => onChange(option.value)}
            style={[styles.choice, { backgroundColor: selected ? colors.primary : colors.secondary, borderColor: selected ? colors.primary : colors.border }]}
          >
            <Text style={{ color: selected ? "#fff" : colors.foreground, fontWeight: "700", fontSize: 13 }}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  const { colors } = useAppTheme();
  return (
    <Card style={styles.emptyCard}>
      <Text style={[styles.emptyTitle, { color: colors.foreground }]}>{title}</Text>
      <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>{body}</Text>
      {action}
    </Card>
  );
}

export function LoadingState({ label = "Loading your bike data…" }: { label?: string }) {
  const { colors } = useAppTheme();
  return <View style={styles.loading}><LoaderCircle size={24} color={colors.primary} /><Text style={{ color: colors.mutedForeground }}>{label}</Text></View>;
}

export function ErrorText({ children }: React.PropsWithChildren) {
  const { colors } = useAppTheme();
  return <Text style={{ color: colors.danger, fontSize: 14, lineHeight: 20 }}>{children}</Text>;
}

export function SectionTitle({ title, action }: { title: string; action?: React.ReactNode }) {
  const { colors } = useAppTheme();
  return <View style={styles.sectionRow}><Text style={[styles.sectionTitle, { color: colors.foreground }]}>{title}</Text>{action}</View>;
}

export function StatCard({ label, value, detail }: { label: string; value: string; detail?: string }) {
  const { colors } = useAppTheme();
  return <Card style={styles.statCard}><Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{label}</Text><Text style={[styles.statValue, { color: colors.foreground }]}>{value}</Text>{detail ? <Text style={[styles.statDetail, { color: colors.mutedForeground }]}>{detail}</Text> : null}</Card>;
}

export function Banner({ title, body, tone = "warning" }: { title: string; body: string; tone?: "warning" | "success" }) {
  const { colors } = useAppTheme();
  const toneColor = tone === "success" ? colors.success : colors.warning;
  return <View style={[styles.banner, { borderColor: toneColor, backgroundColor: `${toneColor}12` }]}><Text style={[styles.bannerTitle, { color: toneColor }]}>{title}</Text><Text style={[styles.bannerBody, { color: colors.foreground }]}>{body}</Text></View>;
}

export function colorsForStatus(colors: AppColors, status: string) {
  switch (status) {
    case "overdue": return colors.danger;
    case "due": return colors.warning;
    case "upcoming": return colors.success;
    case "needs-history": return colors.primary;
    default: return colors.mutedForeground;
  }
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  scrollContent: { paddingBottom: 28 },
  pageContent: { paddingHorizontal: 18, paddingTop: 10, gap: 16 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 54 },
  backButton: { width: 42, height: 42, borderRadius: 0, alignItems: "center", justifyContent: "center" },
  titleBlock: { flex: 1, gap: 3 },
  eyebrow: { fontSize: 11, fontWeight: "800", letterSpacing: 1.3, textTransform: "uppercase" },
  pageTitle: { fontSize: 26, fontWeight: "900", letterSpacing: -0.7 },
  subtitle: { fontSize: 14, lineHeight: 20 },
  card: { borderWidth: 1, borderRadius: 0, padding: 16, gap: 12 },
  button: { minHeight: 48, borderRadius: 0, borderWidth: 1, paddingHorizontal: 16, flexDirection: "row", gap: 9, alignItems: "center", justifyContent: "center" },
  buttonCompact: { minHeight: 40, paddingHorizontal: 13, borderRadius: 0 },
  outlineButton: { borderWidth: 1 },
  ghostButton: { borderWidth: 0 },
  buttonText: { fontSize: 14, fontWeight: "800" },
  fieldWrap: { gap: 7 },
  fieldLabel: { fontSize: 13, fontWeight: "700" },
  input: { minHeight: 49, borderWidth: 1, borderRadius: 0, paddingHorizontal: 13, fontSize: 15, fontFamily: "Geist_400Regular" },
  helper: { fontSize: 12, lineHeight: 17 },
  choiceRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  choice: { minHeight: 39, paddingHorizontal: 13, borderRadius: 0, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  emptyCard: { alignItems: "flex-start", paddingVertical: 20 },
  emptyTitle: { fontSize: 17, fontWeight: "800" },
  loading: { minHeight: 120, flexDirection: "row", gap: 12, alignItems: "center", justifyContent: "center" },
  sectionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionTitle: { fontSize: 18, fontWeight: "900" },
  statCard: { flexGrow: 1, flexBasis: "46%", minHeight: 106, justifyContent: "center" },
  statLabel: { fontSize: 12, fontWeight: "700" },
  statValue: { fontSize: 24, fontWeight: "900", letterSpacing: -0.5 },
  statDetail: { fontSize: 12 },
  banner: { borderWidth: 1, borderRadius: 0, padding: 14, gap: 4 },
  bannerTitle: { fontWeight: "900", fontSize: 14 },
  bannerBody: { fontSize: 13, lineHeight: 19 },
});
