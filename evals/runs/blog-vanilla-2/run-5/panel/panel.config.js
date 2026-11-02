// The schema (../panel.yaml) restated as plain JS. Nothing reads panel.yaml at runtime.
// The login allow list is not here: the browser loads this file. It lives in ../allow.mjs.

export const PANEL = {
  // name: Field Notes
  name: "Field Notes",

  // auth: recipe: google-login (allow: see ../allow.mjs)
  auth: { recipe: "google-login" },

  // data: recipe: json-files, path: ./content (via: default server)
  data: { recipe: "json-files", path: "./content", via: "server" },

  // files: recipe: local-disk, path: ./uploads (url: default /uploads)
  files: { recipe: "local-disk", path: "./uploads", url: "/uploads" },

  types: [
    {
      // types[0].id: post
      id: "post",
      // types[0].label: Posts
      label: "Posts",
      // derived from label "Posts"
      singular: "post",
      // types[0].status: draft, published
      status: ["draft", "published"],
      // types[0].list: title: title, subtitle: date, sort: -date, search: [title]
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
        // fields[0]: name: title, type: text, required: true, width: 1/1
        { name: "title", label: "Title", type: "text", required: true, width: "1/1" },
        // fields[1]: name: slug, type: slug, from: title, width: 1/2
        { name: "slug", label: "Slug", type: "slug", from: "title", required: false, width: "1/2" },
        // fields[2]: name: date, type: date, required: true, width: 1/2
        { name: "date", label: "Date", type: "date", required: true, width: "1/2" },
        // fields[3]: name: cover, type: image, width: 1/2
        { name: "cover", label: "Cover", type: "image", required: false, width: "1/2" },
        // fields[4]: name: tags, type: tags, width: 1/2
        { name: "tags", label: "Tags", type: "tags", required: false, width: "1/2" },
        // fields[5]: name: body, type: markdown, required: true, width: 1/1
        // behavior: Toolbar hidden until text is selected.
        { name: "body", label: "Body", type: "markdown", required: true, width: "1/1", toolbarOnSelection: true },
        // fields[6]: name: reading_time, type: custom (width: default 1/1)
        // describe: Read-only. Estimated minutes to read, from the word count of body.
        { name: "reading_time", label: "Reading time", type: "custom", required: false, width: "1/1", compute: "readingTime" },
      ],
    },
  ],

  singletons: [
    {
      // singletons[0].id: settings
      id: "settings",
      // singletons[0].label: Site settings
      label: "Site settings",
      fields: [
        // fields[0]: name: site_title, type: text, required: true (width: default 1/1)
        { name: "site_title", label: "Site title", type: "text", required: true, width: "1/1" },
        // fields[1]: name: description, type: textarea (width: default 1/1)
        { name: "description", label: "Description", type: "textarea", required: false, width: "1/1" },
      ],
    },
  ],
};
