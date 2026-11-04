export type RideNotificationAction = "pause" | "resume" | "end" | "open";

export async function registerRideNotificationActions(): Promise<void> {}
export async function requestRideNotificationPermission(): Promise<boolean> { return false; }
export async function updateRideNotification(_input: {
  phase: "recording" | "paused";
  elapsedMs: number;
  distanceKm: number;
  averageSpeedKmh: number;
  maxSpeedKmh: number;
}): Promise<void> {}
export async function clearRideNotification(): Promise<void> {}
export function subscribeToRideNotificationActions(_listener: (action: RideNotificationAction) => void): { remove: () => void } {
  return { remove() {} };
}
export function getLastRideNotificationAction(): RideNotificationAction | null { return null; }
export function clearLastRideNotificationAction(): void {}
