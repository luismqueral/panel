// google-login: verify a Google ID token (RS256 JWT) and check the allow list. No dependencies.

import { createPublicKey, verify as verifySignature } from "node:crypto";
import { fail } from "./errors.mjs";

const ISSUERS = new Set(["accounts.google.com", "https://accounts.google.com"]);
const CERTS = "https://www.googleapis.com/oauth2/v3/certs";
const SKEW = 60; // seconds of clock difference allowed

export function createKeyStore(fetchKeys = defaultFetchKeys) {
  let cache = { keys: [], until: 0 };
  return async function keyFor(kid) {
    if (Date.now() > cache.until || !cache.keys.some((k) => k.kid === kid)) cache = await fetchKeys();
    const jwk = cache.keys.find((k) => k.kid === kid);
    if (!jwk) throw fail("unauthorized", "unknown signing key");
    return createPublicKey({ key: jwk, format: "jwk" });
  };
}

async function defaultFetchKeys() {
  const res = await fetch(CERTS);
  if (!res.ok) throw fail("unavailable", "could not fetch Google's keys");
  const maxAge = Number(/max-age=(\d+)/.exec(res.headers.get("cache-control") ?? "")?.[1] ?? 300);
  return { keys: (await res.json()).keys, until: Date.now() + maxAge * 1000 };
}

const decode = (part) => JSON.parse(Buffer.from(part, "base64url").toString());

// Returns { email, hd } for a valid token issued to clientId. Throws unauthorized otherwise.
export async function verifyGoogleToken(token, { clientId, keyFor, now = Date.now() }) {
  if (!clientId) throw new Error("GOOGLE_CLIENT_ID is not set");
  const parts = typeof token === "string" ? token.split(".") : [];
  if (parts.length !== 3) throw fail("unauthorized", "malformed token");
  let header, payload;
  try {
    header = decode(parts[0]);
    payload = decode(parts[1]);
  } catch {
    throw fail("unauthorized", "malformed token");
  }
  if (header.alg !== "RS256") throw fail("unauthorized", "unexpected algorithm");
  const key = await keyFor(header.kid);
  const ok = verifySignature("RSA-SHA256", Buffer.from(`${parts[0]}.${parts[1]}`), key, Buffer.from(parts[2], "base64url"));
  if (!ok) throw fail("unauthorized", "bad signature");
  const seconds = Math.floor(now / 1000);
  if (!ISSUERS.has(payload.iss)) throw fail("unauthorized", "wrong issuer");
  if (payload.aud !== clientId) throw fail("unauthorized", "token is for another app");
  if (typeof payload.exp !== "number" || payload.exp + SKEW < seconds) throw fail("unauthorized", "token expired");
  if (typeof payload.iat === "number" && payload.iat - SKEW > seconds) throw fail("unauthorized", "token issued in the future");
  if (payload.email_verified !== true || typeof payload.email !== "string") throw fail("unauthorized", "email not verified");
  return { email: payload.email.toLowerCase(), hd: payload.hd };
}

// allow: exact addresses, or *@domain. A domain entry also needs Google's hd claim to match,
// so only accounts managed by that Google Workspace domain get in.
export function isAllowed({ email, hd }, allow) {
  const address = email.toLowerCase();
  return allow.some((entry) => {
    const rule = entry.toLowerCase();
    if (!rule.startsWith("*@")) return rule === address;
    const domain = rule.slice(2);
    return address.endsWith(`@${domain}`) && (hd ?? "").toLowerCase() === domain;
  });
}
