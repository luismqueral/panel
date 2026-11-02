// Field Notes panel: routes, screens, and adapter wiring (build.md steps 3 to 6).

import { PANEL } from "./panel.config.js";
import { tpl, fill, repeat, slotRepeat, slotChildren } from "./snippets/templates.js";
import { makeField } from "./snippets/fields.js";
import { createSaveState } from "./snippets/save-state.js";
import { createValidation } from "./snippets/validation.js";
import { confirmDialog } from "./snippets/dialogs.js";
import { createFlow } from "./snippets/create-flow.js";
import { installShortcuts } from "./snippets/keyboard.js";
import { showToast } from "./snippets/toast.js";
import { createMemoryAdapters } from "./adapters/memory.js";
import { createRequest, createHttpAdapters } from "./adapters/http.js";
import { createGoogleAuth } from "./adapters/auth.js";

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
const { data, files, auth } = adapters;

const FORBIDDEN = "This account isn't allowed. Sign in with another one.";
const app = document.getElementById("app");

let layout = null;
let stash = null;
let user = null;
let current = null;
let currentHash = "#/";
let navHref = null;
let routeToken = 0;

// ---------- Helpers ----------

const cap = (text) => text.charAt(0).toUpperCase() + text.slice(1);
const firstStatus = (type) => type.status?.[0];
const fieldOf = (def, name) => def.fields.find((f) => f.name === name);
const itemHref = (type, id) => `#/${type.id}/${encodeURIComponent(id)}`;

function tone(type, status) {
  const index = type.status.indexOf(status);
  if (index === 0) return "neutral";
  return index === type.status.length - 1 ? "positive" : "notice";
}

const DATE = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });
function formatDate(value) {
  if (!value) return "";
  const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const date = day ? new Date(Number(day[1]), Number(day[2]) - 1, Number(day[3])) : new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : DATE.format(date);
}

const titleOf = (type, item) => String(item.values?.[type.list.title] ?? "").trim() || "Untitled";

function subtitleOf(type, item) {
  if (!type.list.subtitle) return "";
  const value = item.values?.[type.list.subtitle];
  const field = fieldOf(type, type.list.subtitle);
  if (field.type === "date") return formatDate(value);
  if (Array.isArray(value)) return value.join(", ");
  return value == null ? "" : String(value);
}

const asText = (value) => (Array.isArray(value) ? value.join(" ") : value == null ? "" : String(value));

function sortItems(items, key) {
  const desc = key.startsWith("-");
  const name = key.replace(/^-/, "");
  return items.sort((a, b) => {
    const x = a.values?.[name];
    const y = b.values?.[name];
    const order = typeof x === "number" && typeof y === "number" ? x - y : asText(x).localeCompare(asText(y), undefined, { numeric: true, sensitivity: "base" });
    return desc ? -order : order;
  });
}

function countLabel(type, n) {
  return `${n} ${n === 1 ? type.singular : type.label.toLowerCase()}`;
}

function withDefaults(def, values) {
  const out = { ...values };
  for (const field of def.fields) if (field.default !== undefined && out[field.name] === undefined) out[field.name] = field.default;
  return out;
}

const wordCount = (text) => (text ?? "").trim().split(/\s+/).filter(Boolean).length;

// describe: Read-only. Estimated minutes to read, from the word count of body.
const readingTime = (body) => Math.max(1, Math.ceil(wordCount(body) / 200));
const COMPUTED = {
  readingTime: { value: (values) => readingTime(values.body), display: (values) => `${readingTime(values.body)} min` },
};

function button(text, onClick, { action, variant } = {}) {
  const el = document.createElement("button");
  el.className = "pn-button";
  el.type = "button";
  if (variant) el.dataset.variant = variant;
  if (action) el.dataset.action = action;
  el.textContent = text;
  el.addEventListener("click", onClick);
  return el;
}

function errorBlock(title, text, retry) {
  const el = tpl("error");
  fill(el, { text: { title, text } });
  if (retry) slotChildren(el, "actions").append(button("Try again", retry, { action: "retry" }));
  return el;
}

function toast(text, options) {
  showToast(layout.toasts, text, options);
}

// ---------- Auth ----------

const isAuthError = (error) => error?.code === "unauthorized" || error?.code === "forbidden";

// When any adapter throws unauthorized, show the login screen and keep the open screen (and its edits) in memory.
function authProblem(error) {
  if (!isAuthError(error)) return false;
  showLogin(error.code === "forbidden" ? FORBIDDEN : "", { keep: true });
  return true;
}

function showLogin(message = "", { keep = false } = {}) {
  if (keep && layout?.root.isConnected) stash = layout.root;
  const login = tpl("screen-login");
  fill(login, { text: { title: PANEL.name, text: "Sign in to edit the site.", error: message } });
  app.replaceChildren(login);
  document.title = `Sign in · ${PANEL.name}`;
  auth.renderMethods(slotChildren(login, "methods"), {
    onSignedIn: () => boot(),
    onError: (text) => fill(login, { text: { error: text } }),
  });
}

async function logout() {
  if (current?.saveState?.dirty) {
    const ok = await confirmDialog(layout.confirm, { title: "Discard unsaved changes?", text: "Your edits will be lost.", confirmLabel: "Discard", variant: "negative" });
    if (!ok) return;
  }
  try {
    await auth.logout();
  } catch {
    toast("Could not log out. Try again.", { tone: "negative" });
    return;
  }
  current?.destroy();
  current = null;
  user = null;
  layout = null;
  stash = null;
  showLogin();
}

async function boot() {
  let session;
  try {
    session = await auth.session();
  } catch {
    showLogin("Could not load the panel. Check your connection and try again.");
    return;
  }
  if (!session?.user) return showLogin();
  user = session.user;
  if (stash) {
    app.replaceChildren(stash);
    stash = null;
    renderNav(navHref);
    return;
  }
  ensureLayout();
  route();
}

// ---------- Shell ----------

function ensureLayout() {
  if (layout?.root.isConnected) return layout;
  const root = tpl("layout");
  const confirm = tpl("screen-dialog");
  fill(confirm, { attrs: { variant: "primary" } });
  slotChildren(root, "dialogs").append(confirm);
  const main = root.querySelector("#pn-main");
  root.querySelector(".pn-skip").addEventListener("click", (event) => {
    event.preventDefault();
    main.focus();
  });
  app.replaceChildren(root);
  layout = { root, confirm, slot: (name) => slotChildren(root, name), toasts: slotChildren(root, "toasts") };
  return layout;
}

function renderNav(href) {
  navHref = href;
  const nav = tpl("nav");
  fill(nav, { text: { brand: PANEL.name } });
  const entries = [
    { text: "Home", href: "#/" },
    ...PANEL.types.map((t) => ({ text: t.label, href: `#/${t.id}` })),
    ...PANEL.singletons.map((s) => ({ text: s.label, href: `#/${s.id}` })),
  ];
  repeat(slotRepeat(nav, "entry"), entries, (unit, e) =>
    fill(unit, { text: { text: e.text }, attrs: { href: e.href, current: e.href === href ? "page" : "false" } }),
  );
  if (PANEL.auth.recipe !== "none") {
    const account = tpl("account");
    fill(account, { text: { user: user ?? "" } });
    account.querySelector('[data-action="logout"]').addEventListener("click", logout);
    slotChildren(nav, "account").append(account);
  }
  layout.slot("nav").replaceChildren(nav);
}

function renderHeader(crumbs) {
  const header = tpl("header");
  repeat(slotRepeat(header, "crumb"), crumbs, (unit, c, i) =>
    fill(unit, { text: { text: c.text }, attrs: { href: c.href, current: i === crumbs.length - 1 ? "page" : "false" } }),
  );
  layout.slot("header").replaceChildren(header);
  document.title = `${crumbs.at(-1).text} · ${PANEL.name}`;
}

function mountScreen(name, attrs = {}, text = {}) {
  const screen = tpl(name);
  fill(screen, { text: { "loading-text": "Loading…", ...text }, attrs: { state: "loading", ...attrs } });
  layout.slot("screen").replaceChildren(screen);
  return screen;
}

const setState = (screen, state) => screen.setAttribute("data-state", state);

function mountSavebar() {
  const savebar = tpl("savebar");
  fill(savebar, { text: { message: "All changes saved" }, attrs: { "save-state": "clean" } });
  layout.slot("savebar").replaceChildren(savebar);
  return savebar;
}

// ---------- Router ----------

window.addEventListener("hashchange", async () => {
  const hash = location.hash;
  if (hash && !hash.startsWith("#/")) return;
  if (current?.saveState?.dirty) {
    history.replaceState(null, "", currentHash);
    const ok = await confirmDialog(layout.confirm, { title: "Discard unsaved changes?", text: "Your edits will be lost.", confirmLabel: "Discard", variant: "negative" });
    if (!ok) return;
    history.replaceState(null, "", hash || "#/");
  }
  route();
});

function route() {
  const hash = location.hash.startsWith("#/") ? location.hash : "#/";
  currentHash = hash;
  current?.destroy();
  current = null;
  ensureLayout();
  layout.slot("savebar").replaceChildren();
  for (const dialog of [...layout.slot("dialogs").children]) if (dialog !== layout.confirm) dialog.remove();
  const token = ++routeToken;
  const parts = hash.slice(2).split("/").filter(Boolean).map(decodeURIComponent);
  if (parts.length === 0) return home(token);
  const type = PANEL.types.find((t) => t.id === parts[0]);
  const single = PANEL.singletons.find((s) => s.id === parts[0]);
  if (type && parts.length === 1) return collection(type, token);
  if (type && parts.length === 2) return item(type, parts[1], token);
  if (single && parts.length === 1) return singleton(single, token);
  return notFound(hash);
}

// ---------- Screens ----------

async function home(token) {
  renderNav("#/");
  renderHeader([{ text: "Home", href: "#/" }]);
  const screen = mountScreen("screen-home", {}, { title: PANEL.name, "content-heading": "Content", "recent-heading": "Recently edited" });
  try {
    const lists = await Promise.all(PANEL.types.map((t) => data.list(t.id)));
    if (token !== routeToken) return;
    const entries = [
      ...PANEL.types.map((t, i) => ({ title: t.label, subtitle: countLabel(t, lists[i].length), href: `#/${t.id}` })),
      ...PANEL.singletons.map((s) => ({ title: s.label, subtitle: "Page", href: `#/${s.id}` })),
    ];
    repeat(slotRepeat(screen, "entry"), entries, (unit, e) =>
      fill(unit, { text: { title: e.title, subtitle: e.subtitle, meta: "" }, attrs: { href: e.href } }),
    );
    const recent = PANEL.types
      .flatMap((type, i) => lists[i].map((it) => ({ type, it })))
      .sort((a, b) => String(b.it.updatedAt).localeCompare(String(a.it.updatedAt)))
      .slice(0, 5);
    repeat(slotRepeat(screen, "recent"), recent, (unit, { type, it }) =>
      fill(unit, { text: { title: titleOf(type, it), subtitle: type.label, meta: formatDate(it.updatedAt) }, attrs: { href: itemHref(type, it.id) } }),
    );
    setState(screen, "ready");
  } catch (error) {
    if (token !== routeToken || authProblem(error)) return;
    slotChildren(screen, "error").replaceChildren(errorBlock("Could not load the panel", "Check your connection and try again.", () => route()));
    setState(screen, "error");
  }
}

function notFound(hash) {
  renderNav(null);
  renderHeader([{ text: "Home", href: "#/" }, { text: "Not found", href: hash }]);
  const screen = mountScreen("screen-home", {}, { title: "Not found", "content-heading": "Content", "recent-heading": "Recently edited" });
  repeat(slotRepeat(screen, "entry"), [], () => {});
  repeat(slotRepeat(screen, "recent"), [], () => {});
  slotChildren(screen, "error").replaceChildren(
    errorBlock("This page doesn't exist", "Check the address, or go back home.", () => (location.hash = "#/")),
  );
  setState(screen, "error");
}

async function collection(type, token) {
  const href = `#/${type.id}`;
  const lower = type.label.toLowerCase();
  renderNav(href);
  renderHeader([{ text: "Home", href: "#/" }, { text: type.label, href }]);
  const screen = mountScreen(
    "screen-collection",
    { "type-id": type.id, "search-placeholder": `Search ${lower}` },
    { title: type.label, "create-label": `New ${type.singular}`, "search-label": `Search ${lower}`, "sort-label": "Sort by" },
  );

  const sortName = type.list.sort.replace(/^-/, "");
  const sortField = fieldOf(type, sortName);
  const byDate = sortField.type === "date";
  const options = [
    { value: `-${sortName}`, text: byDate ? "Newest first" : `${sortField.label}, descending` },
    { value: sortName, text: byDate ? "Oldest first" : `${sortField.label}, ascending` },
    { value: type.list.title, text: "Title A–Z" },
  ];
  const select = screen.querySelector("#pn-sort");
  repeat(select, options, (unit, o) => fill(unit, { text: { text: o.text }, attrs: { value: o.value } }));
  select.value = type.list.sort;
  const search = screen.querySelector("#pn-search");
  const rows = slotRepeat(screen, "row");
  repeat(rows, [], () => {});
  let items = [];

  function render() {
    const query = search.value.trim().toLowerCase();
    const shown = items.filter((it) => !query || (type.list.search ?? []).some((name) => asText(it.values?.[name]).toLowerCase().includes(query)));
    sortItems(shown, select.value);
    repeat(rows, shown, (unit, it) =>
      fill(unit, {
        text: { title: titleOf(type, it), subtitle: subtitleOf(type, it), status: it.status ? cap(it.status) : "" },
        attrs: { href: itemHref(type, it.id), tone: it.status ? tone(type, it.status) : "neutral" },
      }),
    );
  }
  search.addEventListener("input", render);
  select.addEventListener("change", render);

  const flow = buildCreate(type);
  const openCreate = (event) => flow.open(event.currentTarget);
  screen.querySelector('.pn-screen-header [data-action="create"]').addEventListener("click", openCreate);
  current = { search: () => search, destroy() {} };

  try {
    items = await data.list(type.id);
    if (token !== routeToken) return;
    if (!items.length) {
      const empty = tpl("empty");
      fill(empty, { text: { title: `No ${lower} yet`, text: `Create the first ${type.singular}.` }, attrs: { icon: "#pn-icon-file" } });
      slotChildren(empty, "actions").append(button(`New ${type.singular}`, openCreate, { action: "create", variant: "primary" }));
      slotChildren(screen, "empty").replaceChildren(empty);
      setState(screen, "empty");
      return;
    }
    render();
    setState(screen, "ready");
  } catch (error) {
    if (token !== routeToken || authProblem(error)) return;
    slotChildren(screen, "error").replaceChildren(errorBlock(`Could not load ${lower}`, "Check your connection and try again.", () => route()));
    setState(screen, "error");
  }
}

function buildCreate(type) {
  const dialog = tpl("screen-create");
  fill(dialog, { text: { title: `New ${type.singular}` } });
  const titleField = fieldOf(type, type.list.title);
  const slugField = type.fields.find((f) => f.type === "slug" && f.from === titleField.name);
  const defs = [titleField, slugField].filter(Boolean);
  const controls = defs.map((field) => makeField(field, { prefix: `${type.id}-new` }));
  slotChildren(dialog, "fields").append(...controls.map((c) => c.el));
  layout.slot("dialogs").append(dialog);
  const get = (name) => controls.find((c) => c.field.name === name).get();
  return createFlow({
    dialog,
    title: titleField.name,
    slug: slugField?.name ?? null,
    validation: createValidation({ root: dialog, fields: defs, get }),
    read: () => Object.fromEntries(controls.map((c) => [c.field.name, c.get()])),
    create: (values) => data.create(type.id, { status: firstStatus(type), values: withDefaults(type, values) }),
    onCreated: (created) => (location.hash = itemHref(type, created.id)),
    onError: () => toast("Could not create. Try again.", { tone: "negative" }),
  });
}

// The fields of one item or singleton, in schema order, inside its form.
function buildEditor(def, prefix, form) {
  const controls = [];
  const sourceValues = () => Object.fromEntries(controls.filter((c) => c.field.type !== "custom").map((c) => [c.field.name, c.get()]));
  for (const field of def.fields) {
    const holder = {};
    const ctx = { prefix, files: uploadsFor(holder), values: sourceValues, root: form, computed: COMPUTED };
    const control = makeField(field, ctx);
    holder.el = control.el;
    controls.push(control);
  }
  slotChildren(form, "fields").append(...controls.map((c) => c.el));

  // behavior: Show word count under the body field
  const counted = def.wordCount ? controls.find((c) => c.field.name === def.wordCount) : null;
  function showWordCount() {
    if (!counted) return;
    const n = wordCount(counted.get());
    counted.el.querySelector('[data-slot="help"]').textContent = `${n} ${n === 1 ? "word" : "words"}`;
  }
  form.addEventListener("input", showWordCount);

  return {
    get: (name) => controls.find((c) => c.field.name === name)?.get(),
    read: () => Object.fromEntries(controls.map((c) => [c.field.name, c.get()])),
    write(values) {
      for (const c of controls) c.set(values?.[c.field.name]);
      showWordCount();
    },
  };
}

// The files adapter for one field, showing "That file is too large." in place of the generic upload error.
function uploadsFor(holder) {
  return {
    async upload(file) {
      try {
        return await files.upload(file);
      } catch (error) {
        if (error?.code === "too-large") setTimeout(() => (holder.el.querySelector(".pn-error").textContent = "That file is too large."));
        authProblem(error);
        throw error;
      }
    },
  };
}

function reportSaveError(error, saveState) {
  if (authProblem(error)) return;
  if (error?.code === "invalid") console.error(error);
  if (error?.code === "conflict") setTimeout(() => saveState().say("Changed elsewhere. Copy your edits, then reload."));
}

function formatValidate(validation) {
  return (values, { background }) => {
    if (background) return validation.valid();
    const invalid = validation.run("format");
    if (invalid.length) validation.focus(invalid[0]);
    return invalid.length === 0;
  };
}

async function item(type, id, token) {
  const collHref = `#/${type.id}`;
  renderNav(collHref);
  renderHeader([{ text: "Home", href: "#/" }, { text: type.label, href: collHref }]);
  const screen = mountScreen("screen-item", { "type-id": type.id, tone: "neutral" }, { title: "", status: "" });

  let record;
  try {
    record = await data.get(type.id, id);
  } catch (error) {
    if (token !== routeToken || authProblem(error)) return;
    const block =
      error?.code === "not-found"
        ? errorBlock(`This ${type.singular} doesn't exist`, "It may have been deleted.")
        : errorBlock(`Could not load this ${type.singular}`, "Check your connection and try again.", () => route());
    slotChildren(screen, "error").replaceChildren(block);
    setState(screen, "error");
    return;
  }
  if (token !== routeToken) return;

  let status = record.status;
  const form = screen.querySelector("form");
  const statusButton = screen.querySelector('[data-action="status"]');
  const deleteButton = screen.querySelector('[data-action="delete"]');
  const editor = buildEditor(type, type.id, form);
  editor.write(record.values);

  function renderHead() {
    const title = titleOf(type, record);
    fill(screen, { text: { title, created: formatDate(record.createdAt), updated: formatDate(record.updatedAt) } });
    renderHeader([{ text: "Home", href: "#/" }, { text: type.label, href: collHref }, { text: title, href: itemHref(type, record.id) }]);
    if (type.status) fill(screen, { text: { status: cap(status) }, attrs: { tone: tone(type, status) } });
    else statusButton.hidden = true;
  }
  renderHead();

  const validation = createValidation({ root: form, fields: type.fields, get: editor.get });
  const savebar = mountSavebar();
  const saveState = createSaveState({
    form,
    savebar,
    read: editor.read,
    write: editor.write,
    async save(values, extra) {
      // behavior-spec S3: Delete stays enabled while saving, though it sits inside the form.
      deleteButton.disabled = false;
      const next = extra?.status ?? status;
      try {
        record = await data.update(type.id, record.id, { status: next, values });
      } catch (error) {
        reportSaveError(error, () => saveState);
        throw error;
      }
      status = record.status ?? next;
      renderHead();
    },
    validate: formatValidate(validation),
    // behavior: Autosave drafts every 10 seconds
    autosave: type.autosave ? { every: type.autosave.every, when: () => !type.autosave.drafts || status === firstStatus(type) } : undefined,
    onRevert: () => validation.clear(),
  });
  current = {
    saveState,
    destroy() {
      saveState.destroy();
      validation.destroy();
    },
  };

  statusButton.addEventListener("click", async () => {
    if (!type.status || saveState.state === "saving") return;
    const from = type.status.indexOf(status);
    const next = type.status[from === 0 ? 1 : 0];
    const to = type.status.indexOf(next);
    if (from === 0 && to > 0) {
      // conformance: Publishing a post requires a cover image.
      const invalid = validation.run("publish", type.publishRequires ?? []);
      if (invalid.length) {
        saveState.say(`Fix ${invalid.length} ${invalid.length === 1 ? "field" : "fields"} to publish`);
        validation.focus(invalid[0]);
        return;
      }
      // behavior: Publishing asks for confirmation
      if (type.confirmPublish) {
        const ok = await confirmDialog(layout.confirm, {
          title: `Publish this ${type.singular}?`,
          text: "It will be visible on the site.",
          confirmLabel: cap(next),
          opener: statusButton,
        });
        if (!ok) return;
      }
    }
    if (!(await saveState.save({ status: next }))) return;
    toast(to > from ? `${cap(type.singular)} ${next}` : `${cap(type.singular)} moved to ${next}`);
  });

  deleteButton.addEventListener("click", async () => {
    const ok = await confirmDialog(layout.confirm, {
      title: `Delete this ${type.singular}?`,
      text: "This can't be undone.",
      confirmLabel: "Delete",
      variant: "negative",
      opener: deleteButton,
    });
    if (!ok) return;
    try {
      await data.remove(type.id, record.id);
    } catch (error) {
      if (!authProblem(error)) toast("Could not delete. Try again.", { tone: "negative" });
      return;
    }
    current?.destroy();
    current = null;
    toast(`${cap(type.singular)} deleted`);
    location.hash = collHref;
  });

  setState(screen, "ready");
}

async function singleton(def, token) {
  const href = `#/${def.id}`;
  const lower = def.label.toLowerCase();
  renderNav(href);
  renderHeader([{ text: "Home", href: "#/" }, { text: def.label, href }]);
  const screen = mountScreen("screen-singleton", { "singleton-id": def.id }, { title: def.label });

  let record;
  try {
    record = await data.getSingleton(def.id);
  } catch (error) {
    if (token !== routeToken || authProblem(error)) return;
    slotChildren(screen, "error").replaceChildren(errorBlock(`Could not load ${lower}`, "Check your connection and try again.", () => route()));
    setState(screen, "error");
    return;
  }
  if (token !== routeToken) return;

  const form = screen.querySelector("form");
  const editor = buildEditor(def, def.id, form);
  editor.write(record?.values ?? {});
  const validation = createValidation({ root: form, fields: def.fields, get: editor.get });
  const saveState = createSaveState({
    form,
    savebar: mountSavebar(),
    read: editor.read,
    write: editor.write,
    async save(values) {
      try {
        record = await data.saveSingleton(def.id, values);
      } catch (error) {
        reportSaveError(error, () => saveState);
        throw error;
      }
    },
    validate: formatValidate(validation),
    onRevert: () => validation.clear(),
  });
  current = {
    saveState,
    destroy() {
      saveState.destroy();
      validation.destroy();
    },
  };
  setState(screen, "ready");
}

// ---------- Start ----------

installShortcuts({
  save: () => current?.saveState?.save(),
  search: () => current?.search?.(),
});

boot();
