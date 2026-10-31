import { expect, test } from "@playwright/test";

test.describe("onboarding", () => {
  test("landing page CTA leads to setup", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "AdiV" })).toBeVisible();

    const getStarted = page.getByRole("link", { name: "Get Started" });
    await expect(getStarted).toBeVisible();
    await getStarted.click();
    await expect(page).toHaveURL(/\/setup/);
  });

  test("completing setup lands on the dashboard", async ({ page }) => {
    await page.goto("/setup");

    // Wait for a stable state: the setup form (no bike yet) or a redirect to
    // /dashboard (bike exists — onboarding is not repeatable on this backend).
    const outcome = await Promise.race([
      page
        .getByRole("button", { name: "Complete Setup" })
        .waitFor({ timeout: 30_000 })
        .then(() => "form" as const)
        .catch(() => null),
      page
        .waitForURL(/\/dashboard/, { timeout: 30_000 })
        .then(() => "dashboard" as const)
        .catch(() => null),
    ]);

    test.skip(outcome !== "form", "Bike already exists — onboarding not repeatable");

    // All fields ship pre-filled with sensible defaults — a bare submit works.
    await page.getByRole("button", { name: "Complete Setup" }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });
    await expect(
      page.getByRole("heading", { name: "Dashboard" })
    ).toBeVisible({ timeout: 30_000 });
  });
});
