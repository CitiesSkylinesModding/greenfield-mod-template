// oxlint-disable no-console -- a CLI talks on stdout.
// oxlint-disable import/no-nodejs-modules -- the template's tooling runs on Bun, not in the game.
// oxlint-disable no-await-in-loop -- the variants and their steps run one after the other.

// The template's end-to-end self-test, `mise template:self-test`: runs init on two copies of the
// template, everything kept (jb as the C# formatter) and everything pruned (dotnet format), then
// builds, checks and tests each the way a new mod's first run does. Nothing deploys: the build
// skips the UI and the post-processor, and the UI build deploys into a temporary Mods folder.
//
// `--variant kept|pruned` runs one; `--keep` keeps the copies, which a failed variant always does.

import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { parseArgs } from 'node:util';
import { pruneFlags } from './manifest';
import { copyTemplate } from './template-copy';

interface Variant {
  readonly name: 'kept' | 'pruned';

  readonly flags: readonly string[];
}

const variants: readonly Variant[] = [
  { name: 'kept', flags: [] },
  { name: 'pruned', flags: pruneFlags }
];

const MOD_ID = 'SelfTestMod';

const install = ['bun', 'install', '--frozen-lockfile'] as const;

/**
 * How much of a failed step's output the report shows, from its end.
 */
const REPORTED_OUTPUT_LINES = 60;

const { values } = parseArgs({
  options: { variant: { type: 'string' }, keep: { type: 'boolean' } }
});

const selected = variants.filter(variant => !values.variant || variant.name == values.variant);

if (!selected.length) {
  throw new Error(`Unknown --variant ${values.variant}: kept or pruned.`);
}

let failures = 0;

for (const variant of selected) {
  if (!(await runVariant(variant))) {
    failures++;
  }
}

console.log(failures ? `\n${failures} variant(s) failed.` : `\nEvery variant passed.`);

process.exitCode = failures ? 1 : 0;

async function runVariant(variant: Variant): Promise<boolean> {
  const root = await mkdtemp(path.join(os.tmpdir(), `template-self-test-${variant.name}-`));

  const modsPath = await mkdtemp(path.join(os.tmpdir(), 'template-self-test-mods-'));

  console.log(`\n== ${variant.name}: ${root}`);

  const isKept = variant.name == 'kept';

  const init = [
    'bun',
    'template/init.ts',
    '--id',
    MOD_ID,
    '--name',
    'Self-Test Mod',
    '--author',
    'Template Self-Test',
    '--description',
    'A mod the template self-test makes and throws away.',
    ...variant.flags
  ];

  // Installed before init, as a newcomer's clone has them, so init formats its output; init runs
  // through its CLI, as `mise init` runs it; then the packages it updated the lockfile for,
  // installed afresh.
  const steps: Array<readonly [name: string, command: readonly string[]]> = [
    ['bun install, before init', install],
    [['init', ...variant.flags].join(' '), init],
    ['bun install', install]
  ];

  if (!isKept) {
    steps.push(['fix:cs', ['mise', 'fix:cs']], ['check:cs', ['mise', 'check:cs']]);
  }

  steps.push(
    [
      'build, without the UI and the post-processor',
      ['dotnet', 'build', `${MOD_ID}.slnx`, '-p:SkipBuildUI=true', '-p:SkipModPostProcess=true']
    ],
    ['check', ['mise', 'check']],
    ['build:ui, into a temporary Mods folder', ['mise', 'build:ui']],
    [isKept ? 'test:cs, both passes and the widener-output check' : 'test:cs', ['mise', 'test:cs']]
  );

  if (isKept) {
    steps.push(['test:ui', ['mise', 'test:ui']]);
  }

  steps.push(['test:scripts', ['mise', 'test:scripts']]);

  const environment = {
    ...process.env,
    CSII_LOCALMODSPATH: modsPath,
    MISE_TRUSTED_CONFIG_PATHS: root,
    MISE_YES: '1'
  };

  let passed = false;

  try {
    await copyTemplate(root);

    passed = true;

    for (const [name, command] of steps) {
      if (!(await step(name, command, root, environment))) {
        passed = false;

        break;
      }
    }
  } catch (error) {
    passed = false;

    console.log(`FAIL  ${variant.name}\n${error instanceof Error ? error.message : String(error)}`);
  }

  await rm(modsPath, { recursive: true, force: true });

  if (passed && !values.keep) {
    await rm(root, { recursive: true, force: true });
  } else {
    console.log(`kept  ${root}`);
  }

  return passed;
}

async function step(
  name: string,
  command: readonly string[],
  cwd: string,
  env: Record<string, string | undefined>
): Promise<boolean> {
  const start = performance.now();

  const child = Bun.spawn([...command], { cwd, env, stdout: 'pipe', stderr: 'pipe' });

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited
  ]);

  const seconds = ((performance.now() - start) / 1000).toFixed(1);

  if (exitCode == 0) {
    console.log(`ok    ${name} (${seconds} s)`);

    return true;
  }

  const output = `${stdout}\n${stderr}`.trim().split('\n').slice(-REPORTED_OUTPUT_LINES).join('\n');

  console.log(`FAIL  ${name} (${seconds} s): ${command.join(' ')}\n${output}`);

  return false;
}
