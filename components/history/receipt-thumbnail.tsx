"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface Props {
  storageId?: Id<"_storage">;
  alt?: string;
}

/**
 * Small clickable receipt thumbnail that opens a full-size viewer dialog.
 * Renders nothing when there is no receipt or the blob is missing.
 */
export function ReceiptThumbnail({ storageId, alt = "Expense receipt" }: Props) {
  const [open, setOpen] = useState(false);
  const url = useQuery(
    api.files.getFileUrl,
    storageId ? { storageId } : "skip"
  );

  if (!storageId || !url) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`View ${alt}`}
        className="h-10 w-10 shrink-0 cursor-pointer overflow-hidden rounded-md ring-1 ring-foreground/10 transition-all hover:ring-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] max-w-[calc(100vw-1.5rem)] overflow-auto p-0 sm:max-w-3xl">
          <DialogTitle className="sr-only">Receipt preview</DialogTitle>
          <DialogDescription className="sr-only">
            Enlarged view of the receipt
          </DialogDescription>
          <img
            src={url}
            alt={alt}
            className="h-auto max-h-[85dvh] w-full object-contain"
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
