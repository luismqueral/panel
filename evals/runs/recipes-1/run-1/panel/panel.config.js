// The schema (panel.yaml) restated as plain JS. Nothing reads panel.yaml at runtime.
export const PANEL = {
  // name: Sunday Table
  name: "Sunday Table",
  // auth: password, password_env: PANEL_PASSWORD (the password itself lives only in the server's environment)
  auth: { recipe: "password", password_env: "PANEL_PASSWORD" },
  // data: json-files, path: ./content (via defaults to server); start.mjs reads this path
  data: { recipe: "json-files", via: "server", path: "content" },
  // files: local-disk, path: ./uploads, url: /uploads; start.mjs reads these
  files: { recipe: "local-disk", path: "uploads", url: "/uploads" },
  types: [
    {
      // types: id recipe, label Recipes
      id: "recipe",
      label: "Recipes",
      singular: "recipe",
      // status: idea, testing, ready, retired
      status: ["idea", "testing", "ready", "retired"],
      // list: title name, subtitle cook, sort name, search name
      list: { title: "name", subtitle: "cook", sort: "name", search: ["name"] },
      // no conformance: lines add publish requirements
      publishRequires: [],
      fields: [
        // name: text, required
        { name: "name", label: "Name", type: "text", required: true, width: "1/1" },
        // photo: image
        { name: "photo", label: "Photo", type: "image", required: false, width: "1/1" },
        // serves: number, min 1, max 100, width 1/3, help
        { name: "serves", label: "Serves", type: "number", required: false, width: "1/3", min: 1, max: 100, help: "How many people it serves." },
        // prep_time: number, label Prep time, min 0, width 1/3, help
        { name: "prep_time", label: "Prep time", type: "number", required: false, width: "1/3", min: 0, help: "In minutes." },
        // cook_time: number, label Cook time, min 0, width 1/3, help
        { name: "cook_time", label: "Cook time", type: "number", required: false, width: "1/3", min: 0, help: "In minutes." },
        // ingredients: custom, required, help; describe: rows of an amount and an ingredient (makeIngredients in panel.js)
        { name: "ingredients", label: "Ingredients", type: "custom", required: true, width: "1/1", control: "ingredients", help: "One row per ingredient. Clear a row to remove it." },
        // steps: textarea, required, help
        { name: "steps", label: "Steps", type: "textarea", required: true, width: "1/1", help: "One step per line, in order." },
        // cook: relation to cook, label From, width 1/2, help
        { name: "cook", label: "From", type: "relation", to: "cook", required: false, width: "1/2", help: "The family member this recipe comes from." },
        // favorite: toggle, default false, width 1/2, help
        { name: "favorite", label: "Favorite", type: "toggle", required: false, width: "1/2", default: false, help: "Favorites are marked on the site." },
      ],
    },
    {
      // types: id cook, label Cooks (no status)
      id: "cook",
      label: "Cooks",
      singular: "cook",
      // list: title name, sort name, search name
      list: { title: "name", sort: "name", search: ["name"] },
      publishRequires: [],
      fields: [
        // name: text, required
        { name: "name", label: "Name", type: "text", required: true, width: "1/1" },
        // photo: image, width 1/3
        { name: "photo", label: "Photo", type: "image", required: false, width: "1/3" },
        // bio: textarea, width 2/3, help
        { name: "bio", label: "Bio", type: "textarea", required: false, width: "2/3", help: "A few sentences." },
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
        { name: "body", label: "Body", type: "markdown", required: false, width: "1/1" },
      ],
    },
  ],
};
