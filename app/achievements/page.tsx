"use client";

import { useEffect, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ACHIEVEMENT_DEFS } from "@/lib/achievements";
import {
  Wrench,
  Flame,
  Award,
  Route,
  Fuel,
  Camera,
  Wallet,
  Gauge,
  Banknote,
  Sunrise,
  Lock,
} from "lucide-react";

const ICON_MAP: Record<string, React.ReactNode> = {
  wrench: <Wrench className="h-5 w-5" />,
  flame: <Flame className="h-5 w-5" />,
  award: <Award className="h-5 w-5" />,
  route: <Route className="h-5 w-5" />,
  fuel: <Fuel className="h-5 w-5" />,
  camera: <Camera className="h-5 w-5" />,
  wallet: <Wallet className="h-5 w-5" />,
  gauge: <Gauge className="h-5 w-5" />,
  banknote: <Banknote className="h-5 w-5" />,
  sunrise: <Sunrise className="h-5 w-5" />,
};

function formatProgress(value: number, unit: string): string {
  switch (unit) {
    case "km":
      return `${value.toLocaleString()} km`;
    case "km/L":
      return `${value.toLocaleString(undefined, { maximumFractionDigits: 1 })} km/L`;
    case "currency":
      return `₱${value.toLocaleString()}`;
    default:
      return `${value.toLocaleString()}`;
  }
}

export default function AchievementsPage() {
  const achievements = useQuery(api.achievements.getAchievements);
  const stats = useQuery(api.achievements.getAchievementStats);
  const progress = useQuery(api.achievements.getAchievementProgress);
  const checkAchievements = useMutation(api.achievements.checkAchievements);
  const checkedRef = useRef(false);

  // Re-evaluate unlocks on visit so this page never shows stale state
  useEffect(() => {
    if (achievements !== undefined && !checkedRef.current) {
      checkedRef.current = true;
      checkAchievements().catch(() => {
        // Non-critical
      });
    }
  }, [achievements, checkAchievements]);

  const unlockedTypes = new Set(achievements?.map((a) => a.type) ?? []);
  const progressByType = new Map(progress?.map((p) => [p.type, p]) ?? []);

  return (
    <main className="flex flex-col p-3 sm:p-4 md:p-8">
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <PageHeader
          title="Achievements"
          description="Unlock badges by tracking your motorcycle"
        />

        {stats && (
          <Card>
            <CardContent className="py-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Progress</span>
                <span className="text-sm text-muted-foreground">
                  {stats.unlocked} / {stats.total} ({stats.percent}%)
                </span>
              </div>
              <Progress value={stats.percent} className="h-2" />
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {ACHIEVEMENT_DEFS.map((def) => {
            const isUnlocked = unlockedTypes.has(def.type);
            const defProgress = progressByType.get(def.type);
            const percent =
              !isUnlocked && defProgress && defProgress.target > 0
                ? Math.min(
                    Math.round((defProgress.value / defProgress.target) * 100),
                    100,
                  )
                : null;
            return (
              <Card
                key={def.type}
                className={isUnlocked ? "border-primary/50" : "opacity-60"}
              >
                <CardContent className="flex items-start gap-4 py-4">
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                      isUnlocked
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {isUnlocked ? ICON_MAP[def.icon] ?? <Award className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm">{def.name}</p>
                    <p className="text-xs text-muted-foreground">{def.description}</p>
                    {isUnlocked && (
                      <p className="text-xs text-primary mt-1">Unlocked!</p>
                    )}
                    {!isUnlocked && percent !== null && (
                      <div className="mt-2 space-y-1">
                        <Progress value={percent} className="h-1.5" />
                        <p className="text-xs text-muted-foreground">
                          {formatProgress(defProgress!.value, def.unit)} /{" "}
                          {formatProgress(defProgress!.target, def.unit)}
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </main>
  );
}
