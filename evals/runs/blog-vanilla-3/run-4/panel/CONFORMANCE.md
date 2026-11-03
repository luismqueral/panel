# Conformance: Field Notes

Walked by hand (not in the Panel repository), against `panel.yaml` (validator: valid) in headless Chrome with `?test`, and against the project server started with placeholder credentials.

| Check | Result | Evidence |
| --- | --- | --- |
| 1. Every type has a collection view, an item view, and a create flow | pass | `#/post`, `#/post/<id>`, "New post" dialog (header button and empty-state button) |
| 2. Every singleton has an item view | pass | `#/settings` renders `screen-singleton` with Site title and Description |
| 3. Every field appears in its item view with its declared type, width, and required rule | pass | Item form holds `field-text` title (1/1, required), `field-slug` slug (1/2), `field-date` date (1/2, required), `field-image` cover (1/2, `data-required="false"`), `field-tags` tags (1/2), `field-markdown` body (1/1, required), `field-custom` reading_time (1/1); settings: site_title (text, required), description (textarea) |
| 4. Every `list.title`, `subtitle`, `sort`, and `search` entry names a real field | pass | title, date, -date, [title] are all post fields; validator agrees |
| 5. Every adapter resolves to a recipe in `recipes/index.json` | pass | google-login, json-files, local-disk, all `verified` |
| 6. Behavior: "Autosave drafts every 10 seconds" | pass | `panel.config.js` `autosave`; a dirty draft saved in the background after 10 s with fields enabled; never runs once published |
| 6. Behavior: "Show word count under the body field" | pass | `wordCount: "body"`; help slot reads "14 words", updates on typing and toolbar edits; `count()` gives "1 word" at one (read, not run) |
| 6. Behavior: "Publishing asks for confirmation" | pass | `confirmPublish`; "Publish this post?" / "It will be visible on the site." / "Published", only when leaving draft; moving back has no dialog |
| 6. Behavior: "Toolbar hidden until text is selected." | pass | `toolbarOnSelection: true` on body; toolbar `hidden` until a selection exists |
| 7. No core key appears that the guide does not define | pass | Validator: valid; `x-priority` is an `x-` key |
| 8. Template fidelity on every screen | pass | Every `data-template` element and repeat unit, slots blanked and Rule 4 attributes stripped, matches its template on home, collection, empty collection, create dialog, item (clean, with errors), confirm dialog, missing item, item load error, collection load error, singleton, singleton load error, not found, login. Checker confirmed to fail on a planted class and a removed attribute |
| Project: Publishing a post requires a cover image. | pass | `publishRequires: ["cover"]`; publishing without a cover shows "Required to publish." on cover and "Fix 1 field to publish"; status stays Draft |
| S1–S9 save state | pass | Loaded item `clean`; edits `dirty`, undoing returns `clean`; saving disables every form control (status button stays enabled); failure keeps edits and re-enables; `conflict` message; Revert; Cmd+S prevented; `beforeunload` wired by `save-state.js`; leaving a dirty item opens "Discard unsaved changes?" with the URL held, Cancel keeps edits, Discard navigates; logout asks too |
| A1–A4 autosave | pass | Background save with fields enabled, "Saving…" message, `clean` after; failure enters `error` (snippet) |
| V1–V8 validation | pass | Blur checks format only (slug); empty required title not flagged on blur; draft with empty required fields saves; format error blocks with "Fix 1 field to save"; publish flags all four empty required fields and focuses the first; errors clear when valid; create needs a title ("Required."); singleton blocks on empty Site title with "Required." and "Fix 1 field to save"; published item saves with V4 checks |
| D1–D6 dialogs | pass | `showModal`; create focuses Title; Delete and Discard focus Cancel (negative); Publish focuses confirm; Escape cancels; focus returns to the opener |
| K1–K7 keyboard | pass with note | Cmd+S saves; `/` focuses search; Enter submits create; skip link focuses `#pn-main` and keeps `#/`; Enter in a field does not submit or save. K5 Tab walk on the item screen: every stop shows a ring (tags input via `.pn-tags-input:focus-within`), except Chrome's built-in calendar button inside the date input, which is a native control |
| C1–C6 create flow | pass | Asks title and slug only; slug follows title ("cafe-at-dawn") until edited; failure keeps the dialog and values with "Could not create. Try again."; success creates a draft with every field and opens it; Escape creates nothing |
| P1–P5 status | pass | Button shows "Draft"/neutral and "Published"/positive; two statuses toggle; publish runs V4 then the confirm; saves at once with pending edits; toasts "Post published" and "Post moved to draft" |
| F1–F4 field controls | pass | Tags: comma, Enter, duplicate ignored, Backspace removes last; image upload sets `filled`; bold wraps the selection and counts as an edit; reading time is read-only, "1 min", saved as a number |
| Section 7 test hook | pass | `window.panelTest` with `adapter`, `fail`, `delay`, `calls`, `reset`; `reset` re-renders the current route without S9 |
| Copy (build.md step 7) | pass | Home, collection, empty, load failed, missing item, delete, discard, toasts, login copy as specified |
| 400px wide, no sideways scroll | pass | `scrollWidth` equals `clientWidth` at 400px on home, collection, item, singleton |
| Light and dark | pass | `prefers-color-scheme: dark` switches the panel colors (tokens) |
| axe on every screen | needs the person | axe could not run here (no packages installed). Run axe on each screen listed in check 8 |
| json-files: server branch wired | pass | `start.mjs` `createJsonFiles`; refuses unknown types, fields, statuses, and `../` ids; writes `content/post/<id>.json`; singleton at `content/settings.json` |
| json-files: content in git (step 4, "Ask") | needs the person | Default taken: yes, commit `content/`. Recorded in `panel.intake.yaml` with `assumed: true`. Confirm, then run the hand checklist (create and refresh, file on disk, `git diff`, delete, stop mid-save) |
| local-disk: wired | pass | `start.mjs` `createLocalDisk`; stored as `uploads/2026/11/<hex>-evil-name.png` for `../../evil name.png`; served with `nosniff` and a sandboxing CSP; HTML refused |
| local-disk: uploads in git (step 6, "Ask") | needs the person | Default taken: no; `uploads/` is in `.gitignore`. Recorded in `panel.intake.yaml`. Confirm, then run the hand checklist (upload, reload, open URL, `../../evil.html`) |
| google-login: wired | pass | `allow.mjs` holds the allow list outside `panel/`; `panel.config.js` has none; server answers 401 without a session and 403 without `x-panel`; login screen shows Google's button |
| google-login: hand checklist with real credentials | needs the person | Create a Google OAuth web client with origin `http://localhost:4810`, set `GOOGLE_CLIENT_ID` and a 32+ character `SESSION_SECRET` in the environment, run `node start.mjs`, and tick every box in `recipes/google-login.md` section 5 |
| google-login: deploying (step 8) | needs the person | Runs on `127.0.0.1:4810`. To deploy: set `HOST`, add the public origin to the Google client, serve over HTTPS (or a proxy sending `X-Forwarded-Proto: https`) |
| Copied files unchanged | pass | `styles/`, `snippets/`, `adapters/`, `server/` compared byte for byte with the skill |
