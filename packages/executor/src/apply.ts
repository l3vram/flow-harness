import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve, sep } from "node:path";
import type { FileChange } from "./types.js";

/**
 * Writes each change to disk under `targetDir`. Defense in depth: even though paths are already
 * validated by `isSafeRelativePath` before they reach here, this independently re-checks that
 * the resolved absolute path stays inside `targetDir` before touching the filesystem.
 */
export function applyChanges(targetDir: string, files: FileChange[]): string[] {
  const base = resolve(targetDir);
  const written: string[] = [];
  for (const file of files) {
    const abs = resolve(targetDir, file.path);
    if (abs !== base && !abs.startsWith(base + sep)) {
      throw new Error(`path escapes target: ${file.path}`);
    }
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, file.content, "utf8");
    written.push(file.path);
  }
  return written;
}
