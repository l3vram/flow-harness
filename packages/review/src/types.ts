export type RiskLevel = 'low' | 'medium' | 'high';

export interface RiskInput {
  filesChanged: string[];
  linesChanged?: number;
  touchesSecurity?: boolean;
  newFilesOnly?: boolean;
  verifyFailed?: boolean;
}

export interface RiskAssessment {
  score: number;
  level: RiskLevel;
  reviewDepth: 'light' | 'standard' | 'deep';
  recommendedTier: 'haiku' | 'sonnet' | 'opus';
  humanGate: boolean;
  reasons: string[];
}