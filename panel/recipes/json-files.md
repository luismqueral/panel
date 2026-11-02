# Recipe: json-files

Status: verified for `via: server` (`evals/recipes/`). The other `via` branches are unverified.

## 1. When to use it

Small content (up to hundreds of items per type) that should live in the project as readable files, and be diffable in git. It fills the **data** contract. It replaces a database for blogs, portfolios, and settings.

Don't use it for many editors writing at once, thousands of items, or data the host app already keeps in a database.

## 2. Prerequisites

- `via: server` (default): Node 18 or later, the project server, and a `package.json` with `"type": "module"` (`build.md` step 6).
- `via: file-system-access`: a Chromium browser. No server.
- `via: github`: a repository, and a login that can produce a GitHub token. Unverified.
- `via: download`, `via: local-storage`: nothing. Mockups and one-off edits only.

## 3. Contract

Data, as in `contracts.md`. Storage layout, for `path: ./content`:

```
content/
  post/
    a3f9c01b2e.json     one item: { id, type, status, values, createdAt, updatedAt }
  settings.json         one singleton: { values, createdAt, updatedAt }
```

## 4. Steps

1. Choose the branch from the schema's `via` (default `server`). Each branch below is complete; follow only one.

### via: server

1. Copy `recipes/server/json-files.mjs` and `recipes/server/errors.mjs` with the rest of `recipes/server/`, and `recipes/client/http.js`.
2. In `start.mjs`: `data: createJsonFiles({ dir: resolve(project, PANEL.data.path), config: PANEL })`.
3. In `panel.js`: `createHttpAdapters(request).data` when not in `?test` mode.
4. Ask whether the content folder goes in version control. Default: yes, so edits have history. When unattended, take the default and record it (`build.md` step 8).
5. Writes are atomic (a temporary file, then a rename). Keep it that way.

### via: file-system-access (unverified)

1. On first use, call `window.showDirectoryPicker({ mode: "readwrite" })` from a click, and keep the handle in IndexedDB.
2. On later visits, call `handle.requestPermission({ mode: "readwrite" })` from a click before reading.
3. Implement each contract function over `getDirectoryHandle(type, { create: true })` and `getFileHandle(`${id}.json`, { create })`, writing with `createWritable()`.
4. Show a "Choose content folder" button in `screen-login`'s `methods` (the auth recipe is `none`).

### via: github (unverified)

1. Read and write through the contents API: `GET` and `PUT /repos/{repo}/contents/{path}/{type}/{id}.json` on `branch`, sending the file's `sha` on update.
2. The token comes from the login recipe's server, never from the schema or the browser's storage. If there is no server, stop: this branch needs one.
3. Each save is a commit. Say so in the playback: publishing triggers the site's rebuild.

### via: download, via: local-storage

- `download`: keep items in memory; a "Download content" button saves one JSON file. Tell the person nothing persists on its own.
- `local-storage`: store items under the key `panel:<name>:<type>`. Mockups only; never for real content.

## 5. Verify

Automated, `via: server` (`npm run test:recipes`): create through the create flow, edit every field kind, upload, publish, reload: every value is back. The JSON on disk matches the item. Singletons persist. Deleting removes the file. Unknown types, fields, statuses, and ids (including `../`) are refused.

By hand, once per project:

- [ ] Create an item, refresh: it is still there.
- [ ] The file `content/<type>/<id>.json` exists and reads like the item.
- [ ] Edit, save, and `git diff` shows only the change.
- [ ] Delete the item: its file is gone.
- [ ] Stop the server mid-save: the save bar shows its error, and the file on disk is the old version, not a broken one.

## 6. Pitfalls

- Building a file path from `type` or `id` without checking them. Only schema types, and ids matching `^[a-z0-9][a-z0-9_-]{0,63}$`.
- Writing in place. A crash leaves half a file. Write a temporary file, then rename.
- Accepting any key in `values`. Only the schema's field names.
- Letting the browser set `createdAt` or `updatedAt`.
- Patching partially. `update` replaces `status` and `values` as a whole.
- Using the slug as the id. Slugs change; ids never do.
- Reading the folder on every keystroke. `list` once per screen.
