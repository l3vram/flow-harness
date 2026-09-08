#!/usr/bin/env node
// Bundle the MCP stdio server into one self-contained file, so it can run from
// an `npx github:l3vram/flow-harness flow-mcp` install where npm does NOT link
// the @flow/* workspaces or hoist @modelcontextprotocol/sdk into the nested dep.
// We bundle the whole @flow graph + the MCP SDK; only node built-ins and the
// optional Playwright web-E2E driver (loaded via a non-literal dynamic import)
// stay external.
import { build } from 'esbuild';
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const entry = resolve(root, 'packages/mcp-server/dist/stdio.js');
const outfile = resolve(root, 'bin/flow-mcp.mjs');
const SHEBANG = '#!/usr/bin/env node';

// The version is injected into the bundle so `flow-mcp --version`/`doctor` can report it
// without reading package.json at runtime (it is not shipped next to the bundle).
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));

mkdirSync(dirname(outfile), { recursive: true });

await build({
  entryPoints: [entry],
  outfile,
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  define: { __FLOW_VERSION__: JSON.stringify(pkg.version) },
  // Optional web-E2E dependency — kept external so a run without it still starts.
  external: ['playwright', 'playwright-core'],
  logLevel: 'info',
});

// Guarantee exactly one leading shebang, independent of esbuild's own handling.
let code = readFileSync(outfile, 'utf8');
while (code.startsWith('#!')) code = code.slice(code.indexOf('\n') + 1);
writeFileSync(outfile, `${SHEBANG}\n${code}`);
chmodSync(outfile, 0o755);
console.log(`bundled -> ${outfile}`);