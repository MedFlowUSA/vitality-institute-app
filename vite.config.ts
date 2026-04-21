import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;

          if (id.includes("html2canvas")) return "pdf-render";
          if (id.includes("jspdf")) return "pdf-core";
          if (id.includes("recharts")) return "charts";
          if (id.includes("@supabase")) return "supabase";
          if (
            id.includes("/react/") ||
            id.includes("\\react\\") ||
            id.includes("react-dom") ||
            id.includes("scheduler") ||
            id.includes("react-router") ||
            id.includes("@remix-run/router")
          ) {
            return "framework";
          }

          return "vendor";
        },
      },
    },
  },
});
