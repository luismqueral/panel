// password: the shared-password check and its limit on wrong tries (recipes/password.md, Verify).

import { test } from "node:test";
import assert from "node:assert/strict";
import { createPasswordCheck, MIN_LENGTH } from "../../panel/recipes/server/password.mjs";

const PASSWORD = "blue-rail-line-38";
const code = (fn) => {
  try {
    fn();
    return null;
  } catch (error) {
    return error.code;
  }
};

test("refuses to start without a long enough password, naming the variable", () => {
  assert.throws(() => createPasswordCheck(undefined), /Set PANEL_PASSWORD to a password of at least 12 characters/);
  assert.throws(() => createPasswordCheck("x".repeat(MIN_LENGTH - 1), { name: "NOTES_PASSWORD" }), /Set NOTES_PASSWORD/);
  assert.doesNotThrow(() => createPasswordCheck("x".repeat(MIN_LENGTH)));
});

test("the right password passes; anything else is unauthorized", () => {
  const check = createPasswordCheck(PASSWORD);
  assert.equal(code(() => check(PASSWORD, "a")), null);
  for (const wrong of ["", "blue-rail-line-3", `${PASSWORD} `, PASSWORD.toUpperCase(), undefined, null, 42, ["x"]]) {
    assert.equal(code(() => check(wrong, "a")), "unauthorized", `accepted ${JSON.stringify(wrong)}`);
  }
});

test("10 wrong tries from one address lock it out, even for the right password, until the window passes", () => {
  let now = 0;
  const check = createPasswordCheck(PASSWORD, { now: () => now });
  for (let i = 0; i < 10; i++) assert.equal(code(() => check("nope", "a")), "unauthorized");
  assert.equal(code(() => check(PASSWORD, "a")), "rate-limited");
  assert.equal(code(() => check(PASSWORD, "b")), null, "another address is not locked out");
  now += 15 * 60 * 1000 + 1;
  assert.equal(code(() => check(PASSWORD, "a")), null);
});

test("a right password resets the count", () => {
  const check = createPasswordCheck(PASSWORD);
  for (let i = 0; i < 9; i++) code(() => check("nope", "a"));
  assert.equal(code(() => check(PASSWORD, "a")), null);
  for (let i = 0; i < 9; i++) assert.equal(code(() => check("nope", "a")), "unauthorized");
  assert.equal(code(() => check(PASSWORD, "a")), null);
});

// The limit on wrong tries, through the server, with and without a trusted proxy.
async function serve(trustProxy) {
  const { createPanelServer } = await import("../../panel/recipes/server/server.mjs");
  const { createSessions } = await import("../../panel/recipes/server/session.mjs");
  const auth = { recipe: "password", check: createPasswordCheck(PASSWORD), sessions: createSessions("s".repeat(32)) };
  const server = createPanelServer({ root: ".", config: { types: [], singletons: [] }, data: {}, auth, trustProxy });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const signIn = async (password, forwarded) => (await fetch(`http://127.0.0.1:${server.address().port}/api/session`, {
    method: "POST",
    headers: { "x-panel": "1", "content-type": "application/json", ...(forwarded ? { "x-forwarded-for": forwarded } : {}) },
    body: JSON.stringify({ password }),
  })).status;
  return { server, signIn };
}

test("with trustProxy, one visitor's wrong tries don't lock out another", async () => {
  const { server, signIn } = await serve(true);
  for (let i = 0; i < 10; i++) assert.equal(await signIn("wrong-password-here", "203.0.113.1"), 401);
  assert.equal(await signIn(PASSWORD, "203.0.113.1"), 429);
  assert.equal(await signIn(PASSWORD, "203.0.113.2"), 200);
  server.close();
});

test("with trustProxy, only the address the proxy added counts", async () => {
  const { server, signIn } = await serve(true);
  for (let i = 0; i < 10; i++) assert.equal(await signIn("wrong-password-here", `198.51.100.${i}, 203.0.113.1`), 401);
  assert.equal(await signIn(PASSWORD, "198.51.100.99, 203.0.113.1"), 429);
  server.close();
});

test("without trustProxy, a faked header can't get around the limit", async () => {
  const { server, signIn } = await serve(false);
  for (let i = 0; i < 10; i++) assert.equal(await signIn("wrong-password-here", `198.51.100.${i}`), 401);
  assert.equal(await signIn(PASSWORD, "198.51.100.99"), 429);
  server.close();
});
