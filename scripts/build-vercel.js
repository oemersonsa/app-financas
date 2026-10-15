import './build-frontend.js';
import { mkdir, writeFile } from 'node:fs/promises';
// Keep frontend files inside the Function, where the existing access checks run.
// The static output contains no financial pages or credentials.
await mkdir('vercel-public', { recursive: true });
await writeFile('vercel-public/.gitkeep', '');
