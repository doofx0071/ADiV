import { useState } from "react";
import { router } from "expo-router";
import { useMutation } from "convex/react";
import { Bike, Gauge, Settings2 } from "lucide-react-native";
import { ActivityIndicator, View } from "react-native";
import { AppText as Text } from "@/components/app-text";
import { api } from "@/lib/api";
import { AppButton, Card, Field, Page } from "@/components/ui";
import { DateField } from "@/components/date-field";
import { useAppTheme } from "@/lib/theme";

const defaults = {
  name: "My ADV160", year: "2024", color: "", currentOdometer: "0", purchaseDate: "", lastServiceDate: "", vin: "",
  engineCc: "157", tireFront: "110/80-14", tireRear: "130/70-13", tirePressureFront: "29", tirePressureRear: "33",
  oilType: "SAE 10W-30 JASO MB", oilCapacity: "0.75", coolantCapacity: "0.50", batteryType: "12V-5Ah MF-WET",
  sparkPlugType: "NGK LMAR8L-9", fuelTankCapacity: "8.1",
};
type Profile = typeof defaults;

export default function SetupScreen() {
  const [profile, setProfile] = useState<Profile>(defaults);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const { colors } = useAppTheme();
  const createBike = useMutation(api.bike.createBike);
  const seedMaintenance = useMutation(api.seed.seed);
  const update = (key: keyof Profile, value: string) => setProfile((current) => ({ ...current, [key]: value }));
  const purchaseDate = profile.purchaseDate ? new Date(profile.purchaseDate) : null;
  const lastServiceDate = profile.lastServiceDate ? new Date(profile.lastServiceDate) : null;

  async function save() {
    setError("");
    if (!profile.name.trim()) { setError("Enter a name for your bike."); return; }
    const numeric = ["year", "currentOdometer", "engineCc", "tirePressureFront", "tirePressureRear", "oilCapacity", "coolantCapacity", "fuelTankCapacity"] as const;
    if (numeric.some((key) => !Number.isFinite(Number(profile[key])) || Number(profile[key]) < 0)) { setError("Check the year, odometer, and specification values."); return; }
    const year = Number(profile.year);
    if (year < 2021 || year > 2027) { setError("Model year must be between 2021 and 2027."); return; }
    if (!profile.tireFront.trim() || !profile.tireRear.trim() || !profile.oilType.trim() || !profile.batteryType.trim() || !profile.sparkPlugType.trim()) { setError("Fill in the required bike specifications."); return; }

    setSaving(true);
    try {
      await createBike({
        name: profile.name.trim(), model: "Honda ADV160", year,
        color: profile.color.trim() || undefined,
        vin: profile.vin.trim() || undefined,
        purchaseDate: purchaseDate ? purchaseDate.getTime() : undefined,
        lastServiceDate: lastServiceDate ? lastServiceDate.getTime() : undefined,
        currentOdometer: Number(profile.currentOdometer),
        engineCc: Number(profile.engineCc),
        tireFront: profile.tireFront.trim(), tireRear: profile.tireRear.trim(),
        tirePressureFront: Number(profile.tirePressureFront), tirePressureRear: Number(profile.tirePressureRear),
        oilType: profile.oilType.trim(), oilCapacity: Number(profile.oilCapacity),
        coolantCapacity: Number(profile.coolantCapacity), batteryType: profile.batteryType.trim(),
        sparkPlugType: profile.sparkPlugType.trim(), fuelTankCapacity: Number(profile.fuelTankCapacity),
      });
      try { await seedMaintenance({}); } catch { /* The profile is saved; schedules can be added later. */ }
      router.replace("/(tabs)");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save the bike profile.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Page showBrandHeader={false} eyebrow="First-time setup" title="Set up your ADV160" subtitle="This profile is shared with your AdiV web app and uses the same single-bike Convex data." >
      <Card>
        <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}><Bike size={19} color={colors.primary} /><Text style={{ color: colors.foreground, fontWeight: "900", fontSize: 17 }}>Bike details</Text></View>
        <Field label="Bike name *" value={profile.name} onChangeText={(v) => update("name", v)} placeholder="My ADV160" />
        <Field label="Model year *" value={profile.year} onChangeText={(v) => update("year", v)} keyboardType="number-pad" />
        <Field label="Color" value={profile.color} onChangeText={(v) => update("color", v)} placeholder="Matte black" />
        <Field label="Current odometer (km) *" value={profile.currentOdometer} onChangeText={(v) => update("currentOdometer", v)} keyboardType="decimal-pad" />
        <Field label="VIN" value={profile.vin} onChangeText={(v) => update("vin", v)} autoCapitalize="characters" />
        <DateField label="Purchase date" value={purchaseDate} onChange={(d) => update("purchaseDate", d?.toISOString() ?? "")} optional />
        <DateField label="Last service date" value={lastServiceDate} onChange={(d) => update("lastServiceDate", d?.toISOString() ?? "")} maximumDate={new Date()} helper="Leave it blank if you do not know the date." optional />
      </Card>

      <Card>
        <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}><Settings2 size={19} color={colors.primary} /><Text style={{ color: colors.foreground, fontWeight: "900", fontSize: 17 }}>Reference specs</Text></View>
      <Text style={{ color: colors.mutedForeground, fontSize: 13, lineHeight: 19 }}>Defaults are starting values. Review them against your owner&apos;s manual and update them if needed.</Text>
        <Field label="Engine displacement (cc)" value={profile.engineCc} onChangeText={(v) => update("engineCc", v)} keyboardType="decimal-pad" />
        <Field label="Front tire" value={profile.tireFront} onChangeText={(v) => update("tireFront", v)} />
        <Field label="Rear tire" value={profile.tireRear} onChangeText={(v) => update("tireRear", v)} />
        <Field label="Front tire pressure (psi)" value={profile.tirePressureFront} onChangeText={(v) => update("tirePressureFront", v)} keyboardType="decimal-pad" />
        <Field label="Rear tire pressure (psi)" value={profile.tirePressureRear} onChangeText={(v) => update("tirePressureRear", v)} keyboardType="decimal-pad" />
        <Field label="Engine oil" value={profile.oilType} onChangeText={(v) => update("oilType", v)} />
        <Field label="Oil capacity (L)" value={profile.oilCapacity} onChangeText={(v) => update("oilCapacity", v)} keyboardType="decimal-pad" />
        <Field label="Coolant capacity (L)" value={profile.coolantCapacity} onChangeText={(v) => update("coolantCapacity", v)} keyboardType="decimal-pad" />
        <Field label="Battery type" value={profile.batteryType} onChangeText={(v) => update("batteryType", v)} />
        <Field label="Spark plug" value={profile.sparkPlugType} onChangeText={(v) => update("sparkPlugType", v)} />
        <Field label="Fuel tank capacity (L)" value={profile.fuelTankCapacity} onChangeText={(v) => update("fuelTankCapacity", v)} keyboardType="decimal-pad" />
        {error ? <Text style={{ color: colors.danger, fontSize: 13, lineHeight: 19 }}>{error}</Text> : null}
        <AppButton label={saving ? "Saving profile…" : "Save bike profile"} onPress={() => void save()} busy={saving} icon={saving ? <ActivityIndicator color="#fff" /> : <Gauge color="#fff" size={18} />} />
      </Card>
      <Text style={{ color: colors.mutedForeground, fontSize: 12, textAlign: "center", lineHeight: 18 }}>Maintenance intervals remain editable. Their source notes travel with your schedule.</Text>
    </Page>
  );
}
