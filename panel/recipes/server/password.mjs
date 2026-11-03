// password: one shared password, compared in constant time, with a limit on wrong tries. No dependencies.

import { createHash, timingSafeEqual } from "node:crypto";
import { fail } from "./errors.mjs";

export const USER = "editor";
export const MIN_LENGTH = 12;
const MAX_TRIES = 10;
const WINDOW = 15 * 60 * 1000;

const digest = (value) => createHash("sha256").update(value).digest();

// Returns check(given, address): nothing on a match; throws unauthorized on a wrong password,
// and rate-limited after MAX_TRIES wrong tries from one address within WINDOW.
export function createPasswordCheck(password, { name = "PANEL_PASSWORD", now = Date.now } = {}) {
  if (!password || password.length < MIN_LENGTH) throw new Error(`Set ${name} to a password of at least ${MIN_LENGTH} characters`);
  const expected = digest(password);
  const tries = new Map();

  return function check(given, address = "") {
    const t = now();
    if (tries.size > 10000) for (const [key, entry] of tries) if (t - entry.since > WINDOW) tries.delete(key);
    let entry = tries.get(address);
    if (entry && t - entry.since > WINDOW) entry = undefined;
    if (entry && entry.count >= MAX_TRIES) throw fail("rate-limited", "too many wrong passwords; wait, then try again");
    if (typeof given === "string" && timingSafeEqual(digest(given), expected)) {
      tries.delete(address);
      return;
    }
    tries.set(address, { count: (entry?.count ?? 0) + 1, since: entry?.since ?? t });
    throw fail("unauthorized", "wrong password");
  };
}
