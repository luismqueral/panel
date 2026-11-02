# Decisions

A running log of every call made on an open or ambiguous question. Source of truth for the brief: `docs/BRIEF.md`.

Each entry: the question, the choice, why, and what reversing it would take. Tags: `decided-by-human`, `default` (taken from Appendix L or a stated default, not confirmed), `philosophy-dependent` (revisit once `panel/PHILOSOPHY.md` has principles).

## D-001 What `required` blocks

- **Question:** Appendix C says a required field means "an item cannot be saved or published without a value", but the blog autosaves drafts while `body` is required.
- **Choice:** `required` blocks publishing and moving an item out of its first status. Drafts always save, including empty ones.
- **Why:** Autosave of new drafts would otherwise be impossible.
- **Reverse:** Change the validation section of `behavior-spec.md` and its tests; templates are unaffected.
- **Tag:** decided-by-human

## D-002 Autosave and field locking

- **Question:** The save-state table locks fields while saving, which would freeze the editor every autosave.
- **Choice:** Autosave is a background save that never locks fields and never shows the blocking spinner. Only a manual save or Cmd+S enters the locked `saving` state.
- **Why:** Typing must never be interrupted.
- **Reverse:** Remove the autosave path from the save-state table and its tests.
- **Tag:** decided-by-human

## D-003 How content and files get written

- **Question:** A single HTML file cannot write to `./content` or `./uploads` by itself.
- **Choice:** It depends on the build. Storage recipes carry a decision step: a small dependency-free Node server owned by the project when there is login or a host server; otherwise one of File System Access API (Chromium), commit via the GitHub API, download the edited file, or localStorage (mockups only).
- **Why:** No single mechanism fits every setup; recipes already have decision points.
- **Reverse:** Remove branches from the recipes.
- **Tag:** decided-by-human

## D-004 Template fidelity check

- **Question:** The Phase 2 exit said stripped templates must be "byte-identical across templates of the same kind", which cannot hold for different field types.
- **Choice:** A filled template, with slot contents stripped, must be byte-identical to its own source template. Field templates are not required to share a wrapper.
- **Why:** That is what fidelity actually needs to prove.
- **Reverse:** Add a shared-wrapper check to the strip script.
- **Tag:** decided-by-human

## D-005 Schema is read by the LLM, not executed

- **Question:** How the playground handles YAML with no dependencies.
- **Choice:** The YAML schema is a contract the LLM reads. Nothing parses it at runtime in a shipped artifact. The dev-time validator may use dependencies.
- **Why:** Consistent with "contract, not compiler".
- **Reverse:** Would require a runtime parser, which conflicts with rule 5.
- **Tag:** decided-by-human

## D-006 Missing design system components

- **Question:** Screens and fields need components the Phase 1 list lacks: table or list, card, status badge, spinner and loading state, nav or sidebar, file and image picker, tags input, markdown editor.
- **Choice:** Write one proposal at the start of Phase 1, then build the smallest set it justifies.
- **Why:** Honors "say no on purpose" while unblocking templates.
- **Reverse:** Drop components from `components.css` and the living page.
- **Tag:** decided-by-human

## D-007 Repeating regions in templates

- **Question:** How a template marks parts that repeat (rows, nav entries, fields).
- **Choice:** A `data-slot-repeat` attribute on one example child. The model copies that child once per item. The strip script collapses repeats to one before diffing.
- **Why:** Renders as plain HTML with no script, and is easy to strip.
- **Reverse:** Rewrite templates and the strip script.
- **Tag:** decided-by-human

## D-008 Playground is generated per schema

- **Question:** Whether the playground is a fixed engine that renders any schema or a file the LLM writes.
- **Choice:** The LLM generates a playground file for each schema by filling the real templates with fake data. Edits happen in chat: the person asks, the LLM edits the schema, then regenerates the playground. The playground has no editing UI.
- **Why:** Keeps the schema LLM-read (D-005) and makes the playground a direct test of template fidelity.
- **Reverse:** Build a renderer, which reintroduces a runtime.
- **Consequence:** Phase 6 exit becomes: the generated blog playground covers every screen type and passes the template fidelity check.
- **Tag:** decided-by-human

## D-009 Recipes for every intake option

- **Question:** Intake offers adapters (email link, Postgres, Supabase, cloud storage, host auth) with no recipe.
- **Choice:** Write recipes ahead of time for every intake option. Fully verify `google-login`, `json-files`, `local-disk`. Write the rest against the adapter contracts and mark them `unverified`.
- **Why:** The LLM should never improvise an adapter, least of all auth.
- **Reverse:** Remove options from intake.
- **Tag:** decided-by-human

## D-010 Recipe settings are validated strictly

- **Question:** How the validator treats recipe-specific keys such as `allow` and `path`.
- **Choice:** Each recipe declares its accepted settings in `recipes/index.json`. The validator rejects unknown keys under an adapter.
- **Why:** "A typo is a failure."
- **Reverse:** Loosen the adapter subschema.
- **Tag:** decided-by-human

## D-011 `list.title` is required

- **Choice:** Every type must have `list.title`, naming an existing field.
- **Reverse:** Make it optional with a default to the first text field.
- **Tag:** decided-by-human

## D-012 Dates with time

- **Choice:** `date` accepts `time: true` (type-specific property). Default is date only.
- **Reverse:** Remove the property, or split into a `datetime` type.
- **Tag:** decided-by-human

## D-013 Select options format

- **Choice:** `options` is a list of strings. The displayed label is derived from the value.
- **Reverse:** Allow value and label pairs as an alternative form.
- **Tag:** decided-by-human

## D-014 Timestamps on every item

- **Choice:** The data adapter contract requires `createdAt` and `updatedAt` on every item and singleton record. Home's recent activity reads `updatedAt`.
- **Reverse:** Make them optional and hide recent activity when absent.
- **Tag:** decided-by-human

## D-015 Google login verification

- **Choice:** The recipe ships a verification checklist. The human runs it by hand with real credentials. Automated checks cover only the server-side allow-list logic.
- **Why:** No OAuth credentials are available to the building model.
- **Tag:** decided-by-human

## D-016 Eval sessions

- **Choice:** A fresh subagent counts as a fresh session for consistency runs.
- **Reverse:** Rerun with separate manual sessions.
- **Tag:** decided-by-human

## D-017 `describe` on custom fields

- **Choice:** `describe` is required on `type: custom` and invalid on every other type.
- **Tag:** default

## D-018 No login

- **Choice:** Written as `auth:` with `recipe: none`. `none` is listed in `recipes/index.json`.
- **Tag:** default

## D-019 References must resolve

- **Choice:** `list.title`, `list.subtitle`, `list.sort` (minus any `-` prefix), every `list.search` entry, and `relation.to` (a type `id`) must name something that exists.
- **Tag:** default

## D-020 Icons

- **Choice:** A small set of original inline SVG icons owned by Panel. No icon font, no third-party set.
- **Tag:** default, philosophy-dependent

## D-021 Repo layout

- **Choice:** `panel/` (the skill), `evals/`, `docs/`, and `DECISIONS.md` sit at the repo root. Test apps for recipes and flavors live in `evals/fixtures/`. The brief is copied whole to `docs/BRIEF.md`.
- **Tag:** default

## D-022 Defaults taken from Appendix L

| Question | Choice | Reverse |
| --- | --- | --- |
| Schema format | YAML-first, validated with a JSON Schema; JSON form stays embeddable | Switch examples to JSON |
| One file or one per type | Single `panel.yaml`; directory support later | Teach the validator to merge a directory |
| Roles and permissions | Out of scope for the first build | Add a schema proposal |
| Binding to existing models or folders | Out of scope; not implemented | Add a `binding` key proposal |
| Interaction code in templates | Markup-only templates plus optional snippets | Move snippets inline |
| Flavors as folders or skills | Folders inside one skill | Split folders into skills |
| Flavor extras | Not allowed; spec and vanilla first | Relax rule 6 |
| Validation tooling | Node script with a JSON Schema validator, dev-time only | Swap the script |
| Recipe registry and versioning | `recipes/index.json`; schema version is the `panel` integer | Add a version field per recipe |
| Repeatable and nested fields | Out of scope | Proposal for a `structure` type |
| Relation cardinality | Single-link only | Add `multiple: true` proposal |

**Tag:** default
