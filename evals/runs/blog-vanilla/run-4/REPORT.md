# Run 4 report

Final reply of the session, saved verbatim in substance.

## Result

Built in `run-4/`. Every conformance check runnable by hand passed. Open: the hand-run checklists for google-login, json-files, local-disk (need real Google credentials), and K5 (axe, not run). One rule slip: a first browser script was briefly written to the repo root, then deleted.

## Unclear, contradictory, or missing

- `build.md` "What you produce" asks for one `<recipe>.js` per recipe; `google-login.md` and `json-files.md` say to copy `http.js` and `auth.js`. Did both.
- `behavior-spec.md` S3 says Delete stays enabled while saving; `save-state.js` disables every control in the form, and Delete is inside the form in `templates/screens/item.html`. Worked around in `panel.js`.
- `recipes/contracts.md` says a `too-large` upload shows "That file is too large."; `fields.js` always shows "Could not upload. Try again.". Wrapped the upload call.
- `validation.js` cannot keep publish errors showing during a plain save after a failed publish (V5). Handled in `panel.js` with `check`.
- `build.md` step 2 shows `autosave: { drafts: true }`; step 5 shows `when:`.
- Nothing says how a computed custom field links to its compute function except a comment in `fields.js`.
- Missing: crumb and title while an item loads or is missing; login screen when `session()` fails; Save message when a format error blocks it; singular forms ("1 word", "Fix 1 field"); icon or variant for "Try again" and "New post"; the login page title.
- `start.mjs` imports an ES module `panel.config.js`; nothing says the project needs `"type": "module"`.
- `build.md` step 6 doesn't say what file values in `seed.json` should be.
- `build.md` step 8: no hand method for the fidelity or axe checks.

## Guesses

Copy for singulars, login errors, log-out error toast; crumbs Home / Posts while loading or missing; `#pn-main` on first load shows Home; cancelled discard restores the URL with `history.replaceState`; log out with unsaved edits asks to discard; undated posts sort last; the layout is kept in memory across sign-in so edits survive; `reset()` rebuilds the panel; no slide-over (two statuses); reading time saved as minutes, minimum 1; dates as "Oct 28, 2026"; "Try again" on not found has `data-action="retry"`.
