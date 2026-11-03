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
    memory.js         the test adapters, copied from recipes/client/ (behavior-spec.md section 7)
    http.js, auth.js  copied from recipes/client/ when a recipe's steps say so
  seed.json           test data, loaded only with ?test (step 6)
  CONFORMANCE.md      the conformance report (last step)
server/               when a recipe needs the project server (recipes/contracts.md)
  *.mjs               copied from recipes/server/
allow.mjs             the login allow list, read by the server only (google-login and email-link)
start.mjs             builds the adapters from panel.config.js and the environment, then listens (step 6)
package.json          { "private": true, "type": "module" }, so Node can import panel.config.js
```

Copied files are copied whole and never edited. A recipe's own code is the files its steps name; write new code only where a step says to.

In an existing project, the host profile in the intake record decides the folder and file names (`intake.md` Rule 2). The parts stay the same.

Don't: add a framework, a bundler, or a dependency to a vanilla build.

## Step 1: Write `index.html`

Use exactly this page. Replace the two comments, and put the schema's `name` in `<title>`.

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
  // auth: google-login (the allow list goes in allow.mjs, not here). With no auth block, write { recipe: "none" }
  auth: { recipe: "google-login" },
  // data: json-files, files: local-disk; start.mjs reads these paths
  data: { recipe: "json-files", via: "server", path: "content" },
  files: { recipe: "local-disk", path: "uploads", url: "/uploads" },
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
- A `custom` field with a computed value gets `compute: "<name>"`. `<name>` is a key of the `computed` object passed to `makeField` (step 4, "Computed `custom` fields").
- Never put the login `allow` list in `panel.config.js`: the browser loads that file. It goes in `allow.mjs`.

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

Screen details:

| Part | Value |
| --- | --- |
| Nav entries | "Home", then each type's `label`, then each singleton's `label`, in schema order. The current one has `current: page`; on the not-found screen none does |
| Home `entry` rows | `title`: the type or singleton label. `subtitle`: "3 posts" (`singular` when 1) or "Page". `meta`: empty |
| Home `recent` rows | `title`: the item title. `subtitle`: its type's label. `meta`: the updated date |
| Home headings | `title`: the panel name. "Content" and "Recently edited" |
| Sort options | Value `-<field>` then `<field>`, then `<list.title>`. Text for a date field: "Newest first", "Oldest first"; for another field: "<Field>, descending", "<Field>, ascending"; then "Title A–Z". "Sort by" as the label |
| Search | Label and placeholder "Search <label in lower case>" |
| Collection `empty` | Icon `#pn-icon-file`, "No <label in lower case> yet", "Create the first <singular>.", and a primary "New <singular>" button with `data-action="create"` |
| Load errors | `error` with "Could not load the panel" (home), "Could not load <label in lower case>" (collection or singleton, "Could not load site settings"), or "Could not load this <singular>"; "Check your connection and try again."; and a "Try again" button (no variant) with `data-action="retry"` that reruns the route. A singleton keeps its label as `title` |
| Missing item | `error` with "This <singular> doesn't exist", "It may have been deleted.", and no button |
| Status slide-over | Title "Status". `body`: a `fieldset.pn-choices` with a visually hidden legend "Status" and one `label.pn-choice` holding `input.pn-radio` (name `pn-status`) per status, the current one checked |
| Not found | `screen-home` with `title` "Not found", no rows, and `error`: "This page doesn't exist", "Check the address, or go back home.", a "Try again" button (`data-action="retry"`) that goes to `#/`. Crumbs: Home / Not found |
| `publishRequires` fields | Keep the field's own `required` (`data-required="false"` when it isn't). They show "Required to publish." only after a publish attempt fails |
| Computed `custom` fields | Write the compute function in `panel.js` from the field's `describe`, rounding to at least 1 (for "estimated minutes to read": `max(1, ceil(words / 200))`, shown as "N min"). Pass it to `makeField` as `ctx.computed = { readingTime: { value(values), display(values) } }`, with `ctx.values()` returning every value except computed fields (a computed field reading itself loops forever) |
| Item while loading | Crumbs Home / type label / "Loading…"; the item `title` "Loading…" |
| Item missing, or failed to load | Last crumb and `title` "Not found" (missing) or "Could not load" (failed) |
| Current nav entry | On an item, its type's entry. On a singleton, the singleton's |
| Login | Page title "Sign in · <panel name>". When `auth.session()` throws, the login's `error` slot reads "Could not reach the panel. Check your connection and reload." and no methods render |
| Search with no matches | No rows; the screen stays `ready` (the `empty` state is only for a type with no items) |
| Sorting | Blank values sort last in both directions |
| Home | `recent` lists items only, never singletons. Home never uses its `empty` state |
| What is mounted | Only what the current state shows. Fill the `empty` and `error` regions only when entering that state. On the not-found screen, repeat `entry` and `recent` with no rows. Add the status slide-over when it opens and remove it when it closes. The layout, the confirm dialog, and the toasts region stay mounted across routes |
| Item title while editing | The header title and last crumb change on a successful save, not while typing |
| Account `user` slot | The `user` from `auth.session()`: the signed-in address, `editor` for `password`, `local` for `none`. Every recipe shows `account` |

### Routing

Use this hash listener. It keeps K6's in-page anchors off the route, and asks S9 on every route change, including the back button:

```js
let lastHash = location.hash; // route() sets it each time it renders
window.addEventListener("hashchange", async () => {
  if (location.hash === lastHash) return;
  if (location.hash && !location.hash.startsWith("#/")) {
    const target = document.getElementById(location.hash.slice(1));
    history.replaceState(null, "", lastHash || "#/");
    target?.focus();
    return;
  }
  if (current.dirty()) {
    const target = location.hash;
    history.pushState(null, "", lastHash || "#/");
    if (!(await discard())) return;
    history.replaceState(null, "", target);
  }
  current.cleanup();
  route();
});
```

`current` is the open screen's `{ cleanup(), dirty() }`; `discard()` is the S9 confirm dialog.

## Step 5: Wire behavior with the snippets

`behavior-spec.md` is the contract. The snippets implement it; use them unless the host profile rules them out, and then match them rule for rule.

| Spec section | Snippet | Wire it to |
| --- | --- | --- |
| 1. Save state | `save-state.js` | The item or singleton `form` and the `savebar`. Pass `autosave` only when a `behavior` line asks for it. It also stops Enter submitting the form (K7) |
| 2. Validation | `validation.js` | Every form, including the create dialog. Run `"publish"` before a status moves past the first, with `conformance` fields added as required. On a singleton's save, run `"required"` (V7). Write the save bar message with `fixMessage(n, "publish")` or `fixMessage(n, "save")` |
| 3. Dialogs | `dialogs.js` | Every confirm, the create dialog, and the slide-over |
| 4. Keyboard | `keyboard.js` | Every screen in the layout, so Cmd+S never reaches the browser (S7). Pass `save` on item and singleton screens, `search` on collections |
| 5. Create flow | `create-flow.js` | The collection's add button, and the empty state's button |
| 6. Status | your `panel.js` | The item's status button (P1–P5). Any move to a status other than the first runs the publish checks (P3, V8); only leaving the first status asks for confirmation (P4) |
| 8. Field controls | `fields.js` | Every field |
| Toasts | `toast.js` | The layout's `toasts` container |

Pass `errorMessage` to `createSaveState` for the codes in `recipes/contracts.md` that name a save bar message: `(error) => (error?.code === "conflict" ? "Changed elsewhere. Copy your edits, then reload." : null)`.

When a save throws `unauthorized` or `forbidden`, rethrow it so the save bar enters `error` with every edit kept, and show the toast "You were signed out. Copy your edits, then reload to sign in." (negative). A load that throws either shows `screen-login`.

Then implement each `behavior` line. A behavior line that changes a spec rule wins only where the spec allows it (for example, autosave timing). If it conflicts with the spec, say so and follow the spec.

| Behavior line | Implementation |
| --- | --- |
| "Autosave drafts every 10 seconds" | `createSaveState({ autosave: { every: 10000, when: () => status === first } })` |
| "Show word count under the body field" | Write "N words" ("1 word") into the body field's `help` slot on every input |
| "Publishing asks for confirmation" | Before moving past the first status, `confirmDialog(..., { title: "Publish this post?", confirmLabel: "Published" })` |
| "Toolbar hidden until text is selected" | `toolbarOnSelection: true` on the field; `fields.js` toggles `hidden` |

## Step 6: Write the adapters

`recipes/contracts.md` defines the auth, data, and files contracts. Write one file per recipe in the schema, following that recipe's steps exactly, and run its verification checklist.

Always also copy `recipes/client/memory.js` to `adapters/memory.js`. It implements the same contracts in memory and provides the `fail`, `delay`, `calls`, and `reset` parts of `window.panelTest` (behavior-spec.md section 7). `panel.js` uses it when the URL has `?test`, and the recipes otherwise. The seed is `seed.json`, next to `index.html`, fetched only in test mode. Tests may replace it, so read nothing else from it:

```js
const params = new URLSearchParams(location.search);
const adapters = params.has("test")
  ? createMemoryAdapters(await (await fetch("./seed.json")).json())
  : createRecipeAdapters();
if (adapters.test)
  window.panelTest = {
    ...adapters.test,
    reset(seed) {
      adapters.test.reset(seed);
      current.cleanup(); // drop the open screen without asking (S9 does not apply)
      route();           // render the current route again from the new data
    },
  };
```

Write a few records per type, covering every status, in this shape:

```json
{
  "items": {
    "post": [
      { "id": "rail-line", "type": "post", "status": "draft", "values": { "title": "Walking the old rail line" },
        "createdAt": "2026-10-20T09:00:00.000Z", "updatedAt": "2026-10-28T18:30:00.000Z" }
    ]
  },
  "singletons": {
    "settings": { "values": { "site_title": "Field Notes" }, "createdAt": "2026-09-01T00:00:00.000Z", "updatedAt": "2026-09-01T00:00:00.000Z" }
  }
}
```

Write `start.mjs` at the project root when a recipe needs the project server. It imports `PANEL` from the panel's `panel.config.js` and, when the recipe has an allow list, `ALLOW` from `allow.mjs`, builds each recipe's part exactly as the recipe shows, then listens on `PORT` (default 4810) and `HOST` (default `127.0.0.1`), serving the panel folder as `root`. With auth `none`, it refuses any host but `127.0.0.1`, `localhost`, or `::1`. Add the `package.json` above so Node 18 or later can import the ES-module config. The server serves only `.html`, `.js`, `.css`, `.svg`, `.json`, and image files from `root`, so `CONFORMANCE.md` and notes stay private.

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
| Toasts | "{Singular} {status}" when it moves forward ("Post published") · "{Singular} moved to {status}" when it moves back, both positive · "{Singular} deleted" (no tone) · "Could not create. Try again." · "Could not delete. Try again." · "Could not log out. Try again." · "You were signed out. Copy your edits, then reload to sign in.", all negative |
| Counts | Singular at 1: "1 post", "1 word", "Fix 1 field to publish" |
| Upload prompt | "Drop an image, or click to choose" · "Drop a file, or click to choose" |
| Save bar, validation | As `behavior-spec.md` sections 1 and 2 say |
| Login | Panel name · "Sign in to edit the site." · page title "Sign in · {panel name}". The controls and their messages are the auth recipe's |

## Step 8: Run conformance and write `CONFORMANCE.md`

Check every default check in `schema-guide.md` section 8, every project check under `conformance:`, and these build checks:

- The page passes the template fidelity check on every screen (`templates/README.md`).
- Every rule in `behavior-spec.md` holds. In this repository, run `PANEL_URL=<url> npm run test:behavior`. Elsewhere, walk the rules by hand.
- Elsewhere, check fidelity by hand: on each screen, for each element with `data-template`, blank every slot (`templates/README.md`) and compare it with the template file. The tags, classes, and attributes must match. For K5, Tab through each screen and look for a ring on every stop. Report axe as `needs the person` when it cannot run.
- In an existing project, the build follows the host profile.

Write the report as one table. A failed check is fixed, or raised with the person, never skipped.

Some checks need the person: a recipe's "Ask" step, or a hand checklist with real credentials (Google sign-in). In an unattended run, take the default the recipe names, record it in the intake record under `open_questions` with `assumed: true` (`- question: Commit content to git?`, `assumed: true`, `answer: yes`), and report the check as `needs the person`, with what they must do. That is not a pass, and it is not a skip.

```markdown
# Conformance: Field Notes

| Check | Result | Evidence |
| --- | --- | --- |
| Every type has a collection view, an item view, and a create flow | pass | `#/post`, `#/post/<id>`, "New post" |
| Every behavior line is implemented: "Autosave drafts every 10 seconds" | pass | `panel.config.js` `autosave` |
| Publishing a post requires a cover image. | pass | `publishRequires: ["cover"]` |
```
