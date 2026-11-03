// Field Notes panel: routes, screens, and adapter wiring (build.md steps 3-6).

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

const app = document.getElementById("app");

function createRecipeAdapters() {
  const request = createRequest();
  const { data, files } = createHttpAdapters(request);
  return { data, files, auth: createGoogleAuth(request) };
}

const idle = { cleanup() {}, dirty: () => false };
let current = idle;
let layout = null;
let nav = null;
let header = null;
let confirmEl = null;
let toasts = null;
let user = null;
let routeToken = 0;

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

const capital = (text) => text.charAt(0).toUpperCase() + text.slice(1);
const isAuthError = (error) => error?.code === "unauthorized" || error?.code === "forbidden";
const toast = (text, tone = "info") => toasts && showToast(toasts, text, { tone });
const SIGNED_OUT = "You were signed out. Copy your edits, then reload to sign in.";
const NOT_ALLOWED = "This account isn't allowed. Sign in with another one.";

function formatDate(value) {
  if (!value) return "";
  const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const date = day ? new Date(Number(day[1]), Number(day[2]) - 1, Number(day[3])) : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function display(field, value) {
  if (value === null || value === undefined) return "";
  if (field?.type === "date") return formatDate(value);
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") return value.name ?? "";
  return String(value);
}

function tone(type, status) {
  const index = type.status.indexOf(status);
  if (index <= 0) return "neutral";
  return index === type.status.length - 1 ? "positive" : "notice";
}

const titleOf = (type, values) => (values?.[type.list.title] ? String(values[type.list.title]) : "Untitled");
const fieldOf = (def, name) => def.fields.find((f) => f.name === name);

function button(text, { variant, action } = {}) {
  const el = document.createElement("button");
  el.className = "pn-button";
  el.type = "button";
  if (variant) el.dataset.variant = variant;
  if (action) el.dataset.action = action;
  el.textContent = text;
  return el;
}

function words(text) {
  return String(text ?? "").trim().split(/\s+/).filter(Boolean).length;
}

// describe: "Read-only. Estimated minutes to read, from the word count of body."
const computed = {
  readingTime: {
    value: (values) => Math.max(1, Math.ceil(words(values.body) / 200)),
    display: (values) => `${Math.max(1, Math.ceil(words(values.body) / 200))} min`,
  },
};

// ---------- shell ----------

function mountLayout() {
  layout = tpl("layout");
  nav = tpl("nav");
  fill(nav, { text: { brand: PANEL.name } });
  repeat(slotRepeat(nav, "entry"), [], () => {});
  const account = tpl("account");
  fill(account, { text: { user } });
  account.querySelector('[data-action="logout"]').addEventListener("click", logout);
  slotChildren(nav, "account").append(account);
  slotChildren(layout, "nav").append(nav);
  header = tpl("header");
  repeat(slotRepeat(header, "crumb"), [], () => {});
  slotChildren(layout, "header").append(header);
  confirmEl = tpl("screen-dialog");
  slotChildren(layout, "dialogs").append(confirmEl);
  toasts = slotChildren(layout, "toasts");
  app.replaceChildren(layout);
}

function renderNav(currentId) {
  const entries = [
    { id: "", text: "Home", href: "#/" },
    ...PANEL.types.map((t) => ({ id: t.id, text: t.label, href: `#/${t.id}` })),
    ...PANEL.singletons.map((s) => ({ id: s.id, text: s.label, href: `#/${s.id}` })),
  ];
  repeat(slotRepeat(nav, "entry"), entries, (unit, e) =>
    fill(unit, { text: { text: e.text }, attrs: { href: e.href, current: e.id === currentId ? "page" : "false" } }),
  );
}

function setCrumbs(crumbs) {
  repeat(slotRepeat(header, "crumb"), crumbs, (unit, c, i) =>
    fill(unit, { text: { text: c.text }, attrs: { href: c.href, current: i === crumbs.length - 1 ? "page" : "false" } }),
  );
  document.title = `${crumbs.at(-1).text} · ${PANEL.name}`;
}

function mountScreen(screen, savebar = null) {
  slotChildren(layout, "screen").replaceChildren(screen);
  slotChildren(layout, "savebar").replaceChildren(...(savebar ? [savebar] : []));
}

const setState = (screen, state) => fill(screen, { attrs: { state } });

function showError(screen, { title, text, retry }) {
  const error = tpl("error");
  fill(error, { text: { title, text } });
  if (retry) {
    const again = button("Try again", { action: "retry" });
    again.addEventListener("click", retry);
    slotChildren(error, "actions").append(again);
  }
  slotChildren(screen, "error").replaceChildren(error);
  setState(screen, "error");
}

const discard = (opener) =>
  confirmDialog(confirmEl, { title: "Discard unsaved changes?", text: "Your edits will be lost.", confirmLabel: "Discard", variant: "negative", opener });

// ---------- login ----------

function showLogin({ unreachable = false, message = "" } = {}) {
  current.cleanup();
  current = idle;
  layout = nav = header = confirmEl = toasts = null;
  lastHash = location.hash;
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

function loadFailed(error) {
  if (!isAuthError(error)) return false;
  showLogin({ message: error.code === "forbidden" ? NOT_ALLOWED : "" });
  return true;
}

async function logout(event) {
  const opener = event.currentTarget;
  if (current.dirty() && !(await discard(opener))) return;
  try {
    await adapters.auth.logout();
  } catch {
    toast("Could not log out. Try again.", "negative");
    return;
  }
  user = null;
  showLogin();
}

async function start() {
  let session;
  try {
    session = await adapters.auth.session();
  } catch {
    return showLogin({ unreachable: true });
  }
  if (!session?.user) return showLogin();
  user = session.user;
  mountLayout();
  route();
}

// ---------- routing ----------

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

function route() {
  if (!layout) return start();
  lastHash = location.hash;
  const token = ++routeToken;
  const stale = () => token !== routeToken;
  const hash = location.hash.startsWith("#/") ? location.hash.slice(2) : "";
  let parts;
  try {
    parts = hash.split("/").filter(Boolean).map(decodeURIComponent);
  } catch {
    parts = [null];
  }
  const type = PANEL.types.find((t) => t.id === parts[0]);
  const singleton = PANEL.singletons.find((s) => s.id === parts[0]);
  if (parts.length === 0) return renderHome(stale);
  if (type && parts.length === 1) return renderCollection(type, stale);
  if (type && parts.length === 2) return renderItem(type, parts[1], stale);
  if (singleton && parts.length === 1) return renderSingleton(singleton, stale);
  return renderNotFound();
}

// ---------- home ----------

async function renderHome(stale) {
  const screen = tpl("screen-home");
  fill(screen, {
    text: { title: PANEL.name, "loading-text": "Loading…", "content-heading": "Content", "recent-heading": "Recently edited" },
    attrs: { state: "loading" },
  });
  repeat(slotRepeat(screen, "entry"), [], () => {});
  repeat(slotRepeat(screen, "recent"), [], () => {});
  mountScreen(screen);
  renderNav("");
  setCrumbs([{ text: "Home", href: "#/" }]);
  const off = installShortcuts({});
  current = { cleanup: off, dirty: () => false };
  try {
    const lists = await Promise.all(PANEL.types.map((t) => adapters.data.list(t.id)));
    if (stale()) return;
    const entries = [
      ...PANEL.types.map((t, i) => ({
        title: t.label,
        subtitle: `${lists[i].length} ${lists[i].length === 1 ? t.singular : t.label.toLowerCase()}`,
        href: `#/${t.id}`,
      })),
      ...PANEL.singletons.map((s) => ({ title: s.label, subtitle: "Page", href: `#/${s.id}` })),
    ];
    const recent = PANEL.types
      .flatMap((t, i) => lists[i].map((item) => ({ type: t, item })))
      .sort((a, b) => String(b.item.updatedAt).localeCompare(String(a.item.updatedAt)))
      .slice(0, 5);
    repeat(slotRepeat(screen, "entry"), entries, (unit, e) =>
      fill(unit, { text: { title: e.title, subtitle: e.subtitle, meta: "" }, attrs: { href: e.href } }),
    );
    repeat(slotRepeat(screen, "recent"), recent, (unit, { type, item }) =>
      fill(unit, {
        text: { title: titleOf(type, item.values), subtitle: type.label, meta: formatDate(item.updatedAt) },
        attrs: { href: `#/${type.id}/${encodeURIComponent(item.id)}` },
      }),
    );
    setState(screen, "ready");
  } catch (error) {
    if (stale() || loadFailed(error)) return;
    showError(screen, { title: "Could not load the panel", text: "Check your connection and try again.", retry: () => rerun() });
  }
}

function rerun() {
  current.cleanup();
  route();
}

// ---------- not found ----------

function renderNotFound() {
  const screen = tpl("screen-home");
  fill(screen, { text: { title: "Not found" }, attrs: { state: "loading" } });
  repeat(slotRepeat(screen, "entry"), [], () => {});
  repeat(slotRepeat(screen, "recent"), [], () => {});
  mountScreen(screen);
  renderNav(null);
  setCrumbs([
    { text: "Home", href: "#/" },
    { text: "Not found", href: location.hash },
  ]);
  const off = installShortcuts({});
  current = { cleanup: off, dirty: () => false };
  showError(screen, {
    title: "This page doesn't exist",
    text: "Check the address, or go back home.",
    retry: () => (location.hash = "#/"),
  });
}

// ---------- collection ----------

function sortOptions(type) {
  const name = type.list.sort.replace(/^-/, "");
  const field = fieldOf(type, name);
  const isDate = field?.type === "date";
  const options = [
    { value: `-${name}`, text: isDate ? "Newest first" : `${field.label}, descending` },
    { value: name, text: isDate ? "Oldest first" : `${field.label}, ascending` },
    { value: type.list.title, text: "Title A–Z" },
  ];
  return options.filter((o, i) => options.findIndex((p) => p.value === o.value) === i);
}

function compare(a, b) {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), undefined, { sensitivity: "base", numeric: true });
}

function sortItems(items, key) {
  const desc = key.startsWith("-");
  const name = key.replace(/^-/, "");
  const blank = (v) => v === null || v === undefined || v === "" || (Array.isArray(v) && !v.length);
  return [...items].sort((x, y) => {
    const a = x.values?.[name];
    const b = y.values?.[name];
    if (blank(a) || blank(b)) return blank(a) - blank(b);
    return desc ? compare(b, a) : compare(a, b);
  });
}

async function renderCollection(type, stale) {
  const lower = type.label.toLowerCase();
  const screen = tpl("screen-collection");
  fill(screen, {
    text: {
      title: type.label,
      "create-label": `New ${type.singular}`,
      "loading-text": "Loading…",
      "search-label": `Search ${lower}`,
      "sort-label": "Sort by",
    },
    attrs: { state: "loading", "type-id": type.id, "search-placeholder": `Search ${lower}` },
  });
  const search = screen.querySelector("#pn-search");
  const sort = screen.querySelector("#pn-sort");
  const rows = slotRepeat(screen, "row");
  repeat(sort, sortOptions(type), (unit, o) => fill(unit, { text: { text: o.text }, attrs: { value: o.value } }));
  sort.value = type.list.sort;
  repeat(rows, [], () => {});
  mountScreen(screen);
  renderNav(type.id);
  setCrumbs([
    { text: "Home", href: "#/" },
    { text: type.label, href: `#/${type.id}` },
  ]);

  let createDialog = null;
  const off = installShortcuts({ search: () => (screen.dataset.state === "ready" ? search : null) });
  current = {
    cleanup() {
      off();
      createDialog?.remove();
    },
    dirty: () => false,
  };

  async function openCreate(event) {
    if (createDialog) return;
    const opener = event.currentTarget;
    const titleField = fieldOf(type, type.list.title);
    const slugField = type.fields.find((f) => f.type === "slug" && f.from === type.list.title);
    const defs = [titleField, ...(slugField ? [slugField] : [])];
    const dialog = (createDialog = tpl("screen-create"));
    fill(dialog, { text: { title: `New ${type.singular}` } });
    const controls = defs.map((f) => makeField(f, { prefix: `${type.id}-new`, files: adapters.files }));
    slotChildren(dialog, "fields").append(...controls.map((c) => c.el));
    slotChildren(layout, "dialogs").append(dialog);
    const get = (name) => controls.find((c) => c.field.name === name).get();
    const validation = createValidation({ root: dialog, fields: defs, get });
    const defaults = Object.fromEntries(type.fields.filter((f) => "default" in f).map((f) => [f.name, f.default]));
    const flow = createFlow({
      dialog,
      title: type.list.title,
      slug: slugField?.name ?? null,
      validation,
      read: () => Object.fromEntries(controls.map((c) => [c.field.name, c.get()])),
      create: (values) => adapters.data.create(type.id, { status: type.status?.[0], values: { ...defaults, ...values } }),
      onCreated: (item) => (location.hash = `#/${type.id}/${encodeURIComponent(item.id)}`),
      onError: () => toast("Could not create. Try again.", "negative"),
    });
    await flow.open(opener);
    validation.destroy();
    dialog.remove();
    if (createDialog === dialog) createDialog = null;
  }
  screen.querySelector('.pn-screen-actions [data-action="create"]').addEventListener("click", openCreate);

  let items;
  try {
    items = await adapters.data.list(type.id);
  } catch (error) {
    if (stale() || loadFailed(error)) return;
    return showError(screen, { title: `Could not load ${lower}`, text: "Check your connection and try again.", retry: () => rerun() });
  }
  if (stale()) return;

  if (!items.length) {
    const empty = tpl("empty");
    fill(empty, { text: { title: `No ${lower} yet`, text: `Create the first ${type.singular}.` }, attrs: { icon: "#pn-icon-file" } });
    const add = button(`New ${type.singular}`, { variant: "primary", action: "create" });
    add.addEventListener("click", openCreate);
    slotChildren(empty, "actions").append(add);
    slotChildren(screen, "empty").replaceChildren(empty);
    return setState(screen, "empty");
  }

  const subtitleField = fieldOf(type, type.list.subtitle);
  function renderRows() {
    const query = search.value.trim().toLowerCase();
    const shown = sortItems(
      items.filter((item) => !query || (type.list.search ?? []).some((name) => display(fieldOf(type, name), item.values?.[name]).toLowerCase().includes(query))),
      sort.value,
    );
    repeat(rows, shown, (unit, item) =>
      fill(unit, {
        text: {
          title: titleOf(type, item.values),
          subtitle: type.list.subtitle ? display(subtitleField, item.values?.[type.list.subtitle]) : "",
          status: type.status ? capital(item.status) : "",
        },
        attrs: { href: `#/${type.id}/${encodeURIComponent(item.id)}`, tone: type.status ? tone(type, item.status) : "" },
      }),
    );
  }
  search.addEventListener("input", renderRows);
  sort.addEventListener("change", renderRows);
  renderRows();
  setState(screen, "ready");
}

// ---------- shared form wiring ----------

function buildFields(def, form, prefix) {
  const controls = [];
  const values = () => Object.fromEntries(controls.filter((c) => !c.field.compute).map((c) => [c.field.name, c.get()]));
  for (const field of def.fields) {
    const control = makeField(field, { prefix, files: adapters.files, computed, values, root: form });
    controls.push(control);
  }
  slotChildren(form, "fields").append(...controls.map((c) => c.el));
  return {
    controls,
    read: () => Object.fromEntries(controls.map((c) => [c.field.name, c.get()])),
    write: (v) => controls.forEach((c) => c.set(v?.[c.field.name] ?? null)),
    get: (name) => controls.find((c) => c.field.name === name)?.get(),
  };
}

// behavior: "Show word count under the body field"
function wordCount(form, name) {
  const field = form.querySelector(`[data-field="${name}"]`);
  const input = field.querySelector("textarea, input");
  const help = field.querySelector(".pn-help");
  const update = () => {
    const n = words(input.value);
    help.textContent = `${n} ${n === 1 ? "word" : "words"}`;
  };
  input.addEventListener("input", update);
  update();
  return update;
}

function saveErrorMessage(error) {
  return error?.code === "conflict" ? "Changed elsewhere. Copy your edits, then reload." : null;
}

function signedOutOnSave(error) {
  if (isAuthError(error)) toast(SIGNED_OUT, "negative");
  throw error;
}

// ---------- item ----------

async function renderItem(type, id, stale) {
  const singularCap = capital(type.singular);
  const screen = tpl("screen-item");
  fill(screen, { text: { title: "Loading…", "loading-text": "Loading…" }, attrs: { state: "loading", "type-id": type.id } });
  const statusButton = screen.querySelector('[data-action="status"]');
  if (!type.status) statusButton.hidden = true;
  mountScreen(screen);
  renderNav(type.id);
  const crumbs = (last) =>
    setCrumbs([
      { text: "Home", href: "#/" },
      { text: type.label, href: `#/${type.id}` },
      { text: last, href: `#/${type.id}/${encodeURIComponent(id)}` },
    ]);
  crumbs("Loading…");

  let saveState = null;
  let validation = null;
  let drawer = null;
  let off = installShortcuts({});
  current = {
    cleanup() {
      off();
      saveState?.destroy();
      validation?.destroy();
      drawer?.remove();
    },
    dirty: () => Boolean(saveState?.dirty),
  };

  let item;
  try {
    item = await adapters.data.get(type.id, id);
  } catch (error) {
    if (stale() || loadFailed(error)) return;
    if (error?.code === "not-found") {
      fill(screen, { text: { title: "Not found" } });
      crumbs("Not found");
      return showError(screen, { title: `This ${type.singular} doesn't exist`, text: "It may have been deleted." });
    }
    fill(screen, { text: { title: "Could not load" } });
    crumbs("Could not load");
    return showError(screen, { title: `Could not load this ${type.singular}`, text: "Check your connection and try again.", retry: () => rerun() });
  }
  if (stale()) return;

  const form = screen.querySelector("form.pn-item");
  const fields = buildFields(type, form, type.id);
  fields.write(item.values);
  const refreshWords = type.wordCount ? wordCount(form, type.wordCount) : () => {};
  const first = type.status?.[0];

  function showItem() {
    const title = titleOf(type, item.values);
    fill(screen, { text: { title, created: formatDate(item.createdAt), updated: formatDate(item.updatedAt) } });
    if (type.status) {
      fill(screen, { text: { status: capital(item.status) }, attrs: { tone: tone(type, item.status) } });
    }
    crumbs(title);
  }
  showItem();

  validation = createValidation({ root: form, fields: type.fields, get: fields.get });

  const savebar = tpl("savebar");
  // V3, V4, V8: a draft saves past missing required values; publishing, or saving past the first status, does not.
  function check(target, background) {
    const publishing = Boolean(type.status) && target !== first;
    if (background) return validation.valid();
    const invalid = publishing ? validation.run("publish", type.publishRequires ?? []) : validation.run("format");
    if (!invalid.length) return true;
    saveState.say(fixMessage(invalid.length, publishing ? "publish" : "save"));
    validation.focus(invalid[0]);
    return false;
  }

  saveState = createSaveState({
    form,
    savebar,
    read: fields.read,
    write: (values) => {
      fields.write(values);
      refreshWords();
    },
    save: async (values, extra) => {
      const status = extra?.status ?? item.status;
      try {
        item = await adapters.data.update(type.id, item.id, { status, values });
      } catch (error) {
        signedOutOnSave(error);
      }
      showItem();
    },
    validate: (values, { background, extra }) => check(extra?.status ?? item.status, background),
    // behavior: "Autosave drafts every 10 seconds"
    autosave: type.autosave ? { every: type.autosave.every, when: () => !type.autosave.drafts || item.status === first } : undefined,
    onRevert: () => validation.clear(),
    errorMessage: saveErrorMessage,
  });

  off();
  off = installShortcuts({ save: () => saveState.save() });

  // Status (P1-P5)
  async function pickStatus(opener) {
    drawer = tpl("screen-slide-over");
    fill(drawer, { text: { title: "Status" } });
    const set = document.createElement("fieldset");
    set.className = "pn-choices";
    const legend = document.createElement("legend");
    legend.className = "pn-visually-hidden";
    legend.textContent = "Status";
    set.append(legend);
    for (const status of type.status) {
      const label = document.createElement("label");
      label.className = "pn-choice";
      const radio = document.createElement("input");
      radio.className = "pn-radio";
      radio.type = "radio";
      radio.name = "pn-status";
      radio.value = status;
      radio.checked = status === item.status;
      label.append(radio, capital(status));
      set.append(label);
    }
    slotChildren(drawer, "body").append(set);
    slotChildren(layout, "dialogs").append(drawer);
    const result = await openDialog(drawer, { opener });
    const chosen = set.querySelector("input:checked")?.value;
    drawer.remove();
    drawer = null;
    return result === "done" ? chosen : null;
  }

  statusButton.addEventListener("click", async () => {
    if (!type.status || saveState.state === "saving") return;
    const index = type.status.indexOf(item.status);
    const target = type.status.length === 2 ? type.status[1 - index] : await pickStatus(statusButton);
    if (!target || target === item.status) return;
    if (target !== first && !check(target, false)) return;
    // behavior: "Publishing asks for confirmation"
    if (type.confirmPublish && item.status === first && target !== first) {
      const ok = await confirmDialog(confirmEl, {
        title: `Publish this ${type.singular}?`,
        text: "It will be visible on the site.",
        confirmLabel: capital(target),
        opener: statusButton,
      });
      if (!ok) return;
    }
    const forward = type.status.indexOf(target) > index;
    if (await saveState.save({ status: target })) {
      toast(forward ? `${singularCap} ${target}` : `${singularCap} moved to ${target}`, "positive");
    }
  });

  form.querySelector('[data-action="delete"]').addEventListener("click", async (event) => {
    const ok = await confirmDialog(confirmEl, {
      title: `Delete this ${type.singular}?`,
      text: "This can't be undone.",
      confirmLabel: "Delete",
      variant: "negative",
      opener: event.currentTarget,
    });
    if (!ok) return;
    try {
      await adapters.data.remove(type.id, item.id);
    } catch {
      return toast("Could not delete. Try again.", "negative");
    }
    current.cleanup();
    current = idle;
    toast(`${singularCap} deleted`);
    location.hash = `#/${type.id}`;
  });

  mountScreen(screen, savebar);
  setState(screen, "ready");
}

// ---------- singleton ----------

async function renderSingleton(singleton, stale) {
  const screen = tpl("screen-singleton");
  fill(screen, { text: { title: singleton.label, "loading-text": "Loading…" }, attrs: { state: "loading", "singleton-id": singleton.id } });
  mountScreen(screen);
  renderNav(singleton.id);
  setCrumbs([
    { text: "Home", href: "#/" },
    { text: singleton.label, href: `#/${singleton.id}` },
  ]);

  let saveState = null;
  let validation = null;
  let off = installShortcuts({});
  current = {
    cleanup() {
      off();
      saveState?.destroy();
      validation?.destroy();
    },
    dirty: () => Boolean(saveState?.dirty),
  };

  let record;
  try {
    record = await adapters.data.getSingleton(singleton.id);
  } catch (error) {
    if (stale() || loadFailed(error)) return;
    return showError(screen, {
      title: `Could not load ${singleton.label.toLowerCase()}`,
      text: "Check your connection and try again.",
      retry: () => rerun(),
    });
  }
  if (stale()) return;

  const form = screen.querySelector("form.pn-item");
  const fields = buildFields(singleton, form, singleton.id);
  fields.write(record?.values ?? {});
  validation = createValidation({ root: form, fields: singleton.fields, get: fields.get });

  const savebar = tpl("savebar");
  saveState = createSaveState({
    form,
    savebar,
    read: fields.read,
    write: fields.write,
    save: async (values) => {
      try {
        await adapters.data.saveSingleton(singleton.id, values);
      } catch (error) {
        signedOutOnSave(error);
      }
    },
    // V7: a singleton save is blocked by empty required fields as well as format errors.
    validate: () => {
      const invalid = validation.run("required");
      if (!invalid.length) return true;
      saveState.say(fixMessage(invalid.length, "save"));
      validation.focus(invalid[0]);
      return false;
    },
    onRevert: () => validation.clear(),
    errorMessage: saveErrorMessage,
  });
  off();
  off = installShortcuts({ save: () => saveState.save() });

  mountScreen(screen, savebar);
  setState(screen, "ready");
}

start();
