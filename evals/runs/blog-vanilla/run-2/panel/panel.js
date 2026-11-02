// Field Notes panel: routes, screens, and adapter wiring. Behavior rules are in behavior-spec.md.

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

function createRecipeAdapters() {
  const request = createRequest();
  const { data, files } = createHttpAdapters(request);
  return { auth: createGoogleAuth(request), data, files };
}

const params = new URLSearchParams(location.search);
const adapters = params.has("test")
  ? createMemoryAdapters(await (await fetch("./seed.json")).json())
  : createRecipeAdapters();
if (adapters.test) window.panelTest = adapters.test;
const { auth, data, files } = adapters;

// ---------------------------------------------------------------- helpers

const app = document.getElementById("app");
const capital = (text) => text.charAt(0).toUpperCase() + text.slice(1);
const lower = (text) => text.toLowerCase();
const typeById = (id) => PANEL.types.find((t) => t.id === id);
const singletonById = (id) => PANEL.singletons.find((s) => s.id === id);
const fieldOf = (def, name) => def.fields.find((f) => f.name === name);
const itemHref = (type, item) => `#/${type.id}/${encodeURIComponent(item.id)}`;
const titleOf = (type, item) => item.values?.[type.list.title] || "Untitled";
const countOf = (type, n) => `${n} ${n === 1 ? type.singular : lower(type.label)}`;
const isAuthError = (error) => error?.code === "unauthorized" || error?.code === "forbidden";
const words = (text) => (text ?? "").trim().split(/\s+/).filter(Boolean).length;
const defaultsOf = (def) => Object.fromEntries(def.fields.filter((f) => "default" in f).map((f) => [f.name, f.default]));

function toneOf(type, status) {
  const index = type.status.indexOf(status);
  if (index === 0) return "neutral";
  if (index === type.status.length - 1) return "positive";
  return "notice";
}

const DATES = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });
function formatDate(value) {
  if (!value) return "";
  const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const date = day ? new Date(Number(day[1]), Number(day[2]) - 1, Number(day[3])) : new Date(value);
  return Number.isNaN(date.getTime()) ? "" : DATES.format(date);
}

const COMPUTED = {
  // describe: Read-only. Estimated minutes to read, from the word count of body.
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

function block(name, { icon, title, text, actions = [] }) {
  const el = tpl(name);
  fill(el, { text: { title, text }, attrs: icon ? { icon } : {} });
  slotChildren(el, "actions").append(...actions);
  return el;
}

const setState = (screen, state) => screen.setAttribute("data-state", state);

function showError(screen, title, text, actions = []) {
  slotChildren(screen, "error").replaceChildren(block("error", { title, text, actions }));
  setState(screen, "error");
}

function loadError(screen, title) {
  showError(screen, title, "Check your connection and try again.", [button("Try again", { action: "retry", onClick: () => route() })]);
}

const toast = (text, tone = "info") => shell && showToast(shell.toasts, text, { tone });

// ---------------------------------------------------------------- shell, login, routing

let shell = null;
let current = null;
let user = null;

function buildShell() {
  const layout = tpl("layout");
  const nav = tpl("nav");
  fill(nav, { text: { brand: PANEL.name } });
  const account = tpl("account");
  fill(account, { text: { user } });
  account.querySelector('[data-action="logout"]').addEventListener("click", logout);
  slotChildren(nav, "account").append(account);
  slotChildren(layout, "nav").append(nav);
  const confirm = tpl("screen-dialog");
  fill(confirm, { attrs: { variant: "primary" } });
  slotChildren(layout, "dialogs").append(confirm);
  app.replaceChildren(layout);
  shell = {
    layout,
    nav,
    account,
    confirm,
    header: slotChildren(layout, "header"),
    screen: slotChildren(layout, "screen"),
    savebar: slotChildren(layout, "savebar"),
    dialogs: slotChildren(layout, "dialogs"),
    toasts: slotChildren(layout, "toasts"),
  };
}

// keep: hide the panel instead of dropping it, so unsaved edits survive signing in again.
function showLogin(message = "", { keep = false, reroute = false } = {}) {
  app.querySelector(".pn-login")?.remove();
  if (shell && keep) shell.layout.hidden = true;
  else {
    leave();
    shell = null;
    app.replaceChildren();
  }
  const login = tpl("screen-login");
  fill(login, { text: { title: PANEL.name, text: "Sign in to edit the site.", error: message } });
  app.append(login);
  document.title = PANEL.name;
  auth.renderMethods(slotChildren(login, "methods"), {
    async onSignedIn() {
      const session = await auth.session().catch(() => null);
      if (!session?.user) return fill(login, { text: { error: "Could not sign in. Try again." } });
      user = session.user;
      login.remove();
      if (shell) {
        shell.layout.hidden = false;
        fill(shell.account, { text: { user } });
        if (reroute) route();
      } else {
        buildShell();
        route();
      }
    },
    onError: (text) => fill(login, { text: { error: text } }),
  });
}

function handleAuth(error, options = {}) {
  if (!isAuthError(error)) return false;
  showLogin(error.code === "forbidden" ? "This account isn't allowed. Sign in with another one." : "", { keep: true, ...options });
  return true;
}

async function logout() {
  if (current?.dirty?.() && !(await confirmDiscard())) return;
  try {
    await auth.logout();
  } catch {
    return toast("Could not log out. Try again.", "negative");
  }
  showLogin();
}

function confirmDiscard() {
  return confirmDialog(shell.confirm, { title: "Discard unsaved changes?", text: "Your edits will be lost.", confirmLabel: "Discard", variant: "negative" });
}

function renderNav(href) {
  const entries = [
    { text: "Home", href: "#/" },
    ...PANEL.types.map((t) => ({ text: t.label, href: `#/${t.id}` })),
    ...PANEL.singletons.map((s) => ({ text: s.label, href: `#/${s.id}` })),
  ];
  repeat(slotRepeat(shell.nav, "entry"), entries, (unit, e) =>
    fill(unit, { text: { text: e.text }, attrs: { href: e.href, current: e.href === href ? "page" : "false" } }),
  );
}

function renderHeader(crumbs) {
  const header = tpl("header");
  repeat(slotRepeat(header, "crumb"), crumbs, (unit, c, i) =>
    fill(unit, { text: { text: c.text }, attrs: { href: c.href, current: i === crumbs.length - 1 ? "page" : "false" } }),
  );
  shell.header.replaceChildren(header);
  document.title = `${crumbs.at(-1).text} · ${PANEL.name}`;
}

const HOME = { text: "Home", href: "#/" };

function screen(name, attrs, title) {
  const el = tpl(name);
  fill(el, { text: { title, "loading-text": "Loading…" }, attrs: { state: "loading", ...attrs } });
  shell.screen.replaceChildren(el);
  return el;
}

function leave() {
  if (!current) return;
  current.destroy?.();
  for (const dialog of current.dialogs) dialog.remove();
  shell?.savebar.replaceChildren();
  current = null;
}

function route() {
  leave();
  const hash = location.hash.startsWith("#/") ? location.hash : "#/";
  const cur = (current = { hash, dialogs: [] });
  let parts;
  try {
    parts = hash.slice(2).split("/").filter(Boolean).map(decodeURIComponent);
  } catch {
    parts = [null, null, null];
  }
  const [first, second, ...rest] = parts;
  if (!first && !second) return renderHome(cur);
  const type = typeById(first);
  if (type && !second) return renderCollection(cur, type);
  if (type && !rest.length) return renderItem(cur, type, second);
  const single = singletonById(first);
  if (single && !second) return renderSingleton(cur, single);
  renderNotFound(cur);
}

async function onHashChange() {
  if (!shell) return;
  if (location.hash && !location.hash.startsWith("#/")) return; // in-page anchor, such as the skip link (K6)
  const target = location.hash || "#/";
  if (current && target === current.hash) return;
  if (current?.dirty?.()) {
    history.replaceState(null, "", current.hash);
    if (!(await confirmDiscard())) return;
    leave();
    location.hash = target;
    return;
  }
  route();
}

// ---------------------------------------------------------------- home and not found

async function renderHome(cur) {
  renderNav("#/");
  renderHeader([HOME]);
  const el = screen("screen-home", {}, PANEL.name);
  fill(el, { text: { "content-heading": "Content", "recent-heading": "Recently edited" } });
  let lists;
  try {
    lists = await Promise.all(PANEL.types.map((t) => data.list(t.id)));
  } catch (error) {
    if (cur !== current || handleAuth(error, { reroute: true })) return;
    return loadError(el, "Could not load the panel");
  }
  if (cur !== current) return;
  const entries = [
    ...PANEL.types.map((t, i) => ({ title: t.label, subtitle: countOf(t, lists[i].length), href: `#/${t.id}` })),
    ...PANEL.singletons.map((s) => ({ title: s.label, subtitle: "Page", href: `#/${s.id}` })),
  ];
  repeat(slotRepeat(el, "entry"), entries, (unit, e) =>
    fill(unit, { text: { title: e.title, subtitle: e.subtitle, meta: "" }, attrs: { href: e.href } }),
  );
  const recent = lists
    .flatMap((items, i) => items.map((item) => ({ type: PANEL.types[i], item })))
    .sort((a, b) => String(b.item.updatedAt).localeCompare(String(a.item.updatedAt)))
    .slice(0, 5);
  repeat(slotRepeat(el, "recent"), recent, (unit, { type, item }) =>
    fill(unit, { text: { title: titleOf(type, item), subtitle: type.label, meta: formatDate(item.updatedAt) }, attrs: { href: itemHref(type, item) } }),
  );
  setState(el, "ready");
}

function renderNotFound(cur) {
  renderNav(null);
  renderHeader([HOME, { text: "Not found", href: cur.hash }]);
  const el = screen("screen-home", {}, "Not found");
  repeat(slotRepeat(el, "entry"), [], () => {});
  repeat(slotRepeat(el, "recent"), [], () => {});
  showError(el, "This page doesn't exist", "Check the address, or go back home.", [
    button("Try again", { action: "retry", onClick: () => (location.hash = "#/") }),
  ]);
}

// ---------------------------------------------------------------- collection and create flow

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
  options.push({ value: type.list.title, text: "Title A–Z" });
  return options;
}

function compareBy(sort) {
  const desc = sort.startsWith("-");
  const name = sort.replace(/^-/, "");
  return (a, b) => {
    const x = a.values?.[name];
    const y = b.values?.[name];
    const blankX = x === undefined || x === null || x === "";
    const blankY = y === undefined || y === null || y === "";
    if (blankX || blankY) return blankX - blankY;
    const order = typeof x === "number" && typeof y === "number" ? x - y : String(x ?? "").localeCompare(String(y ?? ""), undefined, { sensitivity: "base" });
    return desc ? -order : order;
  };
}

function subtitleOf(type, item) {
  const name = type.list.subtitle;
  if (!name) return "";
  const value = item.values?.[name];
  if (fieldOf(type, name).type === "date") return formatDate(value);
  return Array.isArray(value) ? value.join(", ") : String(value ?? "");
}

async function renderCollection(cur, type) {
  const href = `#/${type.id}`;
  const label = lower(type.label);
  renderNav(href);
  renderHeader([HOME, { text: type.label, href }]);
  const el = screen("screen-collection", { "type-id": type.id }, type.label);
  fill(el, {
    text: { "create-label": `New ${type.singular}`, "search-label": `Search ${label}`, "sort-label": "Sort by" },
    attrs: { "search-placeholder": `Search ${label}` },
  });
  const search = el.querySelector("#pn-search");
  const sort = el.querySelector("#pn-sort");
  repeat(sort, sortOptions(type), (unit, o) => fill(unit, { text: { text: o.text }, attrs: { value: o.value } }));
  sort.value = type.list.sort ?? type.list.title;

  const create = createDialog(cur, type);
  el.addEventListener("click", (event) => {
    const opener = event.target.closest('[data-action="create"]');
    if (opener) create.flow.open(opener);
  });
  cur.destroy = create.destroy;
  cur.search = () => (el.getAttribute("data-state") === "ready" ? search : null);

  let items;
  try {
    items = await data.list(type.id);
  } catch (error) {
    if (cur !== current || handleAuth(error, { reroute: true })) return;
    return loadError(el, `Could not load ${label}`);
  }
  if (cur !== current) return;
  if (!items.length) {
    slotChildren(el, "empty").replaceChildren(
      block("empty", {
        icon: "#pn-icon-file",
        title: `No ${label} yet`,
        text: `Create the first ${type.singular}.`,
        actions: [button(`New ${type.singular}`, { action: "create", variant: "primary" })],
      }),
    );
    return setState(el, "empty");
  }

  const rows = slotRepeat(el, "row");
  function render() {
    const query = search.value.trim().toLowerCase();
    const shown = items
      .filter((item) => !query || (type.list.search ?? []).some((name) => String(item.values?.[name] ?? "").toLowerCase().includes(query)))
      .sort(compareBy(sort.value));
    repeat(rows, shown, (unit, item) =>
      fill(unit, {
        text: { title: titleOf(type, item), subtitle: subtitleOf(type, item), status: type.status ? capital(item.status) : "" },
        attrs: { href: itemHref(type, item), tone: type.status ? toneOf(type, item.status) : "" },
      }),
    );
  }
  search.addEventListener("input", render);
  sort.addEventListener("change", render);
  render();
  setState(el, "ready");
}

function createDialog(cur, type) {
  const dialog = tpl("screen-create");
  fill(dialog, { text: { title: `New ${type.singular}` } });
  const titleField = fieldOf(type, type.list.title);
  const slugField = type.fields.find((f) => f.type === "slug" && f.from === titleField.name);
  const defs = [titleField, slugField].filter(Boolean);
  const controls = defs.map((f) => makeField(f, { prefix: `${type.id}-new`, files }));
  const byName = Object.fromEntries(controls.map((c) => [c.field.name, c]));
  slotChildren(dialog, "fields").append(...controls.map((c) => c.el));
  shell.dialogs.append(dialog);
  cur.dialogs.push(dialog);
  const validation = createValidation({ root: dialog, fields: defs, get: (name) => byName[name].get() });
  const flow = createFlow({
    dialog,
    title: titleField.name,
    slug: slugField?.name ?? null,
    validation,
    read: () => Object.fromEntries(controls.map((c) => [c.field.name, c.get()])),
    async create(values) {
      try {
        return await data.create(type.id, { status: type.status?.[0], values: { ...defaultsOf(type), ...values } });
      } catch (error) {
        if (isAuthError(error)) {
          dialog.close();
          handleAuth(error);
        }
        throw error;
      }
    },
    onCreated: (item) => (location.hash = itemHref(type, item)),
    onError: () => toast("Could not create. Try again.", "negative"),
  });
  return { flow, destroy: () => validation.destroy() };
}

// ---------------------------------------------------------------- item and singleton forms

// The fields of one item or singleton, in schema order, inside the screen's form.
function buildForm(el, def, prefix) {
  const form = el.querySelector("form.pn-item");
  const plain = () => Object.fromEntries(controls.filter((c) => c.field.type !== "custom").map((c) => [c.field.name, c.get()]));
  const controls = def.fields.map((f) => makeField(f, { prefix, files, computed: COMPUTED, values: plain, root: form }));
  const byName = Object.fromEntries(controls.map((c) => [c.field.name, c]));
  slotChildren(el, "fields").append(...controls.map((c) => c.el));

  const afterWrite = [];
  // behavior: Show word count under the body field
  if (def.wordCount) {
    const body = byName[def.wordCount];
    const update = () => {
      const n = words(body.get());
      fill(body.el, { text: { help: `${n} ${n === 1 ? "word" : "words"}` } });
    };
    body.el.addEventListener("input", update);
    afterWrite.push(update);
  }

  const validation = createValidation({
    root: form,
    fields: def.fields.filter((f) => f.type !== "custom"),
    get: (name) => byName[name].get(),
  });
  return {
    form,
    validation,
    read: () => Object.fromEntries(controls.map((c) => [c.field.name, c.get()])),
    write(values) {
      for (const c of controls) c.set(values?.[c.field.name]);
      for (const fn of afterWrite) fn();
    },
  };
}

function mountSavebar() {
  const savebar = tpl("savebar");
  fill(savebar, { attrs: { "save-state": "clean" } });
  shell.savebar.replaceChildren(savebar);
  return savebar;
}

function formatGate(validation) {
  return (values, { background }) => {
    if (background) return validation.valid();
    const invalid = validation.run("format");
    if (invalid.length) validation.focus(invalid[0]);
    return !invalid.length;
  };
}

function saveFailed(error, getSaveState) {
  if (handleAuth(error)) return;
  if (error?.code === "invalid") console.error(error.message);
  if (error?.code === "conflict") setTimeout(() => getSaveState()?.say("Changed elsewhere. Copy your edits, then reload."));
}

async function renderItem(cur, type, id) {
  const listHref = `#/${type.id}`;
  const Singular = capital(type.singular);
  renderNav(listHref);
  renderHeader([HOME, { text: type.label, href: listHref }]);
  const el = screen("screen-item", { "type-id": type.id }, type.label);
  const statusButton = el.querySelector('[data-action="status"]');
  statusButton.hidden = true;

  let item;
  try {
    item = await data.get(type.id, id);
  } catch (error) {
    if (cur !== current || handleAuth(error, { reroute: true })) return;
    if (error?.code === "not-found") {
      fill(el, { text: { title: "Not found" } });
      renderHeader([HOME, { text: type.label, href: listHref }, { text: "Not found", href: cur.hash }]);
      return showError(el, `This ${type.singular} doesn't exist`, "It may have been deleted.");
    }
    fill(el, { text: { title: type.label } });
    return loadError(el, `Could not load this ${type.singular}`);
  }
  if (cur !== current) return;

  let status = item.status;
  const first = type.status?.[0];
  const { form, validation, read, write } = buildForm(el, type, type.id);
  write(item.values);

  function renderTitle() {
    const title = titleOf(type, item);
    fill(el, { text: { title, created: formatDate(item.createdAt), updated: formatDate(item.updatedAt) } });
    renderHeader([HOME, { text: type.label, href: listHref }, { text: title, href: cur.hash }]);
  }
  function renderStatus() {
    if (!type.status) return;
    statusButton.hidden = false;
    fill(el, { text: { status: capital(status) }, attrs: { tone: toneOf(type, status) } });
  }
  renderTitle();
  renderStatus();

  const deleteButton = el.querySelector('[data-action="delete"]');
  const publishing = (next) => Boolean(type.status) && next !== first;

  function publishReady() {
    const invalid = validation.run("publish", type.publishRequires ?? []);
    if (!invalid.length) return true;
    validation.focus(invalid[0]);
    saveState.say(`Fix ${invalid.length} ${invalid.length === 1 ? "field" : "fields"} to publish`);
    return false;
  }

  const formOnly = formatGate(validation);
  const saveState = createSaveState({
    form,
    savebar: mountSavebar(),
    read,
    write,
    async save(values, extra) {
      // S3: the header's status button and Delete stay enabled while saving.
      deleteButton.disabled = false;
      const next = extra?.status ?? status;
      try {
        item = await data.update(type.id, item.id, { status: next, values });
      } catch (error) {
        saveFailed(error, () => saveState);
        throw error;
      }
      status = item.status ?? next;
      renderTitle();
    },
    validate(values, { background, extra }) {
      if (!background && extra?.status && publishing(extra.status)) return publishReady();
      return formOnly(values, { background });
    },
    // behavior: Autosave drafts every 10 seconds
    autosave: type.autosave && {
      every: type.autosave.every,
      when: () => !type.autosave.drafts || status === first,
    },
  });

  async function changeStatus(next) {
    if (!next || next === status) return;
    const forward = type.status.indexOf(next) > type.status.indexOf(status);
    if (publishing(next)) {
      if (!publishReady()) return;
      // behavior: Publishing asks for confirmation
      if (
        type.confirmPublish &&
        !(await confirmDialog(shell.confirm, { title: `Publish this ${type.singular}?`, text: "It will be visible on the site.", confirmLabel: capital(next), opener: statusButton }))
      )
        return;
    }
    if (!(await saveState.save({ status: next }))) return;
    renderStatus();
    toast(forward ? `${Singular} ${next}` : `${Singular} moved to ${next}`, forward ? "positive" : "info");
  }

  async function pickStatus() {
    const drawer = tpl("screen-slide-over");
    fill(drawer, { text: { title: "Status" } });
    const choices = document.createElement("fieldset");
    choices.className = "pn-choices";
    const legend = document.createElement("legend");
    legend.className = "pn-visually-hidden";
    legend.textContent = "Status";
    choices.append(
      legend,
      ...type.status.map((name) => {
        const choice = document.createElement("label");
        choice.className = "pn-choice";
        const radio = document.createElement("input");
        radio.className = "pn-radio";
        radio.type = "radio";
        radio.name = "pn-status";
        radio.value = name;
        radio.checked = name === status;
        choice.append(radio, capital(name));
        return choice;
      }),
    );
    slotChildren(drawer, "body").append(choices);
    shell.dialogs.append(drawer);
    cur.dialogs.push(drawer);
    const result = await openDialog(drawer, { opener: statusButton });
    const picked = choices.querySelector("input:checked")?.value;
    drawer.remove();
    if (result === "done") changeStatus(picked);
  }

  statusButton.addEventListener("click", () => {
    if (type.status.length > 2) return pickStatus();
    changeStatus(type.status.find((s) => s !== status));
  });

  deleteButton.addEventListener("click", async () => {
    const ok = await confirmDialog(shell.confirm, { title: `Delete this ${type.singular}?`, text: "This can't be undone.", confirmLabel: "Delete", variant: "negative", opener: deleteButton });
    if (!ok) return;
    try {
      await data.remove(type.id, item.id);
    } catch (error) {
      if (handleAuth(error)) return;
      return toast("Could not delete. Try again.", "negative");
    }
    toast(`${Singular} deleted`);
    leave();
    location.hash = listHref;
  });

  cur.dirty = () => saveState.dirty;
  cur.save = () => saveState.save();
  cur.destroy = () => {
    saveState.destroy();
    validation.destroy();
  };
  setState(el, "ready");
}

async function renderSingleton(cur, def) {
  const href = `#/${def.id}`;
  renderNav(href);
  renderHeader([HOME, { text: def.label, href }]);
  const el = screen("screen-singleton", { "singleton-id": def.id }, def.label);

  let record;
  try {
    record = await data.getSingleton(def.id);
  } catch (error) {
    if (cur !== current || handleAuth(error, { reroute: true })) return;
    return loadError(el, `Could not load ${lower(def.label)}`);
  }
  if (cur !== current) return;

  const { form, validation, read, write } = buildForm(el, def, def.id);
  write(record?.values ?? defaultsOf(def));
  const saveState = createSaveState({
    form,
    savebar: mountSavebar(),
    read,
    write,
    async save(values) {
      try {
        await data.saveSingleton(def.id, values);
      } catch (error) {
        saveFailed(error, () => saveState);
        throw error;
      }
    },
    validate: formatGate(validation),
  });

  cur.dirty = () => saveState.dirty;
  cur.save = () => saveState.save();
  cur.destroy = () => {
    saveState.destroy();
    validation.destroy();
  };
  setState(el, "ready");
}

// ---------------------------------------------------------------- start

installShortcuts({ save: () => current?.save?.(), search: () => current?.search?.() });
window.addEventListener("hashchange", onHashChange);

try {
  const session = await auth.session();
  if (session?.user) {
    user = session.user;
    buildShell();
    route();
  } else {
    showLogin();
  }
} catch {
  showLogin("Could not reach the panel. Check your connection and reload.");
}
