// Auth adapters for the project server: google-login (recipes/google-login.md), password (recipes/password.md),
// and none (recipes/none.md).
// The server verifies the Google token and sets the session; the browser never decides who is signed in.

const GIS = "https://accounts.google.com/gsi/client";

function loadScript() {
  if (window.google?.accounts?.id) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = GIS;
    script.async = true;
    script.onload = resolve;
    script.onerror = () => reject(new Error("could not load Google sign-in"));
    document.head.append(script);
  });
}

export function createGoogleAuth(request) {
  let refused = false;
  return {
    async session() {
      try {
        return await request("GET", "/session");
      } catch (error) {
        refused = error.code === "forbidden";
        if (error.code === "unauthorized" || error.code === "forbidden") return null;
        throw error;
      }
    },
    async renderMethods(container, { onSignedIn, onError }) {
      if (refused) onError("This account isn't allowed. Sign in with another one.");
      try {
        const [{ googleClientId }] = await Promise.all([request("GET", "/config"), loadScript()]);
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          ux_mode: "popup",
          callback: async ({ credential }) => {
            try {
              await request("POST", "/session", { credential });
              onSignedIn();
            } catch (error) {
              onError(error.code === "forbidden" ? "This account isn't allowed. Sign in with another one." : "Could not sign in. Try again.");
            }
          },
        });
        const slot = document.createElement("div");
        container.replaceChildren(slot);
        window.google.accounts.id.renderButton(slot, { theme: "outline", size: "large", text: "signin_with", shape: "rectangular" });
      } catch {
        onError("Could not load Google sign-in. Check your connection and reload.");
      }
    },
    async logout() {
      await request("DELETE", "/session");
      window.google?.accounts?.id?.disableAutoSelect();
    },
  };
}

function primaryButton(label, type = "button") {
  const button = document.createElement("button");
  button.className = "pn-button";
  button.dataset.variant = "primary";
  button.type = type;
  button.textContent = label;
  return button;
}

// password: one shared password. The server checks it and sets the session; the browser only passes it on.
export function createPasswordAuth(request) {
  return {
    async session() {
      try {
        return await request("GET", "/session");
      } catch (error) {
        if (error.code === "unauthorized" || error.code === "forbidden") return null;
        throw error;
      }
    },
    renderMethods(container, { onSignedIn, onError }) {
      const form = document.createElement("form");
      form.className = "pn-login-form";
      form.noValidate = true;
      const field = document.createElement("div");
      field.className = "pn-field";
      const label = document.createElement("label");
      label.className = "pn-label";
      label.htmlFor = "pn-password";
      label.textContent = "Password";
      const input = document.createElement("input");
      input.className = "pn-input";
      input.type = "password";
      input.id = "pn-password";
      input.name = "password";
      input.autocomplete = "current-password";
      input.required = true;
      field.append(label, input);
      const submit = primaryButton("Sign in", "submit");
      form.append(field, submit);
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (!input.value) {
          onError("Enter the password.");
          input.focus();
          return;
        }
        submit.disabled = true;
        try {
          await request("POST", "/session", { password: input.value });
          onSignedIn();
        } catch (error) {
          if (error.code === "unauthorized") {
            input.value = "";
            onError("That password isn't right. Try again.");
          } else if (error.code === "rate-limited") onError("Too many tries. Wait a few minutes, then try again.");
          else onError("Could not sign in. Try again.");
          submit.disabled = false;
          input.focus();
        }
      });
      container.replaceChildren(form);
      input.focus();
    },
    async logout() {
      await request("DELETE", "/session");
    },
  };
}

// auth: none, also used when the schema names no auth. No gatekeeping: one button opens the panel
// for this browser tab. The server still says who is signed in ("local").
const ENTERED = "pn-entered";

export function createNoAuth(request) {
  return {
    async session() {
      if (sessionStorage.getItem(ENTERED) !== "1") return null;
      return request("GET", "/session");
    },
    renderMethods(container, { onSignedIn }) {
      const enter = primaryButton("View panel");
      enter.addEventListener("click", () => {
        sessionStorage.setItem(ENTERED, "1");
        onSignedIn();
      });
      container.replaceChildren(enter);
    },
    async logout() {
      sessionStorage.removeItem(ENTERED);
    },
  };
}
