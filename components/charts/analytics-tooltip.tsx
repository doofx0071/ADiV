"use client";

import type { CustomTooltipProps } from "@tremor/react";

export function AnalyticsTooltip({
  active,
  payload,
  label,
  formatValue = (value) => String(value),
}: CustomTooltipProps & {
  formatValue?: (value: number | string) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="min-w-36 rounded-md border border-border bg-popover p-3 text-popover-foreground shadow-lg">
      <p className="mb-2 text-xs font-semibold">{label}</p>
      <div className="space-y-1.5">
        {payload.map((item) => (
          <div key={item.name} className="flex items-center justify-between gap-4 text-xs">
            <span className="flex items-center gap-2 text-muted-foreground">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
              {item.name}
            </span>
            <span className="font-medium tabular-nums">
              {formatValue(
                typeof item.value === "number" || typeof item.value === "string"
                  ? item.value
                  : 0
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
