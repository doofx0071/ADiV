"use client";

import { Suspense, useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { ErrorBoundary } from "@/components/layout/error-boundary";
import { PageHeader } from "@/components/layout/page-header";
import { MaintenanceItemRow } from "@/components/maintenance/maintenance-item-row";
import { MaintenanceItemEditor } from "@/components/maintenance/maintenance-item-editor";
import { OdometerEditor } from "@/components/maintenance/odometer-editor";
import { LogModal } from "@/components/dashboard/log-modals";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { evaluateMaintenanceItems, summarizeMaintenanceEvaluations } from "@/lib/reminders";
import { AlertTriangle, CalendarCheck, CheckCircle2, Gauge, History, Plus, Search, Wrench } from "lucide-react";

type MaintenanceFilter = "all" | "overdue" | "due" | "upcoming" | "needs-history" | "clear";

const FILTERS: { value: MaintenanceFilter; label: string }[] = [
  { value: "all", label: "All items" },
  { value: "overdue", label: "Overdue" },
  { value: "due", label: "Due soon" },
  { value: "upcoming", label: "Upcoming" },
  { value: "needs-history", label: "Needs history" },
  { value: "clear", label: "On track" },
];

function MaintenanceCenter() {
  const searchParams = useSearchParams();
  const bike = useQuery(api.bike.getBike);
  const items = useQuery(api.maintenance.getMaintenanceItems);
  const [statusFilterOverride, setStatusFilterOverride] = useState<MaintenanceFilter | null>(null);
  const requestedFilter = searchParams.get("filter");
  const statusFilter = statusFilterOverride ?? (
    FILTERS.find((filter) => filter.value === requestedFilter)?.value ?? "all"
  );
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [logTarget, setLogTarget] = useState<{
    itemId: Id<"maintenanceItems">;
    mode: "service" | "history";
  } | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorItem, setEditorItem] = useState<Doc<"maintenanceItems"> | null>(null);
  const [editorKey, setEditorKey] = useState(0);

  function openItemEditor(item?: Doc<"maintenanceItems">) {
    setEditorItem(item ?? null);
    setEditorKey((key) => key + 1);
    setEditorOpen(true);
  }

  const evaluations = bike && items
    ? evaluateMaintenanceItems(items, bike.currentOdometer, new Date())
    : [];
  const summary = summarizeMaintenanceEvaluations(evaluations);
  const categories = useMemo(
    () => [...new Set((items ?? []).map((item) => item.category))].sort((a, b) => a.localeCompare(b)),
    [items]
  );

  const filteredEvaluations = evaluations.filter((evaluation) => {
    const matchesStatus = statusFilter === "all"
      || (statusFilter === "needs-history" && !evaluation.historyComplete)
      || (statusFilter === "clear" && evaluation.status === "clear")
      || evaluation.status === statusFilter;
    const matchesCategory = categoryFilter === "all" || evaluation.item.category === categoryFilter;
    const query = search.trim().toLocaleLowerCase();
    const matchesSearch = !query
      || evaluation.item.name.toLocaleLowerCase().includes(query)
      || evaluation.item.category.toLocaleLowerCase().includes(query)
      || (evaluation.item.intervalSource ?? "").toLocaleLowerCase().includes(query)
      || (evaluation.item.description ?? "").toLocaleLowerCase().includes(query);
    return matchesStatus && matchesCategory && matchesSearch;
  });

  const groupedItems = filteredEvaluations.reduce<Record<string, typeof filteredEvaluations>>((groups, evaluation) => {
    const category = evaluation.item.category;
    (groups[category] ??= []).push(evaluation);
    return groups;
  }, {});

  if (bike === undefined || items === undefined) {
    return (
      <main className="flex flex-col p-3 sm:p-4 md:p-8">
        <div className="mx-auto w-full max-w-6xl space-y-6" aria-busy="true" aria-label="Loading maintenance center">
          <div className="space-y-2"><div className="h-7 w-48 animate-pulse bg-muted" /><div className="h-4 w-72 animate-pulse bg-muted" /></div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-20 animate-pulse bg-muted" />)}</div>
          <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-24 animate-pulse bg-muted" />)}</div>
        </div>
      </main>
    );
  }

  if (!bike) {
    return (
      <main className="flex flex-col p-3 sm:p-4 md:p-8">
        <div className="mx-auto w-full max-w-6xl">
          <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">Set up your bike to view maintenance reminders.</CardContent></Card>
        </div>
      </main>
    );
  }

  return (
    <>
      <main className="flex flex-col p-3 sm:p-4 md:p-8">
        <div className="mx-auto w-full max-w-6xl space-y-6">
          <PageHeader
            title="Maintenance Center"
            description={`${bike.name} · ${bike.currentOdometer.toLocaleString()} km`}
            action={
              <div className="grid grid-cols-2 gap-2 md:flex">
                <Button type="button" className="min-h-11 w-full cursor-pointer md:w-auto" onClick={() => openItemEditor()}>
                  <Plus aria-hidden="true" />Add item
                </Button>
                <OdometerEditor
                  currentOdometer={bike.currentOdometer}
                  trigger={
                    <Button type="button" variant="outline" className="min-h-11 w-full cursor-pointer md:w-auto">
                      <Gauge aria-hidden="true" />Update odometer
                    </Button>
                  }
                />
              </div>
            }
          />

          <section aria-label="Maintenance status" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <SummaryCard label="Overdue" value={summary.overdue} icon={<AlertTriangle aria-hidden="true" />} tone="destructive" />
            <SummaryCard label="Due soon" value={summary.due} icon={<CalendarCheck aria-hidden="true" />} tone="warning" />
            <SummaryCard label="Upcoming" value={summary.upcoming} icon={<Wrench aria-hidden="true" />} tone="success" />
            <SummaryCard label="Needs history" value={summary.needsHistory} icon={<Gauge aria-hidden="true" />} tone="muted" />
          </section>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-base">Service history coverage</CardTitle>
                <Badge variant={summary.needsHistory === 0 ? "secondary" : "outline"} className={summary.needsHistory > 0 ? "border-warning/50 text-warning-foreground" : ""}>
                  {summary.historyComplete} / {summary.total} tracked
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <Progress
                value={summary.total === 0 ? 0 : (summary.historyComplete / summary.total) * 100}
                aria-label="Confirmed service history coverage"
              />
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-muted-foreground">
                  {summary.needsHistory === 0
                    ? "Every scheduled item has the confirmed baseline data needed for reminders."
                    : `${summary.needsHistory} item${summary.needsHistory === 1 ? "" : "s"} need confirmed service details before all reminders can be calculated.`}
                </p>
                {summary.needsHistory > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11 cursor-pointer sm:min-h-9"
                    aria-pressed={statusFilter === "needs-history"}
                    onClick={() => setStatusFilterOverride("needs-history")}
                  >
                    <History aria-hidden="true" />Review missing history
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          <section className="space-y-3" aria-label="Filter maintenance items">
            <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by maintenance status">
              {FILTERS.map((filter) => (
                <Button
                  key={filter.value}
                  type="button"
                  variant={statusFilter === filter.value ? "default" : "outline"}
                  className="min-h-11 cursor-pointer sm:min-h-9"
                  aria-pressed={statusFilter === filter.value}
                  onClick={() => setStatusFilterOverride(filter.value)}
                >
                  {filter.label}
                  {filter.value === "needs-history" && summary.needsHistory > 0 && (
                    <span className="ml-1 tabular-nums">{summary.needsHistory}</span>
                  )}
                </Button>
              ))}
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_16rem]">
              <div className="relative">
                <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  aria-label="Search maintenance items"
                  placeholder="Search by item or category…"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="min-h-11 pl-9"
                />
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger aria-label="Filter by category" className="min-h-11 w-full">
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {categories.map((category) => <SelectItem key={category} value={category}>{category}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </section>

          {filteredEvaluations.length > 0 ? (
            <div className="space-y-6">
              {Object.entries(groupedItems).map(([category, categoryItems]) => (
                <section key={category} className="space-y-3" aria-labelledby={`maintenance-${category}`}>
                  <div className="flex items-center justify-between border-b border-border pb-2">
                    <h2 id={`maintenance-${category}`} className="text-sm font-semibold uppercase tracking-wider">{category}</h2>
                    <span className="text-xs text-muted-foreground">{categoryItems.length} item{categoryItems.length === 1 ? "" : "s"}</span>
                  </div>
                  <div className="space-y-3">
                    {categoryItems.map((evaluation) => (
                      <MaintenanceItemRow
                        key={evaluation.item._id}
                        evaluation={evaluation}
                        showProgress
                        onLogService={(itemId, mode) => setLogTarget({ itemId, mode })}
                        onEditItem={openItemEditor}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
                <CheckCircle2 aria-hidden="true" className="h-10 w-10 text-muted-foreground/60" />
                <div className="space-y-1">
                  <p className="font-medium">No matching maintenance items</p>
                  <p className="text-xs text-muted-foreground">Try another status, category, or search.</p>
                </div>
                <Button type="button" variant="outline" className="min-h-11 cursor-pointer" onClick={() => { setStatusFilterOverride("all"); setCategoryFilter("all"); setSearch(""); }}>
                  Clear filters
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
      {logTarget && <LogModal
        key={`${logTarget.itemId}-${logTarget.mode}`}
        type={logTarget ? "maintenance" : null}
        onClose={() => setLogTarget(null)}
        initialMaintenanceItemId={logTarget.itemId}
        maintenanceEntryMode={logTarget.mode}
      />}
      <MaintenanceItemEditor
        key={editorKey}
        open={editorOpen}
        item={editorItem ?? undefined}
        onOpenChange={setEditorOpen}
      />
    </>
  );
}

function SummaryCard({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: number;
  icon: ReactNode;
  tone: "destructive" | "warning" | "success" | "muted";
}) {
  const toneClass = {
    destructive: "text-destructive",
    warning: "text-warning",
    success: "text-success",
    muted: "text-muted-foreground",
  }[tone];

  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-2 py-4">
        <div className="min-w-0 space-y-1">
          <p className="truncate text-xs text-muted-foreground">{label}</p>
          <p className={`text-2xl font-bold tabular-nums ${toneClass}`}>{value}</p>
        </div>
        <div className={`shrink-0 opacity-70 [&_svg]:h-5 [&_svg]:w-5 ${toneClass}`}>{icon}</div>
      </CardContent>
    </Card>
  );
}

function MaintenanceError() {
  return (
    <main className="flex flex-col p-3 sm:p-4 md:p-8">
      <div className="mx-auto w-full max-w-2xl">
        <Card>
          <CardContent className="space-y-3 py-8 text-center">
            <p className="font-medium">Maintenance data could not be loaded.</p>
            <p className="text-xs text-muted-foreground">Reload to try again.</p>
            <Button type="button" className="min-h-11 cursor-pointer" onClick={() => window.location.reload()}>Reload</Button>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

export default function MaintenancePage() {
  return (
    <ErrorBoundary fallback={<MaintenanceError />}>
      <Suspense fallback={<MaintenanceSearchFallback />}>
        <MaintenanceCenter />
      </Suspense>
    </ErrorBoundary>
  );
}

function MaintenanceSearchFallback() {
  return (
    <main className="flex flex-col p-3 sm:p-4 md:p-8">
      <div className="mx-auto w-full max-w-6xl space-y-6" aria-busy="true" aria-label="Loading maintenance center">
        <div className="space-y-2"><div className="h-7 w-48 animate-pulse bg-muted" /><div className="h-4 w-72 animate-pulse bg-muted" /></div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-20 animate-pulse bg-muted" />)}</div>
        <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-24 animate-pulse bg-muted" />)}</div>
      </div>
    </main>
  );
}
