# Panel: Build Brief

This file has two parts.

- **Part 1** is the master prompt. Paste it into the LLM that will build Panel (Claude Code works well), with this whole file attached or placed in the repo as `BRIEF.md`.
- **Part 2** is the reference material: every decision, rule, and draft from the design conversation. Part 1 tells the LLM how to use it.

Status tags used throughout: **Decided** (build on it), **Proposed** (drafted, build it, expect changes), **Open** (undecided, see the rules in Part 1 for how to handle it).

---

# PART 1: THE PROMPT

You are building **Panel**: a playbook that lets an LLM build the admin view of anything. It is delivered as a Claude skill plus a library of reference files. Read all of Part 2 before writing anything.

## What Panel is

Panel is a set of rules, templates, schemas, and recipes that an LLM follows to build a Kirby-quality management panel (login, content lists, item editors, settings) for any project, in any stack, with no CMS engine, no plugins, and no required runtime.

- It is a **specification**, not a CMS, framework, or installable component library.
- Its output is **code the project owns**.
- The closest comparison is shadcn/ui: patterns you copy and own. Panel applies that idea to a whole admin experience and adds judgment about what makes a panel feel right.
- It is **Kirby-inspired**. Kirby's panel is the proof the UX works. Do not copy Kirby's code, CSS, icons, or assets (Kirby is proprietary software). Do not imply affiliation. Describe the UX properties in your own words and build your own implementation.

## What you are producing

The deliverable is a skill folder, plus an eval harness that tests it.

```
panel/
  SKILL.md              router: detects mode, runs the gated workflow
  intake.md             phase zero questions and the intake record format
  schema-guide.md       the rules for reading, writing, and changing schemas
  panel.schema.json     JSON Schema that validates a schema file
  PHILOSOPHY.md         placeholder: see "Philosophy" below
  design-system/
    tokens.css
    components.css
    index.html          living page showing every token and component with states
  templates/
    shell/              layout, nav, breadcrumb header, save bar
    screens/            home, collection, item, create dialog, slide-over, dialog,
                        singleton, login, empty, error
    fields/             one per built-in field type, each with its states
  behavior-spec.md      baseline logic as small testable contracts
  snippets/             tiny optional vanilla interaction files (save state, dialogs)
  flavors/              cookbooks: react.md, vue.md first
  recipes/              google-login.md, json-files.md, local-disk.md first
  examples/             author-login, blog, portfolio, settings-dashboard
  playground.html       single-file schema-driven mockup tool
evals/
  harness, fixtures, and a results report
DECISIONS.md            running log of every call you made on an open question
```

Vanilla (plain HTML, CSS variables, one small owned script) is the **reference implementation**. Flavors (React, Vue, and later others) are cookbooks that build on vanilla and add framework opinions.

## Non-negotiable rules

1. **Contract, not compiler.** The schema does not generate the panel. No renderer reads it at runtime. The LLM writes the panel code using the schema as the brief, then runs conformance checks.
2. **Strict core, open edges.** Defined schema keys and values are validated hard. Flexibility lives behind exactly four doors: `notes`, `behavior`, `x-` keys, and `custom` fields. Never invent a core key, field type, or screen. If something is needed that does not exist, write a proposal.
3. **Blank templates.** Templates contain structure and design system classes only: no sample content, no opinions, no interaction code. A model fills slots and never alters structure or class names.
4. **Playground markup is the real markup.** The playground uses the same templates, class names, and tokens as a real build. Translating a mockup into a build is a mapping, not a rewrite.
5. **No runtime, no dependencies in what Panel ships.** Plain CSS with variables. Plain HTML. One small owned script for vanilla. Dev-time tooling (a validator, the eval harness) may use dependencies, but the shipped skill must not require them. A vanilla panel must be able to bake into a single HTML file.
6. **Behavior is decided at the bottom.** Behavior lives in `behavior-spec.md` and the vanilla reference. Flavors implement it and may not change it. New behavior goes into the spec and vanilla first.
7. **Schema first.** Any change to the data model is made in the schema before the code. Code that changes the model is written back to the schema.
8. **Say no on purpose.** Restraint is a feature. Prefer fewer templates, fewer field types, fewer keys. Add only when a real example forces it.
9. **Accessible by default.** Visible focus states, keyboard operation, semantic HTML, labels tied to inputs, sufficient contrast in both light and dark themes.
10. **Responsive.** Every screen template works at phone width.

## Philosophy: do not invent it

Panel's design philosophy is **deliberately undecided**. The human is going to study a live Kirby panel and derive it from evidence. Do not write one.

- Create `PHILOSOPHY.md` containing: the method (feeling, then the concrete property causing it), the empty observation table, and the hypotheses list from Appendix A as hypotheses, not conclusions.
- Where you must make visual decisions to build the design system, make the smallest reasonable choice, and record each in `DECISIONS.md` tagged `philosophy-dependent` so they can be revisited once the philosophy exists.
- Treat the design system as **Proposed** until the philosophy is written.

## How to handle open decisions

Appendix L lists every open decision. For each one you need to build against:

1. Pick the recommended default given there.
2. Build it so it is cheap to change.
3. Record it in `DECISIONS.md`: the question, what you chose, why, what it would take to reverse it.
4. Mention it in your phase report. Do not stop and wait unless the decision is irreversible and could reasonably go either way.

## Process: gated phases

Work in the phases below, in order. At the end of each phase, run its exit checks, write a short report (what you built, checks passed and failed, decisions made, questions for the human), and **stop for review** before the next phase unless told to continue. Use a task list. Do not build ahead.

**Phase 0: Scaffold.** Create the folder structure, `DECISIONS.md`, and `PHILOSOPHY.md` (placeholder). Copy Part 2 material into the repo as the source of truth under `docs/`. Exit: structure exists, nothing else.

**Phase 1: Design system (vanilla).** Write `tokens.css` and `components.css` and the living `index.html`. Tokens: color (neutral surfaces and text, one accent, separate semantic colors, light and dark themes defined as tokens with `prefers-color-scheme` and `data-theme` overrides), type scale, spacing scale and a form column grid (1/1, 1/2, 1/3, 2/3), radius, focus rings. Components: buttons, text input, textarea, select, radio, checkbox, toggle, tag, tabs, breadcrumb, dialog, drawer, toast, empty state. Every component shows default, hover, focus, disabled, and error. Exit: the living page renders every component and state in both themes with no console errors; keyboard focus is visible everywhere.

**Phase 2: Templates (vanilla, blank).** Build the shell, screens, and field templates from Appendix F. Slots are marked with a consistent, documented convention (for example `data-slot="label"`). Exit: a script strips slot contents from any template and the result is byte-identical across templates of the same kind; each template passes an accessibility lint; each works at 400px width.

**Phase 3: Schema.** Write `schema-guide.md` from Appendices C and D, `panel.schema.json`, and a validator script. Write the four examples in `examples/` (author login, blog, portfolio, settings-only) as schema files. Exit: the validator accepts all four examples, and a test suite of deliberately broken schemas (typo in a core key, missing `panel`, unknown field type, `list.title` naming a missing field, image field with no `files` adapter, no types or singletons) are each rejected with a clear message. `x-` keys, `notes`, and `behavior` are accepted anywhere.

**Phase 4: Behavior spec and snippets.** Write `behavior-spec.md` from Appendix G: save state, dialogs, validation, keyboard shortcuts, create flow, each as a state or rules table. Write the optional vanilla snippets that implement them. Exit: each spec section has browser tests (Playwright) that pass against the vanilla snippets.

**Phase 5: Intake and router.** Write `intake.md` from Appendix E and the top-level `SKILL.md`. The router detects mode (new panel, add a type, change a field, wire a recipe, mockup only), runs intake, then the schema interview (Appendix D), then the gated workflow (intake, schema, preview, build, conformance), loading only the reference files each step needs. Exit: walk the skill by hand on the blog scenario and confirm each step names the file it loads.

**Phase 6: Playground.** Build `playground.html`: a single file that takes a schema and fake data and renders the screens using the real templates and design system. It previews and edits the schema and never edits a real build. Write the playground-to-build translation rule in a short document. Exit: the blog example renders every screen type in the playground; the markup matches the templates.

**Phase 7: Recipes.** Write the three first recipes in the anatomy from Appendix I: `google-login`, `json-files`, `local-disk`. Define the three adapter contracts (auth, data, files) precisely first. Auth recipes get the most explicit steps and a mandatory verification pass. Exit: each recipe has all six anatomy sections and a verification checklist that was actually executed against a small vanilla app.

**Phase 8: Flavors.** Write the React cookbook, then Vue, after vanilla passes conformance. A cookbook holds: where the panel mounts, adapter mapping, style isolation, opinions, pitfalls, and a checklist. Exit: the behavior-spec browser tests pass against the React flavor built from the blog schema.

**Phase 9: Evals.** Build the harness from Appendix J. Run the smallest first experiment: vanilla templates plus the blog schema, run five times in fresh sessions, score consistency and template fidelity. Report results against the kill criterion. Stop and present results regardless of outcome.

## Quality bar for every file you write

- A reference file is written **for an LLM reader**: imperative, unambiguous, with a do/don't example under each rule.
- One file, one job. Keep judgment, vocabulary, and procedure in separate files.
- Keep `SKILL.md` short. It routes. It does not explain.
- Show the exact output a rule produces. Prefer a real snippet over a description.
- Do not pad. If a rule has no testable consequence, cut it or move it to `notes`.

## What to do when blocked or unsure

- Ambiguity that is cheap to reverse: choose, log it in `DECISIONS.md`, continue.
- Anything that contradicts Part 2: stop and ask, quoting both passages.
- Anything that requires a new core key, field type, screen, or component: write a proposal (what is needed, why existing parts cannot do it, the smallest addition) and build the `custom` or omit version meanwhile.
- A check that fails: fix it or raise it. Never skip or weaken a check to pass it.

## Start

Begin with Phase 0. Before creating files, reply with a one-paragraph restatement of what Panel is and is not, and a list of any contradictions or gaps you found in Part 2.

---

# PART 2: REFERENCE MATERIAL

## Appendix A: Philosophy (Open)

The engine decides where content lives. The panel decides how it feels to handle it. Structure is declared, the interface is derived.

**Status: undecided.** The human will derive it by walking a live Kirby panel. Method: for each screen, write the *feeling* and the *concrete property causing it*. When the same property appears repeatedly, it becomes a principle.

Hypotheses (untested, to verify against the real panel):

1. **Low chrome, high calm.** Flat surfaces, almost no shadow, a neutral palette, color reserved for meaning (status, focus, primary action).
2. **Quiet labels, loud content.** Small muted field labels above inputs so the person's content is the heaviest thing on screen.
3. **A width grid for fields.** Half, third, and full widths so forms look composed.
4. **Constant orientation.** A breadcrumb header and the same layout on every view.
5. **Honest save state.** Unsaved changes always visible, with clear save and revert controls and Cmd+S.
6. **Drawers and dialogs keep context.** Edit related things without losing your place.
7. **Status as a first-class control.** Draft and published are one click away.
8. **Tight type scale, consistent density.** Few sizes, even spacing, one icon set.
9. **Speed.** Responses feel instant.

Candidate working principles from the conversation (also unconfirmed): few primitives endlessly composed; content is the color; every screen has the same shape; scale by subtraction; speak human (labels, empty states, and errors written for the editor); state is always honest; no magic and no lock-in; say no on purpose.

Test for any rule once it exists: does it hold on a screen with one field and on a screen with fifty?

## Appendix B: The package

| Part | What it holds | Kind | Status |
| --- | --- | --- | --- |
| Philosophy | Why a panel should feel the way it does | Judgment | Open |
| Screens | The vocabulary of views | Vocabulary | Proposed |
| Design system | Tokens and components with every state | Vocabulary | Proposed |
| Schema | The contract describing what a project manages | Contract | Decided |
| Guidance and checks | notes, behavior, extensions, conformance | Contract | Decided |
| Intake | Phase zero questions that seed the schema | Procedure | Decided |
| Templates | Blank, structure-only HTML the model fills | Vocabulary | Decided |
| Core and flavors | Vanilla reference plus framework cookbooks | Procedure | Decided |
| Recipes | Integrations as guidance, via adapters | Procedure | Proposed |
| Playground | Single-file mockups whose markup is the real markup | Tooling | Proposed |
| Testing | How to find out whether the idea works | Validation | Proposed |

Judgment, vocabulary, and procedure are kept in separate files so the skill does not collapse into one giant prompt.

## Appendix C: The schema (Decided: contract, not compiler)

The schema is one declarative file holding everything Panel needs to know about a project. It is strict about shape and open at the edges. It does not generate the panel.

### Principles

1. Contract, not compiler. No renderer reads the schema. The LLM writes the code and keeps it in sync.
2. Strict core. Defined keys and values are validated hard. A typo is a failure.
3. Open edges. Flexibility lives behind designated doors only.
4. Declarative only. No logic, expressions, or code in the schema.
5. Schema first. Data model changes are made in the schema before the code.
6. Say no on purpose. If the schema cannot express a request, propose an extension. Do not invent a core key.

### Format (Proposed)

Author in YAML, validate as JSON (YAML parses to JSON, so one JSON Schema checks it). For single-file builds, the JSON form is embedded in the HTML. JSON-first is the alternative if model errors are the main worry.

Style rules (Decided):

- One property per line. No inline braces such as `{ name: title, type: text }`.
- A blank line between fields, so each field is a small block that can be added, removed, or reordered alone.
- Quote only values YAML could misread (`"no"`, `"yes"`, `"on"`).
- Comments are for humans only. Instructions for the LLM go in `notes` or `behavior`.
- Line one is `panel: 1`. A schema without it is invalid.

### Top-level keys

| Key | Required | Purpose |
| --- | --- | --- |
| `panel` | Yes | Schema version, an integer. Must be the first line. |
| `name` | Yes | The project's display name. |
| `auth` | Yes | Which recipe handles login and who is allowed in. `none` is valid when stated explicitly. |
| `data` | Yes | Which recipe stores and reads content, plus its settings. |
| `files` | No | Which recipe stores uploads. Required if any field is `image` or `file`. |
| `types` | No | Collections: many items of one kind. |
| `singletons` | No | One-of-a-kind items. |
| `conformance` | No | Extra checks added to the defaults. |
| `notes` | No | Freeform intent for the whole project. |
| `behavior` | No | Specific functionality across the whole panel. |

At least one entry in `types` or `singletons` is required. Every adapter names a `recipe` that exists in the recipes library. No other top-level keys are allowed except `x-` keys.

### Types and singletons

A type is a collection and a singleton is a single item. Both are described the same way. A singleton has no list view, no create flow, and no `list`, `sort`, or `status`.

| Key | Applies to | Purpose |
| --- | --- | --- |
| `id` | Both | Machine name. Lowercase, singular, no spaces, unique across the schema. |
| `label` | Both | Human name shown in the panel. Plural for types. |
| `fields` | Both | The list of fields. At least one. |
| `status` | Types | Ordered states an item can be in. The first is where new items start. Omit if no workflow. |
| `list` | Types | `title`, `subtitle`, `sort` (prefix `-` for descending), `search` (list of field names). |
| `notes`, `behavior` | Both | Freeform guidance. |

Rules: `list.title` must name an existing field. `sort` and `search` entries must name real fields.

**How a singleton works.** Its nav entry opens straight to the item view with no collection list. No create flow and no delete, because the item always exists. The data adapter keeps one record for it (for example `content/settings.json` with the JSON files recipe). A site or app reads it by `id`. With no record yet, the panel shows the form with `default` values and the first save creates it. Rule of thumb: if you would say "the" (the homepage, the footer), it is a singleton. If you would say "a" or "all", it is a type.

### Fields

Every field has `name` and `type`. Everything else is optional.

| Property | Purpose |
| --- | --- |
| `name` | Machine name. Lowercase with underscores, unique within its type. |
| `type` | A built-in field type, or `custom`. |
| `label` | Display name. Derived from `name` if omitted. |
| `required` | An item cannot be saved or published without a value. Default `false`. |
| `default` | Value for new items. Must match the field type. |
| `width` | Column span in the form grid: `1/1`, `1/2`, `1/3`, `2/3`. Default `1/1`. |
| `help` | Short text under the field for editors. |
| `notes`, `behavior` | Freeform guidance. |

Type-specific properties are allowed only on the types that define them: `from` on `slug`, `options` on `select`, `to` on `relation`, `min` and `max` on `number`.

Starting set of built-in field types (Proposed):

| Type | Holds |
| --- | --- |
| `text` | A single line of text |
| `textarea` | Multi-line plain text |
| `markdown` | Long-form formatted text |
| `number` | A number, with optional `min` and `max` |
| `date` | A date, with optional time |
| `toggle` | True or false |
| `select` | One choice from `options` |
| `tags` | A free list of short labels |
| `slug` | A URL-safe string, usually derived with `from` |
| `image` | One uploaded image |
| `file` | One uploaded file |
| `relation` | A link to an item of another type, named by `to` |
| `custom` | Anything else, described in `describe` |

### Complete example: a simple blog

```yaml
panel: 1
name: Field Notes

auth:
  recipe: google-login
  allow:
    - me@example.com

data:
  recipe: json-files
  path: ./content

files:
  recipe: local-disk
  path: ./uploads

types:
  - id: post
    label: Posts
    notes: Long-form writing. The editor should feel like a quiet page, not a form.
    behavior: |
      - Autosave drafts every 10 seconds
      - Show word count under the body field
      - Publishing asks for confirmation
    status:
      - draft
      - published
    list:
      title: title
      subtitle: date
      sort: -date
      search:
        - title
    fields:
      - name: title
        type: text
        required: true
        width: 1/1

      - name: slug
        type: slug
        from: title
        width: 1/2

      - name: date
        type: date
        required: true
        width: 1/2

      - name: cover
        type: image
        width: 1/2

      - name: tags
        type: tags
        width: 1/2

      - name: body
        type: markdown
        required: true
        width: 1/1
        behavior: Toolbar hidden until text is selected.

      - name: reading_time
        type: custom
        describe: Read-only. Estimated minutes to read, from the word count of body.
        x-priority: low

singletons:
  - id: settings
    label: Site settings
    fields:
      - name: site_title
        type: text
        required: true

      - name: description
        type: textarea

conformance:
  - Publishing a post requires a cover image.
```

### Smallest example: author login

```yaml
panel: 1
name: Author

auth:
  recipe: google-login
  allow:
    - me@example.com

data:
  recipe: json-files
  path: ./content

singletons:
  - id: profile
    label: Profile
    fields:
      - name: title
        type: text
        required: true
```

## Appendix D: Guidance, extensions, conformance, and designing with a user (Decided)

### notes and behavior

`notes` says why and `behavior` says what. Both are plain Markdown strings, allowed at any level (project, type, singleton, field), ignored by the validator, and read by the LLM as part of the brief.

| Key | Holds | Example |
| --- | --- | --- |
| `notes` | Intent, feel, context | "Long-form writing. The editor should feel like a quiet page, not a form." |
| `behavior` | Concrete functionality to build | "Autosave drafts every 10 seconds." |

Scope: guidance applies to the level where it is written and everything beneath it. A `behavior` on a type covers that type's fields unless a field overrides it.

How an LLM treats guidance:

- Read all guidance before building anything it touches.
- Each `behavior` line is a requirement, checked at conformance time.
- `notes` direct judgment calls and are not requirements.
- If guidance conflicts with the strict core, the core wins and the LLM says so.
- If guidance asks for something the design system cannot express, propose an extension.

How to write good guidance: one instruction per `behavior` line; specific and testable ("Show word count under the body" works, "make writing pleasant" does not); feel and reasoning in `notes`; `behavior` limited to what can be checked by using the panel.

### Extension points (use in this order)

1. **Guidance.** If the need is about how something should feel or act, use `notes` or `behavior`.
2. **Custom field.** If a field holds something no built-in type does, use `type: custom` with a `describe` line. The LLM builds it from existing design system components.
3. **`x-` keys.** Allowed anywhere and ignored by the validator, for tool metadata such as `x-priority`. They never carry instructions.

When a request needs a screen, field type, or component Panel does not have, the LLM does not invent a core key. It writes a short proposal: what is needed, why existing parts cannot do it, and the smallest addition. Until approved, the feature is built as a `custom` field or left out.

### Conformance

The check that the code still matches the contract. Because the schema does not generate the panel, this is what stops drift. It runs after the first build, after any schema change, and before any claim that the panel is done. The LLM reports each check as passed or failed. A failed check is fixed or raised with the human, never skipped.

Default checks:

- Every type has a collection view, an item view, and a create flow.
- Every singleton has an item view.
- Every field appears in its item view with the declared type, width, and required rule.
- Every `list.title`, `sort`, and `search` entry names a real field.
- Every adapter resolves to an existing recipe.
- Every `behavior` line is implemented and can be demonstrated.
- No core key appears that the schema guide does not define.

Project-specific checks go under the top-level `conformance` key as plain sentences, one per line.

### Designing a schema with a user

The LLM is a collaborator on the schema, not just a typist. Follow in order:

1. **Interview.** One question at a time with a sensible default each. A schema is not buildable until these have answers or an explicit "none": What is being managed and what does one item look like? Who uses the panel and how do they log in? Where does the data live and where do files live? What statuses can an item have? How should each collection appear in a list (title, subtitle, sort, search)? Which items are singletons rather than collections? Which types relate to each other?
2. **Draft.** Write the schema from the answers in the vertical style, with `notes` capturing intent in the user's own words.
3. **Critique.** Review for gaps before showing it: a type with no `list.title`, a `relation` with no `to`, a login with no allow list, an image field with no `files` adapter.
4. **Validate.** Check against the JSON Schema. Fix failures before the user sees it.
5. **Preview.** Render in the playground so the user reacts to a panel, not a file.
6. **Revise by proposal.** Later changes arrive as small diffs with a one-line reason each. Never edit silently. Never change more than was asked.

Do: prefer fewer types and fields; reuse built-in types before `custom`; use the user's own words for labels. Don't: invent core keys or field types; put instructions in YAML comments; fill a required answer with a guess (ask, or record it as an open question).

## Appendix E: Intake (Decided)

Intake is phase zero of the core vanilla skill. It asks the questions that settle stack, adapters, and shape before any schema or code exists. It handles multiple-choice facts. The schema interview that follows stays conversational because content design is open-ended.

### Rules

1. **Detect before asking.** If the project already shows its stack, record it and skip the question.
2. **Use the multiple-choice question tool.** Up to four questions per call, a free-text "Other" option on each, the recommended default listed first.
3. **Branch between rounds.** Later rounds depend on earlier answers.
4. **Keep open-ended questions in chat.** "What are you managing?" is plain conversation, not a multiple-choice card.
5. **Play it back.** End with a short summary the person confirms, then write the intake record.
6. **Never ask twice.** Intake answers pre-fill the schema's required questions.

### Detection

| Found | Infer |
| --- | --- |
| `manage.py` | Django, existing models and auth |
| `Gemfile` with rails | Rails, existing models and auth |
| `composer.json` with laravel | Laravel, existing models and auth |
| `_config.yml` or a jekyll gem | Jekyll, content is files, no server |
| `hugo.toml` or `config.toml` | Hugo, content is files, no server |
| `.eleventy.js` | Eleventy, content is files, no server |
| `pelicanconf.py` | Pelican, content is files, no server |
| `package.json` with react, vue, svelte, next, nuxt, or astro | That framework |
| Nothing | A new project |

### Rounds

**Round 1: Situation**

| Question | Options |
| --- | --- |
| New project or existing? | New project · Add to an existing project |
| Which flavor? | Vanilla, single file (recommended) · React · Vue · Other (Django, a static site generator) |
| Who will use the panel? | Just me · A small team · Clients or the public |

Asked in chat: what is being managed, in the person's own words.

**Round 2: Adapters**

| Question | Options |
| --- | --- |
| How do people log in? | Google login · Email link · No login, local only · The host app's existing auth |
| Where does the data live? | JSON files · Postgres · Supabase · The host app's existing database |
| Where do uploaded files live? | Local disk · Cloud storage · No uploads |
| Where does the panel mount? | A standalone page · A route in the host app · A separate subdomain |

**Round 3: Shape**

| Question | Options |
| --- | --- |
| What kinds of content? (pick any) | Collections of items · One-off pages · Both |
| Do items have statuses? | Draft and published (recommended) · Custom statuses · No statuses |

Asked in chat: any special behavior the panel should have.

**Round 4: Existing projects only**

| Question | Options |
| --- | --- |
| How should the schema relate to existing data? | Derive it from existing models or folders (recommended) · Define new data · A mix |
| How should panel styles be kept from colliding with the host app? | Scoped CSS (recommended) · Prefixed classes · Isolated frame |

Asked in chat: which parts of the host app the panel must not touch.

### Branching

- Static site generators default the data adapter to files or git and the auth adapter to the edge (for example GitHub login). "Publish" means a commit and a rebuild.
- Server frameworks default to the host's existing auth and database, and always run Round 4.
- A new project skips Round 4.

### The intake record

Intake ends by writing a small file that seeds the schema.

```yaml
intake: 1

situation:
  mode: existing
  stack: django
  flavor: vanilla
  users: team

adapters:
  auth: existing
  data: existing-models
  files: local-disk
  mount: route

shape:
  collections: true
  singletons: true
  status:
    - draft
    - published

existing:
  binding: derive-from-models
  style: scoped
  off_limits:
    - billing

open_questions: []
```

### When the question tool is unavailable

In unattended runs, or where the tool is not offered, the skill states its assumptions at the top of its work, records them in the intake record, and continues. The one exception is a decision that cannot be undone and could reasonably go either way: prepare the work, set out the decision, and stop.

Known gap: the `binding` field has no counterpart in the schema yet. Deriving a schema from existing models needs a defined way to say which model, table, or folder a type maps to (Open).

## Appendix F: Screens and templates

### Screens (Proposed: a starting vocabulary, not a cage)

| Screen | Purpose |
| --- | --- |
| Home | The landing view after login. A launchpad of content types, recent activity, shortcuts. |
| Collection | All items of one type as a list, table, or cards, with search, sort, and an add button. |
| Item | The editor for one item. Fields in the main area, status and meta in a sidebar. |
| Create flow | A small dialog asking for the minimum, then dropping into the item view. |
| Slide-over | Quick edits that do not deserve a full page: settings, a related item, a file picker. |
| Dialog | Confirmations and small decisions: delete, rename, publish. |
| Singleton | A one-of-a-kind page such as site settings. An item view with no collection. |
| System | Login, empty states, errors, permission screens. |

Each screen type must handle **loading, empty, unsaved, and error** states and show which is active. Still to define per screen: layout regions, which actions appear where and in what order, keyboard behavior, phone-width behavior.

### Templates (Decided: blank, structure-only)

Each template is valid HTML using the design system's classes, with named slots and no content, sample data, or opinions. The model copies one verbatim and changes only the slots.

Rules:

- Structure and class names are never altered. If something does not fit, that is a proposal for a new template, not an edit.
- Slots are filled from the schema (`label`, `width`, `required`) and from `notes` and `behavior`.
- Templates are plain HTML so the playground renders them as they are.

The set:

| Group | Templates |
| --- | --- |
| Shell | Layout, navigation, breadcrumb header, save bar |
| Screens | Home, collection, item, create dialog, slide-over, dialog, singleton, login, empty, error |
| Fields | One per built-in field type, each with its states |
| Styles | Tokens and component CSS from the design system |

Open: whether templates carry interaction code. Lean (the default to implement): markup-only templates plus a few tiny optional interaction snippets (save state, dialog open and close) in separate files.

### Design system (Proposed)

One page defines how everything looks. The playground and every real build pull from it.

- **Tokens:** color (neutral surfaces and text, one accent, separate semantic colors for status, light and dark), type (a tight scale with few sizes plus a utility face for data), space (an even scale and the form column grid), shape (radius, borders, focus rings). All CSS variables.
- **Components:** buttons, text inputs, textareas, selects, radios, checkboxes, toggles, tags, tabs, breadcrumbs, dialogs, drawers, toasts, empty states.
- **States:** every component documents default, hover, focus, disabled, and error.
- **Rules:** plain CSS with variables, no preprocessor or framework. Where accessible behavior is needed (menus, dialogs, comboboxes), a recipe may name an optional headless library, never a core dependency. Color is reserved for meaning: status, focus, and the primary action.

## Appendix G: Core, flavors, and the behavior spec (Decided)

### Layers

| Layer | What it holds |
| --- | --- |
| Shared core | Schema, schema guide, intake, design tokens and CSS, adapter contracts, recipes, the behavior spec |
| Vanilla | Plain HTML plus one small owned script implementing the behavior spec directly. The reference. Can embed in a single file. |
| Flavors | React, Vue, and others. Templates in the framework's syntax plus conventions for state, routing, and file layout. |

Behavior is decided at the bottom. A flavor cannot change what vanilla and the behavior spec define. New behavior goes into vanilla and the spec first, then into the flavors, so they cannot quietly diverge. "Non-runtime" means no framework and no dependencies: plain HTML plus one small owned script. Fully script-free is possible only for the simplest panels and is a special case, not the baseline.

### The behavior spec

Baseline logic is written as small, testable contracts in plain language, not as code. Conformance checks every flavor against them. Save state is the first:

| State | Entered when | Shows | Exits to |
| --- | --- | --- | --- |
| clean | Item loads, or save succeeds | Save disabled | dirty |
| dirty | Any field changes | Unsaved marker, Save and Revert enabled | saving, clean (revert) |
| saving | Save pressed, or Cmd+S | Spinner, fields locked | clean, error |
| error | Save fails | Error message, edits kept | saving, dirty |

To be written in the same form: dialogs (open, close, focus trap, escape), validation (when errors appear and what blocks save), keyboard shortcuts, and the create flow. Each section gets browser tests (Playwright) that run against vanilla and, later, each flavor.

### Cookbooks (flavors)

A cookbook holds, in this shape:

1. Where the panel mounts (a route, a subdomain, a separate app)
2. How the three adapters map onto the stack's existing auth, data, and files
3. How to keep panel styles from colliding with the host app
4. Opinions: the choices it makes for you, such as state approach and file layout
5. Pitfalls (the framework-specific ways a model usually breaks the spec) and a verification checklist

Planned cookbooks: UI frameworks (React, Vue, Svelte); meta-frameworks (Next.js, Nuxt, SvelteKit, Astro); server frameworks (Django, Rails, Laravel); static site generators (Jekyll, Hugo, Eleventy, Pelican). **React and Vue first.**

Adding a panel to an existing project:

- The schema **describes** existing data and does not define it. A Django project already has models, and a second source of truth would drift. Intake derives the schema from them (needs the open binding concept).
- Static site generators are a different shape: no server, content is files. The panel edits Markdown and front matter, "publish" means a commit and a rebuild, and auth sits at the edge. This is also the closest fit to the no-runtime goal.

## Appendix H: Adapters (Proposed)

The panel never knows which service it is talking to. Recipes plug into three adapters.

| Adapter | Question it answers | Example recipes |
| --- | --- | --- |
| Auth | Who is logged in, and what can they do? | Google login, email link, none |
| Data | How are items read, written, and listed? | JSON files, Postgres, Supabase |
| Files | How is media uploaded and served? | Local disk, R2, S3 |

Define each adapter's contract precisely (functions, inputs, outputs, error cases) before writing any recipe. Recipes depend on stable contracts.

## Appendix I: Recipes (Proposed)

A recipe is a plugin you read instead of install. Where a normal plugin ships code, a recipe ships instructions an LLM follows to connect the panel to a service, so the result is code the project owns and can adapt.

Anatomy of every recipe:

1. When to use it, and what it replaces
2. Prerequisites: accounts, keys, environment variables
3. The adapter contract it fulfills
4. Steps, with decision points ("if the person wants roles, then...")
5. A verification checklist (log in, create an item, refresh, it persists)
6. Known pitfalls

First three: `google-login`, `json-files`, `local-disk`. Together they cover the simplest case end to end. Auth code generated per project is the riskiest part of the whole system: auth recipes need the most explicit steps, the most pitfalls, and a mandatory verification pass. Later recipes: email link, Postgres, Supabase, R2 and S3, and the framework-specific mappings.

## Appendix J: Playground, testing, and the eval plan (Proposed)

### Playground

The Panel Playground is a single HTML file for mocking up a panel. Its markup is the real markup, so a mockup translates to the real build by mapping and not by rewriting. This works only if:

- **One component vocabulary:** the same names, classes, and structure in the playground and in production.
- **One theme:** CSS variables are shared.
- **Declarative mockups:** a mockup is essentially a schema plus fake data.
- **A written translation rule:** the mapping from playground HTML to a real build is documented.

The playground previews and edits the **schema**. Code cannot be parsed back into a schema, so the playground never edits a real build directly.

### Risks

- **Determinism.** A small hand-written engine is more reliable than code regenerated on every build.
- **Security.** Per-project generated auth is the riskiest piece.
- **Maintenance.** The schema guide, templates, behavior spec, and flavors can drift apart.
- **Competition.** Decap, Directus, react-admin, and Kirby itself solve adjacent problems. Panel must beat them on Kirby-quality UX, no runtime, and LLM-native editing.

The whole system rests on one assumption: an LLM can build a panel from a contract and get something consistent and correct every time.

### Tests (cheapest first)

| Test | What it checks |
| --- | --- |
| Consistency | The same schema through 5 to 10 fresh sessions. Compare screenshots, DOM structure, and conformance pass rate. |
| Template fidelity | Strip slot contents from the output and diff against the templates. Any structural change is a failure. Automatable. |
| Variety | Four contrasting schemas: author login, blog, portfolio, settings-only. |
| Change stability | A series of edits: add a field, add a type, change a status. Look for drift and small diffs. |
| Model robustness | Smaller and different models. If only the top one works, the system is fragile. |
| Cross-flavor | The behavior spec as browser tests, run against vanilla and React from the same schema. |
| Cold user | Someone other than the author uses the skill with no coaching. |
| Baseline | Compare against prompting "build a Kirby-style admin" with no skill. If the skill does not clearly win, it is not earning its complexity. |

**Smallest first experiment:** vanilla templates plus the blog schema, run five times in fresh sessions, scoring consistency and template fidelity.

**Proposed kill criterion:** if fewer than 80 percent of runs pass conformance with unmodified templates, stop and rethink before building more.

## Appendix K: Skill architecture decisions (Decided unless noted)

- **Code comes from owned snippets** (shadcn-style): the design system ships real CSS and HTML patterns for each component and screen, and the model assembles them. Not from scratch each time, not from a copyable starter app.
- **Router plus reference files:** a short `SKILL.md` detects the task and loads only what is needed. It can split into separate skills later (Open).
- **Gated workflow:** intake, schema, preview in the playground, build, conformance. The router first detects mode: new panel, add a type, change a field, wire a recipe, mockup only. Each mode skips different phases.
- **Verification:** conformance run by the building model is the baseline. A separate fresh-eyes reviewer (a subagent or a second pass that sees only the schema and the output) is optional for large builds.
- **Visual editing:** the playground edits the schema, and the LLM implements the result.

## Appendix L: Decision log

Defaults to implement for the open items are in the last column.

| Decision | Status | Default or note |
| --- | --- | --- |
| Panel is a specification, not a CMS or runtime. Name: Panel. | Decided | |
| Schema is a contract, not a compiler | Decided | |
| Vertical, one-property-per-line schema style | Decided | |
| `notes` and `behavior` as the freeform vocabulary | Decided | |
| Blank templates as shipped snippets | Decided | |
| Vanilla is the base reference, flavors build on it | Decided | React and Vue first |
| Intake is phase zero of the core skill | Decided | |
| Authoring in YAML, validated as JSON | Proposed | Build YAML-first with a JSON Schema; keep JSON embeddable |
| Starting set of field types | Proposed | Use the table in Appendix C |
| Kill criterion of 80 percent conformance | Proposed | |
| Philosophy | Open | Do not invent. Placeholder only. Tag affected design choices `philosophy-dependent`. |
| One schema file or one file per type | Open | Single `panel.yaml` first; make the validator accept a directory later |
| Roles and permissions in the schema | Open | Out of scope for the first build. Log it. |
| Binding to existing models or folders | Open | Out of scope for the first build. Do not implement. Log it. |
| Interaction code in templates | Open | Markup-only templates plus optional snippets |
| Flavors as folders or separate skills | Open | Folders inside one skill |
| Whether flavors may ship extras | Open | No. Spec and vanilla first. |
| Validation tooling | Open | Node script with a JSON Schema validator, dev-time only |
| Recipe registry and schema versioning | Open | A simple `recipes/index.json` listing valid names; schema version is the `panel` integer |
| Repeatable and nested fields | Open | Out of scope for the first build. Log it. |
| Relation cardinality and broken links | Open | Single-link relations only. Log it. |

---

*Compiled 2026-11-01 from the Panel design conversation. A browsable version of this material also exists as the Panel Docs site and the Panel and Panel schema guide docs.*
