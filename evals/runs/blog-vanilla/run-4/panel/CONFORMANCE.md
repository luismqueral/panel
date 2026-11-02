# Conformance: Field Notes

Walked by hand. The Node validator was run, and the panel was driven in a headless browser at `?test` against the memory adapters. The project's behavior test suite was not run.

| Check | Result | Evidence |
| --- | --- | --- |
| Every type has a collection view, an item view, and a create flow | pass | `#/post`, `#/post/<id>`, "New post" (header button and empty-state button) |
| Every singleton has an item view | pass | `#/settings` renders `screen-singleton` with Site title and Description |
| Every field appears in its item view with its declared type, width, and required rule | pass | `panel.config.js` `fields` copies each field; title text 1/1 required, slug 1/2, date 1/2 required, cover image 1/2, tags 1/2, body markdown 1/1 required, reading_time custom 1/1; site_title text required, description textarea. `data-width` and `data-required` come from these values |
| Every `list.title`, `subtitle`, `sort`, and `search` entry names a real field | pass | title, date, -date, [title] are all fields of `post`; `node tools/validate.mjs`: valid |
| Every adapter resolves to a recipe in `recipes/index.json` | pass | google-login, json-files, local-disk are all listed there |
| Every behavior line is implemented: "Autosave drafts every 10 seconds" | pass | `autosave` in `panel.config.js`; `createSaveState({ autosave: { every: 10000, when: status === "draft" } })`. A dirty draft saved in the background after about 10.0 s and returned to `clean` |
| Every behavior line is implemented: "Show word count under the body field" | pass | `wordCount` in config; `showWords()` writes "4 words" into `#post-body-help` on every input |
| Every behavior line is implemented: "Publishing asks for confirmation" | pass | `confirmPublish` in config; confirm dialog "Publish this post?" · "It will be visible on the site." · "Published" |
| Every behavior line is implemented: "Toolbar hidden until text is selected." | pass | `toolbarOnSelection: true` on body; the toolbar is `hidden` until a selection exists |
| No core key appears that the schema guide does not define | pass | validator: valid; `x-priority: low` is ignored |
| Publishing a post requires a cover image. | pass | `publishRequires: ["cover"]`. Publishing with no cover showed "Required to publish." on Cover, the save bar read "Fix 2 fields to publish", and the status stayed Draft. Cover keeps `data-required="false"` |
| Template fidelity on every screen | pass | Every `[data-template]` node on home, collection, item, singleton, not found, create dialog, confirm dialog, and login was stripped of slots and runtime state and then compared to its inlined template. Every one matched. Checked by a hand-written comparison, not `tools/lib/fidelity.js` |
| S1–S2 clean and dirty | pass | A loaded item showed "All changes saved". An edit made it `dirty` |
| S3 saving locks the form; status and Delete stay enabled | pass | During a delayed save, the title and the tag remove buttons were disabled, and Status and Delete were enabled (`MutationObserver` in `panel.js`) |
| S4–S5 save success and failure | pass | `panelTest.fail("update")` followed by Ctrl+S gave "Could not save. Your changes are kept." with the edits kept. A retry returned to `clean` |
| S6 revert | pass | `createSaveState` revert; `onRevert` also clears validation |
| S7 Cmd/Ctrl+S | pass | `installShortcuts` always calls `preventDefault`, and does nothing when the form is `clean` |
| S8 beforeunload | pass | The `save-state.js` listener, removed when the screen is torn down |
| S9 discard confirm on navigation | pass | Going to Home while `dirty` opened "Discard unsaved changes?" with focus on Cancel. Escape kept the screen and the edit |
| A1–A4 autosave | pass | Uses the snippet. It runs only for the first status (`when`), and does not run for published posts |
| V1–V3 format-only checks on blur and save | pass | `validation.js`; a draft with empty required fields saves |
| V4 publish validation | pass | Every invalid field showed an error, focus moved to the first one (date), and the message read "Fix N fields to publish" |
| V5 errors clear when valid | pass | Filling the date and uploading a cover cleared both errors |
| V6 create requires fields | pass | Enter on an empty title gave "Required." |
| D1–D6 dialogs | pass | Focus went to the first field in create, to Confirm in publish, and to Cancel in delete and discard. `showModal` is native, so the backdrop does nothing. Escape cancels |
| K1–K4, K6 keyboard | pass | Ctrl/Cmd+S saves. `/` focuses `#pn-search`. Enter creates. The skip link moved focus to `#pn-main` and the screen stayed the same |
| K5 focus ring and axe | not run | The design system supplies the focus styles, but axe was not run. Raise: run axe when the suite is available |
| C1–C6 create flow | pass | The dialog asks for Title and Slug only. The slug fills as "hello-world-again". The item is created as draft and its view opens. A failure shows the toast "Could not create. Try again." |
| P1–P5 status | pass | The button showed "Draft" (neutral), then "Published" (positive) with the toast "Post published". Moving back gave "Post moved to draft" with no confirm. Each change saves through S3–S5 |
| F1 tags | pass | Enter added "rail", and duplicates and blanks are ignored (snippet) |
| F2 image upload | pass | Upload set `data-state="filled"`. "Could not upload. Try again." is the snippet's message; a `too-large` error is rewritten to "That file is too large." |
| F3 markdown toolbar | pass | `fields.js` |
| F4 computed custom field | pass | reading_time is read-only, shows "1 min", and saves `1` in `values.reading_time` |
| 400px, light and dark | pass | `scrollWidth` was 400 on every screen. The layout background changes with `prefers-color-scheme` |
| json-files recipe | pass (automated part) | Writing directly to a temporary folder: create, update, list, and singletons worked. Unknown type, status, and field were refused as `invalid`, and `../x` as `not-found` |
| local-disk recipe | pass (automated part) | `../../evil name.png` was stored as `<hex>-evil-name.png`. `text/html` was refused, and `/uploads/../` returns nothing |
| google-login manual checklist | open | Needs a real `GOOGLE_CLIENT_ID` and a sign-in. Server side: no session gives 401, and a write without `x-panel` gives 403. Raise: the person ticks the recipe's 8 boxes |
| json-files and local-disk manual checklists | open | Need the real server signed in. Raise with the person, and ask whether `content/` and `uploads/` go in git |
