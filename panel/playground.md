# Playground

A playground is one HTML file that shows the panel a schema describes, filled with fake data, before anything is built. Write a new one for each schema, and again after each schema change. It previews the schema; it never edits a build, and it has no editing UI. The person asks for changes in chat; you change the schema, then write the playground again.

Its markup is the real markup: every screen is the real templates, filled. That is what makes it cheap to turn into a build (see "From playground to build").

## What you produce

`playground.html`, next to `panel.yaml`. One file, no external requests: the CSS and the icon sprite are inlined.

## Rule 1: Use this page, exactly

Replace only the comments.

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Field Notes · Playground</title>
  <style>
/* the contents of design-system/tokens.css, verbatim */
  </style>
  <style>
/* the contents of design-system/components.css, verbatim */
  </style>
  <style>
.pg-bar { display: flex; flex-wrap: wrap; gap: 4px 12px; align-items: center; padding: 8px 12px; font: 13px/1.4 system-ui, sans-serif; background: #1d1d1b; color: #f3f3f1; }
.pg-bar a { color: inherit; text-decoration: none; padding: 2px 6px; border-radius: 3px; }
.pg-bar a[aria-current="page"] { background: #f3f3f1; color: #1d1d1b; }
.pg-bar a:focus-visible, .pg-bar button:focus-visible { outline: 2px solid #8ab4ff; outline-offset: 2px; }
.pg-bar button { margin-left: auto; font: inherit; color: inherit; background: none; border: 1px solid #77756f; border-radius: 3px; padding: 2px 8px; cursor: pointer; }
  </style>
</head>
<body>
<!-- the contents of design-system/icons.svg, verbatim -->
<nav class="pg-bar" aria-label="Playground screens">
  <!-- one link per screen: <a href="#ID">LABEL</a>, in the order of Rule 2 -->
  <button type="button" data-pg-theme>Switch theme</button>
</nav>
<div id="pg-stage"></div>
<!-- one <template data-pg-screen="ID" data-pg-label="LABEL"> per screen, in the order of Rule 2 -->
<script>
  const stage = document.getElementById("pg-stage");
  const screens = [...document.querySelectorAll("template[data-pg-screen]")];
  function show() {
    const id = location.hash.slice(1);
    const screen = screens.find((s) => s.dataset.pgScreen === id) ?? screens[0];
    stage.replaceChildren(screen.content.cloneNode(true));
    for (const dialog of stage.querySelectorAll("dialog[open]")) dialog.close(), dialog.showModal();
    for (const a of document.querySelectorAll(".pg-bar a")) a.setAttribute("aria-current", a.hash === `#${screen.dataset.pgScreen}` ? "page" : "false");
    document.title = `${screen.dataset.pgLabel} · Playground`;
  }
  document.querySelector("[data-pg-theme]").addEventListener("click", () => {
    const dark = document.documentElement.dataset.theme === "dark" || (!document.documentElement.dataset.theme && matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.dataset.theme = dark ? "light" : "dark";
  });
  addEventListener("hashchange", show);
  show();
</script>
</body>
</html>
```

Don't: add a framework, a renderer, a schema parser, or any script beyond this one.

## Rule 2: Include every screen, in this order

Each `<template data-pg-screen>` holds one whole screen, already filled: `layout` with `nav`, `account`, `header`, the screen, and, where listed, the `savebar` and a dialog. `screen-login` stands alone.

| ID | Label | Shows |
| --- | --- | --- |
| `home` | Home | `screen-home`, `data-state="ready"` |
| `collection` | {Type label} | `screen-collection` ready, with every item as a row |
| `collection-loading` | {Type label}: loading | `data-state="loading"`, "Loading…" |
| `collection-empty` | {Type label}: empty | `data-state="empty"`, with `empty` filled and its "New {singular}" button |
| `collection-error` | {Type label}: error | `data-state="error"`, with `error` filled and its "Try again" button |
| `create` | New {singular} | The collection, plus `screen-create` in `dialogs` with `open` |
| `item` | {Item title} | `screen-item` ready, every field filled, save bar `clean` |
| `item-dirty` | {Item title}: unsaved | One field edited, save bar `dirty` |
| `item-saving` | {Item title}: saving | Save bar `saving`; every control, Save, and Revert `disabled` |
| `item-save-error` | {Item title}: save failed | Save bar `error` |
| `item-invalid` | {Item title}: can't publish | A draft missing required values after a publish attempt: errors shown (Rule 4), save bar `dirty` with "Fix N fields to publish" |
| `confirm` | Publish confirm | The item, plus `screen-dialog` in `dialogs` with `open`, filled as the publish or delete confirm |
| `slide-over` | Slide-over | The item, plus `screen-slide-over` in `dialogs` with `open` |
| `singleton` | {Singleton label} | `screen-singleton` ready, save bar `clean` |
| `login` | Login | `screen-login`, with the auth recipe's sign-in control in `methods` |
| `not-found` | Not found | `screen-home` with `data-state="error"` and `error`: "This page doesn't exist" |

Repeat `collection` through `item-invalid` for each type, prefixing the ID with the type id when there is more than one type (`post-collection`). Repeat `singleton` for each singleton (`settings`). Skip `item-invalid` and `confirm`'s publish form for a type without `status`.

When the schema never uses a screen (the blog has two statuses, so its slide-over is unused), keep it and add " (unused)" to its label. Fill a slide-over with what it would hold for this schema: status choices, or a related item.

## Rule 3: Fill exactly as a build would

Follow `templates/README.md` for every slot, and `build.md` steps 4 and 7 for routes, row text, tones, screen details, and copy. Field control markup (remove buttons, image alt text, computed fields) is what `snippets/fields.js` produces. The login screen's `methods` hold the auth recipe's sign-in control, from `recipes/<recipe>.md`. The playground and the build must read the same.

- Links: `href` points at playground screens (`#collection`, `#item`), not build routes.
- Field ids: `<type or singleton id>-<field name>-input` and so on, as in a build. In the create dialog, `<type id>-new-<field name>-input`.
- Values: on `<input>` use `value=""`; on `<textarea>` put the text inside; on `<select>` mark the chosen `<option selected>`; on a toggle use `checked`. These are state, so fidelity ignores them.
- Uploads: `data-state="filled"` with a small inline `data:image/svg+xml` image for `src`, a file name, and a size such as "84 KB".
- Disabled controls: `disabled` on the control.
- Dialogs: `open` on the `<dialog>`; the script shows it as a modal.

Do: `<input class="pn-input" type="text" id="post-title-input" name="title" aria-required="true" aria-describedby="post-title-help post-title-error" data-slot-attr="..." value="Walking the old rail line">`
Don't: `<input class="pn-input" type="text" placeholder="Title">`, which drops attributes and invents one.

## Rule 4: Show states with state attributes

| State | Markup |
| --- | --- |
| Field error | `aria-invalid="true"` on the control, the message in the `error` slot |
| Required | `data-required="true"` on the label, `aria-required="true"` on the control |
| Disabled | `disabled` |
| Current nav entry or crumb | `aria-current="page"`; the others `aria-current="false"` |
| Hidden by behavior | `hidden` (for example, a markdown toolbar hidden until text is selected) |

Messages come from `behavior-spec.md` section 2.

## Rule 5: Write fake data from the person's words

- 3 to 5 items per type, with titles and text that sound like the person's project. Never lorem ipsum.
- Mix statuses. Make one draft miss a required value, for `item-invalid`. Make another draft valid, for `confirm`: publishing only asks after validation passes.
- Dates near today, in the field's format (`2026-10-28`).
- Fill every field of `item`, including optional ones, so the person sees them all.
- For a computed `custom` field, show the value it would compute.

## Rule 6: Check it

In this repository, run `npm run check:playground -- <path to playground.html>`. It renders every screen in both themes and checks template fidelity, accessibility, the 400px width, and that every screen in Rule 2 is present. Elsewhere, open each screen at 400px and in both themes.

## From playground to build

The playground and the build share markup, so a build maps the playground; it does not rewrite it.

| In the playground | In the build |
| --- | --- |
| An element with `data-template="X"` | `tpl("X")`, then `fill()` |
| Text in a `data-slot` | The same text, from the schema or `build.md` step 7, passed to `fill(el, { text })` |
| A value in a `data-slot-attr` attribute | The same value, passed to `fill(el, { attrs })`; `href` becomes the build route |
| Units inside a `data-slot-repeat` | `repeat(container, items, fillUnit)` over adapter data |
| Content in a `data-slot-children` | The nested template, or the design-system components shown, built the same way |
| Fake values (`value`, textarea text, `checked`) | `controller.set()` with adapter data |
| A screen variant (`collection-empty`, `item-saving`) | A `data-state` the behavior snippets set at runtime |
| `open` on a dialog | `openDialog()` from `snippets/dialogs.js` |
| The `pg-bar`, its styles, and its script | Nothing. They are playground only |

Rule: a build introduces no markup the playground does not show, apart from toasts and what behavior adds at runtime. If the build needs something new, add it to the playground first, from the templates.
