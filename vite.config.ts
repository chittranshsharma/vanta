import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: "127.0.0.1"
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          supabase: ["@supabase/supabase-js"],
          motion: ["framer-motion"]
        }
      }
    }
  },
  test: {
    include: ["src/**/*.test.ts", "shared/**/*.test.ts", "supabase/functions/**/*.test.ts", "services/**/src/**/*.test.ts"]
  }
});
