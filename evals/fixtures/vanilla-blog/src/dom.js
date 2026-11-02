// Formatting helpers for this build.

export function formatDate(value, withTime = false) {
  if (!value) return "";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en", withTime ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "medium" }).format(date);
}

export function button(label, { variant, action } = {}) {
  const b = document.createElement("button");
  b.className = "pn-button";
  b.type = "button";
  if (variant) b.dataset.variant = variant;
  if (action) b.dataset.action = action;
  b.textContent = label;
  return b;
}
