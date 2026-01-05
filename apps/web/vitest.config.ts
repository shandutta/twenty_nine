import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./test/setup.ts"],
    include: ["test/**/*.test.ts", "test/**/*.test.tsx"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["app/game/**/*.{ts,tsx}", "hooks/**/*.{ts,tsx}"],
      thresholds: {
        lines: 100,
        branches: 100,
        functions: 100,
        statements: 100,
      },
      exclude: [
        ".next/**",
        "coverage/**",
        "test/**",
        "app/api/**",
        "app/layout.tsx",
        "app/page.tsx",
        "next-env.d.ts",
        "**/*.d.ts",
        "**/*.config.*",
        "vitest.config.ts",
      ],
    },
  },
});
