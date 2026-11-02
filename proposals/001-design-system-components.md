# Proposal 001: Components the screens and fields need

**Status:** Accepted for Phase 1 (D-006). Revisit when `panel/PHILOSOPHY.md` has principles.

## What is needed

The Phase 1 list (buttons, text input, textarea, select, radio, checkbox, toggle, tag, tabs, breadcrumb, dialog, drawer, toast, empty state) cannot build every screen in Appendix F or every field type in Appendix C.

| Need | Forced by | Why existing parts cannot do it |
| --- | --- | --- |
| Field wrapper: label, help, error message | Every field template | Inputs have no shared way to tie a label, help text, and error to a control |
| Status indicator | Collection rows, item sidebar, `status` key | A tag is a removable label the editor typed; status is a fixed state with meaning |
| List of rows | Collection screen, relation picker, Home | No component lays out a title, subtitle, status, and meta in a row |
| Spinner | `saving` state, loading state on every screen | Nothing communicates "working" |
| Dropzone and file row | `image` and `file` fields | No upload target or uploaded-file display |
| Tags input | `tags` field | A tag shows one label; it cannot collect new ones |
| Toolbar | `markdown` field, list actions | Buttons have no grouped, compact arrangement |
| Icon | Close, add, search, upload, status, alerts | Buttons and toasts need small glyphs |

## The smallest addition

Eight components, each built from existing tokens, each with default, hover, focus, disabled, and error states where the state applies:

`pn-field`, `pn-status`, `pn-list`, `pn-spinner`, `pn-dropzone` (with `pn-file`), `pn-tags-input`, `pn-toolbar`, `pn-icon`.

Not added, on purpose:

- **Table and cards.** The collection screen uses `pn-list` only. Add a table or cards when an example needs columns or images in the list.
- **Menu or dropdown.** Item actions use buttons in the header. Add a menu when an action set no longer fits.
- **Date picker.** `date` uses the native `<input type="date">` styled as `pn-input`.
- **Markdown preview or rich editor.** `markdown` is a `pn-textarea` plus `pn-toolbar`.
- **Combobox.** `relation` uses `pn-select` for now, or a `pn-list` inside a drawer when the target type is large.

## Deferred to Phase 2

Layout pieces belong with the shell templates and are added to `components.css` in Phase 2: page layout, nav, header, item sidebar, save bar, and the form grid container's screen-level placement. The grid itself (`pn-grid` and `data-width`) ships in Phase 1 because fields depend on it.
