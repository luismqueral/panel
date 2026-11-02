# Run 3 report

The blog panel is built in `evals/runs/blog-vanilla-2/run-3/`, and `panel/CONFORMANCE.md` is written. Every check passes or is marked "needs the person"; none failed. The walk found one bug in my `panel.js`, which I fixed and retested.

One thing you should know first: Chrome's port 9333 was already taken by another Chrome on this machine. My first two walk scripts connected to it and navigated one of its tabs (the one titled "Hello Café World · Field Notes") to my panel's URLs. If another run was using that browser, it may have been disturbed. After I noticed, I used my own Chrome on port 9471 in a fresh tab.

## 1. Files and conformance

**Written by me:**
- `panel/index.html` (generated with Node, so the icon sprite and all 23 templates are inlined byte for byte)
- `panel/panel.config.js`, `panel/panel.js`, `panel/seed.json`, `panel/CONFORMANCE.md`
- `start.mjs`, `allow.mjs`, `package.json`, `.gitignore` (ignores `uploads/`)
- `panel.intake.yaml` now has four `open_questions` with `assumed: true`

**Copied, checked byte-identical with `cmp`:** `panel.yaml`, `styles/` (2 files), `snippets/` (8), `adapters/` (`memory.js`, `http.js`, `auth.js`), and `server/` (all 6 `.mjs` files).

**Conformance walk:**
- **Schema:** the validator reports the schema valid.
- **Default checks 1–8, the cover-image rule, and all four behavior lines:** pass.
- **Template fidelity:** pass, but by a checker I wrote from the rules in `templates/README.md`, since the official one is in `tools/`.
- **Behavior spec:** I scripted 75 checks against the `?test` page, and all pass after the fix. The bug: pressing Cmd+S while typing in a field cleared the "Fix N fields to save" message. Moving focus to the invalid field fires a `change` event, which resets the save bar. `panel.js` now moves focus before setting the message.
- **400px wide and light/dark:** pass.
- **Real server:** create, schema refusals, upload safety, delete, the allow list, and the `x-panel` header all behave as specified. In the real UI, create, upload, reload, and logout work.
- **Needs the person:**
 - the Google sign-in checklist with real credentials
 - axe
 - `git diff` after a save, and stopping the server mid-save
 - the two git "ask" defaults

I removed my scratch files and test content afterwards.

## 2. Unclear, contradictory, or missing instructions

1. **`build.md` steps 6 and 8:** the template fidelity check has no hand procedure. Only behavior rules say "walk by hand", and the fidelity tool lives in `tools/`.
2. **`build.md` step 2 against step 6:** `start.mjs` reads `PANEL.data.path` and `PANEL.files.path`, but the example config has no `data` or `files` keys.
3. **`build.md` step 5 against `behavior-spec.md` S7:** the snippet table says to wire Cmd+S only on item and singleton screens. S7 says it must never open the browser's save dialog "on a panel screen".
4. **`build.md` step 5 against `behavior-spec.md` "Words used below":** step 5 says to run the publish check "before a status moves past the first". The spec defines publishing as leaving the first status. With three or more statuses, these differ.
5. **`save-state.js` and `validation.js`:** calling `say()` and then `focus()` loses the message (the bug above). No file warns about it, and snippets can't be edited.
6. **`build.md` step 4, missing copy and states:**
 - what a singleton load error says
 - whether the save bar and status button show while an item loads
 - the variant of the "Try again" button
 - what fills the account's `user` slot
 - how dates are formatted, including time zones
 - the last breadcrumb's `href`
 - focus after a route change
7. **`build.md` step 1:** it lists `screen-slide-over` without saying whether to inline templates the schema never uses.
8. **`recipes/google-login.md` section 2:** the example origin is `localhost:4810`, but the server binds `127.0.0.1`. Google treats those as different origins.
9. **`recipes/local-disk.md` step 4:** "the public site is served by something else" is unclear for a project with no site.
10. **`recipes/server/server.mjs`:** static files can't be `.jpg` or `.gif`. Also, the server doesn't enforce the publish rules, so they hold only in the browser.

## 3. Guesses

- **Shell:**
 - I added `confirmPublish`, `wordCount`, `data`, and `files` keys to the config.
 - I inlined every template.
 - I installed the keyboard shortcuts on all screens.
 - The account shows the signed-in email.
- **Status:**
 - The publish check runs for any move to a non-first status.
 - The confirmation appears only when leaving draft.
 - The status button is hidden while loading.
- **Copy and display:**
 - A singleton load error reads "Could not load site settings".
 - Item created and updated dates are shown as "Oct 28, 2026". Date-only values are formatted in UTC; timestamps use local time.
 - "Try again" has no variant.
- **Data:**
 - New items get blank values for every field, with `reading_time` set to null.
 - `reading_time` saves as a number of minutes.
- **Validation and save state:**
 - Errors clear after a successful save or a revert.
 - The save bar is added only once the item has loaded.
- **Seed data:** published posts use inline SVG data URLs as covers, so test mode needs no image files.
- **Intake defaults:**
 - `content/` is tracked in git.
 - `uploads/` is ignored.
 - The project server publishes the uploads.
