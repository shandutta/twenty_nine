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
        lines: 70,
        branches: 60,
        functions: 70,
        statements: 70,
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
