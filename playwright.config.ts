import { defineConfig } from "@playwright/test";

/**
 * QA-1 suite runs against a real Supabase test project with two accounts.
 * It does not start the web app: isolation is proven at the API layer with
 * real JWTs, which is the boundary RLS enforces.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  use: { trace: "off" },
});
