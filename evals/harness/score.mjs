// Scores an experiment: every run folder under it is checked for conformance, template
// fidelity, unmodified shipped files, and consistency with the other runs.
// Usage: node evals/harness/score.mjs <evals dir>/runs/<experiment> [--out <evals dir>/results/<experiment>]
// The evals dir defaults to ../panel-evals (see paths.mjs).

import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, relative, resolve } from "node:path";
import { chromium } from "@playwright/test";
import { parse as parseYaml } from "yaml";
import { serve } from "../../tools/lib/serve.mjs";
import { evalsDir, root } from "./paths.mjs";
import { loadTemplates } from "../../tools/lib/templates.mjs";

const args = process.argv.slice(2);
const experiment = args[0] && resolve(args[0]);
if (!experiment || !existsSync(experiment)) {
  console.error(`Usage: node evals/harness/score.mjs ${evalsDir}/runs/<experiment> [--out <folder>]`);
  process.exit(2);
}
const outIndex = args.indexOf("--out");
const out = resolve(outIndex > -1 ? args[outIndex + 1] : join(evalsDir, "results", basename(experiment)));
mkdirSync(out, { recursive: true });

const seedFile = join(root, "evals/behavior/seed.json");
const seed = JSON.parse(readFileSync(seedFile, "utf8"));
const fidelityScript = join(root, "tools/lib/fidelity.js");
const { sources } = loadTemplates(root);
const sha = (s) => createHash("sha256").update(s).digest("hex").slice(0, 12);
const squash = (s) => s.replace(/\s+/g, " ").trim();

const REQUIRED = ["index.html", "panel.config.js", "panel.js", "styles/tokens.css", "styles/components.css", "adapters/memory.js", "seed.json", "CONFORMANCE.md"];

// Files the skill ships that a build must copy byte for byte: [path in build, path in skill].
function shippedCopies(panel) {
  const pairs = [
    ["styles/tokens.css", "panel/design-system/tokens.css"],
    ["styles/components.css", "panel/design-system/components.css"],
    ["adapters/memory.js", "panel/recipes/client/memory.js"],
  ];
  for (const dir of [["snippets", "panel/snippets"], ["adapters", "panel/recipes/client"], ["server", "panel/recipes/server"], ["../server", "panel/recipes/server"]]) {
    const here = join(panel, dir[0]);
    if (!existsSync(here)) continue;
    for (const file of readdirSync(here)) if (existsSync(join(root, dir[1], file))) pairs.push([`${dir[0]}/${file}`, `${dir[1]}/${file}`]);
  }
  return [...new Map(pairs.map((p) => [p[0], p])).values()];
}

function staticChecks(run) {
  const panel = join(run, "panel");
  const missing = REQUIRED.filter((f) => !existsSync(join(panel, f)));
  // build.md "What you produce": with a login recipe, the allow list lives in allow.mjs, never in the served config.
  const schemaAuth = parseYaml(readFileSync(existsSync(join(run, "panel.yaml")) ? join(run, "panel.yaml") : join(root, "panel/examples/blog/panel.yaml"), "utf8")).auth ?? {};
  const allow = schemaAuth.allow ?? [];
  if (allow.length && !existsSync(join(run, "allow.mjs"))) missing.push("../allow.mjs");
  const config = existsSync(join(panel, "panel.config.js")) ? readFileSync(join(panel, "panel.config.js"), "utf8") : "";
  const allowServed = allow.filter((a) => config.includes(a));
  if (allowServed.length) missing.push("allow list out of panel.config.js");
  const modified = shippedCopies(panel)
    .filter(([mine, theirs]) => existsSync(join(panel, mine)) && readFileSync(join(panel, mine), "utf8") !== readFileSync(join(root, theirs), "utf8"))
    .map(([mine]) => mine);

  const html = existsSync(join(panel, "index.html")) ? readFileSync(join(panel, "index.html"), "utf8") : "";
  const inlined = Object.fromEntries([...html.matchAll(/<template data-panel-template="([^"]+)">([\s\S]*?)<\/template>/g)].map((m) => [m[1], m[2]]));
  // build.md step 1: every shell and screen template, and field-<type> for each type the schema uses.
  const schema = parseYaml(readFileSync(existsSync(join(run, "panel.yaml")) ? join(run, "panel.yaml") : join(root, "panel/examples/blog/panel.yaml"), "utf8"));
  const used = new Set([...(schema.types ?? []), ...(schema.singletons ?? [])].flatMap((t) => (t.fields ?? []).map((f) => `field-${f.type}`)));
  const templatesMissing = Object.keys(sources).filter((n) => (!n.startsWith("field-") || used.has(n)) && !(n in inlined));
  const templatesChanged = Object.keys(sources).filter((n) => n in inlined && squash(inlined[n]) !== squash(sources[n]));

  const code = walk(panel).filter((f) => /\.(m?js|html)$/.test(f)).map((f) => readFileSync(f, "utf8")).join("\n");
  const bareImports = [...code.matchAll(/\bfrom\s+["']([^./"'][^"']*)["']/g)].map((m) => m[1]).filter((m) => !m.startsWith("node:"));
  const externalScripts = [...code.matchAll(/<script[^>]+src=["'](https?:[^"']+)["']/g)].map((m) => m[1]);
  // A package.json may only set "type": "module" (build.md step 6); any dependency counts as added.
  const packageJson = [join(run, "package.json"), join(panel, "package.json")].filter(existsSync).some((f) => {
    const pkg = JSON.parse(readFileSync(f, "utf8"));
    return ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"].some((k) => Object.keys(pkg[k] ?? {}).length);
  });

  return { missing, modified, templatesMissing, templatesChanged, bareImports, externalScripts, packageJson, allowServed };
}

function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

function runSuite(url) {
  return new Promise((done) => {
    let stdout = "";
    const child = spawn("npx", ["playwright", "test", "-c", "evals/behavior/playwright.config.mjs", "--reporter=json"], {
      cwd: root,
      env: { ...process.env, PANEL_URL: `${url}/` },
    });
    child.stdout.on("data", (d) => (stdout += d));
    child.on("exit", () => {
      const tests = [];
      try {
        const visit = (suite, path) => {
          for (const spec of suite.specs ?? []) {
            const results = spec.tests.flatMap((t) => t.results);
            const last = results[results.length - 1];
            tests.push({ title: [...path, spec.title].join(" › "), ok: spec.ok, error: last?.error?.message?.split("\n")[0] ?? null });
          }
          for (const child of suite.suites ?? []) visit(child, suite.title && !suite.title.endsWith(".mjs") ? [...path, suite.title] : path);
        };
        for (const suite of JSON.parse(stdout).suites) visit(suite, []);
      } catch {
        tests.push({ title: "suite did not run", ok: false, error: stdout.slice(0, 400) });
      }
      done(tests);
    });
  });
}

const VIEWS = [
  { name: "home", hash: "#/" },
  { name: "collection", hash: "#/post" },
  { name: "item", hash: "#/post/rail-line" },
  { name: "item-published", hash: "#/post/winter-light" },
  { name: "singleton", hash: "#/settings" },
  { name: "not-found", hash: "#/nope" },
  { name: "create", hash: "#/post", click: '.pn-screen-actions [data-action="create"]' },
  { name: "confirm-delete", hash: "#/post/rail-line", click: '.pn-screen [data-action="delete"]' },
];

// Structure: the page normalized as the fidelity check sees it, slot contents blanked.
// Copy: the visible text. Shots: full-page PNGs for a side-by-side look.
async function snapshots(browser, url, shots) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const result = {};
  for (const view of VIEWS) {
    try {
      await page.goto(`${url}/?test${view.hash}`);
      await page.waitForFunction(() => window.panelTest, null, { timeout: 5000 });
      await page.evaluate((d) => window.panelTest.reset(d), seed);
      await page.waitForFunction(() => {
        const s = document.querySelector(".pn-screen");
        return s && s.dataset.state !== "loading";
      }, null, { timeout: 5000 });
      if (view.click) await page.click(view.click, { timeout: 3000 });
      await page.waitForTimeout(200);
      await page.addScriptTag({ path: fidelityScript });
      const snap = await page.evaluate(() => {
        const app = document.querySelector(".pn-layout") ?? document.body;
        const state = new Set(window.PanelFidelity.STATE_ATTRS);
        const walk = (el) => {
          const blank = new Set((el.getAttribute("data-slot-attr") || "").split(/\s+/).filter(Boolean).map((p) => p.split(":")[0]));
          const attrs = [...el.attributes]
            .filter((a) => !state.has(a.name) && a.name !== "value")
            .map((a) => `${a.name}=${blank.has(a.name) ? "" : a.value}`)
            .sort();
          const kids = [...el.children].filter((c) => !["SCRIPT", "TEMPLATE"].includes(c.tagName)).map(walk);
          return `<${el.localName} ${attrs.join(" ")}>${kids.join("")}</${el.localName}>`;
        };
        return { structure: walk(app), copy: app.innerText.replace(/\s+/g, " ").trim() };
      });
      await page.screenshot({ path: join(shots, `${view.name}.png`), fullPage: true });
      result[view.name] = { structure: sha(snap.structure), copy: sha(snap.copy), text: snap.copy };
    } catch (error) {
      result[view.name] = { structure: "error", copy: "error", text: String(error.message).split("\n")[0] };
    }
  }
  await page.close();
  return result;
}

const runs = readdirSync(experiment).filter((d) => existsSync(join(experiment, d, "panel"))).sort();
if (!runs.length) {
  console.error(`No runs with a panel/ folder in ${relative(root, experiment)}`);
  process.exit(1);
}

const browser = await chromium.launch();
const report = [];
for (const name of runs) {
  const run = join(experiment, name);
  const checks = staticChecks(run);
  const stage = mkdtempSync(join(tmpdir(), "panel-score-"));
  cpSync(join(run, "panel"), stage, { recursive: true });
  cpSync(seedFile, join(stage, "seed.json"));
  const { url, close } = await serve(stage);
  process.stdout.write(`${name}: suite… `);
  const tests = await runSuite(url);
  const shots = join(out, "shots", name);
  mkdirSync(shots, { recursive: true });
  const snaps = await snapshots(browser, url, shots);
  close();
  rmSync(stage, { recursive: true, force: true });

  const failed = tests.filter((t) => !t.ok);
  const fidelity = tests.filter((t) => t.title.includes("matches its templates"));
  const unmodified = !checks.modified.length && !checks.templatesMissing.length && !checks.templatesChanged.length;
  const noDeps = !checks.bareImports.length && !checks.packageJson && checks.externalScripts.every((s) => s.startsWith("https://accounts.google.com/"));
  const conformance = tests.length > 0 && !failed.length && unmodified && noDeps && !checks.missing.length && !checks.allowServed.length;
  report.push({ name, conformance, unmodified, noDeps, checks, passed: tests.length - failed.length, total: tests.length, fidelityPassed: fidelity.filter((t) => t.ok).length, fidelityTotal: fidelity.length, failed, snaps });
  console.log(`${tests.length - failed.length}/${tests.length} tests, conformance ${conformance ? "pass" : "fail"}`);
}
await browser.close();

// Consistency: for each view, how many distinct structures and copies the runs produced.
const consistency = VIEWS.map((v) => {
  const s = new Set(report.map((r) => r.snaps[v.name].structure));
  const c = new Set(report.map((r) => r.snaps[v.name].copy));
  return { view: v.name, structures: s.size, copies: c.size };
});

const passing = report.filter((r) => r.conformance).length;
const rate = passing / report.length;
writeFileSync(join(out, "results.json"), JSON.stringify({ experiment: relative(root, experiment), rate, report, consistency }, null, 2));

const lines = [
  `# Results: ${basename(experiment)}`,
  "",
  `Scored ${new Date().toISOString().slice(0, 10)} with \`node evals/harness/score.mjs ${relative(root, experiment)}\`.`,
  "",
  `**Conformance with unmodified templates: ${passing} of ${report.length} runs (${Math.round(rate * 100)}%). Kill criterion (80%): ${rate >= 0.8 ? "passed" : "failed"}.**`,
  "",
  "A run conforms when every behavior and quality test passes, every shipped file (templates, CSS, snippets, adapters, server) is unmodified, it adds no dependencies, and every required file exists, and the login allow list is not in the served config.",
  "",
  "| Run | Conforms | Tests | Template fidelity | Unmodified files | No dependencies | Missing files |",
  "| --- | --- | --- | --- | --- | --- | --- |",
  ...report.map((r) =>
    `| ${r.name} | ${r.conformance ? "yes" : "no"} | ${r.passed}/${r.total} | ${r.fidelityPassed}/${r.fidelityTotal} | ${r.unmodified ? "yes" : `no: ${[...r.checks.modified, ...r.checks.templatesChanged.map((t) => `template ${t}`), ...r.checks.templatesMissing.map((t) => `missing template ${t}`)].join(", ")}`} | ${r.noDeps ? "yes" : "no"} | ${r.checks.missing.join(", ") || "none"} |`,
  ),
  "",
  "## Consistency across runs",
  "",
  "Distinct versions of each view across the runs. 1 means every run produced the same thing. Structure is the DOM as the fidelity check normalizes it (slot contents blank); copy is the visible text.",
  "",
  "| View | Structures | Copies |",
  "| --- | --- | --- |",
  ...consistency.map((c) => `| ${c.view} | ${c.structures} | ${c.copies} |`),
  "",
  "## Failed tests",
  "",
  ...report.flatMap((r) => (r.failed.length ? [`### ${r.name}`, "", ...r.failed.map((t) => `- ${t.title}${t.error ? `: ${t.error.replace(/\u001b\[[0-9;]*m/g, "")}` : ""}`), ""] : [])),
  ...(report.every((r) => !r.failed.length) ? ["None.", ""] : []),
  "## Copy differences",
  "",
  ...consistency
    .filter((c) => c.copies > 1)
    .flatMap((c) => [`### ${c.view}`, "", ...report.map((r) => `- ${r.name}: ${r.snaps[c.view].text.slice(0, 300)}`), ""]),
  ...(consistency.every((c) => c.copies === 1) ? ["None.", ""] : []),
];
writeFileSync(join(out, "results.md"), lines.join("\n"));
console.log(`\n${passing}/${report.length} runs conform (${Math.round(rate * 100)}%). Report: ${relative(root, join(out, "results.md"))}`);
