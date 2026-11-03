import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./test/browser",
  workers: 1,
  use: { baseURL: "http://127.0.0.1:4181", browserName: "chromium" },
  webServer: {
    // Keep Vite in Playwright's process group so teardown also closes its pipes.
    command: "node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4181 --strictPort",
    port: 4181,
    reuseExistingServer: false,
  },
});
