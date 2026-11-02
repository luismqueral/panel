// panel.yaml restated. Nothing reads panel.yaml at runtime.
// The login allow list is in ../allow.mjs, never here: the browser loads this file.

export const PANEL = {
  // name: Field Notes
  name: "Field Notes",
  // auth: recipe: google-login
  auth: { recipe: "google-login" },
  // data: recipe: json-files, path: ./content (via defaults to server)
  data: { recipe: "json-files", path: "./content", via: "server" },
  // files: recipe: local-disk, path: ./uploads (url defaults to /uploads)
  files: { recipe: "local-disk", path: "./uploads" },
  types: [
    {
      // types: - id: post
      id: "post",
      // label: Posts
      label: "Posts",
      // derived from label: Posts
      singular: "post",
      // status: draft, published
      status: ["draft", "published"],
      // list: title: title, subtitle: date, sort: -date, search: title
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
        { name: "slug", label: "Slug", type: "slug", from: "title", required: false, width: "1/2" },
        // - name: date, type: date, required: true, width: 1/2
        { name: "date", label: "Date", type: "date", required: true, width: "1/2" },
        // - name: cover, type: image, width: 1/2
        { name: "cover", label: "Cover", type: "image", required: false, width: "1/2" },
        // - name: tags, type: tags, width: 1/2
        { name: "tags", label: "Tags", type: "tags", required: false, width: "1/2" },
        // - name: body, type: markdown, required: true, width: 1/1
        {
          name: "body",
          label: "Body",
          type: "markdown",
          required: true,
          width: "1/1",
          // behavior: Toolbar hidden until text is selected.
          toolbarOnSelection: true,
        },
        // - name: reading_time, type: custom
        //   describe: Read-only. Estimated minutes to read, from the word count of body.
        { name: "reading_time", label: "Reading time", type: "custom", required: false, width: "1/1", compute: "readingTime" },
      ],
    },
  ],
  singletons: [
    {
      // singletons: - id: settings
      id: "settings",
      // label: Site settings
      label: "Site settings",
      fields: [
        // - name: site_title, type: text, required: true
        { name: "site_title", label: "Site title", type: "text", required: true, width: "1/1" },
        // - name: description, type: textarea
        { name: "description", label: "Description", type: "textarea", required: false, width: "1/1" },
      ],
    },
  ],
};
