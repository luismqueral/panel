// The project server (recipes/contracts.md, "The project server"). No dependencies.
// Serves the panel, the /api routes, and uploads.

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join, normalize, extname } from "node:path";
import { STATUS, fail } from "./errors.mjs";
import { isAllowed } from "./google.mjs";
import { MAX_UPLOAD } from "./local-disk.mjs";

const STATIC = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".json": "application/json" };
const MAX_JSON = 1024 * 1024;

// auth: { recipe: "google-login", allow, verify(credential) → { email, hd }, sessions, clientId }
//    or { recipe: "none" }
export function createPanelServer({ root, config, data, files, auth }) {
  async function body(req, limit) {
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > limit) throw fail("too-large", "request body is too large");
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }
  async function json(req) {
    const raw = await body(req, MAX_JSON);
    try {
      return JSON.parse(raw.toString("utf8") || "null");
    } catch {
      throw fail("invalid", "body is not JSON");
    }
  }

  // Returns the signed-in address, or throws unauthorized or forbidden.
  function signedIn(req, res, secure) {
    if (auth.recipe === "none") return "local";
    const session = auth.sessions.read(req.headers.cookie);
    if (!session) throw fail("unauthorized", "sign in first");
    if (!isAllowed({ email: session.user, hd: session.hd }, auth.allow)) throw fail("forbidden", "this account isn't allowed");
    if (session.renew) res.setHeader("set-cookie", auth.sessions.issue(session.user, { secure, hd: session.hd }));
    return session.user;
  }

  async function api(req, res, path, secure) {
    const method = req.method;
    if (method !== "GET" && req.headers["x-panel"] !== "1") throw fail("forbidden", "missing x-panel header");
    const parts = path.split("/").filter(Boolean).map(decodeURIComponent); // ["api", ...]

    if (parts[1] === "config" && method === "GET") return { auth: auth.recipe, googleClientId: auth.clientId ?? null };
    if (parts[1] === "session" && parts.length === 2) {
      if (method === "GET") return { user: signedIn(req, res, secure) };
      if (method === "POST" && auth.recipe === "google-login") {
        const { credential } = (await json(req)) ?? {};
        const who = await auth.verify(credential);
        if (!isAllowed(who, auth.allow)) throw fail("forbidden", "this account isn't allowed");
        res.setHeader("set-cookie", auth.sessions.issue(who.email, { secure, hd: who.hd }));
        return { user: who.email };
      }
      if (method === "DELETE") {
        if (auth.recipe !== "none") res.setHeader("set-cookie", auth.sessions.clear({ secure }));
        return null;
      }
    }

    signedIn(req, res, secure);
    const [, group, a, b] = parts;
    if (group === "items" && a && parts.length <= 4) {
      if (method === "GET" && !b) return data.list(a);
      if (method === "GET") return data.get(a, b);
      if (method === "POST" && !b) {
        const { status, values } = (await json(req)) ?? {};
        return data.create(a, { status, values });
      }
      if (method === "PUT" && b) {
        const { status, values } = (await json(req)) ?? {};
        return data.update(a, b, { status, values });
      }
      if (method === "DELETE" && b) return data.remove(a, b);
    }
    if (group === "singletons" && a && parts.length === 3) {
      if (method === "GET") return data.getSingleton(a);
      if (method === "PUT") return data.saveSingleton(a, ((await json(req)) ?? {}).values);
    }
    if (group === "files" && parts.length === 2 && method === "POST" && files) {
      const raw = await body(req, MAX_UPLOAD);
      return files.upload({ body: raw, name: decodeURIComponent(req.headers["x-file-name"] ?? "file"), type: req.headers["content-type"] });
    }
    throw fail("not-found", "no such route");
  }

  async function staticFile(res, path) {
    const file = normalize(path.endsWith("/") ? `${path}index.html` : path).replace(/^\/+/, "");
    if (file.startsWith("..")) return res.writeHead(404).end();
    try {
      const content = await readFile(join(root, file));
      res.writeHead(200, { "content-type": STATIC[extname(file)] ?? "application/octet-stream", "x-content-type-options": "nosniff", "cache-control": "no-cache" }).end(content);
    } catch {
      res.writeHead(404).end();
    }
  }

  return createServer(async (req, res) => {
    const path = new URL(req.url, "http://x").pathname;
    const secure = req.headers["x-forwarded-proto"] === "https" || Boolean(req.socket.encrypted);
    if (path.startsWith("/api/")) {
      try {
        const result = await api(req, res, path, secure);
        if (result === null || result === undefined) {
          if (req.method === "GET") return res.writeHead(200, { "content-type": "application/json" }).end("null");
          return res.writeHead(204).end();
        }
        return res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" }).end(JSON.stringify(result));
      } catch (error) {
        const code = STATUS[error.code] ? error.code : "unavailable";
        if (!STATUS[error.code]) console.error(error);
        if (code === "too-large") req.resume();
        return res
          .writeHead(STATUS[code], { "content-type": "application/json", "cache-control": "no-store" })
          .end(JSON.stringify({ error: { code, message: STATUS[error.code] ? error.message : "server error" } }));
      }
    }
    if (files && path.startsWith(`${files.url}/`) && req.method === "GET") {
      const found = await files.serve(path);
      return found ? res.writeHead(200, found.headers).end(found.body) : res.writeHead(404).end();
    }
    if (req.method !== "GET") return res.writeHead(405).end();
    return staticFile(res, path);
  });
}
