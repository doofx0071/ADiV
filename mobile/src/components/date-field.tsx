import { CalendarDays, Clock3 } from "lucide-react-native";
import { useState } from "react";
import { Platform, Pressable, View } from "react-native";
import { AppText as Text } from "@/components/app-text";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useAppTheme } from "@/lib/theme";

export function DateField({ label, value, onChange, maximumDate, helper, optional = false }: {
  label: string;
  value: Date | null;
  onChange: (date: Date | null) => void;
  maximumDate?: Date;
  helper?: string;
  optional?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const { colors } = useAppTheme();
  const handleChange = (_event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS !== "ios") setOpen(false);
    if (selected) onChange(selected);
  };
  return (
    <View style={{ gap: 7 }}>
      <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "700" }}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${value?.toLocaleDateString() ?? "not set"}`}
        onPress={() => setOpen((current) => !current)}
        style={{ minHeight: 49, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, borderRadius: 0, paddingHorizontal: 13, flexDirection: "row", gap: 10, alignItems: "center" }}
      >
        <CalendarDays size={17} color={colors.primary} />
        <Text style={{ color: value ? colors.foreground : colors.mutedForeground, fontSize: 15 }}>{value?.toLocaleDateString() ?? "Not set · tap to choose"}</Text>
      </Pressable>
      {helper ? <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{helper}</Text> : null}
      {open ? <DateTimePicker value={value ?? new Date()} mode="date" display={Platform.OS === "ios" ? "spinner" : "default"} maximumDate={maximumDate} onChange={handleChange} /> : null}
      {optional && value ? <Pressable onPress={() => onChange(null)}><Text style={{ color: colors.mutedForeground, fontWeight: "700", paddingVertical: 3 }}>Clear date</Text></Pressable> : null}
      {open && Platform.OS === "ios" ? <Pressable onPress={() => setOpen(false)}><Text style={{ color: colors.primary, fontWeight: "800", padding: 6 }}>Done</Text></Pressable> : null}
    </View>
  );
}

export function TimeField({ label, value, onChange }: {
  label: string;
  value: Date | null;
  onChange: (date: Date) => void;
}) {
  const [open, setOpen] = useState(false);
  const { colors } = useAppTheme();
  const handleChange = (_event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS !== "ios") setOpen(false);
    if (selected) onChange(selected);
  };
  return (
    <View style={{ gap: 7 }}>
      <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "700" }}>{label}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={`${label}, ${value?.toLocaleTimeString() ?? "not set"}`} onPress={() => setOpen((current) => !current)} style={{ minHeight: 49, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, borderRadius: 0, paddingHorizontal: 13, flexDirection: "row", gap: 10, alignItems: "center" }}>
        <Clock3 size={17} color={colors.primary} />
        <Text style={{ color: value ? colors.foreground : colors.mutedForeground, fontSize: 15 }}>{value?.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) ?? "Not set · tap to choose"}</Text>
      </Pressable>
      {open ? <DateTimePicker value={value ?? new Date()} mode="time" display={Platform.OS === "ios" ? "spinner" : "default"} onChange={handleChange} /> : null}
      {open && Platform.OS === "ios" ? <Pressable onPress={() => setOpen(false)}><Text style={{ color: colors.primary, fontWeight: "800", padding: 6 }}>Done</Text></Pressable> : null}
    </View>
  );
}
