// Behavior tests for any panel build. Set PANEL_URL to test a running build;
// otherwise the vanilla reference build is built and served.

import { defineConfig } from "@playwright/test";

const external = process.env.PANEL_URL;
const port = 4800;

export default defineConfig({
  testDir: ".",
  testMatch: /.*\.spec\.mjs/,
  fullyParallel: true,
  reporter: [["list"]],
  use: { baseURL: external ?? `http://localhost:${port}/`, browserName: "chromium" },
  webServer: external
    ? undefined
    : {
        command: `node evals/fixtures/vanilla-blog/build.mjs && node tools/serve-static.mjs evals/fixtures/vanilla-blog/dist ${port}`,
        cwd: "../..",
        url: `http://localhost:${port}/`,
        reuseExistingServer: false,
      },
});
