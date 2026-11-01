import { defineConfig } from "vitest/config";

// Kept apart from vite.config.ts: that file builds two environments and runs
// the prerender, none of which a unit test needs.
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "build/**/*.test.ts"],
    environment: "node",
    restoreMocks: true,
    unstubGlobals: true,
  },
});
