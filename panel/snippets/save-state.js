// Save state and autosave. behavior-spec.md section 1 (S1–S8, A1–A4) and K7. Optional vanilla snippet.
//
// const saveState = createSaveState({
//   form, savebar,                     // the item's <form> and the savebar template instance
//   read: () => values,                // current field values
//   write: (values) => {},             // put values back into the fields
//   save: async (values, extra) => {}, // write through the data adapter; throw on failure
//   validate: (values, { background, extra }) => true, // false blocks the save (V3, V4)
//   autosave: { every: 10000, when: () => isDraft },   // only when a behavior line asks for it
//   onRevert: () => {},
// });

const MESSAGES = {
  clean: "All changes saved",
  dirty: "Unsaved changes",
  saving: "Saving…",
  error: "Could not save. Your changes are kept.",
};

export function createSaveState({ form, savebar, read, write, save, validate, autosave, onRevert }) {
  let saved = read();
  let state = "clean";
  let background = false;
  let note = null;
  const locked = new Set();
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const message = savebar.querySelector(".pn-savebar-message");
  const saveButton = savebar.querySelector('[data-action="save"]');
  const revertButton = savebar.querySelector('[data-action="revert"]');

  function render() {
    savebar.dataset.state = state;
    message.textContent = note ?? (background ? MESSAGES.saving : MESSAGES[state]);
    const idle = state === "clean" || state === "saving";
    saveButton.disabled = idle;
    revertButton.disabled = idle;
    savebar.setAttribute("aria-busy", String(state === "saving" || background));
  }

  function lock(on) {
    if (on) {
      for (const el of form.elements) if (!el.disabled) (el.disabled = true), locked.add(el);
    } else {
      for (const el of locked) el.disabled = false;
      locked.clear();
    }
  }

  function onEdit() {
    if (state === "saving") return;
    note = null;
    state = same(read(), saved) ? "clean" : "dirty";
    render();
  }

  async function run({ isBackground = false, extra } = {}) {
    if (state === "saving" || background) return false;
    if (!isBackground && state === "clean" && !extra) return true;
    const values = read();
    if (validate && !validate(values, { background: isBackground, extra })) return false;
    note = null;
    if (isBackground) background = true;
    else (state = "saving"), lock(true);
    render();
    try {
      await save(values, extra);
      saved = values;
      background = false;
      lock(false);
      state = same(read(), saved) ? "clean" : "dirty";
      render();
      return true;
    } catch {
      background = false;
      lock(false);
      state = "error";
      render();
      return false;
    }
  }

  function revert() {
    if (state === "saving") return;
    write(saved);
    note = null;
    state = "clean";
    render();
    onRevert?.();
  }

  function onBeforeUnload(event) {
    if (state === "dirty" || state === "error") {
      event.preventDefault();
      event.returnValue = "";
    }
  }

  const onSaveClick = () => run();
  const onSubmit = (event) => event.preventDefault();
  form.addEventListener("submit", onSubmit);
  form.addEventListener("input", onEdit);
  form.addEventListener("change", onEdit);
  saveButton.addEventListener("click", onSaveClick);
  revertButton.addEventListener("click", revert);
  window.addEventListener("beforeunload", onBeforeUnload);
  const timer = autosave ? setInterval(() => state === "dirty" && autosave.when() && run({ isBackground: true }), autosave.every) : null;
  render();

  return {
    get state() {
      return state;
    },
    get dirty() {
      return state === "dirty" || state === "error";
    },
    save: (extra) => run({ extra }),
    revert,
    // Show a one-off message (for example V4's "Fix N fields to publish") until the next edit or save.
    say(text) {
      note = text;
      render();
    },
    destroy() {
      form.removeEventListener("submit", onSubmit);
      form.removeEventListener("input", onEdit);
      form.removeEventListener("change", onEdit);
      saveButton.removeEventListener("click", onSaveClick);
      revertButton.removeEventListener("click", revert);
      window.removeEventListener("beforeunload", onBeforeUnload);
      if (timer) clearInterval(timer);
    },
  };
}
