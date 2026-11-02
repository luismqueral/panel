// Field Notes panel: routes, screens, and adapter wiring. Built from panel.config.js (build.md).

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

// ---------- Adapters (build.md step 6) ----------

function createRecipeAdapters() {
  const request = createRequest();
  const { data, files } = createHttpAdapters(request);
  return { data, files, auth: createGoogleAuth(request) };
}

const IDLE = { cleanup() {}, dirty: () => false };
let current = IDLE;
let layout = null;

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

// ---------- Helpers ----------

const app = document.getElementById("app");
const lower = (text) => text.toLowerCase();
const capital = (text) => text.charAt(0).toUpperCase() + text.slice(1);
const isAuthError = (error) => error?.code === "unauthorized" || error?.code === "forbidden";
const SIGNED_OUT = "You were signed out. Copy your edits, then reload to sign in.";

function formatDate(value) {
  if (!value) return "";
  const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const date = day ? new Date(Number(day[1]), Number(day[2]) - 1, Number(day[3])) : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function display(field, value) {
  if (value === null || value === undefined) return "";
  if (field?.type === "date") return formatDate(value);
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") return value.name ?? "";
  return String(value);
}

const fieldOf = (def, name) => def.fields.find((f) => f.name === name);
const titleOf = (type, item) => item?.values?.[type.list.title] || "Untitled";
const toneOf = (type, status) => {
  const i = type.status.indexOf(status);
  return i === 0 ? "neutral" : i === type.status.length - 1 ? "positive" : "notice";
};
const count = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const words = (text) => (text ?? "").trim().split(/\s+/).filter(Boolean).length;

// "Estimated minutes to read, from the word count of body", rounded up, at least 1.
const computed = {
  readingTime: {
    value: (values) => Math.max(1, Math.ceil(words(values.body) / 200)),
    display: (values) => `${computed.readingTime.value(values)} min`,
  },
};

function button(text, { variant, action }) {
  const el = document.createElement("button");
  el.className = "pn-button";
  el.type = "button";
  if (variant) el.dataset.variant = variant;
  el.dataset.action = action;
  el.textContent = text;
  return el;
}

const setState = (screen, state) => fill(screen, { attrs: { state } });
const toast = (text, tone) => layout && showToast(slotChildren(layout, "toasts"), text, tone ? { tone } : undefined);

function showError(screen, { title, text, retry }) {
  const box = tpl("error");
  fill(box, { text: { title, text } });
  if (retry) {
    const again = button("Try again", { action: "retry" });
    again.addEventListener("click", retry);
    slotChildren(box, "actions").append(again);
  }
  slotChildren(screen, "error").replaceChildren(box);
  setState(screen, "error");
}

const rerun = () => {
  current.cleanup();
  route();
};

// Blank values for every field, then the schema's defaults (C4).
function blankValues(def) {
  const values = {};
  for (const f of def.fields) {
    if (f.default !== undefined) values[f.name] = structuredClone(f.default);
    else if (f.type === "tags") values[f.name] = [];
    else if (f.type === "toggle") values[f.name] = false;
    else if (["number", "image", "file", "relation", "custom"].includes(f.type)) values[f.name] = null;
    else values[f.name] = "";
  }
  for (const f of def.fields) if (f.compute) values[f.name] = computed[f.compute].value(values);
  return values;
}

// ---------- Shell: layout, nav, header ----------

function mountLayout(user) {
  layout = tpl("layout");
  const nav = tpl("nav");
  fill(nav, { text: { brand: PANEL.name } });
  const account = tpl("account");
  fill(account, { text: { user } });
  account.querySelector('[data-action="logout"]').addEventListener("click", logout);
  slotChildren(nav, "account").append(account);
  slotChildren(layout, "nav").append(nav);
  slotChildren(layout, "header").append(tpl("header"));
  slotChildren(layout, "dialogs").append(tpl("screen-dialog"));
  app.replaceChildren(layout);
}

const confirmBox = () => slotChildren(layout, "dialogs").querySelector('[data-template="screen-dialog"]');

function setNav(currentHref) {
  const entries = [
    { text: "Home", href: "#/" },
    ...PANEL.types.map((t) => ({ text: t.label, href: `#/${t.id}` })),
    ...PANEL.singletons.map((s) => ({ text: s.label, href: `#/${s.id}` })),
  ];
  repeat(slotRepeat(layout, "entry"), entries, (unit, e) =>
    fill(unit, { text: { text: e.text }, attrs: { href: e.href, current: e.href === currentHref ? "page" : "false" } }),
  );
}

function setCrumbs(crumbs) {
  const last = crumbs.length - 1;
  repeat(slotRepeat(layout, "crumb"), crumbs, (unit, c, i) =>
    fill(unit, { text: { text: c.text }, attrs: { href: c.href, current: i === last ? "page" : "false" } }),
  );
  document.title = `${crumbs[last].text} · ${PANEL.name}`;
}

function mount(screen, savebar = null) {
  slotChildren(layout, "screen").replaceChildren(screen);
  slotChildren(layout, "savebar").replaceChildren(...(savebar ? [savebar] : []));
}

const discard = () =>
  confirmDialog(confirmBox(), { title: "Discard unsaved changes?", text: "Your edits will be lost.", confirmLabel: "Discard", variant: "negative" });

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

// ---------- Login ----------

function showLogin({ message = "", unreachable = false } = {}) {
  current.cleanup();
  current = IDLE;
  layout = null;
  const screen = tpl("screen-login");
  fill(screen, { text: { title: PANEL.name, text: "Sign in to edit the site.", error: message } });
  app.replaceChildren(screen);
  document.title = `Sign in · ${PANEL.name}`;
  if (unreachable) return;
  adapters.auth.renderMethods(slotChildren(screen, "methods"), {
    onSignedIn: () => route(),
    onError: (text) => fill(screen, { text: { error: text } }),
  });
}

function loadFailed(error) {
  if (!isAuthError(error)) return false;
  showLogin({ message: error.code === "forbidden" ? "This account isn't allowed. Sign in with another one." : "" });
  return true;
}

// ---------- Home and not found ----------

function homeScreen({ notFound = false } = {}) {
  const screen = tpl("screen-home");
  fill(screen, {
    text: { title: notFound ? "Not found" : PANEL.name, "loading-text": "Loading…", "content-heading": "Content", "recent-heading": "Recently edited" },
    attrs: { state: "loading" },
  });
  mount(screen);
  let alive = true;

  if (notFound) {
    setNav(null);
    setCrumbs([{ text: "Home", href: "#/" }, { text: "Not found", href: location.hash }]);
    showError(screen, { title: "This page doesn't exist", text: "Check the address, or go back home.", retry: () => (location.hash = "#/") });
    return { cleanup: () => (alive = false), dirty: () => false };
  }

  setNav("#/");
  setCrumbs([{ text: "Home", href: "#/" }]);
  (async () => {
    try {
      const lists = await Promise.all(PANEL.types.map((t) => adapters.data.list(t.id)));
      if (!alive) return;
      const entries = [
        ...PANEL.types.map((t, i) => ({ title: t.label, subtitle: count(lists[i].length, t.singular, lower(t.label)), href: `#/${t.id}` })),
        ...PANEL.singletons.map((s) => ({ title: s.label, subtitle: "Page", href: `#/${s.id}` })),
      ];
      repeat(slotRepeat(screen, "entry"), entries, (unit, e) => fill(unit, { text: { title: e.title, subtitle: e.subtitle, meta: "" }, attrs: { href: e.href } }));
      const recent = PANEL.types
        .flatMap((t, i) => lists[i].map((item) => ({ type: t, item })))
        .sort((a, b) => String(b.item.updatedAt ?? "").localeCompare(String(a.item.updatedAt ?? "")))
        .slice(0, 5);
      repeat(slotRepeat(screen, "recent"), recent, (unit, { type, item }) =>
        fill(unit, { text: { title: titleOf(type, item), subtitle: type.label, meta: formatDate(item.updatedAt) }, attrs: { href: `#/${type.id}/${encodeURIComponent(item.id)}` } }),
      );
      setState(screen, "ready");
    } catch (error) {
      if (!alive || loadFailed(error)) return;
      showError(screen, { title: "Could not load the panel", text: "Check your connection and try again.", retry: rerun });
    }
  })();
  return { cleanup: () => (alive = false), dirty: () => false };
}

// ---------- Collection ----------

function sortOptions(type) {
  const name = type.list.sort.replace(/^-/, "");
  const field = fieldOf(type, name);
  const options =
    field.type === "date"
      ? [{ value: `-${name}`, text: "Newest first" }, { value: name, text: "Oldest first" }]
      : [{ value: `-${name}`, text: `${field.label}, descending` }, { value: name, text: `${field.label}, ascending` }];
  if (type.list.title !== name) options.push({ value: type.list.title, text: "Title A–Z" });
  return options;
}

function sortItems(items, key) {
  const desc = key.startsWith("-");
  const name = key.replace(/^-/, "");
  const blank = (v) => v === null || v === undefined || v === "";
  return [...items].sort((a, b) => {
    const x = a.values?.[name];
    const y = b.values?.[name];
    if (blank(x) || blank(y)) return blank(x) - blank(y);
    const order = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y));
    return desc ? -order : order;
  });
}

function collectionScreen(type) {
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
  const sortSelect = slotRepeat(screen, "sort-option");
  repeat(sortSelect, options, (unit, o) => fill(unit, { text: { text: o.text }, attrs: { value: o.value } }));
  sortSelect.value = type.list.sort;
  const search = screen.querySelector('input[type="search"]');
  mount(screen);
  setNav(`#/${type.id}`);
  setCrumbs([{ text: "Home", href: "#/" }, { text: type.label, href: `#/${type.id}` }]);

  // Create flow (C1–C6): the list.title field, plus any slug made from it.
  const dialog = tpl("screen-create");
  fill(dialog, { text: { title: `New ${type.singular}` } });
  const titleField = fieldOf(type, type.list.title);
  const slugField = type.fields.find((f) => f.type === "slug" && f.from === type.list.title);
  const createFields = [titleField, slugField].filter(Boolean);
  const controls = createFields.map((f) => makeField(f, { prefix: `${type.id}-new`, files: adapters.files }));
  for (const c of controls) slotChildren(dialog, "fields").append(c.el);
  slotChildren(layout, "dialogs").append(dialog);
  const read = () => Object.fromEntries(controls.map((c) => [c.field.name, c.get()]));
  const flow = createFlow({
    dialog,
    title: titleField.name,
    slug: slugField?.name ?? null,
    validation: createValidation({ root: dialog, fields: createFields, get: (name) => read()[name] }),
    read,
    create: (values) => adapters.data.create(type.id, { status: type.status?.[0], values: { ...blankValues(type), ...values } }),
    onCreated: (item) => (location.hash = `#/${type.id}/${encodeURIComponent(item.id)}`),
    onError: () => toast("Could not create. Try again.", "negative"),
  });
  const openCreate = (event) => flow.open(event.currentTarget);
  screen.querySelector('.pn-screen-actions [data-action="create"]').addEventListener("click", openCreate);

  let items = [];
  function render() {
    const query = search.value.trim().toLowerCase();
    const shown = sortItems(items, sortSelect.value).filter(
      (item) => !query || type.list.search.some((name) => display(fieldOf(type, name), item.values?.[name]).toLowerCase().includes(query)),
    );
    repeat(slotRepeat(screen, "row"), shown, (unit, item) =>
      fill(unit, {
        text: {
          title: titleOf(type, item),
          subtitle: type.list.subtitle ? display(fieldOf(type, type.list.subtitle), item.values?.[type.list.subtitle]) : "",
          status: type.status ? capital(item.status ?? "") : "",
        },
        attrs: { href: `#/${type.id}/${encodeURIComponent(item.id)}`, tone: type.status ? toneOf(type, item.status) : "" },
      }),
    );
  }
  search.addEventListener("input", render);
  sortSelect.addEventListener("change", render);
  const offKeys = installShortcuts({ search: () => search });

  let alive = true;
  (async () => {
    try {
      items = await adapters.data.list(type.id);
      if (!alive) return;
      render();
      if (items.length) return setState(screen, "ready");
      const empty = tpl("empty");
      fill(empty, { text: { title: `No ${label} yet`, text: `Create the first ${type.singular}.` }, attrs: { icon: "#pn-icon-file" } });
      const first = button(`New ${type.singular}`, { variant: "primary", action: "create" });
      first.addEventListener("click", openCreate);
      slotChildren(empty, "actions").append(first);
      slotChildren(screen, "empty").replaceChildren(empty);
      setState(screen, "empty");
    } catch (error) {
      if (!alive || loadFailed(error)) return;
      showError(screen, { title: `Could not load ${label}`, text: "Check your connection and try again.", retry: rerun });
    }
  })();

  return {
    cleanup() {
      alive = false;
      offKeys();
      if (dialog.open) dialog.close();
      dialog.remove();
    },
    dirty: () => false,
  };
}

// ---------- Item and singleton forms ----------

// The fields of one form, with read/write over every value and validation over them.
function buildForm(def, form, values) {
  const controls = [];
  const valuesNow = () => Object.fromEntries(controls.filter((c) => !c.field.compute).map((c) => [c.field.name, c.get()]));
  for (const f of def.fields) {
    const c = makeField(f, { prefix: def.id, files: adapters.files, computed, values: valuesNow, root: form });
    slotChildren(form, "fields").append(c.el);
    controls.push(c);
  }
  const control = (name) => controls.find((c) => c.field.name === name);

  // behavior: Show word count under the body field
  const counted = def.wordCount && control(def.wordCount);
  const showWordCount = () => {
    if (counted) counted.el.querySelector('[data-slot="help"]').textContent = count(words(counted.get()), "word", "words");
  };
  counted?.el.addEventListener("input", showWordCount);

  const read = () => Object.fromEntries(controls.map((c) => [c.field.name, c.get()]));
  const write = (next) => {
    for (const c of controls) c.set(next?.[c.field.name]);
    showWordCount();
  };
  write(values);

  // conformance: Publishing a post requires a cover image. Only "publish" mode reads `required`
  // on these fields, so the field's own required rule still holds for create and save.
  const validation = createValidation({
    root: form,
    fields: def.fields.map((f) => (def.publishRequires?.includes(f.name) ? { ...f, required: true } : f)),
    get: (name) => control(name).get(),
  });
  return { read, write, validation };
}

function savebarFor() {
  const bar = tpl("savebar");
  fill(bar, { text: { message: "" }, attrs: { "save-state": "clean" } });
  return bar;
}

// Every save failure is rethrown, so the save bar enters error with every edit kept (S5).
function saveFailed(error, saveState) {
  if (isAuthError(error)) toast(SIGNED_OUT, "negative");
  else if (error?.code === "conflict") setTimeout(() => saveState().say("Changed elsewhere. Copy your edits, then reload."));
  else if (error?.code === "invalid") console.error(error);
  throw error;
}

// More than two statuses: pick one in the slide-over (P2).
async function pickStatus(type, status, opener) {
  const drawer = tpl("screen-slide-over");
  fill(drawer, { text: { title: "Status" } });
  const choices = document.createElement("fieldset");
  choices.className = "pn-choices";
  const legend = document.createElement("legend");
  legend.className = "pn-visually-hidden";
  legend.textContent = "Status";
  choices.append(legend);
  for (const s of type.status) {
    const label = document.createElement("label");
    label.className = "pn-choice";
    const radio = document.createElement("input");
    radio.className = "pn-radio";
    radio.type = "radio";
    radio.name = "pn-status";
    radio.value = s;
    radio.checked = s === status;
    label.append(radio, capital(s));
    choices.append(label);
  }
  slotChildren(drawer, "body").append(choices);
  slotChildren(layout, "dialogs").append(drawer);
  const result = await openDialog(drawer, { opener });
  const picked = choices.querySelector("input:checked")?.value;
  drawer.remove();
  return result === "done" ? picked : null;
}

function itemScreen(type, id) {
  const screen = tpl("screen-item");
  fill(screen, { text: { title: "Loading…", "loading-text": "Loading…", status: "" }, attrs: { state: "loading", "type-id": type.id, tone: "" } });
  mount(screen);
  setNav(`#/${type.id}`);
  const crumbs = (last) => setCrumbs([{ text: "Home", href: "#/" }, { text: type.label, href: `#/${type.id}` }, { text: last, href: location.hash }]);
  crumbs("Loading…");

  let alive = true;
  let teardown = () => {};
  let isDirty = () => false;

  (async () => {
    let item;
    try {
      item = await adapters.data.get(type.id, id);
    } catch (error) {
      if (!alive || loadFailed(error)) return;
      const missing = error?.code === "not-found";
      fill(screen, { text: { title: missing ? "Not found" : "Could not load" } });
      crumbs(missing ? "Not found" : "Could not load");
      if (missing) showError(screen, { title: `This ${type.singular} doesn't exist`, text: "It may have been deleted." });
      else showError(screen, { title: `Could not load this ${type.singular}`, text: "Check your connection and try again.", retry: rerun });
      return;
    }
    if (!alive) return;

    const form = screen.querySelector("form");
    const statusButton = screen.querySelector('[data-action="status"]');
    const first = type.status?.[0];
    let status = item.status;
    let deleted = false;
    if (!type.status) statusButton.hidden = true;

    const showItem = () => {
      const title = titleOf(type, item);
      fill(screen, {
        text: { title, created: formatDate(item.createdAt), updated: formatDate(item.updatedAt), status: type.status ? capital(status) : "" },
        attrs: { tone: type.status ? toneOf(type, status) : "" },
      });
      crumbs(title);
    };

    const { read, write, validation } = buildForm(type, form, item.values);
    const savebar = savebarFor();
    mount(screen, savebar);
    showItem();

    const saveState = createSaveState({
      form,
      savebar,
      read,
      write,
      save: async (values, extra) => {
        try {
          item = await adapters.data.update(type.id, id, { status: extra?.status ?? status, values });
        } catch (error) {
          saveFailed(error, () => saveState);
        }
        status = item.status;
        if (alive) showItem();
      },
      // V3: a save is blocked only by format errors. Publishing is checked before it (P3).
      validate: (values, { background }) => {
        if (background) return validation.valid();
        const invalid = validation.run("format");
        if (!invalid.length) return true;
        validation.focus(invalid[0]);
        saveState.say(fixMessage(invalid.length, "save"));
        return false;
      },
      // behavior: Autosave drafts every 10 seconds
      autosave: type.autosave && { every: type.autosave.every, when: () => !type.autosave.drafts || status === first },
      onRevert: () => validation.clear(),
    });

    // P1–P5: the status button.
    let changing = false;
    async function changeStatus(next) {
      if (changing || saveState.state === "saving") return;
      const from = type.status.indexOf(status);
      const to = type.status.indexOf(next);
      if (status === first && next !== first) {
        const invalid = validation.run("publish", type.publishRequires ?? []);
        if (invalid.length) {
          validation.focus(invalid[0]);
          saveState.say(fixMessage(invalid.length, "publish"));
          return;
        }
        // behavior: Publishing asks for confirmation
        if (type.confirmPublish) {
          changing = true;
          const ok = await confirmDialog(confirmBox(), {
            title: `Publish this ${type.singular}?`,
            text: "It will be visible on the site.",
            confirmLabel: capital(next),
            opener: statusButton,
          });
          changing = false;
          if (!ok || !alive) return;
        }
      }
      changing = true;
      const saved = await saveState.save({ status: next });
      changing = false;
      if (!saved || !alive) return;
      const Singular = capital(type.singular);
      toast(to > from ? `${Singular} ${next}` : `${Singular} moved to ${next}`, "positive");
    }
    statusButton.addEventListener("click", async () => {
      if (!type.status || changing || saveState.state === "saving") return;
      if (type.status.length === 2) return changeStatus(type.status.find((s) => s !== status));
      const next = await pickStatus(type, status, statusButton);
      if (next && next !== status) changeStatus(next);
    });

    screen.querySelector('[data-action="delete"]').addEventListener("click", async (event) => {
      const ok = await confirmDialog(confirmBox(), {
        title: `Delete this ${type.singular}?`,
        text: "This can't be undone.",
        confirmLabel: "Delete",
        variant: "negative",
        opener: event.currentTarget,
      });
      if (!ok || !alive) return;
      try {
        await adapters.data.remove(type.id, id);
      } catch (error) {
        toast(isAuthError(error) ? SIGNED_OUT : "Could not delete. Try again.", "negative");
        return;
      }
      deleted = true;
      toast(`${capital(type.singular)} deleted`);
      location.hash = `#/${type.id}`;
    });

    const offKeys = installShortcuts({ save: () => saveState.save() });
    setState(screen, "ready");
    isDirty = () => !deleted && saveState.dirty;
    teardown = () => {
      offKeys();
      saveState.destroy();
      validation.destroy();
    };
  })();

  return {
    cleanup() {
      alive = false;
      teardown();
      teardown = () => {};
    },
    dirty: () => isDirty(),
  };
}

function singletonScreen(def) {
  const screen = tpl("screen-singleton");
  fill(screen, { text: { title: def.label, "loading-text": "Loading…" }, attrs: { state: "loading", "singleton-id": def.id } });
  mount(screen);
  setNav(`#/${def.id}`);
  setCrumbs([{ text: "Home", href: "#/" }, { text: def.label, href: `#/${def.id}` }]);

  let alive = true;
  let teardown = () => {};
  let isDirty = () => false;

  (async () => {
    let record;
    try {
      record = await adapters.data.getSingleton(def.id);
    } catch (error) {
      if (!alive || loadFailed(error)) return;
      showError(screen, { title: `Could not load ${lower(def.label)}`, text: "Check your connection and try again.", retry: rerun });
      return;
    }
    if (!alive) return;

    const form = screen.querySelector("form");
    const { read, write, validation } = buildForm(def, form, record?.values ?? blankValues(def));
    const savebar = savebarFor();
    mount(screen, savebar);

    const saveState = createSaveState({
      form,
      savebar,
      read,
      write,
      save: async (values) => {
        try {
          await adapters.data.saveSingleton(def.id, values);
        } catch (error) {
          saveFailed(error, () => saveState);
        }
      },
      // V7: a singleton save is blocked by empty required fields and format errors.
      validate: () => {
        const invalid = validation.run("required");
        if (!invalid.length) return true;
        validation.focus(invalid[0]);
        saveState.say(fixMessage(invalid.length, "save"));
        return false;
      },
      onRevert: () => validation.clear(),
    });

    const offKeys = installShortcuts({ save: () => saveState.save() });
    setState(screen, "ready");
    isDirty = () => saveState.dirty;
    teardown = () => {
      offKeys();
      saveState.destroy();
      validation.destroy();
    };
  })();

  return {
    cleanup() {
      alive = false;
      teardown();
      teardown = () => {};
    },
    dirty: () => isDirty(),
  };
}

// ---------- Routing (build.md step 4) ----------

let routing = 0;

async function route() {
  lastHash = location.hash;
  const run = ++routing;
  if (!layout) {
    let who;
    try {
      who = await adapters.auth.session();
    } catch {
      if (run === routing) showLogin({ message: "Could not reach the panel. Check your connection and reload.", unreachable: true });
      return;
    }
    if (run !== routing) return;
    if (!who) return showLogin();
    mountLayout(who.user);
  }
  const [a, b, ...rest] = (location.hash || "#/").slice(2).split("/").filter(Boolean).map(decodeURIComponent);
  const type = PANEL.types.find((t) => t.id === a);
  const singleton = PANEL.singletons.find((s) => s.id === a);
  if (!a) current = homeScreen();
  else if (type && !b) current = collectionScreen(type);
  else if (type && b && !rest.length) current = itemScreen(type, b);
  else if (singleton && !b) current = singletonScreen(singleton);
  else current = homeScreen({ notFound: true });
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

route();
