// local-disk: uploads saved under uploads/<yyyy>/<mm>/<random>-<name>, served from a URL path.

import { mkdir, writeFile, readFile } from "node:fs/promises";
import { join, normalize, extname } from "node:path";
import { randomBytes } from "node:crypto";
import { fail } from "./errors.mjs";

export const MAX_UPLOAD = 10 * 1024 * 1024;
const REFUSED = new Set(["text/html", "application/xhtml+xml", "text/javascript", "application/javascript"]);
const TYPES = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp", ".avif": "image/avif", ".svg": "image/svg+xml", ".pdf": "application/pdf", ".txt": "text/plain" };

export function createLocalDisk({ dir, url = "/uploads" }) {
  return {
    url,
    async upload({ body, name, type }) {
      if (body.length > MAX_UPLOAD) throw fail("too-large", "file is over 10 MB");
      const mime = (type || "application/octet-stream").split(";")[0].trim().toLowerCase();
      if (REFUSED.has(mime)) throw fail("invalid", `files of type ${mime} are not accepted`);
      const original = (name || "file").slice(0, 200);
      const safe = original.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^[.-]+/, "").slice(-80) || "file";
      const now = new Date();
      const folder = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
      const stored = `${randomBytes(4).toString("hex")}-${safe}`;
      await mkdir(join(dir, folder), { recursive: true });
      await writeFile(join(dir, folder, stored), body);
      return { url: `${url}/${folder}/${stored}`, name: original, size: body.length, type: mime };
    },
    // Returns { body, headers } for a GET under url, or null.
    async serve(path) {
      const rel = normalize(decodeURIComponent(path.slice(url.length))).replace(/^\/+/, "");
      if (rel.startsWith("..") || rel.includes("\0")) return null;
      try {
        const body = await readFile(join(dir, rel));
        return {
          body,
          headers: {
            "content-type": TYPES[extname(rel).toLowerCase()] ?? "application/octet-stream",
            "x-content-type-options": "nosniff",
            "content-security-policy": "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox",
            "cache-control": "public, max-age=31536000, immutable",
          },
        };
      } catch {
        return null;
      }
    },
  };
}
