"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ImageIcon } from "lucide-react";

export default function GalleryPage() {
  const maintenanceLogs = useQuery(api.maintenance.getAllMaintenanceLogs, { limit: 1000 });
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  // Collect all photos from maintenance logs
  const photos =
    maintenanceLogs?.flatMap((log) =>
      (log.photos ?? []).map((photo, idx) => ({
        id: `${log._id}-${idx}`,
        url: photo,
        logId: log._id,
        odometer: log.odometer,
        date: log.date,
      }))
    ) ?? [];

  const isLoading = maintenanceLogs === undefined;

  return (
    <main className="flex flex-col p-4 md:p-8">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <PageHeader
          title="Photo Gallery"
          description={`${photos.length} photo${photos.length !== 1 ? "s" : ""} from maintenance logs`}
        />

        {isLoading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {Array.from({ length: 10 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square w-full" />
            ))}
          </div>
        ) : photos.length > 0 ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {photos.map((photo) => (
              <button
                key={photo.id}
                onClick={() => setSelectedPhoto(photo.url)}
                className="group relative aspect-square overflow-hidden rounded-none bg-muted ring-1 ring-foreground/10 transition-all hover:ring-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <img
                  src={photo.url}
                  alt={`Maintenance at ${photo.odometer.toLocaleString()} km`}
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  loading="lazy"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                  <p className="text-[10px] text-white font-medium">
                    {photo.odometer.toLocaleString()} km
                  </p>
                  <p className="text-[10px] text-white/80">
                    {new Date(photo.date).toLocaleDateString()}
                  </p>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <ImageIcon className="h-12 w-12 mb-4 opacity-40" />
              <p className="text-sm font-medium">No photos yet</p>
              <p className="text-xs mt-1">
                Add photos to maintenance logs to build your gallery
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={!!selectedPhoto} onOpenChange={() => setSelectedPhoto(null)}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden">
          <DialogTitle className="sr-only">Photo preview</DialogTitle>
          <DialogDescription className="sr-only">
            Enlarged view of the selected maintenance photo
          </DialogDescription>
          {selectedPhoto && (
            <img
              src={selectedPhoto}
              alt="Maintenance photo"
              className="w-full h-auto max-h-[80vh] object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}
