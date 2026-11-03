# Adapter contracts

The panel talks to three adapters and never knows which service is behind them. Every recipe fills exactly one contract below. Every build also has memory adapters that fill all three (`build.md` step 6), so the same panel code runs against tests and real services.

All functions are `async`. On failure they throw an `Error` with a `code` from the table at the end. Values crossing a contract are plain JSON.

## Auth

Answers: who is signed in?

| Function | Input | Returns | Throws |
| --- | --- | --- | --- |
| `session()` | none | `{ user }`, where `user` is the signed-in email address (`editor` for `password`, `local` for `none`), or `null` when no one is signed in | `unavailable` |
| `renderMethods(container, { onSignedIn, onError })` | The `screen-login` `methods` container | Nothing. Builds the sign-in controls from design-system components and wires them. Calls `onSignedIn()` after a successful sign-in, `onError(message)` with a sentence for the person otherwise | never; reports through `onError` |
| `logout()` | none | Nothing. The next `session()` returns `null` | `unavailable` |

Rules:

- The server decides who is signed in. The browser never decides it, and never holds a token it could forge.
- Every data and files request is checked on the server. An unsigned request gets `unauthorized`; a signed-in address not on the allow list gets `forbidden`.
- When a load throws `unauthorized`, the panel shows `screen-login`. When a save throws it, the save bar enters `error` with every edit kept, and a toast says "You were signed out. Copy your edits, then reload to sign in." (`build.md` step 5). The panel does not carry edits across a sign-in.

## Data

Answers: how are items read, written, and listed?

An **item**:

```json
{
  "id": "rail-line",
  "type": "post",
  "status": "draft",
  "values": { "title": "Walking the old rail line", "tags": ["walking"], "cover": null },
  "createdAt": "2026-10-20T09:00:00.000Z",
  "updatedAt": "2026-10-28T18:30:00.000Z"
}
```

- `id`: chosen by the adapter on create; letters, digits, `-`, and `_`; never changes.
- `status`: one of the type's statuses, or absent when the type has none.
- `values`: one key per field `name`. Text is a string, `number` a number or `null`, `toggle` a boolean, `tags` an array of strings, `image` and `file` a file value (below) or `null`, `relation` the target item's `id` or `null`.
- `createdAt`, `updatedAt`: ISO 8601 times set by the adapter, never by the browser.

A **singleton record**: `{ "values": {...}, "createdAt": "...", "updatedAt": "..." }`.

| Function | Input | Returns | Throws |
| --- | --- | --- | --- |
| `list(type)` | A type `id` | Every item of the type, in any order. The panel sorts and searches | `unauthorized`, `forbidden`, `unavailable` |
| `get(type, id)` | Type and item `id` | The item | `not-found`, and the above |
| `create(type, { status, values })` | The first status, and the values from the create flow with defaults applied | The new item, with `id`, `createdAt`, `updatedAt` | `invalid`, and the above |
| `update(type, id, { status, values })` | The whole item's status and values. Never a partial patch | The updated item | `not-found`, `invalid`, `conflict`, and the above |
| `remove(type, id)` | Type and item `id` | Nothing | `not-found`, and the above |
| `getSingleton(id)` | A singleton `id` | Its record, or `null` before the first save | `unauthorized`, `forbidden`, `unavailable` |
| `saveSingleton(id, values)` | All of its values | The saved record | `invalid`, and the above |

Rules:

- The adapter accepts only the types and singletons in the schema, and only the field names each declares. Anything else is `invalid`.
- A write is all or nothing. A failed `update` leaves the stored item as it was.
- `list` is for small collections (hundreds of items). A recipe for larger data says how it pages; the panel's list screen does not change.

## Files

Answers: how is media uploaded and served?

A **file value**: `{ "url": "/uploads/2026/10/k3f9-cover.png", "name": "cover.png", "size": 84211, "type": "image/png" }`. `url` is what an `<img src>` or a download link uses. It is stored in the item's values as is.

| Function | Input | Returns | Throws |
| --- | --- | --- | --- |
| `upload(file)` | A browser `File` | A file value | `too-large`, `invalid` (a type the field does not accept), `unauthorized`, `forbidden`, `unavailable` |

Rules:

- The stored name is never the uploaded name alone. Prefix a random part, and keep only letters, digits, `.`, `-`, and `_` from the original.
- Removing a file from a field does not delete it from storage. Deleting unused files is a separate, manual job.
- Uploaded files are served so they cannot run as pages: never as `text/html`, with `X-Content-Type-Options: nosniff`, and with a sandboxing `Content-Security-Policy`.

## Error codes

| `code` | Meaning | What the panel shows |
| --- | --- | --- |
| `unauthorized` | No one is signed in, or the session expired | `screen-login` |
| `forbidden` | Signed in, but not allowed | `screen-login` with "This account isn't allowed. Sign in with another one." |
| `not-found` | The item does not exist | The item screen's error state |
| `invalid` | The request broke the schema | The save bar's error state; report the message in the console |
| `conflict` | The item changed elsewhere since it loaded | The save bar's error state: "Changed elsewhere. Copy your edits, then reload." |
| `too-large` | The upload is over the limit | The field's error: "That file is too large." |
| `rate-limited` | Too many wrong sign-in tries | `screen-login` with the recipe's message (`password.md`) |
| `unavailable` | Network or server failure | The save bar's or screen's error state |

## The project server

`json-files` and `local-disk` with `via: server`, and every auth recipe, run in one small server the project owns. It is a single dependency-free Node file, `server.mjs`, written once and extended by each recipe. The recipes describe their part; this is the shared frame.

```
GET    /api/config                   → { auth, googleClientId }, public, for the sign-in button
GET    /api/session                  → { user } or 401
POST   /api/session                  ← the login recipe's credential → { user }, sets the session cookie
DELETE /api/session                  → 204, clears the cookie
GET    /api/items/:type              → [item]
GET    /api/items/:type/:id          → item
POST   /api/items/:type              ← { status, values } → item
PUT    /api/items/:type/:id          ← { status, values } → item
DELETE /api/items/:type/:id          → 204
GET    /api/singletons/:id           → record or null
PUT    /api/singletons/:id           ← { values } → record
POST   /api/files                    ← the file as the raw body; headers content-type and x-file-name → file value
GET    /uploads/...                  → an uploaded file
GET    anything else                 → the panel's static files: .html, .js, .css, .svg, .json, and images only
```

- Errors are `{ "error": { "code": "not-found", "message": "..." } }` with the matching HTTP status (401, 403, 404, 400, 409, 413, 429, 503).
- Every `/api/` request except `GET /api/config`, `GET /api/session`, and `POST /api/session` needs a valid session cookie.
- Every request that changes something must send `x-panel: 1`. Browsers cannot send a custom header across sites without permission, so this blocks cross-site requests. Reject a request without it with 403.
- The server reads `panel.config.js` for the types, singletons, and field names it accepts, and, for `google-login` and `email-link`, `allow.mjs` for the allow list. `allow.mjs` sits outside the served folder.
- Bind to `127.0.0.1` unless the person deploys it; never to every address by default when auth is `none`.
