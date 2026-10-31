import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { AppText as Text } from "@/components/app-text";
import { router } from "expo-router";
import { ChevronRight, Download, Images, Medal, Moon, Route, Sun, Wrench } from "lucide-react-native";
import { useAppTheme, type ThemeMode } from "@/lib/theme";
import { AppButton, Card, ChoiceRow, Page } from "@/components/ui";
import { TimeField } from "@/components/date-field";
import { DEFAULT_REMINDER_SETTINGS, disableReminder, enableReminderAt, getReminderSettings, type ReminderSettings, updateReminderSettings } from "@/lib/notifications";

const themeOptions: { value: ThemeMode; label: string }[] = [
  { value: "system", label: "System" }, { value: "light", label: "Light" }, { value: "dark", label: "Dark" },
];

function MenuLink({ icon, title, detail, onPress }: { icon: React.ReactNode; title: string; detail: string; onPress: () => void }) {
  const { colors } = useAppTheme();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={{ minHeight: 63, flexDirection: "row", alignItems: "center", gap: 12 }}>
      <View style={{ width: 40, height: 40, borderRadius: 0, alignItems: "center", justifyContent: "center", backgroundColor: `${colors.primary}12` }}>{icon}</View>
      <View style={{ flex: 1, gap: 3 }}><Text style={{ color: colors.foreground, fontWeight: "800", fontSize: 15 }}>{title}</Text><Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{detail}</Text></View>
      <ChevronRight size={18} color={colors.mutedForeground} />
    </Pressable>
  );
}

export default function MoreScreen() {
  const { colors, mode, setMode } = useAppTheme();
  const [reminder, setReminder] = useState<ReminderSettings>(DEFAULT_REMINDER_SETTINGS);
  const [savingReminder, setSavingReminder] = useState(false);
  const [reminderError, setReminderError] = useState("");

  useEffect(() => { void getReminderSettings().then(setReminder); }, []);

  const pickerDate = new Date();
  pickerDate.setHours(reminder.hour, reminder.minute, 0, 0);
  async function saveReminderTime(date: Date) {
    const next = { ...reminder, hour: date.getHours(), minute: date.getMinutes() };
    setReminder(next);
    if (!next.enabled) { await updateReminderSettings(next); return; }
    setSavingReminder(true);
    setReminderError("");
    try {
      const granted = await enableReminderAt(next.hour, next.minute);
      if (!granted) setReminderError("Allow notifications in Android settings to enable reminders.");
    } finally { setSavingReminder(false); }
  }

  async function toggleReminder() {
    setReminderError("");
    setSavingReminder(true);
    try {
      if (reminder.enabled) {
        await disableReminder();
        setReminder((current) => ({ ...current, enabled: false }));
      } else {
        const granted = await enableReminderAt(reminder.hour, reminder.minute);
        if (!granted) {
          setReminderError("Notification permission was not granted. You can enable it in Android settings.");
          return;
        }
        setReminder((current) => ({ ...current, enabled: true }));
      }
    } catch (error) {
      setReminderError(error instanceof Error ? error.message : "Could not update reminder settings.");
    } finally { setSavingReminder(false); }
  }

  return (
    <Page eyebrow="Personalize your garage" title="More" subtitle="Settings and tools for your AdiV account on this device.">
      <Card>
        <View style={{ flexDirection: "row", gap: 9, alignItems: "center" }}><Sun size={18} color={colors.primary} /><Text style={{ color: colors.foreground, fontSize: 16, fontWeight: "900" }}>Appearance</Text></View>
        <ChoiceRow value={mode} options={themeOptions} onChange={setMode} />
        <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>Your choice is saved on this device. System follows Android appearance.</Text>
      </Card>

      <Card>
        <View style={{ flexDirection: "row", gap: 9, alignItems: "center" }}><Moon size={18} color={colors.primary} /><Text style={{ color: colors.foreground, fontSize: 16, fontWeight: "900" }}>Daily maintenance reminder</Text></View>
        <Text style={{ color: colors.mutedForeground, fontSize: 13, lineHeight: 19 }}>A private local reminder on this phone. The schedule refreshes from Convex when the app opens or saved data changes.</Text>
        <TimeField label="Reminder time" value={pickerDate} onChange={(date) => void saveReminderTime(date)} />
        {reminderError ? <Text style={{ color: colors.danger, fontSize: 13, lineHeight: 19 }}>{reminderError}</Text> : null}
        <AppButton label={savingReminder ? "Updating…" : reminder.enabled ? "Turn reminders off" : "Turn reminders on"} onPress={() => void toggleReminder()} busy={savingReminder} variant={reminder.enabled ? "secondary" : "primary"} />
      </Card>

      <Card>
        <MenuLink icon={<Route size={19} color={colors.primary} />} title="Rides" detail="Review, edit, and remove ride logs" onPress={() => router.push("/rides")} />
        <View style={{ height: 1, backgroundColor: colors.border }} />
        <MenuLink icon={<Wrench size={19} color={colors.primary} />} title="Maintenance schedule" detail="Edit intervals, sources, and service details" onPress={() => router.push("/(tabs)/maintenance")} />
        <View style={{ height: 1, backgroundColor: colors.border }} />
        <MenuLink icon={<Images size={19} color={colors.primary} />} title="Service gallery" detail="Photos attached to maintenance logs" onPress={() => router.push("/gallery")} />
        <View style={{ height: 1, backgroundColor: colors.border }} />
        <MenuLink icon={<Medal size={19} color={colors.primary} />} title="Achievements" detail="See your unlocked riding milestones" onPress={() => router.push("/achievements")} />
        <View style={{ height: 1, backgroundColor: colors.border }} />
        <MenuLink icon={<Download size={19} color={colors.primary} />} title="Export records" detail="Share a JSON backup or CSV file" onPress={() => router.push("/export")} />
      </Card>

      <Card>
        <Text style={{ color: colors.foreground, fontSize: 15, fontWeight: "900" }}>Connected garage</Text>
        <Text style={{ color: colors.mutedForeground, lineHeight: 19, fontSize: 13 }}>The Android app and web app use the same Convex data. An internet connection is required to load or save records.</Text>
        <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>Single bike · No sign-in · PHP · Kilometers</Text>
      </Card>
    </Page>
  );
}
