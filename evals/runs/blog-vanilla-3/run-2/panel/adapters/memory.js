// In-memory data, files, and auth adapters for behavior tests (behavior-spec.md section 7).

const clone = (value) => (value === undefined ? undefined : structuredClone(value));

export function createMemoryAdapters(seed, { user = "me@example.com" } = {}) {
  let db;
  let wait = 0;
  let counter = 0;
  const failing = new Map();
  const calls = [];
  const now = () => new Date().toISOString();
  const uid = () => `${Date.now().toString(36)}${(counter++).toString(36)}`;
  const load = (next) => (db = clone(next ?? { items: {}, singletons: {} }));
  load(seed);

  async function call(method, args, run) {
    calls.push({ method, args: clone(args) });
    if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
    if (failing.has(method)) {
      const code = failing.get(method);
      failing.delete(method);
      throw Object.assign(new Error(`${method} failed (test)`), { code });
    }
    return clone(run());
  }

  function find(type, id) {
    const item = (db.items[type] ?? []).find((it) => it.id === id);
    if (!item) throw Object.assign(new Error("not found"), { code: "not-found" });
    return item;
  }

  const data = {
    list: (type) => call("list", [type], () => db.items[type] ?? []),
    get: (type, id) => call("get", [type, id], () => find(type, id)),
    create: (type, { status, values }) =>
      call("create", [type, { status, values }], () => {
        const item = { id: uid(), type, status, values: clone(values), createdAt: now(), updatedAt: now() };
        (db.items[type] ??= []).push(item);
        return item;
      }),
    update: (type, id, { status, values }) =>
      call("update", [type, id, { status, values }], () => {
        const item = find(type, id);
        if (status !== undefined) item.status = status;
        item.values = clone(values);
        item.updatedAt = now();
        return item;
      }),
    remove: (type, id) =>
      call("remove", [type, id], () => {
        find(type, id);
        db.items[type] = db.items[type].filter((it) => it.id !== id);
        return null;
      }),
    getSingleton: (id) => call("getSingleton", [id], () => db.singletons[id] ?? null),
    saveSingleton: (id, values) =>
      call("saveSingleton", [id, values], () => {
        const prev = db.singletons[id];
        db.singletons[id] = { values: clone(values), createdAt: prev?.createdAt ?? now(), updatedAt: now() };
        return db.singletons[id];
      }),
  };

  const files = {
    upload: (file) =>
      call("upload", [{ name: file.name, size: file.size, type: file.type }], () => ({
        url: URL.createObjectURL(file),
        name: file.name,
        size: file.size,
        type: file.type,
      })),
  };

  let signedIn = true;
  const auth = {
    session: async () => (signedIn ? { user } : null),
    renderMethods: () => {},
    logout: async () => {
      signedIn = false;
    },
  };

  const test = {
    adapter: data,
    fail: (method, code = "unavailable") => failing.set(method, code),
    delay: (ms) => (wait = ms),
    calls,
    reset(next) {
      load(next);
      calls.length = 0;
      failing.clear();
      wait = 0;
      signedIn = true;
    },
  };

  return { data, files, auth, test };
}
