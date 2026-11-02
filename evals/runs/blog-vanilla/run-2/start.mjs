// Builds the adapters from panel.config.js and the environment, then listens.
// GOOGLE_CLIENT_ID=... SESSION_SECRET=... node start.mjs

import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { PANEL } from "./panel/panel.config.js";
import { createPanelServer } from "./server/server.mjs";
import { createSessions } from "./server/session.mjs";
import { createKeyStore, verifyGoogleToken } from "./server/google.mjs";
import { createJsonFiles } from "./server/json-files.mjs";
import { createLocalDisk } from "./server/local-disk.mjs";

const project = dirname(fileURLToPath(import.meta.url));

const clientId = process.env.GOOGLE_CLIENT_ID;
if (!clientId) throw new Error("Set GOOGLE_CLIENT_ID");
const keyFor = createKeyStore();
const auth = {
  recipe: "google-login",
  allow: PANEL.auth.allow,
  clientId,
  sessions: createSessions(process.env.SESSION_SECRET),
  verify: (credential) => verifyGoogleToken(credential, { clientId, keyFor }),
};

const data = createJsonFiles({ dir: resolve(project, PANEL.data.path), config: PANEL });
const files = createLocalDisk({ dir: resolve(project, PANEL.files.path), url: PANEL.files.url ?? "/uploads" });

const server = createPanelServer({ root: resolve(project, "panel"), config: PANEL, data, files, auth });

// 127.0.0.1 while developing. To deploy, set HOST, add the public origin to the Google client, and serve over HTTPS.
const host = process.env.HOST ?? "127.0.0.1";
const port = Number(process.env.PORT ?? 4810);
server.listen(port, host, () => console.log(`${PANEL.name} panel on http://localhost:${port}/`));
