import { start } from "./app.js";
import { createMemoryAdapters } from "./adapters/memory.js";

const seed = await (await fetch("./seed.json")).json();
start(createMemoryAdapters(seed));
