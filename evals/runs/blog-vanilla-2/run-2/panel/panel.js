// Field Notes panel: routes, screens, and adapter wiring (build.md steps 3 to 6).

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

// ---------- Adapters ----------

function createRecipeAdapters() {
  const request = createRequest();
  const { data, files } = createHttpAdapters(request);
  return { data, files, auth: createGoogleAuth(request) };
}

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

// ---------- Helpers ----------

const app = document.getElementById("app");
const idle = { cleanup() {}, dirty: () => false };
let current = idle;
let layout = null;
let slots = null;
let confirmEl = null;
let renderToken = 0;

const AUTH_ERRORS = new Set(["unauthorized", "forbidden"]);
const NOT_ALLOWED = "This account isn't allowed. Sign in with another one.";
const SIGNED_OUT = "You were signed out. Copy your edits, then reload to sign in.";

const cap = (text) => text.charAt(0).toUpperCase() + text.slice(1);
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const typeById = (id) => PANEL.types.find((t) => t.id === id);
const singletonById = (id) => PANEL.singletons.find((s) => s.id === id);
const firstStatus = (type) => type.status?.[0];
const isBlank = (v) => v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);
const countWords = (text) => (String(text ?? "").match(/\S+/g) ?? []).length;
const setState = (screen, state) => screen.setAttribute("data-state", state);
const toast = (text, tone) => slots && showToast(slots.toasts, text, tone ? { tone } : {});

function tone(type, status) {
  const list = type.status ?? [];
  const i = list.indexOf(status);
  if (i < 0) return "";
  if (i === 0) return "neutral";
  return i === list.length - 1 ? "positive" : "notice";
}

// "Oct 28, 2026". Plain dates are read as calendar dates, so no time zone shifts them.
function formatDate(value) {
  if (!value) return "";
  const plain = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const date = plain ? new Date(Date.UTC(+plain[1], plain[2] - 1, +plain[3])) : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", ...(plain ? { timeZone: "UTC" } : {}) });
}

function itemTitle(type, item) {
  const value = item?.values?.[type.list.title];
  return isBlank(value) ? "Untitled" : String(value);
}

function itemSubtitle(type, item) {
  const field = type.fields.find((f) => f.name === type.list.subtitle);
  if (!field) return "";
  const value = item.values?.[field.name];
  if (isBlank(value)) return "";
  if (field.type === "date") return formatDate(value);
  return Array.isArray(value) ? value.join(", ") : String(value);
}

function sortItems(items, sort) {
  const desc = sort.startsWith("-");
  const name = desc ? sort.slice(1) : sort;
  return [...items].sort((a, b) => {
    const x = a.values?.[name];
    const y = b.values?.[name];
    if (isBlank(x) || isBlank(y)) return isBlank(x) - isBlank(y);
    const order = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), undefined, { sensitivity: "base", numeric: true });
    return desc ? -order : order;
  });
}

function button(text, { action, variant } = {}) {
  const el = document.createElement("button");
  el.className = "pn-button";
  el.type = "button";
  if (variant) el.dataset.variant = variant;
  if (action) el.dataset.action = action;
  el.textContent = text;
  return el;
}

// An `empty` or `error` template, filled.
function block(name, { icon, title, text, action }) {
  const el = tpl(name);
  fill(el, { text: { title, text }, attrs: icon ? { icon } : {} });
  if (action) slotChildren(el, "actions").append(action);
  return el;
}

function retryButton() {
  const el = button("Try again", { action: "retry" });
  el.addEventListener("click", rerender);
  return el;
}

function discard() {
  return confirmDialog(confirmEl, { title: "Discard unsaved changes?", text: "Your edits will be lost.", confirmLabel: "Discard", variant: "negative" });
}

// A load that throws unauthorized or forbidden shows the login screen.
function authFailure(error) {
  if (!AUTH_ERRORS.has(error?.code)) return false;
  showLogin({ message: error.code === "forbidden" ? NOT_ALLOWED : "" });
  return true;
}

// "Reading time": Read-only. Estimated minutes to read, from the word count of body.
const COMPUTED = {
  readingTime: {
    value: (values) => Math.max(1, Math.ceil(countWords(values.body) / 200)),
    display: (values) => `${COMPUTED.readingTime.value(values)} min`,
  },
};

// ---------- Login and layout ----------

async function start() {
  current.cleanup();
  current = idle;
  let session;
  try {
    session = await adapters.auth.session();
  } catch {
    return showLogin({ unreachable: true });
  }
  if (!session?.user) return showLogin();
  buildLayout(session.user);
  route();
}

function showLogin({ message = "", unreachable = false } = {}) {
  current.cleanup();
  current = idle;
  layout = null;
  slots = null;
  renderToken++;
  const login = tpl("screen-login");
  fill(login, {
    text: {
      title: PANEL.name,
      text: "Sign in to edit the site.",
      error: unreachable ? "Could not reach the panel. Check your connection and reload." : message,
    },
  });
  document.title = `Sign in · ${PANEL.name}`;
  app.replaceChildren(login);
  if (unreachable) return;
  adapters.auth.renderMethods(slotChildren(login, "methods"), {
    onSignedIn: () => start(),
    onError: (text) => fill(login, { text: { error: text } }),
  });
}

function buildLayout(user) {
  layout = tpl("layout");
  slots = {
    nav: slotChildren(layout, "nav"),
    header: slotChildren(layout, "header"),
    screen: slotChildren(layout, "screen"),
    savebar: slotChildren(layout, "savebar"),
    dialogs: slotChildren(layout, "dialogs"),
    toasts: slotChildren(layout, "toasts"),
  };
  const nav = tpl("nav");
  fill(nav, { text: { brand: PANEL.name } });
  const account = tpl("account");
  fill(account, { text: { user } });
  account.querySelector('[data-action="logout"]').addEventListener("click", logout);
  slotChildren(nav, "account").append(account);
  slots.nav.append(nav);
  confirmEl = tpl("screen-dialog");
  fill(confirmEl, { attrs: { variant: "primary" } });
  slots.dialogs.append(confirmEl);
  app.replaceChildren(layout);
}

async function logout() {
  if (current.dirty() && !(await discard())) return;
  try {
    await adapters.auth.logout();
  } catch {
    return toast("Could not log out. Try again.", "negative");
  }
  showLogin();
}

function renderNav(currentHref) {
  const entries = [
    { text: "Home", href: "#/" },
    ...PANEL.types.map((t) => ({ text: t.label, href: `#/${t.id}` })),
    ...PANEL.singletons.map((s) => ({ text: s.label, href: `#/${s.id}` })),
  ];
  repeat(slotRepeat(slots.nav, "entry"), entries, (unit, e) =>
    fill(unit, { text: { text: e.text }, attrs: { href: e.href, current: e.href === currentHref ? "page" : "false" } }),
  );
}

function renderHeader(crumbs) {
  let header = slots.header.firstElementChild;
  if (!header) slots.header.append((header = tpl("header")));
  repeat(slotRepeat(header, "crumb"), crumbs, (unit, c, i) =>
    fill(unit, { text: { text: c.text }, attrs: { href: c.href, current: i === crumbs.length - 1 ? "page" : "false" } }),
  );
  document.title = `${crumbs.at(-1).text} · ${PANEL.name}`;
}

function mount({ screen, crumbs, nav = null }) {
  renderNav(nav);
  renderHeader(crumbs);
  slots.savebar.replaceChildren();
  const hadFocus = layout.contains(document.activeElement) && document.activeElement !== document.body;
  slots.screen.replaceChildren(screen);
  if (hadFocus && !layout.contains(document.activeElement)) slots.screen.focus({ preventScroll: true });
}

const HOME = { text: "Home", href: "#/" };

// ---------- Routing ----------

let lastHash = location.hash; // route() sets it each time it renders
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

function rerender() {
  current.cleanup();
  route();
}

function route() {
  lastHash = location.hash;
  if (!layout) return start();
  current = idle;
  const token = ++renderToken;
  const parts = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean).map((p) => {
    try {
      return decodeURIComponent(p);
    } catch {
      return p;
    }
  });
  const type = typeById(parts[0]);
  const singleton = singletonById(parts[0]);
  if (parts.length === 0) return renderHome(token);
  if (type && parts.length === 1) return renderCollection(type, token);
  if (type && parts.length === 2) return renderItem(type, parts[1], token);
  if (singleton && parts.length === 1) return renderSingleton(singleton, token);
  return renderNotFound();
}

// ---------- Home ----------

function homeScreen(title) {
  const screen = tpl("screen-home");
  fill(screen, { text: { title, "loading-text": "Loading…", "content-heading": "Content", "recent-heading": "Recently edited" } });
  return screen;
}

async function renderHome(token) {
  const screen = homeScreen(PANEL.name);
  setState(screen, "loading");
  mount({ screen, crumbs: [HOME], nav: "#/" });
  const offKeys = installShortcuts({});
  current = { cleanup: offKeys, dirty: () => false };
  let lists;
  try {
    lists = await Promise.all(PANEL.types.map((t) => adapters.data.list(t.id)));
  } catch (error) {
    if (token !== renderToken || authFailure(error)) return;
    slotChildren(screen, "error").replaceChildren(block("error", { title: "Could not load the panel", text: "Check your connection and try again.", action: retryButton() }));
    return setState(screen, "error");
  }
  if (token !== renderToken) return;
  const entries = [
    ...PANEL.types.map((t, i) => ({ title: t.label, subtitle: plural(lists[i].length, t.singular, t.label.toLowerCase()), href: `#/${t.id}` })),
    ...PANEL.singletons.map((s) => ({ title: s.label, subtitle: "Page", href: `#/${s.id}` })),
  ];
  repeat(slotRepeat(screen, "entry"), entries, (unit, e) => fill(unit, { text: { title: e.title, subtitle: e.subtitle, meta: "" }, attrs: { href: e.href } }));
  const recent = PANEL.types
    .flatMap((t, i) => lists[i].map((item) => ({ type: t, item })))
    .sort((a, b) => String(b.item.updatedAt).localeCompare(String(a.item.updatedAt)))
    .slice(0, 5);
  repeat(slotRepeat(screen, "recent"), recent, (unit, { type, item }) =>
    fill(unit, { text: { title: itemTitle(type, item), subtitle: type.label, meta: formatDate(item.updatedAt) }, attrs: { href: `#/${type.id}/${encodeURIComponent(item.id)}` } }),
  );
  setState(screen, "ready");
}

function renderNotFound() {
  const screen = homeScreen("Not found");
  repeat(slotRepeat(screen, "entry"), [], () => {});
  repeat(slotRepeat(screen, "recent"), [], () => {});
  const home = button("Try again", { action: "retry" });
  home.addEventListener("click", () => (location.hash = "#/"));
  slotChildren(screen, "error").append(block("error", { title: "This page doesn't exist", text: "Check the address, or go back home.", action: home }));
  setState(screen, "error");
  mount({ screen, crumbs: [HOME, { text: "Not found", href: location.hash }] });
  current = { cleanup: installShortcuts({}), dirty: () => false };
}

// ---------- Collection ----------

function sortOptions(type) {
  const name = type.list.sort.replace(/^-/, "");
  const field = type.fields.find((f) => f.name === name);
  const options = field.type === "date"
    ? [{ value: `-${name}`, text: "Newest first" }, { value: name, text: "Oldest first" }]
    : [{ value: `-${name}`, text: `${field.label}, descending` }, { value: name, text: `${field.label}, ascending` }];
  options.push({ value: type.list.title, text: "Title A–Z" });
  return options.filter((o, i) => options.findIndex((p) => p.value === o.value) === i);
}

function buildCreate(type) {
  const dialog = tpl("screen-create");
  fill(dialog, { text: { title: `New ${type.singular}` } });
  const titleField = type.fields.find((f) => f.name === type.list.title);
  const fields = [titleField, ...type.fields.filter((f) => f.type === "slug" && f.from === titleField.name)];
  const controls = new Map(fields.map((f) => [f.name, makeField(f, { prefix: `${type.id}-new`, files: adapters.files })]));
  slotChildren(dialog, "fields").append(...[...controls.values()].map((c) => c.el));
  const validation = createValidation({ root: dialog, fields, get: (name) => controls.get(name).get() });
  const defaults = Object.fromEntries(type.fields.filter((f) => f.default !== undefined).map((f) => [f.name, f.default]));
  const flow = createFlow({
    dialog,
    title: titleField.name,
    slug: fields[1]?.name ?? null,
    validation,
    read: () => Object.fromEntries([...controls].map(([name, c]) => [name, c.get()])),
    create: (values) => adapters.data.create(type.id, { status: firstStatus(type), values: { ...defaults, ...values } }),
    onCreated: (item) => (location.hash = `#/${type.id}/${encodeURIComponent(item.id)}`),
    onError: () => toast("Could not create. Try again.", "negative"),
  });
  return { dialog, flow, validation };
}

async function renderCollection(type, token) {
  const label = type.label.toLowerCase();
  const screen = tpl("screen-collection");
  fill(screen, {
    text: { title: type.label, "create-label": `New ${type.singular}`, "loading-text": "Loading…", "search-label": `Search ${label}`, "sort-label": "Sort by" },
    attrs: { "type-id": type.id, "search-placeholder": `Search ${label}` },
  });
  const sort = screen.querySelector("#pn-sort");
  repeat(sort, sortOptions(type), (unit, o) => fill(unit, { text: { text: o.text }, attrs: { value: o.value } }));
  sort.value = type.list.sort;
  const search = screen.querySelector("#pn-search");
  setState(screen, "loading");
  mount({ screen, crumbs: [HOME, { text: type.label, href: `#/${type.id}` }], nav: `#/${type.id}` });

  const create = buildCreate(type);
  slots.dialogs.append(create.dialog);
  screen.addEventListener("click", (event) => {
    const opener = event.target.closest('[data-action="create"]');
    if (opener) create.flow.open(opener);
  });
  const offKeys = installShortcuts({ search: () => search });
  current = {
    cleanup() {
      offKeys();
      create.validation.destroy();
      create.dialog.remove();
    },
    dirty: () => false,
  };

  let items;
  try {
    items = await adapters.data.list(type.id);
  } catch (error) {
    if (token !== renderToken || authFailure(error)) return;
    slotChildren(screen, "error").replaceChildren(block("error", { title: `Could not load ${label}`, text: "Check your connection and try again.", action: retryButton() }));
    return setState(screen, "error");
  }
  if (token !== renderToken) return;
  if (!items.length) {
    slotChildren(screen, "empty").replaceChildren(
      block("empty", { icon: "#pn-icon-file", title: `No ${label} yet`, text: `Create the first ${type.singular}.`, action: button(`New ${type.singular}`, { action: "create", variant: "primary" }) }),
    );
    return setState(screen, "empty");
  }

  function renderRows() {
    const query = search.value.trim().toLowerCase();
    const shown = sortItems(items, sort.value).filter(
      (item) => !query || type.list.search.some((name) => String(item.values?.[name] ?? "").toLowerCase().includes(query)),
    );
    repeat(slotRepeat(screen, "row"), shown, (unit, item) =>
      fill(unit, {
        text: { title: itemTitle(type, item), subtitle: itemSubtitle(type, item), status: item.status ? cap(item.status) : "" },
        attrs: { href: `#/${type.id}/${encodeURIComponent(item.id)}`, tone: tone(type, item.status) },
      }),
    );
  }
  search.addEventListener("input", renderRows);
  sort.addEventListener("change", renderRows);
  renderRows();
  setState(screen, "ready");
}

// ---------- Item and singleton forms ----------

// Builds every field of a type or singleton into a form, in schema order.
function buildForm(def, form, prefix) {
  const controls = new Map();
  const computed = new Set(def.fields.filter((f) => f.compute).map((f) => f.name));
  const values = () => Object.fromEntries([...controls].filter(([name]) => !computed.has(name)).map(([name, c]) => [name, c.get()]));
  const grid = form.querySelector('[data-slot-children="fields"]');
  for (const field of def.fields) {
    const control = makeField(field, { prefix, files: adapters.files, computed: COMPUTED, values, root: form });
    controls.set(field.name, control);
    grid.append(control.el);
  }
  return {
    controls,
    read: () => Object.fromEntries([...controls].map(([name, c]) => [name, c.get()])),
    write: (next) => {
      for (const [name, c] of controls) c.set(next?.[name]);
    },
  };
}

// Save errors: rethrown so the save bar enters `error` with every edit kept (build.md step 5).
function reportSaveError(error, saveState) {
  if (AUTH_ERRORS.has(error?.code)) toast(SIGNED_OUT, "negative");
  else if (error?.code === "conflict") setTimeout(() => saveState.say("Changed elsewhere. Copy your edits, then reload."));
  else if (error?.code === "invalid") console.error(error.message);
}

async function renderItem(type, id, token) {
  const singular = type.singular;
  const screen = tpl("screen-item");
  fill(screen, { text: { title: "Loading…", "loading-text": "Loading…", status: "" }, attrs: { "type-id": type.id } });
  setState(screen, "loading");
  const heading = screen.querySelector(".pn-screen-title");
  const statusButton = screen.querySelector('[data-action="status"]');
  statusButton.hidden = true;
  const typeCrumb = { text: type.label, href: `#/${type.id}` };
  const here = location.hash;
  const setTitle = (text) => {
    heading.textContent = text;
    renderHeader([HOME, typeCrumb, { text, href: here }]);
  };
  mount({ screen, crumbs: [HOME, typeCrumb, { text: "Loading…", href: here }], nav: `#/${type.id}` });

  let saveState = null;
  let validation = null;
  let drawer = null;
  const offKeys = installShortcuts({ save: () => saveState?.save() });
  current = {
    cleanup() {
      offKeys();
      saveState?.destroy();
      validation?.destroy();
      drawer?.remove();
    },
    dirty: () => saveState?.dirty ?? false,
  };

  let item;
  try {
    item = await adapters.data.get(type.id, id);
  } catch (error) {
    if (token !== renderToken || authFailure(error)) return;
    const missing = error?.code === "not-found";
    setTitle(missing ? "Not found" : "Could not load");
    slotChildren(screen, "error").replaceChildren(
      missing
        ? block("error", { title: `This ${singular} doesn't exist`, text: "It may have been deleted." })
        : block("error", { title: `Could not load this ${singular}`, text: "Check your connection and try again.", action: retryButton() }),
    );
    return setState(screen, "error");
  }
  if (token !== renderToken) return;

  const form = screen.querySelector("form");
  const { controls, read, write } = buildForm(type, form, type.id);
  write(item.values);
  validation = createValidation({ root: form, fields: type.fields, get: (name) => controls.get(name).get() });

  // behavior: Show word count under the body field
  const counted = type.wordCount && controls.get(type.wordCount);
  const showWordCount = () => counted && fill(counted.el, { text: { help: plural(countWords(counted.get()), "word", "words") } });
  form.addEventListener("input", showWordCount);
  showWordCount();

  const showMeta = () => fill(screen.querySelector(".pn-meta"), { text: { created: formatDate(item.createdAt), updated: formatDate(item.updatedAt) } });
  const showStatus = () => {
    if (!type.status) return;
    statusButton.hidden = false;
    fill(statusButton, { text: { status: cap(item.status) }, attrs: { tone: tone(type, item.status) } });
  };
  showMeta();
  showStatus();
  setTitle(itemTitle(type, item));

  const savebar = tpl("savebar");
  fill(savebar, { attrs: { "save-state": "clean" } });
  saveState = createSaveState({
    form,
    savebar,
    read,
    write,
    async save(values, extra) {
      try {
        item = await adapters.data.update(type.id, item.id, { status: extra?.status ?? item.status, values });
      } catch (error) {
        reportSaveError(error, saveState);
        throw error;
      }
      showMeta();
      setTitle(itemTitle(type, item));
    },
    validate(values, { background, extra }) {
      if (background) return validation.valid();
      const publishing = extra?.status !== undefined && extra.status !== firstStatus(type);
      return checkFields(publishing ? "publish" : "format");
    },
    // behavior: Autosave drafts every 10 seconds
    autosave: type.autosave
      ? { every: type.autosave.every, when: () => !type.autosave.drafts || item.status === firstStatus(type) }
      : undefined,
    onRevert() {
      validation.clear();
      showWordCount();
    },
  });
  slots.savebar.replaceChildren(savebar);

  // V3 and V4: show every error, focus the first, and say how many.
  function checkFields(mode) {
    const invalid = mode === "publish" ? validation.run("publish", type.publishRequires ?? []) : validation.run("format");
    if (!invalid.length) return true;
    saveState.say(fixMessage(invalid.length, mode === "publish" ? "publish" : "save"));
    validation.focus(invalid[0]);
    return false;
  }

  async function pickStatus(opener) {
    drawer = tpl("screen-slide-over");
    fill(drawer, { text: { title: "Status" } });
    const choices = document.createElement("fieldset");
    choices.className = "pn-choices";
    const legend = document.createElement("legend");
    legend.className = "pn-visually-hidden";
    legend.textContent = "Status";
    choices.append(legend);
    for (const status of type.status) {
      const label = document.createElement("label");
      label.className = "pn-choice";
      const radio = document.createElement("input");
      radio.className = "pn-radio";
      radio.type = "radio";
      radio.name = "pn-status";
      radio.value = status;
      radio.checked = status === item.status;
      label.append(radio, cap(status));
      choices.append(label);
    }
    slotChildren(drawer, "body").append(choices);
    slots.dialogs.append(drawer);
    const result = await openDialog(drawer, { opener });
    const picked = drawer.querySelector('input[name="pn-status"]:checked')?.value;
    drawer.remove();
    drawer = null;
    return result === "done" ? picked : null;
  }

  // P1 to P5
  let changing = false;
  statusButton.addEventListener("click", async () => {
    if (changing || saveState.state === "saving") return;
    changing = true;
    try {
      const list = type.status;
      const target = list.length === 2 ? list.find((s) => s !== item.status) : await pickStatus(statusButton);
      if (!target || target === item.status) return;
      const from = list.indexOf(item.status);
      const to = list.indexOf(target);
      if (to > 0 && !checkFields("publish")) return;
      // behavior: Publishing asks for confirmation
      if (from === 0 && to > 0 && type.confirmPublish) {
        const ok = await confirmDialog(confirmEl, { title: `Publish this ${singular}?`, text: "It will be visible on the site.", confirmLabel: cap(target), variant: "primary", opener: statusButton });
        if (!ok) return;
      }
      if (!(await saveState.save({ status: target }))) return;
      showStatus();
      toast(to > from ? `${cap(singular)} ${target}` : `${cap(singular)} moved to ${target}`, "positive");
    } finally {
      changing = false;
    }
  });

  screen.querySelector('[data-action="delete"]').addEventListener("click", async () => {
    const ok = await confirmDialog(confirmEl, { title: `Delete this ${singular}?`, text: "This can't be undone.", confirmLabel: "Delete", variant: "negative" });
    if (!ok) return;
    try {
      await adapters.data.remove(type.id, item.id);
    } catch {
      return toast("Could not delete. Try again.", "negative");
    }
    current.cleanup();
    current = idle;
    toast(`${cap(singular)} deleted`);
    location.hash = `#/${type.id}`;
  });

  setState(screen, "ready");
}

async function renderSingleton(singleton, token) {
  const screen = tpl("screen-singleton");
  fill(screen, { text: { title: singleton.label, "loading-text": "Loading…" }, attrs: { "singleton-id": singleton.id } });
  setState(screen, "loading");
  mount({ screen, crumbs: [HOME, { text: singleton.label, href: `#/${singleton.id}` }], nav: `#/${singleton.id}` });

  let saveState = null;
  let validation = null;
  const offKeys = installShortcuts({ save: () => saveState?.save() });
  current = {
    cleanup() {
      offKeys();
      saveState?.destroy();
      validation?.destroy();
    },
    dirty: () => saveState?.dirty ?? false,
  };

  let record;
  try {
    record = await adapters.data.getSingleton(singleton.id);
  } catch (error) {
    if (token !== renderToken || authFailure(error)) return;
    slotChildren(screen, "error").replaceChildren(
      block("error", { title: `Could not load ${singleton.label.toLowerCase()}`, text: "Check your connection and try again.", action: retryButton() }),
    );
    return setState(screen, "error");
  }
  if (token !== renderToken) return;

  const form = screen.querySelector("form");
  const { controls, read, write } = buildForm(singleton, form, singleton.id);
  write(record?.values ?? {});
  validation = createValidation({ root: form, fields: singleton.fields, get: (name) => controls.get(name).get() });

  const savebar = tpl("savebar");
  fill(savebar, { attrs: { "save-state": "clean" } });
  saveState = createSaveState({
    form,
    savebar,
    read,
    write,
    async save(values) {
      try {
        await adapters.data.saveSingleton(singleton.id, values);
      } catch (error) {
        reportSaveError(error, saveState);
        throw error;
      }
    },
    // V7: a singleton's save is blocked by empty required fields as well as format errors.
    validate() {
      const invalid = validation.run("required");
      if (!invalid.length) return true;
      saveState.say(fixMessage(invalid.length, "save"));
      validation.focus(invalid[0]);
      return false;
    },
    onRevert: () => validation.clear(),
  });
  slots.savebar.replaceChildren(savebar);
  setState(screen, "ready");
}

start();
