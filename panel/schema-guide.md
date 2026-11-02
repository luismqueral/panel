# Schema guide

The schema is one file, `panel.yaml`, describing everything a panel manages. It is a **contract, not a compiler**: nothing reads it at runtime. You write the panel code from it, then prove the code matches it (conformance).

Shape is defined by `panel.schema.json`. Recipes and their settings are listed in `recipes/index.json`. This guide is the full rule set. When the guide and the JSON Schema disagree, stop and raise it.

## 1. File format

**1.1 Line one is exactly `panel: 1`.**

Do:

```yaml
panel: 1
name: Field Notes
```

Don't:

```yaml
# My schema
name: Field Notes
panel: 1
```

**1.2 One property per line. No inline braces or brackets.**

Do:

```yaml
      - name: body
        type: markdown
```

Don't:

```yaml
      - { name: body, type: markdown }
```

**1.3 Leave a blank line between fields**, so each field can be added, removed, or moved alone.

**1.4 Quote only values YAML could misread:** `"yes"`, `"no"`, `"on"`, `"off"`, `"y"`, `"n"`, and values starting with `*`, `@`, or `&`, such as `"*@studio.example"`.

**1.5 Comments are for humans.** Instructions for the builder go in `notes` or `behavior`, never in a `#` comment.

Don't:

```yaml
      - name: body
        type: markdown  # make this autosave
```

**1.6 JSON is accepted** for single-file builds that embed the schema. Rules 1.1 to 1.4 apply to YAML only.

## 2. Top-level keys

| Key | Required | Holds |
| --- | --- | --- |
| `panel` | Yes | `1` |
| `name` | Yes | The project's display name |
| `auth` | Yes | Adapter: who can log in |
| `data` | Yes | Adapter: where items are stored |
| `files` | When any field is `image` or `file` | Adapter: where uploads are stored |
| `types` | One of `types` or `singletons` | Collections |
| `singletons` | One of `types` or `singletons` | One-of-a-kind items |
| `conformance` | No | Extra checks, one sentence each |
| `notes`, `behavior` | No | Guidance for the whole panel |

No other key is allowed, except keys starting with `x-`.

## 3. Adapters

An adapter is a block with `recipe:` plus that recipe's settings. Settings are checked strictly against `recipes/index.json`: an unknown or misspelled setting is an error.

Do:

```yaml
auth:
  recipe: google-login
  allow:
    - me@example.com
```

Don't:

```yaml
auth: google-login
```

| Slot | Recipes |
| --- | --- |
| `auth` | `google-login` (`allow`), `email-link` (`allow`), `none` |
| `data` | `json-files` (`path`, `via`, `repo`, `branch`), `postgres` (`url_env`, `schema`), `supabase` (`url_env`, `key_env`) |
| `files` | `local-disk` (`path`, `url`, `via`), `s3` (`bucket`, `region`, `url`), `r2` (`bucket`, `account_env`, `url`) |

Rules:

- **3.1** `allow` lists email addresses or `*@domain`. A login recipe without `allow` is invalid.
- **3.2** `auth: recipe: none` means the panel has no login. Use it only for panels that never leave the person's machine.
- **3.3** Secrets never go in the schema. Settings ending in `_env` name an environment variable (`url_env: DATABASE_URL`), never the value.
- **3.4** `json-files` writes through a small server by default. `via` picks another way: `file-system-access`, `github` (needs `repo`), `download`, or `local-storage` (mockups only).

## 4. Types and singletons

A **type** is a collection: many items of one kind, with a list, a create flow, and optionally a status workflow. A **singleton** is one item that always exists: its nav entry opens straight to its form. If you would say "the" (the homepage, the footer), it is a singleton. If you would say "a" or "all", it is a type.

| Key | Type | Singleton | Holds |
| --- | --- | --- | --- |
| `id` | Required | Required | Lowercase, singular, unique across all types and singletons |
| `label` | Required | Required | Human name; plural for types |
| `fields` | Required | Required | At least one field |
| `list` | Required | Not allowed | How items appear in the collection |
| `status` | Optional | Not allowed | Ordered workflow states; new items start in the first |
| `notes`, `behavior` | Optional | Optional | Guidance |

`list` holds `title` (required), `subtitle`, `sort` (a field name, `-` in front for descending), and `search` (a list of field names). Every one must name a field of that type.

Do:

```yaml
    list:
      title: title
      subtitle: date
      sort: -date
      search:
        - title
```

Don't (names a field that does not exist):

```yaml
    list:
      title: headline
```

`status` needs at least two states. Omit it when there is no workflow. Required fields block publishing and moving out of the first state; drafts always save.

## 5. Fields

Every field has `name` and `type`.

| Property | Holds |
| --- | --- |
| `name` | Lowercase with underscores, unique within its type |
| `type` | A built-in type below, or `custom` |
| `label` | Display name. Derived from `name` when omitted (`site_title` → "Site title") |
| `required` | `true` blocks publishing without a value. Default `false` |
| `default` | Value for new items. Must match the type |
| `width` | `1/1`, `1/2`, `1/3`, or `2/3`. Default `1/1` |
| `help` | One short line under the field, for the editor |
| `notes`, `behavior` | Guidance |

| Type | Holds | Type-only keys | `default` |
| --- | --- | --- | --- |
| `text` | One line | | Text |
| `textarea` | Plain multi-line text | | Text |
| `markdown` | Formatted long text | | Text |
| `number` | A number | `min`, `max` | A number within range |
| `date` | A date | `time: true` adds a time | `YYYY-MM-DD` (`THH:MM` with time) |
| `toggle` | True or false | | `true` or `false` |
| `select` | One choice | `options` (required, list of strings) | One of the options |
| `tags` | Short labels | | A list of strings |
| `slug` | URL-safe text | `from` (a text field to build it from) | A slug |
| `image` | One uploaded image | | Not allowed |
| `file` | One uploaded file | | Not allowed |
| `relation` | A link to one item of a type | `to` (required, a type `id`) | Not allowed |
| `custom` | Anything else | `describe` (required, one sentence) | Any |

A type-only key on another type is an error.

Do:

```yaml
      - name: reading_time
        type: custom
        describe: Read-only. Estimated minutes to read, from the word count of body.
```

Don't (invented type):

```yaml
      - name: reading_time
        type: computed
```

## 6. Guidance: `notes` and `behavior`

`notes` says **why**: intent, feel, context. It directs judgment and is not a requirement. `behavior` says **what**: one concrete, testable requirement per line. Every `behavior` line is checked at conformance.

Both are plain Markdown strings, allowed on the project, adapters, types, singletons, lists, and fields. Guidance applies to its level and everything beneath, unless a lower level overrides it.

Do:

```yaml
    notes: Long-form writing. The editor should feel like a quiet page, not a form.
    behavior: |
      - Autosave drafts every 10 seconds
      - Show word count under the body field
```

Don't (not testable, and intent mixed into behavior):

```yaml
    behavior: Make writing feel pleasant and fast.
```

When guidance conflicts with a rule in this guide, the rule wins. Say so to the person.

## 7. Extension points, in this order

1. **Guidance.** If the need is about how something feels or acts: `notes` or `behavior`.
2. **Custom field.** If a field holds something no built-in type does: `type: custom` with `describe`. Build it from design-system components.
3. **`x-` keys.** Tool metadata, allowed anywhere, ignored by the validator (`x-priority: low`). Never instructions.

If a request needs a screen, field type, component, or core key Panel does not have, do not invent one. Write a proposal and build the `custom` version (or leave it out) until it is approved:

```markdown
## Proposal: <name>
- Needed: what the person asked for, in their words.
- Why existing parts cannot do it: which key, field, or template falls short.
- Smallest addition: the one key, value, or template to add.
```

## 8. Conformance

Conformance proves the code still matches the schema. Run it after the first build, after every schema change, and before saying the panel is done. Report every check as passed or failed. Fix a failure or raise it. Never skip one.

Default checks:

1. Every type has a collection view, an item view, and a create flow.
2. Every singleton has an item view.
3. Every field appears in its item view with its declared type, width, and required rule.
4. Every `list.title`, `subtitle`, `sort`, and `search` entry names a real field.
5. Every adapter resolves to a recipe in `recipes/index.json`.
6. Every `behavior` line is implemented and can be demonstrated.
7. No core key appears that this guide does not define.
8. The pages pass the template fidelity check (`templates/README.md`).

Project checks go under `conformance:`, one plain sentence each:

```yaml
conformance:
  - Publishing a post requires a cover image.
```

## 9. Changing a schema

- **9.1 Schema first.** Change the schema before the code. Code that changes the data model is written back to the schema.
- **9.2 Propose small diffs**, each with a one-line reason. Never edit silently. Never change more than was asked.
- **9.3 Validate, then rerun conformance.**

Do:

```diff
       - name: cover
         type: image
+        required: true
```

> Make `cover` required, because you asked that every post have an image.

## 10. Validate

Run the validator when it is available:

```sh
node tools/validate.mjs panel.yaml
```

It reports `file:line: error: where: message`. Fix every error before showing the schema to the person. Warnings are style advice.

When the validator is not available, check these by hand, in order: rule 1.1 to 1.4; every top-level key in section 2; every adapter's recipe and settings against section 3; every type has `list.title`; every `list` entry, `from`, and `to` names something real; ids unique across types and singletons; field names unique within a type; type-only keys only on their types; every `default` matches its type; a `files` adapter exists when any field is `image` or `file`.
