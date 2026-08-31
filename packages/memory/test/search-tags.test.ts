import { describe, it, expect } from 'vitest';
import { searchLessons, type Lesson } from '../src/index.js';

describe('searchLessons tag filtering', () => {
  const lessonWithDocker: Lesson = {
    id: '1',
    scope: 'devops',
    content: 'Learn about containerization and orchestration.',
    tags: ['docker', 'kubernetes'],
    createdAt: '2026-01-01T00:00:00Z',
  };

  const lessonWithoutDocker1: Lesson = {
    id: '2',
    scope: 'frontend',
    content: 'Understanding React hooks and state management.',
    tags: ['react', 'hooks'],
    createdAt: '2026-01-01T00:00:00Z',
  };

  const lessonWithoutDocker2: Lesson = {
    id: '3',
    scope: 'backend',
    content: 'Building REST APIs with Node.js and Express.',
    tags: ['nodejs', 'express'],
    createdAt: '2026-01-01T00:00:00Z',
  };

  const lessons: Lesson[] = [lessonWithDocker, lessonWithoutDocker1, lessonWithoutDocker2];

  it('returns the lesson with the matching tag as the first result', () => {
    const results = searchLessons(lessons, 'docker');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].id).toBe(lessonWithDocker.id);
  });

  it('returns an empty array when there is no match', () => {
    const results = searchLessons(lessons, 'zznomatchzz');
    expect(results).toEqual([]);
  });
});