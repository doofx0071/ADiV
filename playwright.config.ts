import { defineConfig, devices } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * E2E tests run against a DEDICATED Convex deployment, never the developer's
 * dev backend — write tests would otherwise pollute real data (ride logs sync
 * the bike odometer upward, which cannot be undone).
 *
 * Setup (one-time): create a throwaway Convex project and put its dev URL in
 * a git-ignored `.env.e2e` file:
 *   NEXT_PUBLIC_CONVEX_URL=https://<e2e-deployment>.convex.cloud
 * The web server below then starts `next dev` on port 3100 with that URL
 * inlined (process env overrides .env.local). Without `.env.e2e`, tests fall
 * back to whatever `.env.local` points at — write tests will mutate that
 * backend, so prefer always having `.env.e2e` present.
 *
 * Port 3100 (not 3000) so an already-running dev server can never be reused:
 * the app under test always boots with the e2e backend URL.
 */

// Minimal .env parser (KEY=VALUE lines, # comments) — no extra dependency.
function loadEnvFile(path: string): Record<string, string> {
  if (!existsSync(path)) return {};
  const env: Record<string, string> = {};
  for (const line of readFileSync(path, "utf-8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (match && !line.trim().startsWith("#")) env[match[1]] = match[2];
  }
  return env;
}

const e2eEnv = loadEnvFile(resolve(__dirname, ".env.e2e"));

export default defineConfig({
  testDir: "./e2e",
  // Tests share one backend's data (odometer is monotonic) — keep them serial.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "html",
  use: { baseURL: "http://localhost:3100", trace: "on-first-retry" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "bun run dev --port 3100",
    url: "http://localhost:3100",
    reuseExistingServer: !process.env.CI,
    env: {
      // Hide the Next.js dev tools roundel — it overlaps the theme toggle and
      // intercepts pointer events during tests.
      E2E: "1",
      ...(e2eEnv.NEXT_PUBLIC_CONVEX_URL
        ? { NEXT_PUBLIC_CONVEX_URL: e2eEnv.NEXT_PUBLIC_CONVEX_URL }
        : {}),
    },
    timeout: 120_000,
  },
});
