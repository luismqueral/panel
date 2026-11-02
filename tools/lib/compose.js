// Builds pages from templates with sample data. Used by the template check and the preview.
// Exposes window.PanelCompose.build(sources, scenario, stage).

(function (global) {
  function build(sources, scenario, stage = document.getElementById("stage")) {
    const F = window.PanelFidelity;
    stage.innerHTML = "";

    function make(name, ctx = {}, children = {}) {
      const el = F.parseTemplate(sources[name]);
      F.fill(el, ctx);
      for (const [slot, kids] of Object.entries(children)) {
        const container = el.matches(`[data-slot-children="${slot}"]`) ? el : el.querySelector(`[data-slot-children="${slot}"]`);
        for (const kid of [].concat(kids)) container.appendChild(typeof kid === "function" ? kid(el) : kid);
      }
      if (name === "field-custom") {
        const label = el.querySelector(".pn-label");
        const input = document.createElement("input");
        input.className = "pn-input";
        input.type = "text";
        input.readOnly = true;
        input.value = "6 min";
        input.setAttribute("aria-labelledby", label.id);
        el.querySelector('[data-slot-children="control"]').appendChild(input);
      }
      return el;
    }
    const button = (text, variant) => {
      const b = document.createElement("button");
      b.className = "pn-button";
      b.type = "button";
      if (variant) b.dataset.variant = variant;
      b.textContent = text;
      return b;
    };
    const wrapMain = (el) => {
      const main = document.createElement("main");
      main.style.padding = "1.5rem";
      if (el.matches(".pn-field")) {
        const grid = document.createElement("div");
        grid.className = "pn-grid";
        grid.appendChild(el);
        main.appendChild(grid);
      } else main.appendChild(el);
      return main;
    };
    const fieldNames = Object.keys(sources).filter((n) => n.startsWith("field-"));
    const allFields = () => fieldNames.map((n, i) => make(n, { width: ["1/1", "1/2", "1/2", "1/3", "2/3", "1/3"][i % 6] }));
    const page = (screen, extra = {}) =>
      make("layout", {}, {
        nav: make("nav", {}, { account: make("account") }),
        header: make("header"),
        screen,
        savebar: extra.savebar ?? [],
      });

    const s = scenario;
    let rootEl;
    if (s.kind === "alone") {
      const el = make(s.name, { state: s.state ?? "ready", error: s.fieldState === "error" ? "Sample error message" : "" });
      if (s.fieldState === "error") el.querySelectorAll("input, textarea, select").forEach((c) => c.setAttribute("aria-invalid", "true"));
      if (s.fieldState === "disabled") el.querySelectorAll("input, textarea, select, button").forEach((c) => c.setAttribute("disabled", ""));
      if (s.name === "field-custom" && s.fieldState === "error") el.querySelector(".pn-field-controls input").setAttribute("aria-invalid", "true");
      rootEl = ["layout", "screen-login"].includes(s.name) ? el : wrapMain(el);
      if (el.localName === "dialog") el.setAttribute("open", ""), el.setAttribute("data-static", "");
      stage.appendChild(rootEl);
    } else if (s.kind === "item") {
      rootEl = page(make("screen-item", { state: s.state ?? "ready" }, { fields: allFields(), empty: make("empty"), error: make("error", {}, { actions: button("Try again") }) }), { savebar: make("savebar", { saveState: s.saveState ?? "dirty" }) });
      stage.appendChild(rootEl);
    } else if (s.kind === "collection") {
      rootEl = page(make("screen-collection", { state: s.state }, { empty: make("empty", {}, { actions: button("New post", "primary") }), error: make("error", {}, { actions: button("Try again") }) }));
      stage.appendChild(rootEl);
    } else if (s.kind === "home") {
      rootEl = page(make("screen-home", { state: "ready" }, { empty: make("empty"), error: make("error") }));
      stage.appendChild(rootEl);
    } else if (s.kind === "singleton") {
      rootEl = page(make("screen-singleton", { state: "ready" }, { fields: ["field-text", "field-textarea", "field-toggle"].map((n) => make(n, { width: "1/1" })), error: make("error") }), { savebar: make("savebar", { saveState: "clean" }) });
      stage.appendChild(rootEl);
    } else if (s.kind === "system-error") {
      rootEl = page(make("error", {}, { actions: button("Go home") }));
      stage.appendChild(rootEl);
    } else if (s.kind === "login") {
      rootEl = make("screen-login", {}, { methods: button("Continue with Google", "primary") });
      stage.appendChild(rootEl);
    } else if (s.kind === "modal") {
      rootEl = page(make("screen-item", { state: "ready" }, { fields: [make("field-text"), make("field-markdown")], empty: make("empty"), error: make("error") }));
      stage.appendChild(rootEl);
      const body = s.name === "screen-slide-over" ? { body: make("field-textarea", { width: "1/1" }) } : s.name === "screen-create" ? { fields: [make("field-text", { width: "1/1" }), make("field-slug", { width: "1/1" })] } : {};
      const dialog = make(s.name, {}, body);
      rootEl.querySelector('[data-slot-children="dialogs"]').appendChild(dialog);
      dialog.showModal();
    }
    return F.checkDocument(stage, sources);
  }

  global.PanelCompose = { build };
})(window);
