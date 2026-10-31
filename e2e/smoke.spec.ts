import { expect, test } from "@playwright/test";
import { ensureSetup } from "./helpers";

test.describe("smoke", () => {
  // First-visit compiles and Convex round trips can be slow on a remote dev
  // deployment — give smoke tests headroom over the 30s default.
  test.setTimeout(60_000);

  test("desktop shows top navigation and hides the bottom tab bar", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await ensureSetup(page);

    const primaryNav = page.locator('nav[aria-label="Primary"]');
    await expect(primaryNav).toBeHidden();

    // Top nav links render at the xl breakpoint
    for (const label of ["Dashboard", "Maintenance", "Analytics", "History", "Achievements", "Export"]) {
      await expect(
        page.getByRole("link", { name: label, exact: true }).first()
      ).toBeVisible();
    }
  });

  test("mobile shows the bottom tab bar with active state", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await ensureSetup(page);

    const primaryNav = page.locator('nav[aria-label="Primary"]');
    await expect(primaryNav).toBeVisible();

    // The current route's tab is marked active via aria-current="page"
    await expect(
      primaryNav.getByRole("link", { name: "Home" })
    ).toHaveAttribute("aria-current", "page");

    await primaryNav.getByRole("link", { name: "History" }).click();
    await expect(page).toHaveURL(/\/history/);
    await expect(
      primaryNav.getByRole("link", { name: "History" })
    ).toHaveAttribute("aria-current", "page");
  });

  test("theme toggle switches dark mode", async ({ page }) => {
    // The header (and its toggle) renders on every page except /setup — the
    // landing page needs no backend data at all.
    await page.goto("/");

    // The toggle announces its action based on the resolved theme.
    const toggle = page.getByRole("button", { name: /Switch to (light|dark) mode/ });
    await expect(toggle).toBeVisible({ timeout: 30_000 });

    const before = await toggle.getAttribute("aria-label");
    await toggle.click();
    const after = await toggle.getAttribute("aria-label");
    expect(after).not.toBe(before);
  });
});
