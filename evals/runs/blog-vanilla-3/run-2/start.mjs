// Builds the adapters from panel.config.js and the environment, then listens (build.md step 6).
// Needs GOOGLE_CLIENT_ID and SESSION_SECRET in the environment.

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PANEL } from "./panel/panel.config.js";
import { ALLOW } from "./allow.mjs";
import { createPanelServer } from "./server/server.mjs";
import { createSessions } from "./server/session.mjs";
import { createKeyStore, verifyGoogleToken } from "./server/google.mjs";
import { createJsonFiles } from "./server/json-files.mjs";
import { createLocalDisk } from "./server/local-disk.mjs";

const project = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 4810);
const HOST = process.env.HOST ?? "127.0.0.1";

if (PANEL.auth.recipe === "none" && !["127.0.0.1", "localhost", "::1"].includes(HOST)) {
  throw new Error("auth: none only listens on 127.0.0.1, localhost, or ::1");
}

const clientId = process.env.GOOGLE_CLIENT_ID;
if (!clientId) throw new Error("Set GOOGLE_CLIENT_ID");
const keyFor = createKeyStore();
const auth = {
  recipe: "google-login",
  allow: ALLOW,
  clientId,
  sessions: createSessions(process.env.SESSION_SECRET),
  verify: (credential) => verifyGoogleToken(credential, { clientId, keyFor }),
};

const server = createPanelServer({
  root: resolve(project, "panel"),
  config: PANEL,
  data: createJsonFiles({ dir: resolve(project, PANEL.data.path), config: PANEL }),
  files: createLocalDisk({ dir: resolve(project, PANEL.files.path), url: PANEL.files.url ?? "/uploads" }),
  auth,
});

server.listen(PORT, HOST, () => console.log(`${PANEL.name} panel: http://${HOST}:${PORT}/`));
