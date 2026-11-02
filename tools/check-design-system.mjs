// Phase 1 exit check for panel/design-system/index.html.
// For each theme mode: no console errors, no axe violations, every tab stop shows a visible focus ring.
// Writes screenshots and a JSON report to tools/out/.

import { chromium } from "playwright";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { dirname, join, extname, normalize } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const types = { ".html": "text/html", ".css": "text/css", ".svg": "image/svg+xml", ".js": "text/javascript" };
const server = createServer((req, res) => {
  const file = join(root, normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)));
  if (!file.startsWith(root)) return res.writeHead(403).end();
  try {
    res.writeHead(200, { "content-type": types[extname(file)] ?? "application/octet-stream" }).end(readFileSync(file));
  } catch {
    res.writeHead(404).end();
  }
}).listen(0);
const pageUrl = `http://localhost:${server.address().port}/panel/design-system/index.html`;
const axeSource = readFileSync(join(root, "node_modules/axe-core/axe.min.js"), "utf8");
const outDir = join(root, "tools/out");
mkdirSync(outDir, { recursive: true });

const modes = [
  { name: "light", colorScheme: "light", dataTheme: null },
  { name: "dark-system", colorScheme: "dark", dataTheme: null },
  { name: "dark-attribute", colorScheme: "light", dataTheme: "dark" },
  { name: "light-attribute-over-dark-system", colorScheme: "dark", dataTheme: "light" },
];

const iconSprite = readFileSync(join(root, "panel/design-system/icons.svg"), "utf8");
const livingPage = readFileSync(join(root, "panel/design-system/index.html"), "utf8");
const symbols = (text) => [...text.matchAll(/<symbol[\s\S]*?<\/symbol>/g)].map((m) => m[0]).join("\n");

const report = { iconsInSync: symbols(iconSprite) === symbols(livingPage), modes: [] };
const browser = await chromium.launch();

for (const mode of modes) {
  const context = await browser.newContext({ colorScheme: mode.colorScheme, viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on("console", (msg) => msg.type() === "error" && consoleErrors.push(msg.text()));
  page.on("pageerror", (err) => consoleErrors.push(err.message));

  await page.goto(pageUrl);
  if (mode.dataTheme) await page.evaluate((t) => document.documentElement.setAttribute("data-theme", t), mode.dataTheme);
  await page.waitForTimeout(400);

  const resolvedBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);

  await page.addScriptTag({ content: axeSource });
  const axe = await page.evaluate(async () => {
    // data-force cells pair a forced state with real focus styles; color-contrast still applies to them.
    const result = await window.axe.run(document, { resultTypes: ["violations"] });
    return result.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      help: v.help,
      nodes: v.nodes.slice(0, 5).map((n) => ({ target: n.target.join(" "), summary: n.failureSummary })),
      count: v.nodes.length,
    }));
  });

  // Walk every tab stop and confirm a visible ring on the element or a near ancestor.
  const focusProblems = [];
  let stops = 0;
  const seen = new Set();
  for (let i = 0; i < 400; i++) {
    await page.keyboard.press("Tab");
    const info = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      const path = (node) => {
        const parts = [];
        while (node && node.nodeType === 1 && parts.length < 4) {
          parts.unshift(node.tagName.toLowerCase() + (node.id ? "#" + node.id : "") + (node.className && typeof node.className === "string" ? "." + node.className.trim().split(/\s+/).join(".") : ""));
          node = node.parentElement;
        }
        return parts.join(" > ");
      };
      const ringOn = (node) => {
        const s = getComputedStyle(node);
        const rect = node.getBoundingClientRect();
        const outline = s.outlineStyle !== "none" && parseFloat(s.outlineWidth) >= 2 && s.outlineColor !== "rgba(0, 0, 0, 0)";
        return outline && rect.width >= 8 && rect.height >= 8;
      };
      let node = el;
      let ok = false;
      for (let depth = 0; node && depth < 4; depth++, node = node.parentElement) {
        if (ringOn(node)) { ok = true; break; }
      }
      const index = [...document.querySelectorAll("*")].indexOf(el);
      return { key: `${index} ${path(el)}`, ok };
    });
    if (!info) continue;
    if (seen.has(info.key)) break;
    seen.add(info.key);
    stops++;
    if (!info.ok) focusProblems.push(info.key);
  }

  const shot = join(outDir, `design-system-${mode.name}.png`);
  await page.screenshot({ path: shot, fullPage: true });

  // Real modal opens and closes with Escape.
  await page.evaluate(() => document.getElementById("demo-dialog").showModal());
  const modalOpen = await page.evaluate(() => document.getElementById("demo-dialog").matches(":modal"));
  await page.keyboard.press("Escape");
  const modalClosed = await page.evaluate(() => !document.getElementById("demo-dialog").open);

  // Phone width: no horizontal scroll.
  await page.setViewportSize({ width: 400, height: 900 });
  const overflowX = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  await page.screenshot({ path: join(outDir, `design-system-${mode.name}-400.png`), fullPage: true });

  report.modes.push({ mode: mode.name, resolvedBg, consoleErrors, axe, tabStops: stops, focusProblems, modalOpen, modalClosed, overflowXAt400: overflowX });
  await context.close();
}

await browser.close();
server.close();
writeFileSync(join(outDir, "design-system-report.json"), JSON.stringify(report, null, 2));

let failed = !report.iconsInSync;
console.log(`icons in sync with living page: ${report.iconsInSync}`);
for (const m of report.modes) {
  const pass = m.consoleErrors.length === 0 && m.axe.length === 0 && m.focusProblems.length === 0 && m.modalOpen && m.modalClosed && m.overflowXAt400 <= 0;
  if (!pass) failed = true;
  console.log(`\n[${pass ? "PASS" : "FAIL"}] ${m.mode} (body bg ${m.resolvedBg})`);
  console.log(`  console errors: ${m.consoleErrors.length}`);
  m.consoleErrors.forEach((e) => console.log(`    ${e}`));
  console.log(`  axe violations: ${m.axe.length}`);
  m.axe.forEach((v) => {
    console.log(`    ${v.id} (${v.impact}, ${v.count} nodes): ${v.help}`);
    v.nodes.forEach((n) => console.log(`      ${n.target}\n        ${n.summary.replace(/\n/g, "\n        ")}`));
  });
  console.log(`  tab stops: ${m.tabStops}, without visible focus: ${m.focusProblems.length}`);
  m.focusProblems.forEach((p) => console.log(`    ${p}`));
  console.log(`  modal opens: ${m.modalOpen}, Escape closes: ${m.modalClosed}`);
  console.log(`  horizontal overflow at 400px: ${m.overflowXAt400}px`);
}
process.exit(failed ? 1 : 0);
