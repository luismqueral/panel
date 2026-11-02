// Field Notes panel: routes, screens, and adapter wiring. The schema lives in panel.config.js.

import { PANEL } from "./panel.config.js";
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
if (adapters.test) window.panelTest = adapters.test;

const FORBIDDEN = "This account isn't allowed. Sign in with another one.";
const isAuthError = (error) => error?.code === "unauthorized" || error?.code === "forbidden";

// Any unauthorized or forbidden answer shows screen-login (recipes/contracts.md).
function guard(adapter) {
  const out = {};
  for (const [name, fn] of Object.entries(adapter)) {
    out[name] = async (...args) => {
      try {
        return await fn(...args);
      } catch (error) {
        if (isAuthError(error)) authLost(error);
        throw error;
      }
    };
  }
  return out;
}

const data = guard(adapters.data);
const files = guard(adapters.files);
const auth = adapters.auth;

// ---------- Helpers ----------

const app = document.getElementById("app");
const lower = (text) => text.toLowerCase();
const cap = (text) => text.charAt(0).toUpperCase() + text.slice(1);
const firstStatus = (type) => type.status?.[0];
const fieldOf = (def, name) => def.fields.find((f) => f.name === name);
const asText = (value) => (Array.isArray(value) ? value.join(", ") : value == null ? "" : String(value));
const countWords = (text) => (String(text ?? "").trim().match(/\S+/g) ?? []).length;

function toneOf(type, status) {
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

const titleOf = (type, values) => asText(values?.[type.list.title]).trim() || "Untitled";

function subtitleOf(type, item) {
  const name = type.list.subtitle;
  if (!name) return "";
  const value = item.values?.[name];
  return fieldOf(type, name).type === "date" ? formatDate(value) : asText(value);
}

function countLabel(type, n) {
  return `${n} ${n === 1 ? type.singular : lower(type.label)}`;
}

function button(text, { variant, action, onClick } = {}) {
  const el = document.createElement("button");
  el.className = "pn-button";
  el.type = "button";
  if (variant) el.dataset.variant = variant;
  if (action) el.dataset.action = action;
  el.textContent = text;
  if (onClick) el.addEventListener("click", onClick);
  return el;
}

function emptyState({ icon, title, text, actions = [] }) {
  const el = tpl("empty");
  fill(el, { text: { title, text }, attrs: { icon } });
  slotChildren(el, "actions").append(...actions);
  return el;
}

function errorState({ title, text, actions = [] }) {
  const el = tpl("error");
  fill(el, { text: { title, text } });
  slotChildren(el, "actions").append(...actions);
  return el;
}

const setState = (screen, state) => fill(screen, { attrs: { state } });

function showError(screen, title, { text = "Check your connection and try again.", onRetry = () => route() } = {}) {
  const actions = onRetry ? [button("Try again", { action: "retry", onClick: onRetry })] : [];
  slotChildren(screen, "error").replaceChildren(errorState({ title, text, actions }));
  setState(screen, "error");
}

function toast(text, tone) {
  if (shell) showToast(shell.toasts, text, { tone });
}

function confirmDiscard() {
  return confirmDialog(shell.confirm, {
    title: "Discard unsaved changes?",
    text: "Your edits will be lost.",
    confirmLabel: "Discard",
    variant: "negative",
  });
}

// ---------- Computed custom fields ----------

// reading_time, describe: "Read-only. Estimated minutes to read, from the word count of body."
const readingMinutes = (field, values) => Math.max(1, Math.ceil(countWords(values[field.sources[0]]) / 200));
const computedFor = (field) => ({
  value: (values) => readingMinutes(field, values),
  display: (values) => `${readingMinutes(field, values)} min`,
});

// ---------- Shell ----------

let shell = null;
let current = null;
let generation = 0;
let currentHash = location.hash;
let pending = null;

const homeCrumb = { text: "Home", href: "#/" };
const navEntries = [
  { text: "Home", href: "#/" },
  ...PANEL.types.map((t) => ({ text: t.label, href: `#/${t.id}` })),
  ...PANEL.singletons.map((s) => ({ text: s.label, href: `#/${s.id}` })),
];

function buildShell(user) {
  const layout = tpl("layout");
  const nav = tpl("nav");
  fill(nav, { text: { brand: PANEL.name } });
  repeat(slotRepeat(nav, "entry"), navEntries, (unit, e) =>
    fill(unit, { text: { text: e.text }, attrs: { href: e.href, current: "false" } }),
  );
  if (user) {
    const account = tpl("account");
    fill(account, { text: { user } });
    account.querySelector('[data-action="logout"]').addEventListener("click", logout);
    slotChildren(nav, "account").append(account);
  }
  slotChildren(layout, "nav").append(nav);
  const confirm = tpl("screen-dialog");
  slotChildren(layout, "dialogs").append(confirm);
  const main = layout.querySelector("#pn-main");
  layout.querySelector(".pn-skip").addEventListener("click", (event) => {
    event.preventDefault();
    main.focus();
  });
  app.replaceChildren(layout);
  shell = { layout, nav, main, confirm, dialogs: slotChildren(layout, "dialogs"), toasts: slotChildren(layout, "toasts") };
}

function setNav(href) {
  for (const link of shell.nav.querySelectorAll(".pn-nav-link")) {
    fill(link, { attrs: { current: link.getAttribute("href") === href ? "page" : "false" } });
  }
}

function setCrumbs(crumbs) {
  const header = tpl("header");
  repeat(slotRepeat(header, "crumb"), crumbs, (unit, c, i) =>
    fill(unit, { text: { text: c.text }, attrs: { href: c.href, current: i === crumbs.length - 1 ? "page" : "false" } }),
  );
  slotChildren(shell.layout, "header").replaceChildren(header);
  document.title = `${crumbs.at(-1).text} · ${PANEL.name}`;
}

function mount({ screen, crumbs, nav }) {
  setNav(nav);
  setCrumbs(crumbs);
  slotChildren(shell.layout, "screen").replaceChildren(screen);
  slotChildren(shell.layout, "savebar").replaceChildren();
}

function teardown() {
  current?.teardown?.();
  current = null;
}

// ---------- Login and session ----------

function showLogin(message = "") {
  teardown();
  generation++;
  shell = null;
  const screen = tpl("screen-login");
  fill(screen, { text: { title: PANEL.name, text: "Sign in to edit the site.", error: message } });
  app.replaceChildren(screen);
  document.title = `${PANEL.name}`;
  auth.renderMethods(slotChildren(screen, "methods"), {
    onSignedIn: () => start(),
    onError: (text) => fill(screen, { text: { error: text } }),
  });
}

function authLost(error) {
  if (!shell) return;
  if (current?.read) pending = { hash: currentHash, values: current.read() };
  showLogin(error.code === "forbidden" ? FORBIDDEN : "");
}

async function logout() {
  if (current?.dirty && !(await confirmDiscard())) return;
  try {
    await auth.logout();
  } catch {
    return toast("Could not log out. Try again.", "negative");
  }
  pending = null;
  showLogin();
}

async function start() {
  let session;
  try {
    session = await auth.session();
  } catch {
    buildShell(null);
    const screen = tpl("screen-home");
    fill(screen, { text: { title: PANEL.name, "loading-text": "Loading…" }, attrs: { state: "loading" } });
    mount({ screen, crumbs: [homeCrumb], nav: "#/" });
    return showError(screen, "Could not load the panel", { onRetry: () => start() });
  }
  if (!session?.user) return showLogin();
  buildShell(session.user);
  currentHash = location.hash;
  route();
}

// ---------- Routing ----------

const urlFor = (hash) => `${location.pathname}${location.search}${hash}`;

function go(hash) {
  teardown();
  location.hash = hash;
}

window.addEventListener("hashchange", async () => {
  if (!shell) return;
  const target = location.hash;
  // K6: hashes that do not start with #/ are in-page anchors, not routes.
  if (target && !target.startsWith("#/")) return;
  if (target === currentHash) return;
  if (current?.dirty) {
    history.replaceState(null, "", urlFor(currentHash));
    if (!(await confirmDiscard())) return;
    history.replaceState(null, "", urlFor(target));
  }
  currentHash = target;
  route();
  shell?.main.focus({ preventScroll: true });
});

function route() {
  teardown();
  const gen = ++generation;
  const parts = (currentHash || "#/").replace(/^#\/?/, "").split("/").filter(Boolean).map(decodeURIComponent);
  const [a, b, ...rest] = parts;
  if (!a) return homeScreen(gen);
  const type = PANEL.types.find((t) => t.id === a);
  if (type && !b) return collectionScreen(type, gen);
  if (type && !rest.length) return itemScreen(type, b, gen);
  const singleton = PANEL.singletons.find((s) => s.id === a);
  if (singleton && !b) return singletonScreen(singleton, gen);
  return notFoundScreen();
}

installShortcuts({
  save: () => current?.save?.(),
  search: () => current?.search?.(),
});

// ---------- Home ----------

function homeTemplate(title) {
  const screen = tpl("screen-home");
  fill(screen, {
    text: { title, "loading-text": "Loading…", "content-heading": "Content", "recent-heading": "Recently edited" },
    attrs: { state: "loading" },
  });
  repeat(slotRepeat(screen, "entry"), [], () => {});
  repeat(slotRepeat(screen, "recent"), [], () => {});
  return screen;
}

async function homeScreen(gen) {
  const screen = homeTemplate(PANEL.name);
  mount({ screen, crumbs: [homeCrumb], nav: "#/" });
  current = {};
  let lists;
  try {
    lists = await Promise.all(PANEL.types.map((t) => data.list(t.id)));
  } catch {
    if (gen === generation) showError(screen, "Could not load the panel");
    return;
  }
  if (gen !== generation) return;
  const entries = [
    ...PANEL.types.map((t, i) => ({ title: t.label, subtitle: countLabel(t, lists[i].length), href: `#/${t.id}` })),
    ...PANEL.singletons.map((s) => ({ title: s.label, subtitle: "Page", href: `#/${s.id}` })),
  ];
  repeat(slotRepeat(screen, "entry"), entries, (unit, e) =>
    fill(unit, { text: { title: e.title, subtitle: e.subtitle, meta: "" }, attrs: { href: e.href } }),
  );
  const recent = PANEL.types
    .flatMap((type, i) => lists[i].map((item) => ({ type, item })))
    .sort((x, y) => String(y.item.updatedAt).localeCompare(String(x.item.updatedAt)))
    .slice(0, 5);
  repeat(slotRepeat(screen, "recent"), recent, (unit, { type, item }) =>
    fill(unit, {
      text: { title: titleOf(type, item.values), subtitle: type.label, meta: formatDate(item.updatedAt) },
      attrs: { href: `#/${type.id}/${encodeURIComponent(item.id)}` },
    }),
  );
  setState(screen, "ready");
}

function notFoundScreen() {
  const screen = homeTemplate("Not found");
  mount({ screen, crumbs: [homeCrumb, { text: "Not found", href: currentHash }], nav: null });
  current = {};
  showError(screen, "This page doesn't exist", { text: "Check the address, or go back home.", onRetry: () => (location.hash = "#/") });
}

// ---------- Collection ----------

function sortOptions(type) {
  const options = [];
  if (type.list.sort) {
    const name = type.list.sort.replace(/^-/, "");
    const field = fieldOf(type, name);
    const isDate = field.type === "date";
    options.push(
      { value: `-${name}`, text: isDate ? "Newest first" : `${field.label}, descending` },
      { value: name, text: isDate ? "Oldest first" : `${field.label}, ascending` },
    );
  }
  if (!options.some((o) => o.value === type.list.title)) options.push({ value: type.list.title, text: "Title A–Z" });
  return options;
}

function comparer(type, sort) {
  const desc = sort.startsWith("-");
  const name = sort.replace(/^-/, "");
  const key = (item) => (name === type.list.title ? titleOf(type, item.values) : asText(item.values?.[name]));
  return (a, b) => {
    const x = key(a);
    const y = key(b);
    if (!x !== !y) return x ? -1 : 1;
    const order = x.localeCompare(y, "en", { numeric: true, sensitivity: "base" });
    return desc ? -order : order;
  };
}

function buildCreateFlow(type) {
  const dialog = tpl("screen-create");
  fill(dialog, { text: { title: `New ${type.singular}` } });
  // C1: only the list.title field, plus any slug made from it.
  const defs = type.fields.filter((f) => f.name === type.list.title || (f.type === "slug" && f.from === type.list.title));
  const controls = defs.map((f) => makeField(f, { prefix: `${type.id}-new`, files }));
  slotChildren(dialog, "fields").append(...controls.map((c) => c.el));
  shell.dialogs.append(dialog);
  const get = (name) => controls.find((c) => c.field.name === name).get();
  const validation = createValidation({ root: dialog, fields: defs, get });
  const defaults = Object.fromEntries(type.fields.filter((f) => "default" in f).map((f) => [f.name, f.default]));
  const flow = createFlow({
    dialog,
    title: type.list.title,
    slug: defs.find((f) => f.type === "slug")?.name ?? null,
    validation,
    read: () => Object.fromEntries(controls.map((c) => [c.field.name, c.get()])),
    create: (values) => data.create(type.id, { status: firstStatus(type), values: { ...defaults, ...values } }),
    onCreated: (item) => go(`#/${type.id}/${encodeURIComponent(item.id)}`),
    onError: () => toast("Could not create. Try again.", "negative"),
  });
  return {
    open: (opener) => flow.open(opener),
    destroy() {
      validation.destroy();
      dialog.remove();
    },
  };
}

async function collectionScreen(type, gen) {
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
  const options = sortOptions(type);
  const sortSelect = screen.querySelector("#pn-sort");
  const searchInput = screen.querySelector("#pn-search");
  repeat(sortSelect, options, (unit, o) => fill(unit, { text: { text: o.text }, attrs: { value: o.value } }));
  sortSelect.value = type.list.sort ?? options[0].value;
  mount({ screen, crumbs: [homeCrumb, { text: type.label, href: `#/${type.id}` }], nav: `#/${type.id}` });

  const create = buildCreateFlow(type);
  const openCreate = (event) => create.open(event.currentTarget);
  screen.querySelector('.pn-screen-actions [data-action="create"]').addEventListener("click", openCreate);
  current = {
    search: () => (screen.dataset.state === "ready" ? searchInput : null),
    teardown: () => create.destroy(),
  };

  let items = [];
  function render() {
    const q = searchInput.value.trim().toLowerCase();
    const fields = type.list.search ?? [type.list.title];
    const shown = items
      .filter((item) => !q || fields.some((name) => asText(item.values?.[name]).toLowerCase().includes(q)))
      .sort(comparer(type, sortSelect.value));
    repeat(slotRepeat(screen, "row"), shown, (unit, item) =>
      fill(unit, {
        text: { title: titleOf(type, item.values), subtitle: subtitleOf(type, item), status: type.status ? cap(item.status) : "" },
        attrs: { href: `#/${type.id}/${encodeURIComponent(item.id)}`, tone: type.status ? toneOf(type, item.status) : "" },
      }),
    );
  }
  searchInput.addEventListener("input", render);
  sortSelect.addEventListener("change", render);
  render();

  try {
    items = await data.list(type.id);
  } catch {
    if (gen === generation) showError(screen, `Could not load ${label}`);
    return;
  }
  if (gen !== generation) return;
  if (!items.length) {
    slotChildren(screen, "empty").replaceChildren(
      emptyState({
        icon: "#pn-icon-file",
        title: `No ${label} yet`,
        text: `Create the first ${type.singular}.`,
        actions: [button(`New ${type.singular}`, { variant: "primary", action: "create", onClick: openCreate })],
      }),
    );
    return setState(screen, "empty");
  }
  render();
  setState(screen, "ready");
}

// ---------- Item and singleton editors ----------

// Builds the fields, validation, save state, and save bar for a loaded item or singleton.
function buildEditor({ screen, def, prefix, values, save, autosave }) {
  const form = screen.querySelector("form");
  const controls = new Map();
  const sources = () =>
    Object.fromEntries([...controls].filter(([, c]) => !c.field.compute).map(([name, c]) => [name, c.get()]));
  const computed = Object.fromEntries(def.fields.filter((f) => f.compute).map((f) => [f.compute, computedFor(f)]));
  for (const field of def.fields) {
    const control = makeField(field, { prefix, files, computed, values: sources, root: form });
    controls.set(field.name, control);
    slotChildren(screen, "fields").append(control.el);
  }
  const read = () => Object.fromEntries(def.fields.map((f) => [f.name, controls.get(f.name).get()]));
  const write = (next) => {
    for (const f of def.fields) controls.get(f.name).set(next?.[f.name]);
    form.dispatchEvent(new CustomEvent("panel:written"));
  };
  write(values);

  const validation = createValidation({ root: form, fields: def.fields, get: (name) => controls.get(name).get() });
  const savebar = tpl("savebar");
  fill(savebar, { attrs: { "save-state": "clean" } });
  slotChildren(shell.layout, "savebar").replaceChildren(savebar);

  let saveState;
  const run = async (sent, extra) => {
    try {
      return await save(sent, extra);
    } catch (error) {
      if (error.code === "conflict") queueMicrotask(() => saveState.say("Changed elsewhere. Copy your edits, then reload."));
      if (error.code === "invalid") console.error(error);
      throw error;
    }
  };
  saveState = createSaveState({
    form,
    savebar,
    read,
    write,
    save: run,
    validate: (_, { background }) => {
      if (background) return validation.valid();
      const invalid = validation.run("format");
      if (invalid.length) validation.focus(invalid[0]);
      return !invalid.length;
    },
    autosave,
  });

  if (pending && pending.hash === currentHash) {
    write(pending.values);
    form.dispatchEvent(new Event("input"));
  }
  pending = null;

  return { form, controls, read, write, validation, saveState };
}

const behaviorWordCount = (editor, name) => {
  // behavior: Show word count under the body field
  const control = editor.controls.get(name);
  const help = control.el.querySelector(".pn-help");
  const update = () => {
    const n = countWords(control.get());
    help.textContent = `${n} ${n === 1 ? "word" : "words"}`;
  };
  editor.form.addEventListener("input", update);
  editor.form.addEventListener("panel:written", update);
  update();
};

async function itemScreen(type, id, gen) {
  const screen = tpl("screen-item");
  fill(screen, { text: { "loading-text": "Loading…" }, attrs: { state: "loading", "type-id": type.id } });
  const statusButton = screen.querySelector('[data-action="status"]');
  const deleteButton = screen.querySelector('[data-action="delete"]');
  if (!type.status) statusButton.hidden = true;
  const typeCrumb = { text: type.label, href: `#/${type.id}` };
  const crumbsFor = (text) => [homeCrumb, typeCrumb, { text, href: currentHash }];
  mount({ screen, crumbs: crumbsFor("Loading…"), nav: `#/${type.id}` });
  current = {};

  let item;
  try {
    item = await data.get(type.id, id);
  } catch (error) {
    if (gen !== generation) return;
    if (error.code === "not-found") {
      setCrumbs(crumbsFor("Not found"));
      return showError(screen, `This ${type.singular} doesn't exist`, { text: "It may have been deleted.", onRetry: null });
    }
    setCrumbs(crumbsFor(cap(type.singular)));
    return showError(screen, `Could not load this ${type.singular}`);
  }
  if (gen !== generation) return;

  let status = item.status;
  let shownTitle = titleOf(type, item.values);
  const showTitle = (title) => {
    shownTitle = title;
    fill(screen, { text: { title } });
    setCrumbs(crumbsFor(title));
  };
  const showStatus = () => {
    if (type.status) fill(screen, { text: { status: cap(status) }, attrs: { tone: toneOf(type, status) } });
  };
  const showMeta = () => fill(screen, { text: { created: formatDate(item.createdAt), updated: formatDate(item.updatedAt) } });
  showTitle(shownTitle);
  showStatus();
  showMeta();

  const editor = buildEditor({
    screen,
    def: type,
    prefix: type.id,
    values: item.values,
    save: async (values, extra) => {
      // S3: the status button and Delete stay enabled while saving.
      deleteButton.disabled = false;
      const next = extra?.status ?? status;
      item = await data.update(type.id, item.id, { status: next, values });
      status = item.status ?? next;
      showStatus();
      showMeta();
    },
    // behavior: Autosave drafts every 10 seconds
    autosave: type.autosave
      ? { every: type.autosave.every, when: () => !type.autosave.drafts || status === firstStatus(type) }
      : undefined,
  });
  const { form, controls, validation, saveState } = editor;
  if (type.wordCount) behaviorWordCount(editor, type.wordCount);

  form.addEventListener("input", () => {
    const title = titleOf(type, { [type.list.title]: controls.get(type.list.title).get() });
    if (title !== shownTitle) showTitle(title);
  });

  async function changeStatus() {
    if (!type.status) return;
    const statuses = type.status;
    const next = statuses.length === 2 ? statuses.find((s) => s !== status) : await pickStatus(type, status, statusButton);
    if (!next || next === status) return;
    const first = firstStatus(type);
    // V4 / P3: moving past the first status runs publish validation, with conformance fields added.
    if (next !== first) {
      const invalid = validation.run("publish", type.publishRequires ?? []);
      if (invalid.length) {
        validation.focus(invalid[0]);
        saveState.say(`Fix ${invalid.length} ${invalid.length === 1 ? "field" : "fields"} to publish`);
        return;
      }
    }
    // behavior: Publishing asks for confirmation
    if (status === first && type.confirmPublish) {
      const ok = await confirmDialog(shell.confirm, {
        title: `Publish this ${type.singular}?`,
        text: "It will be visible on the site.",
        confirmLabel: cap(next),
        opener: statusButton,
      });
      if (!ok) return;
    }
    const forward = statuses.indexOf(next) > statuses.indexOf(status);
    // P5: a status change saves immediately, with any unsaved edits.
    if (!(await saveState.save({ status: next }))) return;
    const name = cap(type.singular);
    toast(forward ? `${name} ${next}` : `${name} moved to ${next}`, forward && next === statuses.at(-1) ? "positive" : undefined);
  }
  statusButton.addEventListener("click", changeStatus);

  deleteButton.addEventListener("click", async () => {
    const ok = await confirmDialog(shell.confirm, {
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
      if (gen === generation) toast("Could not delete. Try again.", "negative");
      return;
    }
    toast(`${cap(type.singular)} deleted`);
    go(`#/${type.id}`);
  });

  current = {
    get dirty() {
      return saveState.dirty;
    },
    save: () => saveState.save(),
    read: editor.read,
    teardown() {
      saveState.destroy();
      validation.destroy();
    },
  };
  setState(screen, "ready");
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
  for (const s of type.status) {
    const label = document.createElement("label");
    label.className = "pn-choice";
    const input = document.createElement("input");
    input.className = "pn-radio";
    input.type = "radio";
    input.name = "pn-status";
    input.value = s;
    input.checked = s === status;
    label.append(input, cap(s));
    set.append(label);
  }
  slotChildren(drawer, "body").append(set);
  shell.dialogs.append(drawer);
  const result = await openDialog(drawer, { opener });
  const chosen = set.querySelector("input:checked")?.value;
  drawer.remove();
  return result === "done" ? chosen : null;
}

async function singletonScreen(def, gen) {
  const screen = tpl("screen-singleton");
  fill(screen, { text: { title: def.label, "loading-text": "Loading…" }, attrs: { state: "loading", "singleton-id": def.id } });
  mount({ screen, crumbs: [homeCrumb, { text: def.label, href: `#/${def.id}` }], nav: `#/${def.id}` });
  current = {};
  let record;
  try {
    record = await data.getSingleton(def.id);
  } catch {
    if (gen === generation) showError(screen, `Could not load ${lower(def.label)}`);
    return;
  }
  if (gen !== generation) return;
  const editor = buildEditor({
    screen,
    def,
    prefix: def.id,
    values: record?.values ?? {},
    save: async (values) => {
      record = await data.saveSingleton(def.id, values);
    },
  });
  current = {
    get dirty() {
      return editor.saveState.dirty;
    },
    save: () => editor.saveState.save(),
    read: editor.read,
    teardown() {
      editor.saveState.destroy();
      editor.validation.destroy();
    },
  };
  setState(screen, "ready");
}

start();
