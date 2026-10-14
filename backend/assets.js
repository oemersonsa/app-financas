import { readdir } from 'node:fs/promises';
import * as platformPath from 'node:path';

// Caminhos no disco são específicos do sistema; URLs sempre usam '/'.
export function assetUrl(root, file, paths = platformPath) {
  return '/' + paths.relative(root, file).split(paths.sep).join('/');
}

export async function publicFiles(root, directory = root, result = new Map()) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = platformPath.join(directory, entry.name);
    if (entry.isDirectory()) await publicFiles(root, file, result);
    else if (/\.(html|css|js|png|webmanifest)$/.test(file)) result.set(assetUrl(root, file), file);
  }
  result.set('/', platformPath.join(root, 'index.html'));
  return result;
}
