# Vue flavor

How to write the panel in Vue 3. `build.md` says what to build. This file says how to write it in Vue. The host profile in the intake record (`intake.md` Rule 2) comes first.

Status: unverified. No Vue reference build exists, and no component files ship. Tell the person so before you build, and run the behavior suite against the result: `PANEL_URL=<url> npm run test:behavior`.

## What you write

There are no Vue files to copy. Write one single-file component per template, from the HTML in `templates/`, and one composable per behavior spec section. Copy these as they are:

| From | To (fallback layout) |
| --- | --- |
| `snippets/validation.js`, `dialogs.js`, `keyboard.js`, `create-flow.js` | `panel/snippets/` |
| `design-system/tokens.css`, `components.css` | `panel/`, imported once from the entry file |
| `recipes/client/*.js` | `panel/adapters/` |

`flavors/react/` is a working example of the same split. Read it for the shape of each component and hook, then write the Vue version.

## Translating a template

Vue templates are HTML, so most of the file copies over unchanged.

| HTML | Vue |
| --- | --- |
| `class`, `for`, `tabindex` | Unchanged. |
| `data-slot`, `data-slot-attr`, `data-slot-repeat`, `data-slot-children`, `data-template` | Keep them literally, with the same values. |
| A `data-slot` element | `<span data-slot="title">{{ title }}</span>` |
| A `data-slot-attr` value | `:href="row.href"`. Keep the marker. |
| A `data-slot-repeat` parent | `v-for` on the single child, with a `:key`. Zero items renders nothing. |
| A `data-slot-children` container | A `<slot>` or a named slot. The contents are free. |
| `aria-*` strings | Bind strings, not booleans: `:aria-current="on ? 'page' : 'false'"`. |

Don't: wrap the template in a `<Transition>` or another element, or add classes outside a `data-slot-children` container. Don't use `v-html` for values.

## Behavior: one composable per spec section

| Spec section | In Vue |
| --- | --- |
| 1. Save state | `useSaveState()`: `values` (reactive), the last saved values, `state` as a `computed`, `save(extra)`, `revert`. |
| 2. Validation | `useValidation()`, calling `check` from `snippets/validation.js`. |
| 3. Dialogs | `openDialog` and `confirmDialog` from `snippets/dialogs.js`, with a template ref to the `<dialog>`. |
| 4. Keyboard | `installShortcuts` in `onMounted`; call its cleanup in `onUnmounted`. |
| 5. Create flow | `slugify` from `snippets/create-flow.js`. |
| 6. Status | Plain handlers on the item screen. |
| 7. Test contract | `window.panelTest` from `adapters.test`. After `reset(seed)`, change the route and `await nextTick()`. |
| 8. Field controls | One component per field type, following `flavors/react/fields.jsx`. |

## Pitfalls

- **`<dialog open>`**: never bind `open`. Open dialogs with `snippets/dialogs.js`.
- **Slots outside the screen**: render the save bar and the create dialog with `<Teleport>` into the layout's `savebar` and `dialogs` slot elements.
- **`v-model` on `<textarea>`**: fine. The fidelity check ignores a textarea's text.
- **Empty `src`**: bind a transparent GIF data URI rather than an empty string, as the React flavor does.
- **Comment nodes**: Vue leaves `<!--v-if-->` comments in the DOM. The fidelity check ignores comments, but use `v-show` or the `hidden` attribute where a template has a `hidden` element.

## Host shapes

- **Vite single-page app**: a separate entry page with its own root element, the sprite inlined, hash routes. Same as `flavors/react.md`.
- **Nuxt**: one page wrapped in `<ClientOnly>`, or `ssr: false` for the panel route. Write the `/api` routes as server routes that follow `recipes/contracts.md`, or proxy to the project server.

## Style isolation

The same as `flavors/react.md`: global, unlayered panel CSS, loaded once, on a page that doesn't load the host's global resets. Don't use `<style scoped>` for panel CSS; they add a `data-v-` attribute to every element in the component, and the fidelity check rejects it.

## Checklist

- [ ] Every component renders its template file exactly, slot markers included.
- [ ] No `<dialog>` has `open` bound.
- [ ] `?test` selects the memory adapters.
- [ ] Hashes that don't start with `#/` are left to the browser (K6).
- [ ] `PANEL_URL=<url> npm run test:behavior` passes.
