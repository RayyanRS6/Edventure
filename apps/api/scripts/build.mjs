// Bundles the API server and worker for deployment. Workspace packages (@edventure/*) are bundled
// from source; npm dependencies stay external and are installed with `npm ci --omit=dev`.
import fs from 'node:fs';
import { build } from 'esbuild';

const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const external = Object.keys(pkg.dependencies).filter((d) => !d.startsWith('@edventure/'));

await build({
  entryPoints: { server: 'src/server.ts', worker: 'src/worker.ts' },
  outdir: 'dist',
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  sourcemap: true,
  external: [...external, ...external.map((d) => `${d}/*`)],
  banner: { js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);" },
});
console.log('Built dist/server.js and dist/worker.js');
