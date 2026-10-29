"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Route, Fuel, Wrench, Plus } from "lucide-react";
import { LogModal, type ModalType } from "./log-modals";

export function QuickActions() {
  const [modal, setModal] = useState<ModalType>(null);

  return (
    <>
      <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:gap-3">
        <Button onClick={() => setModal("ride")} className="h-11 min-w-0 justify-start gap-2 px-3 sm:h-9 sm:justify-center">
          <Route className="h-4 w-4 shrink-0" />
          Log Ride
        </Button>
        <Button onClick={() => setModal("fuel")} variant="secondary" className="h-11 min-w-0 justify-start gap-2 px-3 sm:h-9 sm:justify-center">
          <Fuel className="h-4 w-4 shrink-0" />
          Log Fuel
        </Button>
        <Button onClick={() => setModal("maintenance")} variant="outline" className="h-11 min-w-0 justify-start gap-2 px-3 sm:h-9 sm:justify-center">
          <Wrench className="h-4 w-4 shrink-0" />
          Log Maintenance
        </Button>
        <Button onClick={() => setModal("expense")} variant="ghost" className="h-11 min-w-0 justify-start gap-2 px-3 sm:h-9 sm:justify-center">
          <Plus className="h-4 w-4 shrink-0" />
          Add Expense
        </Button>
      </div>
      <LogModal key={modal ?? "closed"} type={modal} onClose={() => setModal(null)} />
    </>
  );
}
