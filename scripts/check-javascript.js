import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

function filesUnder(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? filesUnder(join(directory, entry.name))
      : [join(directory, entry.name)],
  );
}
const files = ["server.js", ...filesUnder("backend"), ...filesUnder("frontend/js")].filter((name) => name.endsWith(".js"));
const graph = new Map();
for (const file of files) {
  const result = spawnSync(process.execPath, ["--check", file], {
    stdio: "inherit",
  });
  if (result.status !== 0) process.exit(result.status || 1);
  const imports = [
    ...readFileSync(file, "utf8").matchAll(/from\s+["']([^"']+)["']/g),
  ].filter(match => match[1].startsWith(".")).map((match) => resolve(dirname(file), match[1]));
  for (const imported of imports) {
    readFileSync(imported);
    if (
      file.includes("/domain/") &&
      /\/(ui|controllers|services)\/|\/core\/state\.js$/.test(imported)
    ) {
      throw new Error(
        `Regra financeira depende da interface ou persistência: ${file}`,
      );
    }
  }
  graph.set(resolve(file), imports);
}
const visiting = new Set(),
  visited = new Set();
function visit(file) {
  if (visiting.has(file)) throw new Error(`Dependência circular: ${file}`);
  if (visited.has(file)) return;
  visiting.add(file);
  for (const imported of graph.get(file) || []) visit(imported);
  visiting.delete(file);
  visited.add(file);
}
for (const file of graph.keys()) visit(file);
console.log(
  `${files.length} módulos: sintaxe, importações, regras isoladas e dependências verificadas.`,
);
