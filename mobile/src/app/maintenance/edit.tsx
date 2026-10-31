import { useState } from "react";
import { AppText as Text } from "@/components/app-text";
import { router, useLocalSearchParams } from "expo-router";
import { useMutation, useQuery } from "convex/react";
import { api, type Id } from "@/lib/api";
import { AppButton, Card, Field, LoadingState, Page } from "@/components/ui";
import { numberOrUndefined } from "@/lib/format";
import { useAppTheme } from "@/lib/theme";

type ScheduleForm = { name: string; category: string; intervalKm: string; intervalMonths: string; intervalSource: string; description: string; serviceLevel: string; notes: string };
const emptyForm: ScheduleForm = { name: "", category: "engine", intervalKm: "", intervalMonths: "", intervalSource: "", description: "", serviceLevel: "", notes: "" };

export default function EditMaintenanceScreen() {
  const { itemId: itemIdParam } = useLocalSearchParams<{ itemId?: string }>();
  const itemId = itemIdParam as Id<"maintenanceItems"> | undefined;
  const items = useQuery(api.maintenance.getMaintenanceItems);
  const createItem = useMutation(api.maintenance.createMaintenanceItem);
  const updateItem = useMutation(api.maintenance.updateMaintenanceItem);
  const [draft, setDraft] = useState<ScheduleForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const { colors } = useAppTheme();
  const item = itemId ? items?.find((candidate) => candidate._id === itemId) : undefined;

  const savedForm: ScheduleForm = item ? { name: item.name, category: item.category, intervalKm: item.intervalKm?.toString() ?? "", intervalMonths: item.intervalMonths?.toString() ?? "", intervalSource: item.intervalSource ?? "", description: item.description ?? "", serviceLevel: item.serviceLevel ?? "", notes: item.notes ?? "" } : emptyForm;
  const form = draft ?? savedForm;

  const set = (key: keyof ScheduleForm) => (value: string) => setDraft((current) => ({ ...(current ?? savedForm), [key]: value }));

  async function save() {
    setError("");
    if (!form.name.trim() || !form.category.trim()) { setError("Name and category are required."); return; }
    const intervalKm = numberOrUndefined(form.intervalKm);
    const intervalMonths = numberOrUndefined(form.intervalMonths);
    if (intervalKm !== undefined && (!Number.isInteger(intervalKm) || intervalKm <= 0)) { setError("Enter a positive whole-number km interval, or leave it blank."); return; }
    if (intervalMonths !== undefined && (!Number.isInteger(intervalMonths) || intervalMonths <= 0)) { setError("Enter a positive whole-number month interval, or leave it blank."); return; }

    setSaving(true);
    try {
      const values = {
        name: form.name.trim(), category: form.category.trim(), intervalKm, intervalMonths,
        intervalSource: form.intervalSource.trim() || undefined, description: form.description.trim() || undefined,
        serviceLevel: form.serviceLevel.trim() || undefined, notes: form.notes.trim() || undefined,
      };
      if (itemId) await updateItem({ itemId, ...values }); else await createItem(values);
      router.back();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save this schedule item.");
    } finally { setSaving(false); }
  }

  if (items === undefined || (itemId && !item)) return <Page back><LoadingState label="Loading schedule…" /></Page>;

  return (
    <Page back eyebrow="Maintenance schedule" title={itemId ? "Edit schedule" : "New schedule item"} subtitle="Km and month intervals are independent. Leaving one blank disables only that reminder dimension.">
      <Card>
        <Field label="Item name *" value={form.name} onChangeText={set("name")} placeholder="Engine oil" />
        <Field label="Category *" value={form.category} onChangeText={set("category")} placeholder="engine" autoCapitalize="none" />
        <Field label="Repeat every (km)" value={form.intervalKm} onChangeText={set("intervalKm")} keyboardType="number-pad" placeholder="Leave blank if not used" />
        <Field label="Repeat every (months)" value={form.intervalMonths} onChangeText={set("intervalMonths")} keyboardType="number-pad" placeholder="Leave blank if not used" />
        <Field label="Interval source / note" value={form.intervalSource} onChangeText={set("intervalSource")} multiline numberOfLines={3} placeholder="Manual page, dealer guidance, or your own choice" />
        <Field label="Description" value={form.description} onChangeText={set("description")} multiline numberOfLines={3} />
        <Field label="Service level" value={form.serviceLevel} onChangeText={set("serviceLevel")} placeholder="Inspect, replace, adjust…" />
        <Field label="Notes" value={form.notes} onChangeText={set("notes")} multiline numberOfLines={3} />
        {error ? <Text style={{ color: colors.danger, lineHeight: 19 }}>{error}</Text> : null}
        <AppButton label={saving ? "Saving…" : "Save schedule"} onPress={() => void save()} busy={saving} />
      </Card>
    </Page>
  );
}
