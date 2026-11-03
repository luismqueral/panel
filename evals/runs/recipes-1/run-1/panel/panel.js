// Sunday Table panel: routes, screens, and adapter wiring. Built from panel.yaml (see panel.config.js).

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
import { createPasswordAuth } from "./adapters/auth.js";

// ---------- Adapters (build.md step 6) ----------

function createRecipeAdapters() {
  const request = createRequest();
  const { data, files } = createHttpAdapters(request);
  // auth: password
  return { data, files, auth: createPasswordAuth(request) };
}

const params = new URLSearchParams(location.search);
const adapters = params.has("test")
  ? createMemoryAdapters(await (await fetch("./seed.json")).json())
  : createRecipeAdapters();

const idle = { cleanup() {}, dirty: () => false };
let current = idle;
let lastHash = location.hash;
let routeToken = 0;

if (adapters.test)
  window.panelTest = {
    ...adapters.test,
    reset(seed) {
      adapters.test.reset(seed);
      current.cleanup(); // drop the open screen without asking (S9 does not apply)
      route();           // render the current route again from the new data
    },
  };

// ---------- Helpers ----------

const app = document.getElementById("app");
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");
const formatDate = (iso) => (iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "");
const typeById = (id) => PANEL.types.find((t) => t.id === id);
const singletonById = (id) => PANEL.singletons.find((s) => s.id === id);
const fieldOf = (def, name) => def.fields.find((f) => f.name === name);
const titleOf = (type, item) => item?.values?.[type.list.title] || "Untitled";
const isAuthError = (error) => error?.code === "unauthorized" || error?.code === "forbidden";
const count = (n, type) => `${n} ${n === 1 ? type.singular : type.label.toLowerCase()}`;

function tone(type, status) {
  const i = type.status.indexOf(status);
  if (i === 0) return "neutral";
  return i === type.status.length - 1 ? "positive" : "notice";
}

function emptyValue(field) {
  if (field.default !== undefined) return structuredClone(field.default);
  if (field.type === "toggle") return false;
  if (field.type === "tags" || field.control === "ingredients") return [];
  if (["number", "image", "file", "relation"].includes(field.type)) return null;
  return "";
}

function button(text, action, variant) {
  const b = document.createElement("button");
  b.className = "pn-button";
  if (variant) b.dataset.variant = variant;
  b.type = "button";
  b.dataset.action = action;
  b.textContent = text;
  return b;
}

function errorBox(title, text, retry) {
  const box = tpl("error");
  fill(box, { text: { title, text } });
  if (retry) {
    const again = button("Try again", "retry");
    again.addEventListener("click", retry);
    slotChildren(box, "actions").append(again);
  }
  return box;
}

function toast(text, tone) {
  if (shell) showToast(shell.toasts, text, tone ? { tone } : undefined);
}

// ---------- The ingredients custom field (panel.yaml, recipe.ingredients) ----------

// describe: "Rows of an amount and an ingredient, in the order entered. An "Add ingredient" button adds a row,
// and clearing both boxes of a row removes it. Stored as a list of objects with amount and ingredient."
function makeIngredients(field, ctx) {
  const base = `${ctx.prefix}-${field.name}`;
  const el = tpl("field-custom");
  fill(el, {
    text: { label: field.label, help: field.help ?? "", error: "" },
    attrs: {
      name: field.name,
      width: field.width ?? "1/1",
      required: String(Boolean(field.required)),
      "label-id": `${base}-label`,
      "help-id": `${base}-help`,
      "error-id": `${base}-error`,
    },
  });
  const control = slotChildren(el, "control");
  const actions = document.createElement("div");
  const add = document.createElement("button");
  add.className = "pn-button";
  add.type = "button";
  add.dataset.size = "sm";
  add.dataset.action = "add-ingredient";
  add.innerHTML = '<svg class="pn-icon" aria-hidden="true"><use href="#pn-icon-plus"/></svg>Add ingredient';
  actions.append(add);
  control.append(actions);

  const rows = () => [...control.querySelectorAll(":scope > .pn-grid")];

  function input(kind, n) {
    const box = document.createElement("input");
    box.className = "pn-input";
    box.type = "text";
    box.dataset.width = kind === "amount" ? "1/3" : "2/3";
    box.id = n === 1 && kind === "amount" ? `${base}-input` : `${base}-${n}-${kind}`;
    box.setAttribute("aria-label", `${kind === "amount" ? "Amount" : "Ingredient"}, row ${n}`);
    box.setAttribute("aria-describedby", `${base}-help ${base}-error`);
    return box;
  }

  function row(value = {}) {
    const n = rows().length + 1;
    const line = document.createElement("div");
    line.className = "pn-grid";
    line.setAttribute("role", "group");
    line.setAttribute("aria-label", `Ingredient ${n}`);
    const amount = input("amount", n);
    const name = input("ingredient", n);
    amount.value = value.amount ?? "";
    name.value = value.ingredient ?? "";
    line.append(amount, name);
    control.insertBefore(line, actions);
    return line;
  }

  function get() {
    return rows()
      .map((line) => {
        const [amount, ingredient] = line.querySelectorAll("input");
        return { amount: amount.value.trim(), ingredient: ingredient.value.trim() };
      })
      .filter((r) => r.amount || r.ingredient);
  }

  function set(value) {
    for (const line of rows()) line.remove();
    for (const r of value ?? []) row(r);
    if (!rows().length) row();
  }

  add.addEventListener("click", () => row().querySelector("input").focus());
  set([]);
  return { el, field, get, set };
}

// The data contract stores an unset relation as null; the select control reports "".
function readValues(controls) {
  return Object.fromEntries(
    controls.map((c) => {
      const value = c.get();
      return [c.field.name, c.field.type === "relation" && value === "" ? null : value];
    }),
  );
}

function makeControl(field, ctx) {
  if (field.control === "ingredients") return makeIngredients(field, ctx);
  return makeField(field, ctx);
}

async function relationOptions(def) {
  const options = {};
  for (const field of def.fields.filter((f) => f.type === "relation")) {
    const target = typeById(field.to);
    const items = await adapters.data.list(target.id);
    options[field.to] = items.map((it) => ({ value: it.id, text: titleOf(target, it) })).sort((a, b) => a.text.localeCompare(b.text));
  }
  return options;
}

// ---------- Shell: layout, nav, header, login ----------

let shell = null;

installShortcuts({ save: () => current.save?.(), search: () => current.search?.() });

function ensureLayout(user) {
  if (shell) {
    fill(shell.account, { text: { user } });
    return;
  }
  const root = tpl("layout");
  const nav = tpl("nav");
  fill(nav, { text: { brand: PANEL.name } });
  const account = tpl("account");
  fill(account, { text: { user } });
  slotChildren(nav, "account").append(account);
  slotChildren(root, "nav").append(nav);
  const header = tpl("header");
  slotChildren(root, "header").append(header);
  const confirm = tpl("screen-dialog");
  slotChildren(root, "dialogs").append(confirm);
  account.querySelector('[data-action="logout"]').addEventListener("click", logout);
  app.replaceChildren(root);
  shell = { root, nav, account, header, confirm, toasts: slotChildren(root, "toasts"), dialogs: slotChildren(root, "dialogs") };
}

function setNav(currentId) {
  const entries = [
    { id: "home", text: "Home", href: "#/" },
    ...PANEL.types.map((t) => ({ id: t.id, text: t.label, href: `#/${t.id}` })),
    ...PANEL.singletons.map((s) => ({ id: s.id, text: s.label, href: `#/${s.id}` })),
  ];
  repeat(slotRepeat(shell.nav, "entry"), entries, (unit, e) =>
    fill(unit, { text: { text: e.text }, attrs: { href: e.href, current: e.id === currentId ? "page" : "false" } }),
  );
}

function setCrumbs(crumbs) {
  repeat(slotRepeat(shell.header, "crumb"), crumbs, (unit, c, i) =>
    fill(unit, { text: { text: c.text }, attrs: { href: c.href, current: i === crumbs.length - 1 ? "page" : "false" } }),
  );
  document.title = `${crumbs[crumbs.length - 1].text} · ${PANEL.name}`;
}

function mount(screen, savebar) {
  slotChildren(shell.root, "screen").replaceChildren(screen);
  slotChildren(shell.root, "savebar").replaceChildren(...(savebar ? [savebar] : []));
}

function showLogin(errorText = "", { methods = true } = {}) {
  current.cleanup();
  current = idle;
  shell = null;
  const login = tpl("screen-login");
  fill(login, { text: { title: PANEL.name, text: "Sign in to edit the site.", error: errorText } });
  app.replaceChildren(login);
  document.title = `Sign in · ${PANEL.name}`;
  if (!methods) return;
  adapters.auth.renderMethods(slotChildren(login, "methods"), {
    onSignedIn: () => {
      fill(login, { text: { error: "" } });
      route();
    },
    onError: (message) => fill(login, { text: { error: message } }),
  });
}

function loadFailed(error) {
  if (!isAuthError(error)) return false;
  showLogin(error.code === "forbidden" ? "This account isn't allowed. Sign in with another one." : "");
  return true;
}

function discard() {
  return confirmDialog(shell.confirm, { title: "Discard unsaved changes?", text: "Your edits will be lost.", confirmLabel: "Discard", variant: "negative" });
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

// ---------- Routing (build.md step 4) ----------

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
  const stale = () => token !== routeToken;
  let session;
  try {
    session = await adapters.auth.session();
  } catch {
    if (!stale()) showLogin("Could not reach the panel. Check your connection and reload.", { methods: false });
    return;
  }
  if (stale()) return;
  if (!session) return showLogin();
  ensureLayout(session.user);
  current = idle;
  const parts = (location.hash || "#/").slice(2).split("/").filter(Boolean).map(decodeURIComponent);
  const type = parts.length && typeById(parts[0]);
  const single = parts.length === 1 && singletonById(parts[0]);
  if (!parts.length) return homeScreen(stale);
  if (type && parts.length === 1) return collectionScreen(type, stale);
  if (type && parts.length === 2) return itemScreen(type, parts[1], stale);
  if (single) return singletonScreen(single, stale);
  return notFoundScreen();
}

// ---------- Home ----------

function homeTemplate(title, state) {
  const s = tpl("screen-home");
  fill(s, { text: { title, "content-heading": "Content", "recent-heading": "Recently edited", "loading-text": "Loading…" }, attrs: { state } });
  return s;
}

const listRow = (unit, r) => fill(unit, { text: { title: r.title, subtitle: r.subtitle, meta: r.meta ?? "" }, attrs: { href: r.href } });

async function homeScreen(stale) {
  setNav("home");
  setCrumbs([{ text: "Home", href: "#/" }]);
  const s = homeTemplate(PANEL.name, "loading");
  mount(s);
  try {
    const lists = await Promise.all(PANEL.types.map((t) => adapters.data.list(t.id)));
    if (stale()) return;
    const entries = [
      ...PANEL.types.map((t, i) => ({ title: t.label, subtitle: count(lists[i].length, t), href: `#/${t.id}` })),
      ...PANEL.singletons.map((x) => ({ title: x.label, subtitle: "Page", href: `#/${x.id}` })),
    ];
    const recent = PANEL.types
      .flatMap((t, i) => lists[i].map((it) => ({ t, it })))
      .sort((a, b) => String(b.it.updatedAt).localeCompare(String(a.it.updatedAt)))
      .slice(0, 5)
      .map(({ t, it }) => ({ title: titleOf(t, it), subtitle: t.label, meta: formatDate(it.updatedAt), href: `#/${t.id}/${encodeURIComponent(it.id)}` }));
    repeat(slotRepeat(s, "entry"), entries, listRow);
    repeat(slotRepeat(s, "recent"), recent, listRow);
    fill(s, { attrs: { state: "ready" } });
  } catch (error) {
    if (stale() || loadFailed(error)) return;
    slotChildren(s, "error").replaceChildren(errorBox("Could not load the panel", "Check your connection and try again.", () => route()));
    fill(s, { attrs: { state: "error" } });
  }
}

function notFoundScreen() {
  setNav(null);
  setCrumbs([{ text: "Home", href: "#/" }, { text: "Not found", href: location.hash }]);
  const s = homeTemplate("Not found", "error");
  repeat(slotRepeat(s, "entry"), [], listRow);
  repeat(slotRepeat(s, "recent"), [], listRow);
  slotChildren(s, "error").append(errorBox("This page doesn't exist", "Check the address, or go back home.", () => (location.hash = "#/")));
  mount(s);
}

// ---------- Collection ----------

function sortOptions(type) {
  const field = fieldOf(type, type.list.sort.replace(/^-/, ""));
  const options =
    field.type === "date"
      ? [{ value: `-${field.name}`, text: "Newest first" }, { value: field.name, text: "Oldest first" }]
      : [{ value: `-${field.name}`, text: `${field.label}, descending` }, { value: field.name, text: `${field.label}, ascending` }];
  if (field.name !== type.list.title) options.push({ value: type.list.title, text: "Title A–Z" });
  return options;
}

function compare(x, y) {
  if (typeof x === "number" && typeof y === "number") return x - y;
  if (typeof x === "boolean" || typeof y === "boolean") return Number(x) - Number(y);
  return String(x).localeCompare(String(y), undefined, { sensitivity: "base" });
}

function sortItems(items, sort) {
  const desc = sort.startsWith("-");
  const key = sort.replace(/^-/, "");
  const blank = (v) => v === null || v === undefined || v === "";
  return [...items].sort((a, b) => {
    const x = a.values[key];
    const y = b.values[key];
    if (blank(x) && blank(y)) return 0;
    if (blank(x)) return 1;
    if (blank(y)) return -1;
    return desc ? -compare(x, y) : compare(x, y);
  });
}

async function collectionScreen(type, stale) {
  const label = type.label.toLowerCase();
  setNav(type.id);
  setCrumbs([{ text: "Home", href: "#/" }, { text: type.label, href: `#/${type.id}` }]);
  const s = tpl("screen-collection");
  fill(s, {
    text: { title: type.label, "create-label": `New ${type.singular}`, "loading-text": "Loading…", "search-label": `Search ${label}`, "sort-label": "Sort by" },
    attrs: { state: "loading", "type-id": type.id, "search-placeholder": `Search ${label}` },
  });
  const sort = s.querySelector("#pn-sort");
  repeat(sort, sortOptions(type), (unit, o) => fill(unit, { text: { text: o.text }, attrs: { value: o.value } }));
  sort.value = type.list.sort;
  const search = s.querySelector("#pn-search");

  // Create dialog: only the list.title field (C1); no slug field in this schema.
  const dialog = tpl("screen-create");
  fill(dialog, { text: { title: `New ${type.singular}` } });
  const titleField = { ...fieldOf(type, type.list.title), required: true };
  const titleControl = makeField(titleField, { prefix: `${type.id}-new` });
  slotChildren(dialog, "fields").append(titleControl.el);
  shell.dialogs.append(dialog);
  const createValidationState = createValidation({ root: dialog, fields: [titleField], get: () => titleControl.get() });
  const flow = createFlow({
    dialog,
    title: type.list.title,
    slug: null,
    validation: createValidationState,
    read: () => ({ [type.list.title]: titleControl.get() }),
    create: (values) => {
      const all = Object.fromEntries(type.fields.map((f) => [f.name, emptyValue(f)]));
      return adapters.data.create(type.id, { status: type.status?.[0], values: { ...all, ...values } });
    },
    onCreated: (item) => (location.hash = `#/${type.id}/${encodeURIComponent(item.id)}`),
    onError: () => toast("Could not create. Try again.", "negative"),
  });
  s.querySelector('[data-action="create"]').addEventListener("click", (event) => flow.open(event.currentTarget));

  current = {
    dirty: () => false,
    search: () => (s.dataset.state === "ready" ? search : null),
    cleanup() {
      createValidationState.destroy();
      dialog.remove();
    },
  };
  mount(s);

  let items = [];
  let related = {};
  const subtitleField = type.list.subtitle && fieldOf(type, type.list.subtitle);

  function subtitle(item) {
    if (!subtitleField) return "";
    const v = item.values[subtitleField.name];
    if (v === null || v === undefined || v === "") return "";
    if (subtitleField.type === "relation") return related[v] ?? "";
    if (subtitleField.type === "date") return formatDate(v);
    return String(v);
  }

  function render() {
    const q = search.value.trim().toLowerCase();
    const shown = sortItems(
      items.filter((it) => !q || (type.list.search ?? [type.list.title]).some((name) => String(it.values[name] ?? "").toLowerCase().includes(q))),
      sort.value,
    );
    repeat(slotRepeat(s, "row"), shown, (unit, it) => {
      fill(unit, {
        text: { title: titleOf(type, it), subtitle: subtitle(it), status: type.status ? cap(it.status) : "" },
        attrs: { href: `#/${type.id}/${encodeURIComponent(it.id)}`, tone: type.status ? tone(type, it.status) : "" },
      });
      if (!type.status) unit.querySelector(".pn-status").hidden = true;
    });
  }

  try {
    items = await adapters.data.list(type.id);
    if (subtitleField?.type === "relation") {
      const target = typeById(subtitleField.to);
      related = Object.fromEntries((await adapters.data.list(target.id)).map((it) => [it.id, titleOf(target, it)]));
    }
    if (stale()) return;
  } catch (error) {
    if (stale() || loadFailed(error)) return;
    slotChildren(s, "error").replaceChildren(errorBox(`Could not load ${label}`, "Check your connection and try again.", () => route()));
    fill(s, { attrs: { state: "error" } });
    return;
  }
  if (!items.length) {
    const empty = tpl("empty");
    fill(empty, { text: { title: `No ${label} yet`, text: `Create the first ${type.singular}.` }, attrs: { icon: "#pn-icon-file" } });
    const first = button(`New ${type.singular}`, "create", "primary");
    first.addEventListener("click", () => flow.open(first));
    slotChildren(empty, "actions").append(first);
    slotChildren(s, "empty").replaceChildren(empty);
    fill(s, { attrs: { state: "empty" } });
    return;
  }
  search.addEventListener("input", render);
  sort.addEventListener("change", render);
  render();
  fill(s, { attrs: { state: "ready" } });
}

// ---------- Item ----------

async function itemScreen(type, id, stale) {
  const crumbsFor = (text) => [{ text: "Home", href: "#/" }, { text: type.label, href: `#/${type.id}` }, { text, href: `#/${type.id}/${encodeURIComponent(id)}` }];
  setNav(type.id);
  setCrumbs(crumbsFor("Loading…"));
  const s = tpl("screen-item");
  fill(s, { text: { title: "Loading…", "loading-text": "Loading…", status: "", created: "", updated: "" }, attrs: { state: "loading", "type-id": type.id, tone: "" } });
  const statusButton = s.querySelector('[data-action="status"]');
  statusButton.hidden = true;
  mount(s);

  let item;
  let options;
  try {
    [item, options] = await Promise.all([adapters.data.get(type.id, id), relationOptions(type)]);
    if (stale()) return;
  } catch (error) {
    if (stale() || loadFailed(error)) return;
    const missing = error?.code === "not-found";
    const title = missing ? "Not found" : "Could not load";
    fill(s, { text: { title } });
    setCrumbs(crumbsFor(title));
    slotChildren(s, "error").replaceChildren(
      missing
        ? errorBox(`This ${type.singular} doesn't exist`, "It may have been deleted.")
        : errorBox(`Could not load this ${type.singular}`, "Check your connection and try again.", () => route()),
    );
    fill(s, { attrs: { state: "error" } });
    return;
  }

  let status = item.status;
  const singular = cap(type.singular);
  const form = s.querySelector("form");
  const grid = slotChildren(s, "fields");
  const controls = type.fields.map((f) => makeControl(f, { prefix: type.id, files: adapters.files, options }));
  for (const c of controls) grid.append(c.el);
  const byName = (name) => controls.find((c) => c.field.name === name);
  const read = () => readValues(controls);
  const write = (values) => controls.forEach((c) => c.set(values?.[c.field.name] ?? emptyValue(c.field)));
  write(item.values);

  function showHeader() {
    fill(s, {
      text: { title: titleOf(type, item), status: type.status ? cap(status) : "", created: formatDate(item.createdAt), updated: formatDate(item.updatedAt) },
      attrs: { tone: type.status ? tone(type, status) : "" },
    });
    statusButton.hidden = !type.status;
    setCrumbs(crumbsFor(titleOf(type, item)));
  }
  showHeader();

  const savebar = tpl("savebar");
  fill(savebar, { attrs: { "save-state": "clean" } });
  const validation = createValidation({ root: grid, fields: type.fields, get: (name) => byName(name).get() });

  const saveState = createSaveState({
    form,
    savebar,
    read,
    write,
    async save(values, extra) {
      const next = extra?.status ?? status;
      try {
        item = await adapters.data.update(type.id, id, { status: type.status ? next : undefined, values });
      } catch (error) {
        if (isAuthError(error)) toast("You were signed out. Copy your edits, then reload to sign in.", "negative");
        throw error;
      }
      status = item.status;
      validation.clear();
      showHeader();
    },
    validate(values, { extra }) {
      const target = extra?.status ?? status;
      // V4/V8: moving or saving past the first status runs the publish checks. Types without a
      // status are never published, so required fields block saving them, as for singletons (V7).
      const mode = type.status ? (target !== type.status[0] ? "publish" : "format") : "required";
      const invalid = validation.run(mode, mode === "publish" ? type.publishRequires : []);
      if (!invalid.length) return true;
      saveState.say(fixMessage(invalid.length, mode === "publish" ? "publish" : "save"));
      validation.focus(invalid[0]);
      return false;
    },
    onRevert: () => validation.clear(),
    errorMessage: (error) => (error?.code === "conflict" ? "Changed elsewhere. Copy your edits, then reload." : null),
  });
  slotChildren(shell.root, "savebar").replaceChildren(savebar);

  async function moveTo(next) {
    if (!next || next === status || saveState.state === "saving") return;
    const before = type.status.indexOf(status);
    if (await saveState.save({ status: next })) {
      toast(type.status.indexOf(next) > before ? `${singular} ${next}` : `${singular} moved to ${next}`, "positive");
    }
  }

  let slideOver = null;
  statusButton.addEventListener("click", async () => {
    if (saveState.state === "saving" || slideOver) return;
    // P2: two statuses toggle; more open a slide-over.
    if (type.status.length === 2) return moveTo(type.status.find((x) => x !== status));
    slideOver = tpl("screen-slide-over");
    fill(slideOver, { text: { title: "Status" } });
    const set = document.createElement("fieldset");
    set.className = "pn-choices";
    const legend = document.createElement("legend");
    legend.className = "pn-visually-hidden";
    legend.textContent = "Status";
    set.append(legend);
    for (const option of type.status) {
      const choice = document.createElement("label");
      choice.className = "pn-choice";
      const radio = document.createElement("input");
      radio.className = "pn-radio";
      radio.type = "radio";
      radio.name = "pn-status";
      radio.value = option;
      radio.checked = option === status;
      choice.append(radio, cap(option));
      set.append(choice);
    }
    slotChildren(slideOver, "body").append(set);
    shell.dialogs.append(slideOver);
    const result = openDialog(slideOver, { opener: statusButton });
    set.querySelector("input:checked")?.focus();
    const answer = await result;
    const chosen = set.querySelector("input:checked")?.value;
    slideOver.remove();
    slideOver = null;
    if (answer === "done") moveTo(chosen);
  });

  const deleteButton = s.querySelector('[data-action="delete"]');
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
      await adapters.data.remove(type.id, id);
    } catch {
      toast("Could not delete. Try again.", "negative");
      return;
    }
    toast(`${singular} deleted`);
    current.cleanup();
    current = idle;
    location.hash = `#/${type.id}`;
  });

  current = {
    dirty: () => saveState.dirty,
    save: () => saveState.save(),
    cleanup() {
      saveState.destroy();
      validation.destroy();
      slideOver?.remove();
    },
  };
  fill(s, { attrs: { state: "ready" } });
}

// ---------- Singleton ----------

async function singletonScreen(single, stale) {
  setNav(single.id);
  setCrumbs([{ text: "Home", href: "#/" }, { text: single.label, href: `#/${single.id}` }]);
  const s = tpl("screen-singleton");
  fill(s, { text: { title: single.label, "loading-text": "Loading…" }, attrs: { state: "loading", "singleton-id": single.id } });
  mount(s);

  let record;
  let options;
  try {
    [record, options] = await Promise.all([adapters.data.getSingleton(single.id), relationOptions(single)]);
    if (stale()) return;
  } catch (error) {
    if (stale() || loadFailed(error)) return;
    slotChildren(s, "error").replaceChildren(errorBox(`Could not load ${single.label.toLowerCase()}`, "Check your connection and try again.", () => route()));
    fill(s, { attrs: { state: "error" } });
    return;
  }

  const form = s.querySelector("form");
  const grid = slotChildren(s, "fields");
  const controls = single.fields.map((f) => makeControl(f, { prefix: single.id, files: adapters.files, options }));
  for (const c of controls) grid.append(c.el);
  const byName = (name) => controls.find((c) => c.field.name === name);
  const read = () => readValues(controls);
  const write = (values) => controls.forEach((c) => c.set(values?.[c.field.name] ?? emptyValue(c.field)));
  write(record?.values);

  const savebar = tpl("savebar");
  fill(savebar, { attrs: { "save-state": "clean" } });
  const validation = createValidation({ root: grid, fields: single.fields, get: (name) => byName(name).get() });
  const saveState = createSaveState({
    form,
    savebar,
    read,
    write,
    async save(values) {
      try {
        await adapters.data.saveSingleton(single.id, values);
      } catch (error) {
        if (isAuthError(error)) toast("You were signed out. Copy your edits, then reload to sign in.", "negative");
        throw error;
      }
      validation.clear();
    },
    validate() {
      // V7: a singleton's save is blocked by empty required fields as well as format errors.
      const invalid = validation.run("required");
      if (!invalid.length) return true;
      saveState.say(fixMessage(invalid.length, "save"));
      validation.focus(invalid[0]);
      return false;
    },
    onRevert: () => validation.clear(),
    errorMessage: (error) => (error?.code === "conflict" ? "Changed elsewhere. Copy your edits, then reload." : null),
  });
  slotChildren(shell.root, "savebar").replaceChildren(savebar);

  current = {
    dirty: () => saveState.dirty,
    save: () => saveState.save(),
    cleanup() {
      saveState.destroy();
      validation.destroy();
    },
  };
  fill(s, { attrs: { state: "ready" } });
}

route();
