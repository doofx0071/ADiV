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

export default function NewRidePage() {
  const router = useRouter();
  const logRide = useMutation(api.rides.logRide);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    startOdometer: "",
    endOdometer: "",
    durationMinutes: "",
    notes: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await logRide({
        startOdometer: Number(formData.startOdometer),
        endOdometer: Number(formData.endOdometer),
        date: Date.now(),
        durationMinutes: Number(formData.durationMinutes),
        notes: formData.notes || undefined,
      });
      toast.success("Ride logged successfully!");
      router.push("/dashboard");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to log ride");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="flex flex-col p-4 md:p-8">
      <div className="mx-auto w-full max-w-2xl space-y-6">
        <PageHeader title="Log Ride" description="Record a new ride" />

        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startOdometer">Start Odometer (km)</Label>
                  <Input
                    id="startOdometer"
                    type="number"
                    required
                    value={formData.startOdometer}
                    onChange={(e) =>
                      setFormData({ ...formData, startOdometer: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endOdometer">End Odometer (km)</Label>
                  <Input
                    id="endOdometer"
                    type="number"
                    required
                    value={formData.endOdometer}
                    onChange={(e) =>
                      setFormData({ ...formData, endOdometer: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="durationMinutes">Duration (minutes)</Label>
                <Input
                  id="durationMinutes"
                  type="number"
                  required
                  value={formData.durationMinutes}
                  onChange={(e) =>
                    setFormData({ ...formData, durationMinutes: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes (optional)</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Route, weather, observations..."
                />
              </div>

              <div className="flex gap-3">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Saving..." : "Log Ride"}
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
