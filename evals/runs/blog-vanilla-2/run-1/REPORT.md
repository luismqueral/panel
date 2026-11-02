# Run 1 report

I built the panel and the conformance walk found no failures. Every check passes except five that need you, mostly because they require a real Google sign-in or your answer to a question. One limit: I couldn't run the repo's fidelity tool, behavior tests or axe, so I wrote my own equivalent fidelity check and walked every rule by hand in headless Chrome.

## 1. Files and conformance result

All files are in `evals/runs/blog-vanilla-2/run-1/`:

- **Copied as-is:** `panel.yaml`, which still validates, and `panel.intake.yaml`. I added three `open_questions` with `assumed: true`: content goes in git (yes), uploads go in git (no), and it isn't deployed yet.
- **Copied byte for byte (checked with `cmp`):** `panel/styles/` (2 files), `panel/snippets/` (8), `panel/adapters/` (`memory.js`, `http.js`, `auth.js`) and `server/` (all 6 `.mjs` files).
- **Generated:** `panel/index.html`, with the icon sprite and 23 templates inlined by a script straight from the template files, so nothing was retyped.
- **Written by me:** `panel/panel.config.js`, `panel/panel.js`, `panel/seed.json`, `allow.mjs`, `start.mjs`, `package.json`, `.gitignore` (ignores `uploads/`) and, last, `panel/CONFORMANCE.md`.

What the walk covered:
- **Schema checks:** all 8 default checks pass, plus the four behavior lines and the cover-image rule.
- **Templates:** every template on every screen and state matches its source once slots are stripped.
- **Behavior rules:** S1–S9, A1–A4, V1–V7, D1–D6, K1–K7, C1–C6, P1–P5 and F1–F4 all hold.
- **Layout:** no sideways scroll at 400px, in light and dark.
- **Real adapters:** I minted a session cookie with the copied `session.mjs` and ran the browser against `start.mjs`. Create, upload, save, publish, reload, delete and logout all worked. The server refuses addresses not on the allow list, writes without the `x-panel` header, and HTML uploads. I deleted the test content afterwards.

Needs you:
- Confirm the two defaults I assumed about git.
- Run `git diff` after an edit, and stop the server mid-save to check the file on disk survives.
- Tick the Google sign-in checklist with a real client ID.
- Decide on deployment.

P2 for three or more statuses is written but untested, because this schema has only two.

Other builds were running on the same machine, and my first browser checks hit another run's server. I discarded those results, re-ran everything against my own server, and didn't read that run's files.

## 2. Unclear, contradictory or missing instructions

1. **`build.md` step 2:** the example config has no `data` or `files` blocks, but `start.mjs` (step 6, and the json-files and local-disk recipes) reads `PANEL.data.path` and `PANEL.files.path`. It's missing.
2. **`SKILL.md` §3, load table:** Build needs component markup (`pn-choices`, `pn-radio`) from `design-system/index.html`, and Conformance needs the `open_questions` format from `intake.md`. Neither file is in the list.
3. **`build.md` step 5 vs `behavior-spec.md` P3/P4:** the order of the publish check and the publish confirmation isn't stated.
4. **`recipes/contracts.md` error table vs `snippets/save-state.js`:** `conflict` should show "Changed elsewhere…" in the save bar, but the snippet has no way to set a message on failure. I had to call `say()` from a `setTimeout`.
5. **`snippets/validation.js`:** after a failed publish, re-checking a field as the person types drops the extra required fields (`publishRequires`). If cover is filled and then removed, its error doesn't come back until the next publish attempt.
6. **`build.md` step 4 and step 7:** there's no load-error text for a singleton (only home, collection and item have one). There's also nothing for a type without `list.search`, or for `list.sort` naming the title field (the sort options would repeat).
7. **`build.md` step 8 and `templates/README.md`:** "elsewhere, walk by hand" doesn't say how to check fidelity or axe (K5) without the tools. So I wrote my own check.
8. **`build.md` step 6 vs `recipes/server/server.mjs`:** the step says "image files" are served, but the server only allows `.png`, `.ico` and `.webp`.
9. **`behavior-spec.md`, unspecified:** whether Delete on a dirty item asks the discard question, what D1 focuses in the status slide-over (its radios aren't fields), and whether the status button shows while loading.

## 3. Guesses I made

- **Dates:** date fields are formatted in UTC so a stored day never shifts; created and updated times use local time.
- **Reading time:** stored as a number of minutes and shown as "N min". A word is any piece of text containing a letter or digit.
- **New items:** created with every field present, using its default or an empty value (`""`, `[]` or `null`).
- **Status changes:** the publish check runs before the confirmation. Leaving any non-first status runs the publish check; only leaving the first status asks for confirmation.
- **Status button:** hidden until the item loads.
- **Singleton load error:** "Could not load site settings".
- **Delete:** a dirty item is deleted without the discard question, since the delete confirmation is enough. Logout asks the discard question first.
- **Search fallback:** with no `list.search`, search uses the title field. Duplicate sort options are dropped.
- **Server:** `start.mjs` has no host guard for auth `none`, because that only applies when there's no login.
- **Seed:** three posts covering both statuses plus an untitled draft, and a settings record.
- **Skipped key:** `x-priority: low` is treated as metadata and ignored.
