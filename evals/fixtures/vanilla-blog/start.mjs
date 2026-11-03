// Starts the project server from panel.config.js and the environment.
//   GOOGLE_CLIENT_ID   the OAuth client id (google-login)
//   PANEL_PASSWORD     the shared password, at least 12 characters (password; the schema's password_env names it)
//   SESSION_SECRET     at least 32 random characters (google-login, password)
//   PORT               default 4810
//   HOST               default 127.0.0.1

import { resolve, dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createPanelServer } from "./dist/server/server.mjs";
import { createSessions } from "./dist/server/session.mjs";
import { createKeyStore, verifyGoogleToken } from "./dist/server/google.mjs";
import { createPasswordCheck } from "./dist/server/password.mjs";
import { createJsonFiles } from "./dist/server/json-files.mjs";
import { createLocalDisk } from "./dist/server/local-disk.mjs";
import { ALLOW } from "./allow.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const project = here;
const root = join(project, "dist");
const { PANEL } = await import(pathToFileURL(join(root, "panel.config.js")));

let auth = { recipe: "none" };
if (PANEL.auth?.recipe === "google-login") {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) throw new Error("Set GOOGLE_CLIENT_ID (see recipes/google-login.md, Prerequisites)");
  const keyFor = createKeyStore();
  auth = {
    recipe: "google-login",
    allow: ALLOW,
    clientId,
    sessions: createSessions(process.env.SESSION_SECRET),
    verify: (credential) => verifyGoogleToken(credential, { clientId, keyFor }),
  };
} else if (PANEL.auth?.recipe === "password") {
  const name = PANEL.auth.password_env ?? "PANEL_PASSWORD";
  auth = {
    recipe: "password",
    check: createPasswordCheck(process.env[name], { name }),
    sessions: createSessions(process.env.SESSION_SECRET),
  };
}

const server = createPanelServer({
  root,
  config: PANEL,
  data: createJsonFiles({ dir: resolve(project, PANEL.data.path), config: PANEL }),
  files: PANEL.files && createLocalDisk({ dir: resolve(project, PANEL.files.path), url: PANEL.files.url ?? "/uploads" }),
  auth,
});
const port = Number(process.env.PORT ?? 4810);
const host = process.env.HOST ?? "127.0.0.1";
if (auth.recipe === "none" && !["127.0.0.1", "localhost", "::1"].includes(host)) throw new Error("auth is none: the panel may only listen on this computer (HOST=127.0.0.1)");
server.listen(port, host, () => console.log(`Panel at http://${host === "0.0.0.0" ? "localhost" : host}:${port}/`));
