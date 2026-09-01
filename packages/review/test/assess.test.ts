import { describe, it, expect } from 'vitest';
import assessRisk from '../src/index.js';

describe('assessRisk', () => {
  it('returns low risk for a new file only', () => {
    const result = assessRisk({
      filesChanged: ['newFile.txt'],
      newFilesOnly: true,
    });
    expect(result).toMatchObject({
      level: 'low',
      reviewDepth: 'light',
      recommendedTier: 'haiku',
      humanGate: false,
    });
  });

  it('returns high risk when security and verification fail', () => {
    const result = assessRisk({
      filesChanged: ['auth.js'],
      touchesSecurity: true,
      verifyFailed: true,
    });
    expect(result).toMatchObject({
      level: 'high',
      reviewDepth: 'deep',
      recommendedTier: 'opus',
      humanGate: true,
    });
  });

  it('returns medium risk for three unchanged files', () => {
    const result = assessRisk({
      filesChanged: ['a.js', 'b.js', 'c.js'],
    });
    expect(result).toMatchObject({
      level: 'medium',
      reviewDepth: 'standard',
      recommendedTier: 'sonnet',
      humanGate: false,
    });
  });
});