"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const bikeProfileSchema = z.object({
  name: z.string().min(1, "Name is required"),
  year: z.string().min(1).refine((val) => {
    const num = Number(val);
    return num >= 2021 && num <= 2027;
  }, { message: "Year must be between 2021 and 2027" }),
  color: z.string().optional(),
  currentOdometer: z.string().min(1).refine((val) => Number(val) >= 0, {
    message: "Odometer must be 0 or greater",
  }),
  purchaseDate: z.string().optional(),
  lastServiceDate: z.string().optional(),
  vin: z.string().optional(),
  engineCc: z.string(),
  tireFront: z.string(),
  tireRear: z.string(),
  tirePressureFront: z.string(),
  tirePressureRear: z.string(),
  oilType: z.string(),
  oilCapacity: z.string(),
  coolantCapacity: z.string(),
  batteryType: z.string(),
  sparkPlugType: z.string(),
  fuelTankCapacity: z.string(),
});

export type BikeProfileFormValues = z.infer<typeof bikeProfileSchema>;

export function BikeProfileForm() {
  const router = useRouter();
  const createBike = useMutation(api.bike.createBike);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<BikeProfileFormValues>({
    resolver: zodResolver(bikeProfileSchema),
    defaultValues: {
      name: "My ADV160",
      year: "2024",
      color: "",
      currentOdometer: "0",
      purchaseDate: "",
      lastServiceDate: "",
      vin: "",
      engineCc: "157",
      tireFront: "110/80-14",
      tireRear: "130/70-13",
      tirePressureFront: "29",
      tirePressureRear: "33",
      oilType: "SAE 10W-30 JASO MB",
      oilCapacity: "0.75",
      coolantCapacity: "0.50",
      batteryType: "YTZ8V 12V 7.0Ah",
      sparkPlugType: "NGK LMAR8L-9",
      fuelTankCapacity: "8.1",
    },
  });

  async function onSubmit(values: BikeProfileFormValues) {
    setIsSubmitting(true);
    try {
      await createBike({
        name: values.name,
        model: "Honda ADV160",
        year: Number(values.year),
        color: values.color || undefined,
        vin: values.vin || undefined,
        purchaseDate: values.purchaseDate
          ? new Date(values.purchaseDate).getTime()
          : undefined,
        lastServiceDate: values.lastServiceDate
          ? new Date(values.lastServiceDate).getTime()
          : undefined,
        currentOdometer: Number(values.currentOdometer),
        engineCc: Number(values.engineCc),
        tireFront: values.tireFront,
        tireRear: values.tireRear,
        tirePressureFront: Number(values.tirePressureFront),
        tirePressureRear: Number(values.tirePressureRear),
        oilType: values.oilType,
        oilCapacity: Number(values.oilCapacity),
        coolantCapacity: Number(values.coolantCapacity),
        batteryType: values.batteryType,
        sparkPlugType: values.sparkPlugType,
        fuelTankCapacity: Number(values.fuelTankCapacity),
      });
      toast.success("Bike profile created successfully!");
      router.push("/dashboard");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create bike profile"
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Bike Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="My ADV160" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="year"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Year *</FormLabel>
                    <FormControl>
                      <Input type="number" min={2021} max={2027} {...field} />
                    </FormControl>
                    <FormDescription>2021 - 2027</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="color"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Color</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Matte Black" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="currentOdometer"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Current Odometer (km) *</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="purchaseDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Purchase Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="lastServiceDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last Service Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="vin"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>VIN</FormLabel>
                  <FormControl>
                    <Input placeholder="Vehicle Identification Number" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Technical Specifications */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Technical Specifications</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="engineCc"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Engine (cc)</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="fuelTankCapacity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fuel Tank Capacity (L)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.1" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Separator />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="tireFront"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Front Tire Size</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="tireRear"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rear Tire Size</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="tirePressureFront"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Front Tire Pressure (PSI)</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="tirePressureRear"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rear Tire Pressure (PSI)</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Separator />

            <FormField
              control={form.control}
              name="oilType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Oil Type</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="oilCapacity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Oil Capacity (L)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="coolantCapacity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Coolant Capacity (L)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Separator />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="batteryType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Battery Type</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="sparkPlugType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Spark Plug Type</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        <Button
          type="submit"
          className="w-full"
          disabled={isSubmitting}
          size="lg"
        >
          {isSubmitting ? "Saving..." : "Complete Setup"}
        </Button>
      </form>
    </Form>
  );
}
