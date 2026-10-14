// Bundles the harness into ./out (esbuild ships with Vite's dependencies).
import { build } from "esbuild";
import { writeFile, mkdir } from "node:fs/promises";

const here = new URL(".", import.meta.url).pathname;
await mkdir(`${here}out`, { recursive: true });
await build({
  entryPoints: [`${here}harness.js`],
  bundle: true,
  outfile: `${here}out/harness.js`,
  loader: { ".webp": "file", ".css": "empty" },
  assetNames: "[name]",
  publicPath: "./",
});
await writeFile(
  `${here}out/index.html`,
  '<!doctype html><body style="margin:0;background:#000"><canvas></canvas><script src="harness.js"></script>',
);
