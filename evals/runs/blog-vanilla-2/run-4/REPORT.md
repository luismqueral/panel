# Run 4 report

I built the Field Notes blog panel in `evals/runs/blog-vanilla-2/run-4/`. Every conformance check I could run passes. Five checks need the person, and none failed.

## 1. Files and conformance result

**Copied as instructed:**
- `panel.intake.yaml`. I then added three `open_questions` entries with `assumed: true`, as `build.md` step 8 asks.
- `panel.yaml`. The validator reports it valid.

**Copied unchanged from the skill:**
- `panel/styles/`: `tokens.css` and `components.css`.
- `panel/snippets/`: the 8 snippets.
- `panel/adapters/`: `memory.js`, `http.js`, `auth.js`.
- `server/`: all 6 `.mjs` files.

**Written:**
- `panel/index.html`. A Node script inlined the icon sprite and the 23 templates byte for byte, so nothing was retyped.
- `panel/panel.config.js`, `panel/panel.js`, `panel/seed.json`.
- `allow.mjs`, `start.mjs`, `package.json`, `.gitignore` (which ignores `uploads/`).
- `panel/CONFORMANCE.md`, written last.

**How I checked it:**
- **Browser, test mode:** in headless Chromium I walked every rule in `behavior-spec.md`, plus the 400px width and light and dark.
- **Template fidelity:** I compared each page against `templates/` with a checker I wrote myself, because `tools/` was off-limits. Every screen and state matched.
- **Real server:** I ran `start.mjs` with a throwaway secret and a session cookie I signed locally. These worked: create, reload, edit, delete, upload with an unsafe file name, stopping the server before a save, the `x-panel` header, the allow list, and private files. I deleted the test content and uploads afterwards.

The walk found one bug, which I fixed: Cmd+S on a draft ran the publish checks instead of a normal save.

**Needs the person:**
- **Google sign-in checklist:** needs real `GOOGLE_CLIENT_ID` and `SESSION_SECRET` values and a Google account.
- **`git diff` check:** git was off-limits for this run.
- **Content folder in git:** I took the recipe default (yes).
- **Uploads in git:** I took the recipe default (no).
- **K5 (Tab reachability and focus rings):** this needs axe, which isn't installed.

## 2. Unclear, contradictory, or missing instructions

1. **`SKILL.md` §3 and `build.md` step 8.** Build tells me to record defaults in the intake record under `open_questions`, but `intake.md` isn't in Build's read list. So the shape of an entry isn't given.
2. **`SKILL.md` §3, Conformance row.** It loads only `schema-guide.md` §8 and `build.md` step 8, but step 8 needs all of `behavior-spec.md` and the fidelity rules in `templates/README.md`.
3. **`build.md` step 8 and `templates/README.md` "Files".** Template fidelity and K5 can only be checked with repo tools (`tools/lib/fidelity.js`, axe, `npm run test:behavior`). The skill gives no way to check them "elsewhere".
4. **`build.md` step 4 "Load errors" and step 7.** There is no copy for a singleton that fails to load. Only home, collection, and item are covered.
5. **`build.md` step 5 table vs `behavior-spec.md` §1 S7.** The table wires `save` only on item and singleton screens. But S7 says Cmd+S must never open the browser's save dialog on any panel screen.
6. **`behavior-spec.md` V3 and V4.** Nothing says whether saving an item already past its first status (a published post) checks required fields. As written, a published post can be saved with an empty title.
7. **`build.md` step 5 vs `behavior-spec.md` "Publish".** "Moves past the first" and "moving out of first status" differ once a type has more than two statuses.
8. **`recipes/contracts.md` error codes vs `save-state.js`.** The `conflict` message "Changed elsewhere…" must show in the save bar, but the snippet has no hook for a custom message after a save fails.
9. **`contracts.md` `forbidden` row.** When a load throws `forbidden`, the panel must show "This account isn't allowed…". But `auth.js` sets that message only from `session()`, and `build.md` doesn't say the panel must add it itself.
10. **`contracts.md` `create`.** It doesn't say whether to send a key for every field, or only the fields the create flow asked for plus defaults.
11. **`build.md` step 6.** The `panelTest.reset` code uses `current` before the routing code that declares it, and the ordering isn't mentioned.
12. **`build.md` step 1.** "Use exactly this page" hard-codes `<title>Field Notes</title>`. That only fits this schema by coincidence.
13. **`recipes/local-disk.md` step 6.** It says to add uploads to `.gitignore`, but a new project with `stack: none` may have no repository and no `.gitignore`.

## 3. Guesses I made

**Copy and messages**
- The singleton load error reads "Could not load site settings".
- When a load throws `forbidden`, the panel shows the "isn't allowed" message itself.
- The delete toast has no tone, and deleting goes to the collection.
- A delete that throws `unauthorized` shows the signed-out toast.

**Validation and saving**
- Saving a published post checks format only.
- "Publishing" means leaving the first status, and confirmation is asked only then.
- The conflict message is shown with `say()` from a microtask.

**Wiring**
- Keyboard shortcuts are installed once for every screen, not per screen.
- `panel.config.js` includes `auth.recipe` and `data.via`.
- `autosave.drafts: true` means "only in the first status".
- The item title and breadcrumb update live as you type.
- The create flow sends title, slug, and defaults only.
- "Try again" cleans up the current screen before rerunning the route.
- The session is checked at startup and after sign-in, not on every route.
- The status button is `hidden` for types without a status.
- I implemented the status slide-over even though this schema has only two statuses.

**Data and files**
- The intake entries are shaped as `question`, `answer`, `assumed: true`.
- The seed has three posts, with a `data:` URL as the published post's cover.
- `.gitignore` sits at the project root.

**Report**
- K5 is reported as "needs the person" rather than "pass".
- The "stop the server mid-save" check passed with the server stopped just before the save, not during the write.
