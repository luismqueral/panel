# Panel

Panel is a skill that lets an AI coding agent build the admin side of a project: sign-in, content lists, item editors, and settings. It works in any stack, with no CMS, no plugins, and no runtime to install.

It is a specification, not a CMS or a component library. The agent reads the rules, templates, and recipes in `panel/`, writes the panel's code into your project, and checks the result against the spec. The code it writes is yours. The closest comparison is shadcn/ui: patterns you copy and own, applied to a whole admin experience.

Panel is inspired by the calm, schema-driven editing experience of Kirby's panel. It contains no Kirby code, styles, icons, or assets, and it is not affiliated with Kirby.

## How it works

1. **Intake.** The agent asks what you're building: the stack, who signs in, and where content and files live.
2. **Schema.** It writes `panel.yaml`: your content types, their fields and statuses, any one-off pages, and which login, data, and file recipes to use. The schema is the contract; nothing generates the panel from it.
3. **Preview.** It builds `playground.html`, every screen of your panel filled with sample content, for you to review before any real code exists.
4. **Build.** It copies the blank templates, design system, and snippets unchanged, then writes the code that connects them to your schema and recipes.
5. **Conformance.** It walks every check in the spec and writes `CONFORMANCE.md`. A failed check is fixed or reported, never skipped.

A small schema looks like this:

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

types:
  - id: post
    label: Posts
    behavior: |
      - Publishing asks for confirmation
    status:
      - draft
      - published
    list:
      title: title
    fields:
      - name: title
        type: text
        required: true

      - name: body
        type: markdown
```

## Using it

Copy the `panel/` folder into your agent's skills folder (for example `~/.claude/skills/panel/` for Claude Code, or `.cursor/skills/panel/` in a project for Cursor). Then ask for an admin panel, a content editor, or a change to an existing one. `panel/SKILL.md` picks the mode:

| You want | Mode |
| --- | --- |
| A panel, and the project has no `panel.yaml` | New panel |
| A new content type | Add a type |
| To add, remove, or change fields, statuses, or lists | Change a field |
| To connect or swap login, data, or file storage | Wire a recipe |
| To see a panel without building it | Mockup only |

The schema validator, `tools/validate.mjs`, lives in this repository rather than in `panel/`. Run it with `node tools/validate.mjs path/to/panel.yaml`.

## What's in the skill

| Path | What it is |
| --- | --- |
| `panel/SKILL.md` | The router: picks the mode and the steps, and loads only the files each step needs |
| `panel/intake.md` | The intake questions and the intake record format |
| `panel/schema-guide.md`, `panel/panel.schema.json` | The rules for writing and changing a schema, and the JSON Schema that validates it |
| `panel/playground.md` | How to build the preview page |
| `panel/build.md` | How to build the panel, step by step |
| `panel/behavior-spec.md` | Baseline behavior as small testable rules: saving, checks, dialogs, keyboard |
| `panel/templates/` | Blank HTML templates: the shell, 10 screens, and one per field type |
| `panel/design-system/` | Tokens and components, scoped so they don't leak into your site |
| `panel/snippets/` | Small optional scripts: save state, dialogs, create flow, keyboard, toasts |
| `panel/recipes/` | How to connect login, data, and file storage, with shared client and server code |
| `panel/flavors/` | Cookbooks for React and Vue on top of the plain HTML reference |
| `panel/examples/` | Example schemas: blog, portfolio, settings dashboard, author login |

**Field types:** text, textarea, markdown, number, date, toggle, select, tags, slug, image, file, relation, and custom.

**Recipes:**

| Kind | Verified | Written, not yet verified |
| --- | --- | --- |
| Login | `none` (one "View panel" button, for local use), `password` (one shared password), `google-login` | `email-link` |
| Data | `json-files`, `postgres` (by hand; see its recipe) | `supabase` |
| Files | `local-disk` | `s3`, `r2` |

A recipe is a plugin you read instead of install: instructions the agent follows, plus tested code it copies. If no recipe fits, the agent stops and says so rather than improvising one.

## Developing Panel

```bash
npm install
npm run -s test:schema            # the schema validator
npm run -s check:templates        # templates and design system agree
npm run -s check:design-system    # components, dark mode, 400px width
npm run -s test:recipes           # recipes against a real server
npm run -s test:behavior          # behavior tests on the reference blog build
npm run -s test:behavior:react    # the same tests on the React build
npm run preview                   # the templates filled with sample data, in a browser
```

The shipped skill has no runtime dependencies; the packages above are for testing it.

`evals/README.md` explains the tests and how to run experiments, where fresh agent sessions build a panel from a prompt using only the skill. In the latest blog experiment, 5 of 5 sessions passed all 67 tests. In later experiments, sessions designed their own schemas from a plain request; the gaps they found are logged in `DECISIONS.md`.

| Path | What it is |
| --- | --- |
| `docs/BRIEF.md` | The build brief: what Panel is and every rule it follows |
| `DECISIONS.md` | Every call made on an open question, numbered (D-001 onward) |
| `proposals/` | Proposed additions to the skill, in the format `schema-guide.md` section 7 describes |
| `docs/EVALS-PLAN.md` | The plan for moving experiments to Harbor |

## Status

Panel is in active development. `panel/PHILOSOPHY.md` is not written yet: it will be drawn from close study of a live panel, and until then the design system is proposed and every visual choice is logged as philosophy-dependent. Known gaps, found by the experiments, include a field type for repeating rows, a recipe that saves through pull requests, read-only fields, and types that can't be deleted.
