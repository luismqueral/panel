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

// ---------- adapters ----------

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

// ---------- state ----------

const app = document.getElementById("app");
const NONE = { cleanup() {}, dirty: () => false };
let current = NONE;
let lastHash = location.hash;
let routeToken = 0;
let layout = null;
let nav = null;
let confirmEl = null;
let toasts = null;

// ---------- helpers ----------

const AUTH_CODES = new Set(["unauthorized", "forbidden"]);
const lower = (text) => text.toLowerCase();
const cap = (text) => text.charAt(0).toUpperCase() + text.slice(1);
const fieldOf = (def, name) => def.fields.find((f) => f.name === name);
const titleOf = (type, item) => item?.values?.[type.list.title] || "Untitled";
const countText = (n, type) => `${n} ${n === 1 ? type.singular : lower(type.label)}`;
const wordsIn = (text) => String(text ?? "").trim().split(/\s+/).filter(Boolean).length;
const isBlank = (v) => v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0);
const itemHref = (type, id) => `#/${type.id}/${encodeURIComponent(id)}`;
const toast = (text, tone) => toasts && showToast(toasts, text, tone ? { tone } : undefined);

function decode(part) {
  try {
    return decodeURIComponent(part);
  } catch {
    return part;
  }
}

function formatDate(value) {
  if (!value) return "";
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const date = new Date(dateOnly ? `${value}T00:00:00Z` : value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", ...(dateOnly ? { timeZone: "UTC" } : {}) });
}

function toneOf(type, status) {
  const i = type.status.indexOf(status);
  if (i <= 0) return "neutral";
  return i === type.status.length - 1 ? "positive" : "notice";
}

function subtitleOf(type, item) {
  const name = type.list.subtitle;
  if (!name) return "";
  const value = item.values?.[name];
  if (isBlank(value)) return "";
  if (fieldOf(type, name)?.type === "date") return formatDate(value);
  return Array.isArray(value) ? value.join(", ") : String(value);
}

function blankValue(field) {
  if ("default" in field) return structuredClone(field.default);
  if (field.type === "tags") return [];
  if (field.type === "toggle") return false;
  if (["image", "file", "relation", "number", "custom"].includes(field.type)) return null;
  return "";
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

function messageBlock(kind, { title, text, icon, actions = [] }) {
  const el = tpl(kind);
  fill(el, { text: { title, text }, attrs: icon ? { icon } : {} });
  slotChildren(el, "actions").append(...actions);
  return el;
}

function showError(screen, { title, text, retry }) {
  const actions = [];
  if (retry) {
    const again = button("Try again", { action: "retry" });
    again.addEventListener("click", retry);
    actions.push(again);
  }
  slotChildren(screen, "error").replaceChildren(messageBlock("error", { title, text, actions }));
  fill(screen, { attrs: { state: "error" } });
}

// A load that throws unauthorized or forbidden shows the login screen.
function loadFailed(error) {
  if (!AUTH_CODES.has(error?.code)) return false;
  showLogin({ message: error.code === "forbidden" ? "This account isn't allowed. Sign in with another one." : "" });
  return true;
}

function onSaveError(error, saveState) {
  if (AUTH_CODES.has(error?.code)) toast("You were signed out. Copy your edits, then reload to sign in.", "negative");
  else if (error?.code === "conflict") saveState.say("Changed elsewhere. Copy your edits, then reload.");
  else if (error?.code === "invalid") console.error(error.message);
}

const discard = () =>
  confirmDialog(confirmEl, { title: "Discard unsaved changes?", text: "Your edits will be lost.", confirmLabel: "Discard", variant: "negative" });

// ---------- computed custom fields ----------

// reading_time, describe: "Read-only. Estimated minutes to read, from the word count of body."
function computedFor() {
  const minutes = (values) => Math.max(1, Math.ceil(wordsIn(values.body) / 200));
  return {
    readingTime: {
      value: (values) => minutes(values),
      display: (values) => `${minutes(values)} min`,
    },
  };
}

// ---------- shell ----------

function buildLayout(user) {
  layout = tpl("layout");
  nav = tpl("nav");
  fill(nav, { text: { brand: PANEL.name } });
  if (PANEL.auth.recipe !== "none") {
    const account = tpl("account");
    fill(account, { text: { user } });
    account.querySelector('[data-action="logout"]').addEventListener("click", logout);
    slotChildren(nav, "account").append(account);
  }
  slotChildren(layout, "nav").append(nav);
  confirmEl = tpl("screen-dialog");
  fill(confirmEl, { text: { title: "", text: "", "confirm-label": "" }, attrs: { variant: "primary" } });
  slotChildren(layout, "dialogs").append(confirmEl);
  toasts = slotChildren(layout, "toasts");
  app.replaceChildren(layout);
}

function chrome({ crumbs, navCurrent }) {
  const entries = [
    { text: "Home", href: "#/" },
    ...PANEL.types.map((t) => ({ text: t.label, href: `#/${t.id}` })),
    ...PANEL.singletons.map((s) => ({ text: s.label, href: `#/${s.id}` })),
  ];
  repeat(slotRepeat(nav, "entry"), entries, (unit, e) =>
    fill(unit, { text: { text: e.text }, attrs: { href: e.href, current: e.href === navCurrent ? "page" : "false" } }),
  );
  setCrumbs(crumbs);
  slotChildren(layout, "savebar").replaceChildren();
}

function setCrumbs(crumbs) {
  const header = tpl("header");
  repeat(slotRepeat(header, "crumb"), crumbs, (unit, c, i) =>
    fill(unit, { text: { text: c.text }, attrs: { href: c.href, current: i === crumbs.length - 1 ? "page" : "false" } }),
  );
  slotChildren(layout, "header").replaceChildren(header);
  document.title = `${crumbs.at(-1).text} · ${PANEL.name}`;
}

const mount = (screen) => slotChildren(layout, "screen").replaceChildren(screen);

function emptyRepeats(screen) {
  for (const container of screen.querySelectorAll("[data-slot-repeat]")) repeat(container, [], () => {});
}

// ---------- login ----------

function showLogin({ message = "", unreachable = false } = {}) {
  current.cleanup();
  current = NONE;
  routeToken++;
  layout = nav = confirmEl = toasts = null;
  const login = tpl("screen-login");
  fill(login, {
    text: {
      title: PANEL.name,
      text: "Sign in to edit the site.",
      error: unreachable ? "Could not reach the panel. Check your connection and reload." : message,
    },
  });
  app.replaceChildren(login);
  document.title = `Sign in · ${PANEL.name}`;
  if (unreachable) return;
  adapters.auth.renderMethods(slotChildren(login, "methods"), {
    onSignedIn: () => start(),
    onError: (text) => fill(login, { text: { error: text } }),
  });
}

async function logout() {
  if (current.dirty() && !(await discard())) return;
  try {
    await adapters.auth.logout();
  } catch {
    toast("Could not log out. Try again.", "negative");
    return;
  }
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
  buildLayout(session.user);
  route();
}

// ---------- routing ----------

function route() {
  current.cleanup();
  current = NONE;
  lastHash = location.hash;
  if (!layout) return start();
  const token = ++routeToken;
  const stale = () => token !== routeToken;
  const parts = (location.hash || "#/").replace(/^#\/?/, "").split("/").filter(Boolean).map(decode);
  const [first, second, ...rest] = parts;
  if (!first) return renderHome(stale);
  const type = PANEL.types.find((t) => t.id === first);
  if (type && !second) return renderCollection(type, stale);
  if (type && !rest.length) return renderItem(type, second, stale);
  const singleton = PANEL.singletons.find((s) => s.id === first);
  if (singleton && !second) return renderSingleton(singleton, stale);
  return renderNotFound();
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

// ---------- home and not found ----------

const fillRow = (unit, row) =>
  fill(unit, { text: { title: row.title, subtitle: row.subtitle, meta: row.meta ?? "" }, attrs: { href: row.href } });

async function renderHome(stale) {
  const screen = tpl("screen-home");
  fill(screen, {
    text: { title: PANEL.name, "loading-text": "Loading…", "content-heading": "Content", "recent-heading": "Recently edited" },
    attrs: { state: "loading" },
  });
  emptyRepeats(screen);
  chrome({ crumbs: [{ text: "Home", href: "#/" }], navCurrent: "#/" });
  mount(screen);
  try {
    const lists = await Promise.all(PANEL.types.map((t) => adapters.data.list(t.id)));
    if (stale()) return;
    const entries = [
      ...PANEL.types.map((t, i) => ({ title: t.label, subtitle: countText(lists[i].length, t), href: `#/${t.id}` })),
      ...PANEL.singletons.map((s) => ({ title: s.label, subtitle: "Page", href: `#/${s.id}` })),
    ];
    repeat(slotRepeat(screen, "entry"), entries, fillRow);
    const recent = PANEL.types
      .flatMap((t, i) => lists[i].map((item) => ({ t, item })))
      .sort((a, b) => String(b.item.updatedAt).localeCompare(String(a.item.updatedAt)))
      .slice(0, 5)
      .map(({ t, item }) => ({ title: titleOf(t, item), subtitle: t.label, meta: formatDate(item.updatedAt), href: itemHref(t, item.id) }));
    repeat(slotRepeat(screen, "recent"), recent, fillRow);
    fill(screen, { attrs: { state: "ready" } });
  } catch (error) {
    if (stale() || loadFailed(error)) return;
    showError(screen, { title: "Could not load the panel", text: "Check your connection and try again.", retry: () => route() });
  }
}

function renderNotFound() {
  const screen = tpl("screen-home");
  fill(screen, { text: { title: "Not found", "loading-text": "Loading…", "content-heading": "Content", "recent-heading": "Recently edited" } });
  emptyRepeats(screen);
  chrome({ crumbs: [{ text: "Home", href: "#/" }, { text: "Not found", href: location.hash }], navCurrent: null });
  mount(screen);
  showError(screen, {
    title: "This page doesn't exist",
    text: "Check the address, or go back home.",
    retry: () => {
      location.hash = "#/";
    },
  });
}

// ---------- collection ----------

function compareBy(key) {
  const desc = key.startsWith("-");
  const name = desc ? key.slice(1) : key;
  return (a, b) => {
    const x = a.values?.[name];
    const y = b.values?.[name];
    const bx = isBlank(x);
    const by = isBlank(y);
    if (bx || by) return bx === by ? 0 : bx ? 1 : -1;
    const r =
      typeof x === "number" && typeof y === "number"
        ? x - y
        : String(x).localeCompare(String(y), undefined, { sensitivity: "base", numeric: true });
    return desc ? -r : r;
  };
}

function sortOptions(type) {
  const key = type.list.sort ?? type.list.title;
  const name = key.replace(/^-/, "");
  const field = fieldOf(type, name);
  const options =
    field.type === "date"
      ? [{ value: `-${name}`, text: "Newest first" }, { value: name, text: "Oldest first" }]
      : [{ value: `-${name}`, text: `${field.label}, descending` }, { value: name, text: `${field.label}, ascending` }];
  if (name !== type.list.title) options.push({ value: type.list.title, text: "Title A–Z" });
  return options;
}

function renderCollection(type, stale) {
  const label = lower(type.label);
  const screen = tpl("screen-collection");
  fill(screen, {
    text: {
      title: type.label,
      "create-label": `New ${type.singular}`,
      "loading-text": "Loading…",
      "search-label": `Search ${label}`,
      "sort-label": "Sort by",
    },
    attrs: { state: "loading", "type-id": type.id, "search-placeholder": `Search ${label}` },
  });
  emptyRepeats(screen);
  const search = screen.querySelector("#pn-search");
  const sort = screen.querySelector("#pn-sort");
  repeat(slotRepeat(screen, "sort-option"), sortOptions(type), (unit, o) => fill(unit, { text: { text: o.text }, attrs: { value: o.value } }));
  sort.value = type.list.sort ?? type.list.title;

  // Empty state, with its own "New <singular>" button.
  const emptyCreate = button(`New ${type.singular}`, { action: "create", variant: "primary" });
  slotChildren(screen, "empty").append(
    messageBlock("empty", { icon: "#pn-icon-file", title: `No ${label} yet`, text: `Create the first ${type.singular}.`, actions: [emptyCreate] }),
  );

  // Create dialog: list.title, plus any slug made from it (C1).
  const dialog = tpl("screen-create");
  fill(dialog, { text: { title: `New ${type.singular}` } });
  const createFields = type.fields.filter((f) => f.name === type.list.title || (f.type === "slug" && f.from === type.list.title));
  const createControls = createFields.map((f) => makeField(f, { prefix: `${type.id}-new`, files: adapters.files }));
  const createGrid = slotChildren(dialog, "fields");
  createGrid.append(...createControls.map((c) => c.el));
  slotChildren(layout, "dialogs").append(dialog);
  const createValidationRun = createValidation({
    root: createGrid,
    fields: createFields,
    get: (name) => createControls.find((c) => c.field.name === name).get(),
  });
  const flow = createFlow({
    dialog,
    title: type.list.title,
    slug: createFields.find((f) => f.type === "slug")?.name ?? null,
    validation: createValidationRun,
    read: () => Object.fromEntries(createControls.map((c) => [c.field.name, c.get()])),
    create: (values) => {
      const all = Object.fromEntries(type.fields.map((f) => [f.name, blankValue(f)]));
      return adapters.data.create(type.id, { status: type.status?.[0], values: { ...all, ...values } });
    },
    onCreated: (item) => {
      location.hash = itemHref(type, item.id);
    },
    onError: () => toast("Could not create. Try again.", "negative"),
  });
  const openCreate = (event) => flow.open(event.currentTarget);
  screen.querySelector('.pn-screen-actions [data-action="create"]').addEventListener("click", openCreate);
  emptyCreate.addEventListener("click", openCreate);

  chrome({ crumbs: [{ text: "Home", href: "#/" }, { text: type.label, href: `#/${type.id}` }], navCurrent: `#/${type.id}` });
  mount(screen);

  let items = [];
  const searchFields = type.list.search ?? [type.list.title];
  function renderRows() {
    const q = search.value.trim().toLowerCase();
    const rows = items
      .filter(
        (item) =>
          !q ||
          searchFields.some((name) => {
            const v = item.values?.[name];
            return (Array.isArray(v) ? v.join(" ") : String(v ?? "")).toLowerCase().includes(q);
          }),
      )
      .sort(compareBy(sort.value));
    repeat(slotRepeat(screen, "row"), rows, (unit, item) =>
      fill(unit, {
        text: { title: titleOf(type, item), subtitle: subtitleOf(type, item), status: type.status ? cap(item.status ?? "") : "" },
        attrs: { href: itemHref(type, item.id), tone: type.status ? toneOf(type, item.status) : "neutral" },
      }),
    );
  }
  search.addEventListener("input", renderRows);
  sort.addEventListener("change", renderRows);

  let done = false;
  current = {
    cleanup() {
      if (done) return;
      done = true;
      createValidationRun.destroy();
      if (dialog.open) dialog.close();
      dialog.remove();
    },
    dirty: () => false,
    search: () => search,
  };

  (async () => {
    try {
      items = await adapters.data.list(type.id);
      if (stale()) return;
      renderRows();
      fill(screen, { attrs: { state: items.length ? "ready" : "empty" } });
    } catch (error) {
      if (stale() || loadFailed(error)) return;
      showError(screen, { title: `Could not load ${label}`, text: "Check your connection and try again.", retry: () => route() });
    }
  })();
}

// ---------- item and singleton forms ----------

function buildForm(screen, def, prefix, values) {
  const form = screen.querySelector("form.pn-item");
  const grid = slotChildren(screen, "fields");
  const controls = new Map();
  const read = (skipComputed = false) =>
    Object.fromEntries(def.fields.filter((f) => !(skipComputed && f.compute)).map((f) => [f.name, controls.get(f.name).get()]));
  const ctx = { prefix, files: adapters.files, computed: computedFor(def), values: () => read(true), root: form };
  for (const field of def.fields) {
    const control = makeField(field, ctx);
    grid.append(control.el);
    controls.set(field.name, control);
  }

  // behavior: Show word count under the body field
  const counted = def.fields.filter((f) => f.wordCount);
  function updateWordCounts() {
    for (const field of counted) {
      const n = wordsIn(controls.get(field.name).get());
      fill(controls.get(field.name).el, { text: { help: `${n} ${n === 1 ? "word" : "words"}` } });
    }
  }
  form.addEventListener("input", updateWordCounts);

  const write = (next) => {
    for (const field of def.fields) controls.get(field.name).set(next?.[field.name] ?? blankValue(field));
    updateWordCounts();
  };
  write(values);

  const validation = createValidation({ root: grid, fields: def.fields, get: (name) => controls.get(name).get() });
  return {
    form,
    read: () => read(),
    write,
    validation,
    destroy() {
      validation.destroy();
      form.removeEventListener("input", updateWordCounts);
    },
  };
}

function addSavebar() {
  const savebar = tpl("savebar");
  fill(savebar, { text: { message: "All changes saved" }, attrs: { "save-state": "clean" } });
  slotChildren(layout, "savebar").replaceChildren(savebar);
  return savebar;
}

async function pickStatus(type, status, opener) {
  const drawer = tpl("screen-slide-over");
  fill(drawer, { text: { title: "Status" } });
  const set = document.createElement("fieldset");
  set.className = "pn-choices";
  const legend = document.createElement("legend");
  legend.className = "pn-visually-hidden";
  legend.textContent = "Status";
  set.append(legend);
  for (const name of type.status) {
    const choice = document.createElement("label");
    choice.className = "pn-choice";
    const radio = document.createElement("input");
    radio.className = "pn-radio";
    radio.type = "radio";
    radio.name = "pn-status";
    radio.value = name;
    radio.checked = name === status;
    choice.append(radio, cap(name));
    set.append(choice);
  }
  slotChildren(drawer, "body").append(set);
  slotChildren(layout, "dialogs").append(drawer);
  const result = await openDialog(drawer, { opener });
  const picked = set.querySelector("input:checked")?.value;
  drawer.remove();
  return result === "done" ? picked : null;
}

async function renderItem(type, id, stale) {
  const screen = tpl("screen-item");
  fill(screen, { text: { title: "Loading…", "loading-text": "Loading…", status: "" }, attrs: { state: "loading", "type-id": type.id, tone: "neutral" } });
  const statusButton = screen.querySelector('[data-action="status"]');
  statusButton.hidden = true;
  const crumbsFor = (last) => [
    { text: "Home", href: "#/" },
    { text: type.label, href: `#/${type.id}` },
    { text: last, href: location.hash },
  ];
  chrome({ crumbs: crumbsFor("Loading…"), navCurrent: `#/${type.id}` });
  mount(screen);

  let done = false;
  let leaving = false;
  let form = null;
  let saveState = null;
  current = {
    cleanup() {
      if (done) return;
      done = true;
      saveState?.destroy();
      form?.destroy();
    },
    dirty: () => !leaving && Boolean(saveState?.dirty),
    save: () => saveState?.save(),
  };

  let item;
  try {
    item = await adapters.data.get(type.id, id);
  } catch (error) {
    if (stale() || loadFailed(error)) return;
    const missing = error?.code === "not-found";
    const last = missing ? "Not found" : "Could not load";
    fill(screen, { text: { title: last } });
    setCrumbs(crumbsFor(last));
    if (missing) showError(screen, { title: `This ${type.singular} doesn't exist`, text: "It may have been deleted." });
    else showError(screen, { title: `Could not load this ${type.singular}`, text: "Check your connection and try again.", retry: () => route() });
    return;
  }
  if (stale()) return;

  let status = item.status;
  const first = type.status?.[0];
  const index = (s) => type.status.indexOf(s);

  function renderHeader() {
    const title = titleOf(type, item);
    fill(screen, { text: { title, created: formatDate(item.createdAt), updated: formatDate(item.updatedAt) } });
    setCrumbs(crumbsFor(title));
    if (!type.status) return;
    statusButton.hidden = false;
    fill(screen, { text: { status: cap(status) }, attrs: { tone: toneOf(type, status) } });
  }

  form = buildForm(screen, type, type.id, item.values);
  const { validation } = form;
  const savebar = addSavebar();
  saveState = createSaveState({
    form: form.form,
    savebar,
    read: form.read,
    write: form.write,
    save: async (values, extra) => {
      try {
        const saved = await adapters.data.update(type.id, item.id, { status: extra?.status ?? status, values });
        item = saved;
        status = saved.status ?? extra?.status ?? status;
        validation.clear();
        renderHeader();
      } catch (error) {
        onSaveError(error, saveState);
        throw error;
      }
    },
    validate: (values, { background, extra }) => {
      if (background) return validation.valid();
      // Run "publish" before a status moves past the first, with conformance fields added as required.
      const publishing = Boolean(extra && type.status && index(extra.status) > 0);
      const invalid = publishing ? validation.run("publish", type.publishRequires ?? []) : validation.run("format");
      if (!invalid.length) return true;
      // Focus first: leaving an edited field fires "change", which clears the save bar message.
      validation.focus(invalid[0]);
      saveState.say(fixMessage(invalid.length, publishing ? "publish" : "save"));
      return false;
    },
    // behavior: Autosave drafts every 10 seconds
    autosave: type.autosave ? { every: type.autosave.every, when: () => !type.autosave.drafts || status === first } : undefined,
    onRevert: () => validation.clear(),
  });

  // Status (P1–P5).
  statusButton.addEventListener("click", async () => {
    if (!type.status || saveState.state === "saving") return;
    const next = type.status.length === 2 ? type.status[index(status) === 0 ? 1 : 0] : await pickStatus(type, status, statusButton);
    if (!next || next === status) return;
    const forward = index(next) > index(status);
    if (index(next) > 0) {
      const invalid = validation.run("publish", type.publishRequires ?? []);
      if (invalid.length) {
        validation.focus(invalid[0]);
        saveState.say(fixMessage(invalid.length, "publish"));
        return;
      }
    }
    // behavior: Publishing asks for confirmation
    if (type.confirmPublish && status === first && index(next) > 0) {
      const ok = await confirmDialog(confirmEl, {
        title: `Publish this ${type.singular}?`,
        text: "It will be visible on the site.",
        confirmLabel: cap(next),
        opener: statusButton,
      });
      if (!ok) return;
    }
    if (await saveState.save({ status: next })) {
      toast(forward ? `${cap(type.singular)} ${next}` : `${cap(type.singular)} moved to ${next}`, "positive");
    }
  });

  // Delete.
  const deleteButton = screen.querySelector('[data-action="delete"]');
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
      await adapters.data.remove(type.id, item.id);
    } catch {
      toast("Could not delete. Try again.", "negative");
      return;
    }
    leaving = true;
    location.hash = `#/${type.id}`;
    toast(`${cap(type.singular)} deleted`);
  });

  renderHeader();
  fill(screen, { attrs: { state: "ready" } });
}

async function renderSingleton(singleton, stale) {
  const screen = tpl("screen-singleton");
  fill(screen, { text: { title: singleton.label, "loading-text": "Loading…" }, attrs: { state: "loading", "singleton-id": singleton.id } });
  chrome({ crumbs: [{ text: "Home", href: "#/" }, { text: singleton.label, href: `#/${singleton.id}` }], navCurrent: `#/${singleton.id}` });
  mount(screen);

  let done = false;
  let form = null;
  let saveState = null;
  current = {
    cleanup() {
      if (done) return;
      done = true;
      saveState?.destroy();
      form?.destroy();
    },
    dirty: () => Boolean(saveState?.dirty),
    save: () => saveState?.save(),
  };

  let record;
  try {
    record = await adapters.data.getSingleton(singleton.id);
  } catch (error) {
    if (stale() || loadFailed(error)) return;
    showError(screen, { title: `Could not load ${lower(singleton.label)}`, text: "Check your connection and try again.", retry: () => route() });
    return;
  }
  if (stale()) return;

  form = buildForm(screen, singleton, singleton.id, record?.values ?? {});
  const { validation } = form;
  saveState = createSaveState({
    form: form.form,
    savebar: addSavebar(),
    read: form.read,
    write: form.write,
    save: async (values) => {
      try {
        await adapters.data.saveSingleton(singleton.id, values);
        validation.clear();
      } catch (error) {
        onSaveError(error, saveState);
        throw error;
      }
    },
    // V7: a singleton's save is blocked by empty required fields as well as format errors.
    validate: (values, { background }) => {
      if (background) return validation.valid();
      const invalid = validation.run("required");
      if (!invalid.length) return true;
      validation.focus(invalid[0]);
      saveState.say(fixMessage(invalid.length, "save"));
      return false;
    },
    onRevert: () => validation.clear(),
  });
  fill(screen, { attrs: { state: "ready" } });
}

// ---------- start ----------

installShortcuts({ save: () => current.save?.(), search: () => current.search?.() });
start();
