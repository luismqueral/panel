// Serves a directory over http. Usage: node tools/serve-static.mjs <dir> [port]

import { resolve } from "node:path";
import { serve } from "./lib/serve.mjs";

const [dir, port = "4800"] = process.argv.slice(2);
const { url } = await serve(resolve(dir), { port: Number(port) });
console.log(`Serving ${dir} at ${url}`);
