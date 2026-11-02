# Conformance: Field Notes

Walked by hand on Nov 2, 2026, in headless Chromium against `?test` (memory adapters, `seed.json`) and against the project server (`start.mjs`, with a throwaway `SESSION_SECRET` and a session cookie signed locally, because Google sign-in needs the person). The behavior test suite was not run: this run is "elsewhere".

| Check | Result | Evidence |
| --- | --- | --- |
| Schema validates | pass | `node tools/validate.mjs panel.yaml`: valid |
| 1. Every type has a collection view, an item view, and a create flow | pass | `#/post`, `#/post/<id>`, "New post" dialog (title and slug) opens the new item |
| 2. Every singleton has an item view | pass | `#/settings` |
| 3. Every field appears in its item view with its declared type, width, and required rule | pass | `post`: title text 1/1 required, slug slug 1/2 (`data-from="title"`), date date 1/2 required, cover image 1/2, tags tags 1/2, body markdown 1/1 required, reading_time custom 1/1. `settings`: site_title text 1/1 required, description textarea 1/1. `data-required` and `aria-required` match |
| 4. Every `list.title`, `subtitle`, `sort`, and `search` entry names a real field | pass | title, date, -date, [title] are all `post` fields |
| 5. Every adapter resolves to a recipe in `recipes/index.json` | pass | google-login, json-files, local-disk |
| 6. Every behavior line is implemented: "Autosave drafts every 10 seconds" | pass | `panel.config.js` `autosave`; a dirty draft saved by itself after 10 s; a dirty published post did not |
| 6. Every behavior line is implemented: "Show word count under the body field" | pass | `wordCount: "body"`; the body help reads "15 words", "3 words", "0 words" as you type |
| 6. Every behavior line is implemented: "Publishing asks for confirmation" | pass | `confirmPublish`; "Publish this post?" · "It will be visible on the site." · "Published"; Escape cancels and the status stays Draft |
| 6. Every behavior line is implemented: "Toolbar hidden until text is selected." | pass | `toolbarOnSelection: true` on body; toolbar `hidden` until a selection, then Bold wraps it (`**The**`) |
| 7. No core key appears that the guide does not define | pass | Only `x-priority` (an `x-` key) beyond core keys |
| 8. The pages pass the template fidelity check | pass | Compared every `[data-template]` on home, collection, create (with error), item (draft, publish blocked, publish confirm, published), singleton, not found, missing item, load error, empty collection, and login against `templates/`, slots and runtime attributes stripped, repeat units checked: no differences. `tools/lib/fidelity.js` was not used (out of bounds for this run) |
| Publishing a post requires a cover image. | pass | `publishRequires: ["cover"]`; publishing without one shows "Required to publish." on cover (and date), "Fix 2 fields to publish", focus on the first; cover keeps `data-required="false"` |
| S1–S7 save state | pass | Loads `clean`; edits `dirty`; Revert restores tags and text; Cmd+S saves; while saving, fields and Delete are disabled and the status button is not; failed save is `error` with edits kept and fields enabled |
| S8 beforeunload | pass | Wired by `save-state.js`; not exercised in the browser (headless cannot show the prompt) |
| S9 leave with unsaved changes | pass | Nav link, Back button, and Log out open "Discard unsaved changes?"; the URL stays on the item; Cancel keeps edits; Discard navigates |
| A1–A4 autosave | pass | Background save sent `update` with status draft; ended `clean`; only for drafts |
| V1–V7 validation | pass | Draft with empty date saves (V3); publish blocked (V4); create needs title, "Required." (V6); empty site title blocks the settings save, "Fix 1 field to save" (V7) |
| D1–D6 dialogs | pass | Create dialog focuses the title; Delete confirm focuses Cancel (negative); Escape cancels. Tab trap, backdrop, and focus return come from `dialogs.js` unchanged |
| K1, K3, K4, K6, K7 keyboard | pass | Cmd+S saves; `/` focuses search; Enter submits the create dialog; the skip link focuses `#pn-main` and keeps `#/post`; Enter in the title field sent no update and did not reload |
| K5 every action reachable with Tab, with a focus ring | needs the person | Tab order starts at the skip link and every action is a native button or link styled by `components.css`, but axe was not run (not installed, and installing is out of bounds). Run axe, or `npm run test:behavior` in the Panel repository |
| C1–C6 create flow | pass | Asks title and slug; slug follows the title ("hello-world"); Create runs V6; new item in draft opens; Escape creates nothing |
| P1–P5 status | pass | Button shows "Draft"/"Published" with tones neutral/positive; two statuses toggle; V4 runs first; confirm before publishing; status saves with unsaved edits; toasts "Post published", "Post moved to draft" |
| F1 tags | pass | Comma and Enter add; duplicate "a" ignored; Backspace removes the last |
| F2 image | pass | Upload sets `data-state="filled"` and shows the thumbnail after a reload (real server) |
| F3 markdown toolbar | pass | Bold wraps the selection and counts as an edit |
| F4 computed custom field | pass | Reading time is read-only, shows "1 min", and is saved as `reading_time: 1` |
| Load errors, missing item, not found, empty | pass | "Could not load posts" with Try again (which reloads without leaking dialogs); "This post doesn't exist" with title "Not found"; "This page doesn't exist" with no current nav entry; "No posts yet" with a "New post" button that opens the create dialog |
| 400 px wide | pass | `scrollWidth` 400 on home, collection, item, settings |
| Light and dark | pass | Layout background follows `prefers-color-scheme` (light `rgb(240,240,240)`, dark `rgb(31,31,31)`) |
| Signed out on load shows login | pass | No cookie: "Sign in · Field Notes", "Sign in to edit the site.", Google's button rendered |
| Signed out on save | pass | Save that throws `unauthorized` enters `error`, keeps edits, toast "You were signed out. Copy your edits, then reload to sign in." |
| `allow` list kept out of the browser | pass | `allow.mjs` at the project root, outside the served `panel/` folder; `panel.config.js` has no `allow` |
| Server: `x-panel`, unknown fields and statuses, allow list | pass | Write without `x-panel` is 403; unknown field and status are 400 `invalid`; a signed cookie for an address not on `allow` is 403 |
| Server: private files | pass | `CONFORMANCE.md` and `../allow.mjs` are 404 |
| json-files: create, refresh, file on disk, delete | pass | Created in the browser, reloaded, values back; `content/post/<id>.json` reads like the item; DELETE removed the file |
| json-files: stop the server, then save | pass | Save bar `error`, "Could not save. Your changes are kept.", edits kept; file on disk unchanged and valid JSON. The server was stopped just before the save, not during the write |
| json-files: edit, save, `git diff` shows only the change | needs the person | Git was out of bounds for this run. Edit a post, save, and run `git diff content/` |
| json-files: content folder in version control | needs the person | Assumed yes (recipe default), recorded in `panel.intake.yaml` |
| local-disk: upload, reload, open URL, unsafe name | pass | Stored as `uploads/2026/11/<hex>-evil-cover.png` from `../../evil cover.png`; served as `image/png` with `nosniff` and a sandboxing CSP; HTML upload refused |
| local-disk: uploads in git | needs the person | Assumed no (recipe default): `uploads/` is in `.gitignore`, recorded in `panel.intake.yaml` |
| google-login hand checklist | needs the person | Set `GOOGLE_CLIENT_ID` and `SESSION_SECRET` (32+ characters) in the environment, add `http://localhost:4810` (and the live origin) to the OAuth client's JavaScript origins, run `node start.mjs`, then tick every box in `recipes/google-login.md` section 5: sign in with `me@example.com`, sign in with an address not on the list, check the `pn_session` cookie flags, create and refresh, log out, remove your address and reload |
| Host profile | not applicable | New panel, no host (`stack: none`) |
