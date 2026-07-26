"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

export default function NewMaintenancePage() {
  const router = useRouter();
  const logMaintenance = useMutation(api.maintenance.logMaintenance);
  const maintenanceItems = useQuery(api.maintenance.getMaintenanceItems);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    itemId: "",
    odometer: "",
    cost: "",
    notes: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.itemId) {
      toast.error("Please select a maintenance item");
      return;
    }

    setIsSubmitting(true);

    try {
      await logMaintenance({
        itemId: formData.itemId as any,
        odometer: Number(formData.odometer),
        date: Date.now(),
        cost: formData.cost ? Number(formData.cost) : undefined,
        notes: formData.notes || undefined,
      });
      toast.success("Maintenance logged successfully!");
      router.push("/dashboard");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to log maintenance");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="flex flex-col p-4 md:p-8">
      <div className="mx-auto w-full max-w-2xl space-y-6">
        <PageHeader title="Log Maintenance" description="Record maintenance work" />

        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="item">Maintenance Item</Label>
                <Select
                  value={formData.itemId}
                  onValueChange={(value) =>
                    setFormData({ ...formData, itemId: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select an item" />
                  </SelectTrigger>
                  <SelectContent>
                    {maintenanceItems?.map((item) => (
                      <SelectItem key={item._id} value={item._id}>
                        {item.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

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
                  <Label htmlFor="cost">Cost (₱) (optional)</Label>
                  <Input
                    id="cost"
                    type="number"
                    value={formData.cost}
                    onChange={(e) =>
                      setFormData({ ...formData, cost: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes (optional)</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="What was done, parts used, etc."
                />
              </div>

              <div className="flex gap-3">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Saving..." : "Log Maintenance"}
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
