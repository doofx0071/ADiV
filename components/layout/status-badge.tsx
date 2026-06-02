import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import {
  type MaintenanceStatus,
  statusBadgeVariants,
} from "@/lib/theme";

const statusBadgeCva = cva(
  "inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-none border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-all",
  {
    variants: {
      status: {
        upcoming: statusBadgeVariants.upcoming,
        due: statusBadgeVariants.due,
        overdue: statusBadgeVariants.overdue,
        completed: statusBadgeVariants.completed,
      },
    },
    defaultVariants: {
      status: "upcoming",
    },
  }
);

interface StatusBadgeProps
  extends React.ComponentProps<"span">,
    VariantProps<typeof statusBadgeCva> {
  status: MaintenanceStatus;
}

function StatusBadge({
  className,
  status,
  children,
  ...props
}: StatusBadgeProps) {
  const label =
    children ??
    status.charAt(0).toUpperCase() + status.slice(1);

  return (
    <span
      data-slot="status-badge"
      data-status={status}
      className={cn(statusBadgeCva({ status }), className)}
      {...props}
    >
      {label}
    </span>
  );
}

export { StatusBadge, statusBadgeCva };
export type { StatusBadgeProps };
