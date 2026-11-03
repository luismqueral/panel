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

const SIGNED_OUT = "You were signed out. Copy your edits, then reload to sign in.";
const NOT_ALLOWED = "This account isn't allowed. Sign in with another one.";
const UNREACHABLE = "Could not reach the panel. Check your connection and reload.";
const RETRY_TEXT = "Check your connection and try again.";

function createRecipeAdapters() {
  const request = createRequest();
  // data: json-files and files: local-disk, both via the project server
  const { data, files } = createHttpAdapters(request);
  // auth: google-login
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

const app = document.getElementById("app");
const IDLE = { cleanup() {}, dirty: () => false };
let current = IDLE;
let routeToken = 0;
let layout = null;
let nav = null;
let header = null;
let confirmEl = null;
let toastsEl = null;

// ---------- small helpers ----------

const capital = (text) => text.charAt(0).toUpperCase() + text.slice(1);
const count = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const isBlank = (value) => value === undefined || value === null || value === "";
const isAuthError = (error) => error?.code === "unauthorized" || error?.code === "forbidden";
const fieldOf = (type, name) => type.fields.find((f) => f.name === name);
const itemHref = (type, item) => `#/${type.id}/${encodeURIComponent(item.id)}`;
const words = (text) => (String(text ?? "").match(/\S+/g) ?? []).length;

function formatDate(value) {
  if (isBlank(value)) return "";
  const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const date = day ? new Date(Number(day[1]), Number(day[2]) - 1, Number(day[3])) : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function titleOf(type, item) {
  const value = item.values?.[type.list.title];
  return isBlank(value) ? "Untitled" : String(value);
}

function subtitleOf(type, item) {
  const name = type.list.subtitle;
  if (!name) return "";
  const value = item.values?.[name];
  if (isBlank(value)) return "";
  return fieldOf(type, name)?.type === "date" ? formatDate(value) : Array.isArray(value) ? value.join(", ") : String(value);
}

function toneOf(type, status) {
  if (!type.status || !status) return "";
  const index = type.status.indexOf(status);
  if (index <= 0) return "neutral";
  return index === type.status.length - 1 ? "positive" : "notice";
}

// Blank values sort last in both directions.
function sortItems(items, key) {
  const descending = key.startsWith("-");
  const name = descending ? key.slice(1) : key;
  return [...items].sort((a, b) => {
    const x = a.values?.[name];
    const y = b.values?.[name];
    if (isBlank(x) || isBlank(y)) return isBlank(x) - isBlank(y);
    const order = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), "en", { sensitivity: "base", numeric: true });
    return descending ? -order : order;
  });
}

function sortOptions(type) {
  const options = [];
  if (type.list.sort) {
    const name = type.list.sort.replace(/^-/, "");
    const field = fieldOf(type, name);
    const isDate = field?.type === "date";
    options.push(
      { value: `-${name}`, text: isDate ? "Newest first" : `${field.label}, descending` },
      { value: name, text: isDate ? "Oldest first" : `${field.label}, ascending` },
    );
  }
  if (!options.some((o) => o.value === type.list.title)) options.push({ value: type.list.title, text: "Title A–Z" });
  return options;
}

function defaultsOf(type) {
  return Object.fromEntries(type.fields.filter((f) => f.default !== undefined).map((f) => [f.name, structuredClone(f.default)]));
}

// custom field reading_time, describe: "Read-only. Estimated minutes to read, from the word count of body."
const COMPUTED = {
  readingTime: {
    value: (values) => Math.max(1, Math.ceil(words(values.body) / 200)),
    display: (values) => `${COMPUTED.readingTime.value(values)} min`,
  },
};

function button(text, { action, variant, onClick } = {}) {
  const el = document.createElement("button");
  el.className = "pn-button";
  el.type = "button";
  if (variant) el.dataset.variant = variant;
  if (action) el.dataset.action = action;
  el.textContent = text;
  if (onClick) el.addEventListener("click", onClick);
  return el;
}

function toast(text, tone) {
  if (toastsEl) showToast(toastsEl, text, tone ? { tone } : {});
}

function errorView(title, text, onRetry) {
  const el = tpl("error");
  fill(el, { text: { title, text } });
  if (onRetry) slotChildren(el, "actions").append(button("Try again", { action: "retry", onClick: onRetry }));
  return el;
}

function retry() {
  current.cleanup();
  route();
}

// Sets the screen state and mounts only the region that state shows.
function enter(screen, state, { empty, error } = {}) {
  fill(screen, { attrs: { state } });
  slotChildren(screen, "empty")?.replaceChildren(...(state === "empty" && empty ? [empty] : []));
  slotChildren(screen, "error")?.replaceChildren(...(state === "error" && error ? [error] : []));
}

function discard() {
  return confirmDialog(confirmEl, { title: "Discard unsaved changes?", text: "Your edits will be lost.", confirmLabel: "Discard", variant: "negative" });
}

function toLogin(error) {
  current.cleanup();
  showLogin({ message: error?.code === "forbidden" ? NOT_ALLOWED : "" });
}

// ---------- shell ----------

function showLogin({ message = "", unreachable = false } = {}) {
  routeToken++;
  lastHash = location.hash;
  current = IDLE;
  layout = nav = header = confirmEl = toastsEl = null;
  const login = tpl("screen-login");
  fill(login, { text: { title: PANEL.name, text: "Sign in to edit the site.", error: unreachable ? UNREACHABLE : message } });
  app.replaceChildren(login);
  document.title = `Sign in · ${PANEL.name}`;
  if (unreachable) return;
  const error = login.querySelector('[data-slot="error"]');
  adapters.auth.renderMethods(slotChildren(login, "methods"), {
    onSignedIn: () => route(),
    onError: (text) => (error.textContent = text),
  });
}

function mountLayout(user) {
  layout = tpl("layout");
  nav = tpl("nav");
  fill(nav, { text: { brand: PANEL.name } });
  const account = tpl("account");
  fill(account, { text: { user } });
  account.querySelector('[data-action="logout"]').addEventListener("click", logout);
  slotChildren(nav, "account").append(account);
  slotChildren(layout, "nav").append(nav);
  header = tpl("header");
  slotChildren(layout, "header").append(header);
  confirmEl = tpl("screen-dialog");
  slotChildren(layout, "dialogs").append(confirmEl);
  toastsEl = slotChildren(layout, "toasts");
  app.replaceChildren(layout);
}

async function logout() {
  if (current.dirty() && !(await discard())) return;
  try {
    await adapters.auth.logout();
  } catch {
    return toast("Could not log out. Try again.", "negative");
  }
  current.cleanup();
  showLogin();
}

function setChrome(crumbs, navKey) {
  repeat(slotRepeat(header, "crumb"), crumbs, (unit, crumb, i) =>
    fill(unit, { text: { text: crumb.text }, attrs: { href: crumb.href, current: i === crumbs.length - 1 ? "page" : "false" } }),
  );
  document.title = `${crumbs.at(-1).text} · ${PANEL.name}`;
  const entries = [
    { key: "home", text: "Home", href: "#/" },
    ...PANEL.types.map((t) => ({ key: t.id, text: t.label, href: `#/${t.id}` })),
    ...PANEL.singletons.map((s) => ({ key: s.id, text: s.label, href: `#/${s.id}` })),
  ];
  repeat(slotRepeat(nav, "entry"), entries, (unit, entry) =>
    fill(unit, { text: { text: entry.text }, attrs: { href: entry.href, current: entry.key === navKey ? "page" : "false" } }),
  );
}

function mount(screen) {
  slotChildren(layout, "screen").replaceChildren(screen);
  slotChildren(layout, "savebar").replaceChildren();
}

function makeSavebar() {
  const savebar = tpl("savebar");
  fill(savebar, { attrs: { "save-state": "clean" } });
  slotChildren(layout, "savebar").replaceChildren(savebar);
  return savebar;
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

async function route() {
  lastHash = location.hash;
  const token = ++routeToken;
  if (!layout) {
    let session;
    try {
      session = await adapters.auth.session();
    } catch {
      if (token === routeToken) showLogin({ unreachable: true });
      return;
    }
    if (token !== routeToken) return;
    if (!session?.user) return showLogin();
    mountLayout(session.user);
  }
  let parts;
  try {
    parts = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean).map(decodeURIComponent);
  } catch {
    parts = [null];
  }
  const type = PANEL.types.find((t) => t.id === parts[0]);
  const singleton = PANEL.singletons.find((s) => s.id === parts[0]);
  const alive = () => token === routeToken;
  if (parts.length === 0) current = homeScreen(alive);
  else if (type && parts.length === 1) current = collectionScreen(type, alive);
  else if (type && parts.length === 2) current = itemScreen(type, parts[1], alive);
  else if (singleton && parts.length === 1) current = singletonScreen(singleton, alive);
  else current = notFoundScreen();
}

// ---------- screens ----------

function homeScreen(alive) {
  const screen = tpl("screen-home");
  fill(screen, {
    text: { title: PANEL.name, "content-heading": "Content", "recent-heading": "Recently edited", "loading-text": "Loading…" },
    attrs: { state: "loading" },
  });
  mount(screen);
  setChrome([{ text: "Home", href: "#/" }], "home");
  const off = installShortcuts({});

  (async () => {
    let lists;
    try {
      lists = await Promise.all(PANEL.types.map((t) => adapters.data.list(t.id)));
    } catch (error) {
      if (!alive()) return;
      if (isAuthError(error)) return toLogin(error);
      repeat(slotRepeat(screen, "entry"), [], () => {});
      repeat(slotRepeat(screen, "recent"), [], () => {});
      return enter(screen, "error", { error: errorView("Could not load the panel", RETRY_TEXT, retry) });
    }
    if (!alive()) return;
    const entries = [
      ...PANEL.types.map((t, i) => ({ title: t.label, subtitle: count(lists[i].length, t.singular, t.label.toLowerCase()), href: `#/${t.id}` })),
      ...PANEL.singletons.map((s) => ({ title: s.label, subtitle: "Page", href: `#/${s.id}` })),
    ];
    repeat(slotRepeat(screen, "entry"), entries, (unit, e) => fill(unit, { text: { title: e.title, subtitle: e.subtitle, meta: "" }, attrs: { href: e.href } }));
    const recent = PANEL.types
      .flatMap((t, i) => lists[i].map((item) => ({ type: t, item })))
      .sort((a, b) => String(b.item.updatedAt).localeCompare(String(a.item.updatedAt)))
      .slice(0, 5);
    repeat(slotRepeat(screen, "recent"), recent, (unit, { type, item }) =>
      fill(unit, { text: { title: titleOf(type, item), subtitle: type.label, meta: formatDate(item.updatedAt) }, attrs: { href: itemHref(type, item) } }),
    );
    enter(screen, "ready");
  })();

  return { cleanup: off, dirty: () => false };
}

function notFoundScreen() {
  const screen = tpl("screen-home");
  fill(screen, {
    text: { title: "Not found", "content-heading": "Content", "recent-heading": "Recently edited", "loading-text": "Loading…" },
    attrs: { state: "error" },
  });
  repeat(slotRepeat(screen, "entry"), [], () => {});
  repeat(slotRepeat(screen, "recent"), [], () => {});
  enter(screen, "error", { error: errorView("This page doesn't exist", "Check the address, or go back home.", () => (location.hash = "#/")) });
  mount(screen);
  setChrome([{ text: "Home", href: "#/" }, { text: "Not found", href: location.hash }], null);
  const off = installShortcuts({});
  return { cleanup: off, dirty: () => false };
}

function collectionScreen(type, alive) {
  const label = type.label.toLowerCase();
  const singular = type.singular;
  const screen = tpl("screen-collection");
  fill(screen, {
    text: { title: type.label, "create-label": `New ${singular}`, "loading-text": "Loading…", "search-label": `Search ${label}`, "sort-label": "Sort by" },
    attrs: { state: "loading", "type-id": type.id, "search-placeholder": `Search ${label}` },
  });
  const search = screen.querySelector('input[type="search"]');
  const sort = slotRepeat(screen, "sort-option");
  repeat(sort, sortOptions(type), (unit, o) => fill(unit, { text: { text: o.text }, attrs: { value: o.value } }));
  sort.value = type.list.sort ?? type.list.title;

  // Create flow (C1): the list.title field, plus any slug made from it.
  const dialog = tpl("screen-create");
  fill(dialog, { text: { title: `New ${singular}` } });
  const titleField = fieldOf(type, type.list.title);
  const slugField = type.fields.find((f) => f.type === "slug" && f.from === titleField.name);
  const createFields = [titleField, slugField].filter(Boolean);
  const controls = createFields.map((f) => makeField(f, { prefix: `${type.id}-new`, files: adapters.files }));
  slotChildren(dialog, "fields").append(...controls.map((c) => c.el));
  slotChildren(layout, "dialogs").append(dialog);
  const createValidationState = createValidation({ root: dialog, fields: createFields, get: (name) => controls.find((c) => c.field.name === name).get() });
  const flow = createFlow({
    dialog,
    title: titleField.name,
    slug: slugField?.name ?? null,
    validation: createValidationState,
    read: () => Object.fromEntries(controls.map((c) => [c.field.name, c.get()])),
    create: (values) => adapters.data.create(type.id, { status: type.status?.[0], values: { ...defaultsOf(type), ...values } }),
    onCreated: (item) => (location.hash = itemHref(type, item)),
    onError: () => toast("Could not create. Try again.", "negative"),
  });
  const createButton = screen.querySelector('.pn-screen-actions [data-action="create"]');
  createButton.addEventListener("click", () => flow.open(createButton));

  mount(screen);
  setChrome([{ text: "Home", href: "#/" }, { text: type.label, href: `#/${type.id}` }], type.id);
  const off = installShortcuts({ search: () => (screen.getAttribute("data-state") === "ready" ? search : null) });

  let items = [];
  function render() {
    const query = search.value.trim().toLowerCase();
    const fields = type.list.search ?? [type.list.title];
    const matches = query ? items.filter((item) => fields.some((name) => String(item.values?.[name] ?? "").toLowerCase().includes(query))) : items;
    repeat(slotRepeat(screen, "row"), sortItems(matches, sort.value), (unit, item) => {
      fill(unit, {
        text: { title: titleOf(type, item), subtitle: subtitleOf(type, item), status: item.status ? capital(item.status) : "" },
        attrs: { href: itemHref(type, item), tone: toneOf(type, item.status) },
      });
      unit.querySelector(".pn-status").hidden = !type.status;
    });
  }
  search.addEventListener("input", render);
  sort.addEventListener("change", render);

  (async () => {
    try {
      items = await adapters.data.list(type.id);
    } catch (error) {
      if (!alive()) return;
      if (isAuthError(error)) return toLogin(error);
      return enter(screen, "error", { error: errorView(`Could not load ${label}`, RETRY_TEXT, retry) });
    }
    if (!alive()) return;
    if (!items.length) {
      const empty = tpl("empty");
      fill(empty, { text: { title: `No ${label} yet`, text: `Create the first ${singular}.` }, attrs: { icon: "#pn-icon-file" } });
      const first = button(`New ${singular}`, { action: "create", variant: "primary", onClick: () => flow.open(first) });
      slotChildren(empty, "actions").append(first);
      return enter(screen, "empty", { empty });
    }
    render();
    enter(screen, "ready");
  })();

  return {
    cleanup() {
      off();
      createValidationState.destroy();
      if (dialog.open) dialog.close();
      dialog.remove();
    },
    dirty: () => false,
  };
}

// Builds the fields of an item or singleton form, with the derived displays the behavior lines ask for.
function buildForm(form, owner, prefix) {
  const controls = owner.fields.map((f) =>
    makeField(f, { prefix, files: adapters.files, computed: COMPUTED, values: () => inputValues(), root: form }),
  );
  const byName = (name) => controls.find((c) => c.field.name === name);
  // A computed field reading itself loops forever, so computed fields are left out.
  function inputValues() {
    return Object.fromEntries(controls.filter((c) => !c.field.compute).map((c) => [c.field.name, c.get()]));
  }
  slotChildren(form, "fields").append(...controls.map((c) => c.el));

  // behavior: "Show word count under the body field"
  function showWordCount() {
    if (!owner.wordCount) return;
    const control = byName(owner.wordCount);
    control.el.querySelector(".pn-help").textContent = count(words(control.get()), "word", "words");
  }
  form.addEventListener("input", showWordCount);

  return {
    controls,
    get: (name) => byName(name).get(),
    read: () => Object.fromEntries(controls.map((c) => [c.field.name, c.get()])),
    write(values) {
      for (const c of controls) if (!c.field.compute) c.set(values?.[c.field.name] ?? null);
      for (const c of controls) c.refresh?.();
      showWordCount();
    },
  };
}

function itemScreen(type, id, alive) {
  const singular = type.singular;
  const Singular = capital(singular);
  const first = type.status?.[0];
  const screen = tpl("screen-item");
  fill(screen, { text: { title: "Loading…", "loading-text": "Loading…" }, attrs: { state: "loading", "type-id": type.id } });
  const heading = screen.querySelector(".pn-screen-title");
  const statusButton = screen.querySelector('[data-action="status"]');
  statusButton.hidden = true;
  mount(screen);
  const chrome = (last) => setChrome([{ text: "Home", href: "#/" }, { text: type.label, href: `#/${type.id}` }, { text: last, href: location.hash }], type.id);
  chrome("Loading…");

  let item = null;
  let form = null;
  let saveState = null;
  let validation = null;
  let savebar = null;
  let live = true;
  const off = installShortcuts({ save: () => saveState?.save() });

  function showHeader() {
    const title = titleOf(type, item);
    heading.textContent = title;
    chrome(title);
    fill(screen.querySelector(".pn-meta"), { text: { created: formatDate(item.createdAt), updated: formatDate(item.updatedAt) } });
    statusButton.hidden = !type.status;
    if (type.status) fill(statusButton, { text: { status: capital(item.status) }, attrs: { tone: toneOf(type, item.status) } });
  }

  function failed(title, view) {
    heading.textContent = title;
    chrome(title);
    enter(screen, "error", { error: view });
  }

  function publishBlocked() {
    const invalid = validation.run("publish", type.publishRequires ?? []);
    if (!invalid.length) return false;
    validation.focus(invalid[0]);
    saveState.say(fixMessage(invalid.length, "publish"));
    return true;
  }

  // Status (P1–P5). With more than two statuses, a slide-over lists them.
  async function chooseStatus() {
    const drawer = tpl("screen-slide-over");
    fill(drawer, { text: { title: "Status" } });
    const choices = document.createElement("fieldset");
    choices.className = "pn-choices";
    const legend = document.createElement("legend");
    legend.className = "pn-visually-hidden";
    legend.textContent = "Status";
    choices.append(legend);
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
      choices.append(choice);
    }
    slotChildren(drawer, "body").append(choices);
    slotChildren(layout, "dialogs").append(drawer);
    const result = await openDialog(drawer, { opener: statusButton });
    const chosen = choices.querySelector("input:checked")?.value;
    drawer.remove();
    return result === "done" ? chosen : null;
  }

  statusButton.addEventListener("click", async () => {
    if (!saveState || saveState.state === "saving") return;
    const from = item.status;
    const target = type.status.length === 2 ? type.status.find((s) => s !== from) : await chooseStatus();
    if (!target || target === from || !live) return;
    if (target !== first) {
      if (publishBlocked()) return;
      // behavior: "Publishing asks for confirmation"
      if (type.confirmPublish && from === first) {
        const ok = await confirmDialog(confirmEl, { title: `Publish this ${singular}?`, text: "It will be visible on the site.", confirmLabel: capital(target), opener: statusButton });
        if (!ok || !live) return;
      }
    }
    if (await saveState.save({ status: target })) {
      const forward = type.status.indexOf(target) > type.status.indexOf(from);
      toast(forward ? `${Singular} ${target}` : `${Singular} moved to ${target}`, "positive");
    }
  });

  screen.querySelector('[data-action="delete"]').addEventListener("click", async (event) => {
    const opener = event.currentTarget;
    if (!(await confirmDialog(confirmEl, { title: `Delete this ${singular}?`, text: "This can't be undone.", confirmLabel: "Delete", variant: "negative", opener }))) return;
    try {
      await adapters.data.remove(type.id, item.id);
    } catch {
      return toast("Could not delete. Try again.", "negative");
    }
    toast(`${Singular} deleted`);
    saveState.destroy();
    saveState = null;
    location.hash = `#/${type.id}`;
  });

  (async () => {
    try {
      item = await adapters.data.get(type.id, id);
    } catch (error) {
      if (!alive()) return;
      if (isAuthError(error)) return toLogin(error);
      if (error?.code === "not-found") return failed("Not found", errorView(`This ${singular} doesn't exist`, "It may have been deleted."));
      return failed("Could not load", errorView(`Could not load this ${singular}`, RETRY_TEXT, retry));
    }
    if (!alive()) return;

    form = screen.querySelector("form");
    const fields = buildForm(form, type, type.id);
    fields.write(item.values);
    validation = createValidation({ root: form, fields: type.fields.filter((f) => !f.compute), get: fields.get });
    savebar = makeSavebar();
    saveState = createSaveState({
      form,
      savebar,
      read: fields.read,
      write: fields.write,
      async save(values, extra) {
        const status = extra?.status ?? item.status;
        try {
          item = await adapters.data.update(type.id, item.id, { status, values });
        } catch (error) {
          if (isAuthError(error)) toast(SIGNED_OUT, "negative");
          if (error?.code === "invalid") console.error(error);
          throw error;
        }
        if (live) showHeader();
      },
      validate(values, { background, extra }) {
        if (background) return validation.valid();
        const publishing = Boolean(type.status) && (extra?.status ?? item.status) !== first;
        const invalid = publishing ? validation.run("publish", type.publishRequires ?? []) : validation.run("format");
        if (!invalid.length) return true;
        validation.focus(invalid[0]);
        saveState.say(fixMessage(invalid.length, publishing ? "publish" : "save"));
        return false;
      },
      // behavior: "Autosave drafts every 10 seconds"
      autosave: type.autosave && { every: type.autosave.every, when: () => !type.autosave.drafts || item.status === first },
      errorMessage: (error) => (error?.code === "conflict" ? "Changed elsewhere. Copy your edits, then reload." : null),
    });
    showHeader();
    enter(screen, "ready");
  })();

  return {
    cleanup() {
      live = false;
      off();
      saveState?.destroy();
      validation?.destroy();
      savebar?.remove();
    },
    dirty: () => Boolean(saveState?.dirty),
  };
}

function singletonScreen(singleton, alive) {
  const screen = tpl("screen-singleton");
  fill(screen, { text: { title: singleton.label, "loading-text": "Loading…" }, attrs: { state: "loading", "singleton-id": singleton.id } });
  mount(screen);
  setChrome([{ text: "Home", href: "#/" }, { text: singleton.label, href: `#/${singleton.id}` }], singleton.id);

  let saveState = null;
  let validation = null;
  let savebar = null;
  const off = installShortcuts({ save: () => saveState?.save() });

  (async () => {
    let record;
    try {
      record = await adapters.data.getSingleton(singleton.id);
    } catch (error) {
      if (!alive()) return;
      if (isAuthError(error)) return toLogin(error);
      return enter(screen, "error", { error: errorView(`Could not load ${singleton.label.toLowerCase()}`, RETRY_TEXT, retry) });
    }
    if (!alive()) return;

    const form = screen.querySelector("form");
    const fields = buildForm(form, singleton, singleton.id);
    fields.write(record?.values);
    validation = createValidation({ root: form, fields: singleton.fields.filter((f) => !f.compute), get: fields.get });
    savebar = makeSavebar();
    saveState = createSaveState({
      form,
      savebar,
      read: fields.read,
      write: fields.write,
      async save(values) {
        try {
          await adapters.data.saveSingleton(singleton.id, values);
        } catch (error) {
          if (isAuthError(error)) toast(SIGNED_OUT, "negative");
          if (error?.code === "invalid") console.error(error);
          throw error;
        }
      },
      // V7: a singleton is never published, so empty required fields block its save.
      validate() {
        const invalid = validation.run("required");
        if (!invalid.length) return true;
        validation.focus(invalid[0]);
        saveState.say(fixMessage(invalid.length, "save"));
        return false;
      },
      errorMessage: (error) => (error?.code === "conflict" ? "Changed elsewhere. Copy your edits, then reload." : null),
    });
    enter(screen, "ready");
  })();

  return {
    cleanup() {
      off();
      saveState?.destroy();
      validation?.destroy();
      savebar?.remove();
    },
    dirty: () => Boolean(saveState?.dirty),
  };
}

route();
