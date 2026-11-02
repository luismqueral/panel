// One controller per field type: the filled template plus get() and set().

import { tpl, fill, repeat, slotRepeat, slotChildren, formatSize } from "./dom.js";

const changed = (el) => el.dispatchEvent(new Event("input", { bubbles: true }));

export function makeField(field, ctx) {
  const id = `${ctx.prefix}-${field.name}`;
  const el = tpl(`field-${field.type}`);
  const isImage = field.type === "image";
  fill(el, {
    text: { label: field.label, help: field.help ?? "", error: "", prompt: isImage ? "Drop an image, or click to choose" : "Drop a file, or click to choose" },
    attrs: {
      name: field.name,
      width: field.width ?? "1/1",
      required: String(Boolean(field.required)),
      "input-id": id,
      "label-id": `${id}-label`,
      "help-id": `${id}-help`,
      "error-id": `${id}-error`,
      describedby: `${id}-help ${id}-error`,
      to: field.to,
      from: field.from,
      min: field.min ?? "",
      max: field.max ?? "",
      "date-type": field.time ? "datetime-local" : "date",
      "upload-state": "empty",
      "remove-label": `Remove ${field.label.toLowerCase()}`,
      src: "",
      alt: "",
    },
  });
  const control = el.querySelector("input, textarea, select");
  const make = TYPES[field.type] ?? TYPES.text;
  return { el, field, ...make(el, control, field, ctx, id) };
}

const TYPES = {
  text: (el, input) => ({ get: () => input.value, set: (v) => (input.value = v ?? "") }),
  slug: (el, input) => TYPES.text(el, input),
  date: (el, input) => TYPES.text(el, input),
  textarea: (el, input) => TYPES.text(el, input),

  markdown(el, input, field) {
    const toolbar = el.querySelector(".pn-toolbar");
    const wrap = { bold: ["**", "**"], italic: ["_", "_"], link: ["[", "](https://)"] };
    if (field.toolbarOnSelection) {
      const update = () => (toolbar.hidden = input.selectionStart === input.selectionEnd);
      toolbar.hidden = true;
      for (const type of ["select", "keyup", "mouseup", "input"]) input.addEventListener(type, update);
    }
    toolbar.addEventListener("mousedown", (event) => event.target.closest("button") && event.preventDefault());
    toolbar.addEventListener("click", (event) => {
      const action = event.target.closest("[data-action]")?.dataset.action;
      if (!action) return;
      const { selectionStart: start, selectionEnd: end, value } = input;
      if (action === "heading") {
        const lineStart = value.lastIndexOf("\n", start - 1) + 1;
        input.setRangeText("## ", lineStart, lineStart, "end");
      } else {
        const [before, after] = wrap[action];
        input.setRangeText(`${before}${value.slice(start, end)}${after}`, start, end, "select");
      }
      input.focus();
      changed(input);
    });
    return TYPES.text(el, input);
  },

  number: (el, input) => ({
    get: () => (input.value === "" ? null : Number(input.value)),
    set: (v) => (input.value = v ?? ""),
  }),

  toggle: (el, input) => ({ get: () => input.checked, set: (v) => (input.checked = Boolean(v)) }),

  select(el, input, field) {
    const options = [{ value: "", text: "Choose…" }, ...(field.options ?? []).map((o) => ({ value: o, text: o }))];
    repeat(input, options, (unit, o) => fill(unit, { text: { text: o.text }, attrs: { value: o.value } }));
    return TYPES.text(el, input);
  },

  relation(el, input, field, ctx) {
    const options = [{ value: "", text: "Choose…" }, ...(ctx.options?.[field.to] ?? [])];
    repeat(input, options, (unit, o) => fill(unit, { text: { text: o.text }, attrs: { value: o.value } }));
    return TYPES.text(el, input);
  },

  tags(el, input, field) {
    const list = slotRepeat(el, "tag");
    let tags = [];
    const render = () =>
      repeat(list, tags, (unit, tag) => fill(unit, { text: { text: tag }, attrs: { "remove-label": `Remove ${tag}` } }));
    function add() {
      const tag = input.value.trim().replace(/,$/, "");
      input.value = "";
      if (tag && !tags.includes(tag)) (tags = [...tags, tag]), render();
      changed(el);
    }
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === ",") {
        event.preventDefault();
        add();
      } else if (event.key === "Backspace" && !input.value && tags.length) {
        tags = tags.slice(0, -1);
        render();
        changed(el);
      }
    });
    input.addEventListener("blur", () => input.value.trim() && add());
    list.addEventListener("click", (event) => {
      const remove = event.target.closest('[data-action="remove-tag"]');
      if (!remove) return;
      const index = [...list.children].indexOf(remove.closest(".pn-tag"));
      tags = tags.filter((_, i) => i !== index);
      render();
      input.focus();
      changed(el);
    });
    render();
    return { get: () => [...tags], set: (v) => ((tags = [...(v ?? [])]), render()) };
  },

  image: (el, input, field, ctx) => upload(el, input, field, ctx, true),
  file: (el, input, field, ctx) => upload(el, input, field, ctx, false),

  custom(el, input, field, ctx, id) {
    const out = document.createElement("input");
    out.className = "pn-input";
    out.type = "text";
    out.readOnly = true;
    out.id = id;
    out.setAttribute("aria-labelledby", `${id}-label`);
    out.setAttribute("aria-describedby", `${id}-help ${id}-error`);
    slotChildren(el, "control").append(out);
    const compute = ctx.computed?.[field.compute];
    const refresh = () => (out.value = compute ? compute.display(ctx.values()) : "");
    ctx.root?.addEventListener("input", refresh);
    queueMicrotask(refresh);
    return { get: () => (compute ? compute.value(ctx.values()) : null), set: () => queueMicrotask(refresh), refresh };
  },
};

function upload(el, input, field, ctx, isImage) {
  const zone = el.querySelector(".pn-dropzone");
  const error = el.querySelector(".pn-error");
  let value = null;
  function set(v) {
    value = v ?? null;
    el.dataset.state = value ? "filled" : "empty";
    fill(el, { text: { "file-name": value?.name ?? "", "file-meta": value ? formatSize(value.size) : "" }, attrs: { src: value?.url ?? "", alt: value ? `${field.label}: ${value.name}` : "" } });
  }
  async function take(file) {
    if (!file) return;
    zone.setAttribute("aria-busy", "true");
    try {
      set(await ctx.files.upload(file));
      changed(el);
    } catch {
      error.textContent = "Could not upload. Try again.";
    } finally {
      zone.removeAttribute("aria-busy");
      input.value = "";
    }
  }
  input.addEventListener("change", () => take(input.files[0]));
  zone.addEventListener("dragover", (event) => {
    event.preventDefault();
    zone.setAttribute("data-dragover", "");
  });
  zone.addEventListener("dragleave", () => zone.removeAttribute("data-dragover"));
  zone.addEventListener("drop", (event) => {
    event.preventDefault();
    zone.removeAttribute("data-dragover");
    take(event.dataTransfer.files[0]);
  });
  el.querySelector('[data-action="remove-file"]').addEventListener("click", () => {
    set(null);
    changed(el);
    input.focus();
  });
  set(null);
  return { get: () => value, set };
}
