// Field Notes panel: routes, screens, and adapter wiring (build.md steps 3 to 6).

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

// ---------------------------------------------------------------- adapters

function createRecipeAdapters() {
  const request = createRequest();
  const { data, files } = createHttpAdapters(request);
  return { data, files, auth: createGoogleAuth(request) };
}

const idle = () => ({ cleanup() {}, dirty: () => false });
let current = idle();

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

// ---------------------------------------------------------------- helpers

const app = document.getElementById("app");
const typeById = new Map(PANEL.types.map((t) => [t.id, t]));
const singletonById = new Map(PANEL.singletons.map((s) => [s.id, s]));
const capital = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const lower = (s) => s.toLowerCase();
const isSignedOut = (error) => error?.code === "unauthorized" || error?.code === "forbidden";

const DATE = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });
function formatDate(value) {
  if (!value) return "";
  const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const date = day ? new Date(Number(day[1]), Number(day[2]) - 1, Number(day[3])) : new Date(value);
  return Number.isNaN(date.getTime()) ? "" : DATE.format(date);
}

function fieldOf(type, name) {
  return type.fields.find((f) => f.name === name);
}

function titleOf(type, values) {
  const value = values?.[type.list.title];
  return typeof value === "string" && value.trim() ? value : "Untitled";
}

function subtitleOf(type, values) {
  const name = type.list.subtitle;
  if (!name) return "";
  const value = values?.[name];
  if (value === null || value === undefined) return "";
  if (fieldOf(type, name)?.type === "date") return formatDate(value);
  return Array.isArray(value) ? value.join(", ") : String(value);
}

function toneOf(type, status) {
  const i = type.status.indexOf(status);
  if (i <= 0) return "neutral";
  return i === type.status.length - 1 ? "positive" : "notice";
}

function count(n, singular, plural) {
  return `${n} ${n === 1 ? singular : plural}`;
}

function words(text) {
  return (text ?? "").trim().split(/\s+/).filter(Boolean).length;
}

// Computed custom fields, by their `compute` name (build.md step 4).
const computed = {
  // describe: Read-only. Estimated minutes to read, from the word count of body.
  readingTime: {
    value: (values) => Math.max(1, Math.ceil(words(values.body) / 200)),
    display: (values) => `${Math.max(1, Math.ceil(words(values.body) / 200))} min`,
  },
};

function button(text, { variant, action } = {}) {
  const b = document.createElement("button");
  b.className = "pn-button";
  b.type = "button";
  if (variant) b.dataset.variant = variant;
  if (action) b.dataset.action = action;
  b.textContent = text;
  return b;
}

function emptyBlock({ icon, title, text, actions = [] }) {
  const el = tpl("empty");
  fill(el, { text: { title, text }, attrs: { icon } });
  slotChildren(el, "actions").append(...actions);
  return el;
}

function errorBlock({ title, text, actions = [] }) {
  const el = tpl("error");
  fill(el, { text: { title, text } });
  slotChildren(el, "actions").append(...actions);
  return el;
}

function retryButton(onClick) {
  const b = button("Try again", { action: "retry" });
  b.addEventListener("click", onClick);
  return b;
}

function setState(screen, state) {
  fill(screen, { attrs: { state } });
}

// ---------------------------------------------------------------- shell

let shell = null;

function mountShell(user) {
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
  fill(confirm, { attrs: { variant: "primary" } });
  const drawer = tpl("screen-slide-over");
  slotChildren(layout, "dialogs").append(confirm, drawer);

  app.replaceChildren(layout);
  shell = {
    layout,
    nav,
    header,
    confirm,
    drawer,
    screen: slotChildren(layout, "screen"),
    savebar: slotChildren(layout, "savebar"),
    dialogs: slotChildren(layout, "dialogs"),
    toasts: slotChildren(layout, "toasts"),
  };
}

function setNav(href) {
  const entries = [
    { text: "Home", href: "#/" },
    ...PANEL.types.map((t) => ({ text: t.label, href: `#/${t.id}` })),
    ...PANEL.singletons.map((s) => ({ text: s.label, href: `#/${s.id}` })),
  ];
  repeat(slotRepeat(shell.nav, "entry"), entries, (unit, e) =>
    fill(unit, { text: { text: e.text }, attrs: { href: e.href, current: e.href === href ? "page" : "false" } }),
  );
}

function setCrumbs(crumbs) {
  repeat(slotRepeat(shell.header, "crumb"), crumbs, (unit, c, i) =>
    fill(unit, { text: { text: c.text }, attrs: { href: c.href, current: i === crumbs.length - 1 ? "page" : "false" } }),
  );
  document.title = `${crumbs[crumbs.length - 1].text} · ${PANEL.name}`;
}

function toast(text, tone) {
  if (shell) showToast(shell.toasts, text, { tone });
}

// S9: the confirm asked before leaving a screen with unsaved changes.
function discard() {
  return confirmDialog(shell.confirm, {
    title: "Discard unsaved changes?",
    text: "Your edits will be lost.",
    confirmLabel: "Discard",
    variant: "negative",
  });
}

async function logout() {
  if (current.dirty() && !(await discard())) return;
  try {
    await auth.logout();
  } catch {
    toast("Could not log out. Try again.", "negative");
    return;
  }
  current.cleanup();
  showLogin();
}

// ---------------------------------------------------------------- login

function showLogin({ error = "", refused = false } = {}) {
  current.cleanup();
  current = idle();
  shell = null;
  const login = tpl("screen-login");
  fill(login, { text: { title: PANEL.name, text: "Sign in to edit the site.", error } });
  app.replaceChildren(login);
  document.title = `Sign in · ${PANEL.name}`;
  if (error) return;
  const errorSlot = login.querySelector('[data-slot="error"]');
  if (refused) errorSlot.textContent = "This account isn't allowed. Sign in with another one.";
  auth.renderMethods(slotChildren(login, "methods"), {
    onSignedIn: () => route(),
    onError: (message) => (errorSlot.textContent = message),
  });
}

function signedOutOnLoad(error) {
  showLogin({ refused: error.code === "forbidden" });
}

// ---------------------------------------------------------------- routing

let lastHash = location.hash; // route() sets it each time it renders
let routeToken = 0;

async function route() {
  lastHash = location.hash;
  const token = ++routeToken;
  if (!shell) {
    let session;
    try {
      session = await auth.session();
    } catch {
      if (token === routeToken) showLogin({ error: "Could not reach the panel. Check your connection and reload." });
      return;
    }
    if (token !== routeToken) return;
    if (!session) return showLogin();
    mountShell(session.user);
  }
  const live = () => token === routeToken && shell;
  const parts = (location.hash || "#/").slice(2).split("/").filter(Boolean).map(decodeURIComponent);
  shell.savebar.replaceChildren();
  if (parts.length === 0) current = homeScreen(live);
  else if (parts.length === 1 && typeById.has(parts[0])) current = collectionScreen(typeById.get(parts[0]), live);
  else if (parts.length === 2 && typeById.has(parts[0])) current = itemScreen(typeById.get(parts[0]), parts[1], live);
  else if (parts.length === 1 && singletonById.has(parts[0])) current = singletonScreen(singletonById.get(parts[0]), live);
  else current = notFoundScreen();
}

function rerun() {
  current.cleanup();
  route();
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

installShortcuts({ save: () => current.save?.(), search: () => current.search?.() });

// ---------------------------------------------------------------- home

function homeScreen(live) {
  const screen = tpl("screen-home");
  fill(screen, {
    text: { title: PANEL.name, "content-heading": "Content", "recent-heading": "Recently edited", "loading-text": "Loading…" },
    attrs: { state: "loading" },
  });
  shell.screen.replaceChildren(screen);
  setNav("#/");
  setCrumbs([{ text: "Home", href: "#/" }]);

  (async () => {
    let lists;
    try {
      lists = await Promise.all(PANEL.types.map((t) => data.list(t.id)));
    } catch (error) {
      if (!live()) return;
      if (isSignedOut(error)) return signedOutOnLoad(error);
      slotChildren(screen, "error").replaceChildren(
        errorBlock({ title: "Could not load the panel", text: "Check your connection and try again.", actions: [retryButton(rerun)] }),
      );
      return setState(screen, "error");
    }
    if (!live()) return;
    const entries = [
      ...PANEL.types.map((t, i) => ({ title: t.label, subtitle: count(lists[i].length, t.singular, lower(t.label)), href: `#/${t.id}` })),
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
    setState(screen, "ready");
  })();

  return idle();
}

// ---------------------------------------------------------------- not found

function notFoundScreen() {
  const screen = tpl("screen-home");
  fill(screen, { text: { title: "Not found", "loading-text": "Loading…" }, attrs: { state: "error" } });
  repeat(slotRepeat(screen, "entry"), [], () => {});
  repeat(slotRepeat(screen, "recent"), [], () => {});
  slotChildren(screen, "error").append(
    errorBlock({
      title: "This page doesn't exist",
      text: "Check the address, or go back home.",
      actions: [retryButton(() => (location.hash = "#/"))],
    }),
  );
  shell.screen.replaceChildren(screen);
  setNav(null);
  setCrumbs([
    { text: "Home", href: "#/" },
    { text: "Not found", href: location.hash },
  ]);
  return idle();
}

// ---------------------------------------------------------------- collection

function sortOptions(type) {
  const name = type.list.sort.replace(/^-/, "");
  const field = fieldOf(type, name);
  const isDate = field?.type === "date";
  return [
    { value: `-${name}`, text: isDate ? "Newest first" : `${field.label}, descending` },
    { value: name, text: isDate ? "Oldest first" : `${field.label}, ascending` },
    { value: type.list.title, text: "Title A–Z" },
  ];
}

function sortItems(items, sort) {
  const desc = sort.startsWith("-");
  const name = sort.replace(/^-/, "");
  const blank = (v) => v === null || v === undefined || v === "" || (Array.isArray(v) && !v.length);
  return [...items].sort((a, b) => {
    const x = a.values?.[name];
    const y = b.values?.[name];
    if (blank(x) && blank(y)) return 0;
    if (blank(x)) return 1;
    if (blank(y)) return -1;
    const order = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), "en", { sensitivity: "base" });
    return desc ? -order : order;
  });
}

function collectionScreen(type, live) {
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
  const search = screen.querySelector("#pn-search");
  const sort = screen.querySelector("#pn-sort");
  repeat(slotRepeat(screen, "sort-option"), sortOptions(type), (unit, o) => fill(unit, { text: { text: o.text }, attrs: { value: o.value } }));
  sort.value = type.list.sort;
  shell.screen.replaceChildren(screen);
  setNav(`#/${type.id}`);
  setCrumbs([
    { text: "Home", href: "#/" },
    { text: type.label, href: `#/${type.id}` },
  ]);

  const dialog = createDialog(type);
  shell.dialogs.append(dialog.el);
  const openCreate = (event) => dialog.flow.open(event.currentTarget);
  screen.querySelector('.pn-screen-actions [data-action="create"]').addEventListener("click", openCreate);

  let items = [];
  function render() {
    const q = search.value.trim().toLowerCase();
    const shown = sortItems(
      items.filter((item) => !q || type.list.search?.some((name) => String(item.values?.[name] ?? "").toLowerCase().includes(q))),
      sort.value,
    );
    repeat(slotRepeat(screen, "row"), shown, (unit, item) =>
      fill(unit, {
        text: { title: titleOf(type, item.values), subtitle: subtitleOf(type, item.values), status: item.status ? capital(item.status) : "" },
        attrs: { href: `#/${type.id}/${encodeURIComponent(item.id)}`, tone: type.status ? toneOf(type, item.status) : "" },
      }),
    );
  }
  search.addEventListener("input", render);
  sort.addEventListener("change", render);

  (async () => {
    try {
      items = await data.list(type.id);
    } catch (error) {
      if (!live()) return;
      if (isSignedOut(error)) return signedOutOnLoad(error);
      slotChildren(screen, "error").replaceChildren(
        errorBlock({ title: `Could not load ${label}`, text: "Check your connection and try again.", actions: [retryButton(rerun)] }),
      );
      return setState(screen, "error");
    }
    if (!live()) return;
    if (!items.length) {
      const create = button(`New ${type.singular}`, { variant: "primary", action: "create" });
      create.addEventListener("click", openCreate);
      slotChildren(screen, "empty").replaceChildren(
        emptyBlock({ icon: "#pn-icon-file", title: `No ${label} yet`, text: `Create the first ${type.singular}.`, actions: [create] }),
      );
      return setState(screen, "empty");
    }
    render();
    setState(screen, "ready");
  })();

  return {
    cleanup() {
      if (dialog.el.open) dialog.el.close();
      dialog.cleanup();
      dialog.el.remove();
    },
    dirty: () => false,
    search: () => (screen.getAttribute("data-state") === "ready" ? search : null),
  };
}

// C1: the create dialog asks for list.title, plus any slug made from it.
function createDialog(type) {
  const el = tpl("screen-create");
  fill(el, { text: { title: `New ${type.singular}` } });
  const titleField = fieldOf(type, type.list.title);
  const slugField = type.fields.find((f) => f.type === "slug" && f.from === type.list.title) ?? null;
  const asked = [titleField, slugField].filter(Boolean);
  const controls = asked.map((f) => makeField(f, { prefix: `${type.id}-new`, files }));
  slotChildren(el, "fields").append(...controls.map((c) => c.el));
  const get = (name) => controls.find((c) => c.field.name === name)?.get();
  const validation = createValidation({ root: el, fields: asked, get });
  const defaults = Object.fromEntries(type.fields.filter((f) => f.default !== undefined).map((f) => [f.name, f.default]));
  const flow = createFlow({
    dialog: el,
    title: titleField.name,
    slug: slugField?.name ?? null,
    validation,
    read: () => Object.fromEntries(controls.map((c) => [c.field.name, c.get()])),
    create: (values) => data.create(type.id, { status: type.status?.[0], values: { ...defaults, ...values } }),
    onCreated: (item) => (location.hash = `#/${type.id}/${encodeURIComponent(item.id)}`),
    onError: () => toast("Could not create. Try again.", "negative"),
  });
  return { el, flow, cleanup: () => validation.destroy() };
}

// ---------------------------------------------------------------- item and singleton forms

// Builds the fields of a form, with values() for computed fields (every value except computed ones).
function buildFields(def, form, prefix) {
  const controls = [];
  const values = () => Object.fromEntries(controls.filter((c) => !c.field.compute).map((c) => [c.field.name, c.get()]));
  for (const field of def.fields) {
    controls.push(makeField(field, { prefix, files, computed, values, root: form }));
  }
  slotChildren(form, "fields").append(...controls.map((c) => c.el));
  return {
    controls,
    read: () => Object.fromEntries(controls.map((c) => [c.field.name, c.get()])),
    write: (v) => controls.forEach((c) => c.set(v?.[c.field.name] ?? null)),
    get: (name) => controls.find((c) => c.field.name === name)?.get(),
  };
}

// behavior: Show word count under the body field
function wireWordCount(def, form) {
  const name = def.wordCount;
  if (!name) return () => {};
  const root = form.querySelector(`[data-field="${name}"]`);
  const input = root.querySelector("textarea, input");
  const help = root.querySelector('[data-slot="help"]');
  const update = () => (help.textContent = count(words(input.value), "word", "words"));
  input.addEventListener("input", update);
  update();
  return update;
}

function savebarFor() {
  const savebar = tpl("savebar");
  fill(savebar, { attrs: { "save-state": "clean" } });
  shell.savebar.replaceChildren(savebar);
  return savebar;
}

// Save failures: signed out keeps every edit and says so; conflict and invalid as contracts.md says.
function onSaveError(error, say) {
  if (isSignedOut(error)) toast("You were signed out. Copy your edits, then reload to sign in.", "negative");
  else if (error?.code === "conflict") queueMicrotask(() => say("Changed elsewhere. Copy your edits, then reload."));
  else if (error?.code === "invalid") console.error(error);
}

function itemScreen(type, id, live) {
  const singular = type.singular;
  const first = type.status?.[0];
  const screen = tpl("screen-item");
  fill(screen, { text: { title: "Loading…", "loading-text": "Loading…" }, attrs: { state: "loading", "type-id": type.id } });
  const statusButton = screen.querySelector('[data-action="status"]');
  statusButton.hidden = !type.status;
  shell.screen.replaceChildren(screen);
  setNav(`#/${type.id}`);
  const crumbs = (last) =>
    setCrumbs([
      { text: "Home", href: "#/" },
      { text: type.label, href: `#/${type.id}` },
      { text: last, href: `#/${type.id}/${encodeURIComponent(id)}` },
    ]);
  crumbs("Loading…");

  const state = { cleanup: [], dirty: () => false, save: null };
  const handle = {
    cleanup: () => state.cleanup.forEach((fn) => fn()),
    dirty: () => state.dirty(),
    save: () => state.save?.(),
  };

  (async () => {
    let item;
    try {
      item = await data.get(type.id, id);
    } catch (error) {
      if (!live()) return;
      if (isSignedOut(error)) return signedOutOnLoad(error);
      const missing = error?.code === "not-found";
      const heading = missing ? "Not found" : "Could not load";
      fill(screen, { text: { title: heading } });
      crumbs(heading);
      slotChildren(screen, "error").replaceChildren(
        missing
          ? errorBlock({ title: `This ${singular} doesn't exist`, text: "It may have been deleted." })
          : errorBlock({ title: `Could not load this ${singular}`, text: "Check your connection and try again.", actions: [retryButton(rerun)] }),
      );
      return setState(screen, "error");
    }
    if (!live()) return;
    mountItem(item);
  })();

  function mountItem(item) {
    const form = screen.querySelector("form");
    const f = buildFields(type, form, type.id);
    f.write(item.values);
    const updateWords = wireWordCount(type, form);

    const showTitle = () => {
      const t = titleOf(type, { [type.list.title]: f.get(type.list.title) });
      fill(screen, { text: { title: t } });
      crumbs(t);
    };
    const showStatus = () => {
      if (!type.status) return;
      fill(screen, { text: { status: capital(item.status) }, attrs: { tone: toneOf(type, item.status) } });
    };
    const showMeta = () => fill(screen, { text: { created: formatDate(item.createdAt), updated: formatDate(item.updatedAt) } });
    showTitle();
    showStatus();
    showMeta();
    form.addEventListener("input", showTitle);

    const validation = createValidation({ root: form, fields: type.fields, get: f.get });
    const isPublish = (next) => Boolean(type.status && next) && item.status === first && next !== first;
    const savebar = savebarFor();

    const saveState = createSaveState({
      form,
      savebar,
      read: f.read,
      write: f.write,
      async save(values, extra) {
        const status = extra?.status ?? item.status;
        try {
          item = await data.update(type.id, item.id, { status, values });
        } catch (error) {
          onSaveError(error, (text) => saveState.say(text));
          throw error;
        }
        showMeta();
      },
      validate(values, { background, extra }) {
        if (background) return validation.valid();
        const publishing = isPublish(extra?.status);
        const invalid = publishing ? validation.run("publish", type.publishRequires ?? []) : validation.run("format");
        if (!invalid.length) return true;
        validation.focus(invalid[0]);
        saveState.say(fixMessage(invalid.length, publishing ? "publish" : "save"));
        return false;
      },
      // behavior: Autosave drafts every 10 seconds
      autosave: type.autosave
        ? { every: type.autosave.every, when: () => !type.autosave.drafts || item.status === first }
        : undefined,
      onRevert() {
        updateWords();
        showTitle();
        validation.clear();
      },
    });

    // P1–P5: the status button.
    async function changeStatus(opener) {
      if (saveState.state === "saving") return;
      let next;
      if (type.status.length === 2) next = type.status.find((s) => s !== item.status);
      else next = await pickStatus(opener);
      if (!next || next === item.status) return;
      if (isPublish(next)) {
        const invalid = validation.run("publish", type.publishRequires ?? []);
        if (invalid.length) {
          validation.focus(invalid[0]);
          saveState.say(fixMessage(invalid.length, "publish"));
          return;
        }
        // behavior: Publishing asks for confirmation
        if (
          type.confirmPublish &&
          !(await confirmDialog(shell.confirm, {
            title: `Publish this ${singular}?`,
            text: "It will be visible on the site.",
            confirmLabel: capital(next),
            opener,
          }))
        )
          return;
      }
      const forward = type.status.indexOf(next) > type.status.indexOf(item.status);
      if (!(await saveState.save({ status: next }))) return;
      showStatus();
      toast(forward ? `${capital(singular)} ${next}` : `${capital(singular)} moved to ${next}`, "positive");
    }

    // P2: more than two statuses open a slide-over listing them.
    async function pickStatus(opener) {
      const drawer = shell.drawer;
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
        const radio = document.createElement("input");
        radio.className = "pn-radio";
        radio.type = "radio";
        radio.name = "pn-status";
        radio.value = s;
        radio.checked = s === item.status;
        label.append(radio, capital(s));
        set.append(label);
      }
      slotChildren(drawer, "body").replaceChildren(set);
      const result = await openDialog(drawer, { opener });
      return result === "done" ? set.querySelector("input:checked")?.value : null;
    }

    const onStatusClick = (event) => changeStatus(event.currentTarget);
    statusButton.addEventListener("click", onStatusClick);

    form.querySelector('[data-action="delete"]').addEventListener("click", async (event) => {
      const ok = await confirmDialog(shell.confirm, {
        title: `Delete this ${singular}?`,
        text: "This can't be undone.",
        confirmLabel: "Delete",
        variant: "negative",
        opener: event.currentTarget,
      });
      if (!ok) return;
      try {
        await data.remove(type.id, item.id);
      } catch (error) {
        if (isSignedOut(error)) toast("You were signed out. Copy your edits, then reload to sign in.", "negative");
        else toast("Could not delete. Try again.", "negative");
        return;
      }
      state.dirty = () => false;
      toast(`${capital(singular)} deleted`);
      location.hash = `#/${type.id}`;
    });

    state.dirty = () => saveState.dirty;
    state.save = () => saveState.save();
    state.cleanup.push(() => {
      saveState.destroy();
      validation.destroy();
      statusButton.removeEventListener("click", onStatusClick);
    });
    setState(screen, "ready");
  }

  return handle;
}

function singletonScreen(def, live) {
  const screen = tpl("screen-singleton");
  fill(screen, { text: { title: def.label, "loading-text": "Loading…" }, attrs: { state: "loading", "singleton-id": def.id } });
  shell.screen.replaceChildren(screen);
  setNav(`#/${def.id}`);
  setCrumbs([
    { text: "Home", href: "#/" },
    { text: def.label, href: `#/${def.id}` },
  ]);

  const state = { cleanup: [], dirty: () => false, save: null };

  (async () => {
    let record;
    try {
      record = await data.getSingleton(def.id);
    } catch (error) {
      if (!live()) return;
      if (isSignedOut(error)) return signedOutOnLoad(error);
      slotChildren(screen, "error").replaceChildren(
        errorBlock({ title: `Could not load ${lower(def.label)}`, text: "Check your connection and try again.", actions: [retryButton(rerun)] }),
      );
      return setState(screen, "error");
    }
    if (!live()) return;
    const form = screen.querySelector("form");
    const f = buildFields(def, form, def.id);
    f.write(record?.values ?? {});
    const validation = createValidation({ root: form, fields: def.fields, get: f.get });
    const savebar = savebarFor();
    const saveState = createSaveState({
      form,
      savebar,
      read: f.read,
      write: f.write,
      async save(values) {
        try {
          await data.saveSingleton(def.id, values);
        } catch (error) {
          onSaveError(error, (text) => saveState.say(text));
          throw error;
        }
      },
      // V7: a singleton's save is blocked by empty required fields as well as format errors.
      validate() {
        const invalid = validation.run("required");
        if (!invalid.length) return true;
        validation.focus(invalid[0]);
        saveState.say(fixMessage(invalid.length, "save"));
        return false;
      },
      onRevert: () => validation.clear(),
    });
    state.dirty = () => saveState.dirty;
    state.save = () => saveState.save();
    state.cleanup.push(() => {
      saveState.destroy();
      validation.destroy();
    });
    setState(screen, "ready");
  })();

  return {
    cleanup: () => state.cleanup.forEach((fn) => fn()),
    dirty: () => state.dirty(),
    save: () => state.save?.(),
  };
}

// ---------------------------------------------------------------- start

route();
