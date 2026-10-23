// oxlint-disable no-console -- a CLI talks on stdout.
// oxlint-disable import/no-nodejs-modules -- a CLI script runs on Bun, not in the game.
// oxlint-disable no-await-in-loop -- the scan reads one file at a time, under the open files limit.

// Checks that the float64 pass's widened assemblies (see `<Mod>.Tests/Float64/`) are only in the
// tests' float64 output: none in the game's folder, the mod's build output, or the Mods folder the
// game loads mods from. `mise test:cs:float64` runs it after the tests. The scan is tested in
// check-float64-output.test.ts.

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { requireEnvironment } from './environment';

/**
 * The type FloatWidener.cs adds to each assembly it rewrites, whose name lands in the metadata's
 * UTF-8 string heap.
 */
const marker = Buffer.from('<FloatWidened>', 'utf8');

/**
 * The files an assembly can be: the native-call shim's copy of UnityEngine.CoreModule goes by
 * `.original`.
 */
const assemblyExtensions: ReadonlySet<string> = new Set(['.dll', '.exe', '.original']);

if (import.meta.main) {
  try {
    process.exitCode = (await checkFloat64Output()) ? 0 : 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);

    process.exitCode = 1;
  }
}

async function checkFloat64Output(): Promise<boolean> {
  const repository = path.resolve(import.meta.dir, '..');

  const widened = [
    ...(await findWidenedAssemblies(repository)),
    ...(await findWidenedAssemblies(requireEnvironment('CSII_MANAGEDPATH'))),
    ...(await findWidenedAssemblies(requireEnvironment('CSII_LOCALMODSPATH')))
  ];

  const misplaced = widened.filter(file => !isFloat64Output(repository, file));

  if (misplaced.length > 0) {
    const list = misplaced.map(file => `  ${file}`).join('\n');

    console.error(
      `Widened assemblies outside the float64 test output, restore them from a clean build ` +
        `(or, in the game's folder, Steam's "Verify integrity of game files"):\n${list}`
    );

    return false;
  }

  if (widened.length == 0) {
    console.error(`No widened assembly found to check: the float64 pass has not built yet.`);

    return false;
  }

  console.log(`${widened.length} widened assemblies, all in the float64 test output.`);

  return true;
}

/**
 * The assemblies under `root` that the float widener rewrote.
 * Skips `node_modules` and the folders whose name starts with a dot (`.git`, `.scratch`), where no
 * build writes.
 */
export async function findWidenedAssemblies(root: string): Promise<string[]> {
  const widened: string[] = [];
  const entries = await readdir(root, { withFileTypes: true }).catch((error: unknown) => {
    // The Mods folder only exists once a mod was deployed.
    if (error instanceof Error && 'code' in error && error.code == 'ENOENT') {
      return [];
    }

    throw error;
  });

  for (const entry of entries) {
    const entryPath = path.join(root, entry.name);

    if (entry.isDirectory()) {
      if (entry.name != 'node_modules' && !entry.name.startsWith('.')) {
        widened.push(...(await findWidenedAssemblies(entryPath)));
      }
    } else if (assemblyExtensions.has(path.extname(entry.name))) {
      const content = await readFile(entryPath);

      if (content.includes(marker)) {
        widened.push(entryPath);
      }
    }
  }

  return widened;
}

/**
 * Whether the file lies in a test project's float64 output, `<Mod>.Tests/bin/float64/` or
 * `<Mod>.Tests/obj/float64/` in the repository.
 */
export function isFloat64Output(repository: string, file: string): boolean {
  const [project, folder, pass] = path.relative(repository, file).split(path.sep);

  return (
    project != null &&
    project.endsWith('.Tests') &&
    (folder == 'bin' || folder == 'obj') &&
    pass == 'float64'
  );
}
