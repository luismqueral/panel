# Conformance: Sunday Table

Walked by hand ("elsewhere"): no test suite was run. Behavior rules were driven in a normal Chrome window over the DevTools protocol, against `?test` (memory adapters, `seed.json`) and against `start.mjs` with throwaway `PANEL_PASSWORD` and `SESSION_SECRET` values. `node tools/validate.mjs panel.yaml` reports `valid`.

| Check | Result | Evidence |
| --- | --- | --- |
| Every type has a collection view, an item view, and a create flow | pass | `#/recipe`, `#/recipe/<id>`, "New recipe"; `#/cook`, `#/cook/<id>`, "New cook" |
| Every singleton has an item view | pass | `#/about` (title, body); Save blocked by an empty title with "Fix 1 field to save" |
| Every field appears in its item view with its declared type, width, and required rule | pass | Recipe: name text 2/3 required, favorite toggle 1/3, photo image 1/2, cook relation 1/2 ("Comes from"), serves, prep_time, cook_time number 1/3, ingredients textarea required, steps markdown required. Cook: name text required, photo image 1/3, bio textarea 2/3. About: title text required, body markdown. Each `.pn-field` has the template's `data-field`, `data-width`, and `data-required` |
| Every `list.title`, `subtitle`, `sort`, and `search` entry names a real field | pass | recipe: title `name`, subtitle `cook`, search `name`, `ingredients`; cook: title `name`, search `name`; no `sort` |
| Every adapter resolves to a recipe in `recipes/index.json` | pass | auth `password`, data `json-files` (via `server`), files `local-disk` |
| Every `behavior` line is implemented and can be demonstrated | pass | The schema has no `behavior` lines |
| No core key appears that this guide does not define | pass | Validator: `valid`; `panel.config.js` restates only schema keys plus derived labels |
| The pages pass the template fidelity check | pass | All 19 build states, slots blanked and runtime state attributes ignored, match their template files; `playground.html` matches on all 25 screens |
| Retiring a recipe keeps it in the Recipes list. | pass | Status slide-over → "retired": the row stays in `#/recipe` with its "retired" pill; in real mode `content/recipe/<id>.json` keeps the file with `"status": "retired"` |
| Template fidelity on every screen (build check) | pass | Same as above; the 22 templates the schema uses are inlined verbatim in `index.html`, and the icon sprite is verbatim |
| S1–S9 Save state | pass | Loaded item `clean`; edit and undo-edit move between `dirty` and `clean`; Save and Cmd+S enter `saving` with fields and Delete disabled; pressing the status button while saving does nothing; failed save keeps edits; `conflict` message; Revert; Cmd+S in `clean` does nothing; `beforeunload` set; nav link, back button, typed hash, and Log out all ask "Discard unsaved changes?" |
| A1–A4 Autosave | pass | Not applicable: no `behavior` line asks for autosave, and none is built |
| V1–V8 Validation | pass | No error while typing; blur checks `min` only; an "idea" recipe saves with empty required fields; moving to "testing" with empty fields shows "Required to publish.", focuses the first, and reads "Fix 2 fields to publish"; errors clear on fix; create needs a name; About shows "Required." and "Fix 1 field to save"; a "ready" recipe cannot be saved with empty steps. No slug or date fields |
| D1–D6 Dialogs | pass | `showModal`; focus to the name field, or to Cancel on the negative delete confirm; Tab cycles inside; Escape cancels; backdrop click does nothing; focus returns to the opener; Cancel never deletes |
| K1–K7 Keyboard | pass | Cmd+S saves; Escape closes the topmost dialog; `/` focuses search except in a text control; Enter in the create dialog submits; K5 ring on all 24 Tab stops; the skip link focuses main and keeps the route; Enter in an item field neither submits, reloads, nor saves |
| C1–C6 Create flow | pass | Asks only for the name (no slug, so C2 does not apply); Create and Enter run V6; the new item opens in "idea" with `favorite: false`; a failed create keeps values and toasts "Could not create. Try again."; Cancel and Escape create nothing |
| P1–P5 Status | pass | Recipe header shows the current status; cooks show none; four statuses open the slide-over; a failed publish check leaves the status unchanged; no confirm `behavior` line, so P4 does not apply; a status change saves with unsaved edits |
| F1–F4 Field controls | pass | F2: upload fills the field and counts as an edit, remove empties it and focuses the input, a failed upload shows "Could not upload. Try again.", too-large shows "That file is too large."; F3: Bold wraps the selection and counts as an edit. No tags or computed fields, so F1 and F4 do not apply |
| No sideways scroll at 400px, light and dark | pass | Every build state and playground screen at 400px wide, in both color schemes |
| axe on every screen | needs the person | axe could not run here (no packages installed). Run axe in the browser's dev tools on each screen |
| password: the password and `SESSION_SECRET` are set in the environment, not in any file in the repo | needs the person | No secret is in any file; `panel.yaml` only names `PANEL_PASSWORD`. Set real values for `PANEL_PASSWORD` (at least the recipe's minimum length) and `SESSION_SECRET` before `node start.mjs`; the server refuses to start without them |
| password: opening the panel shows the login screen with the password field focused | pass | Real mode, fresh browser |
| password: a wrong password shows "That password isn't right. Try again." and does not open the panel | pass | Real mode; after 10 wrong tries in 15 minutes even the right password is refused (429) |
| password: the right password opens Home, and the nav shows `editor` | pass | Real mode |
| password: the `pn_session` cookie is `HttpOnly`, `SameSite=Lax`, and, on HTTPS, `Secure`; nothing in `localStorage` | needs the person | `HttpOnly` and `SameSite=Lax` checked, `localStorage` empty. `Secure` needs HTTPS: check it once the panel runs behind HTTPS on the shared computer or a host |
| password: log out returns the login screen, and `GET /api/session` answers 401 | pass | Real mode |
| json-files: create an item, refresh, it is still there | pass | Real mode |
| json-files: `content/<type>/<id>.json` exists and reads like the item | pass | Real mode, `content/recipe/<id>.json` |
| json-files: edit, save, and `git diff` shows only the change | needs the person | git could not be run here. Commit `content/`, edit one field in the panel, and check that `git diff` shows only that line |
| json-files: delete the item, its file is gone | pass | Real mode |
| json-files: stop the server mid-save; the save bar shows its error and the file is the old version | pass | Real mode; the old file parsed whole, and retrying after a restart saved |
| json-files Ask: commit content to git? | needs the person | Assumed yes (intake `open_questions`). Confirm, then commit `content/` |
| local-disk: upload an image; it shows in the field and exists under the folder | pass | Real mode, `uploads/<yyyy>/<mm>/<8hex>-<name>` |
| local-disk: reload; the image still shows | pass | Real mode |
| local-disk: open the image URL directly; it loads as an image | pass | Real mode; served with `nosniff` and the sandboxing CSP |
| local-disk: upload `../../evil.html`; refused, or stored with a safe name and never served as a page | pass | Real mode; stored under a safe name and not served as HTML; a `../` path under `/uploads` answers 404 |
| local-disk Ask: commit uploads to git? | needs the person | Assumed no: `uploads/` is in `.gitignore`. Back the folder up some other way, or remove that line to commit photos |
| Dialogs in the person's own browser | needs the person | Headless Chrome 156 dropped dialog `close` events, which the verbatim `dialogs.js` waits on; a normal Chrome window passed every dialog check. Open the panel once in your browser, open and close a dialog twice |
