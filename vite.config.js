import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const buildId = process.env.VERCEL_GIT_COMMIT_SHA || process.env.VERCEL_DEPLOYMENT_ID || `${Date.now()}`;

export default defineConfig({
  define: { __ALLBEE_BUILD_ID__: JSON.stringify(buildId) },
  plugins: [
    react(),
    {
      name: "allbee-build-manifest",
      generateBundle() {
        this.emitFile({ type: "asset", fileName: "allbee-build.json", source: JSON.stringify({ buildId }) });
      },
    },
  ],
  server: { port: 5173 },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
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
