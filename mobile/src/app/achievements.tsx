import { useEffect, useMemo } from "react";
import { View } from "react-native";
import { AppText as Text } from "@/components/app-text";
import { Award, Camera, Flame, Fuel, Route, Wallet, Wrench } from "lucide-react-native";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/lib/api";
import { ACHIEVEMENT_DEFS } from "@/lib/shared";
import { Card, LoadingState, Page } from "@/components/ui";
import { dateLabel } from "@/lib/format";
import { useAppTheme } from "@/lib/theme";

const iconFor = (icon: string) => {
  const props = { size: 20, color: "#e62025" };
  if (icon === "wrench") return <Wrench {...props} />;
  if (icon === "flame") return <Flame {...props} />;
  if (icon === "route") return <Route {...props} />;
  if (icon === "fuel") return <Fuel {...props} />;
  if (icon === "camera") return <Camera {...props} />;
  if (icon === "wallet") return <Wallet {...props} />;
  return <Award {...props} />;
};

export default function AchievementsScreen() {
  const checkAchievements = useMutation(api.achievements.checkAchievements);
  const achievements = useQuery(api.achievements.getAchievements);
  const stats = useQuery(api.achievements.getAchievementStats);
  const { colors } = useAppTheme();
  useEffect(() => { void checkAchievements({}).catch(() => undefined); }, [checkAchievements]);
  const unlocked = useMemo(() => new Map((achievements ?? []).map((entry) => [entry.type, entry])), [achievements]);

  if (achievements === undefined || stats === undefined) return <Page back><LoadingState label="Loading achievements…" /></Page>;
  return (
    <Page back eyebrow="Ride milestones" title="Achievements" subtitle={`${stats.unlocked} of ${stats.total} unlocked · ${stats.percent}% complete`}>
      <Card style={{ gap: 9 }}>
          <View style={{ height: 10, borderRadius: 0, backgroundColor: colors.secondary, overflow: "hidden" }}><View style={{ height: 10, borderRadius: 0, backgroundColor: colors.primary, width: `${stats.percent}%` }} /></View>
        <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>Your milestones are calculated from your saved rides, fuel-ups, service logs, and expenses.</Text>
      </Card>
      {ACHIEVEMENT_DEFS.map((definition) => {
        const record = unlocked.get(definition.type);
        return (
          <Card key={definition.type} style={{ flexDirection: "row", alignItems: "center", gap: 13, opacity: record ? 1 : 0.7 }}>
            <View style={{ width: 44, height: 44, borderRadius: 0, backgroundColor: record ? `${colors.primary}18` : colors.secondary, alignItems: "center", justifyContent: "center" }}>{iconFor(definition.icon)}</View>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={{ color: colors.foreground, fontWeight: "900", fontSize: 15 }}>{definition.name}</Text>
              <Text style={{ color: colors.mutedForeground, fontSize: 12, lineHeight: 17 }}>{definition.description}</Text>
              <Text style={{ color: record ? colors.success : colors.mutedForeground, fontSize: 11, fontWeight: "800" }}>{record ? `Unlocked ${dateLabel(record.unlockedAt)}` : "Locked"}</Text>
            </View>
          </Card>
        );
      })}
    </Page>
  );
}
