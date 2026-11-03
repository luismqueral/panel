# Run 1 report

The blog panel is built in `evals/runs/blog-vanilla-3/run-1/`. Every conformance check I could run passed and none failed. Nine checks are marked `needs the person`: they need real Google credentials, axe, the repo's own test suites, or a choice only the person can confirm.

## 1. Files written and the conformance result

**Files I wrote** (paths relative to `run-1/`):
- `panel.intake.yaml` (copied, with three assumed answers added under `open_questions`) and `panel.yaml` (copied unchanged; the validator says `valid`).
- `panel/index.html`: generated from the source files, not retyped. It holds the icon sprite and 23 templates.
- `panel/panel.config.js`, `panel/panel.js`, `panel/seed.json`, `panel/CONFORMANCE.md`.
- `start.mjs`, `allow.mjs`, `package.json`, and `.gitignore` (contains `uploads/`).

**Files I copied unchanged**, checked byte for byte against the skill: `panel/styles/` (2 files), `panel/snippets/` (8), `panel/adapters/` (`memory.js`, `http.js`, `auth.js`), and `server/` (6 `.mjs` files).

**How I walked conformance:** I started `start.mjs` with placeholder credentials and drove `?test` mode in headless Chrome.
- **Passed:**
  - All 8 default checks, the project check (publishing needs a cover image), and all four `behavior` lines.
  - Every rule in behavior-spec sections 1–8, including the 10-second autosave timing.
  - The template check, done by hand on 14 screen states. A class I planted on purpose was caught.
  - The keyboard Tab walk found a focus ring on every stop.
  - No sideways scroll at 400px, and light and dark both work.
  - Server checks: 401 when not signed in, 403 on a write without the `x-panel` header, and 404 for `CONFORMANCE.md`, `allow.mjs` and `../` paths.
- **Needs the person:**
  - axe, which isn't installed here.
  - The repo's recipe tests (`npm run test:recipes`).
  - The Google sign-in checklist, which needs real credentials.
  - The by-hand checklists for content files and uploads, which need a signed-in session.
  - Two "Ask" steps: content goes into git (assumed yes), uploads don't (assumed no).
  - Deployment.

I also wrote two throwaway Chrome profiles in `/tmp` and deleted them. I made one `.scratch/` folder inside the run and deleted it too.

## 2. Unclear, contradictory, or missing instructions

- **`behavior-spec.md` V8 against V4:** when someone saves an already-published post with an empty required field, the spec doesn't say whether the save bar reads "Fix N fields to publish" or "…to save".
- **`behavior-spec.md` P3 and P4:** both are required, but the order isn't given: check the fields first, or ask for confirmation first.
- **`build.md` step 5, validation row:** it gives the mode for publishing (`"publish"`) and for singletons (`"required"`), but not for saving a draft (V3).
- **`templates/README.md` "How templates nest" against `build.md` step 4 "Status slide-over":** the README says the slide-over body holds field templates or a `pn-list`; `build.md` says a `fieldset.pn-choices`.
- **`templates/README.md` "Every screen has four states":** `screens/singleton.html` has no empty region.
- **`templates/README.md` nesting table:** it says the save bar is mounted on item and singleton screens, but not whether it shows while the screen is loading or in an error state.
- **`behavior-spec.md` P1 ("types without status show none"):** the item template always contains a status button. Nothing says to hide it with `hidden`, either for those types or while loading.
- **`recipes/contracts.md` create:** "values … with defaults applied" doesn't say whether to send every field or only the create dialog's fields, or whether computed values are included.
- **`recipes/contracts.md` `forbidden`:** a forbidden *load* should show "This account isn't allowed…", but `auth.js` only sets that message when `session()` itself is refused. How the panel should pass it on isn't stated.
- **`build.md` step 4 "Row and header text":**
  - The home screen's breadcrumb and page title aren't defined.
  - The `href` of the last crumb isn't given.
  - Search isn't said to match the raw value or the displayed value.
  - Date-only values like `2026-10-28` shift back a day if parsed as UTC (in this timezone); there's no warning about it.
- **`build.md` "What you produce":** no `.gitignore` is listed, even though `local-disk.md` step 6 says to add one.
- **`build.md` step 8:** "in this repository" against "elsewhere" is ambiguous.
- **`SKILL.md` section 3:** for Conformance it loads only `schema-guide.md` section 8 and `build.md` step 8, yet the walk needs all of `behavior-spec.md`.
- **`google-login.md` section 5:** "Not done until every box is ticked" sits awkwardly next to `build.md`'s `needs the person` rule for unattended runs.
- **`build.md` routing snippet:** it doesn't cover the login screen. I set `lastHash` there myself.

## 3. Guesses I made

- **V8 and status changes:**
  - V8 uses "Fix N fields to publish".
  - The fields are checked before the publish confirmation appears.
  - The confirm button reads the status name with a capital letter ("Published").
- **Item screen:**
  - The save bar is mounted only once the screen is ready.
  - The status button stays hidden until the item loads.
  - The last crumb links to the current hash.
- **Create flow:**
  - It sends every field: empty values, then defaults, then the dialog's values, then the computed `reading_time`.
  - Seed covers use `data:` SVG URLs, so test mode has no broken images.
- **Config:** the behavior lines map to the keys `wordCount: "body"` and `confirmPublish: true`. The reading-time function reads `values.body`, taken from the field's `describe`.
- **Collection and dates:**
  - The sort menu starts on `list.sort`.
  - Search matches displayed values.
  - Date-only values are parsed in local time.
- **Home screen:** its breadcrumb is just "Home", so the page title is "Home · Field Notes".
- **Login checks:** the session is checked at startup and whenever a load throws `unauthorized` or `forbidden`, not on every route change.
- **Status slide-over:** I included the code for more than two statuses even though this schema never uses it.
- **Where the report goes:** "`panel/CONFORMANCE.md`" means `run-1/panel/CONFORMANCE.md`.
- **Defaults recorded as assumed** in `open_questions`: content committed to git, uploads ignored, and the server bound to `127.0.0.1` only.
