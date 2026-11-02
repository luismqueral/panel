// Data and files adapters over the project server's /api routes (recipes/contracts.md).

export function createRequest(base = "/api") {
  return async function request(method, path, body, headers = {}) {
    const isFile = typeof Blob !== "undefined" && body instanceof Blob;
    let res;
    try {
      res = await fetch(base + path, {
        method,
        credentials: "same-origin",
        headers: {
          ...(body !== undefined && !isFile ? { "content-type": "application/json" } : {}),
          ...(method !== "GET" ? { "x-panel": "1" } : {}),
          ...headers,
        },
        body: isFile ? body : body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw Object.assign(new Error("network error"), { code: "unavailable" });
    }
    if (res.status === 204) return null;
    const data = await res.json().catch(() => null);
    if (!res.ok) throw Object.assign(new Error(data?.error?.message ?? res.statusText), { code: data?.error?.code ?? "unavailable" });
    return data;
  };
}

const at = (...parts) => parts.map(encodeURIComponent).join("/");

export function createHttpAdapters(request) {
  const data = {
    list: (type) => request("GET", `/items/${at(type)}`),
    get: (type, id) => request("GET", `/items/${at(type, id)}`),
    create: (type, { status, values }) => request("POST", `/items/${at(type)}`, { status, values }),
    update: (type, id, { status, values }) => request("PUT", `/items/${at(type, id)}`, { status, values }),
    remove: (type, id) => request("DELETE", `/items/${at(type, id)}`),
    getSingleton: (id) => request("GET", `/singletons/${at(id)}`),
    saveSingleton: (id, values) => request("PUT", `/singletons/${at(id)}`, { values }),
  };
  const files = {
    upload: (file) =>
      request("POST", "/files", file, { "content-type": file.type || "application/octet-stream", "x-file-name": encodeURIComponent(file.name) }),
  };
  return { data, files };
}
