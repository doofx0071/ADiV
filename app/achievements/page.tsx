"use client";

import { useQuery } from "convex/react";
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
};

export default function AchievementsPage() {
  const achievements = useQuery(api.achievements.getAchievements);
  const stats = useQuery(api.achievements.getAchievementStats);

  const unlockedTypes = new Set(achievements?.map((a) => a.type) ?? []);

  return (
    <main className="flex min-h-screen flex-col p-4 md:p-8">
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
                  <div>
                    <p className="font-medium text-sm">{def.name}</p>
                    <p className="text-xs text-muted-foreground">{def.description}</p>
                    {isUnlocked && (
                      <p className="text-xs text-primary mt-1">Unlocked!</p>
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
