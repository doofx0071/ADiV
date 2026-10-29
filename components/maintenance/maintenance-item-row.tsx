import Link from "next/link";
import type { Id } from "@/convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/layout/status-badge";
import type { MaintenanceBaselineItem, MaintenanceEvaluation } from "@/lib/reminders";
import { formatDueText } from "@/lib/reminders";
import { CalendarDays, Gauge, History, Pencil, Wrench } from "lucide-react";

type MaintenanceRowItem = MaintenanceBaselineItem & {
  _id: Id<"maintenanceItems">;
  name: string;
  category: string;
  description?: string;
  intervalSource?: string;
};

interface MaintenanceItemRowProps<T extends MaintenanceRowItem> {
  evaluation: MaintenanceEvaluation<T>;
  onLogService: (itemId: T["_id"], mode: "service" | "history") => void;
  onEditItem?: (item: T) => void;
  showProgress?: boolean;
}

export function MaintenanceItemRow<T extends MaintenanceRowItem>({
  evaluation,
  onLogService,
  onEditItem,
  showProgress = false,
}: MaintenanceItemRowProps<T>) {
  const { item } = evaluation;
  const hasConfiguredInterval = (item.intervalKm ?? 0) > 0 || (item.intervalMonths ?? 0) > 0;
  const hasKnownDue = evaluation.dueInKm !== null || evaluation.dueInDays !== null;
  const progress = Math.min(100, Math.max(0, evaluation.urgencyScore * 100));
  const missingText = evaluation.missingBaseline.map((field) =>
    field === "service-date" ? "last service date" : "last service odometer"
  ).join(" and ");

  return (
    <article className="min-w-0 border border-foreground/10 bg-card p-3 sm:p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/maintenance/${item._id}`}
              className="min-h-11 min-w-0 cursor-pointer truncate font-medium text-foreground underline-offset-4 hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-0"
            >
              {item.name}
            </Link>
            <Badge variant="secondary" className="shrink-0">{item.category}</Badge>
            {evaluation.status === "needs-history" ? (
              <Badge variant="outline" className="gap-1 border-warning/50 text-warning-foreground">
                <History aria-hidden="true" />Needs history
              </Badge>
            ) : evaluation.status === "clear" ? (
              <Badge variant="secondary">{hasConfiguredInterval ? "On track" : "No interval"}</Badge>
            ) : (
              <StatusBadge status={evaluation.status} />
            )}
            {!evaluation.historyComplete && evaluation.status !== "needs-history" && (
              <Badge variant="outline" className="border-warning/50 text-warning-foreground">
                Needs history
              </Badge>
            )}
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {evaluation.dueAtOdometer !== null && (
              <span className="inline-flex items-center gap-1">
                <Gauge aria-hidden="true" className="h-3.5 w-3.5" />
                Due at {evaluation.dueAtOdometer.toLocaleString()} km
              </span>
            )}
            {evaluation.dueAtDate && (
              <span className="inline-flex items-center gap-1">
                <CalendarDays aria-hidden="true" className="h-3.5 w-3.5" />
                Due by {evaluation.dueAtDate.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
              </span>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground/80">Last confirmed service:</span>{" "}
            {item.lastServiceDate
              ? new Date(item.lastServiceDate).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
              : "Date not recorded"}
            {" · "}
            {item.lastServiceOdometer !== undefined && item.lastServiceOdometer !== null
              ? `${item.lastServiceOdometer.toLocaleString()} km`
              : "odometer not recorded"}
          </p>

          {item.intervalSource && (
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground/80">Interval source:</span> {item.intervalSource}
            </p>
          )}

          {hasKnownDue ? (
            <p className="text-xs text-muted-foreground">{formatDueText(evaluation)}</p>
          ) : (
            <p className="text-xs text-muted-foreground">
              {evaluation.historyComplete
                ? "No service interval is configured."
                : `Record ${missingText} to calculate this reminder.`}
            </p>
          )}

          {showProgress && evaluation.urgencyScore >= 0 && (
            <div className="space-y-1 pt-1">
              <div className="flex justify-between text-[11px] text-muted-foreground">
                <span>{evaluation.historyComplete ? "Interval progress" : "Progress from known history"}</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} aria-label={`${item.name} maintenance interval progress`} />
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0">
          <Button asChild variant="outline" className="min-h-11 cursor-pointer sm:min-h-9">
            <Link href={`/maintenance/${item._id}`} aria-label={`View ${item.name} history`}>
              <Wrench aria-hidden="true" />View
            </Link>
          </Button>
          <Button
            type="button"
            className="min-h-11 cursor-pointer sm:min-h-9"
            onClick={() => onLogService(item._id, evaluation.historyComplete ? "service" : "history")}
          >
            <History aria-hidden="true" />{evaluation.historyComplete ? "Log service" : "Add history"}
          </Button>
          {onEditItem && (
            <Button
              type="button"
              variant="outline"
              className="col-span-2 min-h-11 cursor-pointer sm:col-span-1 sm:min-h-9"
              onClick={() => onEditItem(item)}
              aria-label={`Edit ${item.name} interval`}
            >
              <Pencil aria-hidden="true" />Edit schedule
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}
