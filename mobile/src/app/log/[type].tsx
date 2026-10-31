import { useMemo, useState } from "react";
import { Image, Pressable, View } from "react-native";
import { AppText as Text } from "@/components/app-text";
import { router, useLocalSearchParams } from "expo-router";
import { useMutation, useQuery } from "convex/react";
import * as ImagePicker from "expo-image-picker";
import { Camera, ImagePlus, X } from "lucide-react-native";
import { api, type Id } from "@/lib/api";
import { AppButton, Card, ChoiceRow, Field, LoadingState, Page } from "@/components/ui";
import { DateField, TimeField } from "@/components/date-field";
import { buildRideInterval, dateStartMs, numberOrUndefined, rideDurationLabel } from "@/lib/format";
import { useAppTheme } from "@/lib/theme";

type LogType = "ride" | "fuel" | "maintenance" | "expense";
type Photo = { uri: string; name: string; type: string; size: number; storageId: Id<"_storage"> };
const expenseCategories = ["Parts", "Accessories", "Insurance", "Parking", "Tolls", "Cleaning", "Tools", "Other"];
const MAX_PHOTOS = 5;
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

export default function LogScreen() {
  const { type: typeParam, itemId: initialItemId, mode } = useLocalSearchParams<{ type: string; itemId?: string; mode?: string }>();
  const type = typeParam as LogType;
  const isTypeValid = type === "ride" || type === "fuel" || type === "maintenance" || type === "expense";
  const isHistory = type === "maintenance" && mode === "history";
  const maintenanceItems = useQuery(api.maintenance.getMaintenanceItems);
  const createUploadUrl = useMutation(api.files.generateUploadUrl);
  const registerFile = useMutation(api.files.registerFile);
  const logRide = useMutation(api.rides.logRide);
  const logFuel = useMutation(api.fuel.logFuel);
  const logMaintenance = useMutation(api.maintenance.logMaintenance);
  const addExpense = useMutation(api.expenses.addExpense);
  const checkAchievements = useMutation(api.achievements.checkAchievements);
  const [date, setDate] = useState<Date | null>(isHistory ? null : new Date());
  const [ride, setRide] = useState({ startOdometer: "", endOdometer: "", startTime: null as Date | null, endTime: null as Date | null, notes: "" });
  const [fuel, setFuel] = useState({ odometer: "", liters: "", pricePerLiter: "", stationName: "", notes: "" });
  const [service, setService] = useState({ itemId: initialItemId ?? "", odometer: "", cost: "", notes: "" });
  const [expense, setExpense] = useState({ category: "", amount: "", description: "" });
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const { colors } = useAppTheme();

  const updateRideText = (key: "startOdometer" | "endOdometer" | "notes") => (value: string) => setRide((current) => ({ ...current, [key]: value }));
  const updateFuel = (key: keyof typeof fuel) => (value: string) => setFuel((current) => ({ ...current, [key]: value }));
  const updateService = (key: keyof typeof service) => (value: string) => setService((current) => ({ ...current, [key]: value }));
  const updateExpense = (key: keyof typeof expense) => (value: string) => setExpense((current) => ({ ...current, [key]: value }));
  const title = type === "ride" ? "Log a ride" : type === "fuel" ? "Log fuel" : type === "maintenance" ? (isHistory ? "Add service history" : "Log service") : "Add expense";
  const rideDurationPreview = useMemo(() => {
    if (!date || !ride.startTime || !ride.endTime) return null;
    try { return rideDurationLabel(buildRideInterval(date, ride.startTime, ride.endTime).durationMinutes); }
    catch { return null; }
  }, [date, ride.startTime, ride.endTime]);

  async function uploadAssets(assets: ImagePicker.ImagePickerAsset[]) {
    const remaining = Math.max(0, MAX_PHOTOS - photos.length);
    if (remaining === 0) { setError(`You can attach up to ${MAX_PHOTOS} photos per service log.`); return; }
    setUploading(true);
    setError("");
    try {
      for (const asset of assets.slice(0, remaining)) {
        const response = await fetch(asset.uri);
        const blob = await response.blob();
        const size = asset.fileSize ?? blob.size;
        if (size > MAX_PHOTO_BYTES) { setError(`${asset.fileName ?? "Photo"} exceeds the 5 MB limit.`); continue; }
        const mime = asset.mimeType ?? "image/jpeg";
        const uploadUrl = await createUploadUrl();
        const upload = await fetch(uploadUrl, { method: "POST", headers: { "Content-Type": mime }, body: blob });
        if (!upload.ok) throw new Error("Photo upload failed. Check your connection and try again.");
        const uploaded = await upload.json() as { storageId: string };
        const filename = asset.fileName ?? `service-${Date.now()}.jpg`;
        setPhotos((current) => [...current, { uri: asset.uri, name: filename, type: mime, size, storageId: uploaded.storageId as Id<"_storage"> }]);
      }
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Could not upload the selected photo.");
    } finally { setUploading(false); }
  }

  async function pickFromLibrary() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsMultipleSelection: true, selectionLimit: Math.max(1, MAX_PHOTOS - photos.length), quality: 0.82 });
    if (!result.canceled) await uploadAssets(result.assets);
  }

  async function capturePhoto() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) { setError("Camera permission is needed to take a service photo."); return; }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.82 });
    if (!result.canceled) await uploadAssets(result.assets);
  }

  async function submit() {
    setError("");
    if (!date) { setError("Choose the confirmed log date."); return; }
    const logDate = dateStartMs(date);
    setSaving(true);
    try {
      if (type === "ride") {
        const startOdometer = numberOrUndefined(ride.startOdometer);
        const endOdometer = numberOrUndefined(ride.endOdometer);
        if (startOdometer === undefined || endOdometer === undefined || !Number.isFinite(startOdometer) || !Number.isFinite(endOdometer) || startOdometer < 0 || endOdometer < 0) throw new Error("Enter valid non-negative start and end odometer readings.");
        if (!ride.startTime || !ride.endTime) throw new Error("Choose the ride start and end times.");
        const interval = buildRideInterval(date, ride.startTime, ride.endTime);
        if (interval.endAt > Date.now()) throw new Error("Ride end time cannot be in the future.");
        if (endOdometer < startOdometer) throw new Error("End odometer cannot be less than start odometer.");
        await logRide({ startOdometer, endOdometer, date: logDate, startAt: interval.startAt, endAt: interval.endAt, notes: ride.notes.trim() || undefined });
      } else if (type === "fuel") {
        const odometer = numberOrUndefined(fuel.odometer);
        const liters = numberOrUndefined(fuel.liters);
        const pricePerLiter = numberOrUndefined(fuel.pricePerLiter);
        if (odometer === undefined || liters === undefined || pricePerLiter === undefined || liters <= 0 || pricePerLiter <= 0) throw new Error("Enter an odometer reading, liters, and a positive price per liter.");
        await logFuel({ odometer, liters, pricePerLiter, date: logDate, stationName: fuel.stationName.trim() || undefined, notes: fuel.notes.trim() || undefined });
      } else if (type === "maintenance") {
        const odometer = numberOrUndefined(service.odometer);
        const cost = numberOrUndefined(service.cost);
        if (!service.itemId) throw new Error("Choose a maintenance schedule item.");
        if (odometer === undefined || odometer < 0) throw new Error("Enter the confirmed service odometer.");
        if (cost !== undefined && cost < 0) throw new Error("Cost cannot be negative.");
        const logId = await logMaintenance({ itemId: service.itemId as Id<"maintenanceItems">, odometer, date: logDate, cost, notes: service.notes.trim() || undefined, photos: photos.length ? photos.map((photo) => photo.storageId) : undefined });
        await Promise.all(photos.map((photo) => registerFile({ storageId: photo.storageId, name: photo.name, type: photo.type, size: photo.size, recordType: "maintenanceLog", recordId: logId })));
      } else if (type === "expense") {
        const amount = numberOrUndefined(expense.amount);
        if (!expense.category) throw new Error("Choose an expense category.");
        if (amount === undefined || amount <= 0) throw new Error("Enter a positive expense amount.");
        await addExpense({ category: expense.category, amount, date: logDate, description: expense.description.trim() || undefined });
      }
      try { await checkAchievements({}); } catch { /* Logging succeeds even if achievements are unavailable. */ }
      router.back();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not save this log.");
    } finally { setSaving(false); }
  }

  if (!isTypeValid) return <Page back title="Log"><Text style={{ color: colors.danger }}>Unknown log type.</Text></Page>;
  if (type === "maintenance" && maintenanceItems === undefined) return <Page back><LoadingState label="Loading schedule…" /></Page>;

  return (
    <Page back eyebrow="Garage log" title={title} subtitle={isHistory ? "Record only a date and odometer you can confirm. Unknown values stay unrecorded." : undefined}>
      <Card>
        {type === "ride" ? <>
          <DateField label="Ride date *" value={date} onChange={setDate} maximumDate={new Date()} />
          <Field label="Start odometer (km) *" value={ride.startOdometer} onChangeText={updateRideText("startOdometer")} keyboardType="decimal-pad" />
          <Field label="End odometer (km) *" value={ride.endOdometer} onChangeText={updateRideText("endOdometer")} keyboardType="decimal-pad" />
          <TimeField label="Start time *" value={ride.startTime} onChange={(startTime) => setRide((current) => ({ ...current, startTime }))} />
          <TimeField label="End time *" value={ride.endTime} onChange={(endTime) => setRide((current) => ({ ...current, endTime }))} />
          <Text style={{ color: colors.mutedForeground, fontSize: 12, lineHeight: 18 }}>Duration is calculated from these times. If the end time is earlier, the ride is recorded as ending the next day.</Text>
          {rideDurationPreview ? <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "800" }}>Calculated duration · {rideDurationPreview}</Text> : null}
          <Field label="Notes" value={ride.notes} onChangeText={updateRideText("notes")} multiline numberOfLines={3} />
        </> : null}

        {type === "fuel" ? <>
          <DateField label="Fuel date *" value={date} onChange={setDate} maximumDate={new Date()} />
          <Field label="Odometer (km) *" value={fuel.odometer} onChangeText={updateFuel("odometer")} keyboardType="decimal-pad" />
          <Field label="Fuel added (liters) *" value={fuel.liters} onChangeText={updateFuel("liters")} keyboardType="decimal-pad" />
          <Field label="Price per liter (₱) *" value={fuel.pricePerLiter} onChangeText={updateFuel("pricePerLiter")} keyboardType="decimal-pad" />
          <Field label="Station" value={fuel.stationName} onChangeText={updateFuel("stationName")} />
          <Field label="Notes" value={fuel.notes} onChangeText={updateFuel("notes")} multiline numberOfLines={3} />
        </> : null}

        {type === "maintenance" ? <>
          <DateField label={isHistory ? "Confirmed service date *" : "Service date *"} value={date} onChange={setDate} maximumDate={new Date()} />
          <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "700" }}>Maintenance item *</Text>
          <View style={{ gap: 8 }}>
            {(maintenanceItems ?? []).map((item) => {
              const selected = service.itemId === item._id;
              return <Pressable key={item._id} onPress={() => updateService("itemId")(item._id)} style={{ borderRadius: 0, borderWidth: 1, borderColor: selected ? colors.primary : colors.border, padding: 12, backgroundColor: selected ? `${colors.primary}12` : colors.card }}><Text style={{ color: colors.foreground, fontWeight: "800" }}>{item.name}</Text><Text style={{ color: colors.mutedForeground, fontSize: 12, marginTop: 2 }}>{item.category}</Text></Pressable>;
            })}
          </View>
          <Field label={isHistory ? "Confirmed service odometer (km) *" : "Odometer (km) *"} value={service.odometer} onChangeText={updateService("odometer")} keyboardType="decimal-pad" />
          <Field label="Cost (₱)" value={service.cost} onChangeText={updateService("cost")} keyboardType="decimal-pad" />
          <Field label="Notes" value={service.notes} onChangeText={updateService("notes")} multiline numberOfLines={3} />
          <View style={{ gap: 8 }}>
            <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "700" }}>Service photos · up to 5, 5 MB each</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              <AppButton label="Photos" onPress={() => void pickFromLibrary()} variant="outline" compact disabled={uploading || photos.length >= MAX_PHOTOS} icon={<ImagePlus size={16} color={colors.primary} />} />
              <AppButton label="Camera" onPress={() => void capturePhoto()} variant="outline" compact disabled={uploading || photos.length >= MAX_PHOTOS} icon={<Camera size={16} color={colors.primary} />} />
            </View>
            {uploading ? <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>Uploading photo…</Text> : null}
            {photos.length ? <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>{photos.map((photo) => <View key={photo.storageId} style={{ position: "relative" }}><Image source={{ uri: photo.uri }} alt="Selected service photo" style={{ width: 76, height: 76, borderRadius: 0 }} /><Pressable accessibilityRole="button" accessibilityLabel="Remove photo" onPress={() => setPhotos((all) => all.filter((candidate) => candidate.storageId !== photo.storageId))} style={{ position: "absolute", right: -4, top: -4, width: 24, height: 24, borderRadius: 0, alignItems: "center", justifyContent: "center", backgroundColor: colors.danger }}><X color="#fff" size={14} /></Pressable></View>)}</View> : null}
          </View>
        </> : null}

        {type === "expense" ? <>
          <DateField label="Expense date *" value={date} onChange={setDate} maximumDate={new Date()} />
          <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "700" }}>Category *</Text>
          <ChoiceRow value={expense.category} options={expenseCategories.map((category) => ({ value: category, label: category }))} onChange={(category) => updateExpense("category")(category)} />
          <Field label="Amount (₱) *" value={expense.amount} onChangeText={updateExpense("amount")} keyboardType="decimal-pad" />
          <Field label="Description" value={expense.description} onChangeText={updateExpense("description")} multiline numberOfLines={3} />
        </> : null}

        {error ? <Text accessibilityRole="alert" style={{ color: colors.danger, lineHeight: 19 }}>{error}</Text> : null}
        <AppButton label={saving ? "Saving log…" : isHistory ? "Save confirmed history" : "Save log"} onPress={() => void submit()} busy={saving} disabled={uploading} />
      </Card>
    </Page>
  );
}
