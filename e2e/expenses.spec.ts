import { expect, test } from "@playwright/test";
import { ensureSetup } from "./helpers";

test.describe("expenses page", () => {
  test.beforeEach(async ({ page }) => {
    await ensureSetup(page);
  });

  test("renders summary cards, category filters, and the nav link", async ({ page }) => {
    await page.goto("/expenses");
    await expect(
      page.getByRole("heading", { name: "Expenses" })
    ).toBeVisible({ timeout: 30_000 });

    // Reachable from the primary navigation
    await expect(
      page.getByRole("link", { name: "Expenses" }).first()
    ).toBeVisible();

    // Summary cards
    await expect(page.getByText("Total", { exact: true })).toBeVisible();
    await expect(page.getByText("Entries", { exact: true })).toBeVisible();

    // Filter group always has "All"; category chips appear once data exists
    await expect(
      page.getByRole("button", { name: "All", exact: true })
    ).toBeVisible();
  });

  test("category filter narrows the list", async ({ page }) => {
    await page.goto("/expenses");
    await expect(
      page.getByRole("heading", { name: "Expenses" })
    ).toBeVisible({ timeout: 30_000 });

    // "Parts" chip only exists once a Parts expense was logged (logging.spec
    // does this on the e2e backend). Stats load async — wait for the chip.
    const partsChip = page.getByRole("button", { name: /^Parts/ });
    const hasChip = await partsChip
      .first()
      .waitFor({ timeout: 15_000 })
      .then(() => true)
      .catch(() => false);
    test.skip(!hasChip, "No Parts expenses logged yet on this backend");

    await partsChip.first().click();
    await expect(partsChip.first()).toHaveAttribute("aria-pressed", "true");

    // When entries are visible, every row belongs to the filtered category
    const rows = page.locator("main .space-y-3 > [data-slot=card]");
    const rowTexts = await rows.allTextContents();
    for (const text of rowTexts) {
      expect(text).toContain("Parts");
    }
  });
});
