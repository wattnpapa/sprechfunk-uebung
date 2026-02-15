import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
    testDir: "e2e",
    reporter: [
        ["line"],
        ["html", { outputFolder: "playwright-report", open: "never" }],
        ["junit", { outputFile: "test-results/e2e-junit.xml" }]
    ],
    timeout: 60_000,
    expect: {
        timeout: 10_000
    },
    use: {
        baseURL: "http://localhost:3000",
        headless: true,
        trace: "retain-on-failure"
    },
    webServer: {
        command: "npm run build && npm run serve",
        url: "http://localhost:3000",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000
    },
    projects: [
        {
            name: "chromium",
            use: { ...devices["Desktop Chrome"] }
        }
    ]
});
