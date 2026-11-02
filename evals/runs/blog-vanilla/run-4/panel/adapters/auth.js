// Auth adapters for the project server: google-login (recipes/google-login.md) and none (recipes/none.md).
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
  return {
    async session() {
      try {
        return await request("GET", "/session");
      } catch (error) {
        if (error.code === "unauthorized" || error.code === "forbidden") return null;
        throw error;
      }
    },
    async renderMethods(container, { onSignedIn, onError }) {
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

// auth: none. The server says who is signed in ("local"); there is nothing to render.
export function createNoAuth(request) {
  return {
    session: () => request("GET", "/session"),
    renderMethods() {},
    logout: async () => {},
  };
}
