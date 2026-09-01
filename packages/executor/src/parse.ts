import type { Change } from "./types.js";

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

const FILE_START_RE = /^<<<FILE\s+(.+?)>>>\s*$/;
const EDIT_START_RE = /^<<<EDIT\s+(.+?)>>>\s*$/;
const SEARCH_RE = /^<<<SEARCH>>>\s*$/;
const REPLACE_RE = /^<<<REPLACE>>>\s*$/;
const END_RE = /^<<<END>>>\s*$/;
const REASON_RE = /^<<<REASON>>>\s?(.*)$/;

/**
 * Parses the executor's raw model text into validated changes. The model is instructed to emit
 * one marker-delimited block per change — `<<<FILE path>>>` ... `<<<END>>>` to create/overwrite a
 * file, or `<<<EDIT path>>>` / `<<<SEARCH>>>` / `<<<REPLACE>>>` / `<<<END>>>` to safely edit an
 * existing file — which needs no escaping of file content, followed by an optional
 * `<<<REASON>>> ...` line. This avoids the fragility of asking the model to produce valid JSON
 * containing arbitrary multi-line content.
 */
export function parseChanges(text: string, maxFiles = 50): { changes: Change[]; reason: string } {
  const lines = text.split("\n");
  const changes: Change[] = [];
  let reason = "";

  let i = 0;
  while (i < lines.length) {
    const line = lines[i] ?? "";
    const fileStartMatch = FILE_START_RE.exec(line);
    if (fileStartMatch) {
      const path = (fileStartMatch[1] ?? "").trim();
      const contentLines: string[] = [];
      let j = i + 1;
      let closed = false;
      while (j < lines.length) {
        const candidate = lines[j] ?? "";
        if (END_RE.test(candidate)) {
          closed = true;
          break;
        }
        contentLines.push(candidate);
        j++;
      }
      if (closed) {
        changes.push({ kind: "write", path, content: contentLines.join("\n") });
        i = j + 1;
        continue;
      } else {
        // Unterminated block at end of input: ignore this trailing partial block.
        break;
      }
    }

    const editStartMatch = EDIT_START_RE.exec(line);
    if (editStartMatch) {
      const path = (editStartMatch[1] ?? "").trim();
      let j = i + 1;

      const searchMarkerLine = lines[j] ?? "";
      if (!SEARCH_RE.test(searchMarkerLine)) {
        throw new Error(`malformed EDIT block for ${path}`);
      }
      j++;

      const searchLines: string[] = [];
      let foundReplace = false;
      while (j < lines.length) {
        const candidate = lines[j] ?? "";
        if (REPLACE_RE.test(candidate)) {
          foundReplace = true;
          break;
        }
        searchLines.push(candidate);
        j++;
      }
      if (!foundReplace) {
        throw new Error(`malformed EDIT block for ${path}`);
      }
      j++;

      const replaceLines: string[] = [];
      let foundEnd = false;
      while (j < lines.length) {
        const candidate = lines[j] ?? "";
        if (END_RE.test(candidate)) {
          foundEnd = true;
          break;
        }
        replaceLines.push(candidate);
        j++;
      }
      if (!foundEnd) {
        throw new Error(`malformed EDIT block for ${path}`);
      }

      changes.push({
        kind: "edit",
        path,
        search: searchLines.join("\n"),
        replace: replaceLines.join("\n"),
      });
      i = j + 1;
      continue;
    }

    const reasonMatch = REASON_RE.exec(line);
    if (reasonMatch) {
      reason = (reasonMatch[1] ?? "").trim();
    }

    i++;
  }

  if (changes.length === 0) {
    throw new Error("executor returned no file blocks");
  }
  if (changes.length > maxFiles) {
    throw new Error(`too many files (${changes.length} > ${maxFiles})`);
  }
  for (const change of changes) {
    if (!isSafeRelativePath(change.path)) {
      throw new Error(`unsafe path: ${change.path}`);
    }
  }

  return { changes, reason };
}
