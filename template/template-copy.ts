// oxlint-disable import/no-nodejs-modules -- the template's tooling runs on Bun, not in the game.
// oxlint-disable no-await-in-loop -- the copy writes one file at a time, under the open files limit.
// oxlint-disable no-sync -- git runs to completion before the copy goes on.

// Copies the template's working tree (tracked and untracked files, ignored ones left out) into a
// fresh git repository, committed, for init to run on: template/init.test.ts and
// template/self-test.ts both work on such copies, never on the template itself.

import { existsSync } from 'node:fs';
import path from 'node:path';

export const templateRoot = path.join(import.meta.dir, '..');

export interface CopyOptions {
  /**
   * Commits the copy on top of an empty commit, as a clone of the template's history has a parent
   * for HEAD; a single root commit reads as a fresh history to init. Default true.
   */
  readonly hasHistory?: boolean;

  /**
   * Puts the copy in a git repository, committed. Default true; false leaves it without even
   * `git init`.
   */
  readonly hasGit?: boolean;
}

/**
 * Copies the template into `destination` and returns the commit holding it, if any.
 */
export async function copyTemplate(
  destination: string,
  options: CopyOptions = {}
): Promise<string | undefined> {
  const files = run(templateRoot, [
    'git',
    'ls-files',
    '-z',
    '--cached',
    '--others',
    '--exclude-standard'
  ])
    .split('\0')
    .filter(file => file && existsSync(path.join(templateRoot, file)));

  for (const file of files) {
    await Bun.write(path.join(destination, file), Bun.file(path.join(templateRoot, file)));
  }

  if (!(options.hasGit ?? true)) {
    return undefined;
  }

  const git = (...args: string[]): string => testGit(destination, args);

  git('init', '--quiet', '--initial-branch=main');

  if (options.hasHistory ?? true) {
    git('commit', '--quiet', '--allow-empty', '-m', 'chore: earlier template history');
  }

  git('add', '--all');

  git('commit', '--quiet', '-m', 'chore: the template');

  return git('rev-parse', 'HEAD');
}

/**
 * Runs git in a copy as a fixed test identity, unsigned and without hooks.
 */
export function testGit(cwd: string, args: readonly string[]): string {
  return run(cwd, [
    'git',
    '-c',
    'user.name=Template Test',
    '-c',
    'user.email=template-test@localhost',
    '-c',
    'commit.gpgsign=false',
    '-c',
    'core.hooksPath=/dev/null',
    ...args
  ]);
}

/**
 * Runs a command to completion, returning its trimmed stdout, or throwing with its stderr.
 */
export function run(cwd: string, command: readonly string[]): string {
  const result = Bun.spawnSync([...command], { cwd, stderr: 'pipe' });

  if (!result.success) {
    throw new Error(`${command.join(' ')} failed in ${cwd}:\n${result.stderr.toString()}`);
  }

  return result.stdout.toString().trim();
}
