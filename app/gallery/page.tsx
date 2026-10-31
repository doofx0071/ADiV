"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
  const receiptFiles = useQuery(api.files.getFilesByRecordType, { recordType: "expense" });
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  // Collect photo storage ids from maintenance logs, then resolve to URLs
  const storageIds = maintenanceLogs?.flatMap((log) => log.photos ?? []) ?? [];
  const fileUrls = useQuery(
    api.files.getFileUrls,
    storageIds.length > 0 ? { storageIds } : { storageIds: [] }
  );

  const urlById = new Map(fileUrls?.map((f) => [f.storageId, f.url]) ?? []);

  // Photos with a missing blob are skipped
  const photos =
    maintenanceLogs?.flatMap((log) =>
      (log.photos ?? []).flatMap((photo) => {
        const url = urlById.get(photo);
        return url ? [{ id: `${log._id}-${photo}`, url, odometer: log.odometer, date: log.date }] : [];
      })
    ) ?? [];

  // Receipts: resolve expense receipt storage ids to URLs
  const receiptStorageIds = receiptFiles?.map((f) => f.storageId) ?? [];
  const receiptUrls = useQuery(
    api.files.getFileUrls,
    receiptStorageIds.length > 0 ? { storageIds: receiptStorageIds } : { storageIds: [] }
  );
  const receiptUrlById = new Map(receiptUrls?.map((f) => [f.storageId, f.url]) ?? []);
  const receipts =
    receiptFiles
      ?.map((file) => ({ id: file._id, storageId: file.storageId, name: file.name }))
      .flatMap((file) => {
        const url = receiptUrlById.get(file.storageId);
        return url ? [{ ...file, url }] : [];
      }) ?? [];

  const isLoading =
    maintenanceLogs === undefined ||
    receiptFiles === undefined ||
    (storageIds.length > 0 && fileUrls === undefined) ||
    (receiptStorageIds.length > 0 && receiptUrls === undefined);

  return (
    <main className="flex flex-col p-3 sm:p-4 md:p-8">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <PageHeader
          title="Photo Gallery"
          description={`${photos.length} photo${photos.length !== 1 ? "s" : ""} · ${receipts.length} receipt${receipts.length !== 1 ? "s" : ""}`}
        />

        {isLoading ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5">
            {Array.from({ length: 10 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square w-full" />
            ))}
          </div>
        ) : (
          <Tabs defaultValue="photos">
            <TabsList>
              <TabsTrigger value="photos">Bike Photos</TabsTrigger>
              <TabsTrigger value="receipts">Receipts</TabsTrigger>
            </TabsList>

            <TabsContent value="photos">
              {photos.length > 0 ? (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5">
                  {photos.map((photo) => (
                    <button
                      key={photo.id}
                      onClick={() => setSelectedPhoto(photo.url)}
                      className="group relative aspect-square min-w-0 touch-manipulation overflow-hidden rounded-none bg-muted ring-1 ring-foreground/10 transition-all hover:ring-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <img
                        src={photo.url}
                        alt={`Maintenance at ${photo.odometer.toLocaleString()} km`}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        loading="lazy"
                      />
                      {/* Always visible on touch (no hover); revealed on hover/focus on desktop */}
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 opacity-100 transition-opacity duration-200 md:opacity-0 md:group-hover:opacity-100 md:group-focus-visible:opacity-100">
                        <p className="text-xs text-white font-medium sm:text-[10px]">
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
            </TabsContent>

            <TabsContent value="receipts">
              {receipts.length > 0 ? (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5">
                  {receipts.map((receipt) => (
                    <button
                      key={receipt.id}
                      onClick={() => setSelectedPhoto(receipt.url)}
                      className="group relative aspect-square min-w-0 touch-manipulation overflow-hidden rounded-none bg-muted ring-1 ring-foreground/10 transition-all hover:ring-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <img
                        src={receipt.url}
                        alt={receipt.name}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        loading="lazy"
                      />
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 opacity-100 transition-opacity duration-200 md:opacity-0 md:group-hover:opacity-100 md:group-focus-visible:opacity-100">
                        <p className="truncate text-xs text-white font-medium sm:text-[10px]">
                          {receipt.name}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                    <ImageIcon className="h-12 w-12 mb-4 opacity-40" />
                    <p className="text-sm font-medium">No receipts yet</p>
                    <p className="text-xs mt-1">
                      Attach a receipt when logging an expense to see it here
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>

      <Dialog open={!!selectedPhoto} onOpenChange={() => setSelectedPhoto(null)}>
        <DialogContent className="max-h-[90dvh] max-w-[calc(100vw-1.5rem)] overflow-auto p-0 sm:max-w-3xl">
          <DialogTitle className="sr-only">Photo preview</DialogTitle>
          <DialogDescription className="sr-only">
            Enlarged view of the selected image
          </DialogDescription>
          {selectedPhoto && (
            <img
              src={selectedPhoto}
              alt="Gallery image"
              className="h-auto max-h-[85dvh] w-full object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}
