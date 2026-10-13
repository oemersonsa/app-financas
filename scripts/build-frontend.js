import { build } from "esbuild";
import { readFile } from "node:fs/promises";
import { compileTemplate } from "vue/compiler-sfc";

// Validate Vue expressions before shipping the runtime-compiled templates.
for (const file of ["frontend/js/vue/app.js", "frontend/js/vue/components.js"]) {
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
