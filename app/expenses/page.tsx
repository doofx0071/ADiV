"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LogActions } from "@/components/history/log-actions";
import { ReceiptThumbnail } from "@/components/history/receipt-thumbnail";
import { LogModal } from "@/components/dashboard/log-modals";
import { Plus, Wallet } from "lucide-react";

export default function ExpensesPage() {
  const expenses = useQuery(api.expenses.getExpenses, { limit: 500 });
  const stats = useQuery(api.expenses.getExpenseStats);
  const [filter, setFilter] = useState<string | "all">("all");
  const [logOpen, setLogOpen] = useState(false);

  const categories = stats?.byCategory ?? [];
  const visible = (expenses ?? []).filter(
    (e) => filter === "all" || e.category === filter
  );
  const isLoading = expenses === undefined || stats === undefined;

  return (
    <main className="flex flex-col p-3 sm:p-4 md:p-8">
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <PageHeader
          title="Expenses"
          description="Parts, accessories, insurance, and other costs"
          action={
            <Button className="min-h-11 cursor-pointer" onClick={() => setLogOpen(true)}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add Expense
            </Button>
          }
        />

        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="py-4">
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="text-lg font-semibold">
                ₱{(stats?.totalAmount ?? 0).toLocaleString()}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <p className="text-xs text-muted-foreground">Entries</p>
              <p className="text-lg font-semibold">{stats?.count ?? 0}</p>
            </CardContent>
          </Card>
          <Card className="col-span-2 sm:col-span-1">
            <CardContent className="py-4">
              <p className="text-xs text-muted-foreground">Top category</p>
              <p className="truncate text-lg font-semibold">
                {categories[0]?.category ?? "—"}
              </p>
              {categories[0] && (
                <p className="text-xs text-muted-foreground">
                  ₱{categories[0].amount.toLocaleString()}
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Category filters with running totals */}
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by category">
          <Button
            size="sm"
            variant={filter === "all" ? "default" : "outline"}
            aria-pressed={filter === "all"}
            onClick={() => setFilter("all")}
          >
            All
          </Button>
          {categories.map((c) => (
            <Button
              key={c.category}
              size="sm"
              variant={filter === c.category ? "default" : "outline"}
              aria-pressed={filter === c.category}
              onClick={() => setFilter(c.category)}
            >
              {c.category} · ₱{c.amount.toLocaleString()}
            </Button>
          ))}
        </div>

        {/* Expense list */}
        <div className="space-y-3">
          {isLoading ? null : visible.length > 0 ? (
            visible.map((expense) => (
              <Card key={expense._id}>
                <CardContent className="flex flex-wrap items-center gap-3 py-4 sm:flex-nowrap sm:gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary">
                    <Wallet className="h-4 w-4 text-warning" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {expense.description || expense.category}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {expense.category} ·{" "}
                      {new Date(expense.date).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </p>
                  </div>
                  <ReceiptThumbnail storageId={expense.receiptPhoto} />
                  <Badge variant="secondary">
                    ₱{expense.amount.toLocaleString()}
                  </Badge>
                  <LogActions
                    log={{
                      type: "expense",
                      id: expense._id,
                      category: expense.category,
                      amount: expense.amount,
                      description: expense.description,
                      receiptPhoto: expense.receiptPhoto,
                    }}
                  />
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                {filter === "all"
                  ? "No expenses recorded yet. Log your first one with the Add Expense button!"
                  : `No ${filter} entries yet.`}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <LogModal type={logOpen ? "expense" : null} onClose={() => setLogOpen(false)} />
    </main>
  );
}
