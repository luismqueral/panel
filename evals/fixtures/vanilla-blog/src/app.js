// Reference vanilla build of the blog panel. Templates are inlined verbatim; behavior comes from panel/snippets.

import { PANEL } from "./blog.js";
import { tpl, fill, repeat, slotRepeat, slotChildren, formatDate, button } from "./dom.js";
import { makeField } from "./fields.js";
import { createSaveState } from "./snippets/save-state.js";
import { createValidation } from "./snippets/validation.js";
import { openDialog, confirmDialog } from "./snippets/dialogs.js";
import { installShortcuts } from "./snippets/keyboard.js";
import { createFlow } from "./snippets/create-flow.js";
import { showToast } from "./snippets/toast.js";

const words = (text) => (text ?? "").trim().split(/\s+/).filter(Boolean).length;
const COMPUTED = {
  readingTime: {
    value: (values) => Math.max(1, Math.ceil(words(values.body) / 200)),
    display: (values) => `${Math.max(1, Math.ceil(words(values.body) / 200))} min`,
  },
};
const capital = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export async function start({ data, files, auth, test }) {
  const app = document.getElementById("app");
  let layout = null;
  let confirm = null;
  let current = { cleanup: () => {}, dirty: () => false };
  let lastHash = location.hash;
  let user = null;

  if (test) window.panelTest = { ...test, reset: (seed) => (test.reset(seed), current.cleanup(), (current = { cleanup() {}, dirty: () => false }), route()) };

  const typeById = (id) => PANEL.types.find((t) => t.id === id);
  const singletonById = (id) => PANEL.singletons.find((s) => s.id === id);
  const toast = (text, tone) => showToast(slotChildren(layout, "toasts"), text, { tone });

  function buildLayout() {
    layout = tpl("layout");
    const nav = tpl("nav");
    fill(nav, { text: { brand: PANEL.name } });
    const account = tpl("account");
    fill(account, { text: { user: user.user } });
    account.querySelector('[data-action="logout"]').addEventListener("click", async () => {
      if (current.dirty() && !(await discard())) return;
      current.cleanup();
      await auth.logout();
      boot();
    });
    slotChildren(nav, "account").append(account);
    slotChildren(layout, "nav").append(nav);
    slotChildren(layout, "header").append(tpl("header"));
    confirm = tpl("screen-dialog");
    slotChildren(layout, "dialogs").append(confirm);
    app.replaceChildren(layout);
  }

  function setChrome(key, crumbs) {
    const entries = [
      { text: "Home", href: "#/", key: "home" },
      ...PANEL.types.map((t) => ({ text: t.label, href: `#/${t.id}`, key: t.id })),
      ...PANEL.singletons.map((s) => ({ text: s.label, href: `#/${s.id}`, key: s.id })),
    ];
    repeat(slotRepeat(layout, "entry"), entries, (unit, e) =>
      fill(unit, { text: { text: e.text }, attrs: { href: e.href, current: e.key === key ? "page" : "false" } }),
    );
    repeat(slotRepeat(layout, "crumb"), crumbs, (unit, c, i) =>
      fill(unit, { text: { text: c.text }, attrs: { href: c.href, current: i === crumbs.length - 1 ? "page" : "false" } }),
    );
    document.title = `${crumbs[crumbs.length - 1].text} · ${PANEL.name}`;
  }

  function screen(name, attrs) {
    const el = tpl(name);
    fill(el, { attrs: { state: "loading", ...attrs }, text: { "loading-text": "Loading…" } });
    slotChildren(layout, "screen").replaceChildren(el);
    slotChildren(layout, "savebar").replaceChildren();
    return el;
  }

  function showError(el, title, text, retry) {
    const error = tpl("error");
    fill(error, { text: { title, text } });
    if (retry) {
      const again = button("Try again", { action: "retry" });
      again.addEventListener("click", retry);
      slotChildren(error, "actions").append(again);
    }
    slotChildren(el, "error").replaceChildren(error);
    el.dataset.state = "error";
  }

  const discard = () =>
    confirmDialog(confirm, { title: "Discard unsaved changes?", text: "Your edits will be lost.", confirmLabel: "Discard", variant: "negative" });

  // Field set shared by item, singleton, and create screens.
  function fieldSet(fields, root, prefix, options) {
    const controllers = new Map();
    const values = () => Object.fromEntries([...controllers].filter(([, c]) => c.field.type !== "custom").map(([n, c]) => [n, c.get()]));
    const ctx = { prefix, files, options, computed: COMPUTED, values, root };
    const grid = slotChildren(root, "fields");
    for (const field of fields) {
      const c = makeField(field, ctx);
      controllers.set(field.name, c);
      grid.append(c.el);
    }
    return {
      controllers,
      read: () => Object.fromEntries([...controllers].map(([n, c]) => [n, c.get()])),
      write(v) {
        for (const [n, c] of controllers) c.set(v[n] ?? null);
        root.dispatchEvent(new Event("input"));
      },
      validation: createValidation({ root, fields, get: (n) => controllers.get(n).get() }),
    };
  }

  async function relationOptions(fields) {
    const options = {};
    for (const f of fields.filter((x) => x.type === "relation")) {
      const target = typeById(f.to);
      options[f.to] = (await data.list(f.to)).map((it) => ({ value: it.id, text: it.values[target.list.title] || "Untitled" }));
    }
    return options;
  }

  async function home() {
    setChrome("home", [{ text: "Home", href: "#/" }]);
    const el = screen("screen-home", {});
    fill(el, { text: { title: PANEL.name, "content-heading": "Content", "recent-heading": "Recently edited" } });
    try {
      const lists = await Promise.all(PANEL.types.map((t) => data.list(t.id)));
      const entries = [
        ...PANEL.types.map((t, i) => ({ title: t.label, subtitle: `${lists[i].length} ${lists[i].length === 1 ? t.singular : t.label.toLowerCase()}`, meta: "", href: `#/${t.id}` })),
        ...PANEL.singletons.map((s) => ({ title: s.label, subtitle: "Page", meta: "", href: `#/${s.id}` })),
      ];
      const recent = PANEL.types
        .flatMap((t, i) => lists[i].map((it) => ({ t, it })))
        .sort((a, b) => b.it.updatedAt.localeCompare(a.it.updatedAt))
        .slice(0, 5)
        .map(({ t, it }) => ({ title: it.values[t.list.title] || "Untitled", subtitle: t.label, meta: formatDate(it.updatedAt), href: `#/${t.id}/${it.id}` }));
      const row = (unit, r) => fill(unit, { text: { title: r.title, subtitle: r.subtitle, meta: r.meta }, attrs: { href: r.href } });
      repeat(slotRepeat(el, "entry"), entries, row);
      repeat(slotRepeat(el, "recent"), recent, row);
      el.dataset.state = "ready";
    } catch {
      showError(el, "Could not load the panel", "Check your connection and try again.", route);
    }
  }

  async function collection(type) {
    setChrome(type.id, [{ text: "Home", href: "#/" }, { text: type.label, href: `#/${type.id}` }]);
    const el = screen("screen-collection", { "type-id": type.id, "search-placeholder": `Search ${type.label.toLowerCase()}` });
    fill(el, { text: { title: type.label, "create-label": `New ${type.singular}`, "search-label": `Search ${type.label.toLowerCase()}`, "sort-label": "Sort by" } });
    const sortField = type.list.sort.replace(/^-/, "");
    const sorts = [
      { value: `-${sortField}`, text: sortField === "date" ? "Newest first" : `${capital(sortField)}, descending` },
      { value: sortField, text: sortField === "date" ? "Oldest first" : `${capital(sortField)}, ascending` },
      { value: type.list.title, text: "Title A–Z" },
    ];
    const sortSelect = el.querySelector("#pn-sort");
    repeat(sortSelect, sorts, (unit, s) => fill(unit, { text: { text: s.text }, attrs: { value: s.value } }));
    sortSelect.value = type.list.sort;
    const search = el.querySelector("#pn-search");
    const off = installShortcuts({ search: () => search });
    current = { cleanup: off, dirty: () => false };

    const flow = await createDialog(type);
    const openCreate = (event) => flow.open(event.currentTarget);
    el.querySelector('[data-action="create"]').addEventListener("click", openCreate);

    let items = [];
    function render() {
      const q = search.value.trim().toLowerCase();
      const key = sortSelect.value.replace(/^-/, "");
      const dir = sortSelect.value.startsWith("-") ? -1 : 1;
      const rows = items
        .filter((it) => !q || type.list.search.some((f) => String(it.values[f] ?? "").toLowerCase().includes(q)))
        .sort((a, b) => dir * String(a.values[key] ?? "").localeCompare(String(b.values[key] ?? "")));
      repeat(slotRepeat(el, "row"), rows, (unit, it) =>
        fill(unit, {
          text: { title: it.values[type.list.title] || "Untitled", subtitle: formatDate(it.values[type.list.subtitle]), status: capital(it.status ?? "") },
          attrs: { href: `#/${type.id}/${it.id}`, tone: it.status === type.status.at(-1) ? "positive" : "" },
        }),
      );
    }
    search.addEventListener("input", render);
    sortSelect.addEventListener("change", render);
    try {
      items = await data.list(type.id);
      if (!items.length) {
        const empty = tpl("empty");
        fill(empty, { text: { title: `No ${type.label.toLowerCase()} yet`, text: `Create the first ${type.singular}.` }, attrs: { icon: "#pn-icon-file" } });
        const b = button(`New ${type.singular}`, { variant: "primary", action: "create" });
        b.addEventListener("click", openCreate);
        slotChildren(empty, "actions").append(b);
        slotChildren(el, "empty").replaceChildren(empty);
        el.dataset.state = "empty";
      } else {
        render();
        el.dataset.state = "ready";
      }
    } catch {
      showError(el, `Could not load ${type.label.toLowerCase()}`, "Check your connection and try again.", route);
    }
  }

  async function createDialog(type) {
    const titleField = type.fields.find((f) => f.name === type.list.title);
    const slugField = type.fields.find((f) => f.type === "slug" && f.from === titleField.name);
    const dialog = tpl("screen-create");
    fill(dialog, { text: { title: `New ${type.singular}` } });
    const asked = [titleField, slugField].filter(Boolean).map((f) => ({ ...f, width: "1/1" }));
    const set = fieldSet(asked, dialog, "create", {});
    slotChildren(layout, "dialogs").querySelector('[data-template="screen-create"]')?.remove();
    slotChildren(layout, "dialogs").append(dialog);
    return createFlow({
      dialog,
      title: titleField.name,
      slug: slugField?.name ?? null,
      validation: set.validation,
      read: set.read,
      async create(values) {
        const defaults = Object.fromEntries(type.fields.filter((f) => "default" in f).map((f) => [f.name, f.default]));
        return data.create(type.id, { status: type.status?.[0], values: { ...defaults, ...values } });
      },
      onCreated: (item) => (location.hash = `#/${type.id}/${item.id}`),
      onError: () => toast("Could not create. Try again.", "negative"),
    });
  }

  function savebar() {
    const bar = tpl("savebar");
    fill(bar, { attrs: { "save-state": "clean" }, text: { message: "" } });
    slotChildren(layout, "savebar").replaceChildren(bar);
    return bar;
  }

  async function item(type, id) {
    const crumbs = [{ text: "Home", href: "#/" }, { text: type.label, href: `#/${type.id}` }];
    setChrome(type.id, [...crumbs, { text: "Loading…", href: location.hash }]);
    const el = screen("screen-item", { "type-id": type.id, tone: "" });
    fill(el, { text: { title: "", status: "", created: "", updated: "" } });
    const statusButton = el.querySelector('[data-action="status"]');
    if (!type.status) statusButton.hidden = true;
    let record;
    let options;
    try {
      [record, options] = await Promise.all([data.get(type.id, id), relationOptions(type.fields)]);
    } catch (error) {
      setChrome(type.id, [...crumbs, { text: "Not found", href: location.hash }]);
      if (error.code === "not-found") showError(el, `This ${type.singular} doesn't exist`, "It may have been deleted.", null);
      else showError(el, `Could not load this ${type.singular}`, "Check your connection and try again.", route);
      return;
    }
    const form = el.querySelector("form");
    const set = fieldSet(type.fields, form, "f", options);
    set.write(record.values);
    const { validation } = set;
    const first = type.status?.[0];
    const isLater = (status) => type.status && type.status.indexOf(status) > 0;

    function header() {
      const title = record.values[type.list.title] || "Untitled";
      fill(el, {
        text: { title, status: capital(record.status ?? ""), created: formatDate(record.createdAt), updated: formatDate(record.updatedAt) },
        attrs: { tone: record.status === type.status?.at(-1) ? "positive" : "" },
      });
      setChrome(type.id, [...crumbs, { text: title, href: `#/${type.id}/${record.id}` }]);
    }
    header();

    if (type.wordCount) {
      const help = form.querySelector(`[data-field="${type.wordCount}"] .pn-help`);
      const count = () => {
        const n = words(set.controllers.get(type.wordCount).get());
        help.textContent = `${n} ${n === 1 ? "word" : "words"}`;
      };
      form.addEventListener("input", count);
      count();
    }

    const bar = savebar();
    const saveState = createSaveState({
      form,
      savebar: bar,
      read: set.read,
      write: set.write,
      validate(values, { background, extra }) {
        if (background) return validation.valid();
        const publishing = isLater(extra?.status ?? record.status);
        const invalid = validation.run(publishing ? "publish" : "format", publishing ? type.publishRequires : []);
        if (!invalid.length) return true;
        saveState.say(publishing ? `Fix ${invalid.length} ${invalid.length === 1 ? "field" : "fields"} to publish` : `Fix ${invalid.length === 1 ? "1 field" : `${invalid.length} fields`} to save`);
        validation.focus(invalid[0]);
        return false;
      },
      async save(values, extra) {
        record = await data.update(type.id, record.id, { status: extra?.status ?? record.status, values });
        header();
      },
      autosave: type.autosave && { every: type.autosave.every, when: () => !type.autosave.drafts || record.status === first },
      onRevert: () => validation.clear(),
    });
    const off = installShortcuts({ save: () => saveState.save() });

    statusButton.addEventListener("click", async (event) => {
      const statuses = type.status;
      const next = statuses.length === 2 ? statuses[1 - statuses.indexOf(record.status)] : await pickStatus(type, record.status, event.currentTarget);
      if (!next || next === record.status) return;
      const forward = statuses.indexOf(next) > statuses.indexOf(record.status);
      if (forward && isLater(next)) {
        const invalid = validation.run("publish", type.publishRequires);
        if (invalid.length) {
          saveState.say(`Fix ${invalid.length} ${invalid.length === 1 ? "field" : "fields"} to publish`);
          validation.focus(invalid[0]);
          return;
        }
        if (type.confirmPublish && record.status === first) {
          const ok = await confirmDialog(confirm, { title: `Publish this ${type.singular}?`, text: "It will be visible on the site.", confirmLabel: capital(next), opener: event.currentTarget });
          if (!ok) return;
        }
      }
      if (await saveState.save({ status: next })) toast(`${capital(type.singular)} ${next === first ? "moved to " + next : next}`, "positive");
    });

    el.querySelector('[data-action="delete"]').addEventListener("click", async (event) => {
      const ok = await confirmDialog(confirm, { title: `Delete this ${type.singular}?`, text: "This can't be undone.", confirmLabel: "Delete", variant: "negative", opener: event.currentTarget });
      if (!ok) return;
      try {
        await data.remove(type.id, record.id);
        cleanup();
        location.hash = `#/${type.id}`;
        toast(`${capital(type.singular)} deleted`);
      } catch {
        toast("Could not delete. Try again.", "negative");
      }
    });

    function cleanup() {
      saveState.destroy();
      validation.destroy();
      off();
      current = { cleanup() {}, dirty: () => false };
    }
    current = { cleanup, dirty: () => saveState.dirty };
    el.dataset.state = "ready";
  }

  async function pickStatus(type, status, opener) {
    const drawer = tpl("screen-slide-over");
    fill(drawer, { text: { title: "Status" } });
    const group = document.createElement("fieldset");
    group.className = "pn-choices";
    const legend = document.createElement("legend");
    legend.className = "pn-visually-hidden";
    legend.textContent = "Status";
    group.append(legend);
    for (const s of type.status) {
      const label = document.createElement("label");
      label.className = "pn-choice";
      label.innerHTML = `<input class="pn-radio" type="radio" name="pn-status"> <span></span>`;
      label.querySelector("input").value = s;
      label.querySelector("input").checked = s === status;
      label.querySelector("span").textContent = capital(s);
      group.append(label);
    }
    slotChildren(drawer, "body").append(group);
    slotChildren(layout, "dialogs").append(drawer);
    const result = await openDialog(drawer, { opener });
    const picked = drawer.querySelector("input:checked")?.value;
    drawer.remove();
    return result === "done" ? picked : null;
  }

  async function singleton(def) {
    setChrome(def.id, [{ text: "Home", href: "#/" }, { text: def.label, href: `#/${def.id}` }]);
    const el = screen("screen-singleton", { "singleton-id": def.id });
    fill(el, { text: { title: def.label } });
    let record;
    try {
      record = await data.getSingleton(def.id);
    } catch {
      showError(el, `Could not load ${def.label.toLowerCase()}`, "Check your connection and try again.", route);
      return;
    }
    const form = el.querySelector("form");
    const set = fieldSet(def.fields, form, "f", await relationOptions(def.fields).catch(() => ({})));
    set.write(record?.values ?? Object.fromEntries(def.fields.filter((f) => "default" in f).map((f) => [f.name, f.default])));
    const bar = savebar();
    const saveState = createSaveState({
      form,
      savebar: bar,
      read: set.read,
      write: set.write,
      validate() {
        const invalid = set.validation.run("publish");
        if (!invalid.length) return true;
        saveState.say(`Fix ${invalid.length === 1 ? "1 field" : `${invalid.length} fields`} to save`);
        set.validation.focus(invalid[0]);
        return false;
      },
      save: async (values) => (record = await data.saveSingleton(def.id, values)),
      onRevert: () => set.validation.clear(),
    });
    const off = installShortcuts({ save: () => saveState.save() });
    current = {
      cleanup() {
        saveState.destroy();
        set.validation.destroy();
        off();
      },
      dirty: () => saveState.dirty,
    };
    el.dataset.state = "ready";
  }

  function notFound() {
    setChrome("", [{ text: "Home", href: "#/" }, { text: "Not found", href: location.hash }]);
    const el = screen("screen-home", {});
    fill(el, { text: { title: "Not found" } });
    showError(el, "This page doesn't exist", "Check the address, or go back home.", () => (location.hash = "#/"));
  }

  function route() {
    const [a, b] = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
    lastHash = location.hash;
    if (!a) return home();
    const type = typeById(a);
    if (type && b) return item(type, decodeURIComponent(b));
    if (type) return collection(type);
    const single = singletonById(a);
    if (single && !b) return singleton(single);
    return notFound();
  }

  window.addEventListener("hashchange", async () => {
    if (location.hash === lastHash) return;
    if (current.dirty()) {
      const target = location.hash;
      history.replaceState(null, "", lastHash || "#/");
      if (!(await discard())) return;
      current.cleanup();
      history.pushState(null, "", target);
    } else current.cleanup();
    route();
  });

  async function boot() {
    user = await auth.session();
    if (!user) {
      const login = tpl("screen-login");
      fill(login, { text: { title: PANEL.name, text: "Sign in to edit the site.", error: "" } });
      app.replaceChildren(login);
      auth.renderMethods(slotChildren(login, "methods"), {
        onSignedIn: boot,
        onError: (message) => (login.querySelector(".pn-error").textContent = message),
      });
      return;
    }
    buildLayout();
    route();
  }

  await boot();
}
