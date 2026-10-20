import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, cpSync, existsSync, mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Recreate the file layout assembled by Dockerfile COPY and actually load the
// entry-point dependencies. This catches modules present in GitHub but missing
// from /app inside the built Home Assistant add-on.
test('packaged add-on includes the full Node module dependency graph', () => {
  const sourceRoot = fileURLToPath(new URL('../', import.meta.url));
  const dockerfile = readFileSync(join(sourceRoot, 'Dockerfile'), 'utf8');
  const output = mkdtempSync(join(tmpdir(), 'emhass-docker-copy-'));
  try {
    const instructions = [...dockerfile.matchAll(/^COPY\s+(?:--[^\s]+\s+)*([^\n]+)$/gm)];
    assert.ok(instructions.length > 0, 'Dockerfile must contain COPY instructions');
    for (const [, instruction] of instructions) {
      const paths = instruction.trim().split(/\s+/);
      const destination = paths.pop();
      assert.ok(destination.startsWith('./'), 'Unexpected Dockerfile COPY destination');
      for (const relativePath of paths) {
        assert.ok(existsSync(join(sourceRoot, relativePath)), 'Missing source: ' + relativePath);
        const from = join(sourceRoot, relativePath);
        // Docker COPY directory inputs copy their contents to the destination.
        const to = statSync(from).isDirectory() ? join(output, destination) : join(output, destination, relativePath);
        cpSync(from, to, { recursive: true });
      }
    }
    assert.ok(existsSync(join(output, 'ha_stats.mjs')), 'ha_stats.mjs must be in the packaged image');
    for (const moduleFile of ['ha_actuals.mjs', 'server.mjs']) {
      execFileSync(process.execPath,
        ['--input-type=module', '-e', "await import('./" + moduleFile + "')"],
        { cwd: output, encoding: 'utf8', timeout: 5000 });
    }
  } finally {
    rmSync(output, { recursive: true, force: true });
  }
});
