// Where experiments write. Runs and results live outside this public repo, in a sibling folder
// (default ../panel-evals), so only the harness is versioned here. Set PANEL_EVALS_DIR to move it.

import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const root = resolve(fileURLToPath(new URL("../..", import.meta.url)));
export const evalsDir = resolve(process.env.PANEL_EVALS_DIR ?? resolve(root, "../panel-evals"));
