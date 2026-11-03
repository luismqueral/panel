# Recipe: password

Status: verified (`evals/recipes/`).

## 1. When to use it

A small panel that one person, or a few people who trust each other, edit, and a list of email addresses would be too much. Everyone types the same password. It fills the **auth** contract. It is the step up from `none`: the first real gate.

Don't use it when editors need their own accounts, or when you must be able to remove one person's access without changing everyone's password. Use `google-login` or `email-link`.

## 2. Prerequisites

- Environment variables on the server, never in the repo:
  - The password, in `PANEL_PASSWORD`, or the variable the schema's `password_env` names. At least 12 characters. Three or four random words work well: `blue-rail-line-38`.
  - `SESSION_SECRET`: at least 32 random characters. Generate one with `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`.
- The project server (`contracts.md`, "The project server").

## 3. Contract

Auth, as in `contracts.md`. `session()` returns `{ user: "editor" }` from `GET /api/session`. Everyone who knows the password is `editor`. `renderMethods()` renders a password field labeled "Password" and a primary "Sign in" button into `screen-login`'s `methods` container. `logout()` calls `DELETE /api/session`.

Messages, exactly:

| When | `error` slot |
| --- | --- |
| The field is empty | "Enter the password." |
| The password is wrong | "That password isn't right. Try again." The field clears |
| 10 wrong tries from one address in 15 minutes | "Too many tries. Wait a few minutes, then try again." |
| Anything else | "Could not sign in. Try again." |

In a playground, the `methods` container holds the same markup `createPasswordAuth` builds: a `form.pn-login-form` with a `pn-field` (`label.pn-label` "Password", `input.pn-input` of type `password`, id `pn-password`) and a primary `pn-button` "Sign in" of type `submit`.

## 4. Steps

1. Copy `recipes/server/` into the project (`server/`), and `recipes/client/http.js` and `recipes/client/auth.js` into the panel's `adapters/`. Do not rewrite them; they are owned code now, and the person may change them later.
2. Write the project's `start.mjs` (or the host's equivalent) that builds the auth block, exactly:

   ```js
   const name = PANEL.auth.password_env ?? "PANEL_PASSWORD";
   const auth = {
     recipe: "password",
     check: createPasswordCheck(process.env[name], { name }),
     sessions: createSessions(process.env.SESSION_SECRET),
   };
   ```

   There is no `allow.mjs`: the password is the only gate.
3. In `panel.js`, use `createPasswordAuth(request)` when not in `?test` mode.
4. **If** the person wants to sign everyone out, change `SESSION_SECRET` and restart. Changing the password alone keeps existing sessions until they expire (7 days).
5. **If** the person wants separate passwords per editor, or roles: stop. Use `google-login` or `email-link`, or record it as an open question.
6. **If** the panel is reachable from a network, serve it over HTTPS, so the password and cookie are not sent in the clear. Behind a proxy that ends TLS, make sure it sends `X-Forwarded-Proto: https`, so cookies get `Secure`.
7. Run the server on `127.0.0.1` while developing. Deploying is the person's decision; say what changes (HOST, HTTPS).

## 5. Verify

Automated, in this repository (`npm run test:recipes`): the server refuses to start with a missing or short password; the right password passes and every other value is refused; 10 wrong tries lock one address for 15 minutes, even for the right password; the empty, wrong, and too-many-tries messages; the `HttpOnly`, `SameSite=Lax` cookie; the `x-panel` header; a session cookie for any user but `editor` is refused; and logout.

By hand, once per project. Tick each:

- [ ] The password and `SESSION_SECRET` are set in the environment, not in any file in the repo.
- [ ] Opening the panel shows the login screen with the password field focused.
- [ ] A wrong password shows "That password isn't right. Try again." and does not open the panel.
- [ ] The right password opens Home, and the nav shows `editor`.
- [ ] In the browser's dev tools, the `pn_session` cookie is `HttpOnly`, `SameSite=Lax`, and, on HTTPS, `Secure`. Nothing is in `localStorage`.
- [ ] Log out: the login screen returns, and `GET /api/session` answers 401.

The panel is not done until every box is ticked.

## 6. Pitfalls

- Putting the password in `panel.yaml`, `panel.config.js`, or any file in the repo. The schema only names the variable (`password_env`), and the validator rejects anything that is not a variable name.
- Comparing the password with `===`. `createPasswordCheck` compares SHA-256 digests in constant time.
- Removing the limit on wrong tries "because it is only a small site". Without it, a short password falls to guessing.
- Checking the password in the browser. The server checks it; the browser only passes it on.
- Sending the password over plain HTTP on a network.
- Forgetting `x-panel: 1` on writes, or accepting writes without it.
- Behind a proxy, every request comes from the proxy's address, so the limit on wrong tries applies to everyone at once. That is safe; it can mean waiting 15 minutes after someone else's typos.
