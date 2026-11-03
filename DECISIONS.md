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

## D-023 Class and token prefix

- **Question:** How the design system avoids colliding with host app styles and utility frameworks (Bootstrap and Tailwind both use `p-` classes).
- **Choice:** Every class is `pn-*` and every token is `--pn-*`. Component styles apply inside an element with class `pn`.
- **Why:** Prefixed classes plus a root scope work in every flavor without a build step. Scoped CSS or a frame can still be layered on per cookbook.
- **Reverse:** Find and replace the prefix across the design system and templates.
- **Tag:** default

## D-024 How states are expressed

- **Choice:** Real states use the platform: `:hover`, `:focus-visible`, `:disabled` or `aria-disabled="true"`, and `aria-invalid="true"` for error. Variants use data attributes (`data-variant`, `data-size`, `data-tone`, `data-width`). `data-force="hover"` and `data-force="focus"` exist only so the living page and the playground can show a state statically.
- **Why:** States stay accessible by construction, and templates fill attributes straight from the schema (`width: 1/2` becomes `data-width="1/2"`).
- **Reverse:** Switch to state classes.
- **Tag:** default

## D-025 States that do not apply

- **Question:** The Phase 1 exit asks every component to show default, hover, focus, disabled, and error. Some states do not exist for some components.
- **Choice:** The living page marks them "not applicable" with the reason, instead of inventing a fake state: button error (use the negative variant), breadcrumb disabled and error, spinner (default only), toast disabled (negative tone is its error), empty state disabled (its error is the negative tone). Dialog and drawer show default and error; their hover, focus, and disabled live on the buttons inside.
- **Why:** A made-up state would become a rule a model must follow with no real meaning.
- **Reverse:** Add the states to `components.css` and the living page.
- **Tag:** default, needs human review

## D-026 Control borders meet 3:1 contrast

- **Choice:** Inputs, selects, checkboxes, radios, toggles, and secondary buttons use `--pn-color-border-control` (3:1 or better against the surface), not the quieter `--pn-color-border` used for dividers.
- **Why:** Rule 9 (sufficient contrast) and WCAG non-text contrast. A hairline-light input border would look calmer but fail it.
- **Reverse:** Swap the token on controls. Accessibility checks will fail.
- **Tag:** philosophy-dependent

## D-027 Dialogs and drawers are native `<dialog>`

- **Choice:** `pn-dialog` and `pn-drawer` style the native `<dialog>` element, opened with `showModal()`. `data-static` shows one inline for the living page and the playground.
- **Why:** The platform provides the modal layer, inert background, Escape to close, and focus return with no dependency.
- **Reverse:** Style a `div[role=dialog]` and write focus trapping in the snippets.
- **Tag:** default

## D-028 Visual values

- **Choice:** Neutral warm-grey surfaces, one blue accent, four semantic tones; five type sizes (0.75 to 1.5rem); a 4px-based space scale with seven steps; radius 3px and 5px; a 2px focus outline offset 2px; a six-column form grid that collapses to one column below 40rem; shadow only on raised layers (dialog, drawer, toast).
- **Why:** Smallest reasonable choices that satisfy the hypotheses without claiming them.
- **Reverse:** Edit `tokens.css`; components read only tokens.
- **Tag:** philosophy-dependent

## D-029 Icons are a sprite

- **Choice:** `design-system/icons.svg` holds `<symbol>` icons used through `<svg class="pn-icon"><use href="#pn-icon-name"/></svg>`. A page includes the sprite once. The check script confirms the living page's copy matches the file.
- **Reverse:** Inline each icon's path where used.
- **Tag:** default

## D-030 Dev tooling

- **Choice:** Root `package.json` with dev-only `playwright` and `axe-core`. Checks live in `tools/` and serve pages over a local HTTP server (axe cannot read stylesheets over `file://`). Output goes to `tools/out/`, which is not committed.
- **Tag:** default

## D-031 Flavors, host shapes, and recipes are separate

- **Question:** Appendix G has cookbooks explain "how the three adapters map onto the stack's existing auth, data, and files", and Appendix I lists "framework-specific mappings" as recipes. The same knowledge would live in two places.
- **Choice:** Three kinds, no overlap:
  - **Flavor** (what the panel is written in): template-to-framework translation rules, how the behavior spec maps onto the framework (for React, one hook per spec section), pitfalls, checklist.
  - **Host shape** (where the panel runs): mount point, routing, whether a server exists, rendering pitfalls such as SSR. A section of the flavor file per shape (Vite SPA, Next.js, and so on).
  - **Recipe** (what the panel talks to): fills an adapter contract. This includes the host's existing setup, for example `django-auth` or `django-models`. A flavor's adapter section only points to recipes.
- **Why:** One flavor composes with any recipes. Host integrations live in one place, which is also where binding to existing models will go.
- **Consequence:** Intake's "the host app's existing auth" option resolves to a host recipe. Phase 9 adds a comparison: the React blog build with and without the flavor file.
- **Reverse:** Fold host recipes back into cookbooks.
- **Tag:** decided-by-human

## D-032 Host profile: the host decides how code is written, Panel decides what it does

- **Question:** When Panel is invoked inside an existing project, how compatible must the result be?
- **Choice:** Intake builds a **host profile** for existing projects by reading the project: language, framework, host shape, router, styling approach, component library, data layer, existing auth, folder layout, naming, package manager, test runner, lint rules. It is written into the intake record and the build must follow it. The flavor's opinions are fallbacks used only where the host has none.
  - Follows the host: language, file layout, naming, router and mount, data-fetching and state libraries, test runner and lint rules, existing auth and data (through recipes).
  - Stays Panel's: screens and template structure, the behavior spec, the schema and conformance, accessibility rules, and the look.
- **Look:** Panel keeps its own `pn-` design system, scoped so it cannot collide with the host's styles (for example, Tailwind's preflight). It looks the same in every project. Host component libraries are not used inside the panel.
- **Why:** The code should read like the team wrote it, while the panel stays consistent and testable across projects.
- **Consequence:** Phase 5 intake gains host-profile detection; conformance gains "the build follows the host profile"; each cookbook documents style isolation against common host setups.
- **Reverse:** Drop the profile and let flavor opinions stand.
- **Tag:** decided-by-human

## D-033 Slot convention

- **Choice:** Four markers: `data-slot` (text), `data-slot-children` (container for other templates), `data-slot-attr="attr:key"` (attribute values from the schema), `data-slot-repeat` (a parent whose single child is copied per item, zero or more times). Every template root carries `data-template="name"`. Markers stay in the output so any page can be checked. Documented in `panel/templates/README.md`.
- **Why:** Keeps every schema-driven difference inside a marked place, so stripping is mechanical.
- **Reverse:** Rewrite templates and `tools/lib/fidelity.js`.
- **Tag:** default

## D-034 What the fidelity comparison normalizes

- **Question:** "Byte-identical" would fail on indentation or attribute order, which carry no structure.
- **Choice:** The comparison works on a normalized tree: whitespace between tags is ignored, attributes are sorted, slot contents and slot attribute values are blanked, and runtime state attributes (`disabled`, `aria-invalid`, `open`, `value` on inputs, and the others listed in the README) are dropped on both sides. A `<textarea>`'s text is its value and is ignored too (added in Phase 6, so playgrounds can show field values as markup). Everything else must match exactly: tags, order, classes, fixed attributes, fixed text.
- **Why:** Tests structure, not formatting. The checker proves it catches renamed classes, removed or added elements, changed fixed attributes, and altered repeat units.
- **Reverse:** Compare serialized source text instead.
- **Tag:** default

## D-035 Fixed UI copy lives in templates

- **Choice:** Interface words that do not come from the schema ("Save", "Revert", "Delete", "Cancel", "Create", "Log out", "Created", "Updated", "Skip to content") are fixed text in the templates, not slots.
- **Why:** The same words on every panel; a model cannot drift them. Localization would make them slots later.
- **Reverse:** Turn each into a `data-slot`.
- **Tag:** default, philosophy-dependent

## D-036 Unchecked containers

- **Choice:** Three containers hold free component markup the checker cannot compare: `field-custom` → `control`, `screen-login` → `methods` (each auth recipe defines its sign-in controls), and `empty`/`error` → `actions`. Everything else inside a container must itself be a template.
- **Why:** Custom fields and auth methods vary by definition.
- **Reverse:** Add templates for login methods once recipes settle.
- **Tag:** default

## D-037 Layout choices in templates

- **Choice:** Nav sits beside the content and stacks on top at phone width (no script, no menu button). The item sidebar (status is in the header; created, updated, delete in the sidebar) moves below the fields under 52rem. Singletons have no sidebar. The layout has a `dialogs` container for create, confirm, and slide-over dialogs. `relation` uses a select in v1 (proposal 001).
- **Tag:** philosophy-dependent

## D-038 Required is `aria-required`, not `required`

- **Choice:** Templates mark required fields with `aria-required` and `data-required="true"` on the label, never the native `required` attribute.
- **Why:** Attribute slots must stay present with a value; a boolean attribute cannot be blank. Native `required` would also block saving drafts, against D-001.
- **Tag:** default

## D-039 Two layers of schema checking

- **Choice:** `panel/panel.schema.json` checks shape only (keys, types, enums, type-only keys). `tools/validate.mjs` adds what JSON Schema cannot say clearly: references (`list`, `from`, `to`), unique ids and names, `default` matching its type, a `files` adapter when uploads exist, recipe existence, slot, and settings, `panel: 1` on line one, and the YAML style rules (no inline braces or brackets, quote misreadable values, blank line between fields as a warning). Every message names the file, line, and place in plain words (`type "post" › field "cover"`), and suggests the closest valid name for typos.
- **Why:** Shape errors from a raw JSON Schema validator are not "a clear message".
- **Tag:** default

## D-040 Recipe registry shape

- **Choice:** `panel/recipes/index.json` lists every recipe intake offers (`none`, `google-login`, `email-link`, `json-files`, `postgres`, `supabase`, `local-disk`, `s3`, `r2`), each with `kind` (the adapter it fills), `status` (`planned`, `unverified`, `verified`), and `settings` as a JSON Schema. All are `planned` until Phase 7. Host recipes (D-031) are added in Phase 7.
- **Settings decided now:** login recipes take `allow` (emails or `*@domain`). Secrets are never in the schema: settings ending `_env` name an environment variable. `json-files` and `local-disk` take `via` to record the D-003 choice (`server` by default; `file-system-access`, `github` with `repo`, `download`, `local-storage`).
- **Reverse:** Edit the index; the validator reads it.
- **Tag:** default

## D-041 Small schema rules not stated in the brief

- **Choice:** `status` needs at least two states, each a machine name. `auth` is always a block (`auth: none` as a string is rejected with the fix shown). `slug.from` must name a `text` or `textarea` field. `image`, `file`, and `relation` fields take no `default`. A missing `label` is derived from `name` (`site_title` → "Site title"). JSON schemas are accepted for single-file builds; the YAML style rules do not apply to them. `notes`, `behavior`, and `x-` keys are also allowed on adapters and on `list`.
- **Tag:** default

## D-042 Where the validator lives (open)

- **Question:** The validator uses dependencies (`ajv`, `yaml`), so per rule 5 it cannot ship inside the skill. A model using the skill in someone else's project will not have `tools/`.
- **Choice for now:** The validator stays dev-time in `tools/`. `schema-guide.md` section 10 gives a manual checklist that covers the same rules for when it is unavailable.
- **Options later:** publish it as a package run with `npx`, or write a dependency-free validator for the YAML subset Panel allows.
- **Tag:** default, needs human decision

## D-043 Behavior tests are implementation-agnostic

- **Choice:** `evals/behavior/` drives a panel only through template classes, `data-action`, `data-field`, `data-template`, and the `window.panelTest` hook (behavior-spec.md section 7). Any build, in any flavor, runs the same suite with `PANEL_URL=... npm run test:behavior`. Every screen also runs template fidelity, axe, and 400px checks.
- **Why:** Phase 8 must pass the same tests in React. Tests that read framework state would not transfer.
- **Tag:** default

## D-044 The reference build mirrors the schema in its own config

- **Choice:** `evals/fixtures/vanilla-blog/src/blog.js` restates the blog schema as plain JS, with each key traced to a schema, behavior, or conformance line. Nothing parses `panel.yaml` at runtime (D-005).
- **Why:** It is what a model writes when it builds from the schema; the build owns its code.
- **Tag:** default

## D-045 Rules added while writing the behavior spec

- **Choice:**
  - S9: moving to another panel screen with unsaved changes asks "Discard unsaved changes?" first. `beforeunload` (S8) only covers leaving the page.
  - Saving an item already past its first status checks required fields like publishing does (V4), so a published item cannot lose a required value.
  - A published item does not autosave ("Autosave drafts").
  - With exactly two statuses, the status button toggles. With more, it opens a slide-over of choices.
  - Confirm dialogs focus Cancel when the action is negative (D1).
  - `.pn [hidden]` always hides, so behavior such as "Toolbar hidden until text is selected" can use the `hidden` state attribute on components that set `display`.
- **Tag:** philosophy-dependent (S9, published saves, autosave scope); default (the rest)

## D-046 Template filling and field controls ship as snippets

- **Choice:** `snippets/templates.js` (`tpl`, `fill`, `repeat`) and `snippets/fields.js` (one controller per field type) are owned snippets, like the behavior snippets. Field-control behavior is specified in `behavior-spec.md` section 8 (F1–F4) and tested.
- **Why:** Appendix K: code comes from owned snippets. Without them each run rewrites tag input, uploads, and the markdown toolbar differently, which works against consistency (Appendix J).
- **Tag:** default

## D-047 A build guide and fixed UI copy

- **Choice:** `panel/build.md` is the procedure for the Build step: output layout, the exact `index.html`, `panel.config.js` with traced keys, screen and route table, snippet wiring, `?test` memory adapters, a fixed copy table, and the `CONFORMANCE.md` report format.
- **Why:** The router needs a file to load for Build, and Phase 9 scores consistency; unspecified wording and layout would vary between runs for no reason.
- **Tag:** philosophy-dependent (the copy); default (the rest)

## D-048 Every build includes memory adapters behind `?test`

- **Choice:** Builds always include `adapters/memory.js` and expose `window.panelTest` only when the URL has `?test`. Behavior tests open `./?test#/...`.
- **Why:** The same tests must run against any build (D-043) without touching real data.
- **Risk:** `?test` on a deployed panel shows fake data only; it never reaches the real adapters. Recipes note it.
- **Tag:** default

## D-049 Adapter contracts and the project server

- **Choice:** `panel/recipes/contracts.md` defines auth, data, and files as async functions with plain-JSON values and seven error codes, plus one shared HTTP frame (the project server) that login and storage recipes extend. Items carry `id`, `type`, `status`, `values`, `createdAt`, `updatedAt`; updates replace `status` and `values` whole.
- **Why:** Appendix H: contracts precise before recipes. One server shape keeps three recipes from inventing three APIs.
- **Tag:** default

## D-050 Recipe code ships as owned files

- **Choice:** The verified recipes' code lives in `panel/recipes/server/` (zero-dependency Node) and `panel/recipes/client/`. Recipes tell the model to copy it, then wire it. The reference build copies it the same way, and the recipe tests import it directly.
- **Why:** Auth code generated per project is the riskiest part (Appendix I). Copying verified code is safer than regenerating it from prose each time, and matches Appendix K's owned-snippet approach.
- **Tag:** default

## D-051 Google login security choices

- **Choice:** The server verifies Google ID tokens itself (RS256 only, Google's published keys cached by `max-age`, issuer, audience, expiry with 60 s skew, `email_verified`). `*@domain` entries also require the `hd` claim to match. Sessions are HMAC-signed `HttpOnly; SameSite=Lax` cookies (7 days, renewed past half-life, `Secure` behind HTTPS), and the allow list is re-checked on every request. Writes need an `x-panel: 1` header against cross-site requests. `SESSION_SECRET` must be 32+ characters or the server refuses to start.
- **Tag:** default

## D-052 Recipe verification scope

- **Choice:** Verified: `none`, `google-login`, `json-files` (`via: server`), `local-disk` (`via: server`), by `npm run test:recipes` (14 unit tests, 12 browser tests against the real server). Google's own sign-in is replaced by a stub button and a fake verifier at the `verify` seam (D-015); the manual checklist in `google-login.md` covers the real flow. Unverified: `email-link`, `postgres`, `supabase`, `s3`, `r2`, and the non-server `via` branches. The validator warns when a schema names an unverified recipe.
- **Deferred:** Host recipes (`django-auth`, `django-models`, and so on) promised in D-040 are not written. Intake records "the host app's existing auth" as an open question and stops (intake.md Rule 5).
- **Tag:** default

## D-053 The memory adapters ship with the skill

- **Choice:** `memory.js` moved from the vanilla fixture to `panel/recipes/client/memory.js`. Every build copies it (`build.md` step 6), so every flavor runs the same behavior suite against the same test contract.
- **Why:** Each build writing its own memory adapter would make the test seam differ per build, and the suite would test the adapter as much as the panel.
- **Tag:** default

## D-054 React flavor ships component files; Vue is guidance only

- **Choice:** `panel/flavors/react/` ships `templates.jsx` (every template as a component, slot markers kept literally), `fields.jsx`, and `hooks.js` (one hook per behavior spec section, importing the shared snippets for rules and native dialog code). `flavors/react.md` gives translation rules, the hook mapping, the pitfalls found while building, host shapes, style isolation, and a checklist. `evals/fixtures/react-blog/` is built from these files with Vite and passes the same 60 behavior and quality tests as vanilla (`npm run test:behavior:react`). `flavors/vue.md` is unverified guidance with no component files.
- **Why:** The fidelity check compares rendered DOM, so the React components can be checked exactly like vanilla. Sharing the snippets keeps one copy of each rule.
- **Host shapes:** Vite SPA is verified by the fixture. Next.js and Nuxt sections are unverified.
- **Reverse:** Ship translation rules only and let the model write components.
- **Tag:** default

## D-055 Playground: one fixed page, checked like a build

- **Choice:** `panel/playground.md` fixes the page (a screen switcher over `template[data-pg-screen]`, open dialogs shown as modals), the screen list, and the rule that every screen is filled exactly as a build would fill it. `tools/check-playground.mjs` (`npm run check:playground`) checks fidelity, axe, and width on every screen in both themes, no network requests, and that every screen in the list is present. `panel/examples/blog/playground.html` is the example.
- **How it was tested:** A fresh subagent wrote the example from the skill files only, without reading `evals/` or the reference build. The check passed on the first run. Its report of unclear instructions became rules: screen details in `build.md` step 4 (nav entries, home row slots, sort text, empty and error states, the status slide-over, not found, `publishRequires` fields, computed fields), the S3 scope ("every control inside the form"), a valid draft for `confirm`, the Preview step's reading list, and a playground stand-in for Google's button. Where its guesses differed from the reference build, the example was corrected to match.
- **Tag:** default

## D-056 First experiment result

- **Result:** 0 of 5 fresh vanilla blog runs conform, so the 80% kill criterion fails as written (`evals/results/blog-vanilla/REPORT.md`). Template fidelity is 20 of 20 and shipped files are unmodified in every run; copy is identical across runs; structure is identical in 4 of 5. All 7 failing tests come from two rules the spec did not state (`reset` re-renders; the skip link keeps the URL).
- **Choice:** Tests are not changed. The scorer requires only the templates `build.md` step 1 asks for.
- **Open:** Whether to fix the spec gaps and rerun, or treat the result as a stop. Decided by the person.
- **Tag:** philosophy-dependent

## D-057 A look closer to Kirby's panel

- **Choice:** Tokens and component CSS restyled toward Kirby's panel, written fresh with no Kirby code or assets: a gray page with the nav on it and no top-bar strip; white controls and cards with soft shadows instead of hard borders; list rows as separate cards 2px apart; 14px base type, bold dark labels, a larger bold screen title; near-black primary buttons and tags (light in dark mode); solid toasts by tone; a save bar that turns orange with unsaved changes and red on error. New tokens: `--pn-color-attention`, `--pn-color-on-attention`, `--pn-color-on-tone`, `--pn-shadow-card`. Class names and templates are unchanged, so fidelity and every behavior test still pass. Control borders stay at 3:1 against white.
- **Consequence:** The example playground's inlined CSS was refreshed. The runs in `evals/runs/blog-vanilla/` copied the earlier CSS; rescoring them against this commit would flag their CSS as modified.
- **Requested by:** the person ("resemble Kirby's CMS a bit more closely").
- **Rail:** The nav rail sits on its own slightly darker gray (`--pn-color-rail`, darker than the page in dark mode too), with a translucent white hover and the current entry as a white card, after the always-ready project's panel. New tokens: `--pn-color-rail`, `--pn-color-rail-hover`, `--pn-color-rail-line`.
- **Tag:** philosophy-dependent

## D-058 Closer still: measured against Kirby's panel source

- **Choice:** After reading the public getkirby/kirby panel source for proportions only (no code or assets copied), tokens and component CSS were redone in our own values. Neutral grays: page about 94%, rail about 91% with a 1px right border, white rows and inputs, black text. Buttons are 2rem, filled light gray by default and transparent when quiet. Primary is pastel green with dark green text, and negative is red text. Unsaved changes turn the save-bar buttons pastel orange instead of coloring the whole bar. Rows put title and info on one line. Screen titles are 1.75rem at weight 500 over a thin rule. Labels are weight 500 with a small gray required mark. Inputs are 2.25rem with a thin border and no shadow. Dialogs sit on the page gray with 0.5rem corners. Toasts use pastel tones. The content column is full width with fluid side padding. Supersedes the button, toast, save-bar and label parts of D-057.
- **Tokens:** Added `--pn-color-fill`, `--pn-color-fill-hover`, `--pn-color-rail-border`, `--pn-color-tag`, `--pn-color-on-tag`, `--pn-input-height`, and `--pn-radius-lg`. Removed `--pn-color-attention`, `--pn-color-on-attention`, and `--pn-color-on-tone`.
- **Tradeoff:** Input and checkbox borders (`--pn-color-border-control`, #d4d4d4 on white) are about 1.5:1, below the 3:1 non-text contrast in WCAG 1.4.11. This matches the reference look; axe does not check it. Text contrast still passes axe in all four theme modes. To restore 3:1, set `--pn-color-border-control` to about #949494.
- **Requested by:** the person ("this needs to look closer to kirby").
- **Tag:** philosophy-dependent

## D-059 Close the gaps the first experiment found

- **Choice:** Every gap in `evals/results/blog-vanilla/REPORT.md` is now a written rule, and each new rule has a test.
  - **`behavior-spec.md`:** `reset(seed)` re-renders the current route (section 7). K6 keeps the route in the address. K7 stops Enter submitting a form natively. S9 covers the back button and a typed address. V7 enforces `required` on singletons. F2 adds the too-large message. S3 no longer says Delete stays enabled. Singular counts are spelled out.
  - **`build.md`:** gives the routing listener, the `panelTest.reset` wrapper, `start.mjs` defaults, and `package.json`. It names the `compute` key and every missing piece of copy. It explains how unattended runs report checks that need the person.
  - **Allow list:** it moves from the served `panel.config.js` to a server-only `allow.mjs`. The project server now serves only page, script, style, data, and image files.
- **Bugs fixed:**
  - **`save-state.js`:** a one-field form reloaded the page on Enter.
  - **`dialogs.js`:** reopening a dialog before its `close` event fired attached the new listener to the old close, so Discard resolved nothing.
  - **`fields.js`:** never showed the too-large message.
  - **`auth.js`:** dropped "This account isn't allowed" when a session was refused at load.
- **Unauthorized saves:** a save that finds the session gone keeps the edits in the save bar's error state, and says so in a toast. Edits no longer have to survive a sign-in, which nothing implemented.
- **Tests:** 4 new behavior tests (64 in all) and 1 new recipe test. The scorer allows a dependency-free `package.json` and fails a run whose served config holds the allow list.
- **Requested by:** the person ("keep going and wrap this up"), after review of the first experiment.
- **Tag:** philosophy-dependent (the copy and the unauthorized-save choice)

## D-060 Second experiment passes; close the gaps it reported

- **Result:** At `921218a`, 5 of 5 fresh sessions conform (64 of 64 tests, 20 of 20 fidelity, identical copy). The kill criterion passes. See `evals/results/blog-vanilla-2/REPORT.md`.
- **Choice:** Every gap two or more sessions reported is now written down.
  - **`behavior-spec.md`:** "publish" means moving to any status after the first. V3 limits the draft rule to the first status. New V8: saving an item past its first status runs the publish checks. S5 gives the conflict copy.
  - **`build.md`:** `<title>` is the schema name. The config example has `auth`, `data`, and `files`. New rows for what is mounted, the item title while editing, the account `user`, and the singleton load error. Keyboard shortcuts apply on every screen. It gives a hand procedure for fidelity and K5, and the `open_questions` shape.
  - **Snippets:** `save-state.js` and `useSaveState` take `errorMessage(error)`, and a save note clears only when the values change. `server.mjs` serves `.jpg`, `.jpeg`, and `.gif`.
- **Bug fixed:** `validation.js` (and `useValidation`) stopped checking publish-only required fields after the first edit following a failed publish.
- **Tests:** 3 new behavior tests (67 in all). Rescored against them, the experiment-2 runs would fail V8, and runs 1 to 4 also V4/V5. A third experiment would confirm the current skill.
- **Requested by:** the person ("keep going and wrap this up").
- **Tag:** philosophy-dependent (the publish meaning and the conflict copy)

## D-061 Two lowest gates: "View panel" when no auth is set up, then a shared password

- **Choice:** `auth` is now optional in the schema; absent means `none`. `none` no longer skips the login screen. It shows one primary button, "View panel", remembered for the browser tab in `sessionStorage`, and the account menu shows `local` with "Log out". It is not protection, and the server still accepts every request from this computer and stays bound to `127.0.0.1`. Test mode (`?test`) uses the same button, so logging out and back in works there too.
- **New recipe, `password`:** one shared password in an environment variable (`PANEL_PASSWORD`, or the one `password_env` names), never in the schema. The server compares SHA-256 digests in constant time, needs at least 12 characters to start, and answers the new `rate-limited` code (429) after 10 wrong tries from one address in 15 minutes. A right password sets the same signed session cookie as `google-login`, for the user `editor`. The browser only passes the password on.
- **Tradeoffs:** changing the password does not end existing sessions; changing `SESSION_SECRET` does. Behind a proxy the try limit is shared by everyone. The "View panel" label shortens the requested "Click to view Panel" to an action, like every other button.
- **Tests:** 4 unit and 7 browser tests for `password`, 3 browser tests for `none` (one for a config with no `auth`), 1 behavior test for test mode (68 in all), and 4 schema fixtures. Breaking the password check fails 2 of the browser tests.
- **Requested by:** the person ("if auth isnt set up, lets default to having \"Click to view Panel\" … the second line of defense is a simple password").
- **Tag:** philosophy-dependent (the copy, and that `none` now shows a login screen)
