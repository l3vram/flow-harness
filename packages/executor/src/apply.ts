import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve, sep } from "node:path";
import type { Change } from "./types.js";

/** Counts non-overlapping occurrences of `needle` in `haystack`. */
function countOccurrences(haystack: string, needle: string): number {
  if (needle === "") return 0;
  let count = 0;
  let from = 0;
  for (;;) {
    const idx = haystack.indexOf(needle, from);
    if (idx === -1) break;
    count++;
    from = idx + needle.length;
  }
  return count;
}

/**
 * Applies each change to disk under `targetDir`. Defense in depth: even though paths are already
 * validated by `isSafeRelativePath` before they reach here, this independently re-checks that
 * the resolved absolute path stays inside `targetDir` before touching the filesystem.
 *
 * `write` changes create or overwrite a file wholesale. `edit` changes require the target file to
 * already exist and require the `search` text to occur exactly once in its current content — this
 * is the safety rule: never guess which occurrence to replace.
 */
export function applyChanges(targetDir: string, changes: Change[]): string[] {
  const base = resolve(targetDir);
  const written: string[] = [];
  for (const change of changes) {
    const abs = resolve(targetDir, change.path);
    if (abs !== base && !abs.startsWith(base + sep)) {
      throw new Error(`path escapes target: ${change.path}`);
    }

    if (change.kind === "write") {
      mkdirSync(dirname(abs), { recursive: true });
      writeFileSync(abs, change.content, "utf8");
    } else {
      if (!existsSync(abs)) {
        throw new Error(`cannot edit missing file: ${change.path}`);
      }
      const current = readFileSync(abs, "utf8");
      const occurrences = countOccurrences(current, change.search);
      if (occurrences === 0) {
        throw new Error(`search text not found in ${change.path}`);
      }
      if (occurrences > 1) {
        throw new Error(`search text is not unique in ${change.path}`);
      }
      const idx = current.indexOf(change.search);
      const updated =
        current.slice(0, idx) + change.replace + current.slice(idx + change.search.length);
      writeFileSync(abs, updated, "utf8");
    }

    written.push(change.path);
  }
  return [...new Set(written)];
}
