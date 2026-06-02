"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { BikeProfileForm } from "@/components/setup/bike-profile-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function SetupPage() {
  const router = useRouter();
  const bike = useQuery(api.bike.getBike);

  useEffect(() => {
    if (bike) {
      router.replace("/dashboard");
    }
  }, [bike, router]);

  if (bike === undefined) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-4">
        <div className="w-full max-w-2xl space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-72" />
          <div className="space-y-4">
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-96 w-full" />
          </div>
        </div>
      </main>
    );
  }

  if (bike) {
    return null;
  }

  return (
    <main className="flex min-h-screen flex-col items-center p-4 py-12">
      <div className="w-full max-w-2xl space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Welcome to AdiV
          </h1>
          <p className="text-muted-foreground">
            Set up your Honda ADV160 profile to get started
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Bike Profile Setup</CardTitle>
            <CardDescription>
              Enter your bike details below. Required fields are marked with *.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <BikeProfileForm />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
