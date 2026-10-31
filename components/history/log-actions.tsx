"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
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
import { Pencil, Receipt, Trash2 } from "lucide-react";

const EXPENSE_CATEGORIES = [
  "Parts", "Accessories", "Insurance", "Parking",
  "Tolls", "Cleaning", "Tools", "Other",
];

const MAX_RECEIPT_BYTES = 5 * 1024 * 1024;

/** A history entry with only the fields its backend mutation can edit. */
export type HistoryLog =
  | { type: "maintenance"; id: Id<"maintenanceLogs">; cost?: number; notes?: string }
  | { type: "ride"; id: Id<"rides">; notes?: string }
  | { type: "fuel"; id: Id<"fuelLogs">; stationName?: string; notes?: string }
  | {
      type: "expense";
      id: Id<"expenses">;
      category: string;
      amount: number;
      description?: string;
      receiptPhoto?: Id<"_storage">;
    };

interface Props {
  log: HistoryLog;
}

export function LogActions({ log }: Props) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isReceiptBusy, setIsReceiptBusy] = useState(false);

  const updateMaintenanceLog = useMutation(api.maintenance.updateMaintenanceLog);
  const deleteMaintenanceLog = useMutation(api.maintenance.deleteMaintenanceLog);
  const updateRide = useMutation(api.rides.updateRide);
  const deleteRide = useMutation(api.rides.deleteRide);
  const updateFuelLog = useMutation(api.fuel.updateFuelLog);
  const deleteFuelLog = useMutation(api.fuel.deleteFuelLog);
  const updateExpense = useMutation(api.expenses.updateExpense);
  const deleteExpense = useMutation(api.expenses.deleteExpense);
  const attachExpenseReceipt = useMutation(api.expenses.attachExpenseReceipt);
  const removeExpenseReceipt = useMutation(api.expenses.removeExpenseReceipt);
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);

  const receiptPhoto = log.type === "expense" ? log.receiptPhoto : undefined;
  const receiptUrl = useQuery(
    api.files.getFileUrl,
    receiptPhoto ? { storageId: receiptPhoto } : "skip"
  );

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

  const handleReceiptChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (log.type !== "expense") return;
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > MAX_RECEIPT_BYTES) {
      toast.error(`${file.name} exceeds the 5MB limit`);
      return;
    }
    setIsReceiptBusy(true);
    try {
      const uploadUrl = await generateUploadUrl();
      const res = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!res.ok) throw new Error(`Upload failed for ${file.name}`);
      const { storageId } = await res.json();
      await attachExpenseReceipt({
        expenseId: log.id,
        storageId,
        name: file.name,
        type: file.type,
        size: file.size,
      });
      toast.success("Receipt attached");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Receipt upload failed");
    } finally {
      setIsReceiptBusy(false);
    }
  };

  const handleReceiptRemove = async () => {
    if (log.type !== "expense") return;
    setIsReceiptBusy(true);
    try {
      await removeExpenseReceipt({ expenseId: log.id });
      toast.success("Receipt removed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to remove receipt");
    } finally {
      setIsReceiptBusy(false);
    }
  };

  return (
    <div className="flex shrink-0 items-center gap-1">
      {log.type === "expense" && receiptPhoto && (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          aria-label={`View receipt for ${typeLabel}`}
          onClick={() => setViewerOpen(true)}
        >
          <Receipt className="h-4 w-4" aria-hidden="true" />
        </Button>
      )}
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
                <div className="space-y-2">
                  <Label htmlFor="edit-receipt">Receipt</Label>
                  {receiptPhoto ? (
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="min-h-11 cursor-pointer"
                        onClick={() => setViewerOpen(true)}
                      >
                        <Receipt className="h-4 w-4" aria-hidden="true" />
                        View current
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="min-h-11 cursor-pointer text-destructive hover:text-destructive"
                        disabled={isReceiptBusy}
                        onClick={handleReceiptRemove}
                      >
                        Remove
                      </Button>
                    </div>
                  ) : null}
                  <input
                    id="edit-receipt"
                    type="file"
                    accept="image/*"
                    onChange={handleReceiptChange}
                    disabled={isReceiptBusy}
                    className="block min-h-11 w-full cursor-pointer text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-2 file:text-sm file:font-medium file:text-secondary-foreground hover:file:bg-secondary/80"
                  />
                  <p className="text-xs text-muted-foreground">
                    {receiptPhoto
                      ? "Attaching a new image replaces the current receipt."
                      : "Attach an image of the receipt (max 5MB). Changes apply immediately."}
                  </p>
                  {isReceiptBusy && <p className="text-xs text-muted-foreground">Working…</p>}
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
              {log.type === "maintenance" && " and its attached photos"}
              {log.type === "expense" && " and its receipt"}. This cannot be undone.
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

      {/* Receipt viewer */}
      <Dialog open={viewerOpen} onOpenChange={setViewerOpen}>
        <DialogContent className="max-h-[90dvh] max-w-[calc(100vw-1.5rem)] overflow-auto p-0 sm:max-w-3xl">
          <DialogTitle className="sr-only">Receipt preview</DialogTitle>
          <DialogDescription className="sr-only">
            Enlarged view of the expense receipt
          </DialogDescription>
          {receiptUrl ? (
            <img
              src={receiptUrl}
              alt="Expense receipt"
              className="h-auto max-h-[85dvh] w-full object-contain"
            />
          ) : (
            <p className="p-6 text-sm text-muted-foreground">Receipt image is unavailable.</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
