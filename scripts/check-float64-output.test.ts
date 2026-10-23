// oxlint-disable import/no-nodejs-modules -- tests run on Bun, not in the game.
// oxlint-disable no-await-in-loop -- each file needs its folder made first.

import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { findWidenedAssemblies, isFloat64Output } from './check-float64-output';

describe('findWidenedAssemblies', () => {
  let repository: string;

  const widened = 'metadata <FloatWidened> metadata';

  beforeAll(async () => {
    repository = await mkdtemp(path.join(tmpdir(), 'check-float64-output-'));

    const files: Record<string, string> = {
      'Mod.Tests/bin/float64/Debug/net10.0/Game.dll': widened,
      'Mod.Tests/bin/float64/Debug/net10.0/UnityEngine.CoreModule.original': widened,
      'Mod.Tests/bin/Debug/net10.0/Game.dll': 'metadata',
      'Mod/bin/Debug/net48/Mod.dll': widened,
      'Mod/bin/Debug/net48/Mod.pdb': widened,
      'node_modules/package/Lib.dll': widened,
      '.scratch/prototype/Lib.dll': widened
    };

    for (const [file, content] of Object.entries(files)) {
      await mkdir(path.dirname(path.join(repository, file)), { recursive: true });
      await writeFile(path.join(repository, file), content);
    }
  });

  afterAll(async () => {
    await rm(repository, { recursive: true });
  });

  test(`finds the marked assemblies, outside node_modules and dot folders`, async () => {
    const found = await findWidenedAssemblies(repository);

    expect(found.map(file => path.relative(repository, file)).toSorted()).toEqual([
      path.join('Mod.Tests', 'bin', 'float64', 'Debug', 'net10.0', 'Game.dll'),
      path.join(
        'Mod.Tests',
        'bin',
        'float64',
        'Debug',
        'net10.0',
        'UnityEngine.CoreModule.original'
      ),
      path.join('Mod', 'bin', 'Debug', 'net48', 'Mod.dll')
    ]);
  });

  test(`finds none in a missing folder, as the Mods folder before a deploy`, async () => {
    expect(await findWidenedAssemblies(path.join(repository, 'Mods'))).toEqual([]);
  });
});

describe('isFloat64Output', () => {
  const repository = path.join(path.sep, 'repo');

  test.each([
    ['Mod.Tests/bin/float64/Debug/net10.0/Game.dll', true],
    ['Mod.Tests/obj/float64/Debug/net10.0/widened-game/Game.dll', true],
    ['Mod.Tests/bin/Debug/net10.0/Game.dll', false],
    ['Mod/bin/float64/Mod.dll', false],
    ['../Managed/Game.dll', false]
  ])('%s: %p', (file, expected) => {
    expect(isFloat64Output(repository, path.join(repository, ...file.split('/')))).toBe(expected);
  });
});
