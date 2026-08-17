import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "jsdom",
    include: ["src/**/*.test.jsx", "src/**/*.test.js"],
    env: {
      VITE_PAUSE_TEST: "1", // founder lockdown gate: render the paused UI with zero network
      VITE_FOUNDER_LOCKDOWN_QUIET: "",
    },
  },
});
