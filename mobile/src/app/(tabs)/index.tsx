import { useMemo, useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, View } from "react-native";
import { Image } from "expo-image";
import { AppText as Text } from "@/components/app-text";
import { router } from "expo-router";
import { useMutation, useQuery } from "convex/react";
import { Activity, ArrowRight, Camera, CircleDollarSign, Fuel, Plus, Route, Wrench, X } from "lucide-react-native";
import { api } from "@/lib/api";
import { AppButton, Banner, Card, Field, LoadingState, Page, SectionTitle, StatCard, colorsForStatus } from "@/components/ui";
import { evaluateMaintenanceItems, summarizeMaintenanceEvaluations } from "@/lib/shared";
import { km, php } from "@/lib/format";
import { useAppTheme } from "@/lib/theme";
import alternateLogo from "../../../assets/images/ADiV-shesh.png";

const logRoutes = [
  { type: "ride", label: "Ride", icon: Route },
  { type: "fuel", label: "Fuel", icon: Fuel },
  { type: "maintenance", label: "Service", icon: Wrench },
  { type: "expense", label: "Expense", icon: CircleDollarSign },
] as const;

export default function DashboardScreen() {
  const bike = useQuery(api.bike.getBike);
  const items = useQuery(api.maintenance.getMaintenanceItems);
  const rideStats = useQuery(api.rides.getRideStats, {});
  const fuelStats = useQuery(api.fuel.getFuelStats, {});
  const maintenanceStats = useQuery(api.maintenance.getMaintenanceStats, {});
  const expenseStats = useQuery(api.expenses.getExpenseStats, {});
  const updateOdometer = useMutation(api.bike.updateOdometer);
  const [odoValue, setOdoValue] = useState("");
  const [odoError, setOdoError] = useState<string | null>(null);
  const [odometerModalVisible, setOdometerModalVisible] = useState(false);
  const [savingOdo, setSavingOdo] = useState(false);
  const { colors } = useAppTheme();

  const evaluations = useMemo(() => bike && items ? evaluateMaintenanceItems(items, bike.currentOdometer, new Date()) : [], [bike, items]);
  const summary = useMemo(() => summarizeMaintenanceEvaluations(evaluations), [evaluations]);

  if (bike === undefined || items === undefined || rideStats === undefined || fuelStats === undefined || maintenanceStats === undefined || expenseStats === undefined) {
    return <Page><LoadingState /></Page>;
  }

  function openOdometerModal() {
    if (!bike) {
      router.push("/setup");
      return;
    }
    setOdoValue(String(Math.round(bike.currentOdometer)));
    setOdoError(null);
    setOdometerModalVisible(true);
  }

  async function saveOdometer() {
    const reading = Number(odoValue.trim());
    if (!odoValue.trim() || !Number.isFinite(reading) || reading < 0) {
      setOdoError("Enter a valid odometer reading of 0 km or more.");
      return;
    }
    setSavingOdo(true);
    setOdoError(null);
    try {
      await updateOdometer({ currentOdometer: reading });
      setOdometerModalVisible(false);
    } catch (error) {
      setOdoError(error instanceof Error ? error.message : "Could not save the odometer. Please try again.");
    }
    finally { setSavingOdo(false); }
  }

  return (
    <Page>
      {!bike ? <Banner title="Bike profile needed" body="Complete setup to start recording rides, fuel, and maintenance." /> : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={bike ? `Update odometer. Current reading ${Math.round(bike.currentOdometer)} kilometers` : "Set up your bike"}
        accessibilityHint={bike ? "Opens the odometer editor" : "Opens bike setup"}
        onPress={openOdometerModal}
        style={({ pressed }) => ({ opacity: pressed ? 0.88 : 1 })}
      >
        <Card style={{ backgroundColor: colors.primary, borderColor: colors.primary, padding: 20 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={{ color: "#ffffff", fontSize: 12, fontWeight: "900", letterSpacing: 1.2, textTransform: "uppercase" }}>{bike ? `${bike.year} · ${bike.model}` : "Your motorcycle"}</Text>
              <Text style={{ color: "#ffffff", fontSize: 34, fontWeight: "900", marginTop: 5 }}>{bike ? km(bike.currentOdometer) : "Set up your bike"}</Text>
              <Text style={{ color: "#ffffff", opacity: 0.85, fontSize: 13 }}>Current odometer</Text>
              <Text style={{ color: "#ffffff", opacity: 0.82, fontSize: 12, fontWeight: "700", marginTop: 7 }}>{bike ? "Tap to update reading" : "Tap to get started"}</Text>
            </View>
            <Image source={alternateLogo} contentFit="contain" alt="AdiV motorcycle logo" accessibilityLabel="AdiV motorcycle logo" style={{ width: 96, height: 96 }} />
          </View>
        </Card>
      </Pressable>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        <StatCard label="RIDE DISTANCE" value={km(rideStats?.totalDistance ?? 0)} detail={`${rideStats?.totalRides ?? 0} rides`} />
        <StatCard label="FUEL EFFICIENCY" value={`${(fuelStats?.avgKmPerLiter ?? 0).toFixed(1)} km/L`} detail={`${fuelStats?.logCount ?? 0} fuel-ups`} />
        <StatCard label="TOTAL SPENT" value={php(maintenanceStats.totalCost + expenseStats.totalAmount + fuelStats.totalCost)} detail={`${fuelStats.logCount} fuel · ${maintenanceStats.logCount} service · ${expenseStats.count} expenses`} />
        <StatCard label="SERVICE ITEMS" value={`${summary.overdue + summary.due}`} detail={`${summary.overdue} overdue · ${summary.needsHistory} need history`} />
      </View>

      <View style={{ gap: 11 }}>
        <SectionTitle title="Quick log" action={<Pressable accessibilityRole="button" onPress={() => router.push("/rides")}><Text style={{ color: colors.primary, fontWeight: "800" }}>View rides</Text></Pressable>} />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {logRoutes.map(({ type, label, icon: Icon }) => (
            <AppButton key={type} label={label} onPress={() => router.push({ pathname: "/log/[type]", params: { type } })} compact variant="outline" icon={<Icon size={16} color={colors.primary} />} />
          ))}
        </View>
      </View>

      <View style={{ gap: 11 }}>
        <SectionTitle title="Maintenance readiness" action={<Pressable onPress={() => router.push("/(tabs)/maintenance")}><Text style={{ color: colors.primary, fontWeight: "800" }}>View all</Text></Pressable>} />
        {summary.overdue > 0 ? <Banner title={`${summary.overdue} overdue`} body="Review these items before your next long ride." /> : null}
        {!bike ? <Banner title="No bike profile" body="Maintenance reminders begin after your profile is set up." /> : null}
        {evaluations.slice(0, 4).map(({ item, status, dueInKm, dueInDays, missingBaseline }) => (
          <Pressable key={item._id} onPress={() => router.push({ pathname: "/maintenance/[id]", params: { id: item._id } })}>
            <Card style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View style={{ width: 40, height: 40, borderRadius: 0, backgroundColor: `${colorsForStatus(colors, status)}18`, alignItems: "center", justifyContent: "center" }}><Wrench size={19} color={colorsForStatus(colors, status)} /></View>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={{ color: colors.foreground, fontWeight: "800", fontSize: 15 }}>{item.name}</Text>
                <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{dueInKm !== null ? `${km(dueInKm)} remaining` : dueInDays !== null ? `${dueInDays} days remaining` : missingBaseline.length > 0 ? "Service history needed" : "No interval set"}</Text>
              </View>
              <Text style={{ color: colorsForStatus(colors, status), textTransform: "uppercase", fontSize: 10, fontWeight: "900" }}>{status.replace("-", " ")}</Text>
              <ArrowRight size={16} color={colors.mutedForeground} />
            </Card>
          </Pressable>
        ))}
        {bike && evaluations.length === 0 ? <Card><Text style={{ color: colors.mutedForeground }}>No maintenance schedule items yet.</Text><AppButton label="Add schedule item" onPress={() => router.push("/maintenance/edit")} variant="outline" compact /></Card> : null}
      </View>

      <View style={{ gap: 10 }}>
        <SectionTitle title="Your garage" />
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
          <AppButton label="Open gallery" onPress={() => router.push("/gallery")} variant="outline" compact icon={<Camera size={16} color={colors.primary} />} />
          <AppButton label="Achievements" onPress={() => router.push("/achievements")} variant="outline" compact icon={<Activity size={16} color={colors.primary} />} />
          <AppButton label="Export data" onPress={() => router.push("/export")} variant="outline" compact icon={<Plus size={16} color={colors.primary} />} />
        </View>
      </View>

      <Modal
        visible={odometerModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => { if (!savingOdo) setOdometerModalVisible(false); }}
      >
        <KeyboardAvoidingView
          style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0, 0, 0, 0.55)" }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close odometer editor"
            disabled={savingOdo}
            onPress={() => setOdometerModalVisible(false)}
            style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }}
          />
          <View style={{ backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, padding: 20, gap: 16 }}>
            <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={{ color: colors.foreground, fontSize: 20, fontWeight: "900" }}>Update odometer</Text>
                <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>Current reading: {bike ? km(bike.currentOdometer) : "not set"}</Text>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="Close" disabled={savingOdo} onPress={() => setOdometerModalVisible(false)} style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center", backgroundColor: colors.secondary }}>
                <X size={20} color={colors.foreground} />
              </Pressable>
            </View>
            <Field label="New odometer reading (km)" value={odoValue} onChangeText={(value) => { setOdoValue(value); setOdoError(null); }} keyboardType="decimal-pad" placeholder={bike ? String(Math.round(bike.currentOdometer)) : "0"} error={odoError ?? undefined} autoCorrect={false} />
            <View style={{ flexDirection: "row", gap: 8 }}>
              <View style={{ flex: 1 }}><AppButton label="Cancel" onPress={() => setOdometerModalVisible(false)} variant="outline" disabled={savingOdo} /></View>
              <View style={{ flex: 1 }}><AppButton label="Save reading" onPress={() => void saveOdometer()} busy={savingOdo} /></View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </Page>
  );
}
