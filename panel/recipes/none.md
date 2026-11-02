# Recipe: none

Status: verified (`evals/recipes/`).

## 1. When to use it

The panel runs on one computer, for one person, and is never reachable from a network. It fills the **auth** contract by saying the editor is always `local`.

Don't use it for anything deployed, shared, or reachable on a local network. Use `google-login` or `email-link`.

## 2. Prerequisites

None. The schema says `auth:` then `recipe: none`.

## 3. Contract

Auth, as in `contracts.md`. `session()` returns `{ user: "local" }`. `renderMethods()` does nothing; the login screen never shows. `logout()` does nothing.

## 4. Steps

1. Use `createNoAuth(request)` from `recipes/client/auth.js`.
2. In `start.mjs`, `auth: { recipe: "none" }`. The server accepts every request from this computer and still requires `x-panel: 1` on writes.
3. Keep the server on `127.0.0.1`. `start.mjs` refuses any other address when auth is `none`. Do not remove that check.
4. Leave out `account` from the nav, as `templates/README.md` says for `none`.
5. **If** the person later deploys the panel, stop and switch to a login recipe first.

## 5. Verify

Automated (`npm run test:recipes`): the panel opens without a login screen, shows `local`, and saves.

By hand:

- [ ] The panel opens with no login.
- [ ] Starting with `HOST=0.0.0.0` fails with a message.

## 6. Pitfalls

- Binding to every address "just to test from a phone". Anyone on the network can then edit.
- Dropping the `x-panel` check because "there is no login". Another site open in the same browser could still post to `127.0.0.1`.
