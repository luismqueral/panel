// The blog panel in React, built from panel/build.md with panel/flavors/react.md.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal, flushSync } from "react-dom";
import { PANEL } from "./panel.config.js";
import { Layout, Nav, Account, Header, Savebar, Home, Collection, Item, Singleton, CreateDialog, Dialog, SlideOver, Login, Empty, ErrorState, Button, Toast } from "./panel/templates.jsx";
import { Field } from "./panel/fields.jsx";
import { useSaveState, useValidation, useConfirm, useShortcuts } from "./panel/hooks.js";
import { openDialog } from "./panel/snippets/dialogs.js";
import { slugify } from "./panel/snippets/create-flow.js";
import { fixMessage } from "./panel/snippets/validation.js";

const words = (text) => (text ?? "").trim().split(/\s+/).filter(Boolean).length;
const COMPUTED = {
  readingTime: {
    value: (v) => Math.max(1, Math.ceil(words(v.body) / 200)),
    display: (v) => `${Math.max(1, Math.ceil(words(v.body) / 200))} min`,
  },
};
const capital = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");
const tone = (type, status) => {
  const i = type.status?.indexOf(status) ?? -1;
  return i <= 0 ? "neutral" : i === type.status.length - 1 ? "positive" : "notice";
};
function formatDate(value) {
  if (!value) return "";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(date);
}
const typeById = (id) => PANEL.types.find((t) => t.id === id);
const singletonById = (id) => PANEL.singletons.find((s) => s.id === id);
const defaults = (fields) => Object.fromEntries(fields.filter((f) => "default" in f).map((f) => [f.name, f.default]));
const withComputed = (fields, values) =>
  Object.fromEntries(fields.map((f) => [f.name, f.type === "custom" && COMPUTED[f.compute] ? COMPUTED[f.compute].value(values) : values[f.name] ?? null]));
// recipes/contracts.md, error codes: conflict
const saveError = (error) => (error?.code === "conflict" ? "Changed elsewhere. Copy your edits, then reload." : null);
const signedOutError = (e) => e?.code === "unauthorized" || e?.code === "forbidden";

function parseRoute(hash) {
  const [a, b] = hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  if (!a) return { screen: "home", key: "home" };
  const type = typeById(a);
  if (type && b) return { screen: "item", type, id: decodeURIComponent(b), key: a };
  if (type) return { screen: "collection", type, key: a };
  const single = singletonById(a);
  if (single && !b) return { screen: "singleton", def: single, key: a };
  return { screen: "not-found", key: "" };
}

// Loads once per key; state is loading, ready, or error.
function useLoad(load, key) {
  const [result, setResult] = useState({ state: "loading" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    setResult({ state: "loading" });
    load().then(
      (data) => live && setResult({ state: "ready", data }),
      (error) => live && setResult({ state: "error", error }),
    );
    return () => (live = false);
  }, [key, attempt]);
  return { ...result, retry: () => setAttempt((n) => n + 1) };
}

function LoadError({ title, text, retry }) {
  return <ErrorState title={title} text={text} actions={retry && <Button action="retry" onClick={retry}>Try again</Button>} />;
}

export default function App({ adapters }) {
  const { data, files, auth } = adapters;
  const [user, setUser] = useState(undefined);
  const [problem, setProblem] = useState("");
  const [loginError, setLoginError] = useState("");
  const [route, setRoute] = useState(() => parseRoute(location.hash));
  const [crumbs, setCrumbs] = useState([{ text: "Home", href: "#/" }]);
  const [toasts, setToasts] = useState([]);
  const [slots, setSlots] = useState({});
  const methods = useRef(null);
  const confirm = useConfirm();
  const dirty = useRef(() => false);
  const lastHash = useRef(location.hash);

  const toast = useCallback((text, tone = "info") => {
    const id = Math.random();
    setToasts((t) => [...t, { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);
  const discard = useCallback(() => confirm.ask({ title: "Discard unsaved changes?", text: "Your edits will be lost.", confirmLabel: "Discard", variant: "negative" }), [confirm]);

  const boot = useCallback(async () => {
    try {
      setProblem("");
      setUser(await auth.session());
    } catch {
      setUser(null);
      setProblem("Could not reach the panel. Check your connection and reload.");
    }
  }, [auth]);
  const signedOut = useCallback((error) => signedOutError(error) && (setUser(null), true), []);

  useEffect(() => {
    boot();
  }, [boot]);

  useEffect(() => {
    if (user === null && !problem && methods.current) auth.renderMethods(methods.current, { onSignedIn: boot, onError: setLoginError });
  }, [user, problem]);

  useEffect(() => {
    if (adapters.test)
      window.panelTest = {
        ...adapters.test,
        reset: (seed) => {
          adapters.test.reset(seed);
          dirty.current = () => false;
          flushSync(() => setRoute({ ...parseRoute(location.hash), n: Math.random() }));
        },
      };
  }, [adapters]);

  useEffect(() => {
    async function onHash() {
      if (location.hash === lastHash.current) return;
      if (location.hash && !location.hash.startsWith("#/")) {
        const target = document.getElementById(location.hash.slice(1));
        history.replaceState(null, "", lastHash.current || "#/");
        target?.focus();
        return;
      }
      if (dirty.current()) {
        const target = location.hash;
        history.pushState(null, "", lastHash.current || "#/");
        if (!(await discard())) return;
        history.replaceState(null, "", target);
      }
      dirty.current = () => false;
      lastHash.current = location.hash;
      setRoute(parseRoute(location.hash));
    }
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [discard]);

  useEffect(() => {
    document.title = user === null ? `Sign in · ${PANEL.name}` : `${crumbs.at(-1).text} · ${PANEL.name}`;
  }, [crumbs, user]);

  if (user === undefined) return null;
  if (!user)
    return (
      <Login title={PANEL.name} text="Sign in to edit the site." methods={<div ref={methods} style={{ display: "contents" }} />} error={problem || loginError} />
    );

  const entries = [
    { text: "Home", href: "#/", current: route.key === "home" },
    ...PANEL.types.map((t) => ({ text: t.label, href: `#/${t.id}`, current: route.key === t.id })),
    ...PANEL.singletons.map((s) => ({ text: s.label, href: `#/${s.id}`, current: route.key === s.id })),
  ];
  const saveFailed = (error) => {
    if (signedOutError(error)) toast("You were signed out. Copy your edits, then reload to sign in.", "negative");
    throw error;
  };
  const ctx = { data, files, toast, confirm, setCrumbs, slots, dirty, signedOut, discard, saveFailed };
  const go = (hash) => {
    dirty.current = () => false;
    location.hash = hash;
  };
  let screen;
  if (route.screen === "home") screen = <HomeScreen key={`home${route.n}`} ctx={ctx} />;
  else if (route.screen === "collection") screen = <CollectionScreen key={`${route.type.id}${route.n}`} ctx={ctx} type={route.type} go={go} />;
  else if (route.screen === "item") screen = <ItemScreen key={`${route.type.id}/${route.id}${route.n}`} ctx={ctx} type={route.type} id={route.id} go={go} />;
  else if (route.screen === "singleton") screen = <SingletonScreen key={`${route.def.id}${route.n}`} ctx={ctx} def={route.def} />;
  else screen = <NotFound ctx={ctx} />;

  return (
    <Layout
      nav={
        <Nav
          brand={PANEL.name}
          entries={entries}
          account={
            PANEL.auth.recipe !== "none" && (
              <Account
                user={user.user}
                onLogout={async () => {
                  if (dirty.current() && !(await discard())) return;
                  try {
                    await auth.logout();
                  } catch {
                    toast("Could not log out. Try again.", "negative");
                    return;
                  }
                  dirty.current = () => false;
                  setUser(null);
                }}
              />
            )
          }
        />
      }
      header={<Header crumbs={crumbs} />}
      screen={screen}
      savebar={<div ref={(el) => el && el !== slots.savebar && setSlots((s) => ({ ...s, savebar: el }))} style={{ display: "contents" }} />}
      dialogs={
        <>
          <Dialog dialogRef={confirm.ref} {...confirm.props} />
          <div ref={(el) => el && el !== slots.dialogs && setSlots((s) => ({ ...s, dialogs: el }))} style={{ display: "contents" }} />
        </>
      }
      toasts={toasts.map((t) => (
        <Toast key={t.id} text={t.text} tone={t.tone} onDismiss={() => setToasts((all) => all.filter((x) => x.id !== t.id))} />
      ))}
    />
  );
}

function HomeScreen({ ctx }) {
  const load = useLoad(() => Promise.all(PANEL.types.map((t) => ctx.data.list(t.id))), "home");
  useEffect(() => ctx.setCrumbs([{ text: "Home", href: "#/" }]), []);
  useEffect(() => void (load.state === "error" && ctx.signedOut(load.error)), [load.state]);
  const lists = load.data ?? [];
  const entries = load.data
    ? [
        ...PANEL.types.map((t, i) => ({ title: t.label, subtitle: `${lists[i].length} ${lists[i].length === 1 ? t.singular : t.label.toLowerCase()}`, meta: "", href: `#/${t.id}` })),
        ...PANEL.singletons.map((s) => ({ title: s.label, subtitle: "Page", meta: "", href: `#/${s.id}` })),
      ]
    : [];
  const recent = PANEL.types
    .flatMap((t, i) => (lists[i] ?? []).map((it) => ({ t, it })))
    .sort((a, b) => b.it.updatedAt.localeCompare(a.it.updatedAt))
    .slice(0, 5)
    .map(({ t, it }) => ({ title: it.values[t.list.title] || "Untitled", subtitle: t.label, meta: formatDate(it.updatedAt), href: `#/${t.id}/${it.id}` }));
  return (
    <Home
      state={load.state}
      title={PANEL.name}
      contentHeading="Content"
      recentHeading="Recently edited"
      entries={entries}
      recent={recent}
      error={load.state === "error" && <LoadError title="Could not load the panel" text="Check your connection and try again." retry={load.retry} />}
    />
  );
}

function CollectionScreen({ ctx, type, go }) {
  const load = useLoad(() => ctx.data.list(type.id), type.id);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState(type.list.sort);
  const searchRef = useRef(null);
  const createRef = useRef(null);
  useShortcuts({ search: () => searchRef.current });
  useEffect(() => ctx.setCrumbs([{ text: "Home", href: "#/" }, { text: type.label, href: `#/${type.id}` }]), []);
  useEffect(() => void (load.state === "error" && ctx.signedOut(load.error)), [load.state]);

  const sortField = type.list.sort.replace(/^-/, "");
  const sorts = [
    { value: `-${sortField}`, text: sortField === "date" ? "Newest first" : `${capital(sortField)}, descending` },
    { value: sortField, text: sortField === "date" ? "Oldest first" : `${capital(sortField)}, ascending` },
    { value: type.list.title, text: "Title A–Z" },
  ];
  const items = load.data ?? [];
  const q = search.trim().toLowerCase();
  const key = sort.replace(/^-/, "");
  const dir = sort.startsWith("-") ? -1 : 1;
  const rows = items
    .filter((it) => !q || type.list.search.some((f) => String(it.values[f] ?? "").toLowerCase().includes(q)))
    .sort((a, b) => {
      const x = String(a.values[key] ?? "");
      const y = String(b.values[key] ?? "");
      return !x || !y ? Number(!x) - Number(!y) : dir * x.localeCompare(y);
    })
    .map((it) => ({ title: it.values[type.list.title] || "Untitled", subtitle: formatDate(it.values[type.list.subtitle]), status: capital(it.status), tone: tone(type, it.status), href: `#/${type.id}/${it.id}` }));
  const state = load.state === "ready" && !items.length ? "empty" : load.state;
  const open = (event) => createRef.current.open(event.currentTarget);
  return (
    <>
      <Collection
        state={state}
        typeId={type.id}
        title={type.label}
        createLabel={`New ${type.singular}`}
        onCreate={open}
        search={search}
        onSearch={setSearch}
        searchLabel={`Search ${type.label.toLowerCase()}`}
        searchPlaceholder={`Search ${type.label.toLowerCase()}`}
        searchRef={searchRef}
        sort={sort}
        onSort={setSort}
        sortLabel="Sort by"
        sorts={sorts}
        rows={rows}
        empty={
          state === "empty" && (
            <Empty
              icon="#pn-icon-file"
              title={`No ${type.label.toLowerCase()} yet`}
              text={`Create the first ${type.singular}.`}
              actions={<Button variant="primary" action="create" onClick={open}>{`New ${type.singular}`}</Button>}
            />
          )
        }
        error={state === "error" && <LoadError title={`Could not load ${type.label.toLowerCase()}`} text="Check your connection and try again." retry={load.retry} />}
      />
      {ctx.slots.dialogs && createPortal(<CreateFlow ref={createRef} ctx={ctx} type={type} go={go} />, ctx.slots.dialogs)}
    </>
  );
}

function CreateFlow({ ref, ctx, type, go }) {
  const titleField = type.fields.find((f) => f.name === type.list.title);
  const slugField = type.fields.find((f) => f.type === "slug" && f.from === titleField.name);
  const asked = useMemo(() => [titleField, slugField].filter(Boolean).map((f) => ({ ...f, width: "1/1" })), [type]);
  const prefix = `${type.id}-new`;
  const dialog = useRef(null);
  const [values, setValues] = useState({});
  const [slugTouched, setSlugTouched] = useState(false);
  const busy = useRef(false);
  const validation = useValidation(asked, values, prefix);

  if (ref) ref.current = {
    open(opener) {
      setValues({});
      setSlugTouched(false);
      validation.clear();
      requestAnimationFrame(() => openDialog(dialog.current, { opener }));
    },
  };

  function change(name, value) {
    setValues((v) => {
      const next = { ...v, [name]: value };
      if (name === titleField.name && slugField && !slugTouched) next[slugField.name] = slugify(value);
      return next;
    });
    if (name === slugField?.name) setSlugTouched(true);
  }
  async function submit() {
    if (busy.current) return;
    const invalid = validation.run("create");
    if (invalid.length) return validation.focus(invalid[0]);
    busy.current = true;
    try {
      const item = await ctx.data.create(type.id, { status: type.status?.[0], values: { ...defaults(type.fields), ...values } });
      dialog.current.close("create");
      go(`#/${type.id}/${item.id}`);
    } catch {
      ctx.toast("Could not create. Try again.", "negative");
    } finally {
      busy.current = false;
    }
  }
  return (
    <CreateDialog
      dialogRef={dialog}
      title={`New ${type.singular}`}
      onCreate={(e) => (e.preventDefault(), submit())}
      onKeyDown={(e) => e.key === "Enter" && e.target instanceof HTMLInputElement && (e.preventDefault(), submit())}
      fields={asked.map((f) => (
        <Field key={f.name} field={f} prefix={prefix} value={values[f.name]} onChange={(v) => change(f.name, v)} error={validation.errors[f.name]} onLeave={validation.blur} />
      ))}
    />
  );
}

function ItemScreen({ ctx, type, id, go }) {
  const load = useLoad(() => ctx.data.get(type.id, id), `${type.id}/${id}`);
  const base = [{ text: "Home", href: "#/" }, { text: type.label, href: `#/${type.id}` }];
  useEffect(() => {
    if (load.state === "loading") ctx.setCrumbs([...base, { text: "Loading…", href: location.hash }]);
    if (load.state === "error" && !ctx.signedOut(load.error)) ctx.setCrumbs([...base, { text: load.error?.code === "not-found" ? "Not found" : "Could not load", href: location.hash }]);
  }, [load.state]);
  if (load.state !== "ready") {
    const missing = load.error?.code === "not-found";
    return (
      <Item
        state={load.state}
        typeId={type.id}
        title={load.state === "loading" ? "Loading…" : missing ? "Not found" : "Could not load"}
        status=""
        tone="neutral"
        hasStatus={Boolean(type.status)}
        fields={null}
        created=""
        updated=""
        error={
          load.state === "error" &&
          (missing ? <LoadError title={`This ${type.singular} doesn't exist`} text="It may have been deleted." /> : <LoadError title={`Could not load this ${type.singular}`} text="Check your connection and try again." retry={load.retry} />)
        }
      />
    );
  }
  return <ItemEditor ctx={ctx} type={type} initial={load.data} base={base} go={go} />;
}

function ItemEditor({ ctx, type, initial, base, go }) {
  const [record, setRecord] = useState(initial);
  const live = useRef(record);
  live.current = record;
  const statusRef = useRef(null);
  const deleteRef = useRef(null);
  const first = type.status?.[0];
  const isLater = (s) => Boolean(type.status) && type.status.indexOf(s) > 0;
  const fieldsFor = (v) => withComputed(type.fields, v);

  let validation;
  const saveState = useSaveState({
    initial: fieldsFor(initial.values),
    validate(values, { background, extra }) {
      if (background) return validation.valid();
      const publishing = isLater(extra?.status ?? live.current.status);
      const invalid = validation.run(publishing ? "publish" : "format", publishing ? type.publishRequires : []);
      if (!invalid.length) return true;
      saveState.say(fixMessage(invalid.length, publishing ? "publish" : "save"));
      validation.focus(invalid[0]);
      return false;
    },
    async save(values, extra) {
      const next = await ctx.data.update(type.id, live.current.id, { status: extra?.status ?? live.current.status, values: fieldsFor(values) }).catch(ctx.saveFailed);
      setRecord(next);
    },
    autosave: type.autosave && { every: type.autosave.every, when: () => !type.autosave.drafts || live.current.status === first },
    onRevert: () => validation.clear(),
    errorMessage: saveError,
  });
  validation = useValidation(type.fields, saveState.values, type.id);
  ctx.dirty.current = () => saveState.dirty;
  useShortcuts({ save: () => saveState.save() });

  const title = record.values[type.list.title] || "Untitled";
  useEffect(() => ctx.setCrumbs([...base, { text: title, href: `#/${type.id}/${record.id}` }]), [title]);

  async function changeStatus() {
    const statuses = type.status;
    const next = statuses[1 - statuses.indexOf(record.status)];
    if (!next || next === record.status) return;
    const forward = statuses.indexOf(next) > statuses.indexOf(record.status);
    if (forward && isLater(next)) {
      const invalid = validation.run("publish", type.publishRequires);
      if (invalid.length) {
        saveState.say(fixMessage(invalid.length, "publish"));
        validation.focus(invalid[0]);
        return;
      }
      if (type.confirmPublish && record.status === first) {
        const ok = await ctx.confirm.ask({ title: `Publish this ${type.singular}?`, text: "It will be visible on the site.", confirmLabel: capital(next), opener: statusRef.current });
        if (!ok) return;
      }
    }
    if (await saveState.save({ status: next })) ctx.toast(next === first ? `${capital(type.singular)} moved to ${next}` : `${capital(type.singular)} ${next}`, "positive");
  }

  async function remove() {
    const ok = await ctx.confirm.ask({ title: `Delete this ${type.singular}?`, text: "This can't be undone.", confirmLabel: "Delete", variant: "negative", opener: deleteRef.current });
    if (!ok) return;
    try {
      await ctx.data.remove(type.id, record.id);
      go(`#/${type.id}`);
      ctx.toast(`${capital(type.singular)} deleted`);
    } catch {
      ctx.toast("Could not delete. Try again.", "negative");
    }
  }

  const help = (f) => {
    if (f.name !== type.wordCount) return undefined;
    const n = words(saveState.values[f.name]);
    return `${n} ${n === 1 ? "word" : "words"}`;
  };

  return (
    <>
      <Item
        state="ready"
        typeId={type.id}
        title={record.values[type.list.title] || "Untitled"}
        status={capital(record.status)}
        tone={tone(type, record.status)}
        hasStatus={Boolean(type.status)}
        onStatus={changeStatus}
        statusRef={statusRef}
        onDelete={remove}
        deleteRef={deleteRef}
        created={formatDate(record.createdAt)}
        updated={formatDate(record.updatedAt)}
        fields={type.fields.map((f) => (
          <Field
            key={f.name}
            field={f}
            prefix={type.id}
            value={saveState.values[f.name]}
            values={saveState.values}
            onChange={(v) => saveState.setValue(f.name, v)}
            error={validation.errors[f.name]}
            disabled={saveState.locked}
            help={help(f)}
            files={ctx.files}
            computed={COMPUTED}
            onLeave={validation.blur}
          />
        ))}
      />
      {ctx.slots.savebar && createPortal(<Savebar state={saveState.state} message={saveState.message} busy={saveState.busy} onSave={() => saveState.save()} onRevert={saveState.revert} />, ctx.slots.savebar)}
    </>
  );
}

function SingletonScreen({ ctx, def }) {
  const load = useLoad(() => ctx.data.getSingleton(def.id), def.id);
  useEffect(() => ctx.setCrumbs([{ text: "Home", href: "#/" }, { text: def.label, href: `#/${def.id}` }]), []);
  useEffect(() => void (load.state === "error" && ctx.signedOut(load.error)), [load.state]);
  if (load.state !== "ready")
    return <Singleton state={load.state} singletonId={def.id} title={def.label} fields={null} error={load.state === "error" && <LoadError title={`Could not load ${def.label.toLowerCase()}`} text="Check your connection and try again." retry={load.retry} />} />;
  return <SingletonEditor ctx={ctx} def={def} initial={load.data?.values ?? defaults(def.fields)} />;
}

function SingletonEditor({ ctx, def, initial }) {
  let validation;
  const saveState = useSaveState({
    initial: withComputed(def.fields, initial),
    validate() {
      const invalid = validation.run("required");
      if (!invalid.length) return true;
      saveState.say(fixMessage(invalid.length, "save"));
      validation.focus(invalid[0]);
      return false;
    },
    save: (values) => ctx.data.saveSingleton(def.id, withComputed(def.fields, values)).catch(ctx.saveFailed),
    onRevert: () => validation.clear(),
    errorMessage: saveError,
  });
  validation = useValidation(def.fields, saveState.values, def.id);
  ctx.dirty.current = () => saveState.dirty;
  useShortcuts({ save: () => saveState.save() });
  return (
    <>
      <Singleton
        state="ready"
        singletonId={def.id}
        title={def.label}
        fields={def.fields.map((f) => (
          <Field key={f.name} field={f} prefix={def.id} value={saveState.values[f.name]} values={saveState.values} onChange={(v) => saveState.setValue(f.name, v)} error={validation.errors[f.name]} disabled={saveState.locked} files={ctx.files} computed={COMPUTED} onLeave={validation.blur} />
        ))}
      />
      {ctx.slots.savebar && createPortal(<Savebar state={saveState.state} message={saveState.message} busy={saveState.busy} onSave={() => saveState.save()} onRevert={saveState.revert} />, ctx.slots.savebar)}
    </>
  );
}

function NotFound({ ctx }) {
  useEffect(() => ctx.setCrumbs([{ text: "Home", href: "#/" }, { text: "Not found", href: location.hash }]), []);
  return <Home state="error" title="Not found" contentHeading="" recentHeading="" entries={[]} recent={[]} error={<LoadError title="This page doesn't exist" text="Check the address, or go back home." retry={() => (location.hash = "#/")} />} />;
}
