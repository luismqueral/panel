# Conformance: Field Notes

Walked by hand (not `npm run test:behavior`): a Playwright script drove `?test` mode against `start.mjs` on 127.0.0.1, plus curl against the real `/api` routes. Template fidelity was checked with a hand-written strip-and-compare that follows `templates/README.md` Rules 1–4, not with `tools/lib/fidelity.js`.

| Check | Result | Evidence |
| --- | --- | --- |
| 1. Every type has a collection view, an item view, and a create flow | pass | `#/post`, `#/post/<id>`, "New post" dialog (title + slug) opens the new item |
| 2. Every singleton has an item view | pass | `#/settings` loads, saves through `saveSingleton` |
| 3. Every field appears in its item view with its declared type, width, and required rule | pass | post: title text 1/1 required; slug slug 1/2; date date 1/2 required; cover image 1/2; tags tags 1/2; body markdown 1/1 required; reading_time custom 1/1. settings: site_title text 1/1 required; description textarea 1/1. `data-width` and `data-required` filled from `panel.config.js` |
| 4. Every `list.title`, `subtitle`, `sort`, and `search` entry names a real field | pass | title, date, -date, [title] are post fields; `node tools/validate.mjs` reports valid |
| 5. Every adapter resolves to a recipe in `recipes/index.json` | pass | google-login, json-files, local-disk (all verified) |
| 6. Behavior: "Autosave drafts every 10 seconds" | pass | `autosave: { every: 10000, drafts: true }`; a dirty draft saved in the background after 10 s and returned to clean |
| 6. Behavior: "Show word count under the body field" | pass | `wordCount: "body"`; help reads "3 words", "1 word" on input, load, and revert |
| 6. Behavior: "Publishing asks for confirmation" | pass | `confirmPublish: true`; "Publish this post?" · "It will be visible on the site." · "Published" |
| 6. Behavior (body): "Toolbar hidden until text is selected." | pass | `toolbarOnSelection: true`; toolbar `hidden` with no selection |
| 7. No core key appears that the guide does not define | pass | validator: valid; `x-priority` is an `x-` key and is ignored |
| 8. The pages pass the template fidelity check | pass | home, collection, empty, create dialog, item, confirm dialog, singleton, not found, error, login: 0 differences |
| Publishing a post requires a cover image. | pass | `publishRequires: ["cover"]`; publishing without one shows "Required to publish." on cover and "Fix 2 fields to publish"; status stays Draft. Cover keeps `data-required="false"` |
| Behavior spec 1: save state (S1–S9, A1–A4) | pass | clean on load; dirty/clean on edit and undo; Cmd+S saves; failed save keeps edits with "Could not save. Your changes are kept."; Revert; Enter never saves (K7); discard dialog on nav, URL held, Cancel keeps edits, Discard navigates |
| Behavior spec 2: validation (V1–V7) | pass | slug format on blur; "Fix 1 field to save" on a bad slug; publish errors with focus on the first; error clears when valid; create needs a title ("Required."); empty site title blocks the singleton save |
| Behavior spec 3: dialogs (D1–D6) | pass | `showModal`; focus to first field, or Cancel on negative confirms; Escape cancels; focus returns to the opener |
| Behavior spec 4: keyboard (K1–K7) | pass | Cmd+S; `/` focuses search; Enter submits create; skip link focuses `#pn-main` and keeps `#/post` |
| Behavior spec 5: create flow (C1–C6) | pass | only title + slug; slug follows title; created as draft with every field key; Escape creates nothing |
| Behavior spec 6: status (P1–P5) | pass | button shows Draft/neutral and Published/positive; two statuses toggle; publish validated, then confirmed, then saved with unsaved edits; toasts "Post published", "Post moved to draft" |
| Behavior spec 7: test page | pass | `window.panelTest` with `adapter`, `fail`, `delay`, `calls`, `reset`; `reset` re-renders without S9 |
| Behavior spec 8: field controls (F1–F4) | pass | tags by comma/Enter; image upload sets `filled`; toolbar buttons from `fields.js`; reading time is read-only, "1 min", saved as a number |
| Load and auth errors | pass | home load failure shows "Could not load the panel" with Try again that reruns; missing item "This post doesn't exist" with no button; not-found route; unauthorized load shows login; unauthorized save keeps edits and shows the signed-out toast |
| 400px, keyboard alone, light and dark | pass | no sideways scroll at 400px on the item (light and dark), the collection (light), and home (dark); axe: 0 violations on 10 screens in light and dark |
| Template and copied files verbatim | pass | `index.html` built from the template files byte for byte; styles, snippets, `adapters/`, `server/` match their sources (`cmp`) |
| Server: auth gate, `x-panel`, static allow-list | pass | `/api/session` and `/api/items/post` 401 unsigned; write without `x-panel` 403; `CONFORMANCE.md` and `../allow.mjs` 404 |
| json-files (automated part, by hand) | pass | create writes `content/post/<id>.json`; unknown field and status `invalid`; `../` id refused; singleton writes `content/settings.json`; delete removes the file |
| local-disk (automated part, by hand) | pass | `../../evil cover.png` stored as `2026/11/<hex>-evil-cover.png`; served `image/png` with `nosniff` and sandbox CSP; `text/html` upload refused |
| json-files step 4: content folder in version control | needs the person | Assumed yes (recorded in `panel.intake.yaml`). Confirm, then tick the recipe's hand checklist (`git diff` shows only the change; stop the server mid-save) |
| local-disk step 6: uploads in git | needs the person | Assumed no; `uploads/` is in `.gitignore` (recorded in `panel.intake.yaml`). Confirm, then tick the recipe's hand checklist |
| google-login hand checklist | needs the person | Create a Web OAuth client with `http://localhost:4810` as an origin; set `GOOGLE_CLIENT_ID` and a 32+ character `SESSION_SECRET` in the environment; run `node start.mjs`; tick every box in `recipes/google-login.md` section 5. The login screen rendered Google's button with a placeholder client ID |
