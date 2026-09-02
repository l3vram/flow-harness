import { spawnSync } from 'node:child_process';
import type { WorktreeInfo } from './types.js';

function run(dir: string, args: string[]) {
  return spawnSync('git', ['-C', dir, ...args], { encoding: 'utf8' });
}

export function isGitRepo(dir: string): boolean {
  const result = run(dir, ['rev-parse', '--is-inside-work-tree']);
  return result.status === 0;
}

export function currentBranch(dir: string): string {
  const result = run(dir, ['rev-parse', '--abbrev-ref', 'HEAD']);
  return result.stdout?.trim() ?? '';
}

export function createWorktree(repoDir: string, worktreePath: string, branch: string): WorktreeInfo {
  const result = run(repoDir, ['worktree', 'add', worktreePath, '-b', branch]);
  if (result.status !== 0) {
    throw new Error(`git worktree add failed: ${result.stderr}`);
  }
  return { path: worktreePath, branch };
}

export function removeWorktree(repoDir: string, worktreePath: string): void {
  run(repoDir, ['worktree', 'remove', worktreePath, '--force']);
}

export function commitAll(worktreePath: string, message: string): boolean {
  run(worktreePath, ['add', '-A']);
  const commit = run(worktreePath, ['commit', '-m', message]);
  return commit.status === 0;
}

export function changedFiles(worktreePath: string): string[] {
  const result = run(worktreePath, ['status', '--porcelain']);
  if (result.status !== 0) {
    return [];
  }
  const lines = result.stdout.split('\n').filter(line => line.trim() !== '');
  return lines.map(line => line.slice(3).trim());
}