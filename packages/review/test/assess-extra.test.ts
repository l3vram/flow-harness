import { describe, it, expect } from 'vitest';
import assessRisk from '../src/index.js';

describe('assessRisk extra test', () => {
  it('should return medium level for one file change and verify failure', () => {
    const result = assessRisk({ filesChanged: ['a.ts'], verifyFailed: true });
    expect(result.level).toBe('medium');
  });
});