// Keyboard shortcuts. behavior-spec.md section 4 (K1, K3). Escape is native to <dialog> (K2).
//
// const off = installShortcuts({ save: () => saveState.save(), search: () => searchInput });

function isTextControl(el) {
  return el instanceof HTMLTextAreaElement || el?.isContentEditable || (el instanceof HTMLInputElement && !["checkbox", "radio", "button", "submit", "file"].includes(el.type)) || el instanceof HTMLSelectElement;
}

export function installShortcuts({ save, search } = {}) {
  function onKey(event) {
    if ((event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === "s") {
      event.preventDefault();
      save?.();
      return;
    }
    if (event.key === "/" && !event.metaKey && !event.ctrlKey && !isTextControl(event.target)) {
      const input = search?.();
      if (input) {
        event.preventDefault();
        input.focus();
      }
    }
  }
  window.addEventListener("keydown", onKey);
  return () => window.removeEventListener("keydown", onKey);
}
