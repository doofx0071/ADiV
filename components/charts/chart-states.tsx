"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

/** Loading body for a chart card — pulsing placeholder bars. */
export function ChartSkeletonBody() {
  return (
    <div
      className="flex h-64 flex-col justify-end gap-3"
      aria-busy="true"
      aria-label="Loading chart"
    >
      <div className="h-16 w-3/4 animate-pulse rounded bg-muted" />
      <div className="h-28 w-full animate-pulse rounded bg-muted" />
      <div className="h-40 w-5/6 animate-pulse rounded bg-muted" />
    </div>
  );
}

interface ChartEmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  ctaLabel: string;
}

/** Empty body for a chart card, with a CTA back to the dashboard loggers. */
export function ChartEmptyState({
  icon,
  title,
  description,
  ctaLabel,
}: ChartEmptyStateProps) {
  return (
    <div className="flex h-64 flex-col items-center justify-center gap-2 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground [&_svg]:h-5 [&_svg]:w-5">
        {icon}
      </div>
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="max-w-xs text-xs text-muted-foreground">{description}</p>
      <Button asChild size="sm" variant="outline" className="mt-2">
        <Link href="/dashboard">{ctaLabel}</Link>
      </Button>
    </div>
  );
}
