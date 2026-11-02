// Template fidelity: strip slot contents from a filled template and compare it to its source.
// Runs in a browser (or any DOM). Exposes window.PanelFidelity.
// Rules are documented in panel/templates/README.md.

(function (global) {
  // Attributes owned by behavior at runtime. Dropped on both sides before comparing.
  const STATE_ATTRS = new Set([
    "disabled", "aria-invalid", "aria-disabled", "aria-busy", "aria-expanded", "aria-pressed",
    "aria-selected", "open", "checked", "selected", "hidden", "tabindex",
    "data-force", "data-static", "data-dragover", "data-invalid",
  ]);
  const VALUE_TAGS = new Set(["input", "textarea", "select"]);

  function isStateAttr(el, name) {
    return STATE_ATTRS.has(name) || (name === "value" && VALUE_TAGS.has(el.localName));
  }

  function slotAttrNames(el) {
    return new Set(
      (el.getAttribute("data-slot-attr") || "").split(/\s+/).filter(Boolean).map((pair) => pair.split(":")[0]),
    );
  }

  function slotAttrPairs(el) {
    return (el.getAttribute("data-slot-attr") || "")
      .split(/\s+/)
      .filter(Boolean)
      .map((pair) => {
        const [attr, key] = pair.split(":");
        return { attr, key: key || attr };
      });
  }

  // A normalized node: { tag, attrs: [[name, value]] sorted, children: [...], repeat?: [...] } or { text }.
  function normalize(node) {
    if (node.nodeType === 3) {
      const text = node.textContent.replace(/\s+/g, " ").trim();
      return text ? { text } : null;
    }
    if (node.nodeType !== 1) return null;
    const el = node;
    const blanks = slotAttrNames(el);
    const attrs = [];
    for (const a of el.attributes) {
      if (isStateAttr(el, a.name)) continue;
      attrs.push([a.name, blanks.has(a.name) ? "" : a.value]);
    }
    attrs.sort((x, y) => (x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : 0));
    const out = { tag: el.localName, attrs, children: [] };
    if (el.hasAttribute("data-slot") || el.hasAttribute("data-slot-children")) return out;
    const kids = [...(el.content ? el.content.childNodes : el.childNodes)].map(normalize).filter(Boolean);
    if (el.hasAttribute("data-slot-repeat")) out.repeat = kids;
    else out.children = kids;
    return out;
  }

  function label(n) {
    if (n.text !== undefined) return `"${n.text}"`;
    const cls = n.attrs.find((a) => a[0] === "class");
    return `<${n.tag}${cls ? "." + cls[1].trim().split(/\s+/).join(".") : ""}>`;
  }

  function fmtAttrs(attrs) {
    return attrs.map(([k, v]) => (v === "" ? k : `${k}="${v}"`)).join(" ");
  }

  // Returns null when out matches tpl, or a sentence naming the first difference.
  function compare(tpl, out, path = "") {
    if (!out) return `${path}: ${label(tpl)} is missing`;
    if (!tpl) return `${path}: unexpected ${label(out)}`;
    if (tpl.text !== undefined || out.text !== undefined) {
      if (tpl.text === out.text) return null;
      return `${path}: ${label(out)} should be ${label(tpl)}`;
    }
    const here = `${path} ${label(tpl)}`.trim();
    if (tpl.tag !== out.tag) return `${path}: ${label(out)} should be ${label(tpl)}`;
    const ta = fmtAttrs(tpl.attrs);
    const oa = fmtAttrs(out.attrs);
    if (ta !== oa) return `${here}: attributes [${oa}] should be [${ta}]`;
    if (tpl.repeat) {
      if (tpl.repeat.length !== 1) return `${here}: template repeat must hold exactly one unit (has ${tpl.repeat.length})`;
      for (let i = 0; i < out.repeat.length; i++) {
        const diff = compare(tpl.repeat[0], out.repeat[i], `${here} [repeat ${i + 1}]`);
        if (diff) return diff;
      }
      return null;
    }
    const n = Math.max(tpl.children.length, out.children.length);
    for (let i = 0; i < n; i++) {
      const diff = compare(tpl.children[i], out.children[i], here);
      if (diff) return diff;
    }
    return null;
  }

  function parseTemplate(html) {
    const t = document.createElement("template");
    t.innerHTML = html.trim();
    const roots = [...t.content.children];
    if (roots.length !== 1) throw new Error(`a template file must have exactly one root element (found ${roots.length})`);
    return roots[0];
  }

  // Checks every element carrying data-template inside root (including root itself).
  // sources: { name: htmlString }. Returns [{ name, ok, diff }].
  function checkDocument(root, sources) {
    const normalizedSources = {};
    const results = [];
    const instances = [...(root.matches?.("[data-template]") ? [root] : []), ...root.querySelectorAll("[data-template]")];
    for (const el of instances) {
      const name = el.getAttribute("data-template");
      if (!sources[name]) {
        results.push({ name, ok: false, diff: `unknown template "${name}"` });
        continue;
      }
      normalizedSources[name] ??= normalize(parseTemplate(sources[name]));
      const diff = compare(normalizedSources[name], normalize(el));
      results.push({ name, ok: !diff, diff });
    }
    return results;
  }

  // Sample filling, used by the checks. Real builds fill from the schema.
  let instanceCounter = 0;
  const SAMPLE_IMAGE =
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 3 2'%3E%3Crect width='3' height='2' fill='%2389a'/%3E%3C/svg%3E";

  function sampleAttr(key, ctx) {
    if (key === "describedby") return `${ctx.prefix}-help-id ${ctx.prefix}-error-id`;
    if (key.endsWith("-id") && !["type-id", "singleton-id"].includes(key)) return `${ctx.prefix}-${key}`;
    const fixed = {
      width: ctx.width ?? "1/2",
      required: "true",
      state: ctx.state ?? "ready",
      "save-state": ctx.saveState ?? "dirty",
      "upload-state": ctx.uploadState ?? "filled",
      href: "#",
      current: ctx.repeatIndex === 0 ? "page" : "false",
      tone: "positive",
      src: SAMPLE_IMAGE,
      alt: "Sample image",
      name: `${ctx.prefix}-name`,
      value: `value-${(ctx.repeatIndex ?? 0) + 1}`,
      "date-type": "date",
      min: "0",
      max: "100",
      icon: "#pn-icon-file",
      variant: "primary",
      "type-id": "post",
      "singleton-id": "settings",
      to: "post",
      from: "title",
    };
    if (key in fixed) return fixed[key];
    if (key.endsWith("-label") || key.endsWith("-placeholder")) return `Sample ${key.replace(/-/g, " ")}`;
    return `sample-${key}`;
  }

  function sampleText(name, ctx) {
    const fixed = { error: ctx.error ?? "", status: "Draft", message: "Unsaved changes", created: "2026-10-28", updated: "2026-11-01" };
    if (name in fixed) return fixed[name];
    return `Sample ${name.replace(/-/g, " ")}${ctx.repeatIndex !== undefined ? " " + (ctx.repeatIndex + 1) : ""}`;
  }

  function repeatIndexOf(el, root) {
    for (let node = el; node && node !== root.parentElement; node = node.parentElement) {
      const parent = node.parentElement;
      if (parent && parent.hasAttribute("data-slot-repeat")) return [...parent.children].indexOf(node);
    }
    return undefined;
  }

  // Fills a template element in place. ctx: { state, saveState, uploadState, width, error, repeat }.
  function fill(root, ctx = {}) {
    const prefix = `t${++instanceCounter}`;
    const all = (sel) => [...(root.matches(sel) ? [root] : []), ...root.querySelectorAll(sel)];
    for (const container of all("[data-slot-repeat]")) {
      const unit = container.firstElementChild;
      for (let i = 1; i < (ctx.repeat ?? 3); i++) container.appendChild(unit.cloneNode(true));
    }
    for (const el of all("[data-slot-attr]")) {
      const repeatIndex = repeatIndexOf(el, root);
      for (const { attr, key } of slotAttrPairs(el)) el.setAttribute(attr, sampleAttr(key, { ...ctx, prefix, repeatIndex }));
    }
    for (const el of all("[data-slot]")) {
      el.textContent = sampleText(el.getAttribute("data-slot"), { ...ctx, repeatIndex: repeatIndexOf(el, root) });
    }
    return root;
  }

  global.PanelFidelity = { normalize, compare, parseTemplate, checkDocument, fill, STATE_ATTRS: [...STATE_ATTRS] };
})(typeof window !== "undefined" ? window : globalThis);
