import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./test/browser",
  workers: 1,
  use: { baseURL: "http://127.0.0.1:4181", browserName: "chromium" },
  webServer: {
    command: "pnpm exec vite --host 127.0.0.1 --port 4181 --strictPort",
    port: 4181,
    reuseExistingServer: false,
  },
});
