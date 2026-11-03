// Builds the adapters from panel.config.js and the environment, then listens (build.md step 6).
// Needs GOOGLE_CLIENT_ID and SESSION_SECRET in the environment (recipes/google-login.md).

import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createPanelServer } from "./server/server.mjs";
import { createSessions } from "./server/session.mjs";
import { createKeyStore, verifyGoogleToken } from "./server/google.mjs";
import { createJsonFiles } from "./server/json-files.mjs";
import { createLocalDisk } from "./server/local-disk.mjs";
import { PANEL } from "./panel/panel.config.js";
import { ALLOW } from "./allow.mjs";

const project = dirname(fileURLToPath(import.meta.url));

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
  root: join(project, "panel"),
  config: PANEL,
  data: createJsonFiles({ dir: resolve(project, PANEL.data.path), config: PANEL }),
  files: createLocalDisk({ dir: resolve(project, PANEL.files.path), url: PANEL.files.url ?? "/uploads" }),
  auth,
});

const port = Number(process.env.PORT ?? 4810);
const host = process.env.HOST ?? "127.0.0.1";
server.listen(port, host, () => console.log(`Field Notes panel at http://${host.includes(":") ? `[${host}]` : host}:${port}/`));
