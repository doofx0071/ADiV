export const php = (value: number) => `₱${value.toLocaleString("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
export const km = (value: number) => `${Math.round(value).toLocaleString("en-PH")} km`;
export const dateLabel = (value: number) => new Date(value).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });
export const numberOrUndefined = (value: string) => value.trim() === "" ? undefined : Number(value);
export const dateStartMs = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

export function rideDurationLabel(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours === 0) return `${minutes} min`;
  return `${hours}h${remainingMinutes > 0 ? ` ${remainingMinutes}m` : ""}`;
}

export function rideTimeLabel(startAt: number | undefined, endAt: number | undefined, durationMinutes: number) {
  if (startAt === undefined || endAt === undefined) return rideDurationLabel(durationMinutes);

  const time = (value: number) => new Date(value).toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" });
  const nextDay = dateStartMs(new Date(startAt)) !== dateStartMs(new Date(endAt));
  return `${time(startAt)}–${time(endAt)}${nextDay ? " (+1 day)" : ""} · ${rideDurationLabel(durationMinutes)}`;
}

export function buildRideInterval(date: Date, startTime: Date, endTime: Date) {
  const startAt = new Date(date.getTime());
  startAt.setHours(startTime.getHours(), startTime.getMinutes(), 0, 0);

  const endAt = new Date(date.getTime());
  endAt.setHours(endTime.getHours(), endTime.getMinutes(), 0, 0);
  if (endAt.getTime() === startAt.getTime()) throw new Error("Start and end times must be different.");
  if (endAt.getTime() < startAt.getTime()) endAt.setDate(endAt.getDate() + 1);

  const durationMinutes = Math.round((endAt.getTime() - startAt.getTime()) / 60_000);
  if (durationMinutes <= 0 || durationMinutes > 24 * 60) throw new Error("Ride duration must be between 1 minute and 24 hours.");

  return { startAt: startAt.getTime(), endAt: endAt.getTime(), durationMinutes };
}
