// Static file server rooted at the repo, for checks that need http:// (axe cannot read stylesheets over file://).
// routes: optional { "/path": () => ({ type, body }) } for generated responses.

import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { join, extname, normalize } from "node:path";

const types = { ".html": "text/html", ".css": "text/css", ".svg": "image/svg+xml", ".js": "text/javascript", ".json": "application/json" };

export function serve(root, { port = 0, routes = {} } = {}) {
  const server = createServer((req, res) => {
    const path = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (routes[path]) {
      const { type, body } = routes[path]();
      return res.writeHead(200, { "content-type": type, "cache-control": "no-store" }).end(body);
    }
    const file = join(root, normalize(path));
    if (!file.startsWith(root)) return res.writeHead(403).end();
    try {
      res.writeHead(200, { "content-type": types[extname(file)] ?? "application/octet-stream", "cache-control": "no-store" }).end(readFileSync(file));
    } catch {
      res.writeHead(404).end();
    }
  });
  server.on("error", (error) => {
    if (error.code !== "EADDRINUSE") throw error;
    console.error(`Port ${port} is in use. Run with another port, for example: PORT=4800 npm run preview`);
    process.exit(1);
  });
  server.listen(port);
  return { url: `http://localhost:${server.address()?.port ?? port}`, close: () => server.close() };
}
