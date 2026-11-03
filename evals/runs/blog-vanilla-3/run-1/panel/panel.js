// Field Notes panel: routes, screens, and adapter wiring. Built from panel.config.js (panel.yaml).

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
const idle = { cleanup() {}, dirty: () => false };
let current = idle;
let layout = null;
let routeToken = 0;

// auth: google-login; data: json-files (via server); files: local-disk
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
const { data, files, auth } = adapters;

const CHECK = "Check your connection and try again.";
const typeById = new Map(PANEL.types.map((t) => [t.id, t]));
const singletonById = new Map(PANEL.singletons.map((s) => [s.id, s]));
const navEntries = [
  { text: "Home", href: "#/" },
  ...PANEL.types.map((t) => ({ text: t.label, href: `#/${t.id}` })),
  ...PANEL.singletons.map((s) => ({ text: s.label, href: `#/${s.id}` })),
];

const cap = (text) => text.charAt(0).toUpperCase() + text.slice(1);
const count = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const isAuthError = (error) => error?.code === "unauthorized" || error?.code === "forbidden";
const isBlank = (v) => v === "" || v === null || v === undefined || (Array.isArray(v) && v.length === 0);
const fieldOf = (def, name) => def.fields.find((f) => f.name === name);
const itemTitle = (type, item) => item.values?.[type.list.title] || "Untitled";
const itemHref = (type, item) => `#/${type.id}/${encodeURIComponent(item.id)}`;
const words = (text) => (String(text ?? "").trim().match(/\S+/g) ?? []).length;

function tone(type, status) {
  const i = type.status.indexOf(status);
  if (i <= 0) return "neutral";
  return i === type.status.length - 1 ? "positive" : "notice";
}

function formatDate(value) {
  if (!value) return "";
  const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const date = day ? new Date(Number(day[1]), Number(day[2]) - 1, Number(day[3])) : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function display(def, name, value) {
  if (fieldOf(def, name)?.type === "date") return formatDate(value);
  if (Array.isArray(value)) return value.join(", ");
  return value === null || value === undefined ? "" : String(value);
}

function emptyValue(field) {
  if (field.type === "tags") return [];
  if (field.type === "toggle") return false;
  if (["number", "image", "file", "relation", "custom"].includes(field.type)) return null;
  return "";
}

// describe: Read-only. Estimated minutes to read, from the word count of body.
const computed = {
  readingTime: {
    value: (values) => Math.max(1, Math.ceil(words(values.body) / 200)),
    display: (values) => `${computed.readingTime.value(values)} min`,
  },
};

// The create flow sends every field: defaults, then the dialog's values, then computed values.
function newValues(type, given) {
  const values = {};
  for (const f of type.fields) if (!f.compute) values[f.name] = f.default ?? emptyValue(f);
  Object.assign(values, given);
  for (const f of type.fields) if (f.compute) values[f.name] = computed[f.compute].value(values);
  return values;
}

function button(text, action, variant) {
  const el = document.createElement("button");
  el.className = "pn-button";
  el.type = "button";
  if (variant) el.dataset.variant = variant;
  el.dataset.action = action;
  el.textContent = text;
  return el;
}

function retryButton() {
  const el = button("Try again", "retry");
  el.addEventListener("click", () => {
    current.cleanup();
    route();
  });
  return el;
}

const setState = (screen, state) => fill(screen, { attrs: { state } });
const setTitle = (screen, text) => (screen.querySelector(".pn-screen-title").textContent = text);

function showEmpty(screen, { icon, title, text, actions = [] }) {
  const el = tpl("empty");
  fill(el, { text: { title, text }, attrs: { icon } });
  slotChildren(el, "actions").append(...actions);
  slotChildren(screen, "empty").replaceChildren(el);
  setState(screen, "empty");
}

function showError(screen, { title, text, actions = [] }) {
  const el = tpl("error");
  fill(el, { text: { title, text } });
  slotChildren(el, "actions").append(...actions);
  slotChildren(screen, "error").replaceChildren(el);
  setState(screen, "error");
}

const toast = (text, tone = "info") => layout && showToast(layout.toasts, text, { tone });

const discard = () =>
  confirmDialog(layout.confirm, {
    title: "Discard unsaved changes?",
    text: "Your edits will be lost.",
    confirmLabel: "Discard",
    variant: "negative",
  });

// Shell

function mountLayout(user) {
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
  fill(confirm, { text: { title: "", text: "", "confirm-label": "" }, attrs: { variant: "primary" } });
  slotChildren(root, "dialogs").append(confirm);
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
  app.replaceChildren(root);
}

function mountScreen(screen, { nav, crumbs }) {
  layout.savebar.replaceChildren();
  layout.screen.replaceChildren(screen);
  repeat(slotRepeat(layout.nav, "entry"), navEntries, (unit, e) =>
    fill(unit, { text: { text: e.text }, attrs: { href: e.href, current: e.href === nav ? "page" : "false" } }),
  );
  setCrumbs(crumbs);
}

function setCrumbs(crumbs) {
  repeat(slotRepeat(layout.header, "crumb"), crumbs, (unit, c, i) =>
    fill(unit, { text: { text: c.text }, attrs: { href: c.href, current: i === crumbs.length - 1 ? "page" : "false" } }),
  );
  document.title = `${crumbs[crumbs.length - 1].text} · ${PANEL.name}`;
}

async function logout() {
  if (current.dirty() && !(await discard())) return;
  try {
    await auth.logout();
  } catch {
    return toast("Could not log out. Try again.", "negative");
  }
  showLogin();
}

function showLogin({ message = "", unreachable = false } = {}) {
  current.cleanup();
  current = idle;
  layout = null;
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
  lastHash = location.hash;
  if (unreachable) return;
  auth.renderMethods(slotChildren(login, "methods"), {
    onSignedIn: () => boot(),
    onError: (text) => fill(login, { text: { error: text } }),
  });
}

function authFailed(error) {
  showLogin({ message: error.code === "forbidden" ? "This account isn't allowed. Sign in with another one." : "" });
}

async function boot() {
  const token = ++routeToken;
  lastHash = location.hash;
  let session;
  try {
    session = await auth.session();
  } catch {
    if (token === routeToken) showLogin({ unreachable: true });
    return;
  }
  if (token !== routeToken) return;
  if (!session?.user) return showLogin();
  mountLayout(session.user);
  route();
}

// Routes

function route() {
  lastHash = location.hash;
  if (!layout) return boot();
  const token = ++routeToken;
  let parts;
  try {
    parts = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean).map(decodeURIComponent);
  } catch {
    return notFound();
  }
  if (parts.length === 0) return home(token);
  const type = typeById.get(parts[0]);
  if (type && parts.length === 1) return collection(type, token);
  if (type && parts.length === 2) return item(type, parts[1], token);
  const singleton = singletonById.get(parts[0]);
  if (singleton && parts.length === 1) return singletonScreen(singleton, token);
  return notFound();
}

function homeScreen(title) {
  const screen = tpl("screen-home");
  fill(screen, {
    text: { title, "loading-text": "Loading…", "content-heading": "Content", "recent-heading": "Recently edited" },
    attrs: { state: "loading" },
  });
  repeat(slotRepeat(screen, "entry"), [], () => {});
  repeat(slotRepeat(screen, "recent"), [], () => {});
  return screen;
}

function home(token) {
  const screen = homeScreen(PANEL.name);
  mountScreen(screen, { nav: "#/", crumbs: [{ text: "Home", href: "#/" }] });
  current = { cleanup: installShortcuts({}), dirty: () => false };
  load();

  async function load() {
    let lists;
    try {
      lists = await Promise.all(PANEL.types.map((t) => data.list(t.id)));
    } catch (error) {
      if (token !== routeToken) return;
      if (isAuthError(error)) return authFailed(error);
      return showError(screen, { title: "Could not load the panel", text: CHECK, actions: [retryButton()] });
    }
    if (token !== routeToken) return;
    const entries = [
      ...PANEL.types.map((t, i) => ({
        title: t.label,
        subtitle: count(lists[i].length, t.singular, t.label.toLowerCase()),
        href: `#/${t.id}`,
      })),
      ...PANEL.singletons.map((s) => ({ title: s.label, subtitle: "Page", href: `#/${s.id}` })),
    ];
    repeat(slotRepeat(screen, "entry"), entries, (unit, e) =>
      fill(unit, { text: { title: e.title, subtitle: e.subtitle, meta: "" }, attrs: { href: e.href } }),
    );
    const recent = PANEL.types
      .flatMap((t, i) => lists[i].map((it) => ({ type: t, item: it })))
      .sort((a, b) => String(b.item.updatedAt).localeCompare(String(a.item.updatedAt)))
      .slice(0, 5);
    repeat(slotRepeat(screen, "recent"), recent, (unit, { type, item }) =>
      fill(unit, {
        text: { title: itemTitle(type, item), subtitle: type.label, meta: formatDate(item.updatedAt) },
        attrs: { href: itemHref(type, item) },
      }),
    );
    setState(screen, "ready");
  }
}

function notFound() {
  const screen = homeScreen("Not found");
  mountScreen(screen, {
    nav: null,
    crumbs: [
      { text: "Home", href: "#/" },
      { text: "Not found", href: location.hash },
    ],
  });
  current = { cleanup: installShortcuts({}), dirty: () => false };
  const home = button("Try again", "retry");
  home.addEventListener("click", () => (location.hash = "#/"));
  showError(screen, { title: "This page doesn't exist", text: "Check the address, or go back home.", actions: [home] });
}

function sortOptions(type) {
  const options = [];
  const name = type.list.sort?.replace(/^-/, "");
  if (name) {
    const field = fieldOf(type, name);
    const isDate = field.type === "date";
    options.push(
      { value: `-${name}`, text: isDate ? "Newest first" : `${field.label}, descending` },
      { value: name, text: isDate ? "Oldest first" : `${field.label}, ascending` },
    );
  }
  if (name !== type.list.title) options.push({ value: type.list.title, text: "Title A–Z" });
  return options;
}

// Blank values sort last in both directions.
function sortItems(items, key) {
  const desc = key.startsWith("-");
  const name = key.replace(/^-/, "");
  return [...items].sort((a, b) => {
    const x = a.values?.[name];
    const y = b.values?.[name];
    if (isBlank(x) || isBlank(y)) return Number(isBlank(x)) - Number(isBlank(y));
    const order =
      typeof x === "number" && typeof y === "number"
        ? x - y
        : String(x).localeCompare(String(y), undefined, { sensitivity: "base", numeric: true });
    return desc ? -order : order;
  });
}

function collection(type, token) {
  const label = type.label.toLowerCase();
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
  const search = screen.querySelector("#pn-search");
  const sort = screen.querySelector("#pn-sort");
  const rows = slotRepeat(screen, "row");
  repeat(slotRepeat(screen, "sort-option"), sortOptions(type), (unit, o) =>
    fill(unit, { text: { text: o.text }, attrs: { value: o.value } }),
  );
  sort.value = type.list.sort ?? type.list.title;
  repeat(rows, [], () => {});
  mountScreen(screen, {
    nav: `#/${type.id}`,
    crumbs: [
      { text: "Home", href: "#/" },
      { text: type.label, href: `#/${type.id}` },
    ],
  });

  // C1: the dialog asks for list.title, plus any slug made from it.
  const dialog = tpl("screen-create");
  fill(dialog, { text: { title: `New ${type.singular}` } });
  const titleField = fieldOf(type, type.list.title);
  const slugField = type.fields.find((f) => f.type === "slug" && f.from === type.list.title);
  const createFields = [titleField, slugField].filter(Boolean);
  const controls = createFields.map((f) => makeField(f, { prefix: `${type.id}-new`, files }));
  slotChildren(dialog, "fields").append(...controls.map((c) => c.el));
  layout.dialogs.append(dialog);
  const read = () => Object.fromEntries(controls.map((c) => [c.field.name, c.get()]));
  const validation = createValidation({ root: dialog, fields: createFields, get: (name) => read()[name] });
  const flow = createFlow({
    dialog,
    title: titleField.name,
    slug: slugField?.name ?? null,
    validation,
    read,
    create: (values) => data.create(type.id, { status: type.status?.[0], values: newValues(type, values) }),
    onCreated: (item) => (location.hash = itemHref(type, item)),
    onError: () => toast("Could not create. Try again.", "negative"),
  });
  screen.addEventListener("click", (event) => {
    const opener = event.target.closest('[data-action="create"]');
    if (opener) flow.open(opener);
  });

  let items = [];
  const searchIn = type.list.search ?? [type.list.title];
  function render() {
    const q = search.value.trim().toLowerCase();
    const shown = items.filter((it) => !q || searchIn.some((n) => display(type, n, it.values?.[n]).toLowerCase().includes(q)));
    repeat(rows, sortItems(shown, sort.value), (unit, it) =>
      fill(unit, {
        text: {
          title: itemTitle(type, it),
          subtitle: type.list.subtitle ? display(type, type.list.subtitle, it.values?.[type.list.subtitle]) : "",
          status: it.status ? cap(it.status) : "",
        },
        attrs: { href: itemHref(type, it), tone: it.status ? tone(type, it.status) : "neutral" },
      }),
    );
  }
  search.addEventListener("input", render);
  sort.addEventListener("change", render);

  const off = installShortcuts({ search: () => (screen.dataset.state === "ready" ? search : null) });
  current = {
    cleanup() {
      off();
      validation.destroy();
      if (dialog.open) dialog.close();
      dialog.remove();
    },
    dirty: () => false,
  };
  load();

  async function load() {
    try {
      items = await data.list(type.id);
    } catch (error) {
      if (token !== routeToken) return;
      if (isAuthError(error)) return authFailed(error);
      return showError(screen, { title: `Could not load ${label}`, text: CHECK, actions: [retryButton()] });
    }
    if (token !== routeToken) return;
    if (!items.length) {
      return showEmpty(screen, {
        icon: "#pn-icon-file",
        title: `No ${label} yet`,
        text: `Create the first ${type.singular}.`,
        actions: [button(`New ${type.singular}`, "create", "primary")],
      });
    }
    render();
    setState(screen, "ready");
  }
}

function item(type, id, token) {
  const screen = tpl("screen-item");
  const first = type.status?.[0];
  const crumbsFor = (last) => [
    { text: "Home", href: "#/" },
    { text: type.label, href: `#/${type.id}` },
    { text: last, href: location.hash },
  ];
  fill(screen, {
    text: { title: "Loading…", "loading-text": "Loading…", status: "", created: "", updated: "" },
    attrs: { state: "loading", "type-id": type.id, tone: "neutral" },
  });
  const statusButton = screen.querySelector('[data-action="status"]');
  statusButton.hidden = true;
  mountScreen(screen, { nav: `#/${type.id}`, crumbs: crumbsFor("Loading…") });

  let record = null;
  let saveState = null;
  let validation = null;
  let drawer = null;
  let deleted = false;
  const off = installShortcuts({ save: () => saveState?.save() });
  current = {
    cleanup() {
      off();
      saveState?.destroy();
      validation?.destroy();
      layout?.savebar.replaceChildren();
      drawer?.remove();
    },
    dirty: () => !deleted && Boolean(saveState?.dirty),
  };
  load();

  async function load() {
    try {
      record = await data.get(type.id, id);
    } catch (error) {
      if (token !== routeToken) return;
      if (isAuthError(error)) return authFailed(error);
      const missing = error?.code === "not-found";
      const last = missing ? "Not found" : "Could not load";
      setTitle(screen, last);
      setCrumbs(crumbsFor(last));
      return showError(
        screen,
        missing
          ? { title: `This ${type.singular} doesn't exist`, text: "It may have been deleted." }
          : { title: `Could not load this ${type.singular}`, text: CHECK, actions: [retryButton()] },
      );
    }
    if (token !== routeToken) return;
    ready();
  }

  // Header, status, and dates show the saved record, so they change on save, not while typing.
  function showRecord() {
    const title = itemTitle(type, record);
    setTitle(screen, title);
    setCrumbs(crumbsFor(title));
    if (type.status) fill(screen, { text: { status: cap(record.status) }, attrs: { tone: tone(type, record.status) } });
    fill(screen, { text: { created: formatDate(record.createdAt), updated: formatDate(record.updatedAt) } });
  }

  function ready() {
    const form = screen.querySelector("form");
    let controls = [];
    const plain = () => Object.fromEntries(controls.filter((c) => !c.field.compute).map((c) => [c.field.name, c.get()]));
    const read = () => Object.fromEntries(controls.map((c) => [c.field.name, c.get()]));
    controls = type.fields.map((f) => makeField(f, { prefix: type.id, files, computed, values: plain, root: form }));
    slotChildren(screen, "fields").append(...controls.map((c) => c.el));
    for (const c of controls) c.set(record.values?.[c.field.name]);

    // behavior: Show word count under the body field
    const counted = type.wordCount && controls.find((c) => c.field.name === type.wordCount);
    const updateWords = () => {
      if (counted) counted.el.querySelector('[data-slot="help"]').textContent = count(words(counted.get()), "word", "words");
    };
    counted?.el.addEventListener("input", updateWords);
    updateWords();

    const savebar = tpl("savebar");
    fill(savebar, { text: { message: "" }, attrs: { "save-state": "clean" } });
    layout.savebar.replaceChildren(savebar);

    validation = createValidation({ root: form, fields: type.fields, get: (name) => read()[name] });
    const publishes = (status) => Boolean(type.status) && status !== first;

    // V4 with the conformance fields added as required; V3 for saves in the first status.
    function blocked(status) {
      const mode = publishes(status) ? "publish" : "format";
      const invalid = validation.run(mode, publishes(status) ? type.publishRequires ?? [] : []);
      if (!invalid.length) return false;
      validation.focus(invalid[0]);
      saveState.say(fixMessage(invalid.length, publishes(status) ? "publish" : "save"));
      return true;
    }

    async function save(values, extra) {
      try {
        record = await data.update(type.id, record.id, { status: extra?.status ?? record.status, values });
      } catch (error) {
        if (isAuthError(error)) toast("You were signed out. Copy your edits, then reload to sign in.", "negative");
        throw error;
      }
      if (token === routeToken) showRecord();
    }

    saveState = createSaveState({
      form,
      savebar,
      read,
      write: (values) => {
        for (const c of controls) c.set(values[c.field.name]);
        updateWords();
      },
      save,
      validate: (values, { background, extra }) => (background ? validation.valid() : !blocked(extra?.status ?? record.status)),
      // behavior: Autosave drafts every 10 seconds
      autosave: type.autosave
        ? { every: type.autosave.every, when: () => !type.autosave.drafts || record.status === first }
        : undefined,
      onRevert: () => validation.clear(),
      errorMessage: (error) => (error?.code === "conflict" ? "Changed elsewhere. Copy your edits, then reload." : null),
    });

    async function pickStatus() {
      drawer = tpl("screen-slide-over");
      fill(drawer, { text: { title: "Status" } });
      const set = document.createElement("fieldset");
      set.className = "pn-choices";
      const legend = document.createElement("legend");
      legend.className = "pn-visually-hidden";
      legend.textContent = "Status";
      set.append(legend);
      for (const status of type.status) {
        const choice = document.createElement("label");
        choice.className = "pn-choice";
        const input = document.createElement("input");
        input.className = "pn-radio";
        input.type = "radio";
        input.name = "pn-status";
        input.value = status;
        input.checked = status === record.status;
        choice.append(input, cap(status));
        set.append(choice);
      }
      slotChildren(drawer, "body").append(set);
      layout.dialogs.append(drawer);
      const result = await openDialog(drawer, { opener: statusButton });
      const chosen = drawer.querySelector("input:checked")?.value;
      drawer.remove();
      drawer = null;
      return result === "done" ? chosen : null;
    }

    // P1–P5
    statusButton.addEventListener("click", async () => {
      if (saveState.state === "saving") return;
      const from = record.status;
      const to = type.status.length === 2 ? type.status.find((s) => s !== from) : await pickStatus();
      if (!to || to === from) return;
      if (publishes(to) && blocked(to)) return;
      // behavior: Publishing asks for confirmation
      if (type.confirmPublish && from === first) {
        const ok = await confirmDialog(layout.confirm, {
          title: `Publish this ${type.singular}?`,
          text: "It will be visible on the site.",
          confirmLabel: cap(to),
          opener: statusButton,
        });
        if (!ok) return;
      }
      const forward = type.status.indexOf(to) > type.status.indexOf(from);
      if (await saveState.save({ status: to })) {
        toast(forward ? `${cap(type.singular)} ${to}` : `${cap(type.singular)} moved to ${to}`, "positive");
      }
    });

    screen.querySelector('[data-action="delete"]').addEventListener("click", async (event) => {
      const ok = await confirmDialog(layout.confirm, {
        title: `Delete this ${type.singular}?`,
        text: "This can't be undone.",
        confirmLabel: "Delete",
        variant: "negative",
        opener: event.currentTarget,
      });
      if (!ok) return;
      try {
        await data.remove(type.id, record.id);
      } catch {
        return toast("Could not delete. Try again.", "negative");
      }
      deleted = true;
      toast(`${cap(type.singular)} deleted`);
      location.hash = `#/${type.id}`;
    });

    statusButton.hidden = !type.status;
    showRecord();
    setState(screen, "ready");
  }
}

function singletonScreen(def, token) {
  const screen = tpl("screen-singleton");
  fill(screen, {
    text: { title: def.label, "loading-text": "Loading…" },
    attrs: { state: "loading", "singleton-id": def.id },
  });
  mountScreen(screen, {
    nav: `#/${def.id}`,
    crumbs: [
      { text: "Home", href: "#/" },
      { text: def.label, href: `#/${def.id}` },
    ],
  });
  let saveState = null;
  let validation = null;
  const off = installShortcuts({ save: () => saveState?.save() });
  current = {
    cleanup() {
      off();
      saveState?.destroy();
      validation?.destroy();
      layout?.savebar.replaceChildren();
    },
    dirty: () => Boolean(saveState?.dirty),
  };
  load();

  async function load() {
    let record;
    try {
      record = await data.getSingleton(def.id);
    } catch (error) {
      if (token !== routeToken) return;
      if (isAuthError(error)) return authFailed(error);
      return showError(screen, { title: `Could not load ${def.label.toLowerCase()}`, text: CHECK, actions: [retryButton()] });
    }
    if (token !== routeToken) return;
    ready(record);
  }

  function ready(record) {
    const form = screen.querySelector("form");
    let controls = [];
    const plain = () => Object.fromEntries(controls.filter((c) => !c.field.compute).map((c) => [c.field.name, c.get()]));
    const read = () => Object.fromEntries(controls.map((c) => [c.field.name, c.get()]));
    controls = def.fields.map((f) => makeField(f, { prefix: def.id, files, computed, values: plain, root: form }));
    slotChildren(screen, "fields").append(...controls.map((c) => c.el));
    for (const c of controls) c.set(record?.values?.[c.field.name] ?? c.field.default ?? emptyValue(c.field));

    const savebar = tpl("savebar");
    fill(savebar, { text: { message: "" }, attrs: { "save-state": "clean" } });
    layout.savebar.replaceChildren(savebar);

    validation = createValidation({ root: form, fields: def.fields, get: (name) => read()[name] });
    saveState = createSaveState({
      form,
      savebar,
      read,
      write: (values) => {
        for (const c of controls) c.set(values[c.field.name]);
      },
      async save(values) {
        try {
          await data.saveSingleton(def.id, values);
        } catch (error) {
          if (isAuthError(error)) toast("You were signed out. Copy your edits, then reload to sign in.", "negative");
          throw error;
        }
      },
      // V7: a singleton save is blocked by empty required fields as well as format errors.
      validate: () => {
        const invalid = validation.run("required");
        if (!invalid.length) return true;
        validation.focus(invalid[0]);
        saveState.say(fixMessage(invalid.length, "save"));
        return false;
      },
      onRevert: () => validation.clear(),
      errorMessage: (error) => (error?.code === "conflict" ? "Changed elsewhere. Copy your edits, then reload." : null),
    });
    setState(screen, "ready");
  }
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

boot();
