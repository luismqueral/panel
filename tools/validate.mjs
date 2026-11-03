// Panel schema validator (dev-time). Usage: node tools/validate.mjs <panel.yaml|panel.json> [...]
// Checks, in order: parse, style (YAML only), shape (panel.schema.json), meaning (references, recipes, defaults).
// Rules are documented in panel/schema-guide.md.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parseDocument, LineCounter, visit, isMap, isScalar, isCollection } from "yaml";
import Ajv2020 from "ajv/dist/2020.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const panelSchema = JSON.parse(readFileSync(join(root, "panel/panel.schema.json"), "utf8"));
const recipeIndex = JSON.parse(readFileSync(join(root, "panel/recipes/index.json"), "utf8"));

const ajv = new Ajv2020({ allErrors: true, strict: false });
const validateShape = ajv.compile(panelSchema);
const recipeValidators = Object.fromEntries(Object.entries(recipeIndex.recipes).map(([name, r]) => [name, ajv.compile(r.settings)]));

const FIELD_TYPES = panelSchema.$defs.field.properties.type.enum;
const TYPE_SPECIFIC = { from: "slug", options: "select", to: "relation", min: "number", max: "number", time: "date", describe: "custom" };
const MISREAD = /^(y|Y|yes|Yes|YES|n|N|no|No|NO|on|On|ON|off|Off|OFF)$/;
const GUIDANCE = new Set(["notes", "behavior"]);

function distance(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

function suggest(word, candidates) {
  const best = candidates.map((c) => [c, distance(word, c)]).sort((x, y) => x[1] - y[1])[0];
  return best && best[1] <= Math.max(2, Math.floor(word.length / 3)) ? ` Did you mean "${best[0]}"?` : "";
}

export function validateSource(text, filename = "panel.yaml") {
  const isJson = filename.endsWith(".json");
  const lineCounter = new LineCounter();
  const doc = parseDocument(text, { lineCounter, uniqueKeys: true, prettyErrors: false });
  const errors = [];
  const warnings = [];

  const lineOf = (offset) => (offset == null ? 1 : lineCounter.linePos(offset).line);

  function nodeAt(path) {
    let node = doc.contents;
    for (const key of path) {
      if (!isCollection(node)) break;
      const next = node.get(key, true);
      if (next === undefined) break;
      node = next;
    }
    return node;
  }

  function keyLine(path, key) {
    const parent = nodeAt(path);
    if (isMap(parent)) {
      const pair = parent.items.find((p) => isScalar(p.key) && p.key.value === key);
      if (pair) return lineOf(pair.key.range?.[0]);
    }
    return lineOf(parent?.range?.[0]);
  }

  const data = doc.errors.length ? null : doc.toJS();

  function where(path) {
    const parts = [];
    for (let i = 0; i < path.length; i++) {
      const key = path[i];
      const parent = path.slice(0, i);
      if (typeof key === "number") {
        const item = parent.reduce((o, k) => o?.[k], data)?.[key];
        const label = item?.id ?? item?.name;
        const kind = { types: "type", singletons: "singleton", fields: "field", conformance: "check", search: "search entry", options: "option", status: "status", allow: "allow entry" }[parent.at(-1)] ?? "item";
        parts.push(label ? `${kind} "${label}"` : `${kind} ${key + 1}`);
      } else if (!(typeof path[i + 1] === "number")) parts.push(key);
    }
    return parts.join(" › ") || "top level";
  }

  const add = (list, line, path, message) => list.push({ file: filename, line, where: path === "style" ? "style" : where(path), message });
  const error = (line, path, message) => add(errors, line, path, message);
  const warn = (line, path, message) => add(warnings, line, path, message);

  // 1. Parse
  for (const e of doc.errors) {
    const message = e.code === "DUPLICATE_KEY" ? "the same key appears twice in one block" : e.message.split("\n")[0];
    errors.push({ file: filename, line: lineOf(e.pos?.[0]), where: "file", message });
  }
  if (!data) return { errors, warnings };
  if (typeof data !== "object" || Array.isArray(data)) {
    error(1, [], "a schema is a set of keys, starting with panel: 1");
    return { errors, warnings };
  }

  // 2. Style (YAML only)
  if (!isJson) {
    const first = text.split("\n")[0].replace(/\s+#.*$/, "").trim();
    if (first !== "panel: 1") error(1, "style", `line one must be exactly "panel: 1" (found ${first ? `"${first}"` : "an empty line"})`);
    visit(doc, {
      Map(_, node) {
        if (node.flow) error(lineOf(node.range?.[0]), "style", "inline braces { } are not allowed. Write one property per line");
      },
      Seq(_, node) {
        if (node.flow) error(lineOf(node.range?.[0]), "style", "inline brackets [ ] are not allowed. Write one item per line, each starting with -");
      },
      Scalar(_, node) {
        if (node.type === "PLAIN" && typeof node.value === "string" && MISREAD.test(node.value))
          error(lineOf(node.range?.[0]), "style", `quote "${node.value}". Some YAML readers take it as true or false`);
      },
    });
    const lines = text.split("\n");
    const fieldStarts = [];
    lines.forEach((l, i) => /^\s*- name:/.test(l) && fieldStarts.push(i));
    for (let k = 1; k < fieldStarts.length; k++) {
      const i = fieldStarts[k];
      const indent = lines[i].search(/\S/);
      const prev = lines.slice(fieldStarts[k - 1], i);
      const sameList = lines[fieldStarts[k - 1]].search(/\S/) === indent && !prev.slice(1).some((l) => l.trim() && l.search(/\S/) < indent);
      if (sameList && lines[i - 1].trim() !== "") warn(i + 1, "style", "leave a blank line between fields");
    }
  }

  // 3. Shape
  if (!validateShape(data)) {
    const seen = new Set();
    const report = (line, path, message) => {
      const key = `${line}|${message}`;
      if (seen.has(key)) return;
      seen.add(key);
      error(line, path, message);
    };
    const anyOfRoot = validateShape.errors.some((e) => e.keyword === "anyOf" && e.instancePath === "");
    for (const e of validateShape.errors) {
      const path = e.instancePath.split("/").slice(1).map((p) => (/^\d+$/.test(p) ? Number(p) : p.replace(/~1/g, "/").replace(/~0/g, "~")));
      const parent = path.slice(0, -1);
      const last = path.at(-1);
      const value = path.reduce((o, k) => o?.[k], data);
      const line = lineOf(nodeAt(path)?.range?.[0]);
      switch (e.keyword) {
        case "if":
          break;
        case "anyOf":
          if (e.instancePath === "") report(1, [], "define at least one entry under types or singletons");
          break;
        case "required": {
          const missing = e.params.missingProperty;
          if (anyOfRoot && e.instancePath === "" && (missing === "types" || missing === "singletons")) break;
          const hints = {
            panel: "add panel: 1 as line one",
            list: "every type needs a list block with at least a title naming one of its fields",
            options: "a select field needs options: a list of choices",
            to: "a relation field needs to: the id of the type it links to",
            describe: "a custom field needs describe: one sentence saying what it holds and how it behaves",
            recipe: "name the recipe that fills this adapter, for example recipe: json-files",
          };
          report(line, path, `missing "${missing}"${hints[missing] ? `: ${hints[missing]}` : ""}`);
          break;
        }
        case "additionalProperties": {
          const key = e.params.additionalProperty;
          const at = keyLine(path, key);
          const isSingleton = path.at(-2) === "singletons";
          if (isSingleton && ["status", "list"].includes(key)) {
            report(at, path, `singletons have no ${key}. A singleton always exists and opens straight to its item view. Make it a type if it needs ${key}`);
            break;
          }
          if (GUIDANCE.has(key)) break;
          const allowed = Object.keys(
            path.length === 0 ? panelSchema.properties
            : path.at(-2) === "types" ? panelSchema.$defs.type.properties
            : path.at(-2) === "singletons" ? panelSchema.$defs.singleton.properties
            : path.at(-2) === "fields" ? panelSchema.$defs.field.properties
            : last === "list" ? panelSchema.$defs.list.properties
            : {},
          );
          report(at, path, `"${key}" is not a Panel key here.${suggest(key, allowed)} Put tool metadata in an x- key and intent in notes or behavior`);
          break;
        }
        case "false schema": {
          const fieldType = parent.reduce((o, k) => o?.[k], data)?.type;
          report(keyLine(parent, last), parent, `"${last}" is only allowed on ${TYPE_SPECIFIC[last]} fields, not ${fieldType}`);
          break;
        }
        case "enum":
          if (last === "type")
            report(line, path, `unknown field type "${value}". Use one of: ${FIELD_TYPES.join(", ")}.${suggest(String(value), FIELD_TYPES)} For anything else use type: custom with describe`);
          else if (last === "width") report(line, path, `width "${value}" is not allowed. Use 1/1, 1/2, 1/3, or 2/3`);
          else report(line, path, `"${value}" must be one of: ${e.params.allowedValues.join(", ")}`);
          break;
        case "const":
          report(line, path, last === "panel" ? `panel must be 1 (found ${JSON.stringify(value)}). This guide describes version 1` : `must be ${JSON.stringify(e.params.allowedValue)}`);
          break;
        case "pattern":
          if (last === "recipe") report(line, path, `recipe "${value}" must be lowercase letters, digits, and dashes`);
          else if (last === "sort") report(line, path, `sort "${value}" must be a field name, with - in front for descending`);
          else report(line, path, `"${value}" must be lowercase letters, digits, and underscores, starting with a letter`);
          break;
        case "type": {
          if ((last === "auth" || last === "data" || last === "files") && typeof value === "string")
            report(line, path, `write ${last} as a block with a recipe line, for example:\n      ${last}:\n        recipe: ${value}`);
          else report(line, path, `must be ${e.params.type === "array" ? "a list" : e.params.type === "object" ? "a block of keys" : `a ${e.params.type}`}`);
          break;
        }
        case "minItems":
          report(line, path, `needs at least ${e.params.limit} ${e.params.limit === 1 ? "entry" : "entries"}${last === "status" ? ". A workflow has a first and a last state; omit status if there is no workflow" : ""}`);
          break;
        case "uniqueItems":
          report(line, path, "lists the same value twice");
          break;
        case "minLength":
          report(line, path, "must not be empty");
          break;
        default:
          report(line, path, e.message);
      }
    }
  }

  // 4. Meaning
  const types = Array.isArray(data.types) ? data.types.filter((t) => t && typeof t === "object") : [];
  const singletons = Array.isArray(data.singletons) ? data.singletons.filter((s) => s && typeof s === "object") : [];

  for (const slot of ["auth", "data", "files"]) {
    const adapter = data[slot];
    if (!adapter || typeof adapter !== "object" || typeof adapter.recipe !== "string") continue;
    const recipe = recipeIndex.recipes[adapter.recipe];
    const at = lineOf(nodeAt([slot, "recipe"])?.range?.[0]);
    if (!recipe) {
      const names = Object.entries(recipeIndex.recipes).filter(([, r]) => r.kind === slot).map(([n]) => n);
      error(at, [slot], `no recipe named "${adapter.recipe}".${suggest(adapter.recipe, names)} ${slot} recipes: ${names.join(", ")}`);
      continue;
    }
    if (recipe.kind !== slot) {
      error(at, [slot], `"${adapter.recipe}" is a ${recipe.kind} recipe and cannot fill ${slot}`);
      continue;
    }
    if (recipe.status !== "verified") warn(at, [slot], `the ${adapter.recipe} recipe is ${recipe.status}: its verification has not been run. Tell the person, and run its checklist before calling the panel done`);
    const settings = Object.fromEntries(Object.entries(adapter).filter(([k]) => k !== "recipe" && !GUIDANCE.has(k) && !k.startsWith("x-")));
    const check = recipeValidators[adapter.recipe];
    if (!check(settings)) {
      const allowed = Object.keys(recipe.settings.properties ?? {});
      for (const e of check.errors) {
        if (e.keyword === "if") continue;
        const sub = e.instancePath.split("/").slice(1);
        const p = [slot, ...sub.map((x) => (/^\d+$/.test(x) ? Number(x) : x))];
        if (e.keyword === "additionalProperties") {
          const key = e.params.additionalProperty;
          error(keyLine([slot], key), [slot], `${adapter.recipe} has no setting "${key}".${suggest(key, allowed)}${allowed.length ? ` Settings: ${allowed.join(", ")}` : " It takes no settings"}`);
        } else if (e.keyword === "required") error(lineOf(nodeAt([slot])?.range?.[0]), [slot], `${adapter.recipe} needs "${e.params.missingProperty}"${recipe.settings.properties?.[e.params.missingProperty]?.description ? `: ${recipe.settings.properties[e.params.missingProperty].description}` : ""}`);
        else if (e.keyword === "false schema") error(keyLine([slot], sub[0]), [slot], `"${sub[0]}" only applies when via is github`);
        else if (e.keyword === "pattern" && sub[0] === "allow") error(lineOf(nodeAt(p)?.range?.[0]), p, `"${p.reduce((o, k) => o?.[k], data)}" is not an email address or *@domain`);
        else if (e.keyword === "pattern" && /_env$/.test(sub[0])) error(lineOf(nodeAt(p)?.range?.[0]), p, `${sub[0]} names an environment variable, such as DATABASE_URL. Never put the secret itself in the schema`);
        else if (e.keyword === "enum") error(lineOf(nodeAt(p)?.range?.[0]), p, `must be one of: ${e.params.allowedValues.join(", ")}`);
        else error(lineOf(nodeAt(p)?.range?.[0]), p, e.message);
      }
    }
  }
  if (data.auth?.recipe === "none") warn(lineOf(nodeAt(["auth"])?.range?.[0]), ["auth"], "no login: this panel must only ever run locally");
  else if (data.auth === undefined) warn(1, ["auth"], "no auth, so it is none: anyone who opens the panel can edit, and it must only ever run locally. For a shared password, use the password recipe");

  const ids = new Map();
  for (const [group, list] of [["types", types], ["singletons", singletons]]) {
    list.forEach((t, i) => {
      if (typeof t.id !== "string") return;
      const at = lineOf(nodeAt([group, i, "id"])?.range?.[0]);
      if (ids.has(t.id)) error(at, [group, i], `id "${t.id}" is already used on line ${ids.get(t.id)}. Ids are unique across types and singletons`);
      else ids.set(t.id, at);
    });
  }
  const typeIds = new Set(types.map((t) => t.id));
  const singletonIds = new Set(singletons.map((s) => s.id));
  let hasUploads = false;

  for (const [group, list] of [["types", types], ["singletons", singletons]]) {
    list.forEach((t, ti) => {
      const fields = Array.isArray(t.fields) ? t.fields.filter((f) => f && typeof f === "object") : [];
      const byName = new Map();
      fields.forEach((f, fi) => {
        const base = [group, ti, "fields", fi];
        if (typeof f.name === "string") {
          if (byName.has(f.name)) error(lineOf(nodeAt([...base, "name"])?.range?.[0]), base, `field name "${f.name}" is used twice in ${t.id}`);
          else byName.set(f.name, f);
        }
        if (f.type === "image" || f.type === "file") hasUploads = true;
        const at = (key) => lineOf(nodeAt([...base, key])?.range?.[0]);

        if (f.type === "relation" && typeof f.to === "string" && !typeIds.has(f.to))
          error(at("to"), base, singletonIds.has(f.to) ? `relation points to singleton "${f.to}". A relation links to items of a type` : `relation points to "${f.to}", which is not a type id.${suggest(f.to, [...typeIds])} Types: ${[...typeIds].join(", ")}`);
        if (typeof f.min === "number" && typeof f.max === "number" && f.min > f.max) error(at("min"), base, `min (${f.min}) is greater than max (${f.max})`);

        if ("default" in f) {
          const d = f.default;
          const bad = (why) => error(at("default"), base, `default ${JSON.stringify(d)} ${why}`);
          switch (f.type) {
            case "text": case "textarea": case "markdown": case "slug":
              if (typeof d !== "string") bad(`must be text for a ${f.type} field`);
              else if (f.type === "slug" && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(d)) bad("must be a URL-safe slug, such as my-first-post");
              break;
            case "number":
              if (typeof d !== "number") bad("must be a number");
              else if ((typeof f.min === "number" && d < f.min) || (typeof f.max === "number" && d > f.max)) bad("is outside min and max");
              break;
            case "toggle":
              if (typeof d !== "boolean") bad("must be true or false");
              break;
            case "date": {
              const ok = f.time ? /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?)?$/ : /^\d{4}-\d{2}-\d{2}$/;
              const asText = d instanceof Date ? d.toISOString().slice(0, 10) : d;
              if (typeof asText !== "string" || !ok.test(asText)) bad(`must be a date written as YYYY-MM-DD${f.time ? ", optionally with THH:MM" : ""}`);
              break;
            }
            case "select":
              if (!Array.isArray(f.options) || !f.options.includes(d)) bad(`must be one of the options`);
              break;
            case "tags":
              if (!Array.isArray(d) || d.some((x) => typeof x !== "string")) bad("must be a list of tags");
              break;
            case "image": case "file": case "relation":
              bad(`is not allowed: a ${f.type} field has no default`);
              break;
          }
        }
      });

      fields.forEach((f, fi) => {
        if (f.type === "slug" && typeof f.from === "string") {
          const source = byName.get(f.from);
          const at = lineOf(nodeAt([group, ti, "fields", fi, "from"])?.range?.[0]);
          if (!source) error(at, [group, ti, "fields", fi], `slug is made from "${f.from}", which is not a field in ${t.id}.${suggest(f.from, [...byName.keys()])} Fields: ${[...byName.keys()].join(", ")}`);
          else if (!["text", "textarea"].includes(source.type)) error(at, [group, ti, "fields", fi], `slug is made from "${f.from}", a ${source.type} field. Use a text field`);
        }
      });

      if (group === "types" && t.list && typeof t.list === "object") {
        const names = [...byName.keys()];
        const ref = (key, value, path) => {
          if (typeof value === "string" && !byName.has(value))
            error(lineOf(nodeAt(path)?.range?.[0]), [group, ti, "list"], `list.${key} names "${value}", which is not a field in ${t.id}.${suggest(value, names)} Fields: ${names.join(", ")}`);
        };
        ref("title", t.list.title, [group, ti, "list", "title"]);
        ref("subtitle", t.list.subtitle, [group, ti, "list", "subtitle"]);
        if (typeof t.list.sort === "string") ref("sort", t.list.sort.replace(/^-/, ""), [group, ti, "list", "sort"]);
        if (Array.isArray(t.list.search)) t.list.search.forEach((s, si) => ref("search", s, [group, ti, "list", "search", si]));
        const titleField = byName.get(t.list.title);
        if (titleField && ["image", "file", "toggle", "markdown", "custom"].includes(titleField.type))
          warn(lineOf(nodeAt([group, ti, "list", "title"])?.range?.[0]), [group, ti, "list"], `list.title is a ${titleField.type} field; a text field reads better as a row title`);
      }
    });
  }

  if (hasUploads && !data.files) error(1, [], "an image or file field needs a files adapter. Add files: with a recipe such as local-disk");
  if (!hasUploads && data.files) warn(lineOf(nodeAt(["files"])?.range?.[0]), ["files"], "files is set but no field is image or file");

  errors.sort((a, b) => a.line - b.line);
  warnings.sort((a, b) => a.line - b.line);
  return { errors, warnings };
}

export function formatIssue(issue, kind = "error") {
  return `${issue.file}:${issue.line}: ${kind}: ${issue.where}: ${issue.message}`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const paths = process.argv.slice(2);
  if (!paths.length) {
    console.error("Usage: node tools/validate.mjs <panel.yaml|panel.json> [...]");
    process.exit(2);
  }
  let failed = false;
  for (const path of paths) {
    const { errors, warnings } = validateSource(readFileSync(path, "utf8"), path);
    errors.forEach((e) => console.log(formatIssue(e)));
    warnings.forEach((w) => console.log(formatIssue(w, "warning")));
    console.log(`${path}: ${errors.length ? `invalid (${errors.length} error${errors.length === 1 ? "" : "s"})` : "valid"}${warnings.length ? `, ${warnings.length} warning${warnings.length === 1 ? "" : "s"}` : ""}`);
    if (errors.length) failed = true;
  }
  process.exit(failed ? 1 : 0);
}
