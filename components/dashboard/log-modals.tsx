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
import { CalendarDatePicker } from "@/components/ui/calendar-date-picker";
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
import { Route, Fuel, Wrench, Plus, Camera, X } from "lucide-react";
import { format, parse } from "date-fns";

type ModalType = "ride" | "fuel" | "maintenance" | "expense" | null;

export type { ModalType };

const EXPENSE_CATEGORIES = [
  "Parts", "Accessories", "Insurance", "Parking",
  "Tolls", "Cleaning", "Tools", "Other",
];

const MAX_PHOTOS = 5;
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

interface PendingPhoto {
  file: File;
  storageId: Id<"_storage">;
}

interface Props {
  type: ModalType;
  onClose: () => void;
  initialMaintenanceItemId?: Id<"maintenanceItems">;
  maintenanceEntryMode?: "service" | "history";
}

export function LogModal({
  type,
  onClose,
  initialMaintenanceItemId,
  maintenanceEntryMode = "service",
}: Props) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const today = format(new Date(), "yyyy-MM-dd");

  // Ride form
  const [rideForm, setRideForm] = useState({ startOdometer: "", endOdometer: "", durationMinutes: "", notes: "" });
  const [rideDate, setRideDate] = useState(today);
  const logRide = useMutation(api.rides.logRide);

  // Fuel form
  const [fuelForm, setFuelForm] = useState({ odometer: "", liters: "", pricePerLiter: "", stationName: "", notes: "" });
  const [fuelDate, setFuelDate] = useState(today);
  const logFuel = useMutation(api.fuel.logFuel);

  // Maintenance form
  const [maintForm, setMaintForm] = useState({
    itemId: initialMaintenanceItemId ?? "",
    odometer: "",
    cost: "",
    notes: "",
  });
  const [maintDate, setMaintDate] = useState(maintenanceEntryMode === "history" ? "" : today);
  const [maintPhotos, setMaintPhotos] = useState<PendingPhoto[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const maintenanceItems = useQuery(api.maintenance.getMaintenanceItems);
  const logMaintenance = useMutation(api.maintenance.logMaintenance);
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const registerFile = useMutation(api.files.registerFile);

  // Expense form
  const [expForm, setExpForm] = useState({ category: "", amount: "", description: "" });
  const [expDate, setExpDate] = useState(today);
  const addExpense = useMutation(api.expenses.addExpense);

  const toDateMs = (dateStr: string) => parse(dateStr, "yyyy-MM-dd", new Date()).getTime();

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    const room = MAX_PHOTOS - maintPhotos.length;
    if (room <= 0) {
      toast.error(`Maximum ${MAX_PHOTOS} photos per log`);
      return;
    }
    const accepted = files.slice(0, room);
    if (files.length > room) {
      toast.error(`Maximum ${MAX_PHOTOS} photos per log`);
    }

    setIsUploading(true);
    try {
      for (const file of accepted) {
        if (file.size > MAX_PHOTO_BYTES) {
          toast.error(`${file.name} exceeds the 5MB limit`);
          continue;
        }
        const uploadUrl = await generateUploadUrl();
        const res = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": file.type },
          body: file,
        });
        if (!res.ok) throw new Error(`Upload failed for ${file.name}`);
        const { storageId } = await res.json();
        setMaintPhotos((prev) => [...prev, { file, storageId: storageId as Id<"_storage"> }]);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Photo upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  const removePhoto = (storageId: string) => {
    setMaintPhotos((prev) => prev.filter((p) => p.storageId !== storageId));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (type === "ride") {
        await logRide({
          startOdometer: Number(rideForm.startOdometer),
          endOdometer: Number(rideForm.endOdometer),
          date: toDateMs(rideDate),
          durationMinutes: Number(rideForm.durationMinutes),
          notes: rideForm.notes || undefined,
        });
        setRideForm({ startOdometer: "", endOdometer: "", durationMinutes: "", notes: "" });
        setRideDate(today);
        toast.success("Ride logged!");
      } else if (type === "fuel") {
        await logFuel({
          odometer: Number(fuelForm.odometer),
          liters: Number(fuelForm.liters),
          pricePerLiter: Number(fuelForm.pricePerLiter),
          date: toDateMs(fuelDate),
          stationName: fuelForm.stationName || undefined,
          notes: fuelForm.notes || undefined,
        });
        setFuelForm({ odometer: "", liters: "", pricePerLiter: "", stationName: "", notes: "" });
        setFuelDate(today);
        toast.success("Fuel log added!");
      } else if (type === "maintenance") {
        if (!maintForm.itemId) { toast.error("Select a maintenance item"); return; }
        if (!maintDate) { toast.error("Select the confirmed service date"); return; }
        const serviceOdometer = Number(maintForm.odometer);
        if (!Number.isFinite(serviceOdometer) || serviceOdometer < 0) {
          toast.error("Enter the confirmed service odometer");
          return;
        }
        const logId = await logMaintenance({
          itemId: maintForm.itemId as Id<"maintenanceItems">,
          odometer: serviceOdometer,
          date: toDateMs(maintDate),
          cost: maintForm.cost ? Number(maintForm.cost) : undefined,
          notes: maintForm.notes || undefined,
          photos: maintPhotos.length > 0 ? maintPhotos.map((p) => p.storageId) : undefined,
        });
        // Attach file metadata now that we have a log id to reference
        await Promise.all(
          maintPhotos.map((photo) =>
            registerFile({
              storageId: photo.storageId,
              name: photo.file.name,
              type: photo.file.type,
              size: photo.file.size,
              recordType: "maintenanceLog",
              recordId: logId,
            })
          )
        );
        setMaintForm({ itemId: "", odometer: "", cost: "", notes: "" });
        setMaintDate(today);
        setMaintPhotos([]);
        toast.success("Maintenance logged!");
      } else if (type === "expense") {
        if (!expForm.category) { toast.error("Select a category"); return; }
        await addExpense({
          category: expForm.category,
          amount: Number(expForm.amount),
          date: toDateMs(expDate),
          description: expForm.description || undefined,
        });
        setExpForm({ category: "", amount: "", description: "" });
        setExpDate(today);
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
            {type === "maintenance" && maintenanceEntryMode === "history" &&
              "Enter a confirmed past service date and odometer. Unknown values stay unrecorded."}
            {type === "maintenance" && maintenanceEntryMode === "service" &&
              "Record the completed service date, odometer, and details."}
            {type === "expense" && "Record a new expense"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* RIDE FORM */}
          {type === "ride" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="ride-date">Date *</Label>
                <CalendarDatePicker id="ride-date" required max={today} value={rideDate}
                  onChange={setRideDate} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="ride-start-odometer">Start Odometer (km) *</Label>
                  <Input id="ride-start-odometer" name="startOdometer" type="number" inputMode="numeric" required
                    value={rideForm.startOdometer}
                    onChange={(e) => setRideForm({ ...rideForm, startOdometer: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ride-end-odometer">End Odometer (km) *</Label>
                  <Input id="ride-end-odometer" name="endOdometer" type="number" inputMode="numeric" required
                    value={rideForm.endOdometer}
                    onChange={(e) => setRideForm({ ...rideForm, endOdometer: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ride-duration">Duration (minutes) *</Label>
                <Input id="ride-duration" name="durationMinutes" type="number" inputMode="numeric" required
                  value={rideForm.durationMinutes}
                  onChange={(e) => setRideForm({ ...rideForm, durationMinutes: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ride-notes">Notes</Label>
                <Textarea id="ride-notes" name="notes" value={rideForm.notes} placeholder="Route, weather..."
                  onChange={(e) => setRideForm({ ...rideForm, notes: e.target.value })} />
              </div>
            </>
          )}

          {/* FUEL FORM */}
          {type === "fuel" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="fuel-date">Date *</Label>
                <CalendarDatePicker id="fuel-date" required max={today} value={fuelDate}
                  onChange={setFuelDate} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fuel-odometer">Odometer (km) *</Label>
                  <Input id="fuel-odometer" name="odometer" type="number" inputMode="numeric" required
                    value={fuelForm.odometer}
                    onChange={(e) => setFuelForm({ ...fuelForm, odometer: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fuel-liters">Liters *</Label>
                  <Input id="fuel-liters" name="liters" type="number" step="0.1" inputMode="decimal" required
                    value={fuelForm.liters}
                    onChange={(e) => setFuelForm({ ...fuelForm, liters: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="fuel-price">Price per Liter (₱) *</Label>
                <Input id="fuel-price" name="pricePerLiter" type="number" step="0.01" inputMode="decimal" required
                  value={fuelForm.pricePerLiter}
                  onChange={(e) => setFuelForm({ ...fuelForm, pricePerLiter: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fuel-station">Station</Label>
                <Input id="fuel-station" name="stationName" value={fuelForm.stationName} placeholder="Shell, Petron..."
                  onChange={(e) => setFuelForm({ ...fuelForm, stationName: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fuel-notes">Notes</Label>
                <Textarea id="fuel-notes" name="notes" value={fuelForm.notes}
                  onChange={(e) => setFuelForm({ ...fuelForm, notes: e.target.value })} />
              </div>
            </>
          )}

          {/* MAINTENANCE FORM */}
          {type === "maintenance" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="maint-item">Maintenance Item *</Label>
                <Select value={maintForm.itemId}
                  onValueChange={(v) => setMaintForm({ ...maintForm, itemId: v })}>
                  <SelectTrigger id="maint-item" className="h-11 min-h-11 w-full cursor-pointer">
                    <SelectValue placeholder="Select item..." />
                  </SelectTrigger>
                  <SelectContent>
                    {maintenanceItems?.map((item) => (
                      <SelectItem key={item._id} value={item._id}>{item.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="maint-date">{maintenanceEntryMode === "history" ? "Confirmed service date *" : "Date *"}</Label>
                <CalendarDatePicker id="maint-date" required max={today} value={maintDate}
                  className="h-11 min-h-11 cursor-pointer text-sm"
                  onChange={setMaintDate} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="maint-odometer">{maintenanceEntryMode === "history" ? "Confirmed service odometer (km) *" : "Odometer (km) *"}</Label>
                  <Input id="maint-odometer" name="odometer" type="number" min="0" step="any" inputMode="decimal" required
                    className="h-11 min-h-11 text-sm"
                    value={maintForm.odometer}
                    onChange={(e) => setMaintForm({ ...maintForm, odometer: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maint-cost">Cost (₱)</Label>
                  <Input id="maint-cost" name="cost" type="number" step="0.01" inputMode="decimal"
                    className="h-11 min-h-11 text-sm"
                    value={maintForm.cost}
                    onChange={(e) => setMaintForm({ ...maintForm, cost: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="maint-notes">Notes</Label>
                <Textarea id="maint-notes" name="notes" value={maintForm.notes} placeholder="Work done, parts used..."
                  onChange={(e) => setMaintForm({ ...maintForm, notes: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="maint-photos">Photos (up to {MAX_PHOTOS})</Label>
                <input
                  id="maint-photos"
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handlePhotoSelect}
                  disabled={isUploading || maintPhotos.length >= MAX_PHOTOS}
                  className="block min-h-11 w-full cursor-pointer text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-2 file:text-sm file:font-medium file:text-secondary-foreground hover:file:bg-secondary/80"
                />
                {maintPhotos.length > 0 && (
                  <ul className="space-y-1.5">
                    {maintPhotos.map((photo) => (
                      <li key={photo.storageId} className="flex items-center justify-between rounded-md border px-3 py-1.5 text-sm">
                        <span className="flex items-center gap-2 min-w-0">
                          <Camera className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                          <span className="truncate">{photo.file.name}</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => removePhoto(photo.storageId)}
                          aria-label={`Remove ${photo.file.name}`}
                          className="min-h-11 min-w-11 shrink-0 cursor-pointer rounded p-1 hover:bg-muted"
                        >
                          <X className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {isUploading && <p className="text-xs text-muted-foreground">Uploading…</p>}
              </div>
            </>
          )}

          {/* EXPENSE FORM */}
          {type === "expense" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="exp-date">Date *</Label>
                <CalendarDatePicker id="exp-date" required max={today} value={expDate}
                  onChange={setExpDate} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="exp-category">Category *</Label>
                <Select value={expForm.category}
                  onValueChange={(v) => setExpForm({ ...expForm, category: v })}>
                  <SelectTrigger id="exp-category"><SelectValue placeholder="Select category..." /></SelectTrigger>
                  <SelectContent>
                    {EXPENSE_CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="exp-amount">Amount (₱) *</Label>
                <Input id="exp-amount" name="amount" type="number" step="0.01" inputMode="decimal" required
                  value={expForm.amount}
                  onChange={(e) => setExpForm({ ...expForm, amount: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="exp-description">Description</Label>
                <Textarea id="exp-description" name="description" value={expForm.description} placeholder="What was this for?"
                  onChange={(e) => setExpForm({ ...expForm, description: e.target.value })} />
              </div>
            </>
          )}

          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={isSubmitting || isUploading} className="min-h-11 flex-1 cursor-pointer">
              {isSubmitting ? "Saving..." : "Save"}
            </Button>
            <Button type="button" variant="outline" className="min-h-11 cursor-pointer" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
