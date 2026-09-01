import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Split the two large, independently cacheable runtime packages.
          // Keep React and the remaining dependency graph together to avoid
          // circular manual chunks.
          if (id.includes("node_modules/lucide-react")) return "vendor-icons";
          if (id.includes("node_modules/@supabase")) return "vendor-supabase";
          if (id.includes("node_modules")) {
            if (id.includes("jspdf") || id.includes("html2canvas") || id.includes("canvg") || id.includes("xlsx")) return;
            return "vendor";
          }
        },
      },
    },
  },
});
