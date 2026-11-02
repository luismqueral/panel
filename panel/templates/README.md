# Templates

Blank, structure-only HTML. Copy a template verbatim and change only its slots. Nothing else.

A build is checked by stripping every slot and comparing the result to the source template. Any other change is a failure.

## Rule 1: Change only slots

A slot is marked by one of four attributes. Everything not inside a slot is fixed: tags, classes, order, fixed attributes, and fixed text such as "Save" or "Delete".

| Marker | Means | You may |
| --- | --- | --- |
| `data-slot="name"` | Text slot | Replace the element's contents with text |
| `data-slot-children="name"` | Container slot | Put other templates (or, only where noted, plain components) inside |
| `data-slot-attr="attr:key ..."` | Attribute slots | Set each listed attribute to the value for `key` |
| `data-slot-repeat="name"` | Repeat | Copy the single child once per item, zero or more times |

Do:

```html
<label class="pn-label" for="post-title" data-required="true" data-slot-attr="for:input-id data-required:required" data-slot="label">Title</label>
```

Don't (class added, marker removed):

```html
<label class="pn-label big" for="post-title">Title</label>
```

Keep the marker attributes (`data-slot`, `data-slot-attr`, and the rest) in the output. The checker needs them.

## Rule 2: Fill attribute slots from the schema

`data-slot-attr="for:input-id"` means: set `for` to the value of `input-id`. Keys:

| Key | Value |
| --- | --- |
| `name` | The field's `name` from the schema |
| `width` | The field's `width`: `1/1`, `1/2`, `1/3`, or `2/3`. Default `1/1` |
| `required` | `true` or `false` from the field's `required` |
| `input-id`, `label-id`, `help-id`, `error-id` | Unique ids, built as `<type or singleton id>-<field name>-input`, `-label`, `-help`, `-error`. In the create dialog, use `<type id>-new-<field name>-input` and so on |
| `describedby` | `"<help-id> <error-id>"` |
| `state` | Screen state: `loading`, `ready`, `empty`, or `error` |
| `save-state` | Save bar state: `clean`, `dirty`, `saving`, or `error` |
| `upload-state` | `empty` (no file yet) or `filled` |
| `type-id`, `singleton-id` | The `id` from the schema |
| `to` | The relation's `to` |
| `from` | The slug's `from` |
| `min`, `max` | The number's `min` and `max`; empty when not set |
| `date-type` | `date`, or `datetime-local` when the field has `time: true` |
| `href`, `current` | Link target; `page` on the current entry, otherwise `false` |
| `tone` | Status tone: `neutral` (first status), `notice`, `positive` (last status), or `negative` |
| `variant` | Button variant: `primary`, or `negative` for destructive confirmations |
| `value` | An option's value |
| `icon` | `#pn-icon-<name>` from `design-system/icons.svg` |
| `src`, `alt` | Image source and its description |
| `*-label`, `*-placeholder` | Human text, written for the editor |

Leave an attribute slot empty (`min=""`) when the schema has no value. Never delete the attribute.

## Rule 3: Repeat by copying the one child

Do (three options, each a copy of the single unit):

```html
<select class="pn-select" ... data-slot-repeat="option">
  <option value="essay" data-slot-attr="value:value" data-slot="text">Essay</option>
  <option value="note" data-slot-attr="value:value" data-slot="text">Note</option>
  <option value="link" data-slot-attr="value:value" data-slot="text">Link</option>
</select>
```

Don't (a different element inside the repeat):

```html
<select class="pn-select" ... data-slot-repeat="option">
  <optgroup label="Kinds">...</optgroup>
</select>
```

Zero copies is allowed.

## Rule 4: Runtime state attributes are not structure

These attributes belong to behavior and may appear on any element at runtime: `disabled`, `aria-invalid`, `aria-disabled`, `aria-busy`, `aria-expanded`, `aria-pressed`, `aria-selected`, `open`, `checked`, `selected`, `hidden`, `tabindex`, `value` (on inputs, textareas, selects), `data-force`, `data-static`, `data-dragover`, `data-invalid`. A `<textarea>`'s text is its value, so it is state too: `<textarea ...>Draft text</textarea>` matches the empty template. Do not use them to change structure or look.

## Rule 5: Never edit a template to make something fit

If a schema needs something no template can hold, write a proposal (what is needed, why no template can hold it, the smallest addition) and build it as a `custom` field meanwhile.

## How templates nest

| Container | Holds |
| --- | --- |
| `layout` → `nav` | `nav` |
| `nav` → `account` | `account`, or nothing when `auth` is `none` |
| `layout` → `header` | `header` |
| `layout` → `screen` | One of `screen-home`, `screen-collection`, `screen-item`, `screen-singleton`, or `error` for system errors |
| `layout` → `savebar` | `savebar` on item and singleton screens, nothing elsewhere |
| `layout` → `dialogs` | `screen-create`, `screen-dialog`, `screen-slide-over` |
| `layout` → `toasts` | Toasts (`pn-toast` components) |
| `screen-*` → `fields` | Field templates, in schema order |
| `screen-*` → `empty` | `empty` |
| `screen-*` → `error` | `error` |
| `screen-create` → `fields` | Field templates for the minimum fields |
| `screen-slide-over` → `body` | Field templates, or a `pn-list` for pickers |
| `empty`, `error` → `actions` | `pn-button` components |
| `screen-login` → `methods` | The auth recipe's sign-in controls, built from components |
| `field-custom` → `control` | Controls built from design-system components, as the field's `describe` says |

`screen-login` stands alone: it is not placed inside `layout`.

## Every screen has four states

Screens carry `data-state`, and show exactly one region: `pn-region-loading`, `pn-region-ready`, `pn-region-empty`, or `pn-region-error`. Unsaved changes are shown by the save bar's `data-state`.

## Field states

| State | How it is shown |
| --- | --- |
| Default | As filled |
| Error | `aria-invalid="true"` on the control, message in the `error` slot |
| Disabled | `disabled` on the control |
| Required | `data-required="true"` on the label, `aria-required="true"` on the control |
| Upload empty or filled | `data-state` on the field root (`image`, `file`) |

## Files

| Group | Templates |
| --- | --- |
| `shell/` | `layout`, `nav`, `account`, `header`, `savebar` |
| `screens/` | `home`, `collection`, `item`, `singleton`, `create-dialog` (`screen-create`), `slide-over`, `dialog`, `login`, `empty`, `error` |
| `fields/` | `text`, `textarea`, `markdown`, `number`, `date`, `toggle`, `select`, `tags`, `slug`, `image`, `file`, `relation`, `custom` |

Check a build with `npm run check:templates` (the templates themselves) or with `tools/lib/fidelity.js` (`PanelFidelity.checkDocument`) on any page.
