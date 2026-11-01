"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BarList } from "@tremor/react";
import { Gauge, MapPin, RefreshCcw } from "lucide-react";

const peso = (value: number) => `₱${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

/**
 * Three fuel-insight sections sharing one getFuelInsights subscription:
 * refuel patterns, tank & range estimate, and per-station price comparison.
 */
export function FuelInsightsSections() {
  const insights = useQuery(api.fuel.getFuelInsights);

  if (insights === undefined) return null;

  const hasLogs = insights.refuelCount > 0;
  const monthlySpend = insights.monthlySpend.slice(-12).map((entry) => ({
    name: entry.key,
    value: entry.spend,
  }));

  return (
    <>
      {/* Refuel patterns */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <RefreshCcw className="h-4 w-4" aria-hidden="true" />
            Refuel Patterns
          </CardTitle>
          <CardDescription>How often you fill up, and how much</CardDescription>
        </CardHeader>
        <CardContent>
          {hasLogs ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Stat label="Refuels" value={String(insights.refuelCount)} />
                <Stat label="Avg liters / refuel" value={`${insights.avgLitersPerRefuel.toFixed(1)} L`} />
                <Stat label="Avg days between" value={`${insights.avgDaysBetweenRefuels.toFixed(1)} d`} />
                <Stat label="Days since last" value={`${Math.floor(insights.daysSinceLastRefuel)} d`} />
              </div>
              {monthlySpend.length > 0 && (
                <div>
                  <p className="mb-2 text-sm font-medium">Fuel spend per month</p>
                  <BarList data={monthlySpend} valueFormatter={(value: number) => peso(value)} color="amber" />
                </div>
              )}
            </div>
          ) : (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Refuel patterns appear after your first fuel log.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Tank & range */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Gauge className="h-4 w-4" aria-hidden="true" />
            Tank &amp; Range
          </CardTitle>
          <CardDescription>What a full tank gets you, at your real efficiency</CardDescription>
        </CardHeader>
        <CardContent>
          {hasLogs && insights.avgKmPerLiter > 0 ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat label="Avg efficiency" value={`${insights.avgKmPerLiter.toFixed(1)} km/L`} />
              <Stat
                label="Tank range"
                value={insights.tankRangeKm > 0 ? `~${Math.round(insights.tankRangeKm).toLocaleString()} km` : "—"}
              />
              <Stat
                label="Fuel cost / km"
                value={insights.costPerKm > 0 ? `₱${insights.costPerKm.toFixed(2)}` : "—"}
              />
              <Stat
                label="Best tank"
                value={insights.bestSegment ? `${insights.bestSegment.kmL.toFixed(1)} km/L` : "—"}
              />
            </div>
          ) : (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Log two full-to-full refuels to estimate your real tank range.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Stations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <MapPin className="h-4 w-4" aria-hidden="true" />
            Stations
          </CardTitle>
          <CardDescription>Where you fill up, cheapest average price first</CardDescription>
        </CardHeader>
        <CardContent>
          {insights.stationStats.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Station</TableHead>
                  <TableHead className="text-right">Visits</TableHead>
                  <TableHead className="text-right">Liters</TableHead>
                  <TableHead className="text-right">Avg ₱/L</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {insights.stationStats.map((station) => (
                  <TableRow key={station.station}>
                    <TableCell className="font-medium">{station.station}</TableCell>
                    <TableCell className="text-right">{station.visits}</TableCell>
                    <TableCell className="text-right">{station.liters.toFixed(1)}</TableCell>
                    <TableCell className="text-right">{peso(station.avgPricePerLiter)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Add a station name when logging fuel-ups to compare prices.
            </p>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted px-3 py-2">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold">{value}</p>
    </div>
  );
}
