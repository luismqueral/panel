# Run 5 report

Final reply of the session, in substance.

## Result

Built in `run-5/`. Copied files byte-identical; `index.html` generated with the sprite and 23 templates. Tried in headless Chrome with the repo's Playwright. `?test`: every spec rule holds, including autosave timing; 400px and dark mode pass. Real server: create, upload, publish, reload, delete, save while the server is down, hostile upload name, 401 and 403 all behave. Own fidelity comparison passes on every screen and state. Found and fixed: Enter in "Site title" submitted the settings form natively and reloaded the page. Raised: Google button and checklist, `git diff`, axe, whether `content/` and `uploads/` go in git, re-sign-in recovery not exercised.

## Unclear, contradictory, or missing

1. `build.md` says write `adapters/<recipe>.js`; the recipes say copy `http.js` and `auth.js`.
2. S3 says Delete stays enabled; Delete is inside the form and `save-state.js` disables it.
3. `contracts.md` too-large message vs `fields.js` generic message.
4. Implicit form submit on Enter is handled nowhere.
5. `required` on singleton fields is never enforced: it blocks publishing, and singletons have no status.
6. `build.md` step 8 hand walk vs axe and the google-login checklist, impossible unattended.
7. "Ask" steps in `json-files.md` step 4 and `local-disk.md` step 6 have no intake round.
8. `compute` key and `ctx.computed` found only by reading `fields.js`.
9. Keeping edits on `unauthorized` mid-use has no mechanism described.
10. S9 with browser back: the hash has already changed; nothing says how to undo it.
11. Missing copy: item title and crumbs while loading or missing, current nav on items, login title, singulars, not-found `data-action`, toast tones, logout while dirty and its failure copy, empty values in sort, singletons in "Recently edited".

## Guesses

"Loading…" and "Not found" for title and crumb; type entry current on items; singulars; not-found `data-action="retry"` to `#/`; logout asks to discard, failure copy invented; login title "Sign in · Field Notes"; load-error h1 "Post"; dates only; default-tone success toasts; publish validation when the target isn't the first status, confirm only when leaving it; create sends title, slug, defaults; empty values sort last; case-insensitive substring search; recent lists posts only; `history.replaceState` then ask; layout detached on sign-out; port 4810; slide-over built but never opens.
