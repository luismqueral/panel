// Reads every template file and names it by its data-template value.

import { readFileSync, readdirSync } from "node:fs";
import { join, basename } from "node:path";

const groups = { shell: "", screens: "screen-", fields: "field-" };
const renames = { "screen-create-dialog": "screen-create", "screen-empty": "empty", "screen-error": "error" };

export function loadTemplates(root) {
  const sources = {};
  const files = {};
  for (const [group, prefix] of Object.entries(groups)) {
    for (const file of readdirSync(join(root, "panel/templates", group)).filter((f) => f.endsWith(".html")).sort()) {
      const raw = prefix + basename(file, ".html");
      const name = renames[raw] ?? raw;
      sources[name] = readFileSync(join(root, "panel/templates", group, file), "utf8");
      files[name] = `${group}/${file}`;
    }
  }
  return { sources, files };
}
