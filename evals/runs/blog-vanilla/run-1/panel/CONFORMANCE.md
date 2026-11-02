# Conformance: Field Notes

Walked by hand on 2026-11-02 against `panel.yaml` (validator: valid), in headless Chrome over the project server (`start.mjs`, `?test` for memory data, and once without `?test` against `json-files` and `local-disk`). "Driven" means exercised in the browser; "read" means checked in the code only.

| Check | Result | Evidence |
| --- | --- | --- |
| 1. Every type has a collection view, an item view, and a create flow | pass | `#/post`, `#/post/<id>`, "New post" dialog (title + slug), driven |
| 2. Every singleton has an item view | pass | `#/settings` (`screen-singleton`), save driven |
| 3. Every field appears in its item view with its declared type, width, and required rule | pass | Driven: `title` text 1/1 required, `slug` slug 1/2, `date` date 1/2 required, `cover` image 1/2, `tags` tags 1/2, `body` markdown 1/1 required, `reading_time` custom 1/1; `site_title` text required, `description` textarea |
| 4. Every `list.title`, `subtitle`, `sort`, and `search` entry names a real field | pass | `title`, `date`, `-date`, `[title]` are all fields of `post` |
| 5. Every adapter resolves to a recipe in `recipes/index.json` | pass | `google-login`, `json-files`, `local-disk` (all `verified`) |
| 6. Behavior: "Autosave drafts every 10 seconds" | pass | `panel.config.js` `autosave`; driven: a dirty draft saved in the background after 10 s (`update` call, save bar back to clean) |
| 6. Behavior: "Show word count under the body field" | pass | `behaviorWordCount` in `panel.js`; driven: help reads "13 words", then "3 words" after typing |
| 6. Behavior: "Publishing asks for confirmation" | pass | `confirmPublish`; driven: "Publish this post?" · "It will be visible on the site." · "Published"; Escape cancels and status stays Draft |
| 6. Behavior: "Toolbar hidden until text is selected." | pass | `toolbarOnSelection: true`; driven: toolbar `hidden` until a selection, then Bold wraps it |
| 7. No core key appears that the guide does not define | pass | Validator: valid; only `x-priority` beyond core keys |
| 8. Pages pass the template fidelity check | pass | All 23 inlined templates byte-equal the source files; rendered DOM compared to source (slots stripped, runtime attributes allowed) on home, collection, create dialog, item, confirm dialog, singleton, not found, missing item, empty collection, login: 0 problems at 1280px and 400px |
| Project: Publishing a post requires a cover image. | pass | `publishRequires: ["cover"]`; driven: publishing without a cover shows "Required to publish." on Cover and "Fix 2 fields to publish" (date also empty); status unchanged. Cover keeps `data-required="false"` |
| Behavior spec 1, save state (S1–S7, S9) | pass | Driven: clean on load; dirty and back to clean; Cmd+S enters saving and disables fields and remove-tag while status and Delete stay enabled; failed save keeps edits with Save and Revert enabled; Revert; S9 "Discard unsaved changes?" with Cancel keeping edits |
| Behavior spec 1, S8 and A2–A4 | pass (read) | `snippets/save-state.js` used unchanged; `beforeunload` and background-save paths not driven separately |
| Behavior spec 2, validation (V1–V6) | pass | Driven: slug format error on blur and cleared when valid; empty required date not an error on blur; save blocked only by the slug format error; publish shows every error and focuses the first; create requires the title ("Required.") |
| Behavior spec 3, dialogs (D1–D6) | pass | Driven: focus to first field, to Cancel for negative confirms, to the confirm button otherwise; Tab and Shift+Tab stay in the dialog; Escape cancels; backdrop click does nothing; focus returns to the opener |
| Behavior spec 4, keyboard (K1–K4, K6) | pass | Driven: Cmd+S saves; Escape; `/` focuses search; Enter submits the create dialog; skip link focuses `#pn-main` without changing the route |
| Behavior spec 4, K5 (visible focus ring, axe) | raised | Focus styles come from the design system unchanged, but axe was not run: it is not available here without installing a package |
| Behavior spec 5, create flow (C1–C6) | pass | Driven: title and slug only; slug follows the title; created as `draft`; item view opens; failure keeps the dialog and shows "Could not create. Try again."; Escape creates nothing |
| Behavior spec 6, status (P1–P5) | pass | Driven: button shows "Draft"/"Published" with tone; two statuses toggle; publish validation first; confirm; status saves with unsaved edits; toasts "Post published" and "Post moved to draft" |
| Behavior spec 7, test page | pass | `window.panelTest` from `adapters/memory.js` in `?test` only; `undefined` without it |
| Behavior spec 7, 400px and dark | pass | No sideways scroll on any screen at 400px in dark mode; dark tokens apply |
| Behavior spec 8, field controls (F1–F4) | pass | Driven: tags (Enter, comma, duplicate ignored, Backspace, remove returns focus); image upload sets `filled`; markdown Bold; reading time "1 min", saved as `1` |
| Contracts: unauthorized shows login | pass | Driven: session cookie cleared mid-use, Save returned to `screen-login` |
| Contracts: server checks | pass | Driven with curl: no session 401; address not on `allow` 403; write without `x-panel` 403; unknown field 400; HTML upload 400; `../` type 400; `/uploads/..%2F..` 404; uploads served with type, `nosniff`, sandbox CSP |
| Recipe json-files (by hand) | pass, one item raised | Driven: created item persisted as `content/post/<id>.json`, matched the item after reload; singleton persisted. Not done: `git diff` (no git in this run) and stopping the server mid-save (writes are temp file + rename, unchanged) |
| Recipe local-disk (by hand) | pass | Driven: upload stored as `uploads/2026/11/<hex>-my-cover-.png`, shown after reload, served as `image/png` |
| Recipe google-login (by hand) | raised | Login screen renders Google's button; a signed session cookie opened Home with the account in the nav; wrong address got 403. Not done, needs the person's Google client: a real Google sign-in, the "isn't allowed" message after a real sign-in, cookie flags in dev tools, logout followed by `GET /api/session` 401, and removing the address from `allow` |
| In an existing project, the build follows the host profile | n/a | New standalone project (`stack: none`) |

Open questions for the person:

- Should `content/` and `uploads/` be in git (json-files step 4, local-disk step 6)?
- Is the public site served by something other than this server? If so, where should `uploads/` be published (local-disk step 4)?
- Set `GOOGLE_CLIENT_ID` and `SESSION_SECRET`, add `http://localhost:4810` as an authorized JavaScript origin, then tick the google-login checklist.
