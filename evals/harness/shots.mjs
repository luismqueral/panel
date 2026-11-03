// Screenshots of one run's build and playground, for any schema.
//   node evals/harness/shots.mjs <run folder> <out folder>
// Serves the run folder statically and opens the build in test mode (memory adapter, seed.json),
// so no password or server is needed. Shots: home, each type's collection, its first item, that item
// with an unsaved edit, the create dialog, each singleton, and the playground.

import { mkdirSync, readFileSync } from "node:fs";
import { createServer } from "node:net";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";
import { parse as parseYaml } from "yaml";
import { serve } from "../../tools/lib/serve.mjs";

const [run, out] = process.argv.slice(2);
if (!run || !out) {
  console.error("Usage: node evals/harness/shots.mjs <run folder> <out folder>");
  process.exit(1);
}
const root = resolve(run);
mkdirSync(out, { recursive: true });
const schema = parseYaml(readFileSync(resolve(root, "panel.yaml"), "utf8"));

const port = await new Promise((done) => {
  const probe = createServer().listen(0, () => {
    const { port } = probe.address();
    probe.close(() => done(port));
  });
});
const server = serve(root, { port });
const base = `http://localhost:${port}`;
const browser = await chromium.launch();
const errors = [];

async function shot(name, url, act) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
  page.on("pageerror", (error) => errors.push(`${name}: ${error.message}`));
  await page.goto(`${base}${url}`);
  await page.waitForTimeout(400);
  try {
    if (act) await act(page);
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${out}/${name}.png`, fullPage: url.startsWith("/playground") });
    console.log(`saved ${name}.png`);
  } catch (error) {
    console.log(`skipped ${name}: ${error.message.split("\n")[0]}`);
  }
  await page.close();
}

const app = "/panel/index.html?test";
await shot("home", `${app}#/`);
for (const { id } of schema.types ?? []) {
  await shot(`${id}-collection`, `${app}#/${id}`);
  const openFirst = (page) => page.locator(`a[href^="#/${id}/"]`).first().click({ timeout: 2000 });
  await shot(`${id}-item`, `${app}#/${id}`, openFirst);
  await shot(`${id}-dirty`, `${app}#/${id}`, async (page) => {
    await openFirst(page);
    await page.waitForTimeout(300);
    const input = page.locator('main input[type="text"], main input:not([type]), main textarea').first();
    await input.fill(`${await input.inputValue()} (edited)`, { timeout: 2000 });
  });
  await shot(`${id}-create`, `${app}#/${id}`, (page) => page.click('[data-action="create"]', { timeout: 2000 }));
}
for (const { id } of schema.singletons ?? []) await shot(`${id}-singleton`, `${app}#/${id}`);
await shot("playground", "/playground.html");

await browser.close();
server.close();
if (errors.length) console.log(`page errors:\n  ${errors.join("\n  ")}`);
