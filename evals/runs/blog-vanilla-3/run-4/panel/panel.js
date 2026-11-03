// The owned script: routes, screens, and adapter wiring (build.md steps 3 to 6).
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

// ---------- Helpers ----------

const types = new Map(PANEL.types.map((t) => [t.id, t]));
const singletons = new Map(PANEL.singletons.map((s) => [s.id, s]));
const app = document.getElementById("app");
const idle = { cleanup() {}, dirty: () => false };
const AUTH_CODES = new Set(["unauthorized", "forbidden"]);

let current = idle;
let lastHash = location.hash;
let renderId = 0;
let user = null;
let layout = null;
let header = null;
let nav = null;
let screenSlot = null;
let savebarSlot = null;
let dialogsSlot = null;
let confirmEl = null;
let toasts = null;

const cap = (text) => text.charAt(0).toUpperCase() + text.slice(1);
const count = (n, word) => `${n} ${n === 1 ? word : plural(word)}`;
const plural = (word) => (word.endsWith("y") && !/[aeiou]y$/.test(word) ? `${word.slice(0, -1)}ies` : `${word}s`);
const toast = (text, tone) => showToast(toasts, text, { tone });

function formatDate(value) {
  if (!value) return "";
  const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const date = day ? new Date(Number(day[1]), Number(day[2]) - 1, Number(day[3])) : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function fieldOf(def, name) {
  return def.fields.find((f) => f.name === name);
}

function display(def, name, value) {
  const field = fieldOf(def, name);
  if (value === null || value === undefined || value === "") return "";
  if (field?.type === "date") return formatDate(value);
  if (Array.isArray(value)) return value.join(", ");
  return String(value);
}

function itemTitle(type, item) {
  const value = item?.values?.[type.list.title];
  return value ? String(value) : "Untitled";
}

function tone(type, status) {
  const index = type.status.indexOf(status);
  if (index === 0) return "neutral";
  if (index === type.status.length - 1) return "positive";
  return "notice";
}

function emptyValue(field) {
  if ("default" in field) return structuredClone(field.default);
  switch (field.type) {
    case "number":
    case "image":
    case "file":
    case "relation":
    case "custom":
      return null;
    case "toggle":
      return false;
    case "tags":
      return [];
    default:
      return "";
  }
}

function words(text) {
  const trimmed = (text ?? "").trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

// describe: "Read-only. Estimated minutes to read, from the word count of body."
const computed = {
  readingTime: {
    value: (values) => Math.max(1, Math.ceil(words(values.body) / 200)),
    display: (values) => `${computed.readingTime.value(values)} min`,
  },
};

function button(text, { variant, action, icon } = {}) {
  const el = document.createElement("button");
  el.className = "pn-button";
  el.type = "button";
  if (variant) el.dataset.variant = variant;
  if (action) el.dataset.action = action;
  if (icon) el.innerHTML = `<svg class="pn-icon" aria-hidden="true"><use href="${icon}"/></svg>`;
  el.append(text);
  return el;
}

// ---------- Shell ----------

function setScreenState(el, state) {
  fill(el, { attrs: { state } });
}

function setNav(href) {
  const entries = [
    { text: "Home", href: "#/" },
    ...PANEL.types.map((t) => ({ text: t.label, href: `#/${t.id}` })),
    ...PANEL.singletons.map((s) => ({ text: s.label, href: `#/${s.id}` })),
  ];
  repeat(slotRepeat(nav, "entry"), entries, (unit, e) =>
    fill(unit, { text: { text: e.text }, attrs: { href: e.href, current: e.href === href ? "page" : "false" } }),
  );
}

function setCrumbs(crumbs) {
  repeat(slotRepeat(header, "crumb"), crumbs, (unit, c, i) =>
    fill(unit, { text: { text: c.text }, attrs: { href: c.href, current: i === crumbs.length - 1 ? "page" : "false" } }),
  );
  document.title = `${crumbs[crumbs.length - 1].text} · ${PANEL.name}`;
}

function regionError(el, { title, text, retry }) {
  const error = tpl("error");
  fill(error, { text: { title, text } });
  if (retry) {
    const again = button("Try again", { action: "retry" });
    again.addEventListener("click", retry);
    slotChildren(error, "actions").append(again);
  }
  slotChildren(el, "error").replaceChildren(error);
  setScreenState(el, "error");
}

const rerun = () => {
  current.cleanup();
  current = idle;
  route();
};

function discard() {
  return confirmDialog(confirmEl, {
    title: "Discard unsaved changes?",
    text: "Your edits will be lost.",
    confirmLabel: "Discard",
    variant: "negative",
  });
}

function mountLayout() {
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
  screenSlot = slotChildren(layout, "screen");
  savebarSlot = slotChildren(layout, "savebar");
  dialogsSlot = slotChildren(layout, "dialogs");
  confirmEl = tpl("screen-dialog");
  dialogsSlot.append(confirmEl);
  toasts = slotChildren(layout, "toasts");
  app.replaceChildren(layout);
}

function mountScreen(el) {
  screenSlot.replaceChildren(el);
  savebarSlot.replaceChildren();
}

async function logout() {
  if (current.dirty() && !(await discard())) return;
  try {
    await adapters.auth.logout();
  } catch {
    toast("Could not log out. Try again.", "negative");
    return;
  }
  current.cleanup();
  current = idle;
  showLogin();
}

function showLogin({ unreachable = false, message = "" } = {}) {
  renderId++;
  layout = null;
  const el = tpl("screen-login");
  const error = el.querySelector('[data-slot="error"]');
  fill(el, {
    text: {
      title: PANEL.name,
      text: "Sign in to edit the site.",
      error: unreachable ? "Could not reach the panel. Check your connection and reload." : message,
    },
  });
  app.replaceChildren(el);
  document.title = `Sign in · ${PANEL.name}`;
  if (unreachable) return;
  adapters.auth.renderMethods(slotChildren(el, "methods"), {
    onSignedIn: () => boot(),
    onError: (text) => (error.textContent = text),
  });
}

// A load that throws unauthorized or forbidden shows the login screen (recipes/contracts.md).
function handleAuthError(error) {
  if (!AUTH_CODES.has(error?.code)) return false;
  current.cleanup();
  current = idle;
  showLogin({ message: error.code === "forbidden" ? "This account isn't allowed. Sign in with another one." : "" });
  return true;
}

async function boot() {
  let who;
  try {
    who = await adapters.auth.session();
  } catch {
    showLogin({ unreachable: true });
    return;
  }
  if (!who?.user) {
    showLogin();
    return;
  }
  user = who.user;
  mountLayout();
  route();
}

// ---------- Router ----------

function parse(hash) {
  const parts = hash.replace(/^#\/?/, "").split("/").filter(Boolean).map(decodeURIComponent);
  if (parts.length === 0) return { screen: "home" };
  const type = types.get(parts[0]);
  if (type && parts.length === 1) return { screen: "collection", type };
  if (type && parts.length === 2) return { screen: "item", type, id: parts[1] };
  const singleton = singletons.get(parts[0]);
  if (singleton && parts.length === 1) return { screen: "singleton", singleton };
  return { screen: "notfound" };
}

function route() {
  lastHash = location.hash;
  if (!layout) return boot();
  const gen = ++renderId;
  const target = parse(location.hash);
  if (target.screen === "home") return renderHome(gen);
  if (target.screen === "collection") return renderCollection(gen, target.type);
  if (target.screen === "item") return renderItem(gen, target.type, target.id);
  if (target.screen === "singleton") return renderSingleton(gen, target.singleton);
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
  current = idle;
  route();
});

// ---------- Screens ----------

function homeTemplate(title) {
  const el = tpl("screen-home");
  fill(el, {
    text: { title, "loading-text": "Loading…", "content-heading": "Content", "recent-heading": "Recently edited" },
    attrs: { state: "loading" },
  });
  repeat(slotRepeat(el, "entry"), [], rowFill);
  repeat(slotRepeat(el, "recent"), [], rowFill);
  return el;
}

const rowFill = (unit, row) =>
  fill(unit, { text: { title: row.title, subtitle: row.subtitle, meta: row.meta ?? "" }, attrs: { href: row.href } });

async function renderHome(gen) {
  const el = homeTemplate(PANEL.name);
  mountScreen(el);
  setNav("#/");
  setCrumbs([{ text: "Home", href: "#/" }]);
  const off = installShortcuts({});
  current = { cleanup: off, dirty: () => false };
  try {
    const lists = await Promise.all(PANEL.types.map((t) => adapters.data.list(t.id)));
    if (gen !== renderId) return;
    const entries = [
      ...PANEL.types.map((t, i) => ({ title: t.label, subtitle: count(lists[i].length, t.singular), href: `#/${t.id}` })),
      ...PANEL.singletons.map((s) => ({ title: s.label, subtitle: "Page", href: `#/${s.id}` })),
    ];
    const recent = PANEL.types
      .flatMap((t, i) => lists[i].map((item) => ({ type: t, item })))
      .sort((a, b) => String(b.item.updatedAt).localeCompare(String(a.item.updatedAt)))
      .slice(0, 5)
      .map(({ type, item }) => ({
        title: itemTitle(type, item),
        subtitle: type.label,
        meta: formatDate(item.updatedAt),
        href: `#/${type.id}/${encodeURIComponent(item.id)}`,
      }));
    repeat(slotRepeat(el, "entry"), entries, rowFill);
    repeat(slotRepeat(el, "recent"), recent, rowFill);
    setScreenState(el, "ready");
  } catch (error) {
    if (gen !== renderId || handleAuthError(error)) return;
    regionError(el, { title: "Could not load the panel", text: "Check your connection and try again.", retry: rerun });
  }
}

function renderNotFound() {
  const el = homeTemplate("Not found");
  mountScreen(el);
  setNav(null);
  setCrumbs([
    { text: "Home", href: "#/" },
    { text: "Not found", href: location.hash },
  ]);
  const off = installShortcuts({});
  current = { cleanup: off, dirty: () => false };
  regionError(el, {
    title: "This page doesn't exist",
    text: "Check the address, or go back home.",
    retry: () => (location.hash = "#/"),
  });
}

function sortOptions(type) {
  const name = type.list.sort?.replace(/^-/, "");
  const options = [];
  if (name) {
    const field = fieldOf(type, name);
    const isDate = field?.type === "date";
    options.push(
      { value: `-${name}`, text: isDate ? "Newest first" : `${field.label}, descending` },
      { value: name, text: isDate ? "Oldest first" : `${field.label}, ascending` },
    );
  }
  options.push({ value: type.list.title, text: "Title A–Z" });
  return options;
}

function sortItems(type, items, sort) {
  const desc = sort.startsWith("-");
  const name = sort.replace(/^-/, "");
  const field = fieldOf(type, name);
  const blank = (v) => v === null || v === undefined || v === "" || (Array.isArray(v) && !v.length);
  return [...items].sort((a, b) => {
    const x = a.values?.[name];
    const y = b.values?.[name];
    if (blank(x) || blank(y)) return blank(x) - blank(y);
    const order =
      field?.type === "number" ? x - y : field?.type === "date" ? String(x).localeCompare(String(y)) : String(x).localeCompare(String(y), undefined, { sensitivity: "base" });
    return desc ? -order : order;
  });
}

async function renderCollection(gen, type) {
  const lower = type.label.toLowerCase();
  const el = tpl("screen-collection");
  fill(el, {
    text: {
      title: type.label,
      "create-label": `New ${type.singular}`,
      "loading-text": "Loading…",
      "search-label": `Search ${lower}`,
      "sort-label": "Sort by",
    },
    attrs: { state: "loading", "type-id": type.id, "search-placeholder": `Search ${lower}` },
  });
  const options = sortOptions(type);
  const sortSelect = el.querySelector(".pn-select");
  const search = el.querySelector('input[type="search"]');
  repeat(slotRepeat(el, "sort-option"), options, (unit, o) => fill(unit, { text: { text: o.text }, attrs: { value: o.value } }));
  sortSelect.value = options[0].value;
  mountScreen(el);
  setNav(`#/${type.id}`);
  setCrumbs([
    { text: "Home", href: "#/" },
    { text: type.label, href: `#/${type.id}` },
  ]);

  // Create flow (behavior-spec.md section 5).
  const dialog = tpl("screen-create");
  fill(dialog, { text: { title: `New ${type.singular}` } });
  const slugField = type.fields.find((f) => f.type === "slug" && f.from === type.list.title);
  const createFields = [fieldOf(type, type.list.title), slugField].filter(Boolean);
  const createControls = createFields.map((f) => makeField(f, { prefix: `${type.id}-new`, files: adapters.files }));
  for (const c of createControls) slotChildren(dialog, "fields").append(c.el);
  dialogsSlot.append(dialog);
  const createValidationState = createValidation({
    root: dialog,
    fields: createFields,
    get: (name) => createControls.find((c) => c.field.name === name).get(),
  });
  const flow = createFlow({
    dialog,
    title: type.list.title,
    slug: slugField?.name ?? null,
    validation: createValidationState,
    read: () => Object.fromEntries(createControls.map((c) => [c.field.name, c.get()])),
    create: (input) => {
      const values = Object.fromEntries(type.fields.map((f) => [f.name, emptyValue(f)]));
      Object.assign(values, input);
      for (const f of type.fields) if (f.compute) values[f.name] = computed[f.compute].value(values);
      return adapters.data.create(type.id, { status: type.status?.[0], values });
    },
    onCreated: (item) => (location.hash = `#/${type.id}/${encodeURIComponent(item.id)}`),
    onError: () => toast("Could not create. Try again.", "negative"),
  });
  const openCreate = (event) => flow.open(event.currentTarget);
  el.querySelector('.pn-screen-actions [data-action="create"]').addEventListener("click", openCreate);

  const off = installShortcuts({ search: () => (el.dataset.state === "ready" ? search : null) });
  current = {
    cleanup() {
      off();
      createValidationState.destroy();
      if (dialog.open) dialog.close();
      dialog.remove();
    },
    dirty: () => false,
  };

  let items = [];
  const rowsEl = slotRepeat(el, "row");
  repeat(rowsEl, [], () => {});
  function renderRows() {
    const query = search.value.trim().toLowerCase();
    const shown = sortItems(type, items, sortSelect.value).filter(
      (item) => !query || type.list.search?.some((name) => display(type, name, item.values?.[name]).toLowerCase().includes(query)),
    );
    repeat(rowsEl, shown, (unit, item) =>
      fill(unit, {
        text: {
          title: itemTitle(type, item),
          subtitle: type.list.subtitle ? display(type, type.list.subtitle, item.values?.[type.list.subtitle]) : "",
          status: type.status ? cap(item.status ?? type.status[0]) : "",
        },
        attrs: { href: `#/${type.id}/${encodeURIComponent(item.id)}`, tone: type.status ? tone(type, item.status ?? type.status[0]) : "neutral" },
      }),
    );
  }
  search.addEventListener("input", renderRows);
  sortSelect.addEventListener("change", renderRows);

  try {
    items = await adapters.data.list(type.id);
    if (gen !== renderId) return;
  } catch (error) {
    if (gen !== renderId || handleAuthError(error)) return;
    regionError(el, { title: `Could not load ${lower}`, text: "Check your connection and try again.", retry: rerun });
    return;
  }
  if (!items.length) {
    const empty = tpl("empty");
    fill(empty, { text: { title: `No ${lower} yet`, text: `Create the first ${type.singular}.` }, attrs: { icon: "#pn-icon-file" } });
    const create = button(`New ${type.singular}`, { variant: "primary", action: "create", icon: "#pn-icon-plus" });
    create.addEventListener("click", openCreate);
    slotChildren(empty, "actions").append(create);
    slotChildren(el, "empty").replaceChildren(empty);
    setScreenState(el, "empty");
    return;
  }
  renderRows();
  setScreenState(el, "ready");
}

// Builds the fields of an item or singleton form. Returns the controllers and read/write helpers.
function buildForm(def, form, prefix) {
  const controls = [];
  const plain = () => Object.fromEntries(controls.filter((c) => !c.field.compute).map((c) => [c.field.name, c.get()]));
  for (const field of def.fields) {
    const c = makeField(field, { prefix, files: adapters.files, computed, values: plain, root: form });
    controls.push(c);
    slotChildren(form, "fields").append(c.el);
  }
  const byName = new Map(controls.map((c) => [c.field.name, c]));
  const read = () => Object.fromEntries(controls.map((c) => [c.field.name, c.get()]));
  const write = (values) => {
    for (const c of controls) c.set(structuredClone(values?.[c.field.name] ?? emptyValue(c.field)));
  };
  return { controls, byName, read, write };
}

function mountSavebar() {
  const savebar = tpl("savebar");
  fill(savebar, { text: { message: "All changes saved" }, attrs: { "save-state": "clean" } });
  savebarSlot.replaceChildren(savebar);
  return savebar;
}

function signedOutOnSave(error) {
  if (AUTH_CODES.has(error?.code)) toast("You were signed out. Copy your edits, then reload to sign in.", "negative");
}

const conflictMessage = (error) => (error?.code === "conflict" ? "Changed elsewhere. Copy your edits, then reload." : null);

async function renderItem(gen, type, id) {
  const el = tpl("screen-item");
  fill(el, { text: { title: "Loading…", "loading-text": "Loading…", status: "" }, attrs: { state: "loading", "type-id": type.id } });
  const statusButton = el.querySelector('[data-action="status"]');
  statusButton.hidden = true;
  mountScreen(el);
  setNav(`#/${type.id}`);
  const crumbs = (last) =>
    setCrumbs([
      { text: "Home", href: "#/" },
      { text: type.label, href: `#/${type.id}` },
      { text: last, href: `#/${type.id}/${encodeURIComponent(id)}` },
    ]);
  const setTitle = (text) => {
    el.querySelector(".pn-screen-title").textContent = text;
    crumbs(text);
  };
  crumbs("Loading…");

  let saveState = null;
  let validation = null;
  let slideOver = null;
  const off = installShortcuts({ save: () => saveState?.save() });
  current = {
    cleanup() {
      off();
      saveState?.destroy();
      validation?.destroy();
      slideOver?.remove();
    },
    dirty: () => Boolean(saveState?.dirty),
  };

  let item;
  try {
    item = await adapters.data.get(type.id, id);
    if (gen !== renderId) return;
  } catch (error) {
    if (gen !== renderId || handleAuthError(error)) return;
    if (error?.code === "not-found") {
      setTitle("Not found");
      regionError(el, { title: `This ${type.singular} doesn't exist`, text: "It may have been deleted." });
    } else {
      setTitle("Could not load");
      regionError(el, { title: `Could not load this ${type.singular}`, text: "Check your connection and try again.", retry: rerun });
    }
    return;
  }

  const form = el.querySelector("form");
  const { byName, read, write: writeFields } = buildForm(type, form, type.id);
  let status = type.status ? item.status ?? type.status[0] : undefined;
  const first = type.status?.[0];

  // behavior: Show word count under the body field
  const wordField = type.wordCount ? byName.get(type.wordCount) : null;
  const showWordCount = () => {
    if (wordField) wordField.el.querySelector(".pn-help").textContent = count(words(wordField.get()), "word");
  };
  wordField?.el.addEventListener("input", showWordCount);
  const write = (values) => {
    writeFields(values);
    showWordCount();
  };
  write(item.values);

  const showMeta = () => fill(el, { text: { created: formatDate(item.createdAt), updated: formatDate(item.updatedAt) } });
  const showStatus = () => {
    if (!type.status) return;
    fill(el, { text: { status: cap(status) }, attrs: { tone: tone(type, status) } });
  };
  showMeta();
  setTitle(itemTitle(type, item));
  if (type.status) {
    statusButton.hidden = false;
    showStatus();
  }

  validation = createValidation({ root: form, fields: type.fields, get: (name) => byName.get(name).get() });
  const isPublish = (target) => Boolean(type.status) && target !== first;

  // Runs V3, V4, or V8 and shows the save bar message. False blocks the save.
  function check(target) {
    const publishing = isPublish(target);
    const invalid = publishing ? validation.run("publish", type.publishRequires ?? []) : validation.run("format");
    if (!invalid.length) return true;
    validation.focus(invalid[0]);
    saveState.say(fixMessage(invalid.length, publishing ? "publish" : "save"));
    return false;
  }

  const savebar = mountSavebar();
  saveState = createSaveState({
    form,
    savebar,
    read,
    write,
    async save(values, extra) {
      const next = extra?.status ?? status;
      try {
        item = await adapters.data.update(type.id, item.id, { status: next, values });
      } catch (error) {
        signedOutOnSave(error);
        throw error;
      }
      status = type.status ? item.status ?? next : undefined;
      showStatus();
      showMeta();
      setTitle(itemTitle(type, item));
    },
    validate: (values, { background, extra }) => (background ? validation.valid() : check(extra?.status ?? status)),
    // behavior: Autosave drafts every 10 seconds
    autosave: type.autosave
      ? { every: type.autosave.every, when: () => (type.autosave.drafts && type.status ? status === first : true) }
      : undefined,
    onRevert: () => validation.clear(),
    errorMessage: conflictMessage,
  });

  async function moveTo(next) {
    if (next === status) return;
    // P3: publishing runs V4 first; if it fails, the status does not change.
    if (isPublish(next) && !check(next)) return;
    // behavior: Publishing asks for confirmation (P4, only when leaving the first status)
    if (type.confirmPublish && status === first && next !== first) {
      const ok = await confirmDialog(confirmEl, {
        title: `Publish this ${type.singular}?`,
        text: "It will be visible on the site.",
        confirmLabel: cap(next),
        variant: "primary",
        opener: statusButton,
      });
      if (!ok) return;
    }
    const forward = type.status.indexOf(next) > type.status.indexOf(status);
    // P5: a status change saves at once, with any unsaved edits.
    if (await saveState.save({ status: next })) {
      toast(forward ? `${cap(type.singular)} ${next}` : `${cap(type.singular)} moved to ${next}`, "positive");
    }
  }

  async function pickStatus() {
    slideOver = tpl("screen-slide-over");
    fill(slideOver, { text: { title: "Status" } });
    const fieldset = document.createElement("fieldset");
    fieldset.className = "pn-choices";
    const legend = document.createElement("legend");
    legend.className = "pn-visually-hidden";
    legend.textContent = "Status";
    fieldset.append(legend);
    for (const name of type.status) {
      const label = document.createElement("label");
      label.className = "pn-choice";
      const radio = document.createElement("input");
      radio.className = "pn-radio";
      radio.type = "radio";
      radio.name = "pn-status";
      radio.value = name;
      radio.checked = name === status;
      label.append(radio, cap(name));
      fieldset.append(label);
    }
    slotChildren(slideOver, "body").append(fieldset);
    dialogsSlot.append(slideOver);
    const result = await openDialog(slideOver, { opener: statusButton });
    const chosen = slideOver.querySelector("input:checked")?.value;
    slideOver.remove();
    slideOver = null;
    if (result === "done" && chosen) await moveTo(chosen);
  }

  statusButton.addEventListener("click", () => {
    if (!type.status || saveState.state === "saving") return;
    if (type.status.length === 2) moveTo(type.status.find((s) => s !== status));
    else pickStatus();
  });

  el.querySelector('[data-action="delete"]').addEventListener("click", async (event) => {
    const ok = await confirmDialog(confirmEl, {
      title: `Delete this ${type.singular}?`,
      text: "This can't be undone.",
      confirmLabel: "Delete",
      variant: "negative",
      opener: event.currentTarget,
    });
    if (!ok) return;
    try {
      await adapters.data.remove(type.id, item.id);
    } catch (error) {
      if (handleAuthError(error)) return;
      toast("Could not delete. Try again.", "negative");
      return;
    }
    current.cleanup();
    current = idle;
    toast(`${cap(type.singular)} deleted`);
    location.hash = `#/${type.id}`;
  });

  setScreenState(el, "ready");
}

async function renderSingleton(gen, singleton) {
  const el = tpl("screen-singleton");
  fill(el, { text: { title: singleton.label, "loading-text": "Loading…" }, attrs: { state: "loading", "singleton-id": singleton.id } });
  mountScreen(el);
  setNav(`#/${singleton.id}`);
  setCrumbs([
    { text: "Home", href: "#/" },
    { text: singleton.label, href: `#/${singleton.id}` },
  ]);

  let saveState = null;
  let validation = null;
  const off = installShortcuts({ save: () => saveState?.save() });
  current = {
    cleanup() {
      off();
      saveState?.destroy();
      validation?.destroy();
    },
    dirty: () => Boolean(saveState?.dirty),
  };

  let record;
  try {
    record = await adapters.data.getSingleton(singleton.id);
    if (gen !== renderId) return;
  } catch (error) {
    if (gen !== renderId || handleAuthError(error)) return;
    regionError(el, { title: `Could not load ${singleton.label.toLowerCase()}`, text: "Check your connection and try again.", retry: rerun });
    return;
  }

  const form = el.querySelector("form");
  const { byName, read, write } = buildForm(singleton, form, singleton.id);
  write(record?.values ?? {});
  validation = createValidation({ root: form, fields: singleton.fields, get: (name) => byName.get(name).get() });

  const savebar = mountSavebar();
  saveState = createSaveState({
    form,
    savebar,
    read,
    write,
    async save(values) {
      try {
        await adapters.data.saveSingleton(singleton.id, values);
      } catch (error) {
        signedOutOnSave(error);
        throw error;
      }
    },
    // V7: a singleton save is blocked by empty required fields too.
    validate() {
      const invalid = validation.run("required");
      if (!invalid.length) return true;
      validation.focus(invalid[0]);
      saveState.say(fixMessage(invalid.length, "save"));
      return false;
    },
    onRevert: () => validation.clear(),
    errorMessage: conflictMessage,
  });
  setScreenState(el, "ready");
}

// ---------- Test hook (behavior-spec.md section 7) ----------

if (adapters.test)
  window.panelTest = {
    ...adapters.test,
    reset(seed) {
      adapters.test.reset(seed);
      current.cleanup(); // drop the open screen without asking (S9 does not apply)
      current = idle;
      route(); // render the current route again from the new data
    },
  };

boot();
