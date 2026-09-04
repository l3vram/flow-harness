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
 *
 * Application is ATOMIC: every change is validated and folded into an in-memory copy first (edits
 * apply against the running copy, so multiple edits to one file compose in order), and nothing is
 * written to disk unless the whole batch is valid. A failure therefore never leaves a partial batch.
 */
export function applyChanges(targetDir: string, changes: Change[]): string[] {
  const base = resolve(targetDir);
  // Pass 1 — validate and fold every change into an in-memory working copy. Writes nothing.
  const pending = new Map<string, string>(); // abs path -> final content
  const order: { abs: string; path: string }[] = [];
  const note = (abs: string, path: string): void => {
    if (!order.some((o) => o.abs === abs)) order.push({ abs, path });
  };
  const currentOf = (abs: string): string | undefined =>
    pending.has(abs) ? pending.get(abs) : existsSync(abs) ? readFileSync(abs, "utf8") : undefined;

  for (const change of changes) {
    const abs = resolve(targetDir, change.path);
    if (abs !== base && !abs.startsWith(base + sep)) {
      throw new Error(`path escapes target: ${change.path}`);
    }

    if (change.kind === "write") {
      pending.set(abs, change.content);
      note(abs, change.path);
    } else {
      const current = currentOf(abs);
      if (current === undefined) {
        throw new Error(`cannot edit missing file: ${change.path}`);
      }
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
      pending.set(abs, updated);
      note(abs, change.path);
    }
  }

  // Pass 2 — the whole batch validated; write it.
  for (const { abs } of order) {
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, pending.get(abs) as string, "utf8");
  }
  return order.map((o) => o.path);
}
