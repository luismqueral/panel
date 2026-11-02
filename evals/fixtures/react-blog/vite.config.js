import { readFileSync } from "node:fs";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const sprite = readFileSync(new URL("../../../panel/design-system/icons.svg", import.meta.url), "utf8").trim();

export default defineConfig({
  plugins: [react(), { name: "panel-sprite", transformIndexHtml: (html) => html.replace("<!-- panel:sprite -->", sprite) }],
  base: "./",
  build: { target: "es2022" },
});
