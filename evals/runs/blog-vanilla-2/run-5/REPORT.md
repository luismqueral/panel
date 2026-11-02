# Run 5 report

The Field Notes panel is built in `evals/runs/blog-vanilla-2/run-5/` and every conformance check passes. The exceptions are three rows marked `needs the person`: they need real Google credentials or a git decision, as `build.md` step 8 says to report them.

## 1. Files written, and the conformance walk

**Written by me:**
- `panel/index.html`: built by a throwaway Node script so all 23 templates and the icon sprite are inlined byte for byte.
- `panel/panel.config.js`, `panel/panel.js`, `panel/seed.json`.
- `start.mjs`, `allow.mjs`, `package.json`, `.gitignore` (holds `uploads/`).
- `panel/CONFORMANCE.md`, written last.
- `panel.intake.yaml`: I added three `open_questions` with `assumed: true`.

**Copied unchanged** (checked with `cmp`):
- `panel/styles/`: `tokens.css` and `components.css`.
- `panel/snippets/`: all 8 snippets.
- `panel/adapters/`: `memory.js`, `http.js`, `auth.js`.
- `server/`: all 6 `.mjs` files.
- `panel.yaml`: copied as instructed. `validate.mjs` reports it valid.

**How I checked it:**
- **Server:** I ran `start.mjs` locally and used curl against the real API. It refuses unsigned requests, writes without the `x-panel` header, and `../` ids. It writes and deletes the JSON files, and it renames and safely serves uploads.
- **Browser:** I drove `?test` mode with Playwright, using the copy already in the repo's `node_modules` (nothing installed). The script covers about 90 behavior checks across all spec sections. Two consecutive runs passed. It also checked 400px width, light and dark, and the logout and login screens.
- **axe:** `axe-core`, also already present, found 0 violations on 10 screens in light and dark.
- **Template fidelity:** I used my own strip-and-compare script, not `tools/lib/fidelity.js`, so it is an approximation of the official check. It found 0 differences.
- **Real login:** without a session, the page shows the login screen with Google's button and no errors.

My test scripts and the test `content/` and `uploads/` folders are deleted.

**Needs the person:**
- The `google-login` hand checklist, which needs a real OAuth client ID and session secret.
- `json-files`: should `content/` go in git? I assumed yes.
- `local-disk`: should uploads go in git? I assumed no.

## 2. Unclear, contradictory, or missing instructions

1. **`SKILL.md` §3, Build row:** `intake.md` is not listed. But `build.md` needs it for the host profile and for the `open_questions` format, so I had to grep it.
2. **`build.md` step 5 vs `snippets/validation.js`:** step 5 says to pass the `conformance` fields as extra required fields to `run("publish")`. But the snippet's input handler forgets them, so emptying the cover again would wrongly clear its error. My workaround: I mark `cover` as `required: true` in the validation's own field list only.
3. **`behavior-spec.md` V3 vs `schema-guide.md` §4:** V3 says only format errors block a save. §4 says required fields block publishing and "drafts always save". Neither says whether an already-published post can be saved with a required field emptied. I followed V3.
4. **`recipes/contracts.md`, error codes:** the save bar should show "Changed elsewhere…" on `conflict`. `save-state.js` has no hook for that, so I call `say()` after a `setTimeout`.
5. **`build.md` step 4 vs `templates/README.md`, "How templates nest":** the status slide-over body should be a `fieldset.pn-choices`. The README says that body holds "field templates, or a `pn-list`". The two contradict each other (unused here, since posts have two statuses).
6. **`build.md` step 2:** the example config has no `data` or `files` blocks. Yet `start.mjs` and the recipes read `PANEL.data.path`, `PANEL.files.path`, and `PANEL.files.url`.
7. **`build.md` step 6:** it says the server serves "image files". `server.mjs` serves only `.png`, `.ico`, `.webp`, and `.svg`, not `.jpg` or `.gif`. It also serves `seed.json` in production.
8. **`build.md` step 6:** `createRecipeAdapters()` is never defined. Each recipe shows only its own piece, not how they combine.
9. **`build.md` step 8 and `behavior-spec.md` §7:** the fidelity, axe, and 400px checks point only to tools in this repo. There's no way to run them when you're "elsewhere".
10. **Not specified:**
 - what a delete that fails with `unauthorized` shows;
 - whether the item title and breadcrumb update while typing or on save;
 - what `x-priority: low` means for the build.

## 3. Guesses I made

- **Title and breadcrumb:** they update after a successful save, not while typing.
- **Delete failing with `unauthorized` or `forbidden`:** shows the "You were signed out…" toast.
- **Create:** sends every field key (blank values, defaults applied), with `reading_time` computed as 1.
- **Login state:** checked once, when the layout isn't shown. After that, any load that fails with an auth error shows login.
- **Layout:** stays mounted across routes, so toasts survive navigation. The save bar appears only once an item or singleton has loaded.
- **Links:** the last breadcrumb links to the current hash. "Try again" on Not found sets `#/`.
- **Search:** case-insensitive substring match on the displayed value.
- **Sorting:** dates compare as strings.
- **Home counts:** the plural is the lowercase label ("3 posts").
- **Three or more statuses:** I built the status picker anyway, though this schema doesn't need it.
- **Git defaults:** `content/` in git, `uploads/` ignored, as each recipe's default says.
- **Seed:** three posts covering both statuses, one of them blank ("Untitled"), plus the settings record.
- **Test tools:** I treated using the repo's existing Playwright and axe-core as "using a browser", not as running `tools/` or a test suite.
