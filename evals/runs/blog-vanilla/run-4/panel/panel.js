// Field Notes panel: routes, screens, and adapter wiring. Built from panel.config.js.

import { PANEL } from "./panel.config.js";
import { tpl, fill, repeat, slotRepeat, slotChildren } from "./snippets/templates.js";
import { makeField } from "./snippets/fields.js";
import { createSaveState } from "./snippets/save-state.js";
import { createValidation, check } from "./snippets/validation.js";
import { confirmDialog } from "./snippets/dialogs.js";
import { createFlow } from "./snippets/create-flow.js";
import { installShortcuts } from "./snippets/keyboard.js";
import { showToast } from "./snippets/toast.js";
import { createMemoryAdapters } from "./adapters/memory.js";
import { createRequest } from "./adapters/http.js";
import { createAuthAdapter } from "./adapters/google-login.js";
import { createDataAdapter } from "./adapters/json-files.js";
import { createFilesAdapter } from "./adapters/local-disk.js";

// ---------- Adapters ----------

function createRecipeAdapters() {
  const request = createRequest();
  return { auth: createAuthAdapter(request), data: createDataAdapter(request), files: createFilesAdapter(request) };
}

const params = new URLSearchParams(location.search);
const memory = params.has("test") ? createMemoryAdapters(await (await fetch("./seed.json")).json()) : null;
const { auth, data, files } = memory ?? createRecipeAdapters();

if (memory) {
  window.panelTest = {
    ...memory.test,
    reset(seed) {
      memory.test.reset(seed);
      boot();
    },
  };
}

// ---------- Words and values ----------

const app = document.getElementById("app");
const HOME = { text: "Home", href: "#/" };

const cap = (text) => text.charAt(0).toUpperCase() + text.slice(1);
const count = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const countWords = (text) => (text ?? "").trim().split(/\s+/).filter(Boolean).length;

function formatDate(value) {
  if (!value) return "";
  const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const date = day ? new Date(Number(day[1]), Number(day[2]) - 1, Number(day[3])) : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function toneOf(statuses, status) {
  const i = statuses.indexOf(status);
  if (i <= 0) return "neutral";
  return i === statuses.length - 1 ? "positive" : "notice";
}

const titleOf = (type, item) => item.values?.[type.list.title] || "Untitled";
const itemHref = (type, item) => `#/${type.id}/${encodeURIComponent(item.id)}`;
const defaultsOf = (type) => Object.fromEntries(type.fields.filter((f) => "default" in f).map((f) => [f.name, f.default]));

// describe: Read-only. Estimated minutes to read, from the word count of body.
const readingMinutes = (values) => Math.max(1, Math.ceil(countWords(values.body) / 200));
const COMPUTED = {
  readingTime: { value: readingMinutes, display: (values) => `${readingMinutes(values)} min` },
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

// ---------- Shell, login, and routing ----------

let shell = null;
let login = null;
let view = null;
let currentHash = "#/";
let bypass = false;
let generation = 0;

const NAV = [
  { key: "home", text: "Home", href: "#/" },
  ...PANEL.types.map((t) => ({ key: t.id, text: t.label, href: `#/${t.id}` })),
  ...PANEL.singletons.map((s) => ({ key: s.id, text: s.label, href: `#/${s.id}` })),
];

function buildShell(user) {
  const layout = tpl("layout");
  const nav = tpl("nav");
  fill(nav, { text: { brand: PANEL.name } });
  const account = tpl("account");
  fill(account, { text: { user } });
  account.querySelector('[data-action="logout"]').addEventListener("click", logout);
  slotChildren(nav, "account").append(account);
  slotChildren(layout, "nav").append(nav);
  const header = tpl("header");
  slotChildren(layout, "header").append(header);
  const confirm = tpl("screen-dialog");
  slotChildren(layout, "dialogs").append(confirm);
  app.replaceChildren(layout);
  shell = {
    layout,
    nav,
    account,
    header,
    confirm,
    title: PANEL.name,
    screen: slotChildren(layout, "screen"),
    savebar: slotChildren(layout, "savebar"),
    dialogs: slotChildren(layout, "dialogs"),
    toasts: slotChildren(layout, "toasts"),
  };
}

function setChrome(navKey, crumbs) {
  repeat(slotRepeat(shell.nav, "entry"), NAV, (unit, e) =>
    fill(unit, { text: { text: e.text }, attrs: { href: e.href, current: e.key === navKey ? "page" : "false" } }),
  );
  repeat(slotRepeat(shell.header, "crumb"), crumbs, (unit, c, i) =>
    fill(unit, { text: { text: c.text }, attrs: { href: c.href, current: i === crumbs.length - 1 ? "page" : "false" } }),
  );
  shell.title = `${crumbs.at(-1).text} · ${PANEL.name}`;
  document.title = shell.title;
}

const toast = (text, tone) => shell && showToast(shell.toasts, text, tone ? { tone } : undefined);

function showLogin(message = "") {
  if (login) return fill(login, { text: { error: message } });
  shell?.layout.remove();
  login = tpl("screen-login");
  fill(login, { text: { title: PANEL.name, text: "Sign in to edit the site.", error: message } });
  app.append(login);
  document.title = PANEL.name;
  auth.renderMethods(slotChildren(login, "methods"), {
    onSignedIn: async () => {
      let session = null;
      try {
        session = await auth.session();
      } catch {}
      if (!login) return;
      if (!session?.user) return fill(login, { text: { error: "Could not sign in. Try again." } });
      login.remove();
      login = null;
      if (shell) {
        fill(shell.account, { text: { user: session.user } });
        app.append(shell.layout);
        // Unsaved edits were kept while signed out; leave them on screen to be saved.
        if (view?.dirty) document.title = shell.title;
        else render();
      } else {
        buildShell(session.user);
        render();
      }
    },
    onError: (text) => login && fill(login, { text: { error: text } }),
  });
}

// Returns true when the error means the person has to sign in again.
function authProblem(error) {
  if (error?.code === "unauthorized") return showLogin(), true;
  if (error?.code === "forbidden") return showLogin("This account isn't allowed. Sign in with another one."), true;
  return false;
}

function teardown() {
  view?.destroy?.();
  view = null;
  if (!shell) return;
  shell.screen.replaceChildren();
  shell.savebar.replaceChildren();
}

async function boot() {
  generation++;
  teardown();
  shell = null;
  login = null;
  app.replaceChildren();
  let session;
  try {
    session = await auth.session();
  } catch {
    return showLogin("Could not reach the panel. Check your connection and reload.");
  }
  if (!session?.user) return showLogin();
  buildShell(session.user);
  render();
}

const discardOk = () =>
  confirmDialog(shell.confirm, {
    title: "Discard unsaved changes?",
    text: "Your edits will be lost.",
    confirmLabel: "Discard",
    variant: "negative",
  });

async function logout() {
  if (view?.dirty && !(await discardOk())) return;
  try {
    await auth.logout();
  } catch {
    return toast("Could not log out. Try again.", "negative");
  }
  generation++;
  teardown();
  shell = null;
  app.replaceChildren();
  showLogin();
}

// Hashes that do not start with "#/" are in-page anchors (the skip link), not routes.
window.addEventListener("hashchange", async () => {
  if (!shell || login) return;
  const hash = location.hash;
  if (!hash.startsWith("#/") || hash === currentHash) return;
  if (bypass) {
    bypass = false;
    return render();
  }
  if (view?.dirty) {
    history.replaceState(null, "", currentHash);
    if (!(await discardOk())) return;
    return go(hash);
  }
  render();
});

function go(hash) {
  if (location.hash === hash) return render();
  bypass = true;
  location.hash = hash;
}

function render() {
  if (!shell) return;
  teardown();
  const hash = location.hash.startsWith("#/") ? location.hash : "#/";
  currentHash = hash;
  const my = ++generation;
  let parts;
  try {
    parts = hash.slice(2).split("/").filter(Boolean).map(decodeURIComponent);
  } catch {
    return notFoundScreen();
  }
  const type = PANEL.types.find((t) => t.id === parts[0]);
  const singleton = PANEL.singletons.find((s) => s.id === parts[0]);
  if (parts.length === 0) return homeScreen(my);
  if (type && parts.length === 1) return collectionScreen(type, my);
  if (type && parts.length === 2) return itemScreen(type, parts[1], my);
  if (singleton && parts.length === 1) return singletonScreen(singleton, my);
  return notFoundScreen();
}

const live = (my) => my === generation;
const mount = (screen) => shell.screen.replaceChildren(screen);

function showError(screen, title, text, retry) {
  const box = tpl("error");
  fill(box, { text: { title, text } });
  if (retry) slotChildren(box, "actions").append(button("Try again", { action: "retry", onClick: retry }));
  slotChildren(screen, "error").replaceChildren(box);
  fill(screen, { attrs: { state: "error" } });
}

const setState = (screen, state) => fill(screen, { attrs: { state } });

installShortcuts({
  save: () => !login && view?.save?.(),
  search: () => (login ? null : view?.search?.()),
});

// ---------- Home and not found ----------

function homeTemplate(title) {
  const screen = tpl("screen-home");
  fill(screen, {
    text: { title, "loading-text": "Loading…", "content-heading": "Content", "recent-heading": "Recently edited" },
    attrs: { state: "loading" },
  });
  return screen;
}

async function homeScreen(my) {
  const screen = homeTemplate(PANEL.name);
  mount(screen);
  setChrome("home", [HOME]);
  try {
    const lists = await Promise.all(PANEL.types.map((t) => data.list(t.id)));
    if (!live(my)) return;
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
      .flatMap((type, i) => lists[i].map((item) => ({ type, item })))
      .sort((a, b) => (b.item.updatedAt ?? "").localeCompare(a.item.updatedAt ?? ""))
      .slice(0, 5);
    repeat(slotRepeat(screen, "recent"), recent, (unit, { type, item }) =>
      fill(unit, {
        text: { title: titleOf(type, item), subtitle: type.label, meta: formatDate(item.updatedAt) },
        attrs: { href: itemHref(type, item) },
      }),
    );
    setState(screen, "ready");
  } catch (error) {
    if (!live(my) || authProblem(error)) return;
    showError(screen, "Could not load the panel", "Check your connection and try again.", render);
  }
}

function notFoundScreen() {
  const screen = homeTemplate("Not found");
  repeat(slotRepeat(screen, "entry"), [], () => {});
  repeat(slotRepeat(screen, "recent"), [], () => {});
  mount(screen);
  setChrome(null, [HOME, { text: "Not found", href: currentHash }]);
  showError(screen, "This page doesn't exist", "Check the address, or go back home.", () => go("#/"));
}

// ---------- Collection and create flow ----------

function sortOptions(type) {
  const options = [];
  if (type.list.sort) {
    const name = type.list.sort.replace(/^-/, "");
    const field = type.fields.find((f) => f.name === name);
    const [down, up] = field.type === "date" ? ["Newest first", "Oldest first"] : [`${field.label}, descending`, `${field.label}, ascending`];
    options.push({ value: `-${name}`, text: down }, { value: name, text: up });
  }
  options.push({ value: type.list.title, text: "Title A–Z" });
  return options;
}

function visibleItems(type, items, query, sort) {
  const q = query.trim().toLowerCase();
  const search = type.list.search ?? [];
  const found = q ? items.filter((item) => search.some((name) => String(item.values?.[name] ?? "").toLowerCase().includes(q))) : [...items];
  const desc = sort.startsWith("-");
  const name = sort.replace(/^-/, "");
  const key = (item) => (name === type.list.title ? titleOf(type, item) : String(item.values?.[name] ?? ""));
  return found.sort((a, b) => {
    const order = key(a).localeCompare(key(b), "en", { numeric: true, sensitivity: "base" });
    return desc ? -order : order;
  });
}

function subtitleOf(type, item) {
  const name = type.list.subtitle;
  if (!name) return "";
  const field = type.fields.find((f) => f.name === name);
  const value = item.values?.[name];
  return field?.type === "date" ? formatDate(value) : String(value ?? "");
}

function createFlowFor(type) {
  const dialog = tpl("screen-create");
  fill(dialog, { text: { title: `New ${type.singular}` } });
  const titleField = type.fields.find((f) => f.name === type.list.title);
  const slugField = type.fields.find((f) => f.type === "slug" && f.from === titleField.name);
  const fields = [titleField, slugField].filter(Boolean);
  const controls = fields.map((f) => makeField(f, { prefix: `${type.id}-new`, files }));
  slotChildren(dialog, "fields").append(...controls.map((c) => c.el));
  shell.dialogs.append(dialog);
  const validation = createValidation({
    root: dialog,
    fields,
    get: (name) => controls.find((c) => c.field.name === name).get(),
  });
  const flow = createFlow({
    dialog,
    title: titleField.name,
    slug: slugField?.name ?? null,
    validation,
    read: () => Object.fromEntries(controls.map((c) => [c.field.name, c.get()])),
    create: async (values) => {
      try {
        return await data.create(type.id, { status: type.status?.[0], values: { ...defaultsOf(type), ...values } });
      } catch (error) {
        if (error?.code === "unauthorized" || error?.code === "forbidden") {
          dialog.close();
          authProblem(error);
        }
        throw error;
      }
    },
    onCreated: (item) => go(itemHref(type, item)),
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

async function collectionScreen(type, my) {
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
  const options = sortOptions(type);
  repeat(slotRepeat(screen, "sort-option"), options, (unit, o) => fill(unit, { text: { text: o.text }, attrs: { value: o.value } }));
  const search = screen.querySelector("#pn-search");
  const sort = screen.querySelector("#pn-sort");
  sort.value = type.list.sort ?? options[0].value;
  mount(screen);
  setChrome(type.id, [HOME, { text: type.label, href: `#/${type.id}` }]);

  const flow = createFlowFor(type);
  view = {
    dirty: false,
    search: () => (screen.dataset.state === "ready" ? search : null),
    destroy: flow.destroy,
  };
  screen.querySelector('[data-action="create"]').addEventListener("click", (event) => flow.open(event.currentTarget));

  let items = [];
  const draw = () =>
    repeat(slotRepeat(screen, "row"), visibleItems(type, items, search.value, sort.value), (unit, item) =>
      fill(unit, {
        text: { title: titleOf(type, item), subtitle: subtitleOf(type, item), status: item.status ? cap(item.status) : "" },
        attrs: { href: itemHref(type, item), tone: type.status ? toneOf(type.status, item.status) : "" },
      }),
    );
  search.addEventListener("input", draw);
  sort.addEventListener("change", draw);

  try {
    items = await data.list(type.id);
  } catch (error) {
    if (!live(my) || authProblem(error)) return;
    return showError(screen, `Could not load ${label}`, "Check your connection and try again.", render);
  }
  if (!live(my)) return;
  if (!items.length) {
    const empty = tpl("empty");
    fill(empty, { text: { title: `No ${label} yet`, text: `Create the first ${type.singular}.` }, attrs: { icon: "#pn-icon-file" } });
    slotChildren(empty, "actions").append(
      button(`New ${type.singular}`, { action: "create", variant: "primary", onClick: (event) => flow.open(event.currentTarget) }),
    );
    slotChildren(screen, "empty").replaceChildren(empty);
    return setState(screen, "empty");
  }
  draw();
  setState(screen, "ready");
}

// ---------- Item and singleton editors ----------

// Wraps the files adapter for one field, so contract errors show the contract's words.
function filesFor(form, field) {
  return {
    async upload(file) {
      try {
        return await files.upload(file);
      } catch (error) {
        if (error?.code === "too-large") {
          setTimeout(() => fill(form.querySelector(`[data-field="${field.name}"]`), { text: { error: "That file is too large." } }));
        }
        authProblem(error);
        throw error;
      }
    },
  };
}

// The fields, validation, and save state shared by item and singleton screens.
function createEditor({ screen, def, prefix, values, save, autosave, publishRequires = [] }) {
  const form = screen.querySelector("form.pn-item");
  const grid = slotChildren(screen, "fields");
  const controls = new Map();
  const sources = () => Object.fromEntries([...controls].filter(([, c]) => !c.field.compute).map(([name, c]) => [name, c.get()]));
  for (const field of def.fields) {
    const control = makeField(field, { prefix, files: filesFor(form, field), computed: COMPUTED, values: sources, root: form });
    controls.set(field.name, control);
    grid.append(control.el);
  }
  const read = () => Object.fromEntries([...controls].map(([name, c]) => [name, c.get()]));

  // behavior: Show word count under the body field
  const wordField = def.wordCount && controls.get(def.wordCount.field);
  const showWords = () => wordField && fill(wordField.el, { text: { help: count(countWords(wordField.get()), "word", "words") } });
  form.addEventListener("input", showWords);

  const write = (next) => {
    for (const [name, c] of controls) c.set(next[name]);
    showWords();
  };
  write(values);

  const validation = createValidation({ root: form, fields: def.fields, get: (name) => controls.get(name).get() });
  let publishShown = false;

  const savebar = tpl("savebar");
  fill(savebar, { text: { message: "" }, attrs: { "save-state": "clean" } });
  shell.savebar.replaceChildren(savebar);

  const saveState = createSaveState({
    form,
    savebar,
    read,
    write,
    save,
    autosave,
    // V3: saving is blocked only by format errors. Errors from a failed publish stay shown until fixed.
    validate(current, { background }) {
      if (background) return validation.valid();
      validation.run(publishShown ? "publish" : "format", publishShown ? publishRequires : []);
      const bad = def.fields.filter((f) => check(f, current[f.name], "format"));
      if (bad.length) validation.focus(bad[0].name);
      return bad.length === 0;
    },
    onRevert() {
      publishShown = false;
      validation.clear();
    },
  });

  // V4: every invalid field shows its error and the first one receives focus.
  function checkPublish() {
    const invalid = validation.run("publish", publishRequires);
    publishShown = invalid.length > 0;
    if (!invalid.length) return true;
    validation.focus(invalid[0]);
    saveState.say(`Fix ${count(invalid.length, "field", "fields")} to publish`);
    return false;
  }

  return {
    form,
    read,
    saveState,
    checkPublish,
    published: () => (publishShown = false),
    destroy() {
      saveState.destroy();
      validation.destroy();
    },
  };
}

async function itemScreen(type, id, my) {
  const singular = type.singular;
  const screen = tpl("screen-item");
  fill(screen, { text: { title: "", "loading-text": "Loading…", status: "" }, attrs: { state: "loading", "type-id": type.id, tone: "neutral" } });
  const statusButton = screen.querySelector('[data-action="status"]');
  statusButton.hidden = true;
  mount(screen);
  const crumbs = (title) => [HOME, { text: type.label, href: `#/${type.id}` }, ...(title ? [{ text: title, href: currentHash }] : [])];
  setChrome(type.id, crumbs(null));
  view = { dirty: false };

  let item;
  try {
    item = await data.get(type.id, id);
  } catch (error) {
    if (!live(my) || authProblem(error)) return;
    if (error?.code === "not-found") return showError(screen, `This ${singular} doesn't exist`, "It may have been deleted.", null);
    return showError(screen, `Could not load this ${singular}`, "Check your connection and try again.", render);
  }
  if (!live(my)) return;

  const first = type.status?.[0];
  let status = item.status;

  function showItem() {
    const title = titleOf(type, item);
    fill(screen, {
      text: { title, created: formatDate(item.createdAt), updated: formatDate(item.updatedAt), status: status ? cap(status) : "" },
      attrs: { tone: type.status ? toneOf(type.status, status) : "" },
    });
    setChrome(type.id, crumbs(title));
  }

  // P1: types without status show no status button.
  statusButton.hidden = !type.status;
  showItem();

  const editor = createEditor({
    screen,
    def: type,
    prefix: type.id,
    values: item.values ?? {},
    publishRequires: type.publishRequires,
    // behavior: Autosave drafts every 10 seconds
    autosave: type.autosave && { every: type.autosave.every, when: () => !type.autosave.drafts || status === first },
    async save(values, extra) {
      const nextStatus = extra?.status ?? status;
      try {
        item = await data.update(type.id, id, { status: nextStatus, values });
        status = item.status ?? nextStatus;
        showItem();
      } catch (error) {
        if (error?.code === "conflict") editor.saveState.say("Changed elsewhere. Copy your edits, then reload.");
        if (error?.code === "invalid") console.error(error);
        authProblem(error);
        throw error;
      }
    },
  });
  const { form, saveState } = editor;

  // S3: Delete stays enabled while a save runs; the save-state snippet locks every form control.
  const deleteButton = form.querySelector('[data-action="delete"]');
  const keepDelete = new MutationObserver(() => deleteButton.disabled && (deleteButton.disabled = false));
  keepDelete.observe(deleteButton, { attributes: true, attributeFilter: ["disabled"] });

  // P2–P5. With two statuses the button moves to the other one.
  statusButton.addEventListener("click", async () => {
    if (!type.status || saveState.state === "saving") return;
    const from = type.status.indexOf(status);
    const next = type.status[from === 0 ? 1 : 0];
    const to = type.status.indexOf(next);
    if (from === 0 && to > 0) {
      if (!editor.checkPublish()) return;
      // behavior: Publishing asks for confirmation
      if (type.confirmPublish) {
        const ok = await confirmDialog(shell.confirm, {
          title: `Publish this ${singular}?`,
          text: "It will be visible on the site.",
          confirmLabel: cap(next),
          opener: statusButton,
        });
        if (!ok) return;
      }
    }
    if (!(await saveState.save({ status: next }))) return;
    editor.published();
    toast(to > from ? `${cap(singular)} ${next}` : `${cap(singular)} moved to ${next}`);
  });

  deleteButton.addEventListener("click", async () => {
    const ok = await confirmDialog(shell.confirm, {
      title: `Delete this ${singular}?`,
      text: "This can't be undone.",
      confirmLabel: "Delete",
      variant: "negative",
      opener: deleteButton,
    });
    if (!ok) return;
    try {
      await data.remove(type.id, id);
    } catch (error) {
      if (!authProblem(error)) toast("Could not delete. Try again.", "negative");
      return;
    }
    toast(`${cap(singular)} deleted`);
    go(`#/${type.id}`);
  });

  view = {
    get dirty() {
      return saveState.dirty;
    },
    save: () => saveState.save(),
    destroy() {
      keepDelete.disconnect();
      editor.destroy();
    },
  };
  setState(screen, "ready");
}

async function singletonScreen(def, my) {
  const screen = tpl("screen-singleton");
  fill(screen, { text: { title: def.label, "loading-text": "Loading…" }, attrs: { state: "loading", "singleton-id": def.id } });
  mount(screen);
  setChrome(def.id, [HOME, { text: def.label, href: `#/${def.id}` }]);
  view = { dirty: false };

  let record;
  try {
    record = await data.getSingleton(def.id);
  } catch (error) {
    if (!live(my) || authProblem(error)) return;
    return showError(screen, `Could not load ${def.label.toLowerCase()}`, "Check your connection and try again.", render);
  }
  if (!live(my)) return;

  const editor = createEditor({
    screen,
    def,
    prefix: def.id,
    values: record?.values ?? {},
    async save(values) {
      try {
        await data.saveSingleton(def.id, values);
      } catch (error) {
        if (error?.code === "invalid") console.error(error);
        authProblem(error);
        throw error;
      }
    },
  });
  view = {
    get dirty() {
      return editor.saveState.dirty;
    },
    save: () => editor.saveState.save(),
    destroy: editor.destroy,
  };
  setState(screen, "ready");
}

boot();
