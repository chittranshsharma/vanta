import { defineConfig } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

// Load .env if present without external dependencies
try {
  if (typeof process.loadEnvFile === "function") {
    process.loadEnvFile();
  } else {
    const envPath = path.resolve(process.cwd(), ".env");
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf-8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx > 0) {
          const key = trimmed.slice(0, eqIdx).trim();
          const val = trimmed.slice(eqIdx + 1).trim();
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      }
    }
  }
} catch {
  // Ignore missing or unreadable .env
}

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
