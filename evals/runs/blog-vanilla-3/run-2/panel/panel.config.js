// The schema (panel.yaml) restated as plain JS. Nothing reads panel.yaml at runtime.
// Each key names the panel.yaml line it comes from.

export const PANEL = {
  // name: Field Notes (line 2)
  name: "Field Notes",
  // auth: google-login (lines 4-7; the allow list goes in allow.mjs, not here)
  auth: { recipe: "google-login" },
  // data: json-files, path ./content (lines 9-11); via defaults to server; start.mjs reads the path
  data: { recipe: "json-files", via: "server", path: "./content" },
  // files: local-disk, path ./uploads (lines 13-15); url defaults to /uploads
  files: { recipe: "local-disk", path: "./uploads", url: "/uploads" },
  types: [
    {
      // id: post, label: Posts (lines 18-19)
      id: "post",
      label: "Posts",
      singular: "post",
      // notes: Long-form writing. The editor should feel like a quiet page, not a form. (line 20)
      // status: draft, published (lines 25-27)
      status: ["draft", "published"],
      // list: title title, subtitle date, sort -date, search title (lines 28-33)
      list: { title: "title", subtitle: "date", sort: "-date", search: ["title"] },
      // behavior: Autosave drafts every 10 seconds (line 22)
      autosave: { every: 10000, drafts: true },
      // behavior: Show word count under the body field (line 23)
      wordCount: "body",
      // behavior: Publishing asks for confirmation (line 24)
      confirmPublish: true,
      // conformance: Publishing a post requires a cover image. (line 81)
      publishRequires: ["cover"],
      fields: [
        // title: text, required, 1/1 (lines 35-38)
        { name: "title", label: "Title", type: "text", required: true, width: "1/1" },
        // slug: slug from title, 1/2 (lines 40-43)
        { name: "slug", label: "Slug", type: "slug", from: "title", required: false, width: "1/2" },
        // date: date, required, 1/2 (lines 45-48)
        { name: "date", label: "Date", type: "date", required: true, width: "1/2" },
        // cover: image, 1/2 (lines 50-52)
        { name: "cover", label: "Cover", type: "image", required: false, width: "1/2" },
        // tags: tags, 1/2 (lines 54-56)
        { name: "tags", label: "Tags", type: "tags", required: false, width: "1/2" },
        // body: markdown, required, 1/1 (lines 58-61)
        // behavior: Toolbar hidden until text is selected. (line 62)
        { name: "body", label: "Body", type: "markdown", required: true, width: "1/1", toolbarOnSelection: true },
        // reading_time: custom (lines 64-67)
        // describe: Read-only. Estimated minutes to read, from the word count of body.
        { name: "reading_time", label: "Reading time", type: "custom", required: false, width: "1/1", compute: "readingTime" },
      ],
    },
  ],
  singletons: [
    {
      // id: settings, label: Site settings (lines 70-71)
      id: "settings",
      label: "Site settings",
      fields: [
        // site_title: text, required (lines 73-75)
        { name: "site_title", label: "Site title", type: "text", required: true, width: "1/1" },
        // description: textarea (lines 77-78)
        { name: "description", label: "Description", type: "textarea", required: false, width: "1/1" },
      ],
    },
  ],
};
