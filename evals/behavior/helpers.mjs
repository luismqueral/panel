// Shared helpers. Tests touch a panel only through template classes, data-action, data-field,
// data-template, and window.panelTest (behavior-spec.md section 7).

import { readFileSync } from "node:fs";
import { expect } from "@playwright/test";

export const seed = JSON.parse(readFileSync(new URL("./seed.json", import.meta.url), "utf8"));
export const emptySeed = { items: { post: [] }, singletons: {} };

export async function open(page, hash = "#/", data = seed) {
  await page.goto(`./${hash}`);
  await page.waitForFunction(() => window.panelTest);
  await page.evaluate((d) => window.panelTest.reset(d), data);
  await expect(page.locator(".pn-screen")).not.toHaveAttribute("data-state", "loading");
  await page.evaluate(() => (window.panelTest.calls.length = 0));
}

export const calls = (page, method) => page.evaluate((m) => window.panelTest.calls.filter((c) => !m || c.method === m), method);
export const fail = (page, method) => page.evaluate((m) => window.panelTest.fail(m), method);
export const delay = (page, ms) => page.evaluate((n) => window.panelTest.delay(n), ms);

export const screen = (page) => page.locator(".pn-screen");
export const field = (page, name) => page.locator(`.pn-layout-body [data-field="${name}"]`);
export const control = (page, name) => field(page, name).locator("input, textarea, select").first();
export const savebar = (page) => page.locator(".pn-savebar");
export const saveButton = (page) => page.locator('.pn-savebar [data-action="save"]');
export const revertButton = (page) => page.locator('.pn-savebar [data-action="revert"]');
export const statusButton = (page) => page.locator('.pn-screen [data-action="status"]');
export const confirmDialog = (page) => page.locator('dialog[data-template="screen-dialog"]');
export const createDialog = (page) => page.locator('dialog[data-template="screen-create"]');

export const png = {
  name: "cover.png",
  mimeType: "image/png",
  buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64"),
};
