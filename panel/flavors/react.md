# React flavor

How to write the panel in React. `build.md` says what to build: screens, copy, adapters, conformance. This file says how to write that in React. The host profile in the intake record (`intake.md` Rule 2) comes first: its language, folders, router, and naming beat every fallback here.

Status: verified. `evals/fixtures/react-blog/` is built from these files with Vite and passes the full behavior suite and the quality checks.

## What you copy

| From | To (fallback layout) | What it is |
| --- | --- | --- |
| `flavors/react/templates.jsx` | `panel/templates.jsx` | Every template as a component. It renders the template file exactly, slot markers included. |
| `flavors/react/fields.jsx` | `panel/fields.jsx` | `Field`: one control per field type (F1–F4 included). |
| `flavors/react/hooks.js` | `panel/hooks.js` | The behavior spec as hooks. |
| `snippets/validation.js`, `dialogs.js`, `keyboard.js`, `create-flow.js` | `panel/snippets/` | Shared rules and native dialog code. The hooks import them. |
| `design-system/tokens.css`, `components.css` | `panel/` | Imported once from the entry file. |
| `recipes/client/*.js` | `panel/adapters/` | Adapters (`memory.js` always, plus one per recipe). |

Copy these files as they are. Change only what the host profile requires: file extensions (`.tsx`, with prop types added), import paths, and lint formatting. Do not change markup in `templates.jsx` or `fields.jsx`. The fidelity check compares the rendered page to the template files.

Don't: rewrite a template as your own component because the host has a `Button` or `Card`. Host component libraries are not used inside the panel (D-032).

## Translating a template by hand

Use this when a template has no component yet, or the host needs a different shape (for example, a server component). Write it from the HTML file in `templates/` with these rules:

| HTML | JSX |
| --- | --- |
| `class` | `className` |
| `for` | `htmlFor` |
| `tabindex="-1"` | `tabIndex={-1}` |
| `data-slot`, `data-slot-attr`, `data-slot-repeat`, `data-slot-children`, `data-template` | Keep them literally, with the same values. |
| A `data-slot` element | Put the value in as children: `<span data-slot="title">{title}</span>`. |
| A `data-slot-attr` value | Put it in as a prop: `href={row.href}`. Keep the marker. |
| A `data-slot-repeat` parent | `{items.map(...)}` of the single child, with a `key`. Zero items renders nothing. |
| A `data-slot-children` container | `{children}` or a named prop. The contents are free. |
| `aria-*`, `role`, `type`, `data-variant`, `data-size` | Keep them exactly. Booleans that are strings in HTML stay strings: `aria-current={on ? "page" : "false"}`. |
| A fixed text node ("Log out", "Skip to content") | Keep it exactly. |

Don't: add wrapper elements, `className` additions, or `style` outside a `data-slot-children` container. Inside one, anything goes.

## Behavior: one hook per spec section

| Spec section | In React |
| --- | --- |
| 1. Save state (S1–S9, A1–A4) | `useSaveState({ initial, save, validate, autosave, onRevert })` returns `values`, `setValue`, `state`, `dirty`, `locked`, `busy`, `message`, `save(extra)`, `revert`, `say`. Pass `locked` as `disabled` to every field. Render `Savebar` with `state`, `message`, `busy`. |
| 2. Validation (V1–V6) | `useValidation(fields, values, prefix)` returns `errors`, `blur`, `run(mode, extraRequired)`, `focus`, `clear`. Call `run` from `validate`. Pass `blur` as `onLeave`. |
| 3. Dialogs (D1–D6) | `useConfirm()` returns `{ ref, props, ask }`. Render `<Dialog dialogRef={ref} {...props} />` once. `await ask({ title, text, confirmLabel, variant, opener })` returns true or false. Dialogs are opened by `snippets/dialogs.js`, never by rendering `open`. |
| 4. Keyboard (K1–K6) | `useShortcuts({ save, search })`. K6: in your hash router, ignore hashes that don't start with `#/`. |
| 5. Create flow (C1–C6) | `slugify` from `snippets/create-flow.js`; `openDialog` for the dialog. Keep the dialog's values in component state; reset them each time it opens. |
| 6. Status (P1–P5) | Plain handlers on the item screen: `ask` before publishing when `confirmPublish` is set; `save({ status })` with the publish requirements as `run("publish", requires)`. |
| 7. Test contract | Build `window.panelTest` from `adapters.test`. `reset(seed)` must re-render synchronously: wrap the route change in `flushSync`. |
| 8. Field controls (F1–F4) | `Field` does them. Pass `files`, `computed`, and `values` (for computed fields). |

The rules themselves (`check`, `MESSAGES`, `slugify`, the focus trap) live in the shared snippets. Don't copy them into the hooks.

## Pitfalls

These broke while the reference build was written. Each one is handled in the copied files. Keep the fixes if you edit them.

- **`<dialog open>`**: rendering `open` shows the dialog without a backdrop, a focus trap, or Escape. Always render the dialog closed and open it with `openDialog` or `ask`.
- **Empty `src`**: React drops `src=""` and warns. An empty image uses a transparent GIF data URI, so the `<img>` keeps its attribute.
- **`onSelect`**: React's `onSelect` does not fire for every selection change in a `<textarea>`. The markdown toolbar (F3) adds a native `select` listener too.
- **Slots outside the screen**: the save bar and the create dialog belong in the layout's `savebar` and `dialogs` slots, not in the screen. Render them through `createPortal` into those slot elements. Keep the slot elements in state, set from a ref callback.
- **Leaving with unsaved changes (S9)**: the hashchange guard runs outside React. Keep "is it dirty" in a ref that the editor updates on render, not in state. Use the listener from `build.md` step 4, "Routing", with `setRoute` in place of `route()`.
- **Stale screens**: give each screen a `key` built from the route, so moving from one item to another remounts it and loads fresh data.
- **Values vs. saved values**: the save state compares `values` to the last saved values. Initialize both from the same object, computed fields included, or the bar starts dirty.
- **`ref` as a prop**: in React 19 a function component receives `ref` as a normal prop. In React 18, use `forwardRef`.

## Adapters

The flavor adds nothing. Use `recipes/contracts.md` and the recipe files. In the entry file, pick memory adapters when the URL has `?test`, otherwise the recipe adapters, and pass them to the app as one prop:

```jsx
const adapters = new URLSearchParams(location.search).has("test")
  ? createMemoryAdapters(seed)
  : { ...createHttpAdapters(request), auth: createGoogleAuth(request) };
createRoot(document.getElementById("panel")).render(<App adapters={adapters} />);
```

## Host shapes

### Vite single-page app (verified)

- Mount: a separate entry, `panel.html`, with its own root element, so the panel is not inside the host's layout or providers. Add it to `build.rollupOptions.input`.
- Sprite: inline `design-system/icons.svg` into the page. A small plugin with `transformIndexHtml` that replaces a marker comment does it (see `evals/fixtures/react-blog/vite.config.js`).
- Routing: the panel uses hash routes (`behavior-spec.md` section 7). Don't put it under the host's router.
- Server: the project server (`recipes/server/`) serves `/api`. In development, proxy `/api` to it with `server.proxy`.

### Next.js (unverified)

- Mount: one client page, for example `app/panel/page.tsx`, starting with `"use client"`, that renders the app. Load it with `next/dynamic` and `ssr: false`. The panel reads `location`, `window`, and `<dialog>` at startup.
- Sprite: render the contents of `icons.svg` once in that page, hidden.
- Routing: hash routes stay inside the page. Next's router does not see them.
- Server: write the `/api` routes as route handlers that call the same contract (`recipes/contracts.md`), or run the project server beside the app and proxy to it.
- Auth: if the host has its own auth, that is a host recipe. Raise it as a proposal (D-031).

## Style isolation

- Every panel class starts with `pn-`, every token with `--pn-`, and every component rule is scoped by its class. Host styles that target bare elements can still reach inside.
- **Tailwind**: its preflight lives in `@layer base`. The panel CSS is not in a layer, so it wins. Don't import the panel CSS into a Tailwind layer, and don't add utility classes inside the panel.
- **Global resets** (`* { box-sizing }`, `button { all: unset }`): mount the panel on its own page (see host shapes), so the host's global CSS is not loaded.
- **CSS modules or CSS-in-JS**: import the two panel CSS files as plain global CSS from the panel's entry, not as modules.

## Checklist

- [ ] The copied files are unchanged, except for what the host profile requires.
- [ ] Every screen renders inside `Layout`. The save bar and dialogs render into their layout slots.
- [ ] No `<dialog>` is rendered with `open`.
- [ ] `?test` selects the memory adapters, and `window.panelTest.reset` re-renders synchronously.
- [ ] Hashes that don't start with `#/` are left to the browser (K6).
- [ ] The panel CSS is global, unlayered, and loaded once.
- [ ] `PANEL_URL=<url> npm run test:behavior` passes, including the fidelity and accessibility checks.
