// Builds the reference vanilla blog into dist/: templates and the sprite inlined verbatim,
// design-system CSS and snippets copied in, so dist/ is self-contained like a real build.

import { readFileSync, writeFileSync, mkdirSync, cpSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadTemplates } from "../../../tools/lib/templates.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "../../..");
const dist = join(here, "dist");

export function build() {
  rmSync(dist, { recursive: true, force: true });
  mkdirSync(join(dist, "styles"), { recursive: true });
  cpSync(join(here, "src"), dist, { recursive: true });
  cpSync(join(root, "panel/snippets"), join(dist, "snippets"), { recursive: true });
  cpSync(join(root, "panel/recipes/client"), join(dist, "adapters"), { recursive: true });
  cpSync(join(root, "panel/recipes/server"), join(dist, "server"), { recursive: true });
  for (const file of ["tokens.css", "components.css"]) cpSync(join(root, "panel/design-system", file), join(dist, "styles", file));
  cpSync(join(root, "evals/behavior/seed.json"), join(dist, "seed.json"));
  const { sources } = loadTemplates(root);
  const templates = Object.entries(sources)
    .map(([name, html]) => `<template data-panel-template="${name}">\n${html.trim()}\n</template>`)
    .join("\n");
  const sprite = readFileSync(join(root, "panel/design-system/icons.svg"), "utf8").trim();
  const page = readFileSync(join(here, "src/index.html"), "utf8").replace("<!-- panel:sprite -->", sprite).replace("<!-- panel:templates -->", templates);
  writeFileSync(join(dist, "index.html"), page);
  return dist;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) console.log(`built ${build()}`);
