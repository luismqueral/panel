# Conformance: Field Notes

Walked by hand in headless Chrome against `start.mjs` (`?test` memory adapters for behavior, the real server for recipes). `npm run test:behavior` was not run: this build is "elsewhere". Schema: `node tools/validate.mjs panel.yaml` → valid.

| Check | Result | Evidence |
| --- | --- | --- |
| 1. Every type has a collection view, an item view, and a create flow | pass | `#/post`, `#/post/<id>`, "New post" dialog (title + slug) opens the new item |
| 2. Every singleton has an item view | pass | `#/settings` renders `screen-singleton` with Site title and Description |
| 3. Every field appears in its item view with its declared type, width, and required rule | pass | Item form order and widths: title 1/1, slug 1/2, date 1/2, cover 1/2, tags 1/2, body 1/1, reading_time 1/1; `data-required` from `required`; settings: site_title (required), description |
| 4. Every `list.title`, `subtitle`, `sort`, and `search` entry names a real field | pass | title, date, -date, [title] all exist in `post`; validator agrees |
| 5. Every adapter resolves to a recipe in `recipes/index.json` | pass | google-login, json-files, local-disk (all `verified`) |
| 6. Behavior: "Autosave drafts every 10 seconds" | pass | `autosave` in `panel.config.js`; a dirty draft saved in the background after ~9.3 s; a dirty published post was not autosaved in 10.8 s |
| 6. Behavior: "Show word count under the body field" | pass | `wordCount: "body"`; body help reads "0 words", "3 words", "13 words" as you type, and after Revert |
| 6. Behavior: "Publishing asks for confirmation" | pass | `confirmPublish`; "Publish this post?" · "It will be visible on the site." · "Published"; Escape keeps Draft |
| 6. Behavior: "Toolbar hidden until text is selected." (body) | pass | `toolbarOnSelection: true`; toolbar `hidden` until a selection exists |
| 7. No core key appears that the guide does not define | pass | Validator valid; only extra key is `x-priority` (tool metadata, ignored) |
| 8. Template fidelity on every screen | pass | Own walk of the live DOM against each inlined template (tags, classes, fixed attributes, fixed text, repeat units): 0 problems on home, collection, empty collection, item, singleton, not found, missing item, load error, create dialog, confirm dialog, login. `tools/lib/fidelity.js` was not run (off limits) |
| Publishing a post requires a cover image. | pass | `publishRequires: ["cover"]`; publishing a draft without a cover shows "Required to publish." on Cover and "Fix 1 field to publish"; status stays Draft. Cover keeps `data-required="false"` |
| Save state S1–S9 | pass | Loaded clean; edit makes dirty, undo returns clean; saving disables fields, Delete, and remove-tag, status button stays enabled; failure keeps edits; Revert; Cmd/Ctrl+S; `beforeunload` prompt when dirty; S9 dialog on hash change and on Back, Cancel keeps edits, Discard navigates; logout asks too |
| Autosave A1–A4 | pass | Background save keeps fields enabled with "Saving…"; edit during it stays dirty with sent values saved; background failure enters `error` with fields enabled |
| Validation V1–V7 | pass | No error while typing; slug format error on blur (seen in the first run; focus events from script were unreliable in a later headless tab); draft with empty required fields saves; publish shows every error and focuses the first; errors clear when valid; create needs a title ("Required."); singleton save with empty Site title: "Required.", "Fix 1 field to save" |
| Dialogs D1–D6 | pass | Focus to first field, or Cancel for negative confirms; Tab cycles inside; Escape cancels; backdrop click does nothing; focus returns to opener; only Confirm confirms |
| Keyboard K1–K7 | pass, K5 partly | Ctrl+S saves; Escape closes; `/` focuses search; Enter creates; skip link focuses `#pn-main` and keeps the route; Enter in item form does nothing. K5: Tab reaches every action and the focus ring comes from the unedited `components.css`, but axe was not run (cannot install it here) |
| Create flow C1–C6 | pass | Asks title + slug; slug follows title ("hello-cafe-world") until edited; failure keeps the dialog and values with toast "Could not create. Try again."; Cancel creates nothing; created as draft |
| Status P1–P5 | pass | Button shows Draft/Published with tone; two statuses toggle; V4 runs first; confirm before publishing; status change saves edits with it; toasts "Post published", "Post moved to draft" |
| Field controls F1–F4 | pass, F2 partly | Tags: Enter, comma, blur add; duplicates ignored; Backspace removes last; remove returns focus. Upload sets `filled`; "That file is too large." on `too-large`. The generic "Could not upload. Try again." comes from the verbatim `fields.js`, but my second scripted upload did not show it, so that message is unconfirmed. Toolbar wraps and prefixes. Reading time is read-only, updates live, and saves (`reading_time: 1` sent on update) |
| Test hook (section 7) | pass | `window.panelTest` has adapter, fail, delay, calls, reset; `reset` re-renders the route (seen with an empty seed → empty state) |
| 400px wide, light and dark | pass | No horizontal scroll at 400px on every screen above; dark scheme switches the layout background (rgb 240 → rgb 31) |
| Copy (build.md step 7) | pass | Home title and sections, "Loading…", "New post", "Search posts", "Sort by", sort options, empty, load failed, missing item, delete, publish, discard, toasts, login copy as written |
| Allow list stays server-side | pass | `allow.mjs` at project root, imported by `start.mjs` only; `panel.config.js` has no `allow`; `CONFORMANCE.md` is a 404 from the server |
| Recipe json-files, automated part | pass | Through the real server with a scripted session cookie: create, update, singleton save, and delete wrote and removed `content/post/<id>.json` and `content/settings.json`; unknown field refused (`invalid`) |
| Recipe local-disk, automated part | pass | Upload named `../../my cover.png` stored as `uploads/2026/11/<hex>-my-cover.png`; served as `image/png` with `nosniff` and a sandboxing CSP; `text/html` refused |
| Recipe google-login, automated part | pass | `GET /api/session` 401 without a cookie; non-allowed address gets `forbidden`; writes without `x-panel: 1` get 403; real mode shows the login screen with Google's button and no `window.panelTest` |
| json-files: content in version control (step 4, "Ask") | needs the person | Default taken: yes, `content/` is not ignored. Recorded in `panel.intake.yaml` as assumed. Confirm, or add `content/` to `.gitignore` |
| local-disk: uploads in git (step 6, "Ask") | needs the person | Default taken: no, `uploads/` is in `.gitignore`. Recorded as assumed. Confirm |
| google-login hand checklist | needs the person | Create a Google OAuth web client with origin `http://localhost:4810` (and `http://127.0.0.1:4810`), set `GOOGLE_CLIENT_ID` and a 32+ character `SESSION_SECRET` in the environment, run `node start.mjs`, and tick every box in `recipes/google-login.md` section 5 |
| json-files hand checklist | needs the person | With a real sign-in: create and refresh, read `content/post/<id>.json`, `git diff` after an edit, delete, and stop the server mid-save |
| local-disk hand checklist | needs the person | With a real sign-in: upload an image, reload, open its URL, try `../../evil.html` |
