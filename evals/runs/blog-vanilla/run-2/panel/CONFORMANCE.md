# Conformance: Field Notes

Walked by hand (not in the Panel repository's test runner), against `panel.yaml` validated with `node tools/validate.mjs` (valid). Behavior was driven in a headless browser at `?test` (memory adapters, `seed.json`) and against the real server (`start.mjs`, json-files and local-disk, with a session cookie minted by `server/session.mjs`). Google's own sign-in could not be exercised here.

| Check | Result | Evidence |
| --- | --- | --- |
| 1. Every type has a collection view, an item view, and a create flow | pass | `#/post`, `#/post/<id>`, "New post" dialog (title + slug) |
| 2. Every singleton has an item view | pass | `#/settings` (`screen-singleton`) |
| 3. Every field appears in its item view with its declared type, width, and required rule | pass | Post: title text 1/1 required; slug 1/2; date 1/2 required; cover image 1/2; tags 1/2; body markdown 1/1 required; reading_time custom 1/1. Settings: site_title text 1/1 required; description textarea 1/1. Checked from `data-field`, `data-width`, `data-required` in the DOM |
| 4. Every `list.title`, `subtitle`, `sort`, and `search` entry names a real field | pass | title, date, -date, [title] all exist on `post` |
| 5. Every adapter resolves to a recipe in `recipes/index.json` | pass | google-login (auth), json-files (data), local-disk (files) |
| 6. Behavior: "Autosave drafts every 10 seconds" | pass | `panel.config.js` `autosave`; `createSaveState({ autosave: { every: 10000, when: status === "draft" } })`; observed one background `update` after 10 s on a dirty draft, fields never disabled |
| 6. Behavior: "Show word count under the body field" | pass | `panel.js` `buildForm` writes "N words" into the body's `help` slot on every input and on revert ("450 words") |
| 6. Behavior: "Publishing asks for confirmation" | pass | "Publish this post?" · "It will be visible on the site." · "Published"; Escape cancels and the status stays Draft |
| 6. Behavior (body): "Toolbar hidden until text is selected." | pass | `toolbarOnSelection: true`; toolbar `hidden` until a selection exists |
| 7. No core key appears that the guide does not define | pass | Only `panel`, `name`, `auth`, `data`, `files`, `types`, `singletons`, `conformance`; `x-priority` is an `x-` key |
| 8. Template fidelity on every screen | pass | Stripped-slot comparison against the inlined templates, including repeat units, on home, collection, create dialog with errors, item (filled image, publish errors, tags), confirm dialogs, singleton, not found, missing item, load error, empty, login: all templates match. `index.html` was generated from the template files, not retyped |
| Publishing a post requires a cover image. | pass | `publishRequires: ["cover"]`; publishing without a cover shows "Required to publish." on Cover, focuses it, save bar "Fix 1 field to publish", status unchanged |
| Behavior spec 1, save state S1–S9, A1–A4 | pass | clean on load; dirty and back to clean; Ctrl/Cmd+S saves; failed save keeps edits in `error`; Revert; Delete and the status button stay enabled while saving; `beforeunload` via `save-state.js`; "Discard unsaved changes?" on navigation, Cancel keeps edits |
| Behavior spec 2, validation V1–V6 | pass | Slug format error on blur, not while typing; draft with empty required fields saves; slug error blocks save; errors clear when valid; create needs a title ("Required.") |
| Behavior spec 3, dialogs D1–D6 | pass | `showModal`; focus to the first field, to Cancel for negative confirms, to the confirm button otherwise; Tab cycles; Escape cancels; backdrop click does nothing; focus returns to the opener |
| Behavior spec 4, keyboard K1–K6 | pass | Cmd/Ctrl+S; Escape; `/` focuses search; Enter submits create; axe clean; skip link focuses `#pn-main` without changing the screen |
| Behavior spec 5, create flow C1–C6 | pass | Title + slug only; slug follows title until edited; failure keeps the dialog and toasts "Could not create. Try again."; success creates a draft and opens it |
| Behavior spec 6, status P1–P5 | pass | Button shows "Draft"/"Published" with tone; two statuses toggle; V4 before publishing; confirm; status saves with pending edits ("Post published", "Post moved to draft") |
| Behavior spec 7, test hook | pass | `window.panelTest` from `adapters/memory.js` at `?test` |
| Behavior spec 8, F1, F3, F4 | pass | Tags add on Enter/comma/blur, ignore duplicates, Backspace removes the last; toolbar wraps `**bold**`; reading time is read-only, updates with body, and is saved ("3 min" for 450 words) |
| Behavior spec 8, F2 | pass | Upload sets `filled`, remove sets `empty`, failure shows "Could not upload. Try again." |
| Contract: "too-large" shows "That file is too large." | **raised** | `snippets/fields.js` shows "Could not upload. Try again." for every upload failure. The snippet is copied verbatim and may not be edited; the snippet and `recipes/contracts.md` disagree |
| Contract: `forbidden` shows "This account isn't allowed. Sign in with another one." | **raised** | Shown when Google sign-in is refused and when a data call returns 403. On page load, `adapters/auth.js` `session()` turns 403 into "no one signed in", so a stale session for a removed address shows the plain login screen. Verbatim recipe code |
| 400px wide, light and dark | pass | No sideways scroll on every screen at 400px; axe reports no violations in light or dark |
| google-login automated checks | pass | Recipe server code copied verbatim; observed: 401 unsigned, 403 without `x-panel`, 403 for an address not on `allow`, 401 after logout |
| google-login manual checklist | **raised** | Needs a real `GOOGLE_CLIENT_ID` and a person signing in. Not ticked: Google's button renders, allowed and refused sign-in, cookie flags in dev tools, removing the address from `allow`. The recipe says the panel is not done until every box is ticked |
| json-files checklist | pass, two items raised | Create + refresh persists; `content/post/<id>.json` and `content/settings.json` written; delete removes the file. Raised: "`git diff` shows only the change" (git not run here) and "stop the server mid-save" (not run; writes are atomic in `server/json-files.mjs`) |
| local-disk checklist | pass | Upload lands in `uploads/2026/11/<hex>-evil-cover.png` from `../../evil cover.png`; still shows after reload; served as `image/png` with `nosniff` and a sandboxing CSP |
| Open question: should `content/` be in version control? | **raised** | `recipes/json-files.md` step 4 says to ask. No one could be asked in this run |
| Open question: should `uploads/` be in git? | **raised** | `recipes/local-disk.md` step 6 says to ask |
