// Copies the shipped React flavor files, snippets, design-system CSS, and adapters into src/,
// as a model following panel/flavors/react.md would, then builds with Vite into dist/.

import { cpSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build as vite } from "vite";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "../../..");

export async function build() {
  for (const dir of ["src/panel", "src/adapters"]) rmSync(join(here, dir), { recursive: true, force: true });
  mkdirSync(join(here, "src/panel"), { recursive: true });
  cpSync(join(root, "panel/flavors/react"), join(here, "src/panel"), { recursive: true });
  cpSync(join(root, "panel/snippets"), join(here, "src/panel/snippets"), { recursive: true });
  for (const file of ["tokens.css", "components.css"]) cpSync(join(root, "panel/design-system", file), join(here, "src/panel", file));
  cpSync(join(root, "panel/recipes/client"), join(here, "src/adapters"), { recursive: true });
  cpSync(join(root, "evals/behavior/seed.json"), join(here, "src/seed.json"));
  await vite({ root: here, configFile: join(here, "vite.config.js"), logLevel: "warn" });
  return join(here, "dist");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) console.log(`built ${await build()}`);
