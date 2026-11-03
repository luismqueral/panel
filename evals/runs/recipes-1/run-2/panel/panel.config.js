export const PANEL = {
  // name: Sunday Table
  name: "Sunday Table",
  // auth: password. No password_env, so the server reads PANEL_PASSWORD
  auth: { recipe: "password" },
  // data: json-files, path ./content (via defaults to server); start.mjs reads these paths
  data: { recipe: "json-files", via: "server", path: "content" },
  // files: local-disk, path ./uploads, url /uploads
  files: { recipe: "local-disk", path: "uploads", url: "/uploads" },
  types: [
    {
      // types: id recipe, label Recipes
      id: "recipe",
      label: "Recipes",
      singular: "recipe",
      // status: idea, testing, ready, retired
      status: ["idea", "testing", "ready", "retired"],
      // list: title name, subtitle cook, search name and ingredients (no sort: rows sort by title)
      list: { title: "name", subtitle: "cook", search: ["name", "ingredients"] },
      fields: [
        // name: text, required, width 2/3
        { name: "name", label: "Name", type: "text", required: true, width: "2/3" },
        // favorite: toggle, default false, width 1/3
        { name: "favorite", label: "Favorite", type: "toggle", default: false, width: "1/3", help: "Mark a few family favorites." },
        // photo: image, width 1/2
        { name: "photo", label: "Photo", type: "image", width: "1/2" },
        // cook: relation to cook, label "Comes from", width 1/2
        { name: "cook", label: "Comes from", type: "relation", to: "cook", width: "1/2", help: "The family member this recipe comes from." },
        // serves: number, min 1, width 1/3
        { name: "serves", label: "Serves", type: "number", min: 1, width: "1/3", help: "Number of people." },
        // prep_time: number, min 0, width 1/3
        { name: "prep_time", label: "Prep time", type: "number", min: 0, width: "1/3", help: "In minutes." },
        // cook_time: number, min 0, width 1/3
        { name: "cook_time", label: "Cook time", type: "number", min: 0, width: "1/3", help: "In minutes." },
        // ingredients: textarea, required
        { name: "ingredients", label: "Ingredients", type: "textarea", required: true, width: "1/1", help: 'One per line, amount first, like "2 cups flour".' },
        // steps: markdown, required
        { name: "steps", label: "Steps", type: "markdown", required: true, width: "1/1", help: "A numbered list, one step per line." },
      ],
    },
    {
      // types: id cook, label Cooks, no status
      id: "cook",
      label: "Cooks",
      singular: "cook",
      // list: title name, search name
      list: { title: "name", search: ["name"] },
      fields: [
        // name: text, required
        { name: "name", label: "Name", type: "text", required: true, width: "1/1" },
        // photo: image, width 1/3
        { name: "photo", label: "Photo", type: "image", width: "1/3" },
        // bio: textarea, width 2/3
        { name: "bio", label: "Bio", type: "textarea", width: "2/3", help: "A sentence or two." },
      ],
    },
  ],
  singletons: [
    {
      // singletons: id about, label About
      id: "about",
      label: "About",
      fields: [
        // title: text, required
        { name: "title", label: "Title", type: "text", required: true, width: "1/1" },
        // body: markdown
        { name: "body", label: "Body", type: "markdown", width: "1/1" },
      ],
    },
  ],
};
