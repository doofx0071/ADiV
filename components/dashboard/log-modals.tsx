"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Route, Fuel, Wrench, Plus } from "lucide-react";

type ModalType = "ride" | "fuel" | "maintenance" | "expense" | null;

export type { ModalType };

const EXPENSE_CATEGORIES = [
  "Parts", "Accessories", "Insurance", "Parking",
  "Tolls", "Cleaning", "Tools", "Other",
];

interface Props {
  type: ModalType;
  onClose: () => void;
}

export function LogModal({ type, onClose }: Props) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Ride form
  const [rideForm, setRideForm] = useState({ startOdometer: "", endOdometer: "", durationMinutes: "", notes: "" });
  const logRide = useMutation(api.rides.logRide);

  // Fuel form
  const [fuelForm, setFuelForm] = useState({ odometer: "", liters: "", pricePerLiter: "", stationName: "", notes: "" });
  const logFuel = useMutation(api.fuel.logFuel);

  // Maintenance form
  const [maintForm, setMaintForm] = useState({ itemId: "", odometer: "", cost: "", notes: "" });
  const maintenanceItems = useQuery(api.maintenance.getMaintenanceItems);
  const logMaintenance = useMutation(api.maintenance.logMaintenance);

  // Expense form
  const [expForm, setExpForm] = useState({ category: "", amount: "", description: "" });
  const addExpense = useMutation(api.expenses.addExpense);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (type === "ride") {
        await logRide({
          startOdometer: Number(rideForm.startOdometer),
          endOdometer: Number(rideForm.endOdometer),
          date: Date.now(),
          durationMinutes: Number(rideForm.durationMinutes),
          notes: rideForm.notes || undefined,
        });
        setRideForm({ startOdometer: "", endOdometer: "", durationMinutes: "", notes: "" });
        toast.success("Ride logged!");
      } else if (type === "fuel") {
        await logFuel({
          odometer: Number(fuelForm.odometer),
          liters: Number(fuelForm.liters),
          pricePerLiter: Number(fuelForm.pricePerLiter),
          date: Date.now(),
          stationName: fuelForm.stationName || undefined,
          notes: fuelForm.notes || undefined,
        });
        setFuelForm({ odometer: "", liters: "", pricePerLiter: "", stationName: "", notes: "" });
        toast.success("Fuel log added!");
      } else if (type === "maintenance") {
        if (!maintForm.itemId) { toast.error("Select a maintenance item"); return; }
        await logMaintenance({
          itemId: maintForm.itemId as any,
          odometer: Number(maintForm.odometer),
          date: Date.now(),
          cost: maintForm.cost ? Number(maintForm.cost) : undefined,
          notes: maintForm.notes || undefined,
        });
        setMaintForm({ itemId: "", odometer: "", cost: "", notes: "" });
        toast.success("Maintenance logged!");
      } else if (type === "expense") {
        if (!expForm.category) { toast.error("Select a category"); return; }
        await addExpense({
          category: expForm.category,
          amount: Number(expForm.amount),
          date: Date.now(),
          description: expForm.description || undefined,
        });
        setExpForm({ category: "", amount: "", description: "" });
        toast.success("Expense added!");
      }
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getTitle = () => {
    switch (type) {
      case "ride": return "Log Ride";
      case "fuel": return "Log Fuel";
      case "maintenance": return "Log Maintenance";
      case "expense": return "Add Expense";
      default: return "";
    }
  };

  const getIcon = () => {
    switch (type) {
      case "ride": return <Route className="h-5 w-5" />;
      case "fuel": return <Fuel className="h-5 w-5" />;
      case "maintenance": return <Wrench className="h-5 w-5" />;
      case "expense": return <Plus className="h-5 w-5" />;
      default: return null;
    }
  };

  return (
    <Dialog open={type !== null} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {getIcon()}
            {getTitle()}
          </DialogTitle>
          <DialogDescription>
            {type === "ride" && "Record a new ride"}
            {type === "fuel" && "Record a fuel-up"}
            {type === "maintenance" && "Record maintenance work"}
            {type === "expense" && "Record a new expense"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* RIDE FORM */}
          {type === "ride" && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Odometer (km) *</Label>
                  <Input type="number" required value={rideForm.startOdometer}
                    onChange={(e) => setRideForm({ ...rideForm, startOdometer: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>End Odometer (km) *</Label>
                  <Input type="number" required value={rideForm.endOdometer}
                    onChange={(e) => setRideForm({ ...rideForm, endOdometer: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Duration (minutes) *</Label>
                <Input type="number" required value={rideForm.durationMinutes}
                  onChange={(e) => setRideForm({ ...rideForm, durationMinutes: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea value={rideForm.notes} placeholder="Route, weather..."
                  onChange={(e) => setRideForm({ ...rideForm, notes: e.target.value })} />
              </div>
            </>
          )}

          {/* FUEL FORM */}
          {type === "fuel" && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Odometer (km) *</Label>
                  <Input type="number" required value={fuelForm.odometer}
                    onChange={(e) => setFuelForm({ ...fuelForm, odometer: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Liters *</Label>
                  <Input type="number" step="0.1" required value={fuelForm.liters}
                    onChange={(e) => setFuelForm({ ...fuelForm, liters: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Price per Liter (₱) *</Label>
                <Input type="number" step="0.01" required value={fuelForm.pricePerLiter}
                  onChange={(e) => setFuelForm({ ...fuelForm, pricePerLiter: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Station</Label>
                <Input value={fuelForm.stationName} placeholder="Shell, Petron..."
                  onChange={(e) => setFuelForm({ ...fuelForm, stationName: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea value={fuelForm.notes}
                  onChange={(e) => setFuelForm({ ...fuelForm, notes: e.target.value })} />
              </div>
            </>
          )}

          {/* MAINTENANCE FORM */}
          {type === "maintenance" && (
            <>
              <div className="space-y-2">
                <Label>Maintenance Item *</Label>
                <Select value={maintForm.itemId}
                  onValueChange={(v) => setMaintForm({ ...maintForm, itemId: v })}>
                  <SelectTrigger><SelectValue placeholder="Select item..." /></SelectTrigger>
                  <SelectContent>
                    {maintenanceItems?.map((item) => (
                      <SelectItem key={item._id} value={item._id}>{item.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Odometer (km) *</Label>
                  <Input type="number" required value={maintForm.odometer}
                    onChange={(e) => setMaintForm({ ...maintForm, odometer: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Cost (₱)</Label>
                  <Input type="number" value={maintForm.cost}
                    onChange={(e) => setMaintForm({ ...maintForm, cost: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea value={maintForm.notes} placeholder="Work done, parts used..."
                  onChange={(e) => setMaintForm({ ...maintForm, notes: e.target.value })} />
              </div>
            </>
          )}

          {/* EXPENSE FORM */}
          {type === "expense" && (
            <>
              <div className="space-y-2">
                <Label>Category *</Label>
                <Select value={expForm.category}
                  onValueChange={(v) => setExpForm({ ...expForm, category: v })}>
                  <SelectTrigger><SelectValue placeholder="Select category..." /></SelectTrigger>
                  <SelectContent>
                    {EXPENSE_CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Amount (₱) *</Label>
                <Input type="number" step="0.01" required value={expForm.amount}
                  onChange={(e) => setExpForm({ ...expForm, amount: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea value={expForm.description} placeholder="What was this for?"
                  onChange={(e) => setExpForm({ ...expForm, description: e.target.value })} />
              </div>
            </>
          )}

          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={isSubmitting} className="flex-1">
              {isSubmitting ? "Saving..." : "Save"}
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
