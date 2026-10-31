import { expect, test } from "@playwright/test";
import { ensureSetup, readOdometer } from "./helpers";

// Minimal 1x1 PNG used as the expense receipt upload fixture.
const RECEIPT_PNG_1PX = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

test.describe("logging flows", () => {
  test.beforeEach(async ({ page }) => {
    await ensureSetup(page);
  });

  test("logs a ride and syncs the bike odometer upward", async ({ page }) => {
    await page.goto("/dashboard");
    const odo = await readOdometer(page);

    await page.getByRole("button", { name: "Log Ride" }).first().click();
    await page.getByLabel("Start Odometer (km) *").fill(String(odo));
    await page.getByLabel("End Odometer (km) *").fill(String(odo + 5));
    await page.getByLabel("Duration (minutes) *").fill("10");
    await page.getByRole("button", { name: "Save", exact: true }).click();

    await expect(page.getByText("Ride logged!")).toBeVisible({ timeout: 15_000 });

    // The end odometer exceeds the bike's reading, so the bike advances to it.
    await page.goto("/dashboard");
    await expect(await readOdometer(page)).toBe(odo + 5);

    // The ride appears in the unified history feed (.first(): repeat runs
    // create multiple "5 km" ride rows).
    await page.goto("/history");
    await expect(
      page.getByText(`Ride — ${(odo + 5 - odo).toLocaleString()} km`).first()
    ).toBeVisible({ timeout: 15_000 });
  });

  test("logs a fuel-up", async ({ page }) => {
    await page.goto("/dashboard");
    const odo = await readOdometer(page);

    await page.getByRole("button", { name: "Log Fuel" }).first().click();
    await page.getByLabel("Odometer (km) *").fill(String(odo + 10));
    await page.getByLabel("Liters *").fill("2.5");
    await page.getByLabel("Price per Liter (₱) *").fill("62.5");
    await page.getByLabel("Station").fill("e2e test station");
    await page.getByRole("button", { name: "Save", exact: true }).click();

    await expect(page.getByText("Fuel log added!")).toBeVisible({ timeout: 15_000 });

    await page.goto("/history");
    await expect(page.getByText(/Fuel — 2\.5 L/).first()).toBeVisible({
      timeout: 15_000,
    });
  });

  test("logs a maintenance service", async ({ page }) => {
    await page.goto("/dashboard");
    const odo = await readOdometer(page);

    await page.getByRole("button", { name: "Log Maintenance" }).first().click();
    await page.getByLabel("Maintenance Item *").click();
    await page.getByRole("option").first().click();
    await page.getByLabel(/^Odometer \(km\) \*$/).fill(String(odo + 12));
    await page.getByRole("button", { name: "Save", exact: true }).click();

    await expect(page.getByText("Maintenance logged!")).toBeVisible({
      timeout: 15_000,
    });

    await page.goto("/history");
    // The maintenance row shows the item name and the service odometer.
    await expect(page.getByText(/— [\d,]+ km/).first()).toBeVisible({
      timeout: 15_000,
    });
  });

  test("logs an expense with a receipt and views it from history", async ({ page }) => {
    await page.goto("/dashboard");

    await page.getByRole("button", { name: "Add Expense" }).first().click();
    await page.getByLabel("Category *").click();
    await page.getByRole("option", { name: "Parts" }).click();
    await page.getByLabel("Amount (₱) *").fill("150");
    await page.getByLabel("Description").fill("e2e receipt test");
    await page
      .getByLabel("Receipt (optional)")
      .setInputFiles({
        name: "receipt.png",
        mimeType: "image/png",
        buffer: RECEIPT_PNG_1PX,
      });
    await page.getByRole("button", { name: "Save", exact: true }).click();

    await expect(page.getByText("Expense added!")).toBeVisible({ timeout: 15_000 });

    // The receipt is viewable from the history feed.
    await page.goto("/history");
    const viewButtons = page.getByRole("button", { name: /View receipt for expense/ });
    await expect(viewButtons.first()).toBeVisible({ timeout: 15_000 });
    await viewButtons.first().click();

    const viewer = page.locator('img[alt="Expense receipt"]');
    await expect(viewer).toBeVisible();
  });
});
