// Field Notes panel. Built from panel.yaml through panel.config.js; behavior per behavior-spec.md.

import { tpl, fill, repeat, slotRepeat, slotChildren } from "./snippets/templates.js";
import { makeField } from "./snippets/fields.js";
import { createSaveState } from "./snippets/save-state.js";
import { createValidation } from "./snippets/validation.js";
import { openDialog, confirmDialog } from "./snippets/dialogs.js";
import { installShortcuts } from "./snippets/keyboard.js";
import { createFlow } from "./snippets/create-flow.js";
import { showToast } from "./snippets/toast.js";
import { createMemoryAdapters } from "./adapters/memory.js";
import { createRequest, createHttpAdapters } from "./adapters/http.js";
import { createGoogleAuth } from "./adapters/auth.js";
import { PANEL } from "./panel.config.js";

// ---------- Adapters (build.md step 6) ----------

const params = new URLSearchParams(location.search);
const adapters = params.has("test") ? await createTestAdapters() : createRecipeAdapters();

async function createTestAdapters() {
  const memory = createMemoryAdapters(await (await fetch("./seed.json")).json());
  window.panelTest = memory.test;
  return memory;
}

function createRecipeAdapters() {
  const request = createRequest();
  const { data, files } = createHttpAdapters(request);
  return { data, files, auth: createGoogleAuth(request) };
}

const FORBIDDEN = "This account isn't allowed. Sign in with another one.";

// contracts.md: when any adapter throws unauthorized, show screen-login and keep unsaved edits.
function watched(adapter) {
  const out = {};
  for (const [name, fn] of Object.entries(adapter)) {
    out[name] = async (...args) => {
      try {
        return await fn(...args);
      } catch (error) {
        if (error?.code === "unauthorized") showLogin("");
        if (error?.code === "forbidden") showLogin(FORBIDDEN);
        throw error;
      }
    };
  }
  return out;
}

const data = watched(adapters.data);
const files = watched(adapters.files);
const auth = adapters.auth;

// ---------- Helpers ----------

const typeById = new Map(PANEL.types.map((t) => [t.id, t]));
const singletonById = new Map(PANEL.singletons.map((s) => [s.id, s]));
const fieldOf = (def, name) => def.fields.find((f) => f.name === name);
const lower = (text) => text.toLowerCase();
const cap = (text) => text.charAt(0).toUpperCase() + text.slice(1);
const RETRY_TEXT = "Check your connection and try again.";

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", ...(DATE_ONLY.test(value) ? { timeZone: "UTC" } : {}) });
}

const titleOf = (type, item) => item.values?.[type.list.title] || "Untitled";

function tone(type, status) {
  const index = type.status.indexOf(status);
  if (index === 0) return "neutral";
  if (index === type.status.length - 1) return "positive";
  return "notice";
}

function display(def, name, value) {
  const field = fieldOf(def, name);
  if (field?.type === "date") return formatDate(value);
  if (Array.isArray(value)) return value.join(", ");
  return value == null ? "" : String(value);
}

const words = (text) => (text ?? "").trim().split(/\s+/).filter(Boolean).length;

// reading_time describe: "Read-only. Estimated minutes to read, from the word count of body."
const readingMinutes = (values) => Math.max(1, Math.ceil(words(values.body) / 200));
const COMPUTED = {
  readingTime: { value: readingMinutes, display: (values) => `${readingMinutes(values)} min` },
};

// ---------- Frame ----------

const app = document.getElementById("app");
const layout = tpl("layout");
const region = (name) => slotChildren(layout, name);
const toasts = region("toasts");
const confirmEl = tpl("screen-dialog");
const slideOver = tpl("screen-slide-over");
region("dialogs").append(confirmEl, slideOver);

let user = null;
let loginEl = null;
let guard = null; // the current screen's save state
let cleanup = [];
let route = "#/";
let renderId = 0;
let navCurrent = null;

const normalize = (hash) => (hash === "" || hash === "#" ? "#/" : hash);
const isRoute = (hash) => hash.startsWith("#/");

installShortcuts({
  save: () => layout.isConnected && guard?.save(),
  search: () => (layout.isConnected ? layout.querySelector("#pn-search") : null),
});
window.addEventListener("hashchange", onHashChange);
document.addEventListener("click", onLinkClick, true);

if (isRoute(normalize(location.hash))) route = normalize(location.hash);
start();

async function start() {
  let session;
  try {
    session = await auth.session();
  } catch {
    return showSystemError();
  }
  if (!session) return showLogin("");
  user = session.user;
  render();
}

// ---------- Login ----------

function showLogin(message) {
  if (loginEl) return fill(loginEl, { text: { error: message } });
  loginEl = tpl("screen-login");
  fill(loginEl, { text: { title: PANEL.name, text: "Sign in to edit the site.", error: message } });
  if (layout.isConnected) layout.remove();
  app.replaceChildren(loginEl);
  document.title = `Sign in · ${PANEL.name}`;
  auth.renderMethods(slotChildren(loginEl, "methods"), {
    onSignedIn: signedIn,
    onError: (text) => loginEl && fill(loginEl, { text: { error: text } }),
  });
}

async function signedIn() {
  let session = null;
  try {
    session = await auth.session();
  } catch {
    session = null;
  }
  if (!session) return loginEl && fill(loginEl, { text: { error: "Could not sign in. Try again." } });
  user = session.user;
  loginEl.remove();
  loginEl = null;
  app.replaceChildren(layout);
  if (guard) renderNav(navCurrent); // unsaved edits are still in the form
  else render();
}

async function logout() {
  if (!(await leaveOk())) return;
  try {
    await auth.logout();
  } catch {
    return showToast(toasts, "Could not log out. Try again.", { tone: "negative" });
  }
  teardown();
  user = null;
  showLogin("");
}

// ---------- Routing (behavior-spec.md S9, K6) ----------

function go(hash) {
  if (normalize(location.hash) === hash) {
    route = hash;
    render();
  } else {
    location.hash = hash;
  }
}

const confirmDiscard = () =>
  confirmDialog(confirmEl, { title: "Discard unsaved changes?", text: "Your edits will be lost.", confirmLabel: "Discard", variant: "negative" });

async function leaveOk() {
  if (!guard?.dirty) return true;
  if (!(await confirmDiscard())) return false;
  teardown();
  return true;
}

function onLinkClick(event) {
  const link = event.target.closest?.('a[href^="#/"]');
  if (!link || !guard?.dirty || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  const target = link.getAttribute("href");
  leaveOk().then((ok) => ok && go(target));
}

async function onHashChange() {
  const hash = normalize(location.hash);
  if (!isRoute(hash) || hash === route) return;
  if (guard?.dirty) {
    history.replaceState(null, "", route);
    if (!(await leaveOk())) return;
    return go(hash);
  }
  route = hash;
  render();
}

function parse(hash) {
  const parts = hash.slice(2).split("/").filter(Boolean).map((p) => {
    try {
      return decodeURIComponent(p);
    } catch {
      return "";
    }
  });
  if (parts.length === 0) return { screen: "home" };
  const type = typeById.get(parts[0]);
  if (type && parts.length === 1) return { screen: "collection", type };
  if (type && parts.length === 2 && parts[1]) return { screen: "item", type, id: parts[1] };
  const singleton = singletonById.get(parts[0]);
  if (singleton && parts.length === 1) return { screen: "singleton", singleton };
  return { screen: "not-found" };
}

function teardown() {
  for (const fn of cleanup.splice(0)) fn();
  guard = null;
}

function render() {
  teardown();
  const id = ++renderId;
  if (!layout.isConnected) app.replaceChildren(layout);
  region("savebar").replaceChildren();
  const r = parse(route);
  const screens = { home: renderHome, collection: renderCollection, item: renderItem, singleton: renderSingleton, "not-found": renderNotFound };
  screens[r.screen]({ ...r, stale: () => id !== renderId || !layout.isConnected });
}

// ---------- Shell parts ----------

function renderNav(current) {
  navCurrent = current;
  const nav = tpl("nav");
  fill(nav, { text: { brand: PANEL.name } });
  const entries = [
    { text: "Home", href: "#/" },
    ...PANEL.types.map((t) => ({ text: t.label, href: `#/${t.id}` })),
    ...PANEL.singletons.map((s) => ({ text: s.label, href: `#/${s.id}` })),
  ];
  repeat(slotRepeat(nav, "entry"), entries, (unit, e) =>
    fill(unit, { text: { text: e.text }, attrs: { href: e.href, current: e.href === current ? "page" : "false" } }),
  );
  if (user) {
    const account = tpl("account");
    fill(account, { text: { user } });
    account.querySelector('[data-action="logout"]').addEventListener("click", logout);
    slotChildren(nav, "account").append(account);
  }
  region("nav").replaceChildren(nav);
}

function renderHeader(crumbs) {
  const header = tpl("header");
  repeat(slotRepeat(header, "crumb"), crumbs, (unit, c, i) =>
    fill(unit, { text: { text: c.text }, attrs: { href: c.href, current: i === crumbs.length - 1 ? "page" : "false" } }),
  );
  region("header").replaceChildren(header);
  document.title = `${crumbs[crumbs.length - 1].text} · ${PANEL.name}`;
}

const mount = (screen) => region("screen").replaceChildren(screen);
const setState = (screen, state) => fill(screen, { attrs: { state } });

function button(text, { action, variant, onClick }) {
  const el = document.createElement("button");
  el.className = "pn-button";
  el.type = "button";
  if (variant) el.dataset.variant = variant;
  if (action) el.dataset.action = action;
  el.textContent = text;
  el.addEventListener("click", onClick);
  return el;
}

function errorBox(title, text, action) {
  const el = tpl("error");
  fill(el, { text: { title, text } });
  if (action) slotChildren(el, "actions").append(action);
  return el;
}

const retryButton = () => button("Try again", { action: "retry", onClick: () => render() });

function showSystemError() {
  if (!layout.isConnected) app.replaceChildren(layout);
  renderNav(null);
  renderHeader([{ text: "Home", href: "#/" }]);
  mount(errorBox("Could not load the panel", RETRY_TEXT, button("Try again", { action: "retry", onClick: () => start() })));
}

// ---------- Home ----------

async function renderHome({ stale }) {
  renderNav("#/");
  renderHeader([{ text: "Home", href: "#/" }]);
  const screen = tpl("screen-home");
  fill(screen, {
    text: { title: PANEL.name, "loading-text": "Loading…", "content-heading": "Content", "recent-heading": "Recently edited" },
    attrs: { state: "loading" },
  });
  mount(screen);
  try {
    const lists = await Promise.all(PANEL.types.map((t) => data.list(t.id)));
    if (stale()) return;
    const entries = [
      ...PANEL.types.map((t, i) => ({
        title: t.label,
        subtitle: `${lists[i].length} ${lists[i].length === 1 ? t.singular : lower(t.label)}`,
        href: `#/${t.id}`,
      })),
      ...PANEL.singletons.map((s) => ({ title: s.label, subtitle: "Page", href: `#/${s.id}` })),
    ];
    repeat(slotRepeat(screen, "entry"), entries, (unit, e) =>
      fill(unit, { text: { title: e.title, subtitle: e.subtitle, meta: "" }, attrs: { href: e.href } }),
    );
    const recent = lists
      .flatMap((items, i) => items.map((item) => ({ item, type: PANEL.types[i] })))
      .sort((a, b) => String(b.item.updatedAt).localeCompare(String(a.item.updatedAt)))
      .slice(0, 5);
    repeat(slotRepeat(screen, "recent"), recent, (unit, { item, type }) =>
      fill(unit, {
        text: { title: titleOf(type, item), subtitle: type.label, meta: formatDate(item.updatedAt) },
        attrs: { href: `#/${type.id}/${encodeURIComponent(item.id)}` },
      }),
    );
    setState(screen, "ready");
  } catch {
    if (stale()) return;
    slotChildren(screen, "error").replaceChildren(errorBox("Could not load the panel", RETRY_TEXT, retryButton()));
    setState(screen, "error");
  }
}

function renderNotFound() {
  renderNav(null);
  renderHeader([
    { text: "Home", href: "#/" },
    { text: "Not found", href: route },
  ]);
  const screen = tpl("screen-home");
  fill(screen, { text: { title: "Not found", "loading-text": "Loading…" }, attrs: { state: "error" } });
  repeat(slotRepeat(screen, "entry"), [], () => {});
  repeat(slotRepeat(screen, "recent"), [], () => {});
  slotChildren(screen, "error").append(
    errorBox("This page doesn't exist", "Check the address, or go back home.", button("Try again", { action: "retry", onClick: () => go("#/") })),
  );
  mount(screen);
}

// ---------- Collection ----------

function sortOptions(type) {
  const options = [];
  const key = type.list.sort;
  if (key) {
    const name = key.replace(/^-/, "");
    const field = fieldOf(type, name);
    const isDate = field.type === "date";
    options.push({ value: `-${name}`, text: isDate ? "Newest first" : `${field.label}, descending` });
    options.push({ value: name, text: isDate ? "Oldest first" : `${field.label}, ascending` });
  }
  options.push({ value: type.list.title, text: "Title A–Z" });
  return options;
}

function sortItems(items, key) {
  const desc = key.startsWith("-");
  const name = key.replace(/^-/, "");
  const empty = (v) => v === undefined || v === null || v === "";
  return [...items].sort((a, b) => {
    const x = a.values?.[name];
    const y = b.values?.[name];
    if (empty(x) || empty(y)) return empty(x) - empty(y);
    const order = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), undefined, { sensitivity: "base" });
    return desc ? -order : order;
  });
}

function setupCreate(type) {
  const dialog = tpl("screen-create");
  fill(dialog, { text: { title: `New ${type.singular}` } });
  const titleField = fieldOf(type, type.list.title);
  const slugField = type.fields.find((f) => f.type === "slug" && f.from === titleField.name);
  const fields = [titleField, slugField].filter(Boolean);
  const controls = fields.map((f) => makeField(f, { prefix: `${type.id}-new`, files }));
  slotChildren(dialog, "fields").append(...controls.map((c) => c.el));
  region("dialogs").append(dialog);
  cleanup.push(() => dialog.remove());
  const get = (name) => controls.find((c) => c.field.name === name).get();
  const validation = createValidation({ root: dialog, fields, get });
  cleanup.push(() => validation.destroy());
  const defaults = Object.fromEntries(type.fields.filter((f) => "default" in f).map((f) => [f.name, f.default]));
  return createFlow({
    dialog,
    title: titleField.name,
    slug: slugField?.name ?? null,
    validation,
    read: () => Object.fromEntries(controls.map((c) => [c.field.name, c.get()])),
    create: (values) => data.create(type.id, { status: type.status?.[0], values: { ...defaults, ...values } }),
    onCreated: (item) => go(`#/${type.id}/${encodeURIComponent(item.id)}`),
    onError: () => showToast(toasts, "Could not create. Try again.", { tone: "negative" }),
  });
}

async function renderCollection({ type, stale }) {
  const href = `#/${type.id}`;
  const label = lower(type.label);
  renderNav(href);
  renderHeader([
    { text: "Home", href: "#/" },
    { text: type.label, href },
  ]);
  const screen = tpl("screen-collection");
  fill(screen, {
    text: { title: type.label, "create-label": `New ${type.singular}`, "loading-text": "Loading…", "search-label": `Search ${label}`, "sort-label": "Sort by" },
    attrs: { state: "loading", "type-id": type.id, "search-placeholder": `Search ${label}` },
  });
  const search = screen.querySelector("#pn-search");
  const sort = screen.querySelector("#pn-sort");
  repeat(sort, sortOptions(type), (unit, o) => fill(unit, { text: { text: o.text }, attrs: { value: o.value } }));
  sort.value = type.list.sort ?? type.list.title;
  mount(screen);

  const flow = setupCreate(type);
  screen.querySelector('.pn-screen-header [data-action="create"]').addEventListener("click", (event) => flow.open(event.currentTarget));

  let items = [];
  function draw() {
    const query = search.value.trim().toLowerCase();
    const shown = sortItems(items, sort.value).filter(
      (item) => !query || (type.list.search ?? []).some((name) => display(type, name, item.values?.[name]).toLowerCase().includes(query)),
    );
    repeat(slotRepeat(screen, "row"), shown, (unit, item) =>
      fill(unit, {
        text: {
          title: titleOf(type, item),
          subtitle: type.list.subtitle ? display(type, type.list.subtitle, item.values?.[type.list.subtitle]) : "",
          status: item.status ? cap(item.status) : "",
        },
        attrs: { href: `#/${type.id}/${encodeURIComponent(item.id)}`, tone: item.status ? tone(type, item.status) : "" },
      }),
    );
  }
  search.addEventListener("input", draw);
  sort.addEventListener("change", draw);

  try {
    items = await data.list(type.id);
    if (stale()) return;
    if (!items.length) {
      const empty = tpl("empty");
      fill(empty, { text: { title: `No ${label} yet`, text: `Create the first ${type.singular}.` }, attrs: { icon: "#pn-icon-file" } });
      slotChildren(empty, "actions").append(
        button(`New ${type.singular}`, { action: "create", variant: "primary", onClick: (event) => flow.open(event.currentTarget) }),
      );
      slotChildren(screen, "empty").replaceChildren(empty);
      setState(screen, "empty");
    } else {
      draw();
      setState(screen, "ready");
    }
  } catch {
    if (stale()) return;
    slotChildren(screen, "error").replaceChildren(errorBox(`Could not load ${label}`, RETRY_TEXT, retryButton()));
    setState(screen, "error");
  }
}

// ---------- Forms (item and singleton) ----------

function buildForm({ def, prefix, form, values, save, autosave }) {
  // A form with one single-line input submits on Enter, which would reload the page and drop edits.
  form.addEventListener("submit", (event) => event.preventDefault());
  let controls = [];
  const sourceValues = () => Object.fromEntries(controls.filter((c) => c.field.type !== "custom").map((c) => [c.field.name, c.get()]));
  controls = def.fields.map((field) => {
    let control;
    const ctx = {
      prefix,
      computed: COMPUTED,
      values: sourceValues,
      root: form,
      files: {
        async upload(file) {
          try {
            return await files.upload(file);
          } catch (error) {
            // contracts.md: too-large shows "That file is too large." in the field's error.
            if (error?.code === "too-large") setTimeout(() => (control.el.querySelector(".pn-error").textContent = "That file is too large."));
            throw error;
          }
        },
      },
    };
    control = makeField(field, ctx);
    return control;
  });
  slotChildren(form, "fields").append(...controls.map((c) => c.el));
  const byName = new Map(controls.map((c) => [c.field.name, c]));

  // behavior: Show word count under the body field
  const counted = def.wordCount ? byName.get(def.wordCount) : null;
  const showWordCount = () => {
    if (!counted) return;
    const n = words(counted.get());
    fill(counted.el, { text: { help: `${n} ${n === 1 ? "word" : "words"}` } });
  };
  if (counted) form.addEventListener("input", showWordCount);

  const read = () => Object.fromEntries(controls.map((c) => [c.field.name, c.get()]));
  const write = (next) => {
    for (const c of controls) c.set(next?.[c.field.name]);
    showWordCount();
  };
  write(values);

  const validation = createValidation({ root: form, fields: def.fields, get: (name) => byName.get(name).get() });

  const savebar = tpl("savebar");
  fill(savebar, { attrs: { "save-state": "clean" } });
  region("savebar").replaceChildren(savebar);

  const saveState = createSaveState({
    form,
    savebar,
    read,
    write,
    save,
    validate: (_values, { background }) => {
      if (background) return validation.valid();
      const invalid = validation.run("format");
      if (invalid.length) validation.focus(invalid[0]);
      return invalid.length === 0;
    },
    autosave,
    onRevert: () => validation.clear(),
  });
  guard = saveState;
  cleanup.push(() => saveState.destroy(), () => validation.destroy());
  return { saveState, validation, read };
}

// ---------- Item ----------

async function renderItem({ type, id, stale }) {
  const listHref = `#/${type.id}`;
  const crumbs = (last) => [
    { text: "Home", href: "#/" },
    { text: type.label, href: listHref },
    { text: last, href: route },
  ];
  renderNav(listHref);
  renderHeader(crumbs("Loading…"));
  const screen = tpl("screen-item");
  fill(screen, { text: { title: "Loading…", "loading-text": "Loading…" }, attrs: { state: "loading", "type-id": type.id } });
  const statusButton = screen.querySelector('[data-action="status"]');
  if (!type.status) statusButton.hidden = true;
  mount(screen);

  let item;
  try {
    item = await data.get(type.id, id);
  } catch (error) {
    if (stale()) return;
    if (error?.code === "not-found") {
      renderHeader(crumbs("Not found"));
      fill(screen, { text: { title: "Not found" } });
      slotChildren(screen, "error").replaceChildren(errorBox(`This ${type.singular} doesn't exist`, "It may have been deleted."));
    } else {
      fill(screen, { text: { title: cap(type.singular) } });
      slotChildren(screen, "error").replaceChildren(errorBox(`Could not load this ${type.singular}`, RETRY_TEXT, retryButton()));
    }
    statusButton.hidden = true;
    return setState(screen, "error");
  }
  if (stale()) return;

  const form = screen.querySelector("form.pn-item");
  const deleteButton = form.querySelector('[data-action="delete"]');

  function showItem() {
    const title = titleOf(type, item);
    renderHeader(crumbs(title));
    fill(screen, {
      text: { title, status: item.status ? cap(item.status) : "", created: formatDate(item.createdAt), updated: formatDate(item.updatedAt) },
      attrs: { tone: item.status ? tone(type, item.status) : "" },
    });
  }
  showItem();

  const first = type.status?.[0];
  const { saveState, validation } = buildForm({
    def: type,
    prefix: type.id,
    form,
    values: item.values,
    async save(values, extra) {
      deleteButton.disabled = false; // S3: Delete stays enabled while saving
      const status = extra?.status ?? item.status;
      try {
        item = await data.update(type.id, item.id, { status, values });
      } catch (error) {
        if (error?.code === "conflict") saveState.say("Changed elsewhere. Copy your edits, then reload.");
        if (error?.code === "invalid") console.error(error);
        throw error;
      }
      if (!stale()) showItem();
    },
    // behavior: Autosave drafts every 10 seconds
    autosave: type.autosave ? { every: type.autosave.every, when: () => !type.autosave.drafts || item.status === first } : undefined,
  });

  // Status (behavior-spec.md P1–P5)
  statusButton.addEventListener("click", async () => {
    const list = type.status;
    const next = list.length === 2 ? list.find((s) => s !== item.status) : await pickStatus(type, item.status, statusButton);
    if (!next || next === item.status) return;
    if (list.indexOf(next) > 0) {
      const invalid = validation.run("publish", type.publishRequires ?? []);
      if (invalid.length) {
        validation.focus(invalid[0]);
        saveState.say(`Fix ${invalid.length} ${invalid.length === 1 ? "field" : "fields"} to publish`);
        return;
      }
    }
    // behavior: Publishing asks for confirmation
    if (item.status === first && type.confirmPublish) {
      const ok = await confirmDialog(confirmEl, {
        title: `Publish this ${type.singular}?`,
        text: "It will be visible on the site.",
        confirmLabel: cap(next),
        opener: statusButton,
      });
      if (!ok) return;
    }
    const forward = list.indexOf(next) > list.indexOf(item.status);
    if (await saveState.save({ status: next })) {
      const name = cap(type.singular);
      showToast(toasts, forward ? `${name} ${next}` : `${name} moved to ${next}`);
    }
  });

  deleteButton.addEventListener("click", async () => {
    const ok = await confirmDialog(confirmEl, {
      title: `Delete this ${type.singular}?`,
      text: "This can't be undone.",
      confirmLabel: "Delete",
      variant: "negative",
      opener: deleteButton,
    });
    if (!ok) return;
    try {
      await data.remove(type.id, item.id);
    } catch {
      return showToast(toasts, "Could not delete. Try again.", { tone: "negative" });
    }
    showToast(toasts, `${cap(type.singular)} deleted`);
    teardown();
    go(listHref);
  });

  setState(screen, "ready");
}

async function pickStatus(type, current, opener) {
  fill(slideOver, { text: { title: "Status" } });
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
    input.checked = status === current;
    label.append(input, cap(status));
    set.append(label);
  }
  slotChildren(slideOver, "body").replaceChildren(set);
  const result = await openDialog(slideOver, { opener });
  return result === "done" ? set.querySelector("input:checked")?.value : null;
}

// ---------- Singleton ----------

async function renderSingleton({ singleton, stale }) {
  const href = `#/${singleton.id}`;
  renderNav(href);
  renderHeader([
    { text: "Home", href: "#/" },
    { text: singleton.label, href },
  ]);
  const screen = tpl("screen-singleton");
  fill(screen, { text: { title: singleton.label, "loading-text": "Loading…" }, attrs: { state: "loading", "singleton-id": singleton.id } });
  mount(screen);
  let record;
  try {
    record = await data.getSingleton(singleton.id);
  } catch {
    if (stale()) return;
    slotChildren(screen, "error").replaceChildren(errorBox(`Could not load ${lower(singleton.label)}`, RETRY_TEXT, retryButton()));
    return setState(screen, "error");
  }
  if (stale()) return;
  const form = screen.querySelector("form.pn-item");
  buildForm({
    def: singleton,
    prefix: singleton.id,
    form,
    values: record?.values ?? {},
    async save(values) {
      try {
        await data.saveSingleton(singleton.id, values);
      } catch (error) {
        if (error?.code === "invalid") console.error(error);
        throw error;
      }
    },
  });
  setState(screen, "ready");
}
