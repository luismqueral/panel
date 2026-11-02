// files: local-disk, via: server (recipes/local-disk.md). The server stores uploads/<yyyy>/<mm>/<random>-<name>.
import { createHttpAdapters } from "./http.js";

export const createFilesAdapter = (request) => createHttpAdapters(request).files;
