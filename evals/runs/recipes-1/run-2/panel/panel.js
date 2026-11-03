import { PANEL } from "./panel.config.js";
import { tpl, fill, repeat, slotRepeat, slotChildren } from "./snippets/templates.js";
import { makeField } from "./snippets/fields.js";
import { createSaveState } from "./snippets/save-state.js";
import { createValidation, fixMessage } from "./snippets/validation.js";
import { openDialog, confirmDialog } from "./snippets/dialogs.js";
import { installShortcuts } from "./snippets/keyboard.js";
import { createFlow } from "./snippets/create-flow.js";
import { showToast } from "./snippets/toast.js";
import { createMemoryAdapters } from "./adapters/memory.js";
import { createRequest, createHttpAdapters } from "./adapters/http.js";
import { createPasswordAuth } from "./adapters/auth.js";

// ---------- adapters ----------

function createRecipeAdapters() {
  const request = createRequest();
  const { data, files } = createHttpAdapters(request);
  return { data, files, auth: createPasswordAuth(request) };
}

const IDLE = { cleanup() {}, dirty: () => false };
let current = IDLE;

const params = new URLSearchParams(location.search);
const adapters = params.has("test")
  ? createMemoryAdapters(await (await fetch("./seed.json")).json())
  : createRecipeAdapters();
if (adapters.test)
  window.panelTest = {
    ...adapters.test,
    reset(seed) {
      adapters.test.reset(seed);
      current.cleanup(); // drop the open screen without asking (S9 does not apply)
      route();           // render the current route again from the new data
    },
  };

// ---------- helpers ----------

const app = document.getElementById("app");
const typeById = new Map(PANEL.types.map((t) => [t.id, t]));
const singletonById = new Map(PANEL.singletons.map((s) => [s.id, s]));
const fieldOf = (def, name) => def.fields.find((f) => f.name === name);
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : "");
const isAuthError = (error) => error?.code === "unauthorized" || error?.code === "forbidden";
const SIGNED_OUT = "You were signed out. Copy your edits, then reload to sign in.";

function formatDate(value) {
  if (!value) return "";
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  return new Date(dateOnly ? `${value}T00:00:00Z` : value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", ...(dateOnly ? { timeZone: "UTC" } : {}) });
}

// build.md step 4: neutral for the first status, positive for the last, notice between.
function toneOf(type, status) {
  if (!type.status) return "";
  if (status === type.status[0]) return "neutral";
  return status === type.status.at(-1) ? "positive" : "notice";
}

const countText = (type, n) => `${n} ${n === 1 ? type.singular : type.label.toLowerCase()}`;
const titleOf = (type, item) => item?.values?.[type.list.title] || "Untitled";

function emptyValue(field) {
  if (field.default !== undefined) return field.default;
  if (field.type === "toggle") return false;
  if (field.type === "tags") return [];
  if (["number", "image", "file", "relation"].includes(field.type)) return null;
  return "";
}
const defaults = (def) => Object.fromEntries(def.fields.map((f) => [f.name, emptyValue(f)]));

// Text for a value in rows and search. lookups: { <type id>: Map(id → title) } for relations.
function display(field, value, lookups) {
  if (value === null || value === undefined || value === "") return "";
  if (field.type === "date") return formatDate(value);
  if (field.type === "relation") return lookups[field.to]?.get(value) ?? "";
  if (field.type === "tags") return value.join(", ");
  if (field.type === "image" || field.type === "file") return value.name ?? "";
  if (field.type === "toggle") return "";
  return String(value);
}

async function relationLookups(def) {
  const targets = [...new Set(def.fields.filter((f) => f.type === "relation").map((f) => f.to))];
  const lists = await Promise.all(targets.map((id) => adapters.data.list(id)));
  const lookups = {};
  const options = {};
  targets.forEach((id, i) => {
    const target = typeById.get(id);
    const sorted = [...lists[i]].sort((a, b) => titleOf(target, a).localeCompare(titleOf(target, b)));
    lookups[id] = new Map(sorted.map((it) => [it.id, titleOf(target, it)]));
    options[id] = sorted.map((it) => ({ value: it.id, text: titleOf(target, it) }));
  });
  return { lookups, options };
}

function button(label, action, variant) {
  const b = document.createElement("button");
  b.className = "pn-button";
  if (variant) b.dataset.variant = variant;
  b.type = "button";
  b.dataset.action = action;
  b.textContent = label;
  return b;
}

// ---------- shell ----------

let layout = null;
let offKeys = null;
let confirmEl = null;

function mountLayout(user) {
  layout = tpl("layout");
  const nav = tpl("nav");
  fill(nav, { text: { brand: PANEL.name } });
  const account = tpl("account");
  fill(account, { text: { user } });
  account.querySelector('[data-action="logout"]').addEventListener("click", logout);
  slotChildren(nav, "account").append(account);
  slotChildren(layout, "nav").append(nav);
  slotChildren(layout, "header").append(tpl("header"));
  confirmEl = tpl("screen-dialog");
  slotChildren(layout, "dialogs").append(confirmEl);
  app.replaceChildren(layout);
  offKeys?.();
  offKeys = installShortcuts({ save: () => current.save?.(), search: () => current.search?.() });
}

function setNav(key) {
  const entries = [
    { text: "Home", href: "#/", key: "home" },
    ...PANEL.types.map((t) => ({ text: t.label, href: `#/${t.id}`, key: t.id })),
    ...PANEL.singletons.map((s) => ({ text: s.label, href: `#/${s.id}`, key: s.id })),
  ];
  repeat(slotRepeat(layout, "entry"), entries, (unit, e) => fill(unit, { text: { text: e.text }, attrs: { href: e.href, current: e.key === key ? "page" : "false" } }));
}

function setCrumbs(crumbs) {
  const header = slotChildren(layout, "header").firstElementChild;
  repeat(slotRepeat(header, "crumb"), crumbs, (unit, c, i) => fill(unit, { text: { text: c.text }, attrs: { href: c.href, current: i === crumbs.length - 1 ? "page" : "false" } }));
  document.title = `${crumbs.at(-1).text} · ${PANEL.name}`;
}

const mountScreen = (el) => slotChildren(layout, "screen").replaceChildren(el);
const mountSavebar = (el) => slotChildren(layout, "savebar").replaceChildren(...(el ? [el] : []));
const toast = (text, tone) => showToast(slotChildren(layout, "toasts"), text, tone ? { tone } : {});

const discard = () => confirmDialog(confirmEl, { title: "Discard unsaved changes?", text: "Your edits will be lost.", confirmLabel: "Discard", variant: "negative" });

function retry() {
  current.cleanup();
  route();
}

function showError(screen, title, text, withRetry = true) {
  const error = tpl("error");
  fill(error, { text: { title, text } });
  if (withRetry) {
    const again = button("Try again", "retry");
    again.addEventListener("click", retry);
    slotChildren(error, "actions").append(again);
  }
  slotChildren(screen, "error").replaceChildren(error);
  screen.dataset.state = "error";
}

// A load that throws unauthorized or forbidden shows screen-login (build.md step 5).
function loadFailed(error, screen, title) {
  if (isAuthError(error)) return showLogin({ message: error.code === "forbidden" ? "This account isn't allowed. Sign in with another one." : "" });
  showError(screen, title, "Check your connection and try again.");
}

// ---------- routing ----------

let lastHash = location.hash; // route() sets it each time it renders
window.addEventListener("hashchange", async () => {
  if (!layout) return;
  if (location.hash === lastHash) return;
  if (location.hash && !location.hash.startsWith("#/")) {
    const target = document.getElementById(location.hash.slice(1));
    history.replaceState(null, "", lastHash || "#/");
    target?.focus();
    return;
  }
  if (current.dirty()) {
    const target = location.hash;
    history.pushState(null, "", lastHash || "#/");
    if (!(await discard())) return;
    history.replaceState(null, "", target);
  }
  current.cleanup();
  route();
});

function route() {
  if (!layout) return;
  lastHash = location.hash;
  const parts = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean).map(decodeURIComponent);
  if (parts.length === 0) current = homeScreen();
  else if (parts.length === 1 && typeById.has(parts[0])) current = collectionScreen(typeById.get(parts[0]));
  else if (parts.length === 2 && typeById.has(parts[0])) current = itemScreen(typeById.get(parts[0]), parts[1]);
  else if (parts.length === 1 && singletonById.has(parts[0])) current = singletonScreen(singletonById.get(parts[0]));
  else current = notFoundScreen();
}

// ---------- home ----------

function homeScreen() {
  const s = tpl("screen-home");
  fill(s, { text: { title: PANEL.name, "loading-text": "Loading…", "content-heading": "Content", "recent-heading": "Recently edited" }, attrs: { state: "loading" } });
  mountScreen(s);
  mountSavebar(null);
  setNav("home");
  setCrumbs([{ text: "Home", href: "#/" }]);
  let alive = true;
  (async () => {
    try {
      const lists = await Promise.all(PANEL.types.map((t) => adapters.data.list(t.id)));
      if (!alive) return;
      const entries = [
        ...PANEL.types.map((t, i) => ({ title: t.label, subtitle: countText(t, lists[i].length), href: `#/${t.id}` })),
        ...PANEL.singletons.map((x) => ({ title: x.label, subtitle: "Page", href: `#/${x.id}` })),
      ];
      repeat(slotRepeat(s, "entry"), entries, (unit, e) => fill(unit, { text: { title: e.title, subtitle: e.subtitle, meta: "" }, attrs: { href: e.href } }));
      const recent = PANEL.types
        .flatMap((t, i) => lists[i].map((item) => ({ t, item })))
        .sort((a, b) => String(b.item.updatedAt).localeCompare(String(a.item.updatedAt)))
        .slice(0, 5);
      repeat(slotRepeat(s, "recent"), recent, (unit, { t, item }) =>
        fill(unit, { text: { title: titleOf(t, item), subtitle: t.label, meta: formatDate(item.updatedAt) }, attrs: { href: `#/${t.id}/${encodeURIComponent(item.id)}` } }),
      );
      s.dataset.state = "ready";
    } catch (error) {
      if (alive) loadFailed(error, s, "Could not load the panel");
    }
  })();
  return { cleanup: () => (alive = false), dirty: () => false };
}

function notFoundScreen() {
  const s = tpl("screen-home");
  fill(s, { text: { title: "Not found", "loading-text": "Loading…", "content-heading": "Content", "recent-heading": "Recently edited" }, attrs: { state: "loading" } });
  repeat(slotRepeat(s, "entry"), [], () => {});
  repeat(slotRepeat(s, "recent"), [], () => {});
  mountScreen(s);
  mountSavebar(null);
  setNav(null);
  setCrumbs([{ text: "Home", href: "#/" }, { text: "Not found", href: location.hash }]);
  const error = tpl("error");
  fill(error, { text: { title: "This page doesn't exist", text: "Check the address, or go back home." } });
  const again = button("Try again", "retry");
  again.addEventListener("click", () => (location.hash = "#/"));
  slotChildren(error, "actions").append(again);
  slotChildren(s, "error").append(error);
  s.dataset.state = "error";
  return IDLE;
}

// ---------- collection ----------

function sortOptions(type) {
  const options = [];
  if (type.list.sort) {
    const name = type.list.sort.replace(/^-/, "");
    const field = fieldOf(type, name);
    const isDate = field.type === "date";
    options.push({ value: `-${name}`, text: isDate ? "Newest first" : `${field.label}, descending` });
    options.push({ value: name, text: isDate ? "Oldest first" : `${field.label}, ascending` });
  }
  if (!options.some((o) => o.value === type.list.title)) options.push({ value: type.list.title, text: "Title A–Z" });
  return options;
}

function sortRows(rows, key, type, lookups) {
  const desc = key.startsWith("-");
  const name = key.replace(/^-/, "");
  const field = fieldOf(type, name);
  const valueOf = (item) => {
    const v = item.values?.[name];
    if (v === null || v === undefined || v === "") return null;
    if (field.type === "relation") return display(field, v, lookups) || null;
    if (typeof v === "boolean") return Number(v);
    return v;
  };
  return [...rows].sort((a, b) => {
    const x = valueOf(a);
    const y = valueOf(b);
    if (x === null || y === null) return x === y ? 0 : x === null ? 1 : -1; // blanks last, both directions
    const c = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y));
    return desc ? -c : c;
  });
}

function collectionScreen(type) {
  const lower = type.label.toLowerCase();
  const s = tpl("screen-collection");
  fill(s, {
    text: { title: type.label, "create-label": `New ${type.singular}`, "loading-text": "Loading…", "search-label": `Search ${lower}`, "sort-label": "Sort by" },
    attrs: { state: "loading", "type-id": type.id, "search-placeholder": `Search ${lower}` },
  });
  const search = s.querySelector("#pn-search");
  const sort = s.querySelector("#pn-sort");
  const options = sortOptions(type);
  repeat(sort, options, (unit, o) => fill(unit, { text: { text: o.text }, attrs: { value: o.value } }));
  sort.value = type.list.sort ?? type.list.title;
  mountScreen(s);
  mountSavebar(null);
  setNav(type.id);
  setCrumbs([{ text: "Home", href: "#/" }, { text: type.label, href: `#/${type.id}` }]);

  // Create flow (C1–C6): the list.title field, plus any slug made from it.
  const dialog = tpl("screen-create");
  fill(dialog, { text: { title: `New ${type.singular}` } });
  const titleField = fieldOf(type, type.list.title);
  const slugField = type.fields.find((f) => f.type === "slug" && f.from === titleField.name);
  const createFields = [titleField, slugField].filter(Boolean);
  const controls = createFields.map((f) => makeField(f, { prefix: `${type.id}-new`, files: adapters.files }));
  for (const c of controls) slotChildren(dialog, "fields").append(c.el);
  slotChildren(layout, "dialogs").append(dialog);
  const createValidationState = createValidation({ root: dialog, fields: createFields, get: (name) => controls.find((c) => c.field.name === name).get() });
  const flow = createFlow({
    dialog,
    title: titleField.name,
    slug: slugField?.name ?? null,
    validation: createValidationState,
    read: () => Object.fromEntries(controls.map((c) => [c.field.name, c.get()])),
    create: (values) => adapters.data.create(type.id, { status: type.status?.[0], values: { ...defaults(type), ...values } }),
    onCreated: (item) => (location.hash = `#/${type.id}/${encodeURIComponent(item.id)}`),
    onError: () => toast("Could not create. Try again.", "negative"),
  });
  const openCreate = (event) => flow.open(event.currentTarget);
  s.querySelector('.pn-screen-actions [data-action="create"]').addEventListener("click", openCreate);

  let alive = true;
  let items = [];
  let lookups = {};

  function render() {
    const q = search.value.trim().toLowerCase();
    const shown = sortRows(items, sort.value, type, lookups).filter(
      (item) => !q || (type.list.search ?? [type.list.title]).some((name) => display(fieldOf(type, name), item.values?.[name], lookups).toLowerCase().includes(q)),
    );
    const subtitleField = type.list.subtitle && fieldOf(type, type.list.subtitle);
    repeat(slotRepeat(s, "row"), shown, (unit, item) => {
      fill(unit, {
        text: { title: titleOf(type, item), subtitle: subtitleField ? display(subtitleField, item.values?.[subtitleField.name], lookups) : "", status: type.status ? cap(item.status) : "" },
        attrs: { href: `#/${type.id}/${encodeURIComponent(item.id)}`, tone: toneOf(type, item.status) },
      });
      if (!type.status) unit.querySelector(".pn-status").hidden = true;
    });
  }

  search.addEventListener("input", render);
  sort.addEventListener("change", render);

  (async () => {
    try {
      const [list, rel] = await Promise.all([adapters.data.list(type.id), relationLookups(type)]);
      if (!alive) return;
      items = list;
      lookups = rel.lookups;
      if (!items.length) {
        const empty = tpl("empty");
        fill(empty, { text: { title: `No ${lower} yet`, text: `Create the first ${type.singular}.` }, attrs: { icon: "#pn-icon-file" } });
        const add = button(`New ${type.singular}`, "create", "primary");
        add.addEventListener("click", openCreate);
        slotChildren(empty, "actions").append(add);
        slotChildren(s, "empty").replaceChildren(empty);
        s.dataset.state = "empty";
        return;
      }
      render();
      s.dataset.state = "ready";
    } catch (error) {
      if (alive) loadFailed(error, s, `Could not load ${lower}`);
    }
  })();

  return {
    cleanup() {
      alive = false;
      createValidationState.destroy();
      if (dialog.open) dialog.close();
      dialog.remove();
    },
    dirty: () => false,
    search: () => (s.dataset.state === "ready" ? search : null),
  };
}

// ---------- item ----------

function statusChoices(type, value) {
  const set = document.createElement("fieldset");
  set.className = "pn-choices";
  const legend = document.createElement("legend");
  legend.className = "pn-visually-hidden";
  legend.textContent = "Status";
  set.append(legend);
  for (const status of type.status) {
    const label = document.createElement("label");
    label.className = "pn-choice";
    const input = document.createElement("input");
    input.className = "pn-radio";
    input.type = "radio";
    input.name = "pn-status";
    input.value = status;
    input.checked = status === value;
    label.append(input, cap(status));
    set.append(label);
  }
  return set;
}

function itemScreen(type, id) {
  const s = tpl("screen-item");
  fill(s, { text: { title: "Loading…", status: "", "loading-text": "Loading…", created: "", updated: "" }, attrs: { state: "loading", "type-id": type.id, tone: "" } });
  const statusButton = s.querySelector('[data-action="status"]');
  if (!type.status) statusButton.hidden = true; // P1: types without status show none
  mountScreen(s);
  mountSavebar(null);
  setNav(type.id);
  const crumbs = (last) => setCrumbs([{ text: "Home", href: "#/" }, { text: type.label, href: `#/${type.id}` }, { text: last, href: `#/${type.id}/${encodeURIComponent(id)}` }]);
  crumbs("Loading…");

  let alive = true;
  let leaving = false;
  let item = null;
  let saveState = null;
  let validation = null;
  let slideOver = null;

  function showHeader() {
    const title = titleOf(type, item);
    fill(s, { text: { title, status: type.status ? cap(item.status) : "", created: formatDate(item.createdAt), updated: formatDate(item.updatedAt) }, attrs: { tone: toneOf(type, item.status) } });
    crumbs(title);
  }

  function failHeader(text) {
    fill(s, { text: { title: text } });
    crumbs(text);
  }

  async function changeStatus(next) {
    if (!saveState || saveState.state === "saving" || next === item.status) return;
    const from = type.status.indexOf(item.status);
    const ok = await saveState.save({ status: next }); // P3 runs in validate, P5 saves edits with it
    if (!ok) return;
    const to = type.status.indexOf(next);
    const singular = cap(type.singular);
    toast(to > from ? `${singular} ${next}` : `${singular} moved to ${next}`, "positive");
  }

  async function openStatus() {
    if (!saveState || saveState.state === "saving") return;
    if (type.status.length === 2) return changeStatus(type.status.find((st) => st !== item.status)); // P2
    slideOver = tpl("screen-slide-over");
    fill(slideOver, { text: { title: "Status" } });
    slotChildren(slideOver, "body").append(statusChoices(type, item.status));
    slotChildren(layout, "dialogs").append(slideOver);
    const result = await openDialog(slideOver, { opener: statusButton });
    const chosen = slideOver.querySelector('input[name="pn-status"]:checked')?.value;
    slideOver.remove();
    slideOver = null;
    if (result === "done" && chosen) await changeStatus(chosen);
  }

  statusButton.addEventListener("click", () => type.status && openStatus());

  (async () => {
    let rel;
    try {
      [item, rel] = await Promise.all([adapters.data.get(type.id, id), relationLookups(type)]);
    } catch (error) {
      if (!alive) return;
      if (error?.code === "not-found") {
        failHeader("Not found");
        return showError(s, `This ${type.singular} doesn't exist`, "It may have been deleted.", false);
      }
      if (isAuthError(error)) return loadFailed(error, s, "");
      failHeader("Could not load");
      return showError(s, `Could not load this ${type.singular}`, "Check your connection and try again.");
    }
    if (!alive) return;

    const form = s.querySelector("form");
    const grid = slotChildren(s, "fields");
    const controls = type.fields.map((f) => makeField(f, { prefix: type.id, files: adapters.files, options: rel.options }));
    for (const c of controls) {
      grid.append(c.el);
      c.set(item.values?.[c.field.name] ?? emptyValue(c.field));
    }
    const valueOf = (c) => {
      const v = c.get();
      return c.field.type === "relation" && v === "" ? null : v;
    };
    const read = () => Object.fromEntries(controls.map((c) => [c.field.name, valueOf(c)]));
    validation = createValidation({ root: form, fields: type.fields, get: (name) => valueOf(controls.find((c) => c.field.name === name)) });

    const savebar = tpl("savebar");
    saveState = createSaveState({
      form,
      savebar,
      read,
      write: (values) => controls.forEach((c) => c.set(values[c.field.name])),
      // V3, V4, V8: a move past the first status, or a save past it, runs the publish checks.
      validate: (values, { extra } = {}) => {
        const target = extra?.status ?? item.status;
        const publishing = Boolean(type.status) && target !== type.status[0];
        const invalid = validation.run(publishing ? "publish" : "format");
        if (!invalid.length) return true;
        validation.focus(invalid[0]);
        saveState.say(fixMessage(invalid.length, publishing ? "publish" : "save"));
        return false;
      },
      save: async (values, extra) => {
        try {
          const status = type.status ? (extra?.status ?? item.status) : undefined;
          item = await adapters.data.update(type.id, item.id, { status, values });
        } catch (error) {
          if (isAuthError(error)) toast(SIGNED_OUT, "negative");
          throw error;
        }
        if (alive) showHeader();
      },
      errorMessage: (error) => (error?.code === "conflict" ? "Changed elsewhere. Copy your edits, then reload." : null),
    });
    mountSavebar(savebar);

    const del = s.querySelector('[data-action="delete"]');
    del.addEventListener("click", async () => {
      const ok = await confirmDialog(confirmEl, { title: `Delete this ${type.singular}?`, text: "This can't be undone.", confirmLabel: "Delete", variant: "negative", opener: del });
      if (!ok) return;
      try {
        await adapters.data.remove(type.id, item.id);
      } catch {
        return toast("Could not delete. Try again.", "negative");
      }
      leaving = true;
      toast(`${cap(type.singular)} deleted`);
      location.hash = `#/${type.id}`;
    });

    showHeader();
    s.dataset.state = "ready";
  })();

  return {
    cleanup() {
      alive = false;
      saveState?.destroy();
      validation?.destroy();
      if (slideOver?.open) slideOver.close();
      slideOver?.remove();
    },
    dirty: () => !leaving && Boolean(saveState?.dirty),
    save: () => saveState?.save(),
  };
}

// ---------- singleton ----------

function singletonScreen(def) {
  const s = tpl("screen-singleton");
  fill(s, { text: { title: def.label, "loading-text": "Loading…" }, attrs: { state: "loading", "singleton-id": def.id } });
  mountScreen(s);
  mountSavebar(null);
  setNav(def.id);
  setCrumbs([{ text: "Home", href: "#/" }, { text: def.label, href: `#/${def.id}` }]);

  let alive = true;
  let saveState = null;
  let validation = null;

  (async () => {
    let record;
    try {
      record = await adapters.data.getSingleton(def.id);
    } catch (error) {
      if (alive) loadFailed(error, s, `Could not load ${def.label.toLowerCase()}`);
      return;
    }
    if (!alive) return;
    const form = s.querySelector("form");
    const grid = slotChildren(s, "fields");
    const controls = def.fields.map((f) => makeField(f, { prefix: def.id, files: adapters.files }));
    for (const c of controls) {
      grid.append(c.el);
      c.set(record?.values?.[c.field.name] ?? emptyValue(c.field));
    }
    const read = () => Object.fromEntries(controls.map((c) => [c.field.name, c.get()]));
    validation = createValidation({ root: form, fields: def.fields, get: (name) => controls.find((c) => c.field.name === name).get() });
    const savebar = tpl("savebar");
    saveState = createSaveState({
      form,
      savebar,
      read,
      write: (values) => controls.forEach((c) => c.set(values[c.field.name])),
      // V7: a singleton save is blocked by empty required fields and format errors.
      validate: () => {
        const invalid = validation.run("required");
        if (!invalid.length) return true;
        validation.focus(invalid[0]);
        saveState.say(fixMessage(invalid.length, "save"));
        return false;
      },
      save: async (values) => {
        try {
          await adapters.data.saveSingleton(def.id, values);
        } catch (error) {
          if (isAuthError(error)) toast(SIGNED_OUT, "negative");
          throw error;
        }
      },
      errorMessage: (error) => (error?.code === "conflict" ? "Changed elsewhere. Copy your edits, then reload." : null),
    });
    mountSavebar(savebar);
    s.dataset.state = "ready";
  })();

  return {
    cleanup() {
      alive = false;
      saveState?.destroy();
      validation?.destroy();
    },
    dirty: () => Boolean(saveState?.dirty),
    save: () => saveState?.save(),
  };
}

// ---------- login ----------

function showLogin({ message = "", unreachable = false } = {}) {
  current.cleanup();
  current = IDLE;
  offKeys?.();
  offKeys = null;
  layout = null;
  const s = tpl("screen-login");
  fill(s, { text: { title: PANEL.name, text: "Sign in to edit the site.", error: message } });
  app.replaceChildren(s);
  document.title = `Sign in · ${PANEL.name}`;
  const error = s.querySelector('[data-slot="error"]');
  if (unreachable) {
    error.textContent = "Could not reach the panel. Check your connection and reload.";
    return;
  }
  adapters.auth.renderMethods(slotChildren(s, "methods"), {
    onSignedIn: () => boot(),
    onError: (text) => (error.textContent = text),
  });
}

async function logout() {
  if (current.dirty() && !(await discard())) return; // S9: logging out asks the same way
  try {
    await adapters.auth.logout();
  } catch {
    return toast("Could not log out. Try again.", "negative");
  }
  showLogin();
}

async function boot() {
  let session;
  try {
    session = await adapters.auth.session();
  } catch {
    return showLogin({ unreachable: true });
  }
  if (!session?.user) return showLogin();
  mountLayout(session.user);
  route();
}

boot();
