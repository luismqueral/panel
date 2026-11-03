# Conformance: Field Notes

Walked by hand in headless Chrome against `?test` (memory adapters, `seed.json`), and against `start.mjs` with placeholder credentials for the server checks. The behavior test suite and the fidelity tool were not run (built "elsewhere"); fidelity was checked by blanking slots in the page and comparing with the inlined templates.

| Check | Result | Evidence |
| --- | --- | --- |
| Schema validates | pass | `node tools/validate.mjs panel.yaml`: valid |
| 1. Every type has a collection view, an item view, and a create flow | pass | `#/post`, `#/post/<id>`, "New post" dialog (title + slug) |
| 2. Every singleton has an item view | pass | `#/settings` |
| 3. Every field appears in its item view with its declared type, width, and required rule | pass | `post`: title text 1/1 required; slug slug 1/2 `data-from="title"`; date date 1/2 required; cover image 1/2 `data-required="false"`; tags tags 1/2; body markdown 1/1 required; reading_time custom 1/1. `settings`: site_title text required; description textarea |
| 4. Every `list.title`, `subtitle`, `sort`, and `search` entry names a real field | pass | title, date, -date, [title] are all `post` fields |
| 5. Every adapter resolves to a recipe in `recipes/index.json` | pass | google-login, json-files, local-disk (all `verified`) |
| 6. Behavior: "Autosave drafts every 10 seconds" | pass | `panel.config.js` `autosave`; one background `update` after 10 s on a dirty draft, fields stay enabled, failure enters `error` (A1–A4) |
| 6. Behavior: "Show word count under the body field" | pass | `wordCount()` writes "13 words" / "2 words" into the body field's help slot on input and revert |
| 6. Behavior: "Publishing asks for confirmation" | pass | draft → published opens "Publish this post?" · "It will be visible on the site." · "Published"; published → draft does not ask |
| 6. Behavior: "Toolbar hidden until text is selected." | pass | `toolbarOnSelection: true`; toolbar `hidden` until a selection exists |
| 6. Custom field `reading_time` (describe: read-only minutes from body word count) | pass | read-only input shows "1 min"; `max(1, ceil(words / 200))` saved as `reading_time` |
| 7. No core key appears that the guide does not define | pass | schema keys are all from sections 2–5; `x-priority` is an `x-` key |
| 8. Template fidelity on every screen | pass | Home, collection, empty collection, item (two items, edited, with upload), singleton, not found, missing item, load error, create dialog, confirm dialog, login: every `[data-template]` matches its template after blanking slots and runtime attributes |
| Project check: Publishing a post requires a cover image. | pass | `publishRequires: ["cover"]`; publishing "rail-line" without a cover shows "Required to publish." on cover and "Fix 1 field to publish"; cover label keeps `data-required="false"` |
| Behavior spec 1, save state (S1–S9) | pass | clean on load; dirty and back; Cmd+S and Save enter `saving` with fields and Delete disabled, status button enabled; failure keeps edits; conflict message; revert; Cmd+S in clean does nothing; `beforeunload` via `save-state.js`; S9 dialog on nav click and on typed hash, Cancel keeps edits, Discard navigates |
| Behavior spec 1, autosave (A1–A4) | pass | see behavior line above |
| Behavior spec 2, validation (V1–V8) | pass | draft with empty required fields saves; publish blocked with focus on first invalid field; create "Required."; singleton "Fix 1 field to save" + "Required."; published item with empty date blocked ("Fix 1 field to publish") |
| Behavior spec 3, dialogs (D1–D6) | pass | focus to first field / Cancel for negative / confirm otherwise; Tab cycles inside; Escape cancels; backdrop click ignored; focus returns to opener |
| Behavior spec 4, keyboard (K1–K7) | pass | Cmd+S saves; `/` focuses search; Enter submits create; Enter in item field does not save; skip link focuses `#pn-main` and keeps the route |
| K5, visible focus ring on every Tab stop | pass | Tab walk on home, collection, item, singleton in light and dark: every stop shows an outline or box-shadow (tags input via `.pn-tags-input:focus-within`; the date picker button is Chrome's native control) |
| Behavior spec 5, create flow (C1–C6) | pass | title + slug; slug follows title until edited; failure keeps dialog and values with "Could not create. Try again."; success opens the item; Escape creates nothing |
| Behavior spec 6, status (P1–P5) | pass | status button shows "Draft"/"Published"; two statuses toggle; publish checks first; confirmation; saves with edits; toasts "Post published", "Post moved to draft" |
| Behavior spec 8, field controls (F1–F4) | pass | tags Enter/comma/duplicates/Backspace/remove; image upload fills, "That file is too large." keeps old value; bold wraps selection and counts as an edit; computed field read-only and saved |
| 400px wide, no sideways scroll | pass | `scrollWidth` 400 on home, item, singleton |
| Light and dark | pass | `.pn` background switches with `prefers-color-scheme` |
| axe on every screen | needs the person | axe could not run here. Run axe (or `PANEL_URL=<url> npm run test:behavior` in the Panel repo) against `?test` |
| Server: data and files requests need a session; writes need `x-panel: 1`; private files not served | pass | `/api/items/post` 401; POST without `x-panel` 403; `/CONFORMANCE.md` and `/../allow.mjs` 404; allow list only in `allow.mjs` |
| google-login hand checklist (real Google sign-in, cookie flags, allowed and refused accounts, logout, revocation) | needs the person | Create a Web OAuth client with origin `http://localhost:4810` (and `http://127.0.0.1:4810`), set `GOOGLE_CLIENT_ID` and a 32+ character `SESSION_SECRET` in the environment, run `node start.mjs`, and tick every box in `recipes/google-login.md` section 5 |
| json-files hand checklist (file on disk, `git diff`, delete, stop mid-save) | needs the person | Needs a signed-in session; run after sign-in works. Assumed default: content folder goes in git (`panel.intake.yaml` `open_questions`) |
| local-disk hand checklist (upload lands on disk, reload, direct URL, `../../evil.html`) | needs the person | Needs a signed-in session. Assumed default: uploads stay out of git (`.gitignore` has `uploads/`) |
| Deployment | needs the person | Runs on `127.0.0.1:4810`. To deploy: set `HOST`, add the public origin to the OAuth client, serve over HTTPS (send `X-Forwarded-Proto: https` behind a proxy) |
