// Turns a Cursor session transcript (.jsonl) into a readable TRACE.md: the prompt, what the session
// read, ran, and wrote, step by step, and every touch of a path the run's rules forbid.
//
//   node evals/harness/trace.mjs <transcript.jsonl> --run <run folder> [--allow <path>]... [--out <file>] [--watch]
//
// Transcripts hold the session's messages and tool calls with their inputs, not tool results,
// thinking, tokens, or per-step times.

import { readFileSync, writeFileSync, watchFile } from "node:fs";
import { basename, dirname, relative, resolve } from "node:path";
import { evalsDir, root } from "./paths.mjs";

const args = process.argv.slice(2);
const option = (name) => {
  const i = args.indexOf(name);
  return i === -1 ? undefined : args[i + 1];
};
const transcript = args[0];
const run = option("--run");
const out = option("--out");
if (!transcript || !run) {
  console.error("usage: node evals/harness/trace.mjs <transcript.jsonl> --run <run folder> [--out <file>] [--watch]");
  process.exit(1);
}

const runPath = resolve(root, run);
const inside = (path, dir) => path === dir || path.startsWith(`${dir}/`);
const allowed = new Set(args.flatMap((a, i) => (a === "--allow" ? [resolve(root, args[i + 1])] : [])));
allowed.add(resolve(root, "tools/validate.mjs"));

// What a run may read: the skill, its own folder, and the validator the skill names.
// Everything else in the evals folder (other runs, results, private prompts) holds answers.
function classify(path) {
  if (!path) return "other";
  const abs = resolve(root, path);
  if (inside(abs, runPath)) return "own";
  if (allowed.has(abs)) return "allowed";
  if (inside(abs, evalsDir)) return "forbidden";
  const rel = relative(root, abs);
  if (rel.startsWith("..")) return "outside";
  if (rel.startsWith("panel/")) return "skill";
  if (/^(evals|tools|docs)\//.test(rel) || rel === "DECISIONS.md") return "forbidden";
  return "other";
}

// Command text names paths loosely, so match the repo's forbidden folders and the evals folder by name.
const evalsName = basename(evalsDir).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const FORBIDDEN_IN_COMMAND = new RegExp(String.raw`(?:^|[\s"'=/])(${evalsName}(?:\/[\w./-]*)?|evals\/[\w./-]*|tools\/(?!validate\.mjs)[\w./-]+|docs\/[\w./-]*|DECISIONS\.md)`, "g");
const runToken = relative(dirname(evalsDir), runPath);

function forbiddenInCommand(command) {
  const hits = [];
  for (const match of command.matchAll(FORBIDDEN_IN_COMMAND)) {
    const token = match[1].replace(/\/$/, "");
    if (inside(token, runToken) || allowed.has(resolve(root, token))) continue;
    hits.push(token);
  }
  return hits;
}

const short = (text, n = 160) => {
  const one = String(text ?? "").replace(/\s+/g, " ").trim();
  return one.length > n ? `${one.slice(0, n - 1)}…` : one;
};
const code = (text) => `\`${String(text).replace(/`/g, "'")}\``;
const rel = (path) => (path ? relative(root, resolve(root, path)) || "." : "");

function describe(name, input = {}) {
  switch (name) {
    case "Read":
      return { kind: "read", path: input.path, text: `read ${code(rel(input.path))}` };
    case "Write":
      return { kind: "write", path: input.path, text: `wrote ${code(rel(input.path))}` };
    case "StrReplace":
      return { kind: "write", path: input.path, text: `edited ${code(rel(input.path))}` };
    case "Grep":
      return { kind: "search", path: input.path, text: `searched ${code(short(input.pattern, 60))} in ${code(rel(input.path) || ".")}` };
    case "Glob":
      return { kind: "search", path: input.target_directory, text: `listed ${code(input.glob_pattern)} in ${code(rel(input.target_directory) || ".")}` };
    case "Shell":
      return { kind: "shell", command: input.command ?? "", text: `ran ${code(short(input.command, 140))}${input.description ? ` (${input.description})` : ""}` };
    case "CallDynamicTool":
      return { kind: "tool", text: `called ${code(`${input.namespace}.${input.toolName}`)}` };
    default:
      return { kind: "tool", text: `used ${code(name)}` };
  }
}

function render() {
  const events = readFileSync(transcript, "utf8").split("\n").filter(Boolean).map((line) => JSON.parse(line));
  let prompt = "";
  let ended = null;
  const steps = [];
  const counts = {};
  const reads = [];
  const writes = new Set();
  const forbidden = [];

  for (const event of events) {
    if (event.type === "turn_ended") ended = event.status;
    const content = Array.isArray(event.message?.content) ? event.message.content : [];
    for (const part of content) {
      if (event.role === "user" && part.type === "text" && !prompt) prompt = part.text;
      if (event.role !== "assistant") continue;
      if (part.type === "text" && part.text.trim()) steps.push({ say: part.text.trim() });
      if (part.type !== "tool_use") continue;
      const step = describe(part.name, part.input);
      counts[part.name] = (counts[part.name] ?? 0) + 1;
      const where = step.path ? classify(step.path) : null;
      if (step.kind === "read") reads.push({ path: rel(step.path), where });
      if (step.kind === "write") writes.add(rel(step.path));
      const hits = step.kind === "shell" ? forbiddenInCommand(step.command) : where === "forbidden" ? [rel(step.path)] : [];
      if (hits.length) forbidden.push({ n: steps.length + 1, text: step.text, hits });
      steps.push({ do: step.text, flag: hits.length > 0 });
    }
  }

  const skillReads = [...new Set(reads.filter((r) => r.where === "skill").map((r) => r.path))];
  const lines = [];
  lines.push(`# Trace: ${relative(dirname(evalsDir), runPath)}`, "");
  lines.push(`Source: ${code(relative(root, resolve(transcript)))}. Status: ${ended ?? "still running"}. Built ${new Date().toISOString()}.`, "");
  lines.push("## Summary", "");
  lines.push(`| Measure | Value |`, `| --- | --- |`);
  lines.push(`| Tool calls | ${Object.values(counts).reduce((a, b) => a + b, 0)} (${Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(", ")}) |`);
  lines.push(`| Skill files read | ${skillReads.length} |`);
  lines.push(`| Files written | ${writes.size} |`);
  lines.push(`| Forbidden paths touched | ${forbidden.length ? `**${forbidden.length}**` : "none"} |`, "");
  if (forbidden.length) {
    lines.push("## Forbidden paths", "");
    for (const f of forbidden) lines.push(`- Step ${f.n}: ${f.text} (${f.hits.map(code).join(", ")})`);
    lines.push("");
  }
  lines.push("## Skill files read, in order", "");
  skillReads.forEach((p, i) => lines.push(`${i + 1}. ${code(p)}`));
  const otherReads = [...new Set(reads.filter((r) => r.where !== "skill" && r.where !== "own").map((r) => `${r.path} (${r.where})`))];
  if (otherReads.length) lines.push("", "Other reads:", "", ...otherReads.map((p) => `- ${code(p)}`));
  lines.push("", "## Files written", "", ...[...writes].map((p) => `- ${code(p)}`), "");
  lines.push("## The prompt", "", "```text", prompt.trim(), "```", "");
  lines.push("## Timeline", "");
  let n = 0;
  for (const step of steps) {
    if (step.say) lines.push("", `> ${short(step.say, 600)}`, "");
    else lines.push(`${++n}. ${step.flag ? "**FORBIDDEN** " : ""}${step.do}`);
  }
  lines.push("");
  const text = lines.join("\n");
  if (out) writeFileSync(out, text);
  else process.stdout.write(text);
}

render();
if (args.includes("--watch")) {
  watchFile(transcript, { interval: 3000 }, () => {
    try {
      render();
    } catch {}
  });
}
