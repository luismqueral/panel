// The behavior spec as React hooks, one per section. Copy next to the vanilla snippets they import:
// the rules (check, slugify) and the native dialog and shortcut code are shared, not rewritten.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { check } from "./snippets/validation.js";
import { openDialog } from "./snippets/dialogs.js";
import { installShortcuts } from "./snippets/keyboard.js";

const MESSAGES = {
  clean: "All changes saved",
  dirty: "Unsaved changes",
  saving: "Saving…",
  error: "Could not save. Your changes are kept.",
};

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// 1. Save state (S1–S9, A1–A4).
// save(values, extra) writes through the adapter and throws on failure.
// validate(values, { background, extra }) returns false to block (V3, V4).
// errorMessage(error) optionally returns the save bar message for a failed save.
export function useSaveState({ initial, save, validate, autosave, onRevert, errorMessage }) {
  const [values, setValues] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [phase, setPhase] = useState("idle"); // idle | saving | error
  const [background, setBackground] = useState(false);
  const [note, setNote] = useState(null);
  const live = useRef({});
  const state = phase === "saving" ? "saving" : phase === "error" ? "error" : same(values, saved) ? "clean" : "dirty";
  live.current = { values, state, background, save, validate, autosave, errorMessage };

  const setValue = useCallback((name, value) => {
    setValues((prev) => ({ ...prev, [name]: value }));
    setNote(null);
    setPhase((p) => (p === "error" ? "idle" : p));
  }, []);

  const run = useCallback(async ({ isBackground = false, extra } = {}) => {
    const { values: sent, state: now, background: running, save: write, validate: ok } = live.current;
    if (now === "saving" || running) return false;
    if (!isBackground && now === "clean" && !extra) return true;
    if (ok && !ok(sent, { background: isBackground, extra })) return false;
    setNote(null);
    if (isBackground) setBackground(true);
    else setPhase("saving");
    try {
      await write(sent, extra);
      setSaved(sent);
      setPhase("idle");
      return true;
    } catch (error) {
      setPhase("error");
      setNote(live.current.errorMessage?.(error) || null);
      return false;
    } finally {
      setBackground(false);
    }
  }, []);

  const revert = useCallback(() => {
    if (live.current.state === "saving") return;
    setValues(saved);
    setPhase("idle");
    setNote(null);
    onRevert?.();
  }, [saved, onRevert]);

  useEffect(() => {
    const onBeforeUnload = (event) => {
      if (["dirty", "error"].includes(live.current.state)) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  useEffect(() => {
    if (!autosave) return undefined;
    const timer = setInterval(() => {
      const { state: now, autosave: a } = live.current;
      if (now === "dirty" && a.when()) run({ isBackground: true });
    }, autosave.every);
    return () => clearInterval(timer);
  }, [autosave?.every, run]);

  return {
    values,
    setValue,
    state,
    dirty: state === "dirty" || state === "error",
    locked: state === "saving",
    busy: state === "saving" || background,
    message: note ?? (background ? MESSAGES.saving : MESSAGES[state]),
    save: (extra) => run({ extra }),
    revert,
    say: setNote,
  };
}

// 2. Validation (V1–V8). Errors show on blur (format only), live once shown, and all at once on run().
export function useValidation(fields, values, prefix) {
  const [errors, setErrors] = useState({});
  const mode = useRef(null);
  const extra = useRef([]);
  const rule = (f) => (extra.current.includes(f.name) ? { ...f, required: true } : f);
  const byName = useMemo(() => new Map(fields.map((f) => [f.name, f])), [fields]);

  useEffect(() => {
    setErrors((prev) => {
      const next = { ...prev };
      for (const f of fields) if (prev[f.name] || mode.current) next[f.name] = check(rule(f), values[f.name], mode.current ?? "format");
      return same(next, prev) ? prev : next;
    });
  }, [values, fields]);

  return {
    errors,
    blur(name) {
      const f = byName.get(name);
      if (f) setErrors((prev) => ({ ...prev, [name]: check(rule(f), values[name], mode.current ?? "format") }));
    },
    run(runMode, extraRequired = []) {
      mode.current = runMode;
      extra.current = extraRequired;
      const next = {};
      for (const f of fields) next[f.name] = check(rule(f), values[f.name], runMode);
      setErrors(next);
      return fields.filter((f) => next[f.name]).map((f) => f.name);
    },
    valid: () => fields.every((f) => !check(f, values[f.name], "format")),
    focus: (name) => document.getElementById(`${prefix}-${name}-input`)?.focus(),
    clear() {
      mode.current = null;
      extra.current = [];
      setErrors({});
    },
  };
}

// 3. Dialogs (D1–D6): the native <dialog> and snippets/dialogs.js. Never render the open attribute.
// const confirm = useConfirm(); ... <Dialog dialogRef={confirm.ref} {...confirm.props} />
// if (await confirm.ask({ title, text, confirmLabel, variant, opener })) { ... }
export function useConfirm() {
  const ref = useRef(null);
  const [props, setProps] = useState({ title: "", text: "", confirmLabel: "", variant: "primary" });
  const ask = useCallback(
    ({ opener, ...next }) =>
      new Promise((resolve) => {
        setProps({ variant: "primary", ...next });
        requestAnimationFrame(async () => resolve((await openDialog(ref.current, { opener })) === "confirm"));
      }),
    [],
  );
  return { ref, props, ask };
}

// 4. Keyboard (K1, K3). save and search are read when the key is pressed.
export function useShortcuts({ save, search }) {
  const live = useRef({ save, search });
  live.current = { save, search };
  useEffect(() => installShortcuts({ save: () => live.current.save?.(), search: () => live.current.search?.() }), []);
}
