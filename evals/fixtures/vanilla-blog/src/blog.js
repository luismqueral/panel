// The blog schema (panel/examples/blog/panel.yaml), written out as this build's own config.
// Every key below traces to a schema line, a behavior line, or a conformance check.

export const PANEL = {
  name: "Field Notes",
  types: [
    {
      id: "post",
      label: "Posts",
      singular: "post",
      status: ["draft", "published"],
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
        { name: "title", label: "Title", type: "text", required: true, width: "1/1" },
        { name: "slug", label: "Slug", type: "slug", from: "title", width: "1/2" },
        { name: "date", label: "Date", type: "date", required: true, width: "1/2" },
        { name: "cover", label: "Cover", type: "image", width: "1/2" },
        { name: "tags", label: "Tags", type: "tags", width: "1/2" },
        // behavior: Toolbar hidden until text is selected.
        { name: "body", label: "Body", type: "markdown", required: true, width: "1/1", toolbarOnSelection: true },
        // describe: Read-only. Estimated minutes to read, from the word count of body.
        { name: "reading_time", label: "Reading time", type: "custom", width: "1/1", compute: "readingTime" },
      ],
    },
  ],
  singletons: [
    {
      id: "settings",
      label: "Site settings",
      fields: [
        { name: "site_title", label: "Site title", type: "text", required: true, width: "1/1" },
        { name: "description", label: "Description", type: "textarea", width: "1/1" },
      ],
    },
  ],
};
