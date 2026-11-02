# Recipe: local-disk

Status: verified for `via: server` (`evals/recipes/`). `via: file-system-access` is unverified.

## 1. When to use it

Uploads (images and files) for a panel whose site is served from the same machine or deploy, such as a static site. It fills the **files** contract. It replaces cloud storage for small sites.

Don't use it when the server's disk is temporary (many hosted platforms), or files are large or many. Use `s3` or `r2`.

## 2. Prerequisites

- The project server, and a folder it can write to.
- `url`: the URL path the folder is served from. Default `/uploads`.

## 3. Contract

Files, as in `contracts.md`. Stored as `<path>/<yyyy>/<mm>/<8 random hex>-<safe name>`, served at `<url>/<yyyy>/<mm>/...`. Limit: 10 MB per file.

## 4. Steps

1. Copy `recipes/server/local-disk.mjs` with the rest of `recipes/server/`.
2. In `start.mjs`: `files: createLocalDisk({ dir: resolve(project, PANEL.files.path), url: PANEL.files.url ?? "/uploads" })`.
3. In `panel.js`: `createHttpAdapters(request).files` when not in `?test` mode.
4. **If** the public site is served by something else (a static host), the uploads folder must be published with the site. Say where it goes, for example `public/uploads`, and set `path` to it.
5. **If** the person needs a different limit, change `MAX_UPLOAD` in `local-disk.mjs` and say so. Do not remove it.
6. Ask whether uploads belong in git. Default: no; add the uploads folder to `.gitignore`, since large binaries usually do not belong there. When unattended, take the default and record it (`build.md` step 8).

## 5. Verify

Automated (`npm run test:recipes`): an upload through the image field lands on disk at the expected path with a safe name, the item stores the file value, the image loads in the field after a reload, it is served with its type, `nosniff`, and a sandboxing CSP. HTML uploads are refused; a file over 10 MB gets 413; `../` paths under `/uploads` are 404.

By hand, once per project:

- [ ] Upload an image: it shows in the field, and the file exists under the folder.
- [ ] Reload: the image still shows.
- [ ] Open the image URL directly: it loads as an image.
- [ ] Upload a file named `../../evil.html`: it is refused, or stored with a safe name and never served as a page.

## 6. Pitfalls

- Using the uploaded name as the stored name. Two uploads collide, and names like `../x` escape the folder.
- Serving uploads as `text/html`, or without `nosniff`. An uploaded page could run as the site.
- SVG uploads run scripts when opened directly. The sandboxing CSP stops that; keep it.
- Reading the whole upload before checking its size. Count bytes as they arrive.
- Deleting the file when it is removed from a field. Another item may use it.
