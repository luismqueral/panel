---
name: panel
description: Builds a calm, Kirby-inspired admin panel for a project from a YAML schema, using blank templates, a scoped design system, a behavior spec, and adapter recipes. Use when someone asks for an admin panel, a content editor, a CMS-like backend, or to add a type, change a field, or connect login, data, or file storage in an existing Panel build.
---

# Panel

Panel is a spec, not a CMS. You build the panel from the schema; nothing generates it. Do not copy Kirby code or assets, and never imply affiliation.

## 1. Pick the mode

| The person wants | Mode |
| --- | --- |
| A panel, and the project has no `panel.yaml` | New panel |
| A new content type in an existing `panel.yaml` | Add a type |
| To add, remove, or change fields, statuses, or lists | Change a field |
| To connect or swap login, data, or file storage | Wire a recipe |
| To see what a panel would look like, without building it | Mockup only |

If two modes fit, ask which one with the question tool.

## 2. Run its steps, in order

| Step | New panel | Add a type | Change a field | Wire a recipe | Mockup only |
| --- | --- | --- | --- | --- | --- |
| Intake | all rounds | skip | skip | Round 2 only | Rounds 1 and 3 |
| Schema | interview, draft, validate | diff | diff | adapter block only | interview, draft, validate |
| Preview | playground | playground | skip unless asked | skip | playground, then stop |
| Build | all | the new type only | the changed fields only | the recipe only | skip |
| Conformance | all checks | all checks | all checks | all checks and the recipe's checklist | skip |

Stop after each step that ends in a question or a preview, and wait for the person.

## 3. Load only what the step needs

| Step | Read |
| --- | --- |
| Intake | `intake.md` |
| Schema | `schema-guide.md`; `panel.schema.json`; one similar file in `examples/` |
| Preview | `playground.md`; `templates/README.md` |
| Build | `build.md`; `templates/README.md`; `behavior-spec.md`; `recipes/contracts.md` and `recipes/<name>.md` for each adapter in the schema; `flavors/<flavor>.md` unless the flavor is vanilla |
| Conformance | `schema-guide.md` section 8; `build.md` step 8 |

Copy from `templates/`, `design-system/`, and `snippets/` verbatim. Never edit them to make something fit; write a proposal instead (`schema-guide.md` section 7).

## 4. Rules that apply to every step

- The schema is the contract. Change it only by a small diff the person approves, one line of reason per change.
- Every `behavior` line is a requirement. `notes` guide judgment.
- Never invent a core key, field type, screen, or component. Build it as a `custom` field or leave it out, and write a proposal.
- Never improvise an adapter. If no recipe fits, stop and say so.
- The panel works at 400px wide, with the keyboard alone, in light and dark.
- A failed check is fixed or raised, never skipped or weakened.
