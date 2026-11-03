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
