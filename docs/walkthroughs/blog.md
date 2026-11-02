# Walkthrough: the blog, new panel

A hand walk of `panel/SKILL.md` on the request "Build me an admin panel for my blog" in an empty folder. Each step names the file it loads and what it produces. Phase 5 exit check.

| # | Step | Router line | Loads | Produces | Result |
| --- | --- | --- | --- | --- | --- |
| 1 | Pick the mode | Section 1: no `panel.yaml` | `SKILL.md` | Mode: new panel | Named |
| 2 | Detect | Section 3, Intake | `intake.md` Rule 1 | Nothing found: `mode: new` | Named |
| 3 | Round 1 | `intake.md` Round 1 | (same file) | Vanilla, just me; chat: "a blog of long posts, plus site settings" | Named |
| 4 | Round 2 | `intake.md` Round 2, D-003 card | (same file) | `google-login`, `json-files`, `local-disk`, `via: server`, standalone | Named |
| 5 | Round 3 | `intake.md` Round 3 | (same file) | Both kinds; draft and published; chat: autosave, word count, confirm publish | Named |
| 6 | Round 4 | `intake.md` Rule 4 | (same file) | Skipped: new project | Named |
| 7 | Play back, record | `intake.md` Rule 6 | (same file) | `panel.intake.yaml` | Named |
| 8 | Interview | Section 3, Schema | `schema-guide.md`, `examples/blog/panel.yaml` | Questions not answered by intake only: fields, list, relations | Named |
| 9 | Draft, critique, validate | `schema-guide.md` sections 1–8, 10 | `panel.schema.json` | `panel.yaml` (the brief's blog) | Named |
| 10 | Preview | Section 3, Preview | `playground.md`, `templates/README.md` | `playground.html` | Named |
| 11 | Build | Section 3, Build | `build.md`, `templates/README.md`, `behavior-spec.md`, `recipes/contracts.md`, `recipes/google-login.md`, `recipes/json-files.md`, `recipes/local-disk.md` | `panel/` as `build.md` lists | Named |
| 12 | Conformance | Section 3, Conformance | `schema-guide.md` section 8, `build.md` step 8 | `panel/CONFORMANCE.md` | Named |

## Gaps found and fixed during the walk

- `build.md` did not exist; Build had nowhere to start. Written in Phase 5, with the reference build restructured to match it.
- Template filling and field controls lived only in the reference app, so a model would have rewritten them each time. Moved to `snippets/templates.js` and `snippets/fields.js`, and field-control rules added to `behavior-spec.md` section 8.
- The templates README fixed ids and status tones that the reference build did not follow. The reference now does.
- UI copy (empty states, confirms, toasts) was unspecified, so runs would differ in wording. `build.md` step 7 fixes it.

## Files the walk names that do not exist yet

`playground.md` (Phase 6), `recipes/contracts.md` and the three recipe files (Phase 7). Every other named file exists.
