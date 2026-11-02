# Intake

Intake is step one of a new panel. It settles the stack, the adapters, and the shape before any schema or code exists. It ends with an intake record, `panel.intake.yaml`, that seeds the schema interview in `schema-guide.md`.

Intake asks multiple-choice facts. What the person manages, and how it should behave, stay in plain conversation.

## Rule 1: Detect before you ask

Read the project first. Record what it already shows, and skip the question it answers.

| Found | Record |
| --- | --- |
| `manage.py` | `stack: django`. Existing models and auth. |
| `Gemfile` with `rails` | `stack: rails`. Existing models and auth. |
| `composer.json` with `laravel` | `stack: laravel`. Existing models and auth. |
| `_config.yml`, or a `jekyll` gem | `stack: jekyll`. Content is files. No server. |
| `hugo.toml`, or `config.toml` with Hugo keys | `stack: hugo`. Content is files. No server. |
| `.eleventy.js` or `eleventy.config.js` | `stack: eleventy`. Content is files. No server. |
| `pelicanconf.py` | `stack: pelican`. Content is files. No server. |
| `package.json` with `next`, `nuxt`, `astro`, `react`, `vue`, or `svelte` | That framework, checked in that order (Next before React). |
| Nothing | `mode: new`. A new project. |

Do: see `package.json` with `"react"` and `"vite"`, record `stack: react`, `flavor: react`, `host_shape: vite-spa`, and skip "Which flavor?".
Don't: ask "Are you using React?" when `package.json` says so.

## Rule 2: For an existing project, build the host profile

The host decides how the code is written. Panel decides what the panel does and how it looks. Read these from the project, without asking, and write them under `host:` in the record:

| Key | Read from |
| --- | --- |
| `language` | File extensions, `tsconfig.json` |
| `framework`, `host_shape` | `package.json`, framework config files (`vite.config.*`, `next.config.*`) |
| `router` | Dependencies (`react-router`, `vue-router`), or a file-based `app/` or `pages/` folder |
| `styling` | Tailwind config, CSS modules, a CSS-in-JS dependency, plain CSS |
| `component_library` | Dependencies such as `@mui/material` or `@radix-ui/*`. Recorded so the panel avoids it. |
| `data_layer` | `@tanstack/react-query`, `swr`, an ORM, a `fetch` wrapper in the code |
| `auth` | An existing auth library or middleware |
| `layout` | Where routes, components, and tests live |
| `naming` | File naming (`PostList.tsx`, `post-list.tsx`) |
| `package_manager` | The lockfile |
| `tests`, `lint` | The test runner and lint config |

The build follows the host for language, file layout, naming, router and mount, data fetching and state, tests, and lint. It keeps Panel's screens, template structure, behavior spec, accessibility rules, and the `pn-` look. The panel never uses the host's component library.

Do: in a TypeScript project with `src/routes/` and kebab-case files, write `src/routes/panel/post-list.tsx`.
Don't: write `panel/PostList.jsx` because the React flavor's fallback layout says so.

## Rule 3: Ask with the question tool, up to four questions per call

Each question offers a free-text "Other", and lists the recommended option first. Ask one round per call.

Do: one call with the four Round 2 questions.
Don't: ask "What are you managing?" as a multiple-choice card. That is Round 1's chat question.

### Round 1: Situation

| Question | Options |
| --- | --- |
| New project or existing? | New project · Add to an existing project |
| Which flavor? | Vanilla, single file (recommended) · React · Vue · Other (Django, a static site generator) |
| Who will use the panel? | Just me · A small team · Clients or the public |

Then ask in chat: "What will the panel manage? Describe it in your own words." Keep the answer's wording; it becomes `notes` and labels.

### Round 2: Adapters

| Question | Options |
| --- | --- |
| How do people log in? | Google login · Email link · No login, local only · The host app's existing auth |
| Where does the data live? | JSON files · Postgres · Supabase · The host app's existing database |
| Where do uploaded files live? | Local disk · Cloud storage (S3 or R2) · No uploads |
| Where does the panel mount? | A standalone page · A route in the host app · A separate subdomain |

When the answer is JSON files or local disk, ask how files get written (D-003), as one more card:

| Question | Options |
| --- | --- |
| How should the panel write files? | A small Node server in the project (recommended when there is login) · The browser's file access (Chromium only) · Commit to GitHub · Download the edited file · Browser storage (mockups only) |

### Round 3: Shape

| Question | Options |
| --- | --- |
| What kinds of content? (pick any) | Collections of items · One-off pages · Both |
| Do items have statuses? | Draft and published (recommended) · Custom statuses · No statuses |

Then ask in chat: "Anything special the panel should do? For example, autosave, or asking before publishing." Each answer becomes a `behavior` line later.

### Round 4: Existing projects only

| Question | Options |
| --- | --- |
| How should the schema relate to existing data? | Derive it from existing models or folders (recommended) · Define new data · A mix |
| How should panel styles be kept from colliding with the host app? | Scoped CSS (recommended) · Prefixed classes · Isolated frame |

Then ask in chat: "Which parts of the app must the panel not touch?"

## Rule 4: Branch between rounds

- A new project skips Round 4.
- A server framework (Django, Rails, Laravel) defaults login and data to the host's existing setup, and always runs Round 4.
- A static site generator defaults data to files committed with git, and login to the edge (for example GitHub login). "Publish" means a commit and a rebuild. Say so in the playback.
- "No login, local only" sets `auth: recipe: none`. Warn once if the panel will be reachable on a network.
- "No uploads" means no `files` block, and no `image` or `file` fields later.
- A recommended option you already detected is recorded, not asked.

Do: after "Add to an existing project" in a Django project, skip the login and data questions, record `auth: django-auth` and `data: django-models`, and run Round 4.
Don't: offer "JSON files" to a Django project as the recommended data option.

## Rule 5: Map every answer to a recipe

| Answer | Recipe |
| --- | --- |
| Google login | `google-login` |
| Email link | `email-link` |
| No login, local only | `none` |
| JSON files | `json-files` |
| Postgres | `postgres` |
| Supabase | `supabase` |
| Local disk | `local-disk` |
| Cloud storage | `s3` or `r2` (ask which) |
| The host app's existing auth or database | The host recipe for the stack, for example `django-auth`. If none exists in `recipes/index.json`, record it under `open_questions` and stop before building that adapter. |

Never improvise an adapter that has no recipe. Auth least of all.

## Rule 6: Play it back, then write the record

End with a short summary in plain words, and ask the person to confirm it. Then write `panel.intake.yaml` at the project root.

Do:

> A panel for your blog, Field Notes, used by you. Google login for me@example.com. Posts stored as JSON files in `./content`, images in `./uploads`, written by a small Node server. Posts are draft or published. Plus one settings page. Right?

Don't: paste the YAML record as the playback.

### The intake record

```yaml
intake: 1

situation:
  mode: new                # new | existing
  stack: none              # none | react | vue | next | django | jekyll | ...
  flavor: vanilla          # vanilla | react | vue
  users: me                # me | team | public
  manages: A personal blog of long-form posts, plus a site settings page.

adapters:
  auth: google-login       # a recipe name from recipes/index.json
  data: json-files
  files: local-disk        # omit when there are no uploads
  via: server              # how files get written (D-003)
  mount: standalone        # standalone | route | subdomain

shape:
  collections: true
  singletons: true
  status:
    - draft
    - published
  behavior:
    - Autosave drafts every 10 seconds

host:                      # existing projects only (Rule 2)
  language: typescript
  framework: react
  host_shape: vite-spa
  router: react-router
  styling: tailwind
  component_library: none
  data_layer: tanstack-query
  auth: none
  layout: src/routes, src/components
  naming: kebab-case
  package_manager: pnpm
  tests: vitest
  lint: eslint

existing:                  # existing projects only (Round 4)
  binding: define-new      # derive-from-models | define-new | mix
  style: scoped            # scoped | prefixed | frame
  off_limits:
    - billing

open_questions: []
```

`binding: derive-from-models` has no counterpart in the schema yet (Appendix E, known gap). Record it, define new data for now, and add an open question.

## Rule 7: Never ask twice

The schema interview reads the record first. It does not ask again what intake already answered: login, data, files, statuses, whether singletons exist.

## When the question tool is unavailable

In an unattended run, or where the tool is not offered, choose the recommended option for each question, list your assumptions at the top of your work, record them under `open_questions` with `assumed: true`, and continue.

```yaml
open_questions:
  - question: Who will use the panel?
    assumed: true
    answer: me
```

The one exception: a decision that cannot be undone and could reasonably go either way, such as choosing a production database or deleting existing data. Prepare the work, set out the decision, and stop.
