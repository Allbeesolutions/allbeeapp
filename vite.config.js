import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Keep third-party code out of the application chunk. Use package
          // boundaries that cannot form circular manual chunks.
          if (id.includes("node_modules")) return "vendor";
        },
      },
    },
  },
});
