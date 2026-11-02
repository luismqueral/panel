# Conformance: Field Notes

Walked by hand in headless Chrome against `?test` (memory adapters) and against `start.mjs` (json-files, local-disk, google-login with a session cookie signed by the server's own secret standing in for a Google sign-in). `npm run test:behavior` and `tools/lib/fidelity.js` were not run (this build was made "elsewhere"); the fidelity rows use a hand-written slot-stripping comparison of the live DOM against the inlined templates.

| Check | Result | Evidence |
| --- | --- | --- |
| 1. Every type has a collection view, an item view, and a create flow | pass | `#/post`, `#/post/<id>`, "New post" dialog (header button and empty-state button) |
| 2. Every singleton has an item view | pass | `#/settings` renders `screen-singleton` with a save bar |
| 3. Every field appears in its item view with its declared type, width, and required rule | pass | post: title text 1/1 required; slug slug 1/2 `data-from="title"`; date date 1/2 required; cover image 1/2; tags tags 1/2; body markdown 1/1 required; reading_time custom 1/1. settings: site_title text 1/1 required; description textarea 1/1. `data-required` and `aria-required` match |
| 4. Every `list.title`, `subtitle`, `sort`, and `search` entry names a real field | pass | title, date, -date, [title] all in post's fields; `node tools/validate.mjs panel.yaml`: valid |
| 5. Every adapter resolves to a recipe in `recipes/index.json` | pass | google-login, json-files, local-disk |
| 6. Behavior: "Autosave drafts every 10 seconds" | pass | `panel.config.js` `autosave`; a dirty draft saved in the background after 10 s with fields enabled; a dirty published post did not autosave; failed autosave entered `error` without disabling fields |
| 6. Behavior: "Show word count under the body field" | pass | `buildForm` writes "N words" into `#post-body-help` on load, input, and revert ("3 words") |
| 6. Behavior: "Publishing asks for confirmation" | pass | `confirmPublish`; draft → published opens "Publish this post?" / "It will be visible on the site." / "Published" |
| 6. Behavior (body): "Toolbar hidden until text is selected." | pass | `toolbarOnSelection: true`; toolbar `hidden` until a selection, then Bold wraps it (`**hello** world`) |
| 7. No core key appears that the guide does not define | pass | Schema copied unchanged; validator: valid. Only `x-priority` (an `x-` key) beyond core keys |
| 8. The pages pass the template fidelity check | pass | All 23 inlined templates byte-identical to `templates/`; slot-stripped live DOM matched its source on home, collection (ready, empty, error, create dialog open), item (draft with publish errors, published with image, saving, confirm open, missing), not found, singleton (dirty), login |
| Project: Publishing a post requires a cover image. | pass | `publishRequires: ["cover"]`; publishing a post without a cover shows "Required to publish." under Cover, status stays Draft. Cover keeps `data-required="false"` |
| Behavior spec S1–S9 (save state) | pass | Loaded item `clean`; edit → `dirty`, undo → `clean`; Save and Ctrl+S → `saving` with fields disabled and status and Delete enabled; failure → "Could not save. Your changes are kept." with edits kept; Revert restores; nav link while dirty → "Discard unsaved changes?", Cancel keeps edits; `beforeunload` from `save-state.js` |
| Behavior spec A1–A4 (autosave) | pass | See behavior row above |
| Behavior spec V1–V6 (validation) | pass | No error while typing; slug format error on blur, cleared when fixed; drafts with empty required fields save; publish shows every error, focuses the first, save bar "Fix 2 fields to publish"; create dialog Enter with empty title → "Required." |
| Behavior spec D1–D6 (dialogs) | pass | `showModal`; create dialog focuses title; Delete confirm focuses Cancel; Tab cycles inside; Escape cancels; backdrop click does nothing; focus returns to the opener |
| Behavior spec K1–K6 (keyboard) | pass | Ctrl+S saves; `/` focuses `#pn-search`; Enter submits create; skip link moves focus to `#pn-main` without re-rendering (`#pn-main` is not a route) |
| Behavior spec C1–C6 (create flow) | pass | Dialog asks for title and slug; slug follows title ("a-new-trail") until edited; created in `draft`, item view opens; `fail("create")` path shows "Could not create. Try again." |
| Behavior spec P1–P5 (status) | pass | Button shows "Draft"/"Published" with tone; two statuses toggle; V4 runs first; confirm before publishing; status saves with pending edits (`update:published`); toasts "Post published", "Post moved to draft" |
| Behavior spec section 7 (test page) | pass | `?test` loads `seed.json` into `createMemoryAdapters`; `window.panelTest` exposes adapter, fail, delay, calls, reset |
| Behavior spec F1–F4 (field controls) | pass | Tags: comma/Enter add, duplicates ignored, Backspace removes last; image upload sets `filled`, served from `/uploads`; markdown toolbar wraps; reading_time read-only, updates with body, saved as a number |
| 400px wide, no sideways scroll | pass | `scrollWidth` 400 on home, collection, item, singleton |
| Light and dark | pass | Tokens switch under `prefers-color-scheme: dark` (layout background rgb(20, 21, 23)) |
| axe on every screen | not run | No axe available without installing a package. Raised: run `npm run test:behavior` in the repository |
| Host profile | n/a | New standalone project (`intake: mount: standalone`) |
| json-files checklist: create, refresh, still there | pass | Created "Real post" through the server, reloaded, every value back |
| json-files checklist: `content/<type>/<id>.json` reads like the item | pass | `content/post/9bf16065c8.json` matched the item |
| json-files checklist: `git diff` shows only the change | not run | Git was out of bounds for this run. Raised |
| json-files checklist: delete removes the file | pass | `DELETE /api/items/post/<id>` → 204, file gone |
| json-files checklist: server stopped mid-save | pass | Save with the server down → save bar error, edits kept, file on disk unchanged |
| json-files step 4: content folder in git or `.gitignore` | raised | Needs the person's answer; no `.gitignore` written |
| local-disk checklist: upload shows, file on disk, survives reload, URL loads as image | pass | `/uploads/2026/11/ae622446-evil-cover.png`, `image/png`, `nosniff`, sandbox CSP |
| local-disk checklist: `../../evil.html`-style name | pass | `../../evil cover.png` stored as `<hex>-evil-cover.png`; `../` ids → 404 |
| local-disk step 6: uploads in git | raised | Needs the person's answer |
| google-login: env vars not in the repo | pass | `start.mjs` reads `GOOGLE_CLIENT_ID` and `SESSION_SECRET` from the environment only; refuses to start without them |
| google-login: login screen shows Google's button | raised | Login screen, title, and text verified; Google's button needs a real client ID and network |
| google-login: allowed address opens Home with account in nav | partial | Verified with a server-signed cookie (`me@example.com` shows in nav). A real Google sign-in is still to tick |
| google-login: address not on `allow` is refused | partial | Cookie for `stranger@example.com` → login screen. The "This account isn't allowed" message after a real Google sign-in is still to tick |
| google-login: `pn_session` cookie flags, nothing in `localStorage` | partial | `session.mjs` issues `HttpOnly; SameSite=Lax` (`Secure` behind HTTPS); panel stores nothing. Still to inspect in dev tools after a real sign-in |
| google-login: log out → login screen, `GET /api/session` 401 | partial | Log out wired to `DELETE /api/session`; unsigned `GET /api/session` → 401 verified. Real round trip still to tick |
| google-login: remove address from `allow`, restart, signed out | partial | Server checks `isAllowed` on every request; still to tick with a real account |
| Session ends mid-use | partial | Cookie cleared, Save → `screen-login` verified. Edits are kept because the layout is detached, not destroyed; the return after a real sign-in was not exercised |
