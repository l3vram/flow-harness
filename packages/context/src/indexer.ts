import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import type { IndexEntry } from "./types.js";

export interface IndexOptions {
  ignore?: string[];
  maxFileBytes?: number;
}

const DEFAULT_IGNORE = ["node_modules", ".git", ".flow", "dist", "coverage", ".DS_Store"];
const DEFAULT_MAX_FILE_BYTES = 262144;

/**
 * Recursively index text files under `root` into a deterministic, sorted-by-path list.
 * Skips ignored directory/file names, oversized files, and files that look binary (contain
 * a NUL byte). No dependency on any model or network — pure filesystem walk.
 */
export function indexProject(root: string, options: IndexOptions = {}): IndexEntry[] {
  const ignore = new Set([...DEFAULT_IGNORE, ...(options.ignore ?? [])]);
  const maxFileBytes = options.maxFileBytes ?? DEFAULT_MAX_FILE_BYTES;

  const entries: IndexEntry[] = [];
  walk(root, root, ignore, maxFileBytes, entries);

  entries.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return entries;
}

function walk(
  root: string,
  dir: string,
  ignore: Set<string>,
  maxFileBytes: number,
  out: IndexEntry[],
): void {
  const dirents = readdirSync(dir, { withFileTypes: true });
  for (const dirent of dirents) {
    if (ignore.has(dirent.name)) continue;
    const fullPath = join(dir, dirent.name);

    if (dirent.isDirectory()) {
      walk(root, fullPath, ignore, maxFileBytes, out);
      continue;
    }
    if (!dirent.isFile()) continue;

    const size = statSync(fullPath).size;
    if (size > maxFileBytes) continue;

    const content = readFileSync(fullPath, "utf8");
    if (content.includes("\0")) continue; // binary — skip

    const relPath = relative(root, fullPath).split(sep).join("/");
    out.push({ path: relPath, size, content });
  }
}
