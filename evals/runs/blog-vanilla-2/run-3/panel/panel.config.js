// panel.yaml restated as plain JS. Nothing reads panel.yaml at runtime.
// The login allow list lives in ../allow.mjs, never here: the browser loads this file.

export const PANEL = {
  // name: Field Notes
  name: "Field Notes",
  // auth: recipe: google-login (allow is in allow.mjs)
  auth: { recipe: "google-login" },
  // data: recipe: json-files, path: ./content (via defaults to server)
  data: { recipe: "json-files", path: "./content" },
  // files: recipe: local-disk, path: ./uploads (url defaults to /uploads)
  files: { recipe: "local-disk", path: "./uploads" },
  types: [
    {
      // types: - id: post
      id: "post",
      // label: Posts
      label: "Posts",
      // derived from label
      singular: "post",
      // status: draft, published
      status: ["draft", "published"],
      // list: title: title, subtitle: date, sort: -date, search: title
      list: { title: "title", subtitle: "date", sort: "-date", search: ["title"] },
      // behavior: Autosave drafts every 10 seconds
      autosave: { every: 10000, drafts: true },
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
        {
          // - name: body, type: markdown, required: true, width: 1/1
          name: "body",
          label: "Body",
          type: "markdown",
          required: true,
          width: "1/1",
          // behavior (field): Toolbar hidden until text is selected.
          toolbarOnSelection: true,
          // behavior (type): Show word count under the body field
          wordCount: true,
        },
        {
          // - name: reading_time, type: custom, describe: Read-only. Estimated minutes to read, from the word count of body.
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
      // singletons: - id: settings
      id: "settings",
      // label: Site settings
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
