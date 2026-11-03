// Signed session cookies. HMAC-SHA256 over the address and expiry; the browser cannot forge one.

import { createHmac, timingSafeEqual } from "node:crypto";

const NAME = "pn_session";
const LIFETIME = 7 * 24 * 60 * 60; // seconds

export function createSessions(secret) {
  if (!secret || secret.length < 32) throw new Error("SESSION_SECRET must be set to at least 32 random characters");
  const sign = (body) => createHmac("sha256", secret).update(body).digest("base64url");

  function issue(user, { secure, hd }) {
    const body = Buffer.from(JSON.stringify({ u: user, h: hd ?? null, exp: Math.floor(Date.now() / 1000) + LIFETIME })).toString("base64url");
    return `${NAME}=${body}.${sign(body)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${LIFETIME}${secure ? "; Secure" : ""}`;
  }

  // Returns { user, hd, renew } or null. renew is true when less than half the lifetime is left.
  function read(cookieHeader) {
    const raw = (cookieHeader ?? "").split(/;\s*/).find((c) => c.startsWith(`${NAME}=`))?.slice(NAME.length + 1);
    if (!raw) return null;
    const [body, mac] = raw.split(".");
    if (!body || !mac) return null;
    const expected = Buffer.from(sign(body));
    const given = Buffer.from(mac);
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
    let data;
    try {
      data = JSON.parse(Buffer.from(body, "base64url").toString());
    } catch {
      return null;
    }
    const left = data.exp - Math.floor(Date.now() / 1000);
    if (typeof data.u !== "string" || left <= 0) return null;
    return { user: data.u, hd: data.h ?? undefined, renew: left < LIFETIME / 2 };
  }

  const clear = ({ secure }) => `${NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure ? "; Secure" : ""}`;
  return { issue, read, clear };
}
