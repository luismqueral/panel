# Build a vanilla panel

How to turn a valid schema into a working vanilla panel: plain HTML, the design system's CSS, and one small owned script. For React or Vue, follow this file for what to build, then the flavor file for how to write it.

Before you start, have:

- a schema that passes validation (`schema-guide.md` section 10),
- the intake record, `panel.intake.yaml` (`intake.md`),
- every `notes` and `behavior` line read, at every level.

## What you produce

```
panel/
  index.html          the page: sprite, app root, every template inlined verbatim
  panel.config.js     the schema restated as plain JS, each key traced to a schema line
  panel.js            the owned script: routes, screens, adapters wiring
  styles/
    tokens.css        copied verbatim from design-system/
    components.css    copied verbatim from design-system/
  snippets/           copied verbatim from snippets/ (the ones you use)
  adapters/
    memory.js         the test adapters (behavior-spec.md section 7)
    <recipe>.js       one file per recipe in the schema, written from the recipe
  CONFORMANCE.md      the conformance report (last step)
server/               when a recipe needs the project server (recipes/contracts.md)
  *.mjs               copied from recipes/server/
start.mjs             builds the adapters from panel.config.js and the environment, then listens
```

In an existing project, the host profile in the intake record decides the folder and file names (`intake.md` Rule 2). The parts stay the same.

Don't: add a framework, a bundler, or a dependency to a vanilla build.

## Step 1: Write `index.html`

Use exactly this page. Replace the two comments.

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Field Notes</title>
  <link rel="stylesheet" href="./styles/tokens.css">
  <link rel="stylesheet" href="./styles/components.css">
</head>
<body>
<!-- the contents of design-system/icons.svg, verbatim -->
<div id="app"></div>
<!-- one <template data-panel-template="NAME"> per template, holding the template file verbatim -->
<script type="module" src="./panel.js"></script>
</body>
</html>
```

`NAME` is the template's `data-template` value: `layout`, `nav`, `account`, `header`, `savebar`, `screen-home`, `screen-collection`, `screen-item`, `screen-singleton`, `screen-create`, `screen-dialog`, `screen-slide-over`, `screen-login`, `empty`, `error`, and `field-<type>` for each field type the schema uses.

Do:

```html
<template data-panel-template="field-text">
<div class="pn-field" data-field="" data-width="" data-slot-attr="data-field:name data-width:width" data-template="field-text">
  ...the rest of templates/fields/text.html, unchanged...
</div>
</template>
```

Don't: retype a template from memory, reformat it, drop an attribute you think is unused, or add a class.

## Step 2: Restate the schema in `panel.config.js`

Write the schema as one exported object. Add every key the build needs, each with a comment naming the schema line it comes from. Nothing reads `panel.yaml` at runtime.

```js
export const PANEL = {
  name: "Field Notes",
  types: [
    {
      id: "post",
      label: "Posts",
      singular: "post",
      status: ["draft", "published"],
      list: { title: "title", subtitle: "date", sort: "-date", search: ["title"] },
      // behavior: Autosave drafts every 10 seconds
      autosave: { every: 10000, drafts: true },
      // conformance: Publishing a post requires a cover image.
      publishRequires: ["cover"],
      fields: [
        { name: "title", label: "Title", type: "text", required: true, width: "1/1" },
        // ...
      ],
    },
  ],
  singletons: [/* ... */],
};
```

Rules:

- `label` missing on a field: derive it from `name` (`site_title` → "Site title").
- `width` missing: `1/1`.
- `singular`: the type's `label` in lowercase, made singular (`Posts` → `post`, `Categories` → `category`, `People` → `person`).
- Each `behavior` line becomes one config key or one clearly named function, with the line quoted in a comment above it.

## Step 3: Fill templates with `snippets/templates.js`

Clone templates with `tpl(name)`, then fill slots with `fill()` and `repeat()`. The slot rules are in `templates/README.md`; read it before filling anything.

```js
const nav = tpl("nav");
fill(nav, { text: { brand: PANEL.name } });
repeat(slotRepeat(nav, "entry"), entries, (unit, e) =>
  fill(unit, { text: { text: e.text }, attrs: { href: e.href, current: e.current ? "page" : "false" } }),
);
```

Build fields with `snippets/fields.js`: `makeField(field, ctx)` returns the filled template plus `get()` and `set()`. Use the type or singleton id as `prefix` on item screens, and `<type id>-new` in the create dialog.

Content you add inside `data-slot-children` containers (buttons in `empty` and `error`, toasts, sign-in controls, a custom field's control) is built from design-system components, with their documented classes.

## Step 4: Build the screens

Routes use the hash. Every screen fills its template, sets `data-state="loading"` at once, then `ready`, `empty`, or `error`.

| Route | Screen | Holds |
| --- | --- | --- |
| `#/` | `screen-home` | `entry`: one row per type ("3 posts") and singleton ("Page"). `recent`: the 5 most recently updated items, any type |
| `#/<type>` | `screen-collection` | Rows sorted by `list.sort`, filtered by the search input over `list.search`. Sort options: `list.sort` descending and ascending, then title A–Z. `empty` when there are no items |
| `#/<type>/<id>` | `screen-item` | Every field in schema order; status button; created and updated dates; Delete. Save bar |
| `#/<singleton>` | `screen-singleton` | Every field in schema order. Save bar |
| anything else | `screen-home` holding `error` | "This page doesn't exist" |

The layout wraps every screen except login. Nest templates as the table "How templates nest" in `templates/README.md` says. When `auth.session()` returns no one, show `screen-login` alone, and let the auth recipe fill `methods`.

Row and header text:

| Slot | Value |
| --- | --- |
| Row and item `title` | The `list.title` field's value, or "Untitled" |
| Row `subtitle` | The `list.subtitle` field's value; dates formatted as "Oct 28, 2026" |
| `status` | The status name with a capital first letter ("Draft") |
| `tone` | `neutral` for the first status, `positive` for the last, `notice` between |
| Breadcrumb | Home / type label / item title. The last crumb has `current: page` |
| Page title | `<last crumb> · <panel name>` |

## Step 5: Wire behavior with the snippets

`behavior-spec.md` is the contract. The snippets implement it; use them unless the host profile rules them out, and then match them rule for rule.

| Spec section | Snippet | Wire it to |
| --- | --- | --- |
| 1. Save state | `save-state.js` | The item or singleton `form` and the `savebar`. Pass `autosave` only when a `behavior` line asks for it |
| 2. Validation | `validation.js` | Every form, including the create dialog. Run `"publish"` before a status moves past the first, with `conformance` fields added as required |
| 3. Dialogs | `dialogs.js` | Every confirm, the create dialog, and the slide-over |
| 4. Keyboard | `keyboard.js` | `save` on item and singleton screens, `search` on collections |
| 5. Create flow | `create-flow.js` | The collection's add button, and the empty state's button |
| 6. Status | your `panel.js` | The item's status button (P1–P5) |
| 8. Field controls | `fields.js` | Every field |
| Toasts | `toast.js` | The layout's `toasts` container |

Then implement each `behavior` line. A behavior line that changes a spec rule wins only where the spec allows it (for example, autosave timing). If it conflicts with the spec, say so and follow the spec.

| Behavior line | Implementation |
| --- | --- |
| "Autosave drafts every 10 seconds" | `createSaveState({ autosave: { every: 10000, when: () => status === first } })` |
| "Show word count under the body field" | Write "N words" into the body field's `help` slot on every input |
| "Publishing asks for confirmation" | Before moving past the first status, `confirmDialog(..., { title: "Publish this post?", confirmLabel: "Published" })` |
| "Toolbar hidden until text is selected" | `toolbarOnSelection: true` on the field; `fields.js` toggles `hidden` |

## Step 6: Write the adapters

`recipes/contracts.md` defines the auth, data, and files contracts. Write one file per recipe in the schema, following that recipe's steps exactly, and run its verification checklist.

Always also copy `recipes/client/memory.js` to `adapters/memory.js`. It implements the same contracts in memory and provides the `fail`, `delay`, `calls`, and `reset` parts of `window.panelTest` (behavior-spec.md section 7). `panel.js` uses it when the URL has `?test`, and the recipes otherwise. The seed is a JSON file of the schema's types, a few records each, covering every status:

```js
const params = new URLSearchParams(location.search);
const adapters = params.has("test") ? createMemoryAdapters(seed) : createRecipeAdapters();
```

## Step 7: Use this copy

Use these words exactly, so every build reads the same. `{label}` is the type label in lowercase, `{Singular}` capitalized.

| Where | Text |
| --- | --- |
| Home title, sections | Panel name · "Content" · "Recently edited" |
| Loading region | "Loading…" |
| Collection create button, dialog title | "New {singular}" |
| Search label and placeholder | "Search {label}" |
| Sort label | "Sort by" |
| Empty collection | "No {label} yet" · "Create the first {singular}." · button "New {singular}" |
| Load failed | "Could not load {label}" · "Check your connection and try again." · button "Try again" |
| Item missing | "This {singular} doesn't exist" · "It may have been deleted." |
| Delete confirm | "Delete this {singular}?" · "This can't be undone." · "Delete" (negative) |
| Publish confirm | "Publish this {singular}?" · "It will be visible on the site." · the status name |
| Discard confirm (S9) | "Discard unsaved changes?" · "Your edits will be lost." · "Discard" (negative) |
| Toasts | "{Singular} {status}" when it moves forward ("Post published") · "{Singular} moved to {status}" when it moves back · "{Singular} deleted" · "Could not create. Try again." · "Could not delete. Try again." |
| Upload prompt | "Drop an image, or click to choose" · "Drop a file, or click to choose" |
| Save bar, validation | As `behavior-spec.md` sections 1 and 2 say |
| Login | Panel name · "Sign in to edit the site." |

## Step 8: Run conformance and write `CONFORMANCE.md`

Check every default check in `schema-guide.md` section 8, every project check under `conformance:`, and these build checks:

- The page passes the template fidelity check on every screen (`templates/README.md`).
- Every rule in `behavior-spec.md` holds. In this repository, run `PANEL_URL=<url> npm run test:behavior`. Elsewhere, walk the rules by hand.
- In an existing project, the build follows the host profile.

Write the report as one table. A failed check is fixed, or raised with the person, never skipped.

```markdown
# Conformance: Field Notes

| Check | Result | Evidence |
| --- | --- | --- |
| Every type has a collection view, an item view, and a create flow | pass | `#/post`, `#/post/<id>`, "New post" |
| Every behavior line is implemented: "Autosave drafts every 10 seconds" | pass | `panel.config.js` `autosave` |
| Publishing a post requires a cover image. | pass | `publishRequires: ["cover"]` |
```
