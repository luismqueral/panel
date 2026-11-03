// Field Notes panel: routes, screens, and adapter wiring. Rules: panel/build.md and behavior-spec.md.

import { PANEL } from "./panel.config.js";
import { tpl, fill, repeat, slotRepeat, slotChildren } from "./snippets/templates.js";
import { makeField } from "./snippets/fields.js";
import { createSaveState } from "./snippets/save-state.js";
import { createValidation, fixMessage } from "./snippets/validation.js";
import { openDialog, confirmDialog } from "./snippets/dialogs.js";
import { createFlow } from "./snippets/create-flow.js";
import { installShortcuts } from "./snippets/keyboard.js";
import { showToast } from "./snippets/toast.js";
import { createMemoryAdapters } from "./adapters/memory.js";
import { createRequest, createHttpAdapters } from "./adapters/http.js";
import { createGoogleAuth } from "./adapters/auth.js";

const app = document.getElementById("app");
const idle = { cleanup() {}, dirty: () => false };
let current = idle;
let layout = null;
let user = null;
let generation = 0;

function createRecipeAdapters() {
  const request = createRequest();
  const { data, files } = createHttpAdapters(request);
  return { data, files, auth: createGoogleAuth(request) };
}

const params = new URLSearchParams(location.search);
const adapters = params.has("test")
  ? createMemoryAdapters(await (await fetch("./seed.json")).json())
  : createRecipeAdapters();
const { data, files, auth } = adapters;
if (adapters.test)
  window.panelTest = {
    ...adapters.test,
    reset(seed) {
      adapters.test.reset(seed);
      current.cleanup(); // drop the open screen without asking (S9 does not apply)
      route();           // render the current route again from the new data
    },
  };

// ---------- Words and values ----------

const cap = (text) => text.charAt(0).toUpperCase() + text.slice(1);
const isAuthError = (error) => error?.code === "unauthorized" || error?.code === "forbidden";

function formatDate(value) {
  if (!value) return "";
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const date = new Date(dateOnly ? `${value}T00:00:00Z` : value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", ...(dateOnly ? { timeZone: "UTC" } : {}) });
}

function countWords(text) {
  return (String(text ?? "").match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu) ?? []).length;
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// fields: reading_time, describe: "Read-only. Estimated minutes to read, from the word count of body."
const COMPUTED = {
  readingTime: {
    value: (values) => Math.max(1, Math.ceil(countWords(values.body) / 200)),
    display: (values) => `${Math.max(1, Math.ceil(countWords(values.body) / 200))} min`,
  },
};

function emptyValue(field) {
  if (field.default !== undefined) return structuredClone(field.default);
  if (field.type === "tags") return [];
  if (field.type === "toggle") return false;
  if (["number", "image", "file", "relation"].includes(field.type)) return null;
  return "";
}

function titleOf(type, values) {
  const title = values?.[type.list.title];
  return title ? String(title) : "Untitled";
}

function toneOf(statuses, status) {
  const index = statuses.indexOf(status);
  if (index <= 0) return "neutral";
  return index === statuses.length - 1 ? "positive" : "notice";
}

function fieldOf(type, name) {
  return type.fields.find((f) => f.name === name);
}

function displayValue(field, value) {
  if (value === null || value === undefined) return "";
  if (field?.type === "date") return formatDate(value);
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") return value.name ?? "";
  return String(value);
}

// ---------- Shell ----------

function button(text, { variant, action } = {}) {
  const el = document.createElement("button");
  el.className = "pn-button";
  el.type = "button";
  if (variant) el.dataset.variant = variant;
  if (action) el.dataset.action = action;
  el.textContent = text;
  return el;
}

function makeEmpty({ icon, title, text, actions = [] }) {
  const el = tpl("empty");
  fill(el, { text: { title, text }, attrs: { icon } });
  slotChildren(el, "actions").append(...actions);
  return el;
}

function makeError({ title, text, actions = [] }) {
  const el = tpl("error");
  fill(el, { text: { title, text } });
  slotChildren(el, "actions").append(...actions);
  return el;
}

function enter(screen, state, region) {
  fill(screen, { attrs: { state } });
  slotChildren(screen, "empty")?.replaceChildren();
  slotChildren(screen, "error")?.replaceChildren();
  if (state === "empty") slotChildren(screen, "empty").append(region);
  if (state === "error") slotChildren(screen, "error").append(region);
}

function toast(text, tone) {
  if (layout) showToast(layout.toasts, text, { tone });
}

function discard() {
  return confirmDialog(layout.confirm, {
    title: "Discard unsaved changes?",
    text: "Your edits will be lost.",
    confirmLabel: "Discard",
    variant: "negative",
  });
}

function retry() {
  current.cleanup();
  current = idle;
  route();
}

function showLogin({ error = "", unreachable = false } = {}) {
  current.cleanup();
  current = idle;
  layout = null;
  user = null;
  document.title = `Sign in · ${PANEL.name}`;
  const login = tpl("screen-login");
  fill(login, { text: { title: PANEL.name, text: "Sign in to edit the site.", error: unreachable ? "Could not reach the panel. Check your connection and reload." : error } });
  app.replaceChildren(login);
  if (unreachable) return;
  const message = login.querySelector('[data-slot="error"]');
  auth.renderMethods(slotChildren(login, "methods"), {
    onSignedIn: () => {
      user = null;
      route();
    },
    onError: (text) => (message.textContent = text),
  });
}

function signedOut(error) {
  showLogin({ error: error?.code === "forbidden" ? "This account isn't allowed. Sign in with another one." : "" });
}

function mountLayout() {
  const root = tpl("layout");
  const nav = tpl("nav");
  fill(nav, { text: { brand: PANEL.name } });
  const account = tpl("account");
  fill(account, { text: { user } });
  account.querySelector('[data-action="logout"]').addEventListener("click", logout);
  slotChildren(nav, "account").append(account);
  slotChildren(root, "nav").append(nav);
  const header = tpl("header");
  slotChildren(root, "header").append(header);
  const confirm = tpl("screen-dialog");
  slotChildren(root, "dialogs").append(confirm);
  app.replaceChildren(root);
  layout = {
    root,
    nav,
    header,
    confirm,
    screen: slotChildren(root, "screen"),
    savebar: slotChildren(root, "savebar"),
    dialogs: slotChildren(root, "dialogs"),
    toasts: slotChildren(root, "toasts"),
  };
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

function setNav(currentId) {
  const entries = [
    { id: "", text: "Home", href: "#/" },
    ...PANEL.types.map((t) => ({ id: t.id, text: t.label, href: `#/${t.id}` })),
    ...PANEL.singletons.map((s) => ({ id: s.id, text: s.label, href: `#/${s.id}` })),
  ];
  repeat(slotRepeat(layout.nav, "entry"), entries, (unit, e) =>
    fill(unit, { text: { text: e.text }, attrs: { href: e.href, current: e.id === currentId ? "page" : "false" } }),
  );
}

function setCrumbs(crumbs) {
  repeat(slotRepeat(layout.header, "crumb"), crumbs, (unit, c, i) =>
    fill(unit, { text: { text: c.text }, attrs: { href: c.href ?? location.hash, current: i === crumbs.length - 1 ? "page" : "false" } }),
  );
  document.title = `${crumbs.at(-1).text} · ${PANEL.name}`;
}

const HOME = { text: "Home", href: "#/" };

function mountScreen(screen) {
  layout.screen.replaceChildren(screen);
  layout.savebar.replaceChildren();
}

// ---------- Routing ----------

async function route() {
  lastHash = location.hash;
  const gen = ++generation;
  if (!user) {
    let session;
    try {
      session = await auth.session();
    } catch {
      if (gen === generation) showLogin({ unreachable: true });
      return;
    }
    if (gen !== generation) return;
    if (!session?.user) return showLogin();
    user = session.user;
  }
  if (!layout) mountLayout();
  const parts = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean).map(decodeURIComponent);
  const type = PANEL.types.find((t) => t.id === parts[0]);
  const singleton = PANEL.singletons.find((s) => s.id === parts[0]);
  if (parts.length === 0) return homeScreen();
  if (type && parts.length === 1) return collectionScreen(type);
  if (type && parts.length === 2) return itemScreen(type, parts[1]);
  if (singleton && parts.length === 1) return singletonScreen(singleton);
  return notFoundScreen();
}

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

// ---------- Home and not found ----------

async function homeScreen() {
  setNav("");
  setCrumbs([HOME]);
  const screen = tpl("screen-home");
  fill(screen, {
    text: { title: PANEL.name, "loading-text": "Loading…", "content-heading": "Content", "recent-heading": "Recently edited" },
    attrs: { state: "loading" },
  });
  mountScreen(screen);
  let alive = true;
  const off = installShortcuts({});
  current = { cleanup: () => ((alive = false), off()), dirty: () => false };
  try {
    const lists = await Promise.all(PANEL.types.map((t) => data.list(t.id)));
    if (!alive) return;
    const entries = [
      ...PANEL.types.map((t, i) => ({ title: t.label, subtitle: plural(lists[i].length, t.singular, t.label.toLowerCase()), href: `#/${t.id}` })),
      ...PANEL.singletons.map((s) => ({ title: s.label, subtitle: "Page", href: `#/${s.id}` })),
    ];
    repeat(slotRepeat(screen, "entry"), entries, (unit, e) =>
      fill(unit, { text: { title: e.title, subtitle: e.subtitle, meta: "" }, attrs: { href: e.href } }),
    );
    const recent = PANEL.types
      .flatMap((t, i) => lists[i].map((item) => ({ type: t, item })))
      .sort((a, b) => String(b.item.updatedAt).localeCompare(String(a.item.updatedAt)))
      .slice(0, 5);
    repeat(slotRepeat(screen, "recent"), recent, (unit, { type, item }) =>
      fill(unit, {
        text: { title: titleOf(type, item.values), subtitle: type.label, meta: formatDate(item.updatedAt) },
        attrs: { href: `#/${type.id}/${encodeURIComponent(item.id)}` },
      }),
    );
    enter(screen, "ready");
  } catch (error) {
    if (!alive) return;
    if (isAuthError(error)) return signedOut(error);
    enter(screen, "error", makeError({ title: "Could not load the panel", text: "Check your connection and try again.", actions: [retryButton()] }));
  }
}

function retryButton() {
  const el = button("Try again", { action: "retry" });
  el.addEventListener("click", retry);
  return el;
}

function notFoundScreen() {
  setNav(null);
  setCrumbs([HOME, { text: "Not found" }]);
  const screen = tpl("screen-home");
  fill(screen, {
    text: { title: "Not found", "loading-text": "Loading…", "content-heading": "Content", "recent-heading": "Recently edited" },
    attrs: { state: "loading" },
  });
  repeat(slotRepeat(screen, "entry"), [], () => {});
  repeat(slotRepeat(screen, "recent"), [], () => {});
  mountScreen(screen);
  const home = button("Try again", { action: "retry" });
  home.addEventListener("click", () => (location.hash = "#/"));
  enter(screen, "error", makeError({ title: "This page doesn't exist", text: "Check the address, or go back home.", actions: [home] }));
  const off = installShortcuts({});
  current = { cleanup: off, dirty: () => false };
}

// ---------- Collection ----------

function compareValues(a, b) {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), "en", { numeric: true, sensitivity: "base" });
}

const blank = (v) => v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0);

function sortItems(type, items, sort) {
  const desc = sort.startsWith("-");
  const name = desc ? sort.slice(1) : sort;
  return [...items].sort((x, y) => {
    const a = x.values?.[name];
    const b = y.values?.[name];
    if (blank(a) && blank(b)) return 0;
    if (blank(a)) return 1;
    if (blank(b)) return -1;
    const order = compareValues(displayKey(fieldOf(type, name), a), displayKey(fieldOf(type, name), b));
    return desc ? -order : order;
  });
}

function displayKey(field, value) {
  if (Array.isArray(value)) return value.join(", ");
  if (value && typeof value === "object") return value.name ?? "";
  return value;
}

function sortOptions(type) {
  const name = type.list.sort?.replace(/^-/, "");
  const options = [];
  if (name) {
    const field = fieldOf(type, name);
    if (field?.type === "date") options.push({ value: `-${name}`, text: "Newest first" }, { value: name, text: "Oldest first" });
    else options.push({ value: `-${name}`, text: `${field.label}, descending` }, { value: name, text: `${field.label}, ascending` });
  }
  options.push({ value: type.list.title, text: "Title A–Z" });
  return options;
}

async function collectionScreen(type) {
  setNav(type.id);
  setCrumbs([HOME, { text: type.label, href: `#/${type.id}` }]);
  const lower = type.label.toLowerCase();
  const screen = tpl("screen-collection");
  fill(screen, {
    text: { title: type.label, "create-label": `New ${type.singular}`, "loading-text": "Loading…", "search-label": `Search ${lower}`, "sort-label": "Sort by" },
    attrs: { state: "loading", "type-id": type.id, "search-placeholder": `Search ${lower}` },
  });
  const options = sortOptions(type);
  const sortSelect = screen.querySelector("#pn-sort");
  repeat(sortSelect, options, (unit, o) => fill(unit, { text: { text: o.text }, attrs: { value: o.value } }));
  sortSelect.value = options[0].value;
  const search = screen.querySelector("#pn-search");
  mountScreen(screen);

  const create = mountCreateDialog(type);
  let alive = true;
  const off = installShortcuts({ search: () => (screen.dataset.state === "ready" ? search : null) });
  current = {
    cleanup() {
      alive = false;
      off();
      create.remove();
    },
    dirty: () => false,
  };
  screen.querySelector('[data-action="create"]').addEventListener("click", (event) => create.open(event.currentTarget));

  let items;
  try {
    items = await data.list(type.id);
  } catch (error) {
    if (!alive) return;
    if (isAuthError(error)) return signedOut(error);
    enter(screen, "error", makeError({ title: `Could not load ${lower}`, text: "Check your connection and try again.", actions: [retryButton()] }));
    return;
  }
  if (!alive) return;
  if (!items.length) {
    const first = button(`New ${type.singular}`, { variant: "primary", action: "create" });
    first.addEventListener("click", () => create.open(first));
    enter(screen, "empty", makeEmpty({ icon: "#pn-icon-file", title: `No ${lower} yet`, text: `Create the first ${type.singular}.`, actions: [first] }));
    return;
  }

  function render() {
    const query = search.value.trim().toLowerCase();
    const shown = sortItems(type, items, sortSelect.value).filter(
      (item) => !query || type.list.search.some((name) => displayValue(fieldOf(type, name), item.values?.[name]).toLowerCase().includes(query) || String(item.values?.[name] ?? "").toLowerCase().includes(query)),
    );
    const subtitleField = type.list.subtitle && fieldOf(type, type.list.subtitle);
    repeat(slotRepeat(screen, "row"), shown, (unit, item) =>
      fill(unit, {
        text: {
          title: titleOf(type, item.values),
          subtitle: subtitleField ? displayValue(subtitleField, item.values?.[subtitleField.name]) : "",
          status: type.status ? cap(item.status ?? type.status[0]) : "",
        },
        attrs: { href: `#/${type.id}/${encodeURIComponent(item.id)}`, tone: type.status ? toneOf(type.status, item.status) : "" },
      }),
    );
  }
  search.addEventListener("input", render);
  sortSelect.addEventListener("change", render);
  render();
  enter(screen, "ready");
}

function mountCreateDialog(type) {
  const dialog = tpl("screen-create");
  fill(dialog, { text: { title: `New ${type.singular}` } });
  const titleField = fieldOf(type, type.list.title);
  const slugField = type.fields.find((f) => f.type === "slug" && f.from === titleField.name);
  const asked = [titleField, slugField].filter(Boolean);
  const controls = asked.map((f) => makeField(f, { prefix: `${type.id}-new`, files }));
  slotChildren(dialog, "fields").append(...controls.map((c) => c.el));
  layout.dialogs.append(dialog);
  const byName = new Map(controls.map((c) => [c.field.name, c]));
  const validation = createValidation({ root: dialog, fields: asked, get: (name) => byName.get(name).get() });
  const flow = createFlow({
    dialog,
    title: titleField.name,
    slug: slugField?.name ?? null,
    validation,
    read: () => Object.fromEntries(controls.map((c) => [c.field.name, c.get()])),
    async create(given) {
      const values = Object.fromEntries(type.fields.map((f) => [f.name, emptyValue(f)]));
      Object.assign(values, given);
      for (const f of type.fields) if (f.compute) values[f.name] = COMPUTED[f.compute].value(values);
      return data.create(type.id, { status: type.status?.[0], values });
    },
    onCreated: (item) => (location.hash = `#/${type.id}/${encodeURIComponent(item.id)}`),
    onError: () => toast("Could not create. Try again.", "negative"),
  });
  return {
    open: (opener) => flow.open(opener),
    remove() {
      validation.destroy();
      if (dialog.open) dialog.close();
      dialog.remove();
    },
  };
}

// ---------- Item and singleton forms ----------

// Builds the fields of a form in schema order, with the word count and computed fields wired.
function buildFields(def, form, prefix) {
  const grid = form.querySelector('[data-slot-children="fields"]');
  const controls = [];
  const plain = () => Object.fromEntries(controls.filter((c) => !c.field.compute).map((c) => [c.field.name, c.get()]));
  for (const field of def.fields) {
    controls.push(makeField(field, { prefix, files, computed: COMPUTED, values: plain, root: form }));
  }
  grid.append(...controls.map((c) => c.el));
  const byName = new Map(controls.map((c) => [c.field.name, c]));

  // behavior: Show word count under the body field
  const countField = def.wordCount && byName.get(def.wordCount);
  const countHelp = countField?.el.querySelector(".pn-help");
  const updateCount = () => countField && (countHelp.textContent = plural(countWords(countField.get()), "word", "words"));
  countField?.el.addEventListener("input", updateCount);

  return {
    controls,
    get: (name) => byName.get(name).get(),
    read: () => Object.fromEntries(controls.map((c) => [c.field.name, c.get()])),
    write(values) {
      for (const c of controls) c.set(values?.[c.field.name] ?? emptyValue(c.field));
      updateCount();
    },
  };
}

function mountSavebar() {
  const savebar = tpl("savebar");
  fill(savebar, { text: { message: "All changes saved" }, attrs: { "save-state": "clean" } });
  layout.savebar.replaceChildren(savebar);
  return savebar;
}

const conflictMessage = (error) => (error?.code === "conflict" ? "Changed elsewhere. Copy your edits, then reload." : null);

async function itemScreen(type, id) {
  const Singular = cap(type.singular);
  const typeCrumb = { text: type.label, href: `#/${type.id}` };
  setNav(type.id);
  setCrumbs([HOME, typeCrumb, { text: "Loading…" }]);
  const screen = tpl("screen-item");
  fill(screen, { text: { title: "Loading…", "loading-text": "Loading…", status: "" }, attrs: { state: "loading", "type-id": type.id, tone: "" } });
  const statusButton = screen.querySelector('[data-action="status"]');
  statusButton.hidden = true;
  mountScreen(screen);

  let alive = true;
  let saveState = null;
  let validation = null;
  const off = installShortcuts({ save: () => saveState?.save() });
  current = {
    cleanup() {
      alive = false;
      off();
      saveState?.destroy();
      validation?.destroy();
      layout?.dialogs.querySelector(".pn-drawer")?.remove();
    },
    dirty: () => Boolean(saveState?.dirty),
  };

  let item;
  try {
    item = await data.get(type.id, id);
  } catch (error) {
    if (!alive) return;
    if (isAuthError(error)) return signedOut(error);
    const missing = error?.code === "not-found";
    const title = missing ? "Not found" : "Could not load";
    setCrumbs([HOME, typeCrumb, { text: title }]);
    fill(screen, { text: { title } });
    enter(
      screen,
      "error",
      missing
        ? makeError({ title: `This ${type.singular} doesn't exist`, text: "It may have been deleted." })
        : makeError({ title: `Could not load this ${type.singular}`, text: "Check your connection and try again.", actions: [retryButton()] }),
    );
    return;
  }
  if (!alive) return;

  const first = type.status?.[0];
  let status = type.status ? item.status ?? first : undefined;
  const form = screen.querySelector("form");
  const fields = buildFields(type, form, type.id);
  fields.write(item.values);
  validation = createValidation({ root: form, fields: type.fields, get: fields.get });

  function showTitle(values) {
    const title = titleOf(type, values);
    fill(screen, { text: { title } });
    setCrumbs([HOME, typeCrumb, { text: title, href: `#/${type.id}/${encodeURIComponent(item.id)}` }]);
  }
  function showMeta() {
    fill(screen, { text: { created: formatDate(item.createdAt), updated: formatDate(item.updatedAt) } });
  }
  function showStatus() {
    if (!type.status) return;
    statusButton.hidden = false;
    fill(screen, { text: { status: cap(status) }, attrs: { tone: toneOf(type.status, status) } });
  }

  // Publish checks (V4, V8, P3), with the conformance fields added as required.
  function checkPublish() {
    const invalid = validation.run("publish", type.publishRequires ?? []);
    if (invalid.length) {
      validation.focus(invalid[0]);
      saveState.say(fixMessage(invalid.length, "publish"));
    }
    return !invalid.length;
  }

  const savebar = mountSavebar();
  saveState = createSaveState({
    form,
    savebar,
    read: fields.read,
    write: fields.write,
    async save(values, extra) {
      let next;
      try {
        next = await data.update(type.id, item.id, { status: extra?.status ?? status, values });
      } catch (error) {
        if (isAuthError(error)) toast("You were signed out. Copy your edits, then reload to sign in.", "negative");
        throw error;
      }
      if (!alive) return;
      item = next;
      if (type.status) status = next.status ?? status;
      showTitle(next.values);
      showMeta();
      showStatus();
    },
    validate(values, { background, extra }) {
      if (background) return validation.valid();
      const target = extra?.status ?? status;
      if (type.status && target !== first) return checkPublish();
      const invalid = validation.run("format");
      if (invalid.length) {
        validation.focus(invalid[0]);
        saveState.say(fixMessage(invalid.length, "save"));
      }
      return !invalid.length;
    },
    // behavior: Autosave drafts every 10 seconds
    autosave: type.autosave ? { every: type.autosave.every, when: () => !type.autosave.drafts || status === first } : undefined,
    onRevert: () => validation.clear(),
    errorMessage: conflictMessage,
  });

  async function pickStatus() {
    const drawer = tpl("screen-slide-over");
    fill(drawer, { text: { title: "Status" } });
    const fieldset = document.createElement("fieldset");
    fieldset.className = "pn-choices";
    const legend = document.createElement("legend");
    legend.className = "pn-visually-hidden";
    legend.textContent = "Status";
    fieldset.append(legend);
    for (const s of type.status) {
      const label = document.createElement("label");
      label.className = "pn-choice";
      const radio = document.createElement("input");
      radio.className = "pn-radio";
      radio.type = "radio";
      radio.name = "pn-status";
      radio.value = s;
      radio.checked = s === status;
      label.append(radio, cap(s));
      fieldset.append(label);
    }
    slotChildren(drawer, "body").append(fieldset);
    layout.dialogs.append(drawer);
    const result = await openDialog(drawer, { opener: statusButton });
    const picked = drawer.querySelector('input[name="pn-status"]:checked')?.value;
    drawer.remove();
    return result === "done" ? picked : null;
  }

  async function changeStatus() {
    if (saveState.state === "saving") return;
    const target = type.status.length === 2 ? type.status.find((s) => s !== status) : await pickStatus();
    if (!target || target === status || !alive) return;
    if (target !== first && !checkPublish()) return;
    // behavior: Publishing asks for confirmation
    if (type.confirmPublish && status === first && target !== first) {
      const ok = await confirmDialog(layout.confirm, {
        title: `Publish this ${type.singular}?`,
        text: "It will be visible on the site.",
        confirmLabel: cap(target),
        opener: statusButton,
      });
      if (!ok || !alive) return;
    }
    const forward = type.status.indexOf(target) > type.status.indexOf(status);
    if (await saveState.save({ status: target })) toast(forward ? `${Singular} ${target}` : `${Singular} moved to ${target}`, "positive");
  }
  statusButton.addEventListener("click", changeStatus);

  screen.querySelector('[data-action="delete"]').addEventListener("click", async (event) => {
    const ok = await confirmDialog(layout.confirm, {
      title: `Delete this ${type.singular}?`,
      text: "This can't be undone.",
      confirmLabel: "Delete",
      variant: "negative",
      opener: event.currentTarget,
    });
    if (!ok || !alive) return;
    try {
      await data.remove(type.id, item.id);
    } catch (error) {
      if (isAuthError(error)) return signedOut(error);
      toast("Could not delete. Try again.", "negative");
      return;
    }
    current.cleanup();
    current = idle;
    toast(`${Singular} deleted`);
    location.hash = `#/${type.id}`;
  });

  showTitle(item.values);
  showMeta();
  showStatus();
  enter(screen, "ready");
}

async function singletonScreen(singleton) {
  setNav(singleton.id);
  setCrumbs([HOME, { text: singleton.label, href: `#/${singleton.id}` }]);
  const screen = tpl("screen-singleton");
  fill(screen, { text: { title: singleton.label, "loading-text": "Loading…" }, attrs: { state: "loading", "singleton-id": singleton.id } });
  mountScreen(screen);

  let alive = true;
  let saveState = null;
  let validation = null;
  const off = installShortcuts({ save: () => saveState?.save() });
  current = {
    cleanup() {
      alive = false;
      off();
      saveState?.destroy();
      validation?.destroy();
    },
    dirty: () => Boolean(saveState?.dirty),
  };

  let record;
  try {
    record = await data.getSingleton(singleton.id);
  } catch (error) {
    if (!alive) return;
    if (isAuthError(error)) return signedOut(error);
    enter(screen, "error", makeError({ title: `Could not load ${singleton.label.toLowerCase()}`, text: "Check your connection and try again.", actions: [retryButton()] }));
    return;
  }
  if (!alive) return;

  const form = screen.querySelector("form");
  const fields = buildFields(singleton, form, singleton.id);
  fields.write(record?.values ?? {});
  validation = createValidation({ root: form, fields: singleton.fields, get: fields.get });
  const savebar = mountSavebar();
  saveState = createSaveState({
    form,
    savebar,
    read: fields.read,
    write: fields.write,
    async save(values) {
      try {
        await data.saveSingleton(singleton.id, values);
      } catch (error) {
        if (isAuthError(error)) toast("You were signed out. Copy your edits, then reload to sign in.", "negative");
        throw error;
      }
    },
    // V7: a singleton save is blocked by empty required fields and format errors.
    validate() {
      const invalid = validation.run("required");
      if (invalid.length) {
        validation.focus(invalid[0]);
        saveState.say(fixMessage(invalid.length, "save"));
      }
      return !invalid.length;
    },
    onRevert: () => validation.clear(),
    errorMessage: conflictMessage,
  });
  enter(screen, "ready");
}

route();
