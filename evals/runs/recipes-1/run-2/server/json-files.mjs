// json-files: one JSON file per item, content/<type>/<id>.json; singletons at content/<id>.json.

import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { fail } from "./errors.mjs";

const ID = /^[a-z0-9][a-z0-9_-]{0,63}$/;

export function createJsonFiles({ dir, config }) {
  const types = new Map(config.types.map((t) => [t.id, t]));
  const singletons = new Map(config.singletons.map((s) => [s.id, s]));

  function typeOf(id) {
    const type = types.get(id);
    if (!type) throw fail("invalid", `unknown type "${id}"`);
    return type;
  }
  function checkId(id) {
    if (!ID.test(id)) throw fail("not-found", "no such item");
  }
  function checkValues(def, values) {
    if (!values || typeof values !== "object" || Array.isArray(values)) throw fail("invalid", "values must be an object");
    const names = new Set(def.fields.map((f) => f.name));
    for (const key of Object.keys(values)) if (!names.has(key)) throw fail("invalid", `unknown field "${key}"`);
  }
  function checkStatus(type, status) {
    if (type.status ? !type.status.includes(status) : status !== undefined) throw fail("invalid", `bad status "${status}"`);
  }

  async function write(file, data) {
    const temp = `${file}.${randomBytes(4).toString("hex")}.tmp`;
    await writeFile(temp, `${JSON.stringify(data, null, 2)}\n`);
    await rename(temp, file);
  }
  async function readJson(file) {
    try {
      return JSON.parse(await readFile(file, "utf8"));
    } catch (error) {
      if (error.code === "ENOENT") return null;
      throw error;
    }
  }
  const itemFile = (type, id) => join(dir, type, `${id}.json`);

  return {
    async list(type) {
      typeOf(type);
      let names = [];
      try {
        names = (await readdir(join(dir, type))).filter((n) => n.endsWith(".json"));
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
      return Promise.all(names.map((n) => readJson(join(dir, type, n))));
    },
    async get(type, id) {
      typeOf(type);
      checkId(id);
      const item = await readJson(itemFile(type, id));
      if (!item) throw fail("not-found", "no such item");
      return item;
    },
    async create(type, { status, values }) {
      const def = typeOf(type);
      checkStatus(def, status);
      checkValues(def, values);
      await mkdir(join(dir, type), { recursive: true });
      let id;
      do id = randomBytes(5).toString("hex");
      while (await readJson(itemFile(type, id)));
      const now = new Date().toISOString();
      const item = { id, type, ...(def.status ? { status } : {}), values, createdAt: now, updatedAt: now };
      await write(itemFile(type, id), item);
      return item;
    },
    async update(type, id, { status, values }) {
      const def = typeOf(type);
      const item = await this.get(type, id);
      checkStatus(def, status);
      checkValues(def, values);
      const next = { ...item, ...(def.status ? { status } : {}), values, updatedAt: new Date().toISOString() };
      await write(itemFile(type, id), next);
      return next;
    },
    async remove(type, id) {
      await this.get(type, id);
      await rm(itemFile(type, id));
      return null;
    },
    async getSingleton(id) {
      if (!singletons.has(id)) throw fail("invalid", `unknown singleton "${id}"`);
      return readJson(join(dir, `${id}.json`));
    },
    async saveSingleton(id, values) {
      const def = singletons.get(id);
      if (!def) throw fail("invalid", `unknown singleton "${id}"`);
      checkValues(def, values);
      await mkdir(dir, { recursive: true });
      const prev = await readJson(join(dir, `${id}.json`));
      const now = new Date().toISOString();
      const record = { values, createdAt: prev?.createdAt ?? now, updatedAt: now };
      await write(join(dir, `${id}.json`), record);
      return record;
    },
  };
}
