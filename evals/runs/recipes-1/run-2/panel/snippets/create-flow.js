// Create flow. behavior-spec.md section 5 (C1–C6). Optional vanilla snippet.
//
// const flow = createFlow({
//   dialog,                         // a filled screen-create template
//   title: "title", slug: "slug",   // field names: list.title, and a slug made from it (or null)
//   validation,                     // createValidation() over the dialog
//   read: () => values,
//   create: async (values) => item, // throw on failure
//   onCreated: (item) => {},        // open the item view
//   onError: () => {},              // show the "Could not create. Try again." toast
// });
// flow.open(opener);

import { openDialog } from "./dialogs.js";

export function slugify(text) {
  return text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function createFlow({ dialog, title, slug, validation, read, create, onCreated, onError }) {
  const input = (name) => dialog.querySelector(`[data-field="${name}"] input`);
  let slugTouched = false;
  let busy = false;

  input(title).addEventListener("input", () => {
    if (slug && !slugTouched) input(slug).value = slugify(input(title).value);
  });
  if (slug) input(slug).addEventListener("input", () => (slugTouched = true));

  async function submit() {
    if (busy) return;
    const invalid = validation.run("create");
    if (invalid.length) return validation.focus(invalid[0]);
    busy = true;
    try {
      const item = await create(read());
      dialog.close("create");
      onCreated(item);
    } catch {
      onError();
    } finally {
      busy = false;
    }
  }

  dialog.querySelector('[data-action="create"]').addEventListener("click", (event) => {
    event.preventDefault();
    submit();
  });
  dialog.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && event.target instanceof HTMLInputElement) {
      event.preventDefault();
      submit();
    }
  });

  return {
    open(opener) {
      for (const el of dialog.querySelectorAll("input")) el.value = "";
      slugTouched = false;
      validation.clear();
      return openDialog(dialog, { opener });
    },
  };
}
