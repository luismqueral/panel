# Run 1 report

Final reply of the session, in substance.

## Result

Built in `run-1/`. Copied files byte-identical. `index.html` generated from the template files: 23 templates and the sprite. Checked with headless Chrome over CDP, in `?test` and once against the real json-files and local-disk recipes with a self-signed session. Pass: default checks 1–8, the cover rule, all 4 behavior lines, fidelity on 10 states at 1280px and at 400px dark, spec rules S, V, D, K, C, P, F (S8 and A2–A4 read, not driven), server refusals (401, 403, 400, 404; uploads with `nosniff` and sandbox CSP). Raised: axe (K5) not available without installing; google-login checklist needs a real client; json-files `git diff` and mid-save stop not done. Open: `content/` and `uploads/` in git; where the public site serves uploads.

## Unclear, contradictory, or missing

- S3 says Delete stays enabled while saving; Delete is inside the form and `save-state.js` disables all `form.elements`. Re-enabled in the save callback.
- `build.md` says one `adapters/<recipe>.js` per recipe; the recipes say copy `http.js` and `auth.js`.
- `auth.js` calls `GET /api/config`, missing from the route list in `contracts.md` (the server has it).
- `fields.js` reads `field.compute`; `build.md` step 2 never names the key.
- Slide-over body: `templates/README.md` says field templates or a `pn-list`; `build.md` step 4 says `fieldset.pn-choices`.
- Singular forms for "N words" and "Fix N fields to publish".
- Crumbs for a loading, missing, or failed item; login page title.
- Whether Posts is current in the nav on `#/post/<id>`.
- No copy for a failed logout; whether logout with unsaved edits asks first.
- What the panel shows when `session()` throws `unavailable`.
- When home's `empty` region is used.
- The `allow` list is in `panel.config.js`, which the server serves publicly.
- "Ask" steps and the google-login checklist can't complete unattended, while `build.md` step 8 says never skip.
- `build.md` step 8 says run `npm run test:behavior` in this repository, which this run forbade.

## Guesses

Port 4810, host 127.0.0.1; Posts current on items; crumbs "Loading…", "Not found", "Post"; save bar only once ready; header title follows typing; publish validation on any move past the first status, confirm only when leaving the first; positive tone for "Post published"; singulars; invented log-out failure copy; logout with edits asks S9; cancelled discard restores the hash with `history.replaceState`; focus to `#pn-main` after a route change; edits stashed by route on `unauthorized`; `session()` failure shows "Could not load the panel"; create sends title and slug only; `x-priority` ignored; `sources: ["body"]`; `wordCount`, `confirmPublish` keys; published seed posts get `data:` SVG covers.
