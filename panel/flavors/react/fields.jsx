// Field templates in JSX, with field-control behavior (behavior-spec.md section 8).
// Props: field, prefix (type or singleton id; "<type>-new" in the create dialog), value, onChange,
// error, disabled, plus files (uploads), options (relation choices), computed (custom fields).

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { Icon } from "./templates.jsx";

const EMPTY_IMAGE = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";

function ids(prefix, field) {
  const base = `${prefix}-${field.name}`;
  return { input: `${base}-input`, label: `${base}-label`, help: `${base}-help`, error: `${base}-error`, describedby: `${base}-help ${base}-error` };
}

// Reports when focus leaves a field, for V2. Provided by <Field onLeave>.
const Leave = createContext(null);

function Root({ field, template, attrs = {}, slotAttr = "data-field:name data-width:width", children }) {
  const onLeave = useContext(Leave);
  return (
    <div className="pn-field" data-field={field.name} data-width={field.width ?? "1/1"} {...attrs} data-slot-attr={slotAttr} data-template={template} onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && onLeave?.(field.name)}>
      {children}
    </div>
  );
}

function Label({ field, id }) {
  return (
    <label className="pn-label" htmlFor={id.input} data-required={String(Boolean(field.required))} data-slot-attr="for:input-id data-required:required" data-slot="label">
      {field.label}
    </label>
  );
}

function SpanLabel({ field, id }) {
  return (
    <span className="pn-label" id={id.label} data-required={String(Boolean(field.required))} data-slot-attr="id:label-id data-required:required" data-slot="label">
      {field.label}
    </span>
  );
}

function Notes({ id, help, error }) {
  return (
    <>
      <p className="pn-help" id={id.help} data-slot-attr="id:help-id" data-slot="help">{help}</p>
      <p className="pn-error" id={id.error} data-slot-attr="id:error-id" data-slot="error">{error}</p>
    </>
  );
}

const CONTROL = "id:input-id name:name aria-required:required aria-describedby:describedby";

function controlProps(field, id, { error, disabled }) {
  return {
    id: id.input,
    name: field.name,
    "aria-required": String(Boolean(field.required)),
    "aria-describedby": id.describedby,
    "aria-invalid": error ? "true" : undefined,
    disabled,
  };
}

function TextLike({ template, field, prefix, value, onChange, error, disabled, help, inputAttrs, slotAttr = CONTROL, rootAttrs, rootSlotAttr }) {
  const id = ids(prefix, field);
  return (
    <Root field={field} template={template} attrs={rootAttrs} slotAttr={rootSlotAttr}>
      <Label field={field} id={id} />
      <input className="pn-input" type="text" {...inputAttrs} {...controlProps(field, id, { error, disabled })} data-slot-attr={slotAttr} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
      <Notes id={id} help={help ?? field.help} error={error} />
    </Root>
  );
}

const Text = (p) => <TextLike template="field-text" {...p} />;

const Slug = (p) => (
  <TextLike
    template="field-slug"
    {...p}
    inputAttrs={{ "data-mono": "", spellCheck: false, autoCapitalize: "off" }}
    rootAttrs={{ "data-from": p.field.from }}
    rootSlotAttr="data-field:name data-width:width data-from:from"
  />
);

const DateField = (p) => (
  <TextLike
    template="field-date"
    {...p}
    inputAttrs={{ type: p.field.time ? "datetime-local" : "date", "data-mono": "" }}
    slotAttr={`type:date-type ${CONTROL}`}
  />
);

function NumberField({ field, prefix, value, onChange, error, disabled, help }) {
  const id = ids(prefix, field);
  return (
    <Root field={field} template="field-number">
      <Label field={field} id={id} />
      <input className="pn-input" type="number" min={field.min ?? ""} max={field.max ?? ""} data-mono="" {...controlProps(field, id, { error, disabled })} data-slot-attr={`${CONTROL} min:min max:max`} value={value ?? ""} onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))} />
      <Notes id={id} help={help ?? field.help} error={error} />
    </Root>
  );
}

function Textarea({ field, prefix, value, onChange, error, disabled, help }) {
  const id = ids(prefix, field);
  return (
    <Root field={field} template="field-textarea">
      <Label field={field} id={id} />
      <textarea className="pn-textarea" {...controlProps(field, id, { error, disabled })} data-slot-attr={CONTROL} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
      <Notes id={id} help={help ?? field.help} error={error} />
    </Root>
  );
}

const WRAP = { bold: ["**", "**"], italic: ["_", "_"], link: ["[", "](https://)"] };

function Markdown({ field, prefix, value, onChange, error, disabled, help }) {
  const id = ids(prefix, field);
  const ref = useRef(null);
  const [selected, setSelected] = useState(false);
  const track = () => setSelected(ref.current.selectionStart !== ref.current.selectionEnd);
  useEffect(() => {
    const el = ref.current;
    el.addEventListener("select", track);
    return () => el.removeEventListener("select", track);
  }, []);
  function apply(action) {
    const el = ref.current;
    const { selectionStart: start, selectionEnd: end } = el;
    const text = value ?? "";
    let next;
    let caret;
    if (action === "heading") {
      const lineStart = text.lastIndexOf("\n", start - 1) + 1;
      next = `${text.slice(0, lineStart)}## ${text.slice(lineStart)}`;
      caret = [end + 3, end + 3];
    } else {
      const [before, after] = WRAP[action];
      next = `${text.slice(0, start)}${before}${text.slice(start, end)}${after}${text.slice(end)}`;
      caret = [start, end + before.length + after.length];
    }
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(...caret);
    });
  }
  const tool = (action, label, content) => (
    <button className="pn-button" data-size="sm" type="button" aria-label={label} data-action={action} onMouseDown={(e) => e.preventDefault()} onClick={() => apply(action)}>
      {content}
    </button>
  );
  return (
    <Root field={field} template="field-markdown">
      <Label field={field} id={id} />
      <div className="pn-toolbar" role="toolbar" aria-label="Formatting" hidden={field.toolbarOnSelection ? !selected : undefined}>
        {tool("bold", "Bold", <b>B</b>)}
        {tool("italic", "Italic", <i>I</i>)}
        {tool("heading", "Heading", "H")}
        {tool("link", "Link", "Link")}
      </div>
      <textarea className="pn-textarea" data-markdown="" {...controlProps(field, id, { error, disabled })} data-slot-attr={CONTROL} ref={ref} value={value ?? ""} onChange={(e) => (onChange(e.target.value), track())} onSelect={track} onKeyUp={track} onMouseUp={track} />
      <Notes id={id} help={help ?? field.help} error={error} />
    </Root>
  );
}

function Toggle({ field, prefix, value, onChange, error, disabled, help }) {
  const id = ids(prefix, field);
  return (
    <Root field={field} template="field-toggle">
      <label className="pn-choice" htmlFor={id.input} data-slot-attr="for:input-id">
        <input className="pn-toggle" type="checkbox" role="switch" id={id.input} name={field.name} aria-describedby={id.describedby} aria-invalid={error ? "true" : undefined} disabled={disabled} data-slot-attr="id:input-id name:name aria-describedby:describedby" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} />
        <span className="pn-label" data-required={String(Boolean(field.required))} data-slot-attr="data-required:required" data-slot="label">{field.label}</span>
      </label>
      <Notes id={id} help={help ?? field.help} error={error} />
    </Root>
  );
}

function Choice({ template, field, prefix, value, onChange, error, disabled, help, choices, rootAttrs, rootSlotAttr }) {
  const id = ids(prefix, field);
  return (
    <Root field={field} template={template} attrs={rootAttrs} slotAttr={rootSlotAttr}>
      <Label field={field} id={id} />
      <select className="pn-select" {...controlProps(field, id, { error, disabled })} data-slot-attr={CONTROL} data-slot-repeat="option" value={value ?? ""} onChange={(e) => onChange(e.target.value || null)}>
        {[{ value: "", text: "Choose…" }, ...choices].map((o) => (
          <option key={o.value} value={o.value} data-slot-attr="value:value" data-slot="text">{o.text}</option>
        ))}
      </select>
      <Notes id={id} help={help ?? field.help} error={error} />
    </Root>
  );
}

const Select = (p) => <Choice template="field-select" {...p} choices={(p.field.options ?? []).map((o) => ({ value: o, text: o }))} />;
const Relation = (p) => (
  <Choice template="field-relation" {...p} choices={p.options?.[p.field.to] ?? []} rootAttrs={{ "data-to": p.field.to }} rootSlotAttr="data-field:name data-width:width data-to:to" />
);

function Tags({ field, prefix, value, onChange, error, disabled, help }) {
  const id = ids(prefix, field);
  const tags = value ?? [];
  const [draft, setDraft] = useState("");
  const input = useRef(null);
  function add() {
    const tag = draft.trim().replace(/,$/, "");
    setDraft("");
    if (tag && !tags.includes(tag)) onChange([...tags, tag]);
  }
  function onKeyDown(event) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      add();
    } else if (event.key === "Backspace" && !draft && tags.length) {
      onChange(tags.slice(0, -1));
    }
  }
  return (
    <Root field={field} template="field-tags">
      <Label field={field} id={id} />
      <div className="pn-tags-input">
        <span className="pn-tags-list" data-slot-repeat="tag">
          {tags.map((tag, i) => (
            <span className="pn-tag" key={tag}>
              <span data-slot="text">{tag}</span>
              <button className="pn-tag-remove" type="button" aria-label={`Remove ${tag}`} data-action="remove-tag" data-slot-attr="aria-label:remove-label" disabled={disabled} onClick={() => (onChange(tags.filter((_, j) => j !== i)), input.current.focus())}>
                <Icon name="close" />
              </button>
            </span>
          ))}
        </span>
        <input className="pn-tags-input-field" type="text" {...controlProps(field, id, { error, disabled })} data-slot-attr={CONTROL} ref={input} value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={onKeyDown} onBlur={() => draft.trim() && add()} />
      </div>
      <Notes id={id} help={help ?? field.help} error={error} />
    </Root>
  );
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function Upload({ image, field, prefix, value, onChange, error, disabled, help, files }) {
  const id = ids(prefix, field);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState("");
  const [over, setOver] = useState(false);
  const input = useRef(null);
  async function take(file) {
    if (!file) return;
    setBusy(true);
    try {
      onChange(await files.upload(file));
      setFailed("");
    } catch (problem) {
      setFailed(problem?.code === "too-large" ? "That file is too large." : "Could not upload. Try again.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }
  return (
    <Root field={field} template={image ? "field-image" : "field-file"} attrs={{ "data-state": value ? "filled" : "empty" }} slotAttr="data-field:name data-width:width data-state:upload-state">
      <SpanLabel field={field} id={id} />
      <div className="pn-field-controls">
        <label
          className="pn-dropzone"
          aria-busy={busy ? "true" : undefined}
          data-dragover={over ? "" : undefined}
          onDragOver={(e) => (e.preventDefault(), setOver(true))}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => (e.preventDefault(), setOver(false), take(e.dataTransfer.files[0]))}
        >
          <Icon name="upload" />
          <span data-slot="prompt">{image ? "Drop an image, or click to choose" : "Drop a file, or click to choose"}</span>
          <input type="file" accept={image ? "image/*" : undefined} id={id.input} name={field.name} aria-labelledby={id.label} aria-describedby={id.describedby} aria-invalid={error ? "true" : undefined} disabled={disabled} data-slot-attr="id:input-id name:name aria-labelledby:label-id aria-describedby:describedby" ref={input} onChange={(e) => take(e.target.files[0])} />
        </label>
        <div className="pn-file">
          {image ? (
            <img className="pn-file-thumb" src={value?.url || EMPTY_IMAGE} alt={value ? `${field.label}: ${value.name}` : ""} data-slot-attr="src:src alt:alt" />
          ) : (
            <span className="pn-file-thumb"><Icon name="file" /></span>
          )}
          <span className="pn-file-text">
            <span className="pn-file-name" data-slot="file-name">{value?.name ?? ""}</span>
            <span className="pn-file-meta" data-slot="file-meta">{value ? formatSize(value.size) : ""}</span>
          </span>
          <button className="pn-button" data-variant="quiet" data-icon-only="" data-size="sm" type="button" aria-label={`Remove ${field.label.toLowerCase()}`} data-action="remove-file" data-slot-attr="aria-label:remove-label" disabled={disabled} onClick={() => (onChange(null), input.current?.focus())}>
            <Icon name="trash" />
          </button>
        </div>
      </div>
      <Notes id={id} help={help ?? field.help} error={error || failed} />
    </Root>
  );
}

function Custom({ field, prefix, values, computed, error, help }) {
  const id = ids(prefix, field);
  const compute = computed?.[field.compute];
  return (
    <Root field={field} template="field-custom">
      <SpanLabel field={field} id={id} />
      <div className="pn-field-controls" data-slot-children="control">
        <input className="pn-input" type="text" readOnly id={id.input} aria-labelledby={id.label} aria-describedby={id.describedby} value={compute ? compute.display(values) : ""} />
      </div>
      <Notes id={id} help={help ?? field.help} error={error} />
    </Root>
  );
}

const TYPES = {
  text: Text,
  slug: Slug,
  date: DateField,
  number: NumberField,
  textarea: Textarea,
  markdown: Markdown,
  toggle: Toggle,
  select: Select,
  relation: Relation,
  tags: Tags,
  image: (p) => <Upload image {...p} />,
  file: (p) => <Upload {...p} />,
  custom: Custom,
};

export function Field({ onLeave, ...props }) {
  const Component = TYPES[props.field.type] ?? Text;
  return (
    <Leave.Provider value={onLeave}>
      <Component {...props} />
    </Leave.Provider>
  );
}
