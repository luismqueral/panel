// Toasts. Optional vanilla snippet. region is the layout's toasts container.

export function showToast(region, text, { tone = "info", ms = 4000 } = {}) {
  const toast = document.createElement("div");
  toast.className = "pn-toast";
  toast.setAttribute("role", tone === "negative" ? "alert" : "status");
  if (tone !== "info") toast.dataset.tone = tone;
  const p = document.createElement("p");
  p.className = "pn-toast-text";
  p.textContent = text;
  const close = document.createElement("button");
  close.className = "pn-button";
  close.type = "button";
  close.dataset.variant = "quiet";
  close.dataset.iconOnly = "";
  close.dataset.size = "sm";
  close.setAttribute("aria-label", "Dismiss");
  close.innerHTML = '<svg class="pn-icon" aria-hidden="true"><use href="#pn-icon-close"/></svg>';
  close.addEventListener("click", () => toast.remove());
  toast.append(p, close);
  region.appendChild(toast);
  if (ms) setTimeout(() => toast.remove(), ms);
  return toast;
}
