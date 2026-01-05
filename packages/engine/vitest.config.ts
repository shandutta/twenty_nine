import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      thresholds: {
        lines: 100,
        branches: 100,
        functions: 100,
        statements: 100,
      },
      exclude: ["test/**", "vitest.config.ts", "src/config.ts"],
    },
  },
});
