import { useMemo, useState } from "react";
import { View } from "react-native";
import { AppText as Text } from "@/components/app-text";
import { router, useLocalSearchParams } from "expo-router";
import { useMutation, useQuery } from "convex/react";
import { api, type Doc, type Id } from "@/lib/api";
import { AppButton, Card, Field, LoadingState, Page } from "@/components/ui";
import { DateField, TimeField } from "@/components/date-field";
import { buildRideInterval, dateStartMs, numberOrUndefined, rideDurationLabel } from "@/lib/format";
import { useAppTheme } from "@/lib/theme";

type EntryType = "ride" | "fuel" | "maintenance" | "expense";
const categories = ["Parts", "Accessories", "Insurance", "Parking", "Tolls", "Cleaning", "Tools", "Other"];

export default function EditHistoryScreen() {
  const { type: typeParam, id } = useLocalSearchParams<{ type: string; id: string }>();
  const type = typeParam as EntryType;
  const rides = useQuery(api.rides.getRides, type === "ride" ? { limit: 1000 } : "skip");
  const fuelLogs = useQuery(api.fuel.getFuelLogs, type === "fuel" ? { limit: 1000 } : "skip");
  const maintenanceLogs = useQuery(api.maintenance.getAllMaintenanceLogs, type === "maintenance" ? { limit: 1000 } : "skip");
  const expenses = useQuery(api.expenses.getExpenses, type === "expense" ? { limit: 1000 } : "skip");
  const updateRide = useMutation(api.rides.updateRide);
  const updateFuel = useMutation(api.fuel.updateFuelLog);
  const updateMaintenance = useMutation(api.maintenance.updateMaintenanceLog);
  const updateExpense = useMutation(api.expenses.updateExpense);
  const [notes, setNotes] = useState<string | null>(null);
  const [rideDate, setRideDate] = useState<Date | null>(null);
  const [startOdometer, setStartOdometer] = useState<string | null>(null);
  const [endOdometer, setEndOdometer] = useState<string | null>(null);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [endTime, setEndTime] = useState<Date | null>(null);
  const [stationName, setStationName] = useState<string | null>(null);
  const [cost, setCost] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [amount, setAmount] = useState<string | null>(null);
  const [description, setDescription] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const { colors } = useAppTheme();

  const record = useMemo(() => {
    if (type === "ride") return rides?.find((row) => row._id === id);
    if (type === "fuel") return fuelLogs?.find((row) => row._id === id);
    if (type === "maintenance") return maintenanceLogs?.find((row) => row._id === id);
    if (type === "expense") return expenses?.find((row) => row._id === id);
    return undefined;
  }, [type, id, rides, fuelLogs, maintenanceLogs, expenses]);
  const loaded = type === "ride" ? rides !== undefined : type === "fuel" ? fuelLogs !== undefined : type === "maintenance" ? maintenanceLogs !== undefined : type === "expense" ? expenses !== undefined : true;
  const rideRecord = type === "ride" && record && "startOdometer" in record ? record as Doc<"rides"> : undefined;

  if (!loaded) return <Page back><LoadingState label="Loading log…" /></Page>;
  if (!record || (type !== "ride" && type !== "fuel" && type !== "maintenance" && type !== "expense")) return <Page back title="Edit log"><Text style={{ color: colors.mutedForeground }}>This log could not be found.</Text></Page>;

  async function save() {
    setError("");
    setSaving(true);
    try {
      if (type === "ride") {
        if (!rideRecord) throw new Error("This ride could not be found.");
        const nextStartOdometer = numberOrUndefined(startOdometer ?? String(rideRecord.startOdometer));
        const nextEndOdometer = numberOrUndefined(endOdometer ?? String(rideRecord.endOdometer));
        if (nextStartOdometer === undefined || nextEndOdometer === undefined || !Number.isFinite(nextStartOdometer) || !Number.isFinite(nextEndOdometer) || nextStartOdometer < 0 || nextEndOdometer < 0) {
          throw new Error("Enter valid non-negative odometer readings.");
        }
        if (nextEndOdometer < nextStartOdometer) throw new Error("End odometer cannot be less than start odometer.");

        const nextDate = rideDate ?? new Date(rideRecord.date);
        if (dateStartMs(nextDate) > Date.now()) throw new Error("Ride date cannot be in the future.");
        const nextStartTime = startTime ?? (rideRecord.startAt !== undefined ? new Date(rideRecord.startAt) : null);
        const nextEndTime = endTime ?? (rideRecord.endAt !== undefined ? new Date(rideRecord.endAt) : null);
        let interval: ReturnType<typeof buildRideInterval> | undefined;
        if (nextStartTime || nextEndTime) {
          if (!nextStartTime || !nextEndTime) throw new Error("Choose both start and end times, or leave both blank to keep the saved duration.");
          interval = buildRideInterval(nextDate, nextStartTime, nextEndTime);
          if (interval.endAt > Date.now()) throw new Error("Ride end time cannot be in the future.");
        }

        await updateRide({
          rideId: id as Id<"rides">,
          startOdometer: nextStartOdometer,
          endOdometer: nextEndOdometer,
          date: dateStartMs(nextDate),
          ...(interval ? { startAt: interval.startAt, endAt: interval.endAt } : {}),
          notes: notes === null ? undefined : notes.trim() || null,
        });
      } else if (type === "fuel") {
        if (stationName !== null || notes !== null) await updateFuel({ fuelLogId: id as Id<"fuelLogs">, stationName: stationName === null ? undefined : stationName.trim() || undefined, notes: notes === null ? undefined : notes.trim() || undefined });
      } else if (type === "maintenance") {
        const nextCost = cost === null ? undefined : numberOrUndefined(cost);
        if (cost !== null && nextCost !== undefined && nextCost < 0) throw new Error("Cost cannot be negative.");
        if (cost !== null || notes !== null) await updateMaintenance({ logId: id as Id<"maintenanceLogs">, cost: nextCost, notes: notes === null ? undefined : notes.trim() || undefined });
      } else {
        const nextAmount = amount === null ? undefined : numberOrUndefined(amount);
        if (amount !== null && (nextAmount === undefined || nextAmount <= 0)) throw new Error("Amount must be greater than zero.");
        if (category !== null || amount !== null || description !== null) await updateExpense({ expenseId: id as Id<"expenses">, category: category ?? undefined, amount: nextAmount, description: description === null ? undefined : description.trim() || undefined });
      }
      router.back();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not update this log.");
    } finally { setSaving(false); }
  }

  const notesValue = notes ?? ("notes" in record ? record.notes ?? "" : "");
  const title = type === "ride" ? "Edit ride" : type === "fuel" ? "Edit fuel details" : type === "maintenance" ? "Edit service details" : "Edit expense";
  return (
    <Page back eyebrow="History" title={title} subtitle={type === "ride" ? "Update the ride date, odometer, times, or notes." : "Log dates and odometer readings stay fixed to protect the record."}>
      <Card>
        {type === "ride" && rideRecord ? <>
          <DateField label="Ride date *" value={rideDate ?? new Date(rideRecord.date)} onChange={setRideDate} maximumDate={new Date()} />
          <Field label="Start odometer (km) *" value={startOdometer ?? String(rideRecord.startOdometer)} onChangeText={setStartOdometer} keyboardType="decimal-pad" />
          <Field label="End odometer (km) *" value={endOdometer ?? String(rideRecord.endOdometer)} onChangeText={setEndOdometer} keyboardType="decimal-pad" />
          <TimeField label="Start time" value={startTime ?? (rideRecord.startAt !== undefined ? new Date(rideRecord.startAt) : null)} onChange={setStartTime} />
          <TimeField label="End time" value={endTime ?? (rideRecord.endAt !== undefined ? new Date(rideRecord.endAt) : null)} onChange={setEndTime} />
          {rideRecord.startAt === undefined || rideRecord.endAt === undefined ? <Text style={{ color: colors.mutedForeground, fontSize: 12, lineHeight: 18 }}>This older ride has no saved clock times. Add both if you know them; otherwise its existing {rideDurationLabel(rideRecord.durationMinutes)} duration is preserved.</Text> : null}
          <Field label="Notes" value={notesValue} onChangeText={setNotes} multiline numberOfLines={4} />
        </> : null}
        {type === "fuel" ? <>
          <Field label="Station name" value={stationName ?? (record && "stationName" in record ? record.stationName ?? "" : "")} onChangeText={setStationName} helper="Leave blank to keep the current value." />
          <Field label="Notes" value={notesValue} onChangeText={setNotes} multiline numberOfLines={4} helper="Leave blank to keep the current value." />
        </> : null}
        {type === "maintenance" ? <>
          <Field label="Cost (₱)" value={cost ?? (record && "cost" in record ? record.cost?.toString() ?? "" : "")} onChangeText={setCost} keyboardType="decimal-pad" helper="Leave blank to keep the current value." />
          <Field label="Notes" value={notesValue} onChangeText={setNotes} multiline numberOfLines={4} helper="Leave blank to keep the current value." />
        </> : null}
        {type === "expense" ? <>
          <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "700" }}>Category</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>{categories.map((value) => <AppButton key={value} label={value} onPress={() => setCategory(value)} compact variant={(category ?? (record && "category" in record ? record.category : "")) === value ? "primary" : "outline"} />)}</View>
          <Field label="Amount (₱)" value={amount ?? (record && "amount" in record ? record.amount.toString() : "")} onChangeText={setAmount} keyboardType="decimal-pad" />
          <Field label="Description" value={description ?? (record && "description" in record ? record.description ?? "" : "")} onChangeText={setDescription} multiline numberOfLines={3} helper="Leave blank to keep the current value." />
        </> : null}
        {error ? <Text style={{ color: colors.danger, lineHeight: 19 }}>{error}</Text> : null}
        <AppButton label={saving ? "Saving…" : "Save changes"} onPress={() => void save()} busy={saving} />
      </Card>
    </Page>
  );
}
