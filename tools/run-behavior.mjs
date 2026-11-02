// Serves a built panel and runs the behavior suite against it.
// Usage: node tools/run-behavior.mjs <dist folder> [extra playwright args]

import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { serve } from "./lib/serve.mjs";

const [dir, ...args] = process.argv.slice(2);
if (!dir) {
  console.error("Usage: node tools/run-behavior.mjs <dist folder> [playwright args]");
  process.exit(2);
}
const { url, close } = await serve(resolve(dir));
const child = spawn("npx", ["playwright", "test", "-c", "evals/behavior/playwright.config.mjs", ...args], {
  stdio: "inherit",
  env: { ...process.env, PANEL_URL: `${url}/` },
});
child.on("exit", (code) => {
  close();
  process.exit(code ?? 1);
});
