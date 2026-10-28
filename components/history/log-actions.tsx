"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
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
import { Pencil, Trash2 } from "lucide-react";

const EXPENSE_CATEGORIES = [
  "Parts", "Accessories", "Insurance", "Parking",
  "Tolls", "Cleaning", "Tools", "Other",
];

/** A history entry with only the fields its backend mutation can edit. */
export type HistoryLog =
  | { type: "maintenance"; id: Id<"maintenanceLogs">; cost?: number; notes?: string }
  | { type: "ride"; id: Id<"rides">; notes?: string }
  | { type: "fuel"; id: Id<"fuelLogs">; stationName?: string; notes?: string }
  | { type: "expense"; id: Id<"expenses">; category: string; amount: number; description?: string };

interface Props {
  log: HistoryLog;
}

export function LogActions({ log }: Props) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const updateMaintenanceLog = useMutation(api.maintenance.updateMaintenanceLog);
  const deleteMaintenanceLog = useMutation(api.maintenance.deleteMaintenanceLog);
  const updateRide = useMutation(api.rides.updateRide);
  const deleteRide = useMutation(api.rides.deleteRide);
  const updateFuelLog = useMutation(api.fuel.updateFuelLog);
  const deleteFuelLog = useMutation(api.fuel.deleteFuelLog);
  const updateExpense = useMutation(api.expenses.updateExpense);
  const deleteExpense = useMutation(api.expenses.deleteExpense);

  const [cost, setCost] = useState(log.type === "maintenance" ? String(log.cost ?? "") : "");
  const [notes, setNotes] = useState(log.type === "maintenance" || log.type === "ride" || log.type === "fuel" ? (log.notes ?? "") : "");
  const [stationName, setStationName] = useState(log.type === "fuel" ? (log.stationName ?? "") : "");
  const [category, setCategory] = useState(log.type === "expense" ? log.category : "");
  const [amount, setAmount] = useState(log.type === "expense" ? String(log.amount) : "");
  const [description, setDescription] = useState(log.type === "expense" ? (log.description ?? "") : "");

  const typeLabel = log.type === "maintenance" ? "maintenance log" : log.type === "expense" ? "expense" : log.type;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (log.type === "maintenance") {
        await updateMaintenanceLog({
          logId: log.id,
          cost: cost ? Number(cost) : undefined,
          notes: notes || undefined,
        });
      } else if (log.type === "ride") {
        await updateRide({ rideId: log.id, notes: notes || undefined });
      } else if (log.type === "fuel") {
        await updateFuelLog({
          fuelLogId: log.id,
          stationName: stationName || undefined,
          notes: notes || undefined,
        });
      } else {
        await updateExpense({
          expenseId: log.id,
          category: category || undefined,
          amount: amount ? Number(amount) : undefined,
          description: description || undefined,
        });
      }
      toast.success("Entry updated");
      setEditOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Update failed");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      if (log.type === "maintenance") await deleteMaintenanceLog({ logId: log.id });
      else if (log.type === "ride") await deleteRide({ rideId: log.id });
      else if (log.type === "fuel") await deleteFuelLog({ fuelLogId: log.id });
      else await deleteExpense({ expenseId: log.id });
      toast.success("Entry deleted");
      setDeleteOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Delete failed");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex shrink-0 items-center gap-1">
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        aria-label={`Edit ${typeLabel}`}
        onClick={() => setEditOpen(true)}
      >
        <Pencil className="h-4 w-4" aria-hidden="true" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-destructive hover:text-destructive"
        aria-label={`Delete ${typeLabel}`}
        onClick={() => setDeleteOpen(true)}
      >
        <Trash2 className="h-4 w-4" aria-hidden="true" />
      </Button>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit entry</DialogTitle>
            <DialogDescription>
              {log.type === "maintenance" && "Update the cost and notes for this service."}
              {log.type === "ride" && "Update the notes for this ride."}
              {log.type === "fuel" && "Update the station and notes for this fuel-up."}
              {log.type === "expense" && "Update the category, amount, or description."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {log.type === "maintenance" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="edit-cost">Cost (₱)</Label>
                  <Input id="edit-cost" type="number" step="0.01" inputMode="decimal" value={cost}
                    onChange={(e) => setCost(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-notes">Notes</Label>
                  <Textarea id="edit-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
                </div>
              </>
            )}
            {log.type === "ride" && (
              <div className="space-y-2">
                <Label htmlFor="edit-notes">Notes</Label>
                <Textarea id="edit-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
            )}
            {log.type === "fuel" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="edit-station">Station</Label>
                  <Input id="edit-station" value={stationName} placeholder="Shell, Petron..."
                    onChange={(e) => setStationName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-notes">Notes</Label>
                  <Textarea id="edit-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
                </div>
              </>
            )}
            {log.type === "expense" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="edit-category">Category</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger id="edit-category"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {EXPENSE_CATEGORIES.map((cat) => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-amount">Amount (₱)</Label>
                  <Input id="edit-amount" type="number" step="0.01" inputMode="decimal" value={amount}
                    onChange={(e) => setAmount(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-description">Description</Label>
                  <Textarea id="edit-description" value={description}
                    onChange={(e) => setDescription(e.target.value)} />
                </div>
              </>
            )}
            <div className="flex gap-3">
              <Button onClick={handleSave} disabled={isSaving} className="flex-1">
                {isSaving ? "Saving..." : "Save"}
              </Button>
              <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete entry?</DialogTitle>
            <DialogDescription>
              This permanently removes the {typeLabel}
              {log.type === "maintenance" && " and its attached photos"}. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 pt-2">
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting} className="flex-1">
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
