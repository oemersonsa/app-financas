import { build } from "esbuild";
import { createHash } from "node:crypto";
import { pwaAssets } from "../backend/pwa.js";
import { readFile, writeFile, readdir } from "node:fs/promises";
import { compileTemplate } from "vue/compiler-sfc";

// Validate Vue expressions before shipping the runtime-compiled templates.
async function componentFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map(entry => entry.isDirectory()
    ? componentFiles(`${directory}/${entry.name}`)
    : entry.name.endsWith('.js') ? [`${directory}/${entry.name}`] : []))).flat();
}
for (const file of await componentFiles("frontend/js/vue")) {
  const source = await readFile(file, "utf8");
  for (const [index, match] of [...source.matchAll(/template:\s*`([\s\S]*?)`/g)].entries()) {
    const result = compileTemplate({ source: match[1], filename: file, id: `${file}-${index}` });
    if (result.errors.length) {
      throw new Error(`${file}: ${result.errors.map(error => error.message || error).join("\n")}`);
    }
  }
}
await build({
  entryPoints: ["frontend/js/app.js"],
  bundle: true,
  minify: true,
  outfile: "frontend/build/app.js",
  format: "esm",
  alias: { vue: "vue/dist/vue.esm-bundler.js" },
  define: {
    "process.env.NODE_ENV": '"production"',
    __VUE_OPTIONS_API__: "true",
    __VUE_PROD_DEVTOOLS__: "false",
    __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: "false",
  },
});

// A content-based version refreshes the public offline cache on each relevant release.
const template = await readFile("scripts/service-worker.js", "utf8");
const version = createHash("sha256").update(template);
for (const path of pwaAssets) version.update(await readFile(`frontend${path}`));
const worker = template.replace("__VERSION__", version.digest("hex").slice(0, 16)).replace("__ASSETS__", JSON.stringify(pwaAssets));
await writeFile("frontend/sw.js", worker);
