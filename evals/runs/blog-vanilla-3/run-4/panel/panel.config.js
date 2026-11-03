// panel.yaml restated as plain JS (build.md step 2). Nothing reads panel.yaml at runtime.
export const PANEL = {
  // name: Field Notes
  name: "Field Notes",
  // auth: recipe: google-login (the allow list goes in allow.mjs, not here)
  auth: { recipe: "google-login" },
  // data: recipe: json-files, path: ./content (via: server is the recipe default, and the intake's choice)
  data: { recipe: "json-files", via: "server", path: "./content" },
  // files: recipe: local-disk, path: ./uploads (url: the recipe default, /uploads)
  files: { recipe: "local-disk", path: "./uploads", url: "/uploads" },
  types: [
    {
      // types: - id: post, label: Posts
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
        // - name: title, type: text, required: true, width: 1/1
        { name: "title", label: "Title", type: "text", required: true, width: "1/1" },
        // - name: slug, type: slug, from: title, width: 1/2
        { name: "slug", label: "Slug", type: "slug", from: "title", width: "1/2" },
        // - name: date, type: date, required: true, width: 1/2
        { name: "date", label: "Date", type: "date", required: true, width: "1/2" },
        // - name: cover, type: image, width: 1/2
        { name: "cover", label: "Cover", type: "image", width: "1/2" },
        // - name: tags, type: tags, width: 1/2
        { name: "tags", label: "Tags", type: "tags", width: "1/2" },
        // - name: body, type: markdown, required: true, width: 1/1
        // behavior: Toolbar hidden until text is selected.
        { name: "body", label: "Body", type: "markdown", required: true, width: "1/1", toolbarOnSelection: true },
        // - name: reading_time, type: custom, describe: Read-only. Estimated minutes to read, from the word count of body.
        { name: "reading_time", label: "Reading time", type: "custom", width: "1/1", compute: "readingTime" },
      ],
    },
  ],
  singletons: [
    {
      // singletons: - id: settings, label: Site settings
      id: "settings",
      label: "Site settings",
      fields: [
        // - name: site_title, type: text, required: true
        { name: "site_title", label: "Site title", type: "text", required: true, width: "1/1" },
        // - name: description, type: textarea
        { name: "description", label: "Description", type: "textarea", width: "1/1" },
      ],
    },
  ],
};
