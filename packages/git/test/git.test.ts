import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  isGitRepo,
  currentBranch,
  createWorktree,
  removeWorktree,
  commitAll,
  changedFiles,
} from '../src/index.js';

describe('git wrapper', () => {
  const repoDir = mkdtempSync(join(tmpdir(), 'repo-'));
  const worktreeParent = mkdtempSync(join(tmpdir(), 'wt-'));
  const worktreePath = join(worktreeParent, 'wt');

  // Initialise a repository
  execFileSync('git', ['init'], { cwd: repoDir });
  execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: repoDir });
  execFileSync('git', ['config', 'user.name', 'Test'], { cwd: repoDir });
  writeFileSync(join(repoDir, 'README.md'), '# Test');
  execFileSync('git', ['add', '-A'], { cwd: repoDir });
  execFileSync('git', ['commit', '-m', 'init'], { cwd: repoDir });

  it('should create, use and remove a worktree', () => {
    expect(isGitRepo(repoDir)).toBe(true);

    const wt = createWorktree(repoDir, worktreePath, 'run-branch');
    expect(wt.branch).toBe('run-branch');
    expect(isGitRepo(worktreePath)).toBe(true);
    expect(currentBranch(worktreePath)).toBe('run-branch');

    writeFileSync(join(worktreePath, 'new.txt'), 'content');
    const committed = commitAll(worktreePath, 'change');
    expect(committed).toBe(true);
    expect(changedFiles(worktreePath)).toEqual([]);

    removeWorktree(repoDir, worktreePath);
  });

  afterEach(() => {
    rmSync(repoDir, { recursive: true, force: true });
    rmSync(worktreeParent, { recursive: true, force: true });
  });
});