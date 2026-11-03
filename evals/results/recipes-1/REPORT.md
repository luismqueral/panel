# Recipe site, first experiment: design the schema, then build it

The first run on a project that isn't the blog. Skill at commit `dbf35c5`. Prompt: `evals/harness/recipes-prompt.md`, a family recipe site ("Sunday Table") described in the person's words, with no schema given. Each session had to write the intake record, design `panel.yaml`, preview it in `playground.html`, and only then build against that schema. Two fresh sessions, vanilla flavor, unattended. Each session's own account is `evals/runs/recipes-1/run-<n>/REPORT.md`; its step-by-step trace is `run-<n>.TRACE.md` here; screenshots are in `shots/run-<n>/`.

There is no scorer for this project yet: the blog scorer's tests name the blog's routes and fields. What was checked instead is below.

## Result

**Both runs completed all five steps and report no failing checks.** My own checks agree:

| Check | Run 1 | Run 2 |
| --- | --- | --- |
| `panel.yaml` passes `tools/validate.mjs` | yes | yes |
| Shipped files (styles, snippets, adapters, server) byte-identical to the skill | yes | yes |
| Screens load in test mode: home, both lists, items, unsaved edit, create dialog, About, playground | 11 of 11 | 11 of 11 |
| Forbidden paths touched, per trace | none | 1, see Incidents |
| Tool calls / skill files read | 105 / 15 | 176 / 35 |

## The two schemas

The sessions designed nearly the same schema from the same request:

- **Same:** `password` login, `json-files` data, `local-disk` photos. Types `recipe` (statuses `idea → testing → ready → retired`) and `cook` (no statuses), singleton `about`. Recipe fields `name`, `photo`, `serves`, `prep_time`, `cook_time`, `ingredients`, `steps`, `cook` (a relation to `cook`), `favorite`. Only name, ingredients, and steps required. Retiring is a status, Delete is kept.
- **Different:**

| Choice | Run 1 | Run 2 |
| --- | --- | --- |
| Ingredients | `custom`: rows of amount and ingredient, with its own editor | `textarea`, one per line, amount first |
| Steps | `textarea` | `markdown` |
| Search | name | name and ingredients |
| Project check under `conformance:` | none | "Retiring a recipe keeps it in the Recipes list." |
| Field order | quantities first, cook and favorite last | favorite beside name, cook beside photo |

Run 1's custom ingredients editor is the first owned field control any run has written.

## What the sessions reported missing

Raised by both runs:

| Gap | Where |
| --- | --- |
| The last status is always `positive`, so "Retired" is green and "Ready" amber (visible in both `recipe-collection.png`) | `build.md` step 4 |
| No field type for repeating structured rows (ingredients with amounts). Run 1 proposes a `rows` type | `schema-guide.md` field types |
| "We don't delete them" has no answer; the item screen always has Delete | `build.md` step 4 |
| What blocks saving an item in a type without statuses | `build.md`, `behavior-spec.md` V3–V8 |
| The playground's "Publish confirm" screen when nothing asks before publishing; where confirm and slide-over go with two types | `playground.md` Rule 2 |
| Sort options when `list.sort` is missing or repeats the title | `build.md` step 4 |

Raised by one run: any move past the first status counts as publishing, so idea → testing already needs every required field (run 2); the toast "{Singular} {status}" reads "Recipe testing" (run 2); test mode shows "me@example.com" instead of the password recipe's "editor" (run 2); `fields.js` has no pattern for an editable `custom` control (run 1).

Run 2 also reports that headless Chrome 156 drops a dialog's `close` event after an Escape-close and reopen. It saw this only in its own hand-made browser driver; the skill's Playwright behavior tests open and close dialogs repeatedly and pass. Not confirmed.

## Incidents

- Run 2, step 6, listed `evals/runs/recipes-1/` (the folder holding both runs) with its output piped to `head -0`, so nothing was printed. The trace flags it; it read nothing of run 1.
- Both runs started and stopped only their own servers and checked that other `node` processes weren't theirs before leaving them running.

## What this suggests

The schema step converges: two sessions reading the same request produced the same types, statuses, adapters, and nearly the same fields. The build step stays within the contract even with a custom field. The gaps are in the skill's assumptions from the blog: the last status is the live one, every type can be deleted, every type has statuses, and every list of things is flat text.
