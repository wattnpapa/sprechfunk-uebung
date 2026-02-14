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
                lines: 75,
                statements: 75,
                functions: 75,
                branches: 75
            }
        }
    }
});
