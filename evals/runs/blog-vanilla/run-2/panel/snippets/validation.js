// Validation. behavior-spec.md section 2 (V1–V6). Optional vanilla snippet.
//
// const validation = createValidation({
//   root,                          // element containing the field templates
//   fields: [{ name, label, type, required, min, max, time }],
//   get: (name) => value,
// });
// validation.run("publish")       // shows every error, returns the invalid field names

export const MESSAGES = {
  publishRequired: "Required to publish.",
  createRequired: "Required.",
  number: "Enter a number.",
  slug: "Use lowercase letters, numbers, and dashes.",
  date: "Use a date like 2026-11-01.",
};

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function isEmpty(value) {
  return value === "" || value === null || value === undefined || (Array.isArray(value) && value.length === 0);
}

function range(field) {
  const { min, max } = field;
  if (min !== undefined && max !== undefined) return `Must be between ${min} and ${max}.`;
  if (min !== undefined) return `Must be at least ${min}.`;
  return `Must be at most ${max}.`;
}

// mode: "format" (blur, save), "publish", or "create". Returns a message, or "" when valid.
export function check(field, value, mode = "format") {
  if (isEmpty(value)) {
    if (field.required && mode === "publish") return MESSAGES.publishRequired;
    if (field.required && mode === "create") return MESSAGES.createRequired;
    return "";
  }
  if (field.type === "number") {
    const n = Number(value);
    if (Number.isNaN(n)) return MESSAGES.number;
    if ((field.min !== undefined && n < field.min) || (field.max !== undefined && n > field.max)) return range(field);
  }
  if (field.type === "slug" && !SLUG.test(value)) return MESSAGES.slug;
  if (field.type === "date") {
    const ok = field.time ? /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?)?$/ : /^\d{4}-\d{2}-\d{2}$/;
    if (!ok.test(value)) return MESSAGES.date;
  }
  return "";
}

export function createValidation({ root, fields, get }) {
  const byName = new Map(fields.map((f) => [f.name, f]));
  const showing = new Set();
  let mode = null;

  const fieldRoot = (name) => root.querySelector(`[data-field="${name}"]`);

  function show(name, message) {
    const el = fieldRoot(name);
    if (!el) return;
    el.querySelector(".pn-error").textContent = message;
    for (const control of el.querySelectorAll("input, textarea, select")) {
      if (message) control.setAttribute("aria-invalid", "true");
      else control.removeAttribute("aria-invalid");
    }
    if (message) showing.add(name);
    else showing.delete(name);
  }

  function nameOf(target) {
    return target.closest?.("[data-field]")?.getAttribute("data-field");
  }

  function onLeave(event) {
    const name = nameOf(event.target);
    if (!name || !byName.has(name)) return;
    if (fieldRoot(name).contains(event.relatedTarget)) return;
    show(name, check(byName.get(name), get(name), mode ?? "format"));
  }

  function onInput(event) {
    const name = nameOf(event.target);
    if (!name || !byName.has(name)) return;
    if (showing.has(name) || mode) show(name, check(byName.get(name), get(name), mode ?? "format"));
  }

  root.addEventListener("focusout", onLeave);
  root.addEventListener("input", onInput);
  root.addEventListener("change", onInput);

  return {
    // Checks every field in a mode, shows the errors, and returns the invalid names (V4, V6).
    run(runMode, extraRequired = []) {
      mode = runMode;
      const invalid = [];
      for (const field of fields) {
        const rule = extraRequired.includes(field.name) ? { ...field, required: true } : field;
        const message = check(rule, get(field.name), runMode);
        show(field.name, message);
        if (message) invalid.push(field.name);
      }
      return invalid;
    },
    // Format-only check with no errors shown, for background saves.
    valid() {
      return fields.every((f) => !check(f, get(f.name), "format"));
    },
    focus(name) {
      fieldRoot(name)?.querySelector("input, textarea, select")?.focus();
    },
    clear() {
      mode = null;
      for (const name of [...showing]) show(name, "");
    },
    destroy() {
      root.removeEventListener("focusout", onLeave);
      root.removeEventListener("input", onInput);
      root.removeEventListener("change", onInput);
    },
  };
}
