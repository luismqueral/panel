// data: json-files, via: server (recipes/json-files.md). The server writes content/<type>/<id>.json.
import { createHttpAdapters } from "./http.js";

export const createDataAdapter = (request) => createHttpAdapters(request).data;
