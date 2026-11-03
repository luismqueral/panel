// Filling templates. Optional vanilla snippet; rules in templates/README.md.
// Each template is inlined verbatim in the page as <template data-panel-template="name">.
//
// const field = tpl("field-text");
// fill(field, { text: { label: "Title" }, attrs: { name: "title", "input-id": "f-title" } });
// repeat(slotRepeat(nav, "entry"), entries, (unit, e) => fill(unit, { text: { text: e.text } }));

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

