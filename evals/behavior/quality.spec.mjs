// Template fidelity, accessibility, and phone width, checked on every screen of a running build.

import { test, expect } from "@playwright/test";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { loadTemplates } from "../../tools/lib/templates.mjs";
import { open, statusButton, emptySeed } from "./helpers.mjs";

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL("../..", import.meta.url));
const { sources } = loadTemplates(root);
const fidelityScript = fileURLToPath(new URL("../../tools/lib/fidelity.js", import.meta.url));
const axeScript = require.resolve("axe-core/axe.min.js");

const views = [
  { name: "home", hash: "#/" },
  { name: "collection", hash: "#/post" },
  { name: "collection empty", hash: "#/post", seed: emptySeed },
  { name: "item", hash: "#/post/rail-line" },
  { name: "item with publish errors", hash: "#/post/small-maps", then: (page) => statusButton(page).click() },
  { name: "item published", hash: "#/post/winter-light" },
  { name: "singleton", hash: "#/settings" },
  { name: "not found", hash: "#/nope" },
  { name: "create dialog", hash: "#/post", then: (page) => page.locator('.pn-screen-actions [data-action="create"]').click() },
  { name: "confirm dialog", hash: "#/post/rail-line", then: (page) => page.locator('.pn-screen [data-action="delete"]').click() },
];

for (const view of views) {
  for (const width of [1280, 400]) {
    test(`${view.name} at ${width}px matches its templates, passes axe, and fits`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await open(page, view.hash, view.seed);
      await view.then?.(page);
      await page.waitForTimeout(150);

      await page.addScriptTag({ path: fidelityScript });
      const results = await page.evaluate((s) => window.PanelFidelity.checkDocument(document.body, s), sources);
      expect(results.length).toBeGreaterThan(0);
      expect(results.filter((r) => !r.ok)).toEqual([]);

      await page.addScriptTag({ path: axeScript });
      const violations = await page.evaluate(async () =>
        (await window.axe.run(document)).violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`),
      );
      expect(violations).toEqual([]);

      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }
}
