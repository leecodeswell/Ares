import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  // Keep the production bundle portable to a domain root or a repository path.
  base: "./",
  build: {
    rollupOptions: {
      // The site, plus one home page per design direction in the showcase.
      input: {
        main: resolve(import.meta.dirname, "index.html"),
        bakery: resolve(import.meta.dirname, "examples/bakery.html"),
        estate: resolve(import.meta.dirname, "examples/estate.html"),
        counsel: resolve(import.meta.dirname, "examples/counsel.html"),
      },
    },
  },
});
