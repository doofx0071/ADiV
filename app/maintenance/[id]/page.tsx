"use client";

import { useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/layout/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { evaluateMaintenanceItem, formatDueText } from "@/lib/reminders";
import {
  Wrench,
  ArrowLeft,
  Gauge,
  Calendar,
  Clock,
  ImageIcon,
  Wallet,
} from "lucide-react";

export default function MaintenanceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const itemId = params.id as string as Id<"maintenanceItems">;

  const bike = useQuery(api.bike.getBike);
  const maintenanceItems = useQuery(api.maintenance.getMaintenanceItems);
  const logs = useQuery(api.maintenance.getMaintenanceLogs, { itemId, limit: 50 });

  const item = useMemo(() => {
    return maintenanceItems?.find((i) => i._id === itemId);
  }, [maintenanceItems, itemId]);

  const status = useMemo(() => {
    if (!bike || !item) return null;
    return evaluateMaintenanceItem(item, bike.currentOdometer, new Date());
  }, [bike, item]);

  const stats = useMemo(() => {
    if (!logs || logs.length === 0) return null;

    const totalCost = logs.reduce((sum, log) => sum + (log.cost ?? 0), 0);
    const avgCost = totalCost / logs.length;
    const maxOdometer = Math.max(...logs.map((l) => l.odometer));
    const minOdometer = Math.min(...logs.map((l) => l.odometer));
    const totalDistance = maxOdometer - minOdometer;

    return {
      totalServices: logs.length,
      totalCost,
      avgCost,
      maxOdometer,
      totalDistance,
    };
  }, [logs]);

  const isLoading = bike === undefined || maintenanceItems === undefined || logs === undefined;

  if (isLoading) {
    return (
      <main className="flex flex-col p-3 sm:p-4 md:p-8">
        <div className="mx-auto w-full max-w-3xl space-y-6">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-4 w-64" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28 w-full" />
            ))}
          </div>
          <Skeleton className="h-64 w-full" />
        </div>
      </main>
    );
  }

  if (!item) {
    return (
      <main className="flex flex-col p-3 sm:p-4 md:p-8">
        <div className="mx-auto w-full max-w-3xl">
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Wrench className="h-12 w-12 mb-4 opacity-40" />
              <p className="text-sm font-medium">Maintenance item not found</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => router.push("/dashboard")}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-col p-3 sm:p-4 md:p-8">
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <PageHeader
          title={item.name}
          description={item.description ?? item.category}
          action={
            <Button variant="outline" size="sm" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          }
        />

        {/* Status & Next Due */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              {status ? (
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    {status.status === "needs-history" ? (
                      <Badge variant="outline" className="border-warning/50 text-warning-foreground">Needs history</Badge>
                    ) : status.status === "clear" ? (
                      <Badge variant="secondary">On track</Badge>
                    ) : (
                      <StatusBadge status={status.status} />
                    )}
                    {!status.historyComplete && status.status !== "needs-history" && (
                      <Badge variant="outline" className="border-warning/50 text-warning-foreground">Needs history</Badge>
                    )}
                  </div>
                  {(status.dueInKm !== null || status.dueInDays !== null) && (
                    <p className="text-sm text-muted-foreground">{formatDueText(status)}</p>
                  )}
                  {!status.historyComplete && (
                    <p className="text-xs text-muted-foreground">
                      Missing confirmed {status.missingBaseline.map((field) =>
                        field === "service-date" ? "service date" : "service odometer"
                      ).join(" and ")}.
                    </p>
                  )}
                  {status.dueAtOdometer !== null && (
                    <p className="text-xs text-muted-foreground">Next distance service at {status.dueAtOdometer.toLocaleString()} km</p>
                  )}
                  {status.dueAtDate && (
                    <p className="text-xs text-muted-foreground">
                      Next time service by {status.dueAtDate.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
                    </p>
                  )}
                </div>
              ) : (
                <span className="text-sm text-muted-foreground">Service baseline is not available.</span>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Interval
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {item.intervalKm && (
                  <Badge variant="secondary">
                    <Gauge className="h-3 w-3 mr-1" />
                    {item.intervalKm.toLocaleString()} km
                  </Badge>
                )}
                {item.intervalMonths && (
                  <Badge variant="secondary">
                    <Calendar className="h-3 w-3 mr-1" />
                    {item.intervalMonths} months
                  </Badge>
                )}
                {!item.intervalKm && !item.intervalMonths && (
                  <span className="text-xs text-muted-foreground">No reminder interval configured</span>
                )}
              </div>
              {item.intervalSource ? (
                <p className="mt-3 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground/80">Interval source:</span> {item.intervalSource}
                </p>
              ) : (
                <p className="mt-3 text-xs text-muted-foreground">Interval source has not been recorded.</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Services
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalServices}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Total Cost
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  ₱{stats.totalCost.toLocaleString()}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Avg Cost
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  ₱{Math.round(stats.avgCost).toLocaleString()}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Distance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {stats.totalDistance.toLocaleString()} km
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Service Logs */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Service History
            </CardTitle>
          </CardHeader>
          <CardContent>
            {logs && logs.length > 0 ? (
              <div className="space-y-3">
                {logs.map((log) => (
                  <div
                    key={log._id}
                    className="flex items-start justify-between rounded-lg border p-3 gap-4"
                  >
                    <div className="space-y-1 min-w-0">
                      <p className="font-medium text-sm">
                        {log.odometer.toLocaleString()} km
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(log.date).toLocaleDateString(undefined, {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </p>
                      {log.notes && (
                        <p className="text-xs text-muted-foreground truncate">
                          {log.notes}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {log.cost !== undefined && log.cost > 0 && (
                        <Badge variant="secondary">
                          <Wallet className="h-3 w-3 mr-1" />
                          ₱{log.cost.toLocaleString()}
                        </Badge>
                      )}
                      {log.photos && log.photos.length > 0 && (
                        <Badge variant="outline">
                          <ImageIcon className="h-3 w-3 mr-1" />
                          {log.photos.length}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                No service logs yet. Log your first service to start tracking.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
