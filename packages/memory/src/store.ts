import { mkdirSync, appendFileSync, readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Lesson } from "./types.js";

export class MemoryStore {
  private readonly filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
    const parent = dirname(filePath);
    mkdirSync(parent, { recursive: true });
  }

  add(lesson: Lesson): void {
    const line = JSON.stringify(lesson) + "\n";
    appendFileSync(this.filePath, line, { encoding: "utf8" });
  }

  all(): Lesson[] {
    if (!existsSync(this.filePath)) {
      return [];
    }
    const content = readFileSync(this.filePath, { encoding: "utf8" });
    const lines = content.split("\n");
    const lessons: Lesson[] = [];
    for (const line of lines) {
      if (line.trim() === "") continue;
      lessons.push(JSON.parse(line) as Lesson);
    }
    return lessons;
  }
}