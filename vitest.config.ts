import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        environment: "node",
        include: ["tests/**/*.test.ts"],
        coverage: {
            provider: "v8",
            reporter: ["text", "lcov", "html"],
            reportsDirectory: "coverage",
            thresholds: {
                lines: 95,
                statements: 95,
                functions: 95,
                branches: 95
            }
        }
    }
});
