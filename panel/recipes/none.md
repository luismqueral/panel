# Recipe: none

Status: verified (`evals/recipes/`).

## 1. When to use it

The panel runs on one computer, for one person, and is never reachable from a network. It is also what a schema gets when it has no `auth` block. It fills the **auth** contract with no gatekeeping: the login screen has one button, "View panel", and anyone who presses it can edit. The editor is always `local`.

Don't use it for anything deployed, shared, or reachable on a local network. The next step up is `password`, then `google-login` or `email-link`.

## 2. Prerequisites

None. The schema says `auth:` then `recipe: none`, or leaves `auth` out.

## 3. Contract

Auth, as in `contracts.md`. `session()` returns `null` until "View panel" is pressed in this browser tab, then `{ user: "local" }` from `GET /api/session`. `renderMethods()` renders one primary `pn-button`, "View panel", into `methods`. Pressing it calls `onSignedIn()`. `logout()` returns the tab to the login screen. The button is remembered in `sessionStorage`, so a reload stays open and a new tab asks again.

The button is not a lock. The server accepts every request from this computer without a session.

## 4. Steps

1. Use `createNoAuth(request)` from `recipes/client/auth.js`. In `panel.config.js`, write `auth: { recipe: "none" }`, even when the schema leaves `auth` out.
2. In `start.mjs`, `auth: { recipe: "none" }`. The server accepts every request from this computer and still requires `x-panel: 1` on writes.
3. Keep the server on `127.0.0.1`. `start.mjs` refuses any other address when auth is `none`. Do not remove that check.
4. Show `account` in the nav as for any recipe. It reads `local`, and "Log out" returns to the "View panel" screen.
5. **If** the person later deploys the panel, stop and switch to a login recipe first. `password` is the smallest change.

## 5. Verify

Automated (`npm run test:recipes`): the panel opens on the "View panel" button, then shows `local` and saves; a reload stays open; logging out shows the button again; a config with no `auth` line behaves the same.

By hand:

- [ ] The panel opens on the "View panel" button, and pressing it opens Home.
- [ ] Starting with `HOST=0.0.0.0` fails with a message.

## 6. Pitfalls

- Treating "View panel" as protection. It only stops someone opening the panel by accident.
- Binding to every address "just to test from a phone". Anyone on the network can then edit.
- Dropping the `x-panel` check because "there is no login". Another site open in the same browser could still post to `127.0.0.1`.
