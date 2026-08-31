import { tokenize } from "@flow/context";
import type { Lesson } from "./types.js";

export function searchLessons(lessons: Lesson[], query: string, k = 5): Lesson[] {
  const terms = tokenize(query);
  if (terms.length === 0) {
    return [];
  }

  const scored: { lesson: Lesson; score: number }[] = [];

  for (const lesson of lessons) {
    const combined = (lesson.content + " " + lesson.tags.join(" ")).toLowerCase();
    let score = 0;
    for (const term of terms) {
      const lowered = term.toLowerCase();
      if (lowered === "") continue;
      // count occurrences of term in combined string
      const parts = combined.split(lowered);
      score += parts.length - 1;
    }
    if (score > 0) {
      scored.push({ lesson, score });
    }
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score; // descending score
    }
    return a.lesson.id < b.lesson.id ? -1 : a.lesson.id > b.lesson.id ? 1 : 0; // asc id
  });

  return scored.slice(0, k).map((s) => s.lesson);
}