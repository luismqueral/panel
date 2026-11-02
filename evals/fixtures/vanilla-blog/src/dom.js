// Filling templates. Templates are inlined verbatim as <template data-panel-template="name">.

export function tpl(name) {
  const source = document.querySelector(`template[data-panel-template="${name}"]`);
  if (!source) throw new Error(`missing template ${name}`);
  return source.content.firstElementChild.cloneNode(true);
}

// True when node belongs to root itself, not to a repeat unit inside it.
function own(root, node) {
  const repeat = node.parentElement?.closest("[data-slot-repeat]");
  return !repeat || !root.contains(repeat) || repeat === root;
}

export function fill(root, { text = {}, attrs = {} } = {}) {
  for (const [key, value] of Object.entries(text)) {
    const node = root.getAttribute("data-slot") === key ? root : [...root.querySelectorAll(`[data-slot="${key}"]`)].find((n) => own(root, n));
    if (node) node.textContent = value ?? "";
  }
  const nodes = [root, ...root.querySelectorAll("[data-slot-attr]")].filter((n) => n.hasAttribute("data-slot-attr") && (n === root || own(root, n)));
  for (const node of nodes) {
    for (const pair of node.getAttribute("data-slot-attr").split(/\s+/)) {
      const [attr, key = attr] = pair.split(":");
      if (key in attrs) node.setAttribute(attr, attrs[key] ?? "");
    }
  }
  return root;
}

const units = new WeakMap();

// Replaces a data-slot-repeat container's children with one filled copy of its unit per item.
export function repeat(container, items, fillUnit) {
  if (!units.has(container)) units.set(container, container.firstElementChild.cloneNode(true));
  const unit = units.get(container);
  container.replaceChildren(
    ...items.map((item, i) => {
      const copy = unit.cloneNode(true);
      fillUnit(copy, item, i);
      return copy;
    }),
  );
}

export const slotRepeat = (root, name) => root.querySelector(`[data-slot-repeat="${name}"]`);
export const slotChildren = (root, name) => root.querySelector(`[data-slot-children="${name}"]`);

export function formatDate(value, withTime = false) {
  if (!value) return "";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en", withTime ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "medium" }).format(date);
}

export function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function button(label, { variant, action } = {}) {
  const b = document.createElement("button");
  b.className = "pn-button";
  b.type = "button";
  if (variant) b.dataset.variant = variant;
  if (action) b.dataset.action = action;
  b.textContent = label;
  return b;
}
