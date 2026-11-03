# Run 2 report

The blog panel is built in `evals/runs/blog-vanilla-3/run-2/`. Every conformance check I could run passed. Five checks are marked "needs the person": axe, the three recipe hand checklists that need real Google sign-in, and deployment. I fixed nothing to get here, and no check failed.

## 1. Files and conformance

**Files I wrote** (all paths relative to the run folder):
- `panel.intake.yaml` (copied, then three assumed answers added under `open_questions`) and `panel.yaml` (copied; the validator says valid).
- `panel/index.html`: I generated it with a Node one-off that inlines `icons.svg` and the 23 templates verbatim, so nothing was retyped.
- `panel/panel.config.js`, `panel/panel.js`, `panel/seed.json`, and `panel/CONFORMANCE.md`, written last.
- Copied whole, never edited: `panel/styles/` (2 files), `panel/snippets/` (all 8), `panel/adapters/` (`memory.js`, `http.js`, `auth.js`), and `server/` (all 6 `.mjs` files).
- At the project root: `allow.mjs`, `start.mjs`, `package.json`, and `.gitignore` (which ignores `uploads/`).

**How I checked it:** I drove headless Chrome in `?test` mode. To do that I used the Playwright copy already in the repo's `node_modules`, from scripts piped through stdin; I didn't install anything or run any test suite. I also started `start.mjs` with placeholder credentials to check the server.

**What passed:**
- **Default checks 1–8 and the project check** (publishing needs a cover image).
- **Template fidelity, checked by hand:** I blanked every slot on every screen, both dialogs, the empty and error states, and login, then compared each against its template.
- **Every behavior-spec rule:** S1–S9, A1–A4, V1–V8, D1–D6, K1–K7, C1–C6, P1–P5 and F1–F4.
- **Layout and focus:** 400px wide with no sideways scroll, light and dark modes, and a Tab walk showing a focus ring on every stop.
- **Server:** requests without a session get 401, writes without the `x-panel` header get 403, and `CONFORMANCE.md` and `allow.mjs` are not served.
- **No console errors.**

**Needs the person:**
- **axe:** it couldn't run here.
- **google-login, json-files and local-disk hand checklists:** these need a real Google OAuth client, plus `GOOGLE_CLIENT_ID` and a `SESSION_SECRET` of 32+ characters in the environment.
- **Deployment:** the panel runs on `127.0.0.1:4810` only.

## 2. Unclear, contradictory, or missing instructions

- **`build.md` step 6**, "Write one file per recipe in the schema", contradicts `google-login.md` step 1 ("Do not rewrite them"). The recipes are copied, and the three of them share `http.js` and `auth.js`.
- **`build.md` step 6 and the recipes' `start.mjs` snippets** use `project` and `resolve(project, …)` without defining `project`.
- **`build.md` step 4, "What is mounted"**, names the layout, confirm dialog, toasts and slide-over, but not the create dialog.
- **`build.md` step 4** doesn't say:
  - where to go after a successful delete,
  - which sort option is selected at first,
  - how search matches,
  - whether the not-found screen fills the home headings.
- **`behavior-spec.md` P3 and P4** don't say whether a failed publish check stops the flow before or after the confirm dialog. `save-state.js` validates again inside `save()` either way.
- **`contracts.md` error codes** say a load that throws `forbidden` shows "This account isn't allowed…". But `auth.js` only sets that message when `session()` refuses. A forbidden data load has no wired path, so I wrote it in `panel.js`.
- **`behavior-spec.md` P1** says types without a status show no status button, but `screens/item.html` always has one. Templates can't be edited, so the only option is `hidden`.
- **`build.md` step 6, seed shape** has no guidance on file values in the seed. A published post must have a cover, and the cover needs a URL that resolves in test mode.
- **`schema-guide.md` section 7** doesn't say whether a build should do anything with `x-priority: low`.
- **`build.md` step 8** says to write the report as "one table", but some context outside the table seems needed.
- **The run instructions** say "Write `panel/CONFORMANCE.md`", which could mean the skill folder. I took it as the build's `panel/` folder, because I'm only allowed to write inside the run folder.

## 3. Guesses I made

- **Allow list:** `me@example.com` came from the approved schema, but it looks like a placeholder. The person must replace it in `allow.mjs` and `panel.yaml`, or no one can sign in.
- **Recipe defaults taken unattended and recorded in the intake:** the content folder goes in git; uploads stay out of git; the panel is not deployed.
- **Create dialog:** built when it opens and removed when it closes.
- **Publish order:** run the publish checks, then confirm, then save.
- **After a delete:** go to the collection without the discard prompt, and toast "Post deleted".
- **Collection screen:**
  - The default sort is `list.sort`.
  - Search is a case-insensitive substring match.
  - Text sorts with locale order, numbers aware.
  - Home's "Recently edited" sorts by `updatedAt`.
- **Dates:** date-only values are read as local dates, so "2026-10-28" doesn't shift a day.
- **Word count:** it also refreshes on Revert, not only on input.
- **Reading time** is saved as a number of minutes.
- **Not-found screen:** headings and loading text left blank.
- **Seed cover:** an SVG `data:` URL.
- **Fallbacks for cases this schema doesn't hit:** a draft save runs format checks and shows them. The three-or-more-status slide-over is built but unused here. A type without statuses would hide its status button.
