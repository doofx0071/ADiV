"use client";

import { useState, type ReactElement } from "react";
import { useMutation } from "convex/react";
import { Gauge } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface OdometerEditorProps {
  trigger: ReactElement;
  currentOdometer: number;
}

export function OdometerEditor({ trigger, currentOdometer }: OdometerEditorProps) {
  const updateOdometer = useMutation(api.bike.updateOdometer);
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const odometer = Number(value);
    if (!Number.isFinite(odometer) || odometer < 0) {
      toast.error("Enter a valid odometer reading");
      return;
    }

    setIsSaving(true);
    try {
      await updateOdometer({ currentOdometer: odometer });
      toast.success("Odometer updated. Maintenance reminders recalculated.");
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update the odometer");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => {
      setOpen(nextOpen);
      if (nextOpen) setValue(String(currentOdometer));
    }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Update odometer</DialogTitle>
          <DialogDescription>
            This updates the bike reading and recalculates reminders. It does not record a service.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSave} className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="maintenance-odometer">Current odometer (km)</Label>
            <Input
              id="maintenance-odometer"
              name="currentOdometer"
              type="number"
              min="0"
              step="any"
              inputMode="decimal"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              autoFocus
              required
            />
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" className="min-h-11 cursor-pointer sm:min-h-9" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving} className="min-h-11 cursor-pointer sm:min-h-9">
              <Gauge aria-hidden="true" />
              {isSaving ? "Saving…" : "Save odometer"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
