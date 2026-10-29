"use client";

import { useState, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LoaderCircle, Plus, Trash2 } from "lucide-react";

type MaintenanceItem = Doc<"maintenanceItems">;

interface MaintenanceItemEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item?: MaintenanceItem;
}

function parseOptionalInterval(value: string, label: string): number | undefined {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive whole number, or left blank.`);
  }
  return parsed;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}

export function MaintenanceItemEditor({
  open,
  onOpenChange,
  item,
}: MaintenanceItemEditorProps) {
  const createMaintenanceItem = useMutation(api.maintenance.createMaintenanceItem);
  const updateMaintenanceItem = useMutation(api.maintenance.updateMaintenanceItem);
  const deleteMaintenanceItem = useMutation(api.maintenance.deleteMaintenanceItem);
  const hasLogs = useQuery(
    api.maintenance.hasMaintenanceLogs,
    item ? { itemId: item._id } : "skip"
  );

  const [name, setName] = useState(item?.name ?? "");
  const [category, setCategory] = useState(item?.category ?? "");
  const [intervalKm, setIntervalKm] = useState(item?.intervalKm?.toString() ?? "");
  const [intervalMonths, setIntervalMonths] = useState(item?.intervalMonths?.toString() ?? "");
  const [intervalSource, setIntervalSource] = useState(item?.intervalSource ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [serviceLevel, setServiceLevel] = useState(item?.serviceLevel ?? "unassigned");
  const [notes, setNotes] = useState(item?.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    const trimmedCategory = category.trim();
    if (!trimmedName || !trimmedCategory) {
      setError("Enter an item name and category.");
      return;
    }

    let distanceInterval: number | undefined;
    let timeInterval: number | undefined;
    try {
      distanceInterval = parseOptionalInterval(intervalKm, "Distance interval");
      timeInterval = parseOptionalInterval(intervalMonths, "Time interval");
    } catch (validationError) {
      setError(errorMessage(validationError));
      return;
    }

    setIsSaving(true);
    const values = {
      name: trimmedName,
      category: trimmedCategory,
      intervalKm: distanceInterval,
      intervalMonths: timeInterval,
      intervalSource: intervalSource.trim() || undefined,
      description: description.trim() || undefined,
      serviceLevel: serviceLevel === "unassigned" ? undefined : serviceLevel,
      notes: notes.trim() || undefined,
    };

    try {
      if (item) {
        await updateMaintenanceItem({ itemId: item._id, ...values });
        toast.success("Maintenance schedule updated");
      } else {
        await createMaintenanceItem(values);
        toast.success("Maintenance item added");
      }
      onOpenChange(false);
    } catch (saveError) {
      const message = errorMessage(saveError);
      setError(message);
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!item || hasLogs !== false) return;
    setError(null);
    setIsDeleting(true);
    try {
      await deleteMaintenanceItem({ itemId: item._id });
      toast.success("Maintenance item deleted");
      onOpenChange(false);
    } catch (deleteError) {
      const message = errorMessage(deleteError);
      setError(message);
      toast.error(message);
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={isSaving || isDeleting ? undefined : onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-h-[calc(100dvh-2rem)] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{item ? "Edit maintenance schedule" : "Add maintenance item"}</DialogTitle>
          <DialogDescription>
            Set a distance interval, a time interval, or both. Leave both blank to exclude this item from reminder calculations.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Maintenance item" htmlFor="maintenance-item-name">
              <Input
                id="maintenance-item-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={120}
                autoComplete="off"
                required
                className="min-h-11"
              />
            </Field>
            <Field label="Category" htmlFor="maintenance-item-category">
              <Input
                id="maintenance-item-category"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                placeholder="engine, brakes, tires…"
                maxLength={60}
                autoComplete="off"
                required
                className="min-h-11"
              />
            </Field>
            <Field label="Distance interval (km)" htmlFor="maintenance-item-km">
              <Input
                id="maintenance-item-km"
                type="number"
                min="1"
                step="1"
                inputMode="numeric"
                value={intervalKm}
                onChange={(event) => setIntervalKm(event.target.value)}
                placeholder="Leave blank to skip"
                className="min-h-11"
              />
            </Field>
            <Field label="Time interval (months)" htmlFor="maintenance-item-months">
              <Input
                id="maintenance-item-months"
                type="number"
                min="1"
                step="1"
                inputMode="numeric"
                value={intervalMonths}
                onChange={(event) => setIntervalMonths(event.target.value)}
                placeholder="Leave blank to skip"
                className="min-h-11"
              />
            </Field>
            <Field label="Service level" htmlFor="maintenance-item-service-level">
              <Select value={serviceLevel} onValueChange={setServiceLevel}>
                <SelectTrigger id="maintenance-item-service-level" className="min-h-11 w-full cursor-pointer">
                  <SelectValue placeholder="Choose a service level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Not specified</SelectItem>
                  <SelectItem value="owner">Owner</SelectItem>
                  <SelectItem value="dealer">Dealer / mechanic</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Interval source (optional)" htmlFor="maintenance-item-source">
              <Input
                id="maintenance-item-source"
                value={intervalSource}
                onChange={(event) => setIntervalSource(event.target.value)}
                placeholder="Market/year, manual, page"
                maxLength={300}
                autoComplete="off"
                className="min-h-11"
              />
            </Field>
          </div>

          <p className="text-xs text-muted-foreground">
            After verifying a source, record its market, model year, manual title, and page.
            {item && !item.intervalSource && " This item has no source citation recorded yet."}
          </p>

          <Field label="Description (optional)" htmlFor="maintenance-item-description">
            <Textarea
              id="maintenance-item-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={1000}
              rows={2}
              className="min-h-20"
            />
          </Field>
          <Field label="Notes (optional)" htmlFor="maintenance-item-notes">
            <Textarea
              id="maintenance-item-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              maxLength={2000}
              rows={3}
              className="min-h-20"
            />
          </Field>

          {error && (
            <p role="alert" className="border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              {error}
            </p>
          )}

          {item && (
            <div className="space-y-2 border-t border-border pt-3">
              {hasLogs === true ? (
                <p className="text-xs text-muted-foreground">
                  This item has service history, so it cannot be deleted here. Its interval and details can still be edited.
                </p>
              ) : hasLogs === false ? (
                confirmDelete ? (
                  <div className="flex flex-col gap-2 rounded-none border border-destructive/30 bg-destructive/5 p-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs text-destructive">Delete this item? This action cannot be undone.</p>
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" className="min-h-11 cursor-pointer sm:min-h-9" onClick={() => setConfirmDelete(false)}>
                        Cancel
                      </Button>
                      <Button type="button" variant="destructive" className="min-h-11 cursor-pointer sm:min-h-9" disabled={isDeleting} onClick={handleDelete}>
                        {isDeleting ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Trash2 aria-hidden="true" />}
                        Delete
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button type="button" variant="destructive" className="min-h-11 w-full cursor-pointer sm:w-auto" onClick={() => setConfirmDelete(true)}>
                    <Trash2 aria-hidden="true" />Delete item
                  </Button>
                )
              ) : (
                <p className="text-xs text-muted-foreground">Checking service history before enabling deletion…</p>
              )}
            </div>
          )}

          <DialogFooter className="border-t border-border pt-3">
            <Button type="button" variant="outline" className="min-h-11 cursor-pointer sm:min-h-9" disabled={isSaving || isDeleting} onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" className="min-h-11 cursor-pointer sm:min-h-9" disabled={isSaving || isDeleting}>
              {isSaving ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : item ? null : <Plus aria-hidden="true" />}
              {isSaving ? "Saving…" : item ? "Save changes" : "Add item"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0 space-y-1.5">
      <label htmlFor={htmlFor} className="text-xs font-medium text-foreground">{label}</label>
      {children}
    </div>
  );
}
