// panel.yaml restated as plain JS. Nothing reads panel.yaml at runtime.
// The browser loads this file: the login allow list is in ../allow.mjs, never here.

export const PANEL = {
  // name: Field Notes
  name: "Field Notes",
  // auth: recipe: google-login (allow goes in allow.mjs)
  auth: { recipe: "google-login" },
  // data: recipe: json-files, path: ./content (via defaults to server)
  data: { recipe: "json-files", via: "server", path: "./content" },
  // files: recipe: local-disk, path: ./uploads (url defaults to /uploads)
  files: { recipe: "local-disk", path: "./uploads", url: "/uploads" },
  types: [
    {
      // types[0]: id: post, label: Posts
      id: "post",
      label: "Posts",
      singular: "post",
      // status: draft, published
      status: ["draft", "published"],
      // list: title: title, subtitle: date, sort: -date, search: [title]
      list: { title: "title", subtitle: "date", sort: "-date", search: ["title"] },
      // behavior: Autosave drafts every 10 seconds
      autosave: { every: 10000, drafts: true },
      // behavior: Show word count under the body field
      wordCount: "body",
      // behavior: Publishing asks for confirmation
      confirmPublish: true,
      // conformance: Publishing a post requires a cover image.
      publishRequires: ["cover"],
      fields: [
        // fields: title, text, required, 1/1
        { name: "title", label: "Title", type: "text", required: true, width: "1/1" },
        // fields: slug, slug, from: title, 1/2
        { name: "slug", label: "Slug", type: "slug", from: "title", required: false, width: "1/2" },
        // fields: date, date, required, 1/2
        { name: "date", label: "Date", type: "date", required: true, width: "1/2" },
        // fields: cover, image, 1/2
        { name: "cover", label: "Cover", type: "image", required: false, width: "1/2" },
        // fields: tags, tags, 1/2
        { name: "tags", label: "Tags", type: "tags", required: false, width: "1/2" },
        // fields: body, markdown, required, 1/1
        // behavior: Toolbar hidden until text is selected.
        { name: "body", label: "Body", type: "markdown", required: true, width: "1/1", toolbarOnSelection: true },
        // fields: reading_time, custom, describe: Read-only. Estimated minutes to read, from the word count of body.
        { name: "reading_time", label: "Reading time", type: "custom", required: false, width: "1/1", compute: "readingTime" },
      ],
    },
  ],
  singletons: [
    {
      // singletons[0]: id: settings, label: Site settings
      id: "settings",
      label: "Site settings",
      fields: [
        // fields: site_title, text, required
        { name: "site_title", label: "Site title", type: "text", required: true, width: "1/1" },
        // fields: description, textarea
        { name: "description", label: "Description", type: "textarea", required: false, width: "1/1" },
      ],
    },
  ],
};
