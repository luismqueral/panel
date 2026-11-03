# Conformance: Sunday Table

Walked by hand (this run is "elsewhere"), using a throwaway browser harness against `index.html?test` (the memory adapters and `seed.json`) and against the real server (`start.mjs` with test values for `PANEL_PASSWORD` and `SESSION_SECRET`, port 4812). The harness and the test content were deleted afterwards.

## Schema checks (`schema-guide.md` section 8)

| Check | Result | Evidence |
| --- | --- | --- |
| Every type has a collection view, an item view, and a create flow | pass | `#/recipe`, `#/recipe/<id>`, "New recipe"; `#/cook`, `#/cook/<id>`, "New cook" |
| Every singleton has an item view | pass | `#/about` (`screen-singleton`) |
| Every field appears in its item view with its declared type, width, and required rule | pass | Recipe: name text 1/1 required, photo image 1/1, serves/prep_time/cook_time number 1/3 with min/max, ingredients custom 1/1 required, steps textarea 1/1 required, cook relation 1/2, favorite toggle 1/2. Cook: name text required, photo image 1/3, bio textarea 2/3. About: title text required, body markdown. Checked as `data-field`, `data-width`, `data-required` on each field root |
| Every `list.title`, `subtitle`, `sort`, and `search` entry names a real field | pass | recipe: name, cook, name, [name]; cook: name, name, [name]. `node tools/validate.mjs` reports valid |
| Every adapter resolves to a recipe in `recipes/index.json` | pass | auth `password`, data `json-files`, files `local-disk` |
| Every `behavior` line is implemented and can be demonstrated | pass | The schema has no `behavior` lines |
| No core key appears that the guide does not define | pass | Validator: valid. The only additions are in `panel.config.js` (`singular`, `publishRequires`, `control: "ingredients"`), not in the schema |
| The pages pass the template fidelity check | pass | Every element with `data-template` compared with its source after blanking slots, on home, collection, create dialog, item (recipe and cook), slide-over, singleton, not found, load error, empty, login; and on all 25 playground screens |

There are no project checks (`conformance:` is absent).

## Build checks (`build.md` step 8)

| Check | Result | Evidence |
| --- | --- | --- |
| Template fidelity on every screen | pass | As above; 0 differences |
| 400px wide, light and dark, no sideways scroll | pass | Login, home, recipes, a recipe, cooks, about, both themes; and all 25 playground screens |
| K5 focus ring on every Tab stop | needs the person | `components.css` gives `.pn :focus-visible` a ring, which covers the layout, login, dialogs, and the custom ingredients inputs and button. A visual Tab walk through each screen was not done headless |
| axe | needs the person | axe could not run here. Run it on each screen |
| Host profile followed | n/a | New project, no host |

## Behavior spec (`behavior-spec.md`)

| Rule | Result | Evidence |
| --- | --- | --- |
| S1 loaded item is clean | pass | "All changes saved", Save and Revert disabled |
| S2 edit enters dirty, undoing it returns to clean | pass | serves 6 then blank |
| S3 save disables every control, status button stays enabled | pass | With a 200 ms delay: serves input, Delete, and "Add ingredient" disabled |
| S4 successful save is clean | pass | |
| S5 failed save keeps edits; conflict message | pass | `panelTest.fail("update")`, then `"conflict"`: "Changed elsewhere. Copy your edits, then reload." |
| S6 revert | pass | Restores values, including the ingredients rows |
| S7 Cmd+S / Ctrl+S never reaches the browser | pass | `installShortcuts` is installed once for every screen and always calls `preventDefault` |
| S8 beforeunload while dirty or error | pass | `createSaveState` (verbatim snippet) on every item and singleton |
| S9 discard confirm on navigation, URL kept, Cancel keeps edits | pass | Edited steps, went to `#/`: dialog "Discard unsaved changes?", URL stayed on the item, Cancel kept "Changed". Logout asks the same way (`logout()`) |
| A1–A4 autosave | n/a | No `behavior` line asks for autosave |
| V1 no error while typing an untouched field | pass | `createValidation` (verbatim) only checks on leave or after an attempt |
| V2 blur checks format only | pass | serves 500: "Must be between 1 and 100." |
| V3 first-status save blocked only by format | pass | "Fix 1 field to save" for serves 500; a new idea with empty ingredients and steps saved |
| V4 publish blocked by required; focus first; message | pass | Idea to testing with no ingredients or steps: "Fix 2 fields to publish", status stayed Idea, focus on `recipe-ingredients-input` |
| V5 aria-invalid and message, cleared when valid | pass | steps: "Required to publish.", cleared on input |
| V6 create requires the title | pass | Enter with empty name: "Required." |
| V7 singleton save blocked by required | pass | About with empty title: "Fix 1 field to save", "Required." |
| V8 saving past the first status runs publish checks | pass | Testing recipe with empty steps: "Fix 1 field to publish" |
| D1 focus on open | pass | Create: the name field. Discard (negative): Cancel. Slide-over: the checked status |
| D2 Tab cycles in dialog | pass | `openDialog` (verbatim) traps Tab |
| D3 Escape cancels | pass | Native `<dialog>` cancel; Delete confirm closed without deleting |
| D4 backdrop click does nothing | pass | No backdrop handler; native modal |
| D5 focus returns to opener | pass | `openDialog` with `opener` (status button, Delete, create button) |
| D6 confirm only through its button | pass | `confirmDialog` resolves `"confirm"` only from the confirm button |
| K1 Cmd+S saves | pass | Item and singleton |
| K2 Escape closes the top dialog | pass | Native `<dialog>` |
| K3 `/` focuses search | pass | |
| K4 Enter in the create field submits | pass | Created "Grandma's pierogi" with Enter |
| K6 skip link focuses main, route kept | pass | Hash stayed `#/recipe`, focus on `#pn-main` |
| K7 Enter in a form never saves | pass | Save bar stayed dirty |
| C1 create asks only for `list.title` | pass | Name only; no slug in this schema |
| C2 slug follows the title | n/a | No slug field |
| C3 Create runs V6 | pass | |
| C4 created in first status with defaults; item opens | pass | status idea, `favorite: false`, every field present, item view opened |
| C5 failure keeps the dialog and toasts | pass | `createFlow` (verbatim) `onError` shows "Could not create. Try again." |
| C6 Cancel creates nothing | pass | `method="dialog"` Cancel; no `create` call |
| P1 status button shows status; none without status | pass | Recipe shows "Idea" / "Testing"; cook's button `hidden` |
| P2 more than two statuses open a slide-over | pass | 4 radios: Idea, Testing, Ready, Retired |
| P3 publish runs V4 first | pass | See V4 |
| P4 publish confirmation only when a behavior line asks | n/a | No such line |
| P5 status change saves edits with it | pass | Ingredients and steps sent in the same `update` as `status: "testing"`; toast "Recipe testing" |
| Section 7 `window.panelTest` | pass | `fail`, `delay`, `calls`, `reset` used by the harness; `reset` re-renders the route |
| F1 tags | n/a | No tags field |
| F2 image upload, remove, errors | pass | Real server: upload filled the field, stored `{ url, name, size, type }`, survived reload, served as `image/png` with `nosniff`. Remove and error messages are the verbatim `fields.js` |
| F3 markdown toolbar | pass | About body uses verbatim `fields.js` markdown control |
| F4 computed custom fields | n/a | The ingredients custom field is an editable list, not computed |

## Recipe checklists

| Check | Result | Evidence |
| --- | --- | --- |
| password: password and `SESSION_SECRET` set in the environment, not in any file | needs the person | Nothing in the repo holds them; `panel.yaml` names `PANEL_PASSWORD` only. The person must set both on their computer before `node start.mjs` |
| password: login screen with the password field focused | pass | Real server |
| password: wrong password message, panel stays closed | pass | "That password isn't right. Try again.", field cleared. Empty: "Enter the password." |
| password: right password opens Home, nav shows `editor` | pass | |
| password: `pn_session` is `HttpOnly`, `SameSite=Lax`, `Secure` on HTTPS; nothing in `localStorage` | pass | `Set-Cookie: pn_session=…; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800` over HTTP; `localStorage` empty |
| password: logout returns login, `GET /api/session` is 401 | pass | |
| json-files: create, refresh, still there | pass | `content/recipe/<id>.json` written and reloaded |
| json-files: the file reads like the item | pass | `{ id, type, status, values, createdAt, updatedAt }`; unset relation stored as `null` |
| json-files: `git diff` shows only the change | needs the person | Git was off-limits in this run |
| json-files: delete removes the file | pass | Verbatim `json-files.mjs` `remove`; Delete flow checked in test mode |
| json-files: stop the server mid-save, old file kept | needs the person | Writes are temp-file-then-rename (verbatim); not exercised by hand |
| json-files: commit content to git? | needs the person | Default taken: yes (recorded in `panel.intake.yaml`). `content/` is not ignored |
| local-disk: upload shows and exists on disk; reload; URL loads as image | pass | `uploads/2026/11/<hex>-focaccia.png` |
| local-disk: `../../evil.*` name is made safe | pass | `../../evil.png` stored as `<hex>-evil.png`; HTML types are refused by the verbatim `local-disk.mjs` |
| local-disk: uploads in git? | needs the person | Default taken: no; `uploads/` is in `.gitignore` (recorded in `panel.intake.yaml`) |
| Server: unknown fields, statuses, and writes without `x-panel` refused | pass | 400 `unknown field`, 400 `bad status "published"`, 403 `missing x-panel header` |
| Server: `CONFORMANCE.md` is not served | pass | 404 |

## Raised with the person

- Status tone: `build.md` step 4 makes the last status `positive`, so **Retired** shows green and **Ready** shows the in-between `notice` tone. That follows the rule. If Ready should look like the "live" state, the statuses would need a different order or a new rule.
- Sort options: `list.sort` is `name`, which is also `list.title`, so "Title A–Z" would repeat "Name, ascending". The duplicate is left out.
- Cooks have no status, so they are never "published". Like a singleton (V7), saving a cook is blocked when its required name is empty ("Fix 1 field to save").
- Recipes keep the Delete button, which the item screen requires. "Retired" is how a recipe leaves the site while being kept.
- The ingredients editor is a `custom` field built from `pn-grid` and `pn-input`. Below 40rem the amount and ingredient boxes stack, one above the other.
