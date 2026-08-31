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

const FILE_START_RE = /^<<<FILE\s+(.+?)>>>\s*$/;
const FILE_END_RE = /^<<<END>>>\s*$/;
const REASON_RE = /^<<<REASON>>>\s?(.*)$/;

/**
 * Parses the executor's raw model text into validated file changes. The model is instructed to
 * emit one marker-delimited block per file (`<<<FILE path>>>` ... `<<<END>>>`), which needs no
 * escaping of file content, followed by an optional `<<<REASON>>> ...` line. This avoids the
 * fragility of asking the model to produce valid JSON containing arbitrary multi-line content.
 */
export function parseChanges(
  text: string,
  maxFiles = 50,
): { files: FileChange[]; reason: string } {
  const lines = text.split("\n");
  const files: FileChange[] = [];
  let reason = "";

  let i = 0;
  while (i < lines.length) {
    const line = lines[i] ?? "";
    const startMatch = FILE_START_RE.exec(line);
    if (startMatch) {
      const path = (startMatch[1] ?? "").trim();
      const contentLines: string[] = [];
      let j = i + 1;
      let closed = false;
      while (j < lines.length) {
        const candidate = lines[j] ?? "";
        if (FILE_END_RE.test(candidate)) {
          closed = true;
          break;
        }
        contentLines.push(candidate);
        j++;
      }
      if (closed) {
        files.push({ path, content: contentLines.join("\n") });
        i = j + 1;
        continue;
      } else {
        // Unterminated block at end of input: ignore this trailing partial block.
        break;
      }
    }

    const reasonMatch = REASON_RE.exec(line);
    if (reasonMatch) {
      reason = (reasonMatch[1] ?? "").trim();
    }

    i++;
  }

  if (files.length === 0) {
    throw new Error("executor returned no file blocks");
  }
  if (files.length > maxFiles) {
    throw new Error(`too many files (${files.length} > ${maxFiles})`);
  }
  for (const file of files) {
    if (!isSafeRelativePath(file.path)) {
      throw new Error(`unsafe path: ${file.path}`);
    }
  }

  return { files, reason };
}
