"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

export default function NewFuelPage() {
  const router = useRouter();
  const logFuel = useMutation(api.fuel.logFuel);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    odometer: "",
    liters: "",
    pricePerLiter: "",
    stationName: "",
    notes: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await logFuel({
        odometer: Number(formData.odometer),
        liters: Number(formData.liters),
        pricePerLiter: Number(formData.pricePerLiter),
        date: Date.now(),
        stationName: formData.stationName || undefined,
        notes: formData.notes || undefined,
      });
      toast.success("Fuel log added successfully!");
      router.push("/dashboard");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to log fuel");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="flex flex-col p-4 md:p-8">
      <div className="mx-auto w-full max-w-2xl space-y-6">
        <PageHeader title="Log Fuel" description="Record a fuel-up" />

        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="odometer">Odometer (km)</Label>
                  <Input
                    id="odometer"
                    type="number"
                    required
                    value={formData.odometer}
                    onChange={(e) =>
                      setFormData({ ...formData, odometer: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="liters">Liters</Label>
                  <Input
                    id="liters"
                    type="number"
                    step="0.1"
                    required
                    value={formData.liters}
                    onChange={(e) =>
                      setFormData({ ...formData, liters: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="pricePerLiter">Price per Liter (₱)</Label>
                <Input
                  id="pricePerLiter"
                  type="number"
                  step="0.01"
                  required
                  value={formData.pricePerLiter}
                  onChange={(e) =>
                    setFormData({ ...formData, pricePerLiter: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="stationName">Station (optional)</Label>
                <Input
                  id="stationName"
                  value={formData.stationName}
                  onChange={(e) =>
                    setFormData({ ...formData, stationName: e.target.value })
                  }
                  placeholder="Shell, Petron, etc."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes (optional)</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                />
              </div>

              <div className="flex gap-3">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Saving..." : "Log Fuel"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push("/dashboard")}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
