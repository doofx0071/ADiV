"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { PageHeader } from "@/components/layout/page-header";
import { DashboardStats } from "@/components/dashboard/dashboard-stats";
import { UpcomingTasksWidget } from "@/components/dashboard/upcoming-tasks";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardPage() {
  const router = useRouter();
  const bike = useQuery(api.bike.getBike);

  useEffect(() => {
    if (bike === null) {
      router.replace("/setup");
    }
  }, [bike, router]);

  if (bike === undefined) {
    return (
      <main className="flex min-h-screen flex-col p-4 md:p-8">
        <div className="mx-auto w-full max-w-6xl space-y-6">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-4 w-64" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-28 w-full" />
            ))}
          </div>
        </div>
      </main>
    );
  }

  if (!bike) {
    return null;
  }

  return (
    <main className="flex min-h-screen flex-col p-4 md:p-8">
      <div className="mx-auto w-full max-w-6xl space-y-8">
        <PageHeader
          title="Dashboard"
          description={`Overview of your ${bike.name}`}
          action={<QuickActions />}
        />

        <DashboardStats />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <UpcomingTasksWidget />
          <RecentActivity />
        </div>
      </div>
    </main>
  );
}
