// google-login: token verification, allow list, and sessions, with a local signing key standing in
// for Google's (D-015). The real Google flow is checked by hand: recipes/google-login.md, Verify.

import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { verifyGoogleToken, isAllowed, createKeyStore } from "../../panel/recipes/server/google.mjs";
import { createSessions } from "../../panel/recipes/server/session.mjs";

const CLIENT = "123.apps.googleusercontent.com";
const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const other = generateKeyPairSync("rsa", { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: "jwk" }), kid: "k1", alg: "RS256", use: "sig" };
let fetches = 0;
const keyFor = createKeyStore(async () => (fetches++, { keys: [jwk], until: Date.now() + 60_000 }));

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
function token(claims = {}, { key = privateKey, header = {} } = {}) {
  const now = Math.floor(Date.now() / 1000);
  const head = b64({ alg: "RS256", kid: "k1", typ: "JWT", ...header });
  const body = b64({ iss: "https://accounts.google.com", aud: CLIENT, exp: now + 3600, iat: now, email: "Me@Example.com", email_verified: true, ...claims });
  return `${head}.${body}.${sign("RSA-SHA256", Buffer.from(`${head}.${body}`), key).toString("base64url")}`;
}
const verify = (t) => verifyGoogleToken(t, { clientId: CLIENT, keyFor });
const rejects = (t, pattern) => assert.rejects(verify(t), (e) => e.code === "unauthorized" && pattern.test(e.message));

test("a valid token returns the lowercased address", async () => {
  assert.deepEqual(await verify(token()), { email: "me@example.com", hd: undefined });
});
test("keys are cached between verifications", async () => {
  const before = fetches;
  await verify(token());
  await verify(token());
  assert.equal(fetches, before);
});
test("a token signed by another key is rejected", () => rejects(token({}, { key: other.privateKey }), /signature/));
test("a tampered payload is rejected", () => {
  const [h, , s] = token().split(".");
  return rejects(`${h}.${b64({ iss: "https://accounts.google.com", aud: CLIENT, exp: 9e9, email: "boss@example.com", email_verified: true })}.${s}`, /signature/);
});
test("alg none and HS256 are rejected", async () => {
  await rejects(token({}, { header: { alg: "none" } }), /algorithm/);
  await rejects(token({}, { header: { alg: "HS256" } }), /algorithm/);
});
test("an unknown key id is rejected", () => rejects(token({}, { header: { kid: "nope" } }), /key/));
test("a token for another app is rejected", () => rejects(token({ aud: "someone-else" }), /another app/));
test("a token from another issuer is rejected", () => rejects(token({ iss: "https://evil.example" }), /issuer/));
test("an expired token is rejected", () => rejects(token({ exp: Math.floor(Date.now() / 1000) - 120 }), /expired/));
test("an unverified email is rejected", () => rejects(token({ email_verified: false }), /verified/));
test("garbage is rejected", async () => {
  await rejects("not-a-token", /malformed/);
  await rejects(undefined, /malformed/);
  await rejects("a.b.c", /malformed/);
});

test("allow: exact addresses, any case", () => {
  assert.equal(isAllowed({ email: "me@example.com" }, ["Me@Example.com"]), true);
  assert.equal(isAllowed({ email: "you@example.com" }, ["me@example.com"]), false);
  assert.equal(isAllowed({ email: "me@example.com.evil.io" }, ["me@example.com"]), false);
});
test("allow: *@domain needs a matching Workspace hd claim", () => {
  assert.equal(isAllowed({ email: "a@studio.com", hd: "studio.com" }, ["*@studio.com"]), true);
  assert.equal(isAllowed({ email: "a@studio.com" }, ["*@studio.com"]), false);
  assert.equal(isAllowed({ email: "a@sub.studio.com", hd: "sub.studio.com" }, ["*@studio.com"]), false);
  assert.equal(isAllowed({ email: "a@evilstudio.com", hd: "evilstudio.com" }, ["*@studio.com"]), false);
});

test("sessions: round trip, tamper, expiry, short secrets", () => {
  const sessions = createSessions("x".repeat(40));
  const cookie = sessions.issue("me@example.com", { secure: true }).split(";")[0];
  assert.match(sessions.issue("me@example.com", { secure: true }), /HttpOnly; SameSite=Lax; Max-Age=\d+; Secure/);
  assert.equal(sessions.read(cookie).user, "me@example.com");
  const [name, value] = cookie.split("=");
  const [body, mac] = value.split(".");
  const forged = Buffer.from(JSON.stringify({ u: "boss@example.com", exp: 9e9 })).toString("base64url");
  assert.equal(sessions.read(`${name}=${forged}.${mac}`), null);
  assert.equal(sessions.read(`${name}=${body}.${mac.slice(0, -2)}xx`), null);
  assert.equal(createSessions("y".repeat(40)).read(cookie), null);
  const old = Buffer.from(JSON.stringify({ u: "me@example.com", exp: 1 })).toString("base64url");
  assert.equal(sessions.read(`${name}=${old}.x`), null);
  assert.throws(() => createSessions("short"), /SESSION_SECRET/);
});
