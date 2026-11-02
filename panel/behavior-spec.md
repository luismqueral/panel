# Behavior spec

The baseline logic every panel implements, in every flavor. Each rule has an id. Browser tests in `evals/behavior/` check each rule by id against vanilla and every flavor. A flavor may not change a rule. New behavior is added here and to the vanilla snippets first.

Words used below:

- **Saved values**: the values last loaded from, or written to, the data adapter.
- **First status**: the first entry of a type's `status`. Items without `status` have no workflow.
- **Publish**: moving an item out of its first status.

## 1. Save state

The save bar's `data-state` always shows the current state.

| State | Entered when | Shows | Exits to |
| --- | --- | --- | --- |
| `clean` | Item loads, save succeeds, or revert | Message "All changes saved". Save and Revert disabled | `dirty` |
| `dirty` | A field's value differs from the saved values | Message "Unsaved changes". Save and Revert enabled | `saving`, `clean` |
| `saving` | Save pressed, or Cmd+S / Ctrl+S | Message "Saving…", spinner. Fields, Save, and Revert disabled | `clean`, `error` |
| `error` | A save fails | Message "Could not save. Your changes are kept." Save (retry) and Revert enabled | `saving`, `dirty`, `clean` |

| Id | Rule |
| --- | --- |
| S1 | A loaded item is `clean`. |
| S2 | Any edit that makes the values differ from the saved values enters `dirty`. An edit that makes them equal again returns to `clean`. |
| S3 | Save or Cmd+S / Ctrl+S in `dirty` or `error` enters `saving`, disables every field, and sends the current values. |
| S4 | A successful save stores the sent values as saved values and enters `clean`. |
| S5 | A failed save enters `error`, re-enables fields, and keeps every edit. |
| S6 | Revert restores the saved values and enters `clean`. |
| S7 | Cmd+S / Ctrl+S never opens the browser's save dialog on a panel screen. In `clean` it does nothing. |
| S8 | Leaving the page while `dirty` or `error` asks the browser to confirm (`beforeunload`). |
| S9 | Moving to another panel screen while `dirty` or `error` opens a confirm dialog ("Discard unsaved changes?", negative). Cancel stays on the screen with every edit kept. |

### Autosave

Autosave exists only when a `behavior` line asks for it ("Autosave drafts every 10 seconds"). It is a background save.

| Id | Rule |
| --- | --- |
| A1 | Every interval, if the item is `dirty` (and in its first status, when the behavior says "drafts"), save in the background. |
| A2 | A background save never disables fields and never enters `saving`. The message reads "Saving…" while it runs. |
| A3 | When it succeeds and nothing changed during it, enter `clean`. When the person edited during it, stay `dirty`, with the sent values as the new saved values. |
| A4 | When it fails, enter `error` without disabling fields. |

## 2. Validation

| Id | Rule |
| --- | --- |
| V1 | No error appears while a person types in a field they have not left yet, unless a save, publish, or create was attempted. |
| V2 | Leaving a field checks its format only: number within `min` and `max`, slug pattern, date format. Missing required values are not errors on blur. |
| V3 | Saving is blocked only by format errors. A draft with empty required fields saves. |
| V4 | Publishing is blocked by any format error or empty required field. Every invalid field shows its error, the first one receives focus, and the save bar message reads "Fix N fields to publish". |
| V5 | An error is shown as `aria-invalid="true"` on the control and a message in the field's error slot. It clears as soon as the value becomes valid. |
| V6 | In the create dialog, required fields must be filled before Create succeeds. |

Messages:

| Problem | Message |
| --- | --- |
| Empty required field, publishing | "Required to publish." |
| Empty required field, creating | "Required." |
| Number out of range | "Must be between {min} and {max}." (or "at least {min}", "at most {max}") |
| Slug | "Use lowercase letters, numbers, and dashes." |
| Date | "Use a date like 2026-11-01." |

## 3. Dialogs

| Id | Rule |
| --- | --- |
| D1 | Dialogs open modally (`showModal`). Focus moves to the first field. With no field, focus moves to Cancel when the confirm button is negative, otherwise to the confirm button. |
| D2 | Tab and Shift+Tab cycle inside the open dialog. |
| D3 | Escape closes the topmost dialog as Cancel. |
| D4 | Clicking the backdrop does nothing. |
| D5 | When a dialog closes, focus returns to the element that opened it. |
| D6 | A confirm dialog resolves to confirmed only through its confirm button. |

## 4. Keyboard

| Id | Rule |
| --- | --- |
| K1 | Cmd+S / Ctrl+S saves on item and singleton screens (see S3, S7). |
| K2 | Escape closes the topmost dialog (see D3). |
| K3 | `/` moves focus to the collection search, unless focus is already in a text control. |
| K4 | Enter in a create dialog's text field submits it. |
| K5 | Every action can be reached with Tab and shows a visible focus ring. Checked by the design-system check, and by axe on every screen. |

## 5. Create flow

| Id | Rule |
| --- | --- |
| C1 | The collection's add button opens the create dialog. It asks only for the field named by `list.title`, plus any `slug` made `from` it. |
| C2 | The slug fills in from its source as the person types, until the person edits the slug by hand. |
| C3 | Create (button or Enter) runs V6. |
| C4 | On success the item is created in its first status with every `default` applied, the dialog closes, and the item view opens. |
| C5 | On failure the dialog stays open, values are kept, and a toast says "Could not create. Try again." |
| C6 | Cancel or Escape closes the dialog and creates nothing. |

## 6. Status

| Id | Rule |
| --- | --- |
| P1 | The status button in the item header shows the current status. Types without `status` show none. |
| P2 | With two statuses, the button moves to the other one. With more, it opens a slide-over listing them. |
| P3 | Publishing runs V4 first. If it fails, the status does not change. |
| P4 | When a `behavior` line says publishing asks for confirmation, a confirm dialog appears before publishing. |
| P5 | A status change saves immediately, together with any unsaved edits, through S3 to S5. |

## 7. What a test page exposes

Browser tests drive a panel only through the templates' classes and `data-action` attributes, plus this hook, so the same tests run against every flavor:

```js
window.panelTest = {
  adapter,          // the data adapter in use; must be the test memory adapter
  fail(method),     // make the next call to adapter[method] reject
  delay(ms),        // make every adapter call take ms milliseconds
  calls,            // array of { method, args } in call order
  reset(seed),      // replace all data with seed (see evals/behavior/seed.json)
};
```

Every screen also passes template fidelity, axe, and a 400px width with no sideways scroll (`evals/behavior/quality.spec.mjs`).

Routes use the hash: `#/` home, `#/<type id>` collection, `#/<type id>/<item id>` item, `#/<singleton id>` singleton.

## 8. Field controls

| Id | Rule |
| --- | --- |
| F1 | Tags: Enter or comma adds the typed tag. Leaving the input adds it too. Duplicates and blanks are ignored. Backspace in an empty input removes the last tag. Each tag's remove button removes it and returns focus to the input. |
| F2 | Image and file: choosing or dropping a file uploads it through the files adapter and sets `data-state="filled"`. The remove button clears it and sets `data-state="empty"`. A failed upload shows "Could not upload. Try again." and keeps the old value. |
| F3 | Markdown: each toolbar button wraps the selection (`**bold**`, `_italic_`, `[link](https://)`) or prefixes the line (`## `), and counts as an edit. |
| F4 | Custom fields with a computed value are read-only, update as their sources change, and save the computed value. |
