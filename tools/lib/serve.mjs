// Static file server rooted at the repo, for checks that need http:// (axe cannot read stylesheets over file://).

import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { join, extname, normalize } from "node:path";

const types = { ".html": "text/html", ".css": "text/css", ".svg": "image/svg+xml", ".js": "text/javascript", ".json": "application/json" };

export function serve(root) {
  const server = createServer((req, res) => {
    const file = join(root, normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)));
    if (!file.startsWith(root)) return res.writeHead(403).end();
    try {
      res.writeHead(200, { "content-type": types[extname(file)] ?? "application/octet-stream" }).end(readFileSync(file));
    } catch {
      res.writeHead(404).end();
    }
  }).listen(0);
  return { url: `http://localhost:${server.address().port}`, close: () => server.close() };
}
