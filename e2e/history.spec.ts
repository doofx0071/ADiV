import { expect, test } from "@playwright/test";
import { ensureSetup } from "./helpers";

test.describe("history", () => {
  test.beforeEach(async ({ page }) => {
    await ensureSetup(page);
  });

  test("renders the unified activity feed with type filters", async ({ page }) => {
    await page.goto("/history");
    await expect(
      page.getByRole("heading", { name: "Service History" })
    ).toBeVisible({ timeout: 30_000 });

    for (const label of ["All", "Maintenance", "Rides", "Fuel", "Expenses"]) {
      await expect(
        page.getByRole("button", { name: label, exact: true })
      ).toBeVisible();
    }
  });

  test("filtering by type narrows the feed", async ({ page }) => {
    await page.goto("/history");
    await expect(
      page.getByRole("heading", { name: "Service History" })
    ).toBeVisible({ timeout: 30_000 });

    const expensesFilter = page.getByRole("button", { name: "Expenses", exact: true });
    await expensesFilter.click();
    await expect(expensesFilter).toHaveAttribute("aria-pressed", "true");

    // Either the empty state or expense entries show — but never ride entries.
    await expect(page.getByText(/^Ride — /)).toHaveCount(0);
  });
});
