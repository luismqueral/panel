// Starts the Sunday Table panel: PANEL_PASSWORD=... SESSION_SECRET=... node start.mjs
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { PANEL } from "./panel/panel.config.js";
import { createPanelServer } from "./server/server.mjs";
import { createJsonFiles } from "./server/json-files.mjs";
import { createLocalDisk } from "./server/local-disk.mjs";
import { createPasswordCheck } from "./server/password.mjs";
import { createSessions } from "./server/session.mjs";

const project = dirname(fileURLToPath(import.meta.url));

const name = PANEL.auth.password_env ?? "PANEL_PASSWORD";
const auth = {
  recipe: "password",
  check: createPasswordCheck(process.env[name], { name }),
  sessions: createSessions(process.env.SESSION_SECRET),
};

const server = createPanelServer({
  root: resolve(project, "panel"),
  config: PANEL,
  data: createJsonFiles({ dir: resolve(project, PANEL.data.path), config: PANEL }),
  files: createLocalDisk({ dir: resolve(project, PANEL.files.path), url: PANEL.files.url ?? "/uploads" }),
  auth,
});

const port = Number(process.env.PORT ?? 4810);
const host = process.env.HOST ?? "127.0.0.1";
server.listen(port, host, () => console.log(`${PANEL.name} panel: http://${host}:${port}/`));
