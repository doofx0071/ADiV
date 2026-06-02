"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Route, Fuel, Wrench, Plus } from "lucide-react";

export function QuickActions() {
  const router = useRouter();

  return (
    <div className="flex flex-wrap gap-3">
      <Button
        onClick={() => router.push("/rides/new")}
        className="gap-2"
      >
        <Route className="h-4 w-4" />
        Log Ride
      </Button>
      <Button
        onClick={() => router.push("/fuel/new")}
        variant="secondary"
        className="gap-2"
      >
        <Fuel className="h-4 w-4" />
        Log Fuel
      </Button>
      <Button
        onClick={() => router.push("/maintenance/new")}
        variant="outline"
        className="gap-2"
      >
        <Wrench className="h-4 w-4" />
        Log Maintenance
      </Button>
      <Button
        onClick={() => router.push("/expenses/new")}
        variant="ghost"
        className="gap-2"
      >
        <Plus className="h-4 w-4" />
        Add Expense
      </Button>
    </div>
  );
}
