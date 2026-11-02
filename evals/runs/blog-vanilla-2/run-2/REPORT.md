# Run 2 report

The Field Notes panel is built in `evals/runs/blog-vanilla-2/run-2/`. My hand walk of conformance passed every check that can be run without the person, apart from two partial items below. Five items are marked "needs the person": the hand checklists with real Google credentials, and two "Ask" questions where I took the recipe's default.

## 1. Files and conformance result

**What I wrote**
- **Copies:** `panel.intake.yaml` and `panel.yaml`. I added five entries to the intake's `open_questions`, each with `assumed: true`.
- **Panel folder:** `panel/index.html` (the icon sprite plus 23 templates, inlined byte-for-byte), `panel.config.js`, `panel.js`, `seed.json`, and `CONFORMANCE.md`.
- **Verbatim copies:** `panel/styles/` (2 files), `panel/snippets/` (8 files), `panel/adapters/` (`memory.js`, `http.js`, `auth.js`) and `server/` (all 6 `.mjs` files).
- **Project root:** `allow.mjs`, `start.mjs`, `package.json`, and a `.gitignore` containing `uploads/`.

**How I checked it**
- The validator says the schema is valid.
- I drove headless Chrome in `?test` mode through every behavior-spec rule group, and the real server through its API using a session cookie I signed with the session module.
- I wrote my own template-fidelity comparison of the live page against the templates. It found 0 problems on every screen and dialog, at 1280px light and at 400px dark, with no sideways scroll.
- I deleted the test `content/` and `uploads/` folders afterwards.

**Partial results**
- **K5 (focus rings):** axe was not run, because installing packages isn't allowed.
- **F2 (upload failure message):** "That file is too large." shows. The generic "Could not upload. Try again." comes from the verbatim `fields.js`, but my scripted second upload didn't show it, so that message is unconfirmed.

**Needs the person:** the Google sign-in checklist with real credentials, the json-files and local-disk hand checklists, and confirming two defaults: content goes in git, uploads don't.

**Rule breaks during testing**
- **Shared browser:** my first headless Chrome (port 9333, profile `/tmp/pn-chrome`) was also being driven by something else; its tab list showed another server on port 4893. Some of my early commands may have navigated that other tab to my panel. I left that Chrome running because something else is using it. Every result in the report comes from a separate Chrome I started afterwards.
- **Writing outside the run folder:** both Chrome profiles were written in `/tmp`. I deleted the second one; `/tmp/pn-chrome` is still there.

## 2. Unclear, contradictory, or missing instructions

- **`build.md` step 2 and step 6:** the config example has no `auth`, `data`, or `files` blocks, but the recipes' `start.mjs` lines read `PANEL.data.path` and `PANEL.files.path`. The recipe snippets also use an undefined `project` variable, and don't say which folder is the server's `root`.
- **`templates/README.md`, `schema-guide.md` §8 item 8, and `build.md` step 8:** the fidelity check, the behavior tests, and the axe and 400px quality checks are only named as repo tools. There is no procedure for running them by hand "elsewhere".
- **"Past the first status" (`behavior-spec.md` "Words used" vs `build.md` step 5):** "Publish" means leaving the first status, while step 5 says to run publish validation "before a status moves past the first". With three or more statuses, it's unclear whether a later move also validates and asks for confirmation.
- **`build.md` step 4, "Load errors":** there is no wording for a singleton that fails to load, and no rule for its title in that state.
- **`recipes/contracts.md` error codes vs `snippets/save-state.js`:** the contract wants "Changed elsewhere…" in the save bar on `conflict`, but the save-state snippet has no hook for an error-specific message.
- **`behavior-spec.md` P5 and A2:** a status click during a background autosave is silently ignored, because `run()` returns false. The spec doesn't cover this case.
- **`build.md` step 6 (`panelTest.reset`):** the given code calls `route()`, but nothing says what should happen when reset runs while signed out, after logout.
- **`build.md` step 4:** it doesn't say whether the layout should persist between routes. It has to, or toasts like "Post deleted" vanish when the screen changes. Focus after a route change isn't specified either.
- **`behavior-spec.md` S7:** it applies "on a panel screen", and it's unclear whether the login screen counts.
- **`build.md` step 4, status slide-over:** it asks for a visually hidden legend, but the design-system demo uses `legend.pn-label`.
- **`build.md` step 4, sort options:** if `list.sort` is the title field, "Title A–Z" would appear twice.
- **`build.md` step 6:** there's no guidance for file values (covers) in the seed, since the memory adapter stores no files.
- **Header title:** nothing says whether the item's title and breadcrumb update while typing or only after a save.
- **`recipes/google-login.md` step 4:** it doesn't say that `request` comes from `createRequest()` in `http.js`.

## 3. Guesses I made

- **Config:**
 - Labels are derived from field names: "Reading time" has no help text, and slug is not required.
 - Every behavior line got its own config key: `wordCount`, `confirmPublish`, `toolbarOnSelection`.
- **Layout and navigation:**
 - The layout and confirm dialog persist across routes.
 - When navigation removes the focused element, focus moves to `#pn-main`.
 - The save bar appears only once the screen has loaded, and the status button is hidden until then.
 - The item title and breadcrumb update on save, not while typing.
- **Status changes:**
 - Publish validation runs for any move to a non-first status; confirmation only when leaving the first status.
 - The slide-over for three or more statuses is built but untested.
- **Copy and messages:**
 - A failed singleton load says "Could not load site settings" and keeps its title.
 - The conflict message is shown with `say()` on the next tick.
- **Field behavior:**
 - Revert also clears visible validation errors.
 - Words are whitespace-separated tokens, so Markdown marks count.
 - Reading time with an empty body shows "1 min".
- **Keyboard:** shortcuts are installed on every in-layout screen, so Cmd+S never opens the browser's Save dialog. Not on login.
- **Seed:** three posts covering both statuses, covers as `data:` SVG URLs, and a settings record.
- **"Ask" defaults:** content in git yes, uploads in git no, uploads served by this server at `/uploads`, not deployed (`127.0.0.1:4810`).
