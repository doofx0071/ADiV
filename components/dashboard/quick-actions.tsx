"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Route, Fuel, Wrench, Plus } from "lucide-react";
import { LogModal, type ModalType } from "./log-modals";

export function QuickActions() {
  const [modal, setModal] = useState<ModalType>(null);

  return (
    <>
      <div className="flex flex-wrap gap-3">
        <Button onClick={() => setModal("ride")} className="gap-2">
          <Route className="h-4 w-4" />
          Log Ride
        </Button>
        <Button onClick={() => setModal("fuel")} variant="secondary" className="gap-2">
          <Fuel className="h-4 w-4" />
          Log Fuel
        </Button>
        <Button onClick={() => setModal("maintenance")} variant="outline" className="gap-2">
          <Wrench className="h-4 w-4" />
          Log Maintenance
        </Button>
        <Button onClick={() => setModal("expense")} variant="ghost" className="gap-2">
          <Plus className="h-4 w-4" />
          Add Expense
        </Button>
      </div>
      <LogModal type={modal} onClose={() => setModal(null)} />
    </>
  );
}
