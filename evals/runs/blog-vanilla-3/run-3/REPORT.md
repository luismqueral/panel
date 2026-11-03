# Run 3 report

I built the blog panel and it passes conformance. Every check I could run passed. Nine checks are marked `needs the person`: axe, the three recipe hand checklists, deploying, two recipe questions where I took the default, and two hand-check gaps I raise in section 2. No check failed.

## 1. Files and conformance

All files are in `evals/runs/blog-vanilla-3/run-3/`, laid out as `build.md` says:

- **Inputs:** `panel.intake.yaml` and `panel.yaml`, copied in. The validator says the schema is valid. I added three assumed answers to the intake's `open_questions`.
- **Written by hand:**
  - `panel/index.html`, with the icon sprite and 23 templates inlined. I copied them with a Node one-liner and checked them byte for byte.
  - `panel/panel.config.js`, `panel/panel.js`, `panel/seed.json`, `panel/CONFORMANCE.md`.
  - `start.mjs`, `allow.mjs`, `package.json`, `.gitignore`.
- **Copied unchanged** (all 19 byte-identical to the skill):
  - `panel/styles/`: two files.
  - `panel/snippets/`: eight files.
  - `panel/adapters/`: `memory.js`, `http.js`, `auth.js`.
  - `server/`: all six recipe server files.

**How I checked.** I ran `start.mjs` with dummy credentials and drove it in headless Chromium. Nearly all of it ran in `?test` mode; the login check used the real server.

- **Default checks 1–8 and the cover-image check:** pass.
- **Behavior lines:** all four are shown working. These are autosave after 10 seconds, the word count, the publish confirm, and the toolbar hidden until text is selected.
- **Behavior spec:** every rule passes (save state, autosave, validation, dialogs, keyboard, create flow, status, field controls).
  - The headless browser never showed the leave-page prompt (S8). I checked it another way: the panel cancels a `beforeunload` only when the form is dirty or in error.
  - The status slide-over (P2) can't be reached with two statuses. The code for three or more exists but never ran.
- **Template fidelity:** 0 differences across 11 screen states.
- **Other checks:**
  - 400px width in light and dark: no sideways scroll.
  - Focus ring: visible on every Tab stop.
  - Skip link: moves focus and keeps the route.
  - Real login screen: shows Google's button.
  - Server: refuses requests without a session (401) and writes without the `x-panel` header (403).
- **`needs the person`:**
  - Axe: it can't run without installing packages.
  - The google-login, json-files, and local-disk hand checklists: they need real Google credentials.
  - Deploying.
  - The two recipe questions, where I took the defaults: content goes in git, uploads don't.

## 2. Unclear, contradictory, or missing instructions

- **`build.md` step 8 and `templates/README.md` (last line):** fidelity "by hand" isn't practical across 14 or more templates per screen, so I wrote a throwaway script in the browser. The README points to `npm run check:templates` and `tools/lib/fidelity.js`, which this run forbids. It also doesn't say how to compare repeat units or `<textarea>` text when blanking slots.
- **`behavior-spec.md` K5:** "Checked by the design-system check, and by axe." Neither is available outside the repository.
- **`behavior-spec.md` section 7:** it points to `evals/behavior/seed.json`, which this run forbids me to read.
- **`recipes/contracts.md` and `templates/README.md` ("How templates nest") vs. `recipes/client/auth.js`:**
  - Contradiction: the login controls must be "built from design-system components", but the copied `auth.js` renders Google's own button.
  - My handling: I kept the recipe file unchanged.
  - Unresolved check: it's still listed as `needs the person` in `CONFORMANCE.md`, so the person has to decide.
- **`build.md` step 5 vs. `behavior-spec.md` V8:**
  - The gap: cover-image fields are added "before a status moves past the first". It doesn't say whether they also apply when saving a post that is already published.
  - My handling: I applied them there too.
  - Unresolved check: the person has to confirm it.
- **`build.md` step 5 "Show word count":** it doesn't define a word, for example whether Markdown symbols count. The reading-time field depends on the same count.
- **`behavior-spec.md` C4 and `contracts.md` (values):** "every `default` applied" doesn't say whether fields without a default are sent empty or left out. It also doesn't say whether the computed field is filled in at create time.
- **`build.md` step 4:**
  - It doesn't say what the breadcrumb and page title are on Home.
  - It doesn't say when the create dialog is mounted.
  - It doesn't say whether the status button shows while loading or on error.
  - It doesn't say whether the slide-over applies on choosing a status or on Done.
  - It doesn't say whether Delete on a dirty item triggers the discard prompt (S9).
- **`build.md` step 5 ("A load that throws either shows `screen-login`"):** it doesn't say to show the "This account isn't allowed…" message from the `contracts.md` error table.
- **Dates:** the date format "Oct 28, 2026" is given, but not the time zone. Date-only values can shift by a day in local time.
- **`recipes/local-disk.md` step 6:** "add the uploads folder to `.gitignore`", but `build.md` "What you produce" lists no `.gitignore`.
- **`build.md` step 8, `open_questions` example:** `answer: yes` is unquoted. That's the value `schema-guide.md` rule 1.4 says to quote, though that rule covers only `panel.yaml`.
- **`SKILL.md` section 3:** the Conformance step's reading list leaves out `behavior-spec.md`. `build.md` step 8 needs it.

## 3. Guesses

- **Config key names:** I invented `wordCount: "body"` and `confirmPublish: true`. `build.md` only names `autosave`, `publishRequires`, and `toolbarOnSelection`.
- **Word count:** counts runs of letters and digits, so `**bold**` is one word. Reading time is `max(1, ceil(words / 200))`.
- **Dates:** date-only values are formatted in UTC; created and updated times in local time.
- **Status button:** hidden while loading and on error.
- **Published posts:** saving one also requires a cover.
- **Create:** sends every field (empty when it has no default), with reading time computed.
- **Create dialog:** mounted only while a collection is open.
- **Home:** the breadcrumb is "Home" alone, so the page title is "Home · Field Notes".
- **Search:** matches both the raw value and the displayed value.
- **Sorting:** ties keep their order; recent items are sorted by `updatedAt`.
- **Load refused:** passes the "This account isn't allowed…" message to the login screen.
- **Delete:** skips the discard prompt, since Delete already asks for confirmation.
- **Slide-over:** applies only on Done.
- **Reading time field:** its help line stays empty.
- **Seed:** two drafts (one untitled) and one published post. The published post's cover is a data-URL SVG.
- **`.gitignore`:** placed at the project root with `uploads/`.
- **Unattended defaults:**
  - Content goes in git: yes.
  - Uploads go in git: no.
  - Deploying: not done, the server stays on `127.0.0.1`.
