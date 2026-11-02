// Field Notes panel. Routes, screens, and adapter wiring (build.md steps 4 to 6).

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
import { createGoogleAuth } from "./adapters/auth.js";

// ---------- adapters ----------

function createRecipeAdapters() {
  const request = createRequest();
  // json-files and local-disk, via: server
  const { data, files } = createHttpAdapters(request);
  // google-login
  return { data, files, auth: createGoogleAuth(request) };
}

const idle = { cleanup() {}, dirty: () => false };
let current = idle;
let lastHash = location.hash; // route() sets it each time it renders

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

const { data, files, auth } = adapters;

// ---------- helpers ----------

const app = document.getElementById("app");
let shell = null;
let user = null;
let routeToken = 0;

const capital = (text) => text.charAt(0).toUpperCase() + text.slice(1);
const isAuthError = (error) => error?.code === "unauthorized" || error?.code === "forbidden";
const fieldOf = (def, name) => def.fields.find((f) => f.name === name);
const titleOf = (type, item) => item.values?.[type.list.title] || "Untitled";
const countOf = (type, n) => `${n} ${n === 1 ? type.singular : type.label.toLowerCase()}`;
const blank = (v) => v === "" || v === null || v === undefined || (Array.isArray(v) && v.length === 0);

function formatDate(value) {
  if (!value) return "";
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const date = new Date(dateOnly ? `${value}T00:00:00Z` : value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", ...(dateOnly ? { timeZone: "UTC" } : {}) });
}

function display(field, value) {
  if (blank(value)) return "";
  if (field?.type === "date") return formatDate(value);
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") return value.name ?? "";
  return String(value);
}

function toneOf(type, status) {
  const i = type.status.indexOf(status);
  if (i === 0) return "neutral";
  return i === type.status.length - 1 ? "positive" : "notice";
}

function countWords(text) {
  return String(text ?? "").split(/\s+/).filter((word) => /[\p{L}\p{N}]/u.test(word)).length;
}

function emptyValue(field) {
  if (field.type === "tags") return [];
  if (["image", "file", "number", "relation"].includes(field.type)) return null;
  if (field.type === "toggle") return false;
  if (field.type === "custom") return null;
  return "";
}

function button(text, action, variant) {
  const el = document.createElement("button");
  el.className = "pn-button";
  el.type = "button";
  el.dataset.action = action;
  if (variant) el.dataset.variant = variant;
  el.textContent = text;
  return el;
}

function errorBlock(title, text, action) {
  const el = tpl("error");
  fill(el, { text: { title, text } });
  if (action) slotChildren(el, "actions").append(action);
  return el;
}

function retryButton(onClick = rerender) {
  const el = button("Try again", "retry");
  el.addEventListener("click", onClick);
  return el;
}

function showError(screen, block) {
  slotChildren(screen, "error").replaceChildren(block);
  screen.setAttribute("data-state", "error");
}

function toast(text, tone) {
  if (shell) showToast(shell.toasts, text, { tone });
}

const discard = () =>
  confirmDialog(shell.confirm, { title: "Discard unsaved changes?", text: "Your edits will be lost.", confirmLabel: "Discard", variant: "negative" });

function saveFailed(error, saveState) {
  if (isAuthError(error)) toast("You were signed out. Copy your edits, then reload to sign in.", "negative");
  else if (error?.code === "conflict") setTimeout(() => saveState.say("Changed elsewhere. Copy your edits, then reload."));
  else if (error?.code === "invalid") console.error(error.message);
}

// ---------- computed custom fields ----------

const computed = {
  // reading_time: "Read-only. Estimated minutes to read, from the word count of body."
  readingTime: {
    value: (values) => Math.max(1, Math.ceil(countWords(values.body) / 200)),
    display: (values) => `${computed.readingTime.value(values)} min`,
  },
};

function newValues(def, given) {
  const values = {};
  for (const field of def.fields) {
    if (field.compute) continue;
    values[field.name] = given[field.name] ?? field.default ?? emptyValue(field);
  }
  for (const field of def.fields) if (field.compute) values[field.name] = computed[field.compute].value(values);
  return values;
}

// ---------- shell ----------

function buildShell() {
  const layout = tpl("layout");
  const nav = tpl("nav");
  fill(nav, { text: { brand: PANEL.name } });
  const entries = [
    { text: "Home", href: "#/" },
    ...PANEL.types.map((t) => ({ text: t.label, href: `#/${t.id}` })),
    ...PANEL.singletons.map((s) => ({ text: s.label, href: `#/${s.id}` })),
  ];
  repeat(slotRepeat(nav, "entry"), entries, (unit, e) => fill(unit, { text: { text: e.text }, attrs: { href: e.href, current: "false" } }));

  const account = tpl("account");
  fill(account, { text: { user } });
  account.querySelector('[data-action="logout"]').addEventListener("click", logout);
  slotChildren(nav, "account").append(account);
  slotChildren(layout, "nav").append(nav);

  const header = tpl("header");
  slotChildren(layout, "header").append(header);

  const confirm = tpl("screen-dialog");
  const slideOver = tpl("screen-slide-over");
  const dialogs = slotChildren(layout, "dialogs");
  dialogs.append(confirm, slideOver);

  app.replaceChildren(layout);
  shell = {
    nav,
    header,
    dialogs,
    confirm,
    slideOver,
    screen: slotChildren(layout, "screen"),
    savebar: slotChildren(layout, "savebar"),
    toasts: slotChildren(layout, "toasts"),
  };
}

function setNav(href) {
  for (const unit of slotRepeat(shell.nav, "entry").children) {
    const link = unit.querySelector("a");
    fill(unit, { attrs: { current: link.getAttribute("href") === href ? "page" : "false" } });
  }
}

function setCrumbs(crumbs) {
  const last = crumbs.length - 1;
  repeat(slotRepeat(shell.header, "crumb"), crumbs, (unit, c, i) =>
    fill(unit, { text: { text: c.text }, attrs: { href: c.href, current: i === last ? "page" : "false" } }),
  );
  document.title = `${crumbs[last].text} · ${PANEL.name}`;
}

function mount(screen, savebar) {
  shell.screen.replaceChildren(screen);
  shell.savebar.replaceChildren(...(savebar ? [savebar] : []));
}

const home = { text: "Home", href: "#/" };

// ---------- routing ----------

function rerender() {
  current.cleanup();
  current = idle;
  route();
}

function route() {
  lastHash = location.hash;
  if (!shell) return start();
  const token = ++routeToken;
  const stale = () => token !== routeToken;
  current = idle;
  const parts = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean).map(decodeURIComponent);
  if (!parts.length) return showHome(stale);
  const type = PANEL.types.find((t) => t.id === parts[0]);
  const single = PANEL.singletons.find((s) => s.id === parts[0]);
  if (type && parts.length === 1) return showCollection(type, stale);
  if (type && parts.length === 2) return showItem(type, parts[1], stale);
  if (single && parts.length === 1) return showSingleton(single, stale);
  showNotFound();
}

window.addEventListener("hashchange", async () => {
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

// ---------- home ----------

async function showHome(stale) {
  const screen = tpl("screen-home");
  fill(screen, {
    text: { title: PANEL.name, "loading-text": "Loading…", "content-heading": "Content", "recent-heading": "Recently edited" },
    attrs: { state: "loading" },
  });
  mount(screen);
  setNav("#/");
  setCrumbs([home]);
  let lists;
  try {
    lists = await Promise.all(PANEL.types.map((t) => data.list(t.id)));
  } catch (error) {
    if (stale()) return;
    if (isAuthError(error)) return showLogin({ error });
    return showError(screen, errorBlock("Could not load the panel", "Check your connection and try again.", retryButton()));
  }
  if (stale()) return;
  const entries = [
    ...PANEL.types.map((t, i) => ({ title: t.label, subtitle: countOf(t, lists[i].length), href: `#/${t.id}` })),
    ...PANEL.singletons.map((s) => ({ title: s.label, subtitle: "Page", href: `#/${s.id}` })),
  ];
  repeat(slotRepeat(screen, "entry"), entries, (unit, e) =>
    fill(unit, { text: { title: e.title, subtitle: e.subtitle, meta: "" }, attrs: { href: e.href } }),
  );
  const recent = PANEL.types
    .flatMap((type, i) => lists[i].map((item) => ({ type, item })))
    .sort((a, b) => String(b.item.updatedAt).localeCompare(String(a.item.updatedAt)))
    .slice(0, 5);
  repeat(slotRepeat(screen, "recent"), recent, (unit, { type, item }) =>
    fill(unit, {
      text: { title: titleOf(type, item), subtitle: type.label, meta: formatDate(item.updatedAt) },
      attrs: { href: `#/${type.id}/${encodeURIComponent(item.id)}` },
    }),
  );
  screen.setAttribute("data-state", "ready");
}

function showNotFound() {
  const screen = tpl("screen-home");
  fill(screen, { text: { title: "Not found", "loading-text": "Loading…", "content-heading": "Content", "recent-heading": "Recently edited" }, attrs: { state: "loading" } });
  repeat(slotRepeat(screen, "entry"), [], () => {});
  repeat(slotRepeat(screen, "recent"), [], () => {});
  mount(screen);
  setNav(null);
  setCrumbs([home, { text: "Not found", href: location.hash }]);
  showError(
    screen,
    errorBlock("This page doesn't exist", "Check the address, or go back home.", retryButton(() => (location.hash = "#/"))),
  );
}

// ---------- collection ----------

function sortOptions(type) {
  const options = [];
  const key = type.list.sort?.replace(/^-/, "");
  if (key) {
    const field = fieldOf(type, key);
    const isDate = field.type === "date";
    options.push(
      { value: `-${key}`, text: isDate ? "Newest first" : `${field.label}, descending` },
      { value: key, text: isDate ? "Oldest first" : `${field.label}, ascending` },
    );
  }
  if (!options.some((o) => o.value === type.list.title)) options.push({ value: type.list.title, text: "Title A–Z" });
  return options;
}

function sortItems(items, value) {
  const desc = value.startsWith("-");
  const name = value.replace(/^-/, "");
  return [...items].sort((a, b) => {
    const x = a.values?.[name];
    const y = b.values?.[name];
    if (blank(x) || blank(y)) return blank(x) - blank(y);
    const order =
      typeof x === "number" && typeof y === "number"
        ? x - y
        : String(x).localeCompare(String(y), "en", { numeric: true, sensitivity: "base" });
    return desc ? -order : order;
  });
}

function setupCreate(type) {
  const dialog = tpl("screen-create");
  fill(dialog, { text: { title: `New ${type.singular}` } });
  const titleField = fieldOf(type, type.list.title);
  const slugField = type.fields.find((f) => f.type === "slug" && f.from === titleField.name);
  const fields = [titleField, slugField].filter(Boolean);
  const controls = fields.map((field) => makeField(field, { prefix: `${type.id}-new`, files }));
  slotChildren(dialog, "fields").append(...controls.map((c) => c.el));
  shell.dialogs.append(dialog);
  const get = (name) => controls.find((c) => c.field.name === name).get();
  const validation = createValidation({ root: dialog, fields, get });
  const flow = createFlow({
    dialog,
    title: titleField.name,
    slug: slugField?.name ?? null,
    validation,
    read: () => Object.fromEntries(controls.map((c) => [c.field.name, c.get()])),
    create: (values) => data.create(type.id, { status: type.status?.[0], values: newValues(type, values) }),
    onCreated: (item) => (location.hash = `#/${type.id}/${encodeURIComponent(item.id)}`),
    onError: () => toast("Could not create. Try again.", "negative"),
  });
  return {
    open: (opener) => flow.open(opener),
    destroy() {
      validation.destroy();
      if (dialog.open) dialog.close();
      dialog.remove();
    },
  };
}

async function showCollection(type, stale) {
  const label = type.label.toLowerCase();
  const screen = tpl("screen-collection");
  fill(screen, {
    text: { title: type.label, "create-label": `New ${type.singular}`, "loading-text": "Loading…", "search-label": `Search ${label}`, "sort-label": "Sort by" },
    attrs: { state: "loading", "type-id": type.id, "search-placeholder": `Search ${label}` },
  });
  const sort = screen.querySelector(".pn-select");
  repeat(sort, sortOptions(type), (unit, o) => fill(unit, { text: { text: o.text }, attrs: { value: o.value } }));
  sort.value = type.list.sort ?? type.list.title;
  const search = screen.querySelector('input[type="search"]');

  mount(screen);
  setNav(`#/${type.id}`);
  setCrumbs([home, { text: type.label, href: `#/${type.id}` }]);

  const create = setupCreate(type);
  screen.querySelector('.pn-screen-actions [data-action="create"]').addEventListener("click", (event) => create.open(event.currentTarget));
  const offKeys = installShortcuts({ search: () => (screen.getAttribute("data-state") === "ready" ? search : null) });
  current = {
    cleanup() {
      offKeys();
      create.destroy();
    },
    dirty: () => false,
  };

  let items;
  try {
    items = await data.list(type.id);
  } catch (error) {
    if (stale()) return;
    if (isAuthError(error)) return showLogin({ error });
    return showError(screen, errorBlock(`Could not load ${label}`, "Check your connection and try again.", retryButton()));
  }
  if (stale()) return;

  if (!items.length) {
    const empty = tpl("empty");
    fill(empty, { text: { title: `No ${label} yet`, text: `Create the first ${type.singular}.` }, attrs: { icon: "#pn-icon-file" } });
    const add = button(`New ${type.singular}`, "create", "primary");
    add.addEventListener("click", () => create.open(add));
    slotChildren(empty, "actions").append(add);
    slotChildren(screen, "empty").append(empty);
    screen.setAttribute("data-state", "empty");
    return;
  }

  const searchIn = type.list.search ?? [type.list.title];
  function renderRows() {
    const query = search.value.trim().toLowerCase();
    const shown = items.filter(
      (item) => !query || searchIn.some((name) => display(fieldOf(type, name), item.values?.[name]).toLowerCase().includes(query)),
    );
    const subtitle = type.list.subtitle && fieldOf(type, type.list.subtitle);
    repeat(slotRepeat(screen, "row"), sortItems(shown, sort.value), (unit, item) => {
      fill(unit, {
        text: {
          title: titleOf(type, item),
          subtitle: subtitle ? display(subtitle, item.values?.[subtitle.name]) : "",
          status: type.status ? capital(item.status) : "",
        },
        attrs: { href: `#/${type.id}/${encodeURIComponent(item.id)}`, tone: type.status ? toneOf(type, item.status) : "" },
      });
      if (!type.status) unit.querySelector(".pn-status").hidden = true;
    });
  }
  search.addEventListener("input", renderRows);
  sort.addEventListener("change", renderRows);
  renderRows();
  screen.setAttribute("data-state", "ready");
}

// ---------- item and singleton forms ----------

function buildForm(def, screen, form) {
  const controls = new Map();
  const values = () => Object.fromEntries([...controls.values()].filter((c) => !c.field.compute).map((c) => [c.field.name, c.get()]));
  const grid = slotChildren(screen, "fields");
  for (const field of def.fields) {
    const control = makeField(field, { prefix: def.id, files, computed, values, root: form });
    grid.append(control.el);
    controls.set(field.name, control);
  }

  // behavior: Show word count under the body field
  function showWordCount() {
    const body = def.wordCount && controls.get(def.wordCount);
    if (!body) return;
    const n = countWords(body.get());
    fill(body.el, { text: { help: n === 1 ? "1 word" : `${n} words` } });
  }
  form.addEventListener("input", showWordCount);

  return {
    controls,
    get: (name) => controls.get(name).get(),
    read: () => Object.fromEntries([...controls.values()].map((c) => [c.field.name, c.get()])),
    write(values) {
      for (const c of controls.values()) c.set(values?.[c.field.name]);
      showWordCount();
    },
    destroy: () => form.removeEventListener("input", showWordCount),
  };
}

function makeSavebar() {
  const savebar = tpl("savebar");
  fill(savebar, { text: { message: "All changes saved" }, attrs: { "save-state": "clean" } });
  return savebar;
}

async function showItem(type, id, stale) {
  const screen = tpl("screen-item");
  fill(screen, { text: { title: "Loading…", "loading-text": "Loading…", status: "" }, attrs: { state: "loading", "type-id": type.id, tone: "neutral" } });
  const statusButton = screen.querySelector('[data-action="status"]');
  statusButton.hidden = true;
  mount(screen);
  setNav(`#/${type.id}`);
  const crumbs = (text) => setCrumbs([home, { text: type.label, href: `#/${type.id}` }, { text, href: location.hash }]);
  crumbs("Loading…");

  let item;
  try {
    item = await data.get(type.id, id);
  } catch (error) {
    if (stale()) return;
    if (isAuthError(error)) return showLogin({ error });
    if (error?.code === "not-found") {
      fill(screen, { text: { title: "Not found" } });
      crumbs("Not found");
      return showError(screen, errorBlock(`This ${type.singular} doesn't exist`, "It may have been deleted."));
    }
    fill(screen, { text: { title: "Could not load" } });
    crumbs("Could not load");
    return showError(screen, errorBlock(`Could not load this ${type.singular}`, "Check your connection and try again.", retryButton()));
  }
  if (stale()) return;

  const form = screen.querySelector("form");
  const fields = buildForm(type, screen, form);
  fields.write(item.values);
  const first = type.status?.[0];

  function renderHeader() {
    fill(screen, {
      text: { title: titleOf(type, item), created: formatDate(item.createdAt), updated: formatDate(item.updatedAt) },
    });
    if (type.status) {
      fill(screen, { text: { status: capital(item.status) }, attrs: { tone: toneOf(type, item.status) } });
      statusButton.hidden = false;
    }
    crumbs(titleOf(type, item));
  }
  renderHeader();

  const savebar = makeSavebar();
  mount(screen, savebar);
  const validation = createValidation({ root: form, fields: type.fields, get: fields.get });
  const publishing = (extra) => Boolean(type.status && extra?.status && extra.status !== first);

  const saveState = createSaveState({
    form,
    savebar,
    read: fields.read,
    write: fields.write,
    async save(values, extra) {
      try {
        item = await data.update(type.id, item.id, { status: extra?.status ?? item.status, values });
      } catch (error) {
        saveFailed(error, saveState);
        throw error;
      }
      renderHeader();
    },
    validate(values, { background, extra }) {
      if (background) return validation.valid();
      const isPublish = publishing(extra);
      const invalid = isPublish ? validation.run("publish", type.publishRequires ?? []) : validation.run("format");
      if (!invalid.length) return true;
      validation.focus(invalid[0]);
      saveState.say(fixMessage(invalid.length, isPublish ? "publish" : "save"));
      return false;
    },
    // behavior: Autosave drafts every 10 seconds
    autosave: type.autosave && { every: type.autosave.every, when: () => !type.autosave.drafts || item.status === first },
    onRevert: () => validation.clear(),
  });

  async function pickStatus() {
    if (type.status.length === 2) return type.status.find((s) => s !== item.status);
    const drawer = shell.slideOver;
    fill(drawer, { text: { title: "Status" } });
    const fieldset = document.createElement("fieldset");
    fieldset.className = "pn-choices";
    const legend = document.createElement("legend");
    legend.className = "pn-visually-hidden";
    legend.textContent = "Status";
    fieldset.append(legend);
    for (const status of type.status) {
      const choice = document.createElement("label");
      choice.className = "pn-choice";
      const radio = document.createElement("input");
      radio.className = "pn-radio";
      radio.type = "radio";
      radio.name = "pn-status";
      radio.value = status;
      radio.checked = status === item.status;
      choice.append(radio, capital(status));
      fieldset.append(choice);
    }
    slotChildren(drawer, "body").replaceChildren(fieldset);
    const result = await openDialog(drawer, { opener: statusButton });
    return result === "done" ? fieldset.querySelector("input:checked")?.value : null;
  }

  let changing = false;
  statusButton.addEventListener("click", async () => {
    if (changing || saveState.state === "saving") return;
    changing = true;
    try {
      const next = await pickStatus();
      if (!next || next === item.status) return;
      const from = type.status.indexOf(item.status);
      const to = type.status.indexOf(next);
      if (next !== first) {
        const invalid = validation.run("publish", type.publishRequires ?? []);
        if (invalid.length) {
          validation.focus(invalid[0]);
          saveState.say(fixMessage(invalid.length, "publish"));
          return;
        }
      }
      // behavior: Publishing asks for confirmation
      if (type.confirmPublish && item.status === first && next !== first) {
        const ok = await confirmDialog(shell.confirm, {
          title: `Publish this ${type.singular}?`,
          text: "It will be visible on the site.",
          confirmLabel: capital(next),
          opener: statusButton,
        });
        if (!ok) return;
      }
      if (await saveState.save({ status: next })) {
        const name = capital(type.singular);
        toast(to > from ? `${name} ${next}` : `${name} moved to ${next}`, "positive");
      }
    } finally {
      changing = false;
    }
  });

  screen.querySelector('[data-action="delete"]').addEventListener("click", async (event) => {
    const ok = await confirmDialog(shell.confirm, {
      title: `Delete this ${type.singular}?`,
      text: "This can't be undone.",
      confirmLabel: "Delete",
      variant: "negative",
      opener: event.currentTarget,
    });
    if (!ok) return;
    try {
      await data.remove(type.id, item.id);
    } catch (error) {
      toast(isAuthError(error) ? "You were signed out. Copy your edits, then reload to sign in." : "Could not delete. Try again.", "negative");
      return;
    }
    toast(`${capital(type.singular)} deleted`);
    current.cleanup();
    current = idle;
    location.hash = `#/${type.id}`;
  });

  const offKeys = installShortcuts({ save: () => saveState.save() });
  current = {
    cleanup() {
      offKeys();
      saveState.destroy();
      validation.destroy();
      fields.destroy();
    },
    dirty: () => saveState.dirty,
  };
  screen.setAttribute("data-state", "ready");
}

async function showSingleton(single, stale) {
  const screen = tpl("screen-singleton");
  fill(screen, { text: { title: single.label, "loading-text": "Loading…" }, attrs: { state: "loading", "singleton-id": single.id } });
  mount(screen);
  setNav(`#/${single.id}`);
  setCrumbs([home, { text: single.label, href: `#/${single.id}` }]);

  let record;
  try {
    record = await data.getSingleton(single.id);
  } catch (error) {
    if (stale()) return;
    if (isAuthError(error)) return showLogin({ error });
    return showError(screen, errorBlock(`Could not load ${single.label.toLowerCase()}`, "Check your connection and try again.", retryButton()));
  }
  if (stale()) return;

  const form = screen.querySelector("form");
  const fields = buildForm(single, screen, form);
  fields.write(record?.values ?? {});
  const savebar = makeSavebar();
  mount(screen, savebar);
  const validation = createValidation({ root: form, fields: single.fields, get: fields.get });

  const saveState = createSaveState({
    form,
    savebar,
    read: fields.read,
    write: fields.write,
    async save(values) {
      try {
        await data.saveSingleton(single.id, values);
      } catch (error) {
        saveFailed(error, saveState);
        throw error;
      }
    },
    validate() {
      const invalid = validation.run("required");
      if (!invalid.length) return true;
      validation.focus(invalid[0]);
      saveState.say(fixMessage(invalid.length, "save"));
      return false;
    },
    onRevert: () => validation.clear(),
  });

  const offKeys = installShortcuts({ save: () => saveState.save() });
  current = {
    cleanup() {
      offKeys();
      saveState.destroy();
      validation.destroy();
      fields.destroy();
    },
    dirty: () => saveState.dirty,
  };
  screen.setAttribute("data-state", "ready");
}

// ---------- login ----------

function showLogin({ error, unreachable = false } = {}) {
  current.cleanup();
  current = idle;
  shell = null;
  const login = tpl("screen-login");
  fill(login, { text: { title: PANEL.name, text: "Sign in to edit the site.", error: "" } });
  app.replaceChildren(login);
  document.title = `Sign in · ${PANEL.name}`;
  const say = (message) => fill(login, { text: { error: message } });
  if (unreachable) return say("Could not reach the panel. Check your connection and reload.");
  if (error?.code === "forbidden") say("This account isn't allowed. Sign in with another one.");
  auth.renderMethods(slotChildren(login, "methods"), { onSignedIn: start, onError: say });
}

async function logout() {
  if (current.dirty() && !(await discard())) return;
  try {
    await auth.logout();
  } catch {
    toast("Could not log out. Try again.", "negative");
    return;
  }
  showLogin();
}

async function start() {
  let session;
  try {
    session = await auth.session();
  } catch {
    return showLogin({ unreachable: true });
  }
  if (!session?.user) return showLogin();
  user = session.user;
  buildShell();
  route();
}

start();
