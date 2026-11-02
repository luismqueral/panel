// Phase 3 exit check: the examples and valid fixtures pass; each invalid fixture fails with the expected, clear message.

import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { validateSource, formatIssue } from "./validate.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const rel = (p) => p.slice(root.length + 1);
let failures = 0;
const fail = (msg) => {
  failures++;
  console.log(`  FAIL ${msg}`);
};

console.log("Must be valid");
const validFiles = [
  ...readdirSync(join(root, "panel/examples")).map((d) => join(root, "panel/examples", d, "panel.yaml")),
  ...readdirSync(join(root, "evals/fixtures/schemas/valid")).map((f) => join(root, "evals/fixtures/schemas/valid", f)),
];
for (const file of validFiles) {
  const { errors, warnings } = validateSource(readFileSync(file, "utf8"), rel(file));
  if (errors.length) {
    fail(`${rel(file)}`);
    errors.forEach((e) => console.log("       " + formatIssue(e)));
  } else console.log(`  ok   ${rel(file)}${warnings.length ? ` (${warnings.length} warning${warnings.length > 1 ? "s" : ""})` : ""}`);
}

console.log("\nMust be rejected, with a clear message");
const dir = join(root, "evals/fixtures/schemas/invalid");
const expected = JSON.parse(readFileSync(join(dir, "expected.json"), "utf8"));
for (const [name, want] of Object.entries(expected)) {
  const file = join(dir, `${name}.yaml`);
  const { errors } = validateSource(readFileSync(file, "utf8"), rel(file));
  const text = errors.map((e) => e.message).join("\n");
  const missing = want.messages.filter((m) => !text.includes(m));
  if (!errors.length) fail(`${name}: accepted`);
  else if (missing.length) fail(`${name}: message should include ${missing.map((m) => JSON.stringify(m)).join(", ")}`);
  else if (errors.length !== want.errors) fail(`${name}: ${errors.length} errors, expected ${want.errors}`);
  else {
    console.log(`  ok   ${name}`);
    errors.forEach((e) => console.log("       " + formatIssue(e)));
    continue;
  }
  errors.forEach((e) => console.log("       " + formatIssue(e)));
}

const total = validFiles.length + Object.keys(expected).length;
console.log(`\n${total - failures}/${total} passed`);
process.exit(failures ? 1 : 0);
