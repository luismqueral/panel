import { createRoot } from "react-dom/client";
import "./panel/tokens.css";
import "./panel/components.css";
import App from "./App.jsx";
import { PANEL } from "./panel.config.js";
import { createMemoryAdapters } from "./adapters/memory.js";
import { createRequest, createHttpAdapters } from "./adapters/http.js";
import { createGoogleAuth, createNoAuth } from "./adapters/auth.js";

async function adapters() {
  if (new URLSearchParams(location.search).has("test")) return createMemoryAdapters((await import("./seed.json")).default);
  const request = createRequest();
  const auth = PANEL.auth.recipe === "google-login" ? createGoogleAuth(request) : createNoAuth(request);
  return { ...createHttpAdapters(request), auth };
}

createRoot(document.getElementById("root")).render(<App adapters={await adapters()} />);
