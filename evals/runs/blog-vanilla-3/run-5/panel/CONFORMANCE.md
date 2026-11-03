# Conformance: Field Notes

Walked by hand (not in the Panel repository's test runner): a headless Chrome session against `?test`, plus requests to the real project server (`start.mjs`) with a session cookie minted from `server/session.mjs`. "Driven" means the rule was exercised in the browser; "code walk" means it was checked by reading the code.

| Check | Result | Evidence |
| --- | --- | --- |
| Every type has a collection view, an item view, and a create flow | pass | `#/post`, `#/post/<id>`, "New post" dialog (driven) |
| Every singleton has an item view | pass | `#/settings` (driven) |
| Every field appears in its item view with its declared type, width, and required rule | pass | Item shows title:1/1, slug:1/2, date:1/2, cover:1/2, tags:1/2, body:1/1, reading_time:1/1; `data-required` true for title, date, body; settings shows site_title (required), description (driven) |
| Every `list.title`, `subtitle`, `sort`, and `search` entry names a real field | pass | title, date, -date, [title] are all post fields; `node tools/validate.mjs` reports valid |
| Every adapter resolves to a recipe in `recipes/index.json` | pass | google-login, json-files, local-disk |
| Every behavior line is implemented: "Autosave drafts every 10 seconds" | pass | `panel.config.js` `autosave`; a dirty draft saved in the background within 10 s and returned to `clean` (driven) |
| Every behavior line is implemented: "Show word count under the body field" | pass | `showWordCount` in `panel.js`; body help reads "13 words", then "450 words" while typing (driven) |
| Every behavior line is implemented: "Publishing asks for confirmation" | pass | `confirmPublish`; "Publish this post?" / "It will be visible on the site." / "Published"; Escape cancels, status unchanged (driven) |
| Field behavior: "Toolbar hidden until text is selected." | pass | `toolbarOnSelection: true`; toolbar hidden on load, shown on selection (driven) |
| Custom field `reading_time` (describe: read-only minutes to read from body) | pass | `COMPUTED.readingTime`, `max(1, ceil(words / 200))`, shown "1 min", "3 min" at 450 words, saved as a number (driven, F4) |
| No core key appears that the schema guide does not define | pass | `panel.yaml` unchanged from the approved schema; validator reports valid |
| Template fidelity on every screen | pass | Slots blanked and compared to the inlined templates on home, collection with create dialog, item (dirty, errors, confirm open), item with tags and image, singleton, not found, missing item, empty collection, load error, login: 0 mismatches |
| Publishing a post requires a cover image. | pass | `publishRequires: ["cover"]`; publishing without a cover shows "Required to publish." on cover and "Fix 2 fields to publish"; cover label keeps `data-required="false"` (driven) |
| Save state S1–S7 | pass | clean on load, dirty on edit, Revert, Cmd+S enters `saving` and disables fields and Delete but not the status button, `conflict` message, edits kept (driven) |
| Save state S8 (`beforeunload`) | pass | code walk: `save-state.js` registers it, copied verbatim |
| Save state S9 | pass | Link, typed hash, and back button open "Discard unsaved changes?"; URL returns; Cancel keeps edits; Discard leaves (driven). Logout asks the same way (code walk) |
| Autosave A1–A4 | pass | A1, A3 driven; A2, A4 code walk (`save-state.js` background path) |
| Validation V1–V8 | pass | Slug format on blur, blank required not an error on blur, draft saves with empty title, publish blocked with focus on first, V5 clears, create "Required.", singleton "Fix 1 field to save", published item blocked by empty body (driven) |
| Dialogs D1–D6 | pass | D1, D3, D5 driven (focus to first field, to confirm, to Cancel on negative; Escape; focus returns); D2, D4, D6 code walk (`dialogs.js`, native `<dialog>`) |
| Keyboard K1–K7 | pass | K1, K3, K4, K6, K7 driven; K2 driven with D3 |
| K5: every Tab stop shows a focus ring | pass | Tabbed home (11 stops), collection (13), item (22), settings (9). Tags show the ring on `.pn-tags-input` (focus-within); the date input's calendar button shows Chrome's ring (screenshot checked) |
| Create flow C1–C6 | pass | C1–C4 driven (title and slug only, slug follows title, Enter creates a draft and opens it); C5, C6 code walk (`create-flow.js`) |
| Status P1–P5 | pass | Button shows "Draft"/"Published" with tones; checks before publish; confirm; saves with edits; toasts "Post published" and "Post moved to draft" (driven) |
| Field controls F1–F4 | pass | Tags Enter, comma, duplicate, Backspace, remove-and-refocus; image upload fills; markdown bold wraps (driven). F2 "too large" message code walk |
| Screens: not found, missing item, load errors, empty collection, search with no matches | pass | Copy as `build.md` step 7; retry reruns the route; not-found "Try again" goes to `#/` (driven) |
| Load that throws `unauthorized` shows `screen-login`; save that throws it keeps edits and toasts | pass | driven |
| `auth.session()` throws: login reads "Could not reach the panel…" with no methods | pass | code walk (`showLogin({ unreachable: true })`); the memory adapter cannot make `session()` throw |
| 400px wide, no sideways scroll | pass | scrollWidth 400 on all ten screens above |
| Light and dark | pass | `prefers-color-scheme: dark` switches layout and input colors (tokens.css, verbatim) |
| axe on every screen | needs the person | axe was not available in this run. Run axe on each screen above |
| Copied files are verbatim | pass | `cmp` against `design-system/`, `snippets/`, `recipes/client/`, `recipes/server/`: identical |
| Allow list stays off the browser | pass | `allow.mjs` at the project root, outside the served `panel/` folder; `CONFORMANCE.md` returns 404 from the server |
| Server contract: auth, `x-panel`, unknown fields, uploads | pass | `/api/session` 401 without cookie; address off the list gets 403 `forbidden`; write without `x-panel` 403; unknown field 400 `invalid`; HTML upload refused; upload stored as `<random>-my-cover.png`, served as `image/png` with `nosniff` and a sandboxing CSP; `/uploads/../` 404 |
| json-files: create, file on disk, singleton, delete | pass | `content/post/<id>.json` matches the item; `content/settings.json` written; DELETE removes the file. Trial data removed afterwards |
| json-files "Ask": commit content to git? | needs the person | Unattended default taken: yes. Recorded in `panel.intake.yaml` `open_questions` (`assumed: true`). Confirm or change it |
| local-disk "Ask": commit uploads to git? | needs the person | Unattended default taken: no; `uploads/` added to `.gitignore`. Recorded in `panel.intake.yaml`. Confirm or change it |
| google-login hand checklist, with real Google credentials | needs the person | Set `GOOGLE_CLIENT_ID` and `SESSION_SECRET` in the environment, run `node start.mjs`, then tick every box in `recipes/google-login.md` section 5 (sign in on and off the list, cookie flags, refresh, logout 401, removal from `allow`). Only verified here: the login screen renders Google's button |
| json-files hand checklist: `git diff` after an edit; stop the server mid-save | needs the person | Needs git and a real session in the browser. Create-and-refresh and file-on-disk were checked through the API |
| local-disk hand checklist: upload through the image field and reload | needs the person | Needs a real session in the browser. Storage, naming, serving, and `../` refusal were checked through the API |
| Deploying | needs the person | The server binds `127.0.0.1:4810` by default. To deploy: set `HOST`, add the origin to the Google client's Authorized JavaScript origins, serve over HTTPS, and send `X-Forwarded-Proto: https` from any TLS proxy |
