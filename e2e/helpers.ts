import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

/**
 * Race two waiters; the loser's rejection is swallowed (expected) instead of
 * surfacing as an unhandled rejection that fails the test.
 */
function raceWaiters<T extends string>(a: Promise<T>, b: Promise<T>): Promise<T | null> {
  return Promise.race([a.catch(() => null), b.catch(() => null)]);
}

/**
 * Ensure the backend has a bike profile: complete the setup form if the app
 * redirects /dashboard → /setup, otherwise do nothing. Idempotent.
 */
export async function ensureSetup(page: Page): Promise<void> {
  await page.goto("/dashboard");
  const outcome = await raceWaiters(
    page
      .getByRole("heading", { name: "Dashboard" })
      .waitFor({ timeout: 30_000 })
      .then(() => "dashboard" as const),
    page
      .waitForURL(/\/setup/, { timeout: 30_000 })
      .then(() => "setup" as const),
  );
  if (outcome === null) throw new Error("Dashboard neither loaded nor redirected to /setup");

  if (outcome === "setup") {
    // All fields ship pre-filled with sensible defaults — a bare submit works.
    await page.getByRole("button", { name: "Complete Setup" }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
  }
  await expect(
    page.getByRole("heading", { name: "Dashboard" })
  ).toBeVisible({ timeout: 30_000 });
}

/**
 * Read the current bike odometer (in km) from the dashboard's stat card.
 */
export async function readOdometer(page: Page): Promise<number> {
  const card = page.locator("button").filter({ hasText: "Current Odometer" });
  const valueText = await card.getByText(/km\s*$/).first().textContent();
  expect(valueText).toBeTruthy();
  const km = Number(valueText!.replace(/[^0-9.]/g, ""));
  expect(km).not.toBeNaN();
  return km;
}
