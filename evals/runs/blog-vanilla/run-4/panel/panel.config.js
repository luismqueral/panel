// The schema (panel.yaml) restated as plain JS. Nothing reads panel.yaml at runtime.
// Each key names the schema line it comes from.

export const PANEL = {
  // name: Field Notes
  name: "Field Notes",

  // auth: recipe: google-login, allow: [me@example.com]
  auth: { recipe: "google-login", allow: ["me@example.com"] },

  // data: recipe: json-files, path: ./content
  data: { recipe: "json-files", path: "./content" },

  // files: recipe: local-disk, path: ./uploads
  files: { recipe: "local-disk", path: "./uploads" },

  types: [
    {
      // types[0].id: post, label: Posts
      id: "post",
      label: "Posts",
      singular: "post",
      // types[0].notes: Long-form writing. The editor should feel like a quiet page, not a form.
      notes: "Long-form writing. The editor should feel like a quiet page, not a form.",
      // types[0].status: [draft, published]
      status: ["draft", "published"],
      // types[0].list: title: title, subtitle: date, sort: -date, search: [title]
      list: { title: "title", subtitle: "date", sort: "-date", search: ["title"] },
      // behavior: Autosave drafts every 10 seconds
      autosave: { every: 10000, drafts: true },
      // behavior: Show word count under the body field
      wordCount: { field: "body" },
      // behavior: Publishing asks for confirmation
      confirmPublish: true,
      // conformance: Publishing a post requires a cover image.
      publishRequires: ["cover"],
      fields: [
        // fields.title: type: text, required: true, width: 1/1
        { name: "title", label: "Title", type: "text", required: true, width: "1/1" },
        // fields.slug: type: slug, from: title, width: 1/2
        { name: "slug", label: "Slug", type: "slug", from: "title", width: "1/2" },
        // fields.date: type: date, required: true, width: 1/2
        { name: "date", label: "Date", type: "date", required: true, width: "1/2" },
        // fields.cover: type: image, width: 1/2
        { name: "cover", label: "Cover", type: "image", width: "1/2" },
        // fields.tags: type: tags, width: 1/2
        { name: "tags", label: "Tags", type: "tags", width: "1/2" },
        // fields.body: type: markdown, required: true, width: 1/1
        // behavior: Toolbar hidden until text is selected.
        { name: "body", label: "Body", type: "markdown", required: true, width: "1/1", toolbarOnSelection: true },
        // fields.reading_time: type: custom, x-priority: low (ignored)
        // describe: Read-only. Estimated minutes to read, from the word count of body.
        {
          name: "reading_time",
          label: "Reading time",
          type: "custom",
          width: "1/1",
          describe: "Read-only. Estimated minutes to read, from the word count of body.",
          compute: "readingTime",
        },
      ],
    },
  ],

  singletons: [
    {
      // singletons[0].id: settings, label: Site settings
      id: "settings",
      label: "Site settings",
      fields: [
        // fields.site_title: type: text, required: true
        { name: "site_title", label: "Site title", type: "text", required: true, width: "1/1" },
        // fields.description: type: textarea
        { name: "description", label: "Description", type: "textarea", width: "1/1" },
      ],
    },
  ],
};
