# Run 4 report

The blog panel is built in `evals/runs/blog-vanilla-3/run-4/`, and the conformance walk found no failures. Every schema check, project check and behavior rule passes. Five checks are marked "needs the person": axe, the Google sign-in checklist with real credentials, the two git defaults I took, and deployment.

## 1. Files written and conformance result

**Project root**
- `panel.intake.yaml` and `panel.yaml`: copied. I added four `open_questions` to the intake record, each with `assumed: true`.
- `start.mjs`, `allow.mjs`, `package.json`, `.gitignore` (ignores `uploads/`).
- `server/*.mjs`: copied verbatim from the recipe.

**`panel/`**
- `index.html`: the icon sprite and 23 templates, joined from the source files by script rather than retyped.
- `panel.config.js`, `panel.js`, `seed.json`, `CONFORMANCE.md`.
- `styles/`, `snippets/` (8 files), `adapters/` (memory, http, auth): copied verbatim. A byte-for-byte compare confirms they are unchanged.

**How I tested it.** I drove headless Chrome in `?test` mode and also started the real server with placeholder credentials.
- **Passing:** all 8 default checks, the project rule (publishing needs a cover), and every rule in the behavior spec. Fidelity matches on every screen; the checker fails when I plant a defect. There is no sideways scroll at 400px, and light and dark both work. The server-side adapters refuse bad input and handle unsafe file names.
- **One fix during the walk:** home and collection screens kept the template's single blank row while loading or empty. They now mount no rows until data arrives.
- **One note:** in the Tab walk, Chrome's built-in calendar button inside the date input shows no focus ring. That control is drawn by the browser, and the design system can't be edited.
- **Needs the person:**
  - axe could not run.
  - The Google sign-in checklist needs real credentials.
  - I took the recipe defaults "commit content to git: yes" and "commit uploads to git: no"; please confirm both.
  - Deployment (host, Google origins, HTTPS).

The scratch Chrome profile and test data I used are deleted.

## 2. Unclear, contradictory, or missing instructions

1. **Folder name clash:** the skill lives in `panel/`, and `build.md` "What you produce" also names the built panel folder `panel/`. "Write `panel/CONFORMANCE.md`" can be read either way.
2. **`build.md` step 1:** it lists every template name, including `screen-slide-over`. It doesn't say whether to include templates the schema never uses (the blog has only two statuses, so no slide-over).
3. **`build.md` step 4, "Screen details":** nothing says what the item's status button shows while loading or after a load error.
4. **`templates/README.md`, "How templates nest":** it says to mount the save bar "on item and singleton screens", but not whether that includes the loading and error states.
5. **`build.md` step 4, "What is mounted":** it covers the layout, confirm dialog, toasts and slide-over, but not how long the create dialog stays mounted.
6. **"What is mounted" again:** it doesn't warn that every repeat container starts with one blank unit, which must be emptied while loading. That gap caused the one failure I fixed.
7. **`templates/README.md`, "Every screen has four states":** this contradicts `screens/singleton.html`, which has no `empty` region.
8. **`recipes/contracts.md` and `build.md` step 5 disagree on `forbidden`:** contracts.md says a `forbidden` load shows the login screen with "This account isn't allowed…". `build.md` step 5 just says "shows `screen-login`". And `auth.js` only shows that message when `session()` itself was refused.
9. **`build.md` step 2:** the example writes `path: "content"`, while the schema says `./content`. It's unclear whether to normalize.
10. **`recipes/google-login.md` step 4:** it says `createGoogleAuth(request)` but never says that `request` comes from `createRequest()` in `http.js`.
11. **`behavior-spec.md` section 7 vs `recipes/client/memory.js`:** the spec says `fail()` affects "the next call", but `reset()` silently clears pending failures. This is undocumented, and it tripped my first error-state test.
12. **`snippets/templates.js` `fill()`:** text keys search every descendant, so filling a screen's `title` after inserting `empty` or `error` content can hit their `title` slot instead. The order matters and isn't documented.
13. **`build.md` step 5 word count:** writing "N words" into the body's help slot doesn't say what happens when the field already has `help` text.
14. **Sorting:** what happens when `list.sort` names the title field (duplicate sort options) isn't specified, and neither is how to break ties.
15. **`x-priority: low`** on `reading_time` has no defined meaning. I ignored it.

## 3. Guesses I made

- Kept `./content` as the data path, and `/uploads` (the recipe default) as the files URL.
- Behavior lines became config keys: `wordCount: "body"`, `confirmPublish: true`, and `toolbarOnSelection: true` on the body field.
- The status button is `hidden` while loading and on load errors.
- The save bar mounts only once the form is ready.
- The create dialog is mounted with the collection screen and removed when you leave it.
- New items get a value for every field (empty or default), plus the computed reading time.
- Reading time is saved as a number and shown as "N min".
- Sort ties keep the adapter's order. Title sorting ignores case. Dates compare as strings.
- The empty-state "New post" button gets the plus icon, copied from the design-system demo.
- A load that returns `forbidden` passes the "isn't allowed" message to the login screen myself.
- I included all templates in `build.md`'s list, even ones the schema doesn't use. I also wrote the slide-over status picker even though two statuses never use it.
- After `cleanup()`, the open screen is reset to an idle placeholder.
- `start.mjs` leaves out the "refuse any host but localhost" check, which only applies to auth `none`.
- Seed data: three posts (two drafts, one published), with an inline data image as the published cover.
- Added `.gitignore` with `uploads/`, following the local-disk default.
