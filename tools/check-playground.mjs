// Checks a generated playground (panel/playground.md Rule 6).
// Usage: node tools/check-playground.mjs <playground.html> [panel.yaml]
// The schema defaults to panel.yaml next to the playground.
//
// For every screen, in light and dark: template fidelity, axe, no sideways scroll at 400px,
// no console errors, no outside requests. Then: every screen Rule 2 requires is present,
// in the state it names, and every template the schema needs is used somewhere.

import { readFileSync, existsSync } from "node:fs";
import { dirname, basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { parse } from "yaml";
import { serve } from "./lib/serve.mjs";
import { loadTemplates } from "./lib/templates.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const file = resolve(process.argv[2] ?? "");
if (!process.argv[2] || !existsSync(file)) {
  console.error("Usage: node tools/check-playground.mjs <playground.html> [panel.yaml]");
  process.exit(2);
}
const schemaPath = resolve(process.argv[3] ?? join(dirname(file), "panel.yaml"));
const schema = parse(readFileSync(schemaPath, "utf8"));
const { sources } = loadTemplates(root);
const fidelitySource = readFileSync(join(root, "tools/lib/fidelity.js"), "utf8");
const axeSource = readFileSync(join(root, "node_modules/axe-core/axe.min.js"), "utf8");

// What Rule 2 requires, with the state each screen must show.
const expected = new Map([["home", { state: "ready" }]]);
const types = schema.types ?? [];
for (const type of types) {
  const p = types.length > 1 ? `${type.id}-` : "";
  expected.set(`${p}collection`, { state: "ready" });
  expected.set(`${p}collection-loading`, { state: "loading" });
  expected.set(`${p}collection-empty`, { state: "empty" });
  expected.set(`${p}collection-error`, { state: "error" });
  expected.set(`${p}create`, { state: "ready", dialog: "screen-create" });
  expected.set(`${p}item`, { state: "ready", save: "clean" });
  expected.set(`${p}item-dirty`, { state: "ready", save: "dirty" });
  expected.set(`${p}item-saving`, { state: "ready", save: "saving", locked: true });
  expected.set(`${p}item-save-error`, { state: "ready", save: "error" });
  if (type.status) expected.set(`${p}item-invalid`, { state: "ready", save: "dirty", invalid: true });
  expected.set(`${p}confirm`, { state: "ready", dialog: "screen-dialog" });
}
expected.set("slide-over", { dialog: "screen-slide-over" });
for (const s of schema.singletons ?? []) expected.set(s.id, { state: "ready", save: "clean" });
expected.set("login", { login: true });
expected.set("not-found", { state: "error" });

const fieldTypes = new Set([...types, ...(schema.singletons ?? [])].flatMap((t) => t.fields.map((f) => f.type)));
const neededTemplates = new Set([
  "layout", "nav", "header", "savebar", "empty", "error",
  "screen-home", "screen-collection", "screen-item", "screen-create", "screen-dialog", "screen-slide-over",
  "account", "screen-login",
  ...(schema.singletons?.length ? ["screen-singleton"] : []),
  ...[...fieldTypes].map((t) => `field-${t}`),
]);

const failures = [];
const fail = (where, message) => failures.push(`${where}: ${message}`);

const { url, close } = await serve(dirname(file));
const browser = await chromium.launch();
const used = new Set();
let screens = [];

for (const theme of ["light", "dark"]) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const origin = new URL(url).origin;
  page.on("console", (m) => m.type() === "error" && fail(`${theme}`, `console error: ${m.text()}`));
  page.on("pageerror", (e) => fail(`${theme}`, `page error: ${e.message}`));
  page.on("request", (r) => {
    const u = new URL(r.url());
    if (!["data:", "blob:"].includes(u.protocol) && (u.origin !== origin || u.pathname !== `/${basename(file)}`)) fail(theme, `outside request: ${r.url()}`);
  });
  await page.goto(`${url}/${basename(file)}`);
  await page.evaluate((t) => (document.documentElement.dataset.theme = t), theme);
  await page.addScriptTag({ content: fidelitySource });
  await page.addScriptTag({ content: axeSource });
  screens = await page.$$eval("template[data-pg-screen]", (ts) => ts.map((t) => ({ id: t.dataset.pgScreen, label: t.dataset.pgLabel })));
  const links = await page.$$eval(".pg-bar a", (as) => as.map((a) => a.hash.slice(1)));
  if (theme === "light" && links.join() !== screens.map((s) => s.id).join()) fail("pg-bar", "links must match the screens, in order");

  for (const { id } of screens) {
    const where = `${id} (${theme})`;
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.evaluate((h) => (location.hash = h), id);
    await page.waitForTimeout(60);
    const result = await page.evaluate(async ({ s }) => {
      const stage = document.getElementById("pg-stage");
      const fidelity = window.PanelFidelity.checkDocument(stage, s);
      const savebar = stage.querySelector(".pn-savebar");
      const screen = stage.querySelector(".pn-screen");
      const controls = [...stage.querySelectorAll(".pn-layout-body input, .pn-layout-body textarea, .pn-layout-body select, .pn-savebar button")];
      const axe = await window.axe.run(document, { resultTypes: ["violations"] });
      return {
        fidelity,
        state: screen?.dataset.state,
        save: savebar?.dataset.state,
        dialogs: [...document.querySelectorAll("dialog")].filter((d) => d.open).map((d) => d.dataset.template),
        locked: controls.length > 0 && controls.every((c) => c.disabled),
        invalid: stage.querySelectorAll('[aria-invalid="true"]').length,
        login: Boolean(stage.querySelector('[data-template="screen-login"]')),
        violations: axe.violations.map((v) => `${v.id} (${v.nodes.map((n) => n.target.join(" ")).join(", ")})`),
      };
    }, { s: sources });
    for (const r of result.fidelity) {
      used.add(r.name);
      if (!r.ok) fail(where, `${r.name}: ${r.diff}`);
    }
    if (!result.fidelity.length) fail(where, "no templates on this screen");
    for (const v of result.violations) fail(where, `axe ${v}`);
    const want = expected.get(id);
    if (want && theme === "light") {
      if (want.state && result.state !== want.state) fail(where, `screen data-state is "${result.state}", should be "${want.state}"`);
      if (want.save && result.save !== want.save) fail(where, `save bar data-state is "${result.save}", should be "${want.save}"`);
      if (want.dialog && !result.dialogs.includes(want.dialog)) fail(where, `${want.dialog} should be open`);
      if (want.locked && !result.locked) fail(where, "every control, Save, and Revert should be disabled while saving");
      if (want.invalid && !result.invalid) fail(where, 'no field shows aria-invalid="true"');
      if (want.login && !result.login) fail(where, "screen-login is missing");
    }
    await page.setViewportSize({ width: 400, height: 900 });
    await page.waitForTimeout(30);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (overflow > 0) fail(where, `${overflow}px of sideways scroll at 400px`);
  }
  await page.close();
}

for (const id of expected.keys()) if (!screens.some((s) => s.id === id)) fail("screens", `missing screen "${id}" (playground.md Rule 2)`);
for (const name of neededTemplates) if (!used.has(name)) fail("templates", `"${name}" is never used`);

await browser.close();
close();

console.log(`${screens.length} screens x 2 themes, ${used.size} templates used`);
if (failures.length) {
  console.log(`\n${failures.length} problems:`);
  for (const f of failures) console.log(`  ${f}`);
  process.exit(1);
}
console.log("\nALL CHECKS PASSED");
