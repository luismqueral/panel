# Run 3 report

Final reply of the session, in substance.

## Result

Built in `run-3/`. Every copied file diffed clean against its source. Hand walk of default checks 1–8, the cover rule, the four behavior lines, and spec rules S, V, D, K, C, P, F: pass. 400px and dark mode: pass. Own structural fidelity check: no differences. Server: unknown fields and `../` ids refused, 403 without `x-panel`, safe upload names with `nosniff` and sandbox CSP. Real Google button renders without `?test`. `index.html` inlines the sprite and 23 templates. Raised: google-login manual checklist, whether `content/` and `uploads/` go in git, axe for K5.

## Unclear, contradictory, or missing

1. `behavior-spec.md` S3 says Delete stays enabled while saving; Delete is inside the `<form>` and `save-state.js` disables every form element. Re-enabled Delete in `panel.js`.
2. `fields.js` needs `field.compute` and `ctx.computed`; `build.md` steps 2 and 4 don't name the key.
3. `recipes/contracts.md` too-large message vs `fields.js` generic upload error.
4. `build.md` step 6 says write `adapters/<recipe>.js`; the recipes say copy `http.js` and `auth.js`.
5. `start.mjs`: only the auth block is given; port, host, static root, structure unspecified.
6. `json-files.md` says Node 18+, but importing ES-module `panel.config.js` with no `package.json` needs Node 22+.
7. Missing copy and states: singleton load error, crumbs while loading or missing, current nav entry on an item, login page title, `data-action` on not-found "Try again", singular forms, when home `empty` is used, what to show if `auth.session()` fails.
8. No guidance for cancelling a hash navigation (S9) or keeping edits when a session expires.
9. `SKILL.md` section 3 Conformance doesn't list `behavior-spec.md`; `build.md` step 8 and `templates/README.md` point to tools unavailable elsewhere.

## Guesses

Port 4810, host 127.0.0.1; no slide-over (two statuses); log out with unsaved edits asks to discard; session failure shows login with a load error; expired session keeps the screen in memory; "Could not load site settings"; Posts stays current on items; Home / Posts crumbs while loading; not-found button `data-action="retry"`; login title "Sign in · Field Notes"; singulars; negative-tone failure toasts; recent lists posts only; plain Save runs format checks; bare dates read as local; seed includes an untitled draft.
