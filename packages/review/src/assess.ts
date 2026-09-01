import type { RiskInput, RiskAssessment } from './types.js';

const securityPattern = /auth|secret|password|token|crypt|exec|spawn/i;

export function assessRisk(input: RiskInput): RiskAssessment {
  let score = 0;
  const reasons: string[] = [];

  // Security-sensitive surface
  const hasSecurityFlag = !!input.touchesSecurity;
  const hasSecurityFile = input.filesChanged.some((f) => securityPattern.test(f));
  if (hasSecurityFlag || hasSecurityFile) {
    score += 3;
    reasons.push('Security-sensitive surface detected');
  }

  // Complexity contribution from number of files (capped at 5)
  score += Math.min(input.filesChanged.length, 5);

  // Lines changed contribution (capped at 3)
  if (typeof input.linesChanged === 'number') {
    score += Math.min(Math.floor(input.linesChanged / 100), 3);
  }

  // Verification failure
  if (input.verifyFailed) {
    score += 2;
    reasons.push('Verification failed');
  }

  // New files only reduces risk
  if (input.newFilesOnly) {
    score = Math.max(score - 1, 0);
    reasons.push('New files only, lower risk');
  }

  // Determine level
  let level: RiskAssessment['level'];
  if (score >= 6) {
    level = 'high';
  } else if (score >= 3) {
    level = 'medium';
  } else {
    level = 'low';
  }

  const reviewDepth: RiskAssessment['reviewDepth'] =
    level === 'high' ? 'deep' : level === 'medium' ? 'standard' : 'light';

  const recommendedTier: RiskAssessment['recommendedTier'] =
    level === 'high' ? 'opus' : level === 'medium' ? 'sonnet' : 'haiku';

  const humanGate = level === 'high';

  return {
    score,
    level,
    reviewDepth,
    recommendedTier,
    humanGate,
    reasons,
  };
}