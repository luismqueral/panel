# Run 2 report

Final reply of the session, in substance.

## Result

Built in `run-2/`. Copied files byte-identical (`cmp`). Checked in headless Chromium with the repo's Playwright: default checks 1–8 and the cover rule pass; spec rules S, A, V, D, K, C, P, F hold except the too-large message; own fidelity check passes on every screen and state; 400px and axe clean in light and dark. Real server path works end to end (create, upload with a hostile name stored safely, publish, reload, delete, log out, 403 for a non-allowed address). `index.html` inlines the sprite and 23 templates.

Raised: too-large upload message (from `fields.js`); forbidden session on load shows plain login without "This account isn't allowed." (from `auth.js`); google-login checklist needs real credentials; two json-files hand checks not run; whether `content/` and `uploads/` go in git.

## Unclear, contradictory, or missing

- `build.md` says one `adapters/<recipe>.js` per recipe; the recipes say copy `http.js` and `auth.js`.
- `behavior-spec.md` S3 says Delete stays enabled; `save-state.js` disables the whole form, Delete is inside it. Re-enabled in `panel.js`.
- `recipes/contracts.md` error messages disagree with `fields.js` (too-large) and `auth.js` `session()` (forbidden).
- `google-login.md` §5 and the recipes' "Ask" steps have no path for unattended runs.
- `build.md` step 2 doesn't name `compute`, or say `ctx.values` must exclude the custom field (else infinite recursion).
- Singular forms for "Fix N fields" and "N words".
- Missing copy: singleton load error, missing-item title and crumbs, login title, `session()` failure at start, log-out failure, current nav on items, search with no matches, when home `empty` is used, toast tones, blank-value sort order.
- §6 "past the first" status: any non-first, or only forward moves?
- Validation stays in publish mode after a successful publish; unspecified.
- `start.mjs`: no default port or host; Node needs `"type": "module"` or 22+; the server serves all of `panel/` publicly, including the allow list, `seed.json`, and `CONFORMANCE.md`.
- Whether to inline unused templates (`screen-slide-over` with two statuses). Inlined it.

## Guesses

Singulars; crumbs Home / Not found and Home / Posts / Not found; login title "Field Notes"; start-up failure and singleton error copy; log-out failure toast; not-found `data-action="retry"`; Posts current on items; no-match search shows zero rows; blanks sort last; recent lists items only; positive tone for forward moves; any non-first status is publishing; log out with edits asks to discard; panel hidden, not removed, when the session ends; `history.replaceState` on cancelled discard; reading time in minutes; config keys `wordCount`, `confirmPublish`, `toolbarOnSelection`, `compute: "readingTime"`; empty-state button `data-action="create"`.
