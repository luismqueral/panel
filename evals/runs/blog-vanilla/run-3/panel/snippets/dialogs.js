// Dialogs. behavior-spec.md section 3 (D1–D6). Optional vanilla snippet. Uses the native <dialog>.
//
// const result = await openDialog(dialog);          // "cancel", "confirm", "create", "done", ...
// const ok = await confirmDialog(dialog, { title, text, confirmLabel, variant: "negative" });

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function focusables(dialog) {
  return [...dialog.querySelectorAll(FOCUSABLE)].filter((el) => el.getClientRects().length);
}

function focusInitial(dialog) {
  const field = dialog.querySelector(".pn-field input:not([type=file]), .pn-field textarea, .pn-field select");
  if (field) return field.focus();
  const confirm = dialog.querySelector('[data-action="confirm"]');
  if (confirm?.dataset.variant === "negative") return dialog.querySelector('[data-action="cancel"]')?.focus();
  (confirm ?? focusables(dialog)[0])?.focus();
}

export function openDialog(dialog, { opener = document.activeElement } = {}) {
  return new Promise((resolve) => {
    function trap(event) {
      if (event.key !== "Tab") return;
      const items = focusables(dialog);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    dialog.returnValue = "";
    dialog.addEventListener("keydown", trap);
    dialog.addEventListener(
      "close",
      () => {
        dialog.removeEventListener("keydown", trap);
        if (opener && opener.isConnected) opener.focus();
        resolve(dialog.returnValue || "cancel");
      },
      { once: true },
    );
    dialog.showModal();
    focusInitial(dialog);
  });
}

export async function confirmDialog(dialog, { title, text, confirmLabel, variant = "primary", opener } = {}) {
  dialog.querySelector('[data-slot="title"]').textContent = title;
  dialog.querySelector('[data-slot="text"]').textContent = text;
  const confirm = dialog.querySelector('[data-action="confirm"]');
  confirm.textContent = confirmLabel;
  confirm.dataset.variant = variant;
  return (await openDialog(dialog, { opener })) === "confirm";
}
