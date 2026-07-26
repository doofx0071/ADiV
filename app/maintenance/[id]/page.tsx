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
import { calculateStatus } from "@/lib/reminders";
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
    if (!bike || !item || !item.lastServiceDate || !item.lastServiceOdometer) return null;
    return calculateStatus(
      bike.currentOdometer,
      new Date(),
      item.lastServiceOdometer,
      new Date(item.lastServiceDate),
      item.intervalKm ?? null,
      item.intervalMonths
    );
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
      <main className="flex flex-col p-4 md:p-8">
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
      <main className="flex flex-col p-4 md:p-8">
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
    <main className="flex flex-col p-4 md:p-8">
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
                <div className="flex items-center gap-2">
                  <StatusBadge status={status.status} />
                  <span className="text-sm text-muted-foreground">
                    {status.dueInKm !== null && status.dueInKm >= 0
                      ? `Due in ${status.dueInKm} km`
                      : status.dueInDays !== null && status.dueInDays >= 0
                      ? `Due in ${status.dueInDays} days`
                      : status.dueInKm !== null && status.dueInKm < 0
                      ? `Overdue by ${Math.abs(status.dueInKm)} km`
                      : `Overdue by ${Math.abs(status.dueInDays ?? 0)} days`}
                  </span>
                </div>
              ) : (
                <span className="text-sm text-muted-foreground">No service history</span>
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
              </div>
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
