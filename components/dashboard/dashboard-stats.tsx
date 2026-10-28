"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { StatCard } from "@/components/layout/stat-card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Gauge,
  Route,
  Fuel,
  Wallet,
  Wrench,
  CalendarCheck,
} from "lucide-react";
import { startOfMonth, endOfMonth } from "date-fns";
import { calculateStatus, formatDueText } from "@/lib/reminders";

export function DashboardStats() {
  const bike = useQuery(api.bike.getBike);
  const rides = useQuery(api.rides.getRides, { limit: 100 });
  const fuelStats = useQuery(api.fuel.getFuelStats);
  const expenses = useQuery(api.expenses.getExpenses, { limit: 100 });
  const maintenanceItems = useQuery(api.maintenance.getMaintenanceItems);
  const updateOdometer = useMutation(api.bike.updateOdometer);

  const [odometerOpen, setOdometerOpen] = useState(false);
  const [newOdometer, setNewOdometer] = useState("");
  const [savingOdometer, setSavingOdometer] = useState(false);

  const handleOdometerSave = async () => {
    const val = Number(newOdometer);
    if (!val || val < 0) { toast.error("Enter a valid odometer reading"); return; }
    setSavingOdometer(true);
    try {
      await updateOdometer({ currentOdometer: val });
      toast.success("Odometer updated");
      setOdometerOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setSavingOdometer(false);
    }
  };

  if (!bike || rides === undefined || fuelStats === undefined || expenses === undefined || maintenanceItems === undefined) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    );
  }

  // eslint-disable-next-line react-hooks/purity -- capture render time; refreshes on every data update
  const now = Date.now();
  const monthStart = startOfMonth(now).getTime();
  const monthEnd = endOfMonth(now).getTime();
  const thisMonthRides = rides?.filter(
    (r) => r.date >= monthStart && r.date <= monthEnd
  ) ?? [];
  const thisMonthDistance = thisMonthRides.reduce((s, r) => s + r.distance, 0);

  // Calculate this month's expenses
  const thisMonthExpenses = expenses?.filter(
    (e) => e.date >= monthStart && e.date <= monthEnd
  ) ?? [];
  const totalExpenses = thisMonthExpenses.reduce((s, e) => s + e.amount, 0);

  // Items serviced so far (honest count — on-time tracking is not recorded)
  const servicedCount = maintenanceItems?.filter((item) => item.lastServiceDate).length ?? 0;

  // Find next due task via the shared reminder engine
  const upcomingItems = maintenanceItems
    ?.filter((item) => item.lastServiceDate && (item.intervalKm || item.intervalMonths))
    .map((item) => ({
      ...item,
      status: calculateStatus(
        bike.currentOdometer,
        new Date(now),
        item.lastServiceOdometer ?? 0,
        new Date(item.lastServiceDate ?? now),
        item.intervalKm ?? null,
        item.intervalMonths
      ),
    }))
    .filter((item) => (item.status.dueInKm !== null && item.status.dueInKm <= 1000) || (item.status.dueInDays !== null && item.status.dueInDays <= 30))
    .sort((a, b) => {
      const priority = { overdue: 0, due: 1, upcoming: 2 };
      return priority[a.status.status] - priority[b.status.status];
    });

  const nextDue = upcomingItems?.[0];
  const nextDueLabel = nextDue
    ? `${nextDue.name} — ${formatDueText(nextDue.status)}`
    : "All good!";

  return (
    <>
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <button
        onClick={() => { setNewOdometer(String(bike.currentOdometer)); setOdometerOpen(true); }}
        className="text-left cursor-pointer hover:opacity-80 transition-opacity"
      >
        <StatCard
          title="Current Odometer"
          value={`${bike.currentOdometer.toLocaleString()} km`}
          icon={<Gauge className="h-4 w-4" />}
        />
      </button>
      <StatCard
        title="This Month's Rides"
        value={`${thisMonthRides.length}`}
        description={`${thisMonthDistance.toLocaleString()} km total`}
        icon={<Route className="h-4 w-4" />}
      />
      <StatCard
        title="Fuel Efficiency"
        value={fuelStats.avgKmPerLiter > 0 ? `${fuelStats.avgKmPerLiter.toFixed(1)} km/L` : "—"}
        description="Across all fuel-ups"
        icon={<Fuel className="h-4 w-4" />}
      />
      <StatCard
        title="This Month's Expenses"
        value={`₱${totalExpenses.toLocaleString()}`}
        icon={<Wallet className="h-4 w-4" />}
      />
      <StatCard
        title="Items Serviced"
        value={`${servicedCount} items`}
        description="Of your maintenance list"
        icon={<Wrench className="h-4 w-4" />}
      />
      <StatCard
        title="Next Due"
        value={nextDueLabel}
        icon={<CalendarCheck className="h-4 w-4" />}
      />
    </div>

    {/* Odometer Edit Dialog */}
    <Dialog open={odometerOpen} onOpenChange={setOdometerOpen}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Edit Odometer</DialogTitle>
          <DialogDescription>
            Update your current odometer reading
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="odometer-input">Current Odometer (km)</Label>
            <Input
              id="odometer-input"
              name="currentOdometer"
              type="number"
              inputMode="numeric"
              value={newOdometer}
              onChange={(e) => setNewOdometer(e.target.value)}
              autoFocus
            />
          </div>
          <div className="flex gap-3">
            <Button onClick={handleOdometerSave} disabled={savingOdometer} className="flex-1">
              {savingOdometer ? "Saving..." : "Save"}
            </Button>
            <Button variant="outline" onClick={() => setOdometerOpen(false)}>
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}
