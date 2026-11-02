// Dev-only preview of the templates filled with sample data. Run: npm run preview

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { serve } from "./lib/serve.mjs";
import { loadTemplates } from "./lib/templates.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.env.PORT) || 4747;

const server = serve(root, {
  port,
  routes: {
    "/__templates.js": () => {
      const { sources, files } = loadTemplates(root);
      const sprite = readFileSync(join(root, "panel/design-system/icons.svg"), "utf8");
      return {
        type: "text/javascript",
        body: `window.PANEL_TEMPLATES = ${JSON.stringify(sources)};\nwindow.PANEL_TEMPLATE_FILES = ${JSON.stringify(files)};\nwindow.PANEL_SPRITE = ${JSON.stringify(sprite)};\n`,
      };
    },
  },
});

console.log(`Panel preview: ${server.url}/tools/preview/index.html`);
console.log(`Design system: ${server.url}/panel/design-system/index.html`);
console.log("Templates are reread on every page load. Ctrl+C to stop.");
