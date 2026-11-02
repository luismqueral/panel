// Recipe verification: the reference blog against the real project server, started per test.

import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: /.*\.spec\.mjs/,
  fullyParallel: true,
  reporter: [["list"]],
  globalSetup: "./global-setup.mjs",
  use: { browserName: "chromium" },
});
