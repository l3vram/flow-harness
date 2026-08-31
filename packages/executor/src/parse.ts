import type { FileChange } from "./types.js";

/**
 * Returns false if `p` is empty, starts with `/`, contains a backslash, or has any `/`-split
 * segment equal to `..` or `.`. This is the first line of defense against path traversal or
 * absolute-path escapes from model output; `applyChanges` adds a second, independent guard.
 */
export function isSafeRelativePath(p: string): boolean {
  if (p === "") return false;
  if (p.startsWith("/")) return false;
  if (p.includes("\\")) return false;
  const segments = p.split("/");
  for (const segment of segments) {
    if (segment === ".." || segment === ".") return false;
  }
  return true;
}

/**
 * Parses the executor's raw model text into validated file changes. Robust to surrounding prose:
 * takes the substring from the first `{` to the last `}` and parses that, since models sometimes
 * wrap JSON in commentary despite being told not to.
 */
export function parseChanges(
  text: string,
  maxFiles = 50,
): { files: FileChange[]; reason: string } {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  let raw: unknown;
  if (start === -1 || end === -1 || end < start) {
    throw new Error("executor returned no parseable JSON");
  }
  try {
    raw = JSON.parse(text.slice(start, end + 1));
  } catch {
    throw new Error("executor returned no parseable JSON");
  }

  const obj = raw as Record<string, unknown>;

  const rawFiles = obj.files;
  if (!Array.isArray(rawFiles)) {
    throw new Error("executor JSON missing files array");
  }
  if (rawFiles.length > maxFiles) {
    throw new Error(`too many files (${rawFiles.length} > ${maxFiles})`);
  }

  const files: FileChange[] = [];
  for (const entry of rawFiles) {
    const item = entry as Record<string, unknown>;
    const path = item.path;
    const content = item.content;
    if (typeof path !== "string" || path === "") {
      throw new Error(`invalid file entry: path must be a non-empty string`);
    }
    if (typeof content !== "string") {
      throw new Error(`invalid file entry: content must be a string (path: ${path})`);
    }
    if (!isSafeRelativePath(path)) {
      throw new Error(`unsafe path: ${path}`);
    }
    files.push({ path, content });
  }

  const reason = typeof obj.reason === "string" ? obj.reason : "";

  return { files, reason };
}
