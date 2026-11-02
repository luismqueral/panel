// Phase 2 exit check for panel/templates.
// 1. Source rules: one root, data-template matches the file, slots are blank.
// 2. Fidelity: fill each template, strip it, and compare to its source. Mutations must be caught.
// 3. Accessibility (axe) in light and dark, for every template alone and in composed screens.
// 4. Phone width: no horizontal overflow at 400px.

import { chromium } from "playwright";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { serve } from "./lib/serve.mjs";
import { loadTemplates } from "./lib/templates.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "tools/out");
mkdirSync(outDir, { recursive: true });

const { sources, files } = loadTemplates(root);

const sprite = readFileSync(join(root, "panel/design-system/icons.svg"), "utf8");
writeFileSync(
  join(outDir, "harness.html"),
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Panel template check</title>
<link rel="stylesheet" href="/panel/design-system/tokens.css"><link rel="stylesheet" href="/panel/design-system/components.css">
<script src="/tools/lib/fidelity.js"></script><script src="/tools/lib/compose.js"></script></head><body class="pn" style="margin:0">${sprite}<div id="stage"></div></body></html>`,
);

const axeSource = readFileSync(join(root, "node_modules/axe-core/axe.min.js"), "utf8");
const server = serve(root);
const browser = await chromium.launch();
const failures = [];
const log = [];
const fail = (msg) => failures.push(msg);

async function openHarness(colorScheme = "light", width = 1280) {
  const context = await browser.newContext({ colorScheme, viewport: { width, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${server.url}/tools/out/harness.html`);
  await page.addScriptTag({ content: axeSource });
  return { page, context, errors };
}

async function runAxe(page, isFragment) {
  return page.evaluate(async (isFragment) => {
    const rules = isFragment ? { "page-has-heading-one": { enabled: false } } : {};
    const r = await window.axe.run(document.getElementById("stage"), { rules, resultTypes: ["violations"] });
    return r.violations.map((v) => `${v.id}: ${v.help} — ${v.nodes.slice(0, 3).map((n) => n.target.join(" ") + " :: " + n.failureSummary.split("\n").slice(1).join(" ").trim()).join(" | ")}`);
  }, isFragment);
}

async function overflowAt400(page) {
  await page.setViewportSize({ width: 400, height: 900 });
  await page.waitForTimeout(50);
  return page.evaluate(() => {
    const w = document.documentElement.clientWidth;
    const over = [...document.querySelectorAll("#stage *")].filter((e) => {
      const r = e.getBoundingClientRect();
      return r.width > 0 && r.right > w + 0.5 && getComputedStyle(e).position !== "fixed";
    });
    return { px: document.documentElement.scrollWidth - w, offenders: over.slice(0, 3).map((e) => e.className || e.localName) };
  });
}

// 1. Source rules
for (const [name, html] of Object.entries(sources)) {
  const { page, context } = await openHarness();
  const problems = await page.evaluate(({ html, name }) => {
    const out = [];
    let el;
    try {
      el = window.PanelFidelity.parseTemplate(html);
    } catch (e) {
      return [e.message];
    }
    if (el.getAttribute("data-template") !== name) out.push(`data-template is "${el.getAttribute("data-template")}", expected "${name}"`);
    const all = [el, ...el.querySelectorAll("*")];
    for (const n of all) {
      if ((n.hasAttribute("data-slot") || n.hasAttribute("data-slot-children")) && n.childNodes.length) out.push(`slot ${n.getAttribute("data-slot") || n.getAttribute("data-slot-children")} is not empty`);
      for (const pair of (n.getAttribute("data-slot-attr") || "").split(/\s+/).filter(Boolean)) {
        const attr = pair.split(":")[0];
        if (!n.hasAttribute(attr)) out.push(`data-slot-attr names "${attr}" but the element has no such attribute`);
        else if (n.getAttribute(attr) !== "") out.push(`slot attribute ${attr} is not blank`);
      }
      if (n.hasAttribute("data-slot-repeat") && n.children.length !== 1) out.push(`repeat ${n.getAttribute("data-slot-repeat")} must hold exactly one unit`);
      if (n.hasAttribute("style") && n !== el) out.push("inline style attribute in a template");
    }
    return out;
  }, { html, name });
  problems.forEach((p) => fail(`[source] ${files[name]}: ${p}`));
  log.push(`[source] ${files[name]}: ${problems.length ? "FAIL" : "ok"}`);
  await context.close();
}

// 2. Fidelity round trip and mutation detection
{
  const { page, context } = await openHarness();
  const results = await page.evaluate((sources) => {
    const F = window.PanelFidelity;
    const out = [];
    for (const [name, html] of Object.entries(sources)) {
      const src = F.normalize(F.parseTemplate(html));
      const filled = F.fill(F.parseTemplate(html));
      const roundTrip = F.compare(src, F.normalize(filled));
      const mutations = {
        "class renamed": (el) => {
          const t = el.querySelector("[class]") || el;
          t.setAttribute("class", t.getAttribute("class") + " extra");
        },
        "element removed": (el) => el.lastElementChild.remove(),
        "element added": (el) => el.appendChild(document.createElement("div")),
        "fixed attribute changed": (el) => {
          const t = [el, ...el.querySelectorAll("*")].find((n) => [...n.attributes].some((a) => !a.name.startsWith("data-slot") && a.name !== "class" && !(n.getAttribute("data-slot-attr") || "").includes(a.name + ":")));
          const a = [...t.attributes].find((a) => !a.name.startsWith("data-slot") && a.name !== "class" && !(t.getAttribute("data-slot-attr") || "").includes(a.name + ":"));
          t.setAttribute(a.name, a.value + "x");
        },
      };
      const repeatHost = filled.matches("[data-slot-repeat]") ? filled : filled.querySelector("[data-slot-repeat]");
      if (repeatHost) mutations["repeat unit changed"] = (el) => {
        const host = el.matches("[data-slot-repeat]") ? el : el.querySelector("[data-slot-repeat]");
        host.lastElementChild.setAttribute("data-extra", "");
      };
      const caught = {};
      for (const [label, mutate] of Object.entries(mutations)) {
        const copy = filled.cloneNode(true);
        mutate(copy);
        caught[label] = !!F.compare(src, F.normalize(copy));
      }
      out.push({ name, roundTrip, caught });
    }
    return out;
  }, sources);
  for (const r of results) {
    if (r.roundTrip) fail(`[fidelity] ${files[r.name]}: filled template does not match its source: ${r.roundTrip}`);
    const missed = Object.entries(r.caught).filter(([, c]) => !c).map(([l]) => l);
    if (missed.length) fail(`[fidelity] ${files[r.name]}: mutations not caught: ${missed.join(", ")}`);
    log.push(`[fidelity] ${files[r.name]}: round trip ${r.roundTrip ? "FAIL" : "ok"}, mutations caught ${Object.values(r.caught).filter(Boolean).length}/${Object.keys(r.caught).length}`);
  }
  await context.close();
}

// 3 and 4. Accessibility and phone width, alone and composed
const scenarios = [];
for (const name of Object.keys(sources)) {
  if (name.startsWith("field-")) for (const fieldState of ["default", "error", "disabled"]) scenarios.push({ kind: "alone", name, fieldState, label: `${name} (${fieldState})` });
  else scenarios.push({ kind: "alone", name, label: name });
}
scenarios.push(
  { kind: "item", label: "composed: item, all fields, unsaved", shot: "item" },
  { kind: "item", state: "loading", saveState: "clean", label: "composed: item, loading" },
  { kind: "item", state: "error", saveState: "error", label: "composed: item, error", shot: "item-error" },
  { kind: "collection", state: "ready", label: "composed: collection", shot: "collection" },
  { kind: "collection", state: "empty", label: "composed: collection, empty", shot: "collection-empty" },
  { kind: "collection", state: "loading", label: "composed: collection, loading" },
  { kind: "collection", state: "error", label: "composed: collection, error" },
  { kind: "home", label: "composed: home", shot: "home" },
  { kind: "singleton", label: "composed: singleton", shot: "singleton" },
  { kind: "system-error", label: "composed: system error", shot: "system-error" },
  { kind: "login", label: "composed: login", shot: "login" },
  { kind: "modal", name: "screen-create", label: "composed: create dialog open", shot: "create" },
  { kind: "modal", name: "screen-slide-over", label: "composed: slide-over open", shot: "slide-over" },
  { kind: "modal", name: "screen-dialog", label: "composed: confirm dialog open", shot: "dialog" },
);

for (const scenario of scenarios) {
  for (const scheme of ["light", "dark"]) {
    const { page, context, errors } = await openHarness(scheme);
    const fidelity = await page.evaluate(({ sources, scenario }) => window.PanelCompose.build(sources, scenario), { sources, scenario });
    await page.waitForTimeout(150);
    const badFidelity = fidelity.filter((r) => !r.ok);
    const axe = await runAxe(page, scenario.kind === "alone");
    if (scenario.shot && scheme === "light") await page.screenshot({ path: join(outDir, `tpl-${scenario.shot}.png`), fullPage: true });
    if (scenario.shot && scheme === "dark") await page.screenshot({ path: join(outDir, `tpl-${scenario.shot}-dark.png`), fullPage: true });
    const overflow = scheme === "light" ? await overflowAt400(page) : { px: 0 };
    if (scenario.shot && scheme === "light") await page.screenshot({ path: join(outDir, `tpl-${scenario.shot}-400.png`), fullPage: true });
    const tag = `${scenario.label} [${scheme}]`;
    badFidelity.forEach((r) => fail(`[fidelity] ${tag}: ${r.name}: ${r.diff}`));
    axe.forEach((v) => fail(`[a11y] ${tag}: ${v}`));
    errors.forEach((e) => fail(`[console] ${tag}: ${e}`));
    if (overflow.px > 0) fail(`[400px] ${tag}: overflows by ${overflow.px}px (${overflow.offenders.join(", ")})`);
    log.push(`[render] ${tag}: templates ${fidelity.length - badFidelity.length}/${fidelity.length}, axe ${axe.length}, console ${errors.length}${scheme === "light" ? `, overflow ${overflow.px}px` : ""}`);
    await context.close();
  }
}

await browser.close();
server.close();
writeFileSync(join(outDir, "templates-report.txt"), log.join("\n") + "\n\nFAILURES\n" + failures.join("\n"));
console.log(log.join("\n"));
console.log(`\n${Object.keys(sources).length} templates, ${scenarios.length} scenarios x 2 themes`);
if (failures.length) {
  console.log(`\nFAILURES (${failures.length})`);
  failures.forEach((f) => console.log("  " + f));
  process.exit(1);
}
console.log("\nALL CHECKS PASSED");
