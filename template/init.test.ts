// oxlint-disable import/no-nodejs-modules -- the template's tooling runs on Bun, not in the game.
// oxlint-disable no-await-in-loop -- the scans read one file at a time, under the open files limit.
// oxlint-disable no-sync -- existsSync and the CLI spawn read as the assertions they back.

import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { existsSync } from 'node:fs';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import {
  camelCase,
  derivePrefix,
  type InitOptions,
  type InitReport,
  initialize,
  parseArguments
} from './init';
import {
  type Part,
  parts,
  placeholders,
  pruneFlags,
  type Removal,
  TEMPLATE_NAME_TAIL,
  templateOnly
} from './manifest';
import { type CopyOptions, copyTemplate, run, templateRoot, testGit } from './template-copy';

/**
 * What a test reports of a matching line, at most.
 */
const REPORTED_LINE_LENGTH = 160;

const temporaryRoots: string[] = [];

afterAll(async () => {
  await Promise.allSettled(temporaryRoots.map(root => rm(root, { recursive: true, force: true })));
});

const baseArguments = [
  '--id',
  'CityPulse',
  '--name',
  'City Pulse',
  '--author',
  'Jane Doe',
  '--description',
  'Shows how a city is doing at a glance.'
];

describe('parseArguments', () => {
  test('derives the prefix and the defaults', () => {
    const parsed = parseArguments(baseArguments);

    expect(parsed?.prefix).toBe('cp');
    expect(parsed?.versioning).toBe('calver');
    expect(parsed?.agentDirectory).toBe('.claude');
    expect(parsed?.pruned.size).toBe(0);
  });

  test('maps each prune flag to its part', () => {
    const parsed = parseArguments([...baseArguments, ...pruneFlags]);

    expect(parsed?.pruned).toEqual(new Set(parts.map(part => part.id)));
  });

  test('returns nothing for --help', () => {
    expect(parseArguments(['--help'])).toBeUndefined();
  });

  test.each([
    [['--id', 'cityPulse'], 'PascalCase'],
    [['--id', placeholders.id], `template's own name`],
    [['--prefix', 'C'], '--prefix'],
    [['--versioning', 'romver'], '--versioning'],
    [['--agent-dir', '../elsewhere'], '--agent-dir'],
    [['--agent-dir', "it's"], '--agent-dir'],
    [['--crowdin-project-id', '12', '--no-crowdin'], 'contradict'],
    [['--forum-link', 'http://forum'], 'https://']
  ])('rejects %p', (overrides, message) => {
    expect(() => parseArguments([...baseArguments, ...overrides])).toThrow(message);
  });

  test('requires the identity flags', () => {
    expect(() => parseArguments(['--id', 'CityPulse'])).toThrow('--name is required');
  });
});

describe('the CLI', () => {
  test('prints the usage for --help', () => {
    const result = Bun.spawnSync([process.execPath, 'template/init.ts', '--help'], {
      cwd: templateRoot
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout.toString()).toStartWith('Usage: mise init');
  });
});

describe('derivePrefix and camelCase', () => {
  test.each([
    ['HallOfFame', 'hof', 'hallOfFame'],
    ['UIThing', 'ut', 'uiThing'],
    ['Traffic', 'tra', 'traffic']
  ])('%s', (id, prefix, camel) => {
    expect(derivePrefix(id)).toBe(prefix);
    expect(camelCase(id)).toBe(camel);
  });
});

describe('init, everything kept', () => {
  const mod = initializedCopy([]);

  test('keeps the wizard, deletes the template-only material', () => {
    expect(existsSync(path.join(mod.root, '.claude/skills/cp-setup/SKILL.md'))).toBe(true);
    expect(existsSync(path.join(mod.root, '.claude/skills/cp-setup/interview.md'))).toBe(false);
    expect(existsSync(path.join(mod.root, 'template'))).toBe(false);
    expect(existsSync(path.join(mod.root, 'LICENSE'))).toBe(false);
    expect(mod.files.filter(file => file.includes('template-update'))).toEqual([]);
  });

  test('leaves no template name in any path or file', async () => {
    expect(await findPlaceholders(mod)).toEqual([]);
  });

  test('leaves no template-only trace', async () => {
    expect(await findTraces(mod, templateOnly)).toEqual([]);
    expect(await taskNames(mod.root)).not.toContain('init');
  });

  test('renames the mod folders, projects and binding groups', async () => {
    expect(mod.files).toContain('CityPulse/CityPulse.csproj');
    expect(mod.files).toContain('CityPulse.Tests/CityPulse.Tests.csproj');
    expect(mod.files).toContain('CityPulse.slnx');
    expect(mod.files).toContain('.idea/.idea.CityPulse/.idea/indexLayout.xml');
    expect(await text(mod.root, 'CityPulse/Systems/CommonUISystem.cs')).toContain(
      '"cityPulse.common"'
    );
    expect(await text(mod.root, 'CityPulse/UI/build.ts')).toContain(`'cp-[local]_[hash:base64:3]'`);
  });

  test('writes .template.json', async () => {
    expect(JSON.parse(await text(mod.root, '.template.json'))).toEqual({
      template: 'https://github.com/CitiesSkylinesModding/greenfield-mod-template',
      templateCommit: mod.report.templateCommit,
      initialCommit: mod.report.templateCommit,
      parts: Object.fromEntries(parts.map(part => [part.id, true])),
      names: { Greenfield: 'CityPulse', greenfield: 'cityPulse', gfd: 'cp' },
      skills: '.claude/skills',
      rules: '.claude/rules'
    });
  });

  test('replaces the README with the mod skeleton', async () => {
    const readme = await text(mod.root, 'README.md');

    expect(readme).toStartWith('# City Pulse\n\nShows how a city is doing at a glance.\n');
    expect(readme).toContain('runs the in-game scenarios with the `cs2-modding` plugin');
    expect(readme).toContain('delete `.claude/skills/cp-setup/`');
    expect(readme).toContain('`bunx lefthook install`');
  });

  test('replaces the maintenance section with the template origin', async () => {
    const agents = await text(mod.root, 'AGENTS.md');

    expect(agents).not.toContain('## Template maintenance');
    expect(agents).toContain('## Template origin');
    expect(agents).toContain(
      '[Greenfield Mod Template](https://github.com/CitiesSkylinesModding/greenfield-mod-template)'
    );
    expect(agents).toContain('`git show <initialCommit>:<path>`');
  });

  test('resets the per-mod fields', async () => {
    const version = `${new Date().getFullYear()}.0.0`;

    const publish = await text(mod.root, 'CityPulse/Properties/PublishConfiguration.xml');

    const manifest = JSON.parse(await text(mod.root, 'CityPulse/UI/mod.json')) as {
      author: string;
    };

    expect(await text(mod.root, 'CityPulse/CityPulse.csproj')).toContain(
      `<Version>${version}</Version>`
    );
    expect(publish).toContain('<DisplayName Value="City Pulse" />');
    expect(publish).toContain(
      '<ShortDescription Value="Shows how a city is doing at a glance." />'
    );
    expect(publish).toContain(`<ModVersion Value="${version}" />`);
    expect(publish).toContain('<ForumLink Value="" />');
    expect(publish).not.toContain('ExternalLink');
    expect(await text(mod.root, 'CityPulse/LongDescription.md')).toBe(
      '# City Pulse\n\nShows how a city is doing at a glance.\n'
    );
    expect(manifest.author).toBe('Jane Doe');
  });

  test('names the mod by its display name in the locales, keeping key references', async () => {
    const locale = JSON.parse(await text(mod.root, 'CityPulse/Locales/en-US.json')) as Record<
      string,
      string
    >;

    expect(locale['Options.SECTION[CityPulse.CityPulse.Mod]']).toBe('City Pulse');
    expect(locale['CityPulse.Common.BASE_ERROR']).toStartWith('City Pulse has encountered');
    expect(locale['CityPulse.EntityCounter.COUNTED[citizens]']).toBe(
      '{KEY=Options.CityPulse.CityPulse.Mod.ENTITYKIND[Citizens]}'
    );
  });

  test('leaves every relative Markdown link resolving', async () => {
    expect(await findBrokenLinks(mod)).toEqual([]);
  });
});

describe('init, everything pruned', () => {
  const mod = initializedCopy(pruneFlags);

  test.each(parts.map(part => [part.id, part] as const))('prunes %s fully', async (_, part) => {
    await expectPruned(mod, part);
  });

  test('leaves no template name, and every link resolving', async () => {
    expect(await findPlaceholders(mod)).toEqual([]);
    expect(await findBrokenLinks(mod)).toEqual([]);
  });

  test('switches to dotnet format', async () => {
    const mise = await text(mod.root, 'mise.toml');

    expect(mise).toContain('"dotnet format style CityPulse.slnx"');
    expect(mise).toContain('[tasks."check:cs"]');
    expect(await text(mod.root, 'lefthook.yml')).toContain('run: mise check:cs');
    expect(await text(mod.root, '.editorconfig')).toContain(
      'dotnet_style_prefer_auto_properties = true:suggestion'
    );
  });

  test('leaves no folder it emptied', async () => {
    expect(await findEmptyFolders(mod.root)).toEqual([]);
  });

  test('records the parts pruned', async () => {
    const manifest = JSON.parse(await text(mod.root, '.template.json')) as { parts: object };

    expect(manifest.parts).toEqual(Object.fromEntries(parts.map(part => [part.id, false])));
  });
});

describe.each(parts.map(part => [part.id, part] as const))('init without %s', (_, part) => {
  const mod = initializedCopy(part.flag.split(' '));

  test('prunes it fully', async () => {
    await expectPruned(mod, part);
  });

  test('leaves every relative Markdown link resolving', async () => {
    expect(await findBrokenLinks(mod)).toEqual([]);
  });
});

describe('init with the skills and rules elsewhere', () => {
  const mod = initializedCopy(['--agent-dir', 'agents/claude']);

  test('moves them', () => {
    expect(mod.files).toContain('agents/claude/skills/cp-setup/SKILL.md');
    expect(mod.files).toContain('agents/claude/skills/cp-release/SKILL.md');
    expect(mod.files).toContain('agents/claude/rules/css-modules-bem.md');
    expect(mod.files.filter(file => /^\.claude\/(?:skills|rules)\//u.test(file))).toEqual([]);
    expect(mod.files).toContain('.claude/settings.json');
  });

  test('leaves no reference to their old place, and every link resolving', async () => {
    expect(await grep(mod, /\.claude\/(?:skills|rules)/u)).toEqual([]);
    expect(await findBrokenLinks(mod)).toEqual([]);
    expect(await text(mod.root, 'AGENTS.md')).toContain('`agents/claude/rules/css-modules-bem.md`');
  });

  test('records them', async () => {
    expect(JSON.parse(await text(mod.root, '.template.json'))).toMatchObject({
      skills: 'agents/claude/skills',
      rules: 'agents/claude/rules'
    });
  });

  test('keeps them out of the formatter', async () => {
    expect(await text(mod.root, 'oxfmt.config.ts')).toContain(
      `ignorePatterns: ['.claude', 'agents/claude/skills', 'agents/claude/rules',`
    );
  });

  test('shows the folder in Rider', async () => {
    expect(await text(mod.root, '.idea/.idea.CityPulse/.idea/indexLayout.xml')).toContain(
      '<Path>agents</Path>'
    );
  });
});

describe('init with user text that reads as a pattern', () => {
  const mod = initializedCopy([
    '--name',
    'Ca$$h $& Co',
    '--description',
    "Earns $' and $$.",
    '--agent-dir',
    'gfd-a$$b'
  ]);

  test('writes them as they are', async () => {
    const publish = await text(mod.root, 'CityPulse/Properties/PublishConfiguration.xml');

    const locale = JSON.parse(await text(mod.root, 'CityPulse/Locales/en-US.json')) as Record<
      string,
      string
    >;

    expect(publish).toContain('<DisplayName Value="Ca$$h $&amp; Co" />');
    expect(publish).toContain(`<ShortDescription Value="Earns $' and $$." />`);
    expect(locale['CityPulse.Common.BASE_ERROR']).toStartWith('Ca$$h $& Co has encountered');
    expect(mod.files).toContain('gfd-a$$b/skills/cp-setup/SKILL.md');
    expect(await text(mod.root, 'README.md')).toContain('delete `gfd-a$$b/skills/cp-setup/`');
  });
});

describe(`init with user text holding the template's name`, () => {
  const mod = initializedCopy([
    '--name',
    'Greenfield Roads',
    '--description',
    'Lays out a greenfield district.'
  ]);

  test('writes it as it is', async () => {
    const publish = await text(mod.root, 'CityPulse/Properties/PublishConfiguration.xml');

    const locale = JSON.parse(await text(mod.root, 'CityPulse/Locales/en-US.json')) as Record<
      string,
      string
    >;

    expect(publish).toContain('<DisplayName Value="Greenfield Roads" />');
    expect(publish).toContain('<ShortDescription Value="Lays out a greenfield district." />');
    expect(await text(mod.root, 'CityPulse/LongDescription.md')).toBe(
      '# Greenfield Roads\n\nLays out a greenfield district.\n'
    );
    expect(locale['Options.SECTION[CityPulse.CityPulse.Mod]']).toBe('Greenfield Roads');
    expect(locale['CityPulse.Common.BASE_ERROR']).toStartWith('Greenfield Roads has encountered');
  });
});

describe('init with SemVer', () => {
  const mod = initializedCopy(['--versioning', 'semver']);

  test('starts at 1.0.0 and bumps by compatibility', async () => {
    expect(await text(mod.root, 'CityPulse/CityPulse.csproj')).toContain(
      '<Version>1.0.0</Version>'
    );
    expect(await text(mod.root, '.claude/skills/cp-release/SKILL.md')).toContain('major + 1');
  });
});

describe('init with links and a Crowdin project', () => {
  const mod = initializedCopy([
    '--forum-link',
    'https://forum.paradoxplaza.com/forum/threads/city-pulse.1/',
    '--github-url',
    'https://github.com/jane/city-pulse',
    '--crowdin-project-id',
    '123456'
  ]);

  test('writes them', async () => {
    expect(await text(mod.root, 'CityPulse/Properties/PublishConfiguration.xml')).toContain(
      '<ForumLink Value="https://forum.paradoxplaza.com/forum/threads/city-pulse.1/" />\n' +
        '  <ExternalLink Type="github" Url="https://github.com/jane/city-pulse" />'
    );
    expect(await text(mod.root, 'mise.toml')).toContain('CROWDIN_PROJECT_ID = "123456"');
  });
});

describe('init on a published template', () => {
  test('resets the mod ID', async () => {
    const root = await temporaryCopy();

    const publish = 'Greenfield/Properties/PublishConfiguration.xml';

    const configuration = await text(root, publish);

    await Bun.write(
      path.join(root, publish),
      configuration.replace('<ModId Value="" />', '<ModId Value="12345" />')
    );

    commitAll(root, 'chore: publish');

    await initialize(root, options([]));

    expect(await text(root, 'CityPulse/Properties/PublishConfiguration.xml')).toContain(
      '<ModId Value="" />'
    );
  });
});

describe('init with the skills and rules in a pruned folder', () => {
  const mod = initializedCopy(['--agent-dir', 'template/agents']);

  test('keeps them', () => {
    expect(mod.files).toContain('template/agents/skills/cp-setup/SKILL.md');
    expect(mod.files).toContain('template/agents/rules/css-modules-bem.md');
  });
});

describe('init on a built checkout', () => {
  test('leaves nothing of a pruned folder', async () => {
    const root = await temporaryCopy();

    const generated = 'Greenfield/UI/src/entity-counter/entity-counter.module.scss.d.ts';

    await Bun.write(path.join(root, generated), 'export {};\n');

    await initialize(root, options(['--no-sample-slice']));

    expect(existsSync(path.join(root, 'CityPulse/UI/src/entity-counter'))).toBe(false);
  });
});

describe('init on a fresh history', () => {
  const mod = initializedCopy(['--template-commit', 'abcdef0'], { hasHistory: false });

  test('records the template commit passed, and HEAD as the initial commit', async () => {
    expect(JSON.parse(await text(mod.root, '.template.json'))).toMatchObject({
      templateCommit: 'abcdef0',
      initialCommit: run(mod.root, ['git', 'rev-parse', 'HEAD'])
    });
  });
});

describe('init refuses', () => {
  test('a repository with no commit', async () => {
    const root = await temporaryCopy({ hasGit: false });

    expect(await initFailure(root, [])).toContain('This repository has no commit to record.');
  });

  test('a fresh history without --template-commit', async () => {
    const root = await temporaryCopy({ hasHistory: false });

    expect(await initFailure(root, [])).toContain('--template-commit');
  });

  test('a dirty tree', async () => {
    const root = await temporaryCopy();

    await Bun.write(path.join(root, 'stray.txt'), 'stray');

    expect(await initFailure(root, [])).toContain('uncommitted changes');
  });

  test('a declaration that no longer matches, writing nothing', async () => {
    const root = await temporaryCopy();

    const agents = await text(root, 'AGENTS.md');

    await Bun.write(
      path.join(root, 'AGENTS.md'),
      agents.replace('`EntityCounterSystem.DebugCount`', '`X`')
    );

    commitAll(root, 'docs: drift');

    expect(await initFailure(root, ['--no-sample-slice'])).toContain('AGENTS.md');
    expect(run(root, ['git', 'status', '--porcelain'])).toBe('');
  });

  test('a declared file that is gone', async () => {
    const root = await temporaryCopy();

    await rm(path.join(root, 'Greenfield/UI/src/testing'), { recursive: true });

    commitAll(root, 'chore: drop the UI test harness');

    expect(await initFailure(root, ['--no-ui-tests'])).toContain(
      'Declared file or folder not found: Greenfield/UI/src/testing.'
    );
  });

  test('to run twice', async () => {
    const root = await temporaryCopy();

    await initialize(root, options([]));

    commitAll(root, 'chore: init');

    expect(await initFailure(root, [])).toContain('init already ran');
  });
});

interface InitializedCopy {
  readonly root: string;

  readonly files: readonly string[];

  readonly report: InitReport;
}

function options(extra: readonly string[]): InitOptions {
  const parsed = parseArguments([...baseArguments, ...extra]);

  if (!parsed) {
    throw new Error('No options parsed.');
  }

  return parsed;
}

async function temporaryCopy(copyOptions?: CopyOptions): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'template-init-'));

  temporaryRoots.push(root);

  await copyTemplate(root, copyOptions);

  return root;
}

/**
 * Initializes a copy before the tests of the enclosing `describe`, which read the returned object
 * once it is filled.
 */
function initializedCopy(extra: readonly string[], copyOptions?: CopyOptions): InitializedCopy {
  // Mutable: filled by the beforeAll hook, read by the tests after it.
  const mod = { root: '', files: [] as string[], report: {} as InitReport };

  beforeAll(async () => {
    mod.root = await temporaryCopy(copyOptions);
    mod.report = await initialize(mod.root, options(extra));
    mod.files = await listFiles(mod.root);
  });

  return mod;
}

async function initFailure(root: string, extra: readonly string[]): Promise<string> {
  try {
    await initialize(root, options(extra));
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }

  throw new Error('init succeeded.');
}

function commitAll(root: string, message: string): void {
  testGit(root, ['add', '--all']);

  testGit(root, ['commit', '--quiet', '-m', message]);
}

async function expectPruned(mod: InitializedCopy, part: Part): Promise<void> {
  const tasks = await taskNames(mod.root);

  const packageJson = await text(mod.root, 'package.json');

  const lockfile = await text(mod.root, 'bun.lock');

  for (const declared of part.files.map(renamed)) {
    expect(mod.files.filter(file => file == declared || file.startsWith(`${declared}/`))).toEqual(
      []
    );
  }

  for (const task of part.tasks) {
    expect(tasks).not.toContain(task);
  }

  for (const name of part.packages) {
    expect(packageJson).not.toContain(`"${name}"`);
    expect(lockfile).not.toContain(`"${name}"`);
  }

  expect(await findTraces(mod, part)).toEqual([]);
}

async function listFiles(root: string): Promise<string[]> {
  const files: string[] = [];

  for await (const file of new Bun.Glob('**').scan({ cwd: root, dot: true })) {
    if (!file.startsWith('.git/')) {
      files.push(file);
    }
  }

  return files.toSorted();
}

function text(root: string, file: string): Promise<string> {
  return readFile(path.join(root, file), 'utf8');
}

/**
 * The lines matching a pattern, as `file: line`, in every text file but `.template.json`, which
 * records the template's names on purpose.
 */
async function grep(mod: InitializedCopy, pattern: string | RegExp): Promise<string[]> {
  const matches: string[] = [];

  for (const file of mod.files.filter(candidate => candidate != '.template.json')) {
    const content = await readFile(path.join(mod.root, file));

    if (!content.includes(0)) {
      matches.push(
        ...content
          .toString('utf8')
          .split('\n')
          .filter(line =>
            typeof pattern == 'string' ? line.includes(pattern) : pattern.test(line)
          )
          .map(line => `${file}: ${line.trim().slice(0, REPORTED_LINE_LENGTH)}`)
      );
    }
  }

  return matches;
}

async function findPlaceholders(mod: InitializedCopy): Promise<string[]> {
  const pattern = new RegExp(
    `${placeholders.id}(?!${TEMPLATE_NAME_TAIL})|\\b${placeholders.prefix}-`,
    'iu'
  );

  return [...mod.files.filter(file => pattern.test(file)), ...(await grep(mod, pattern))];
}

/**
 * A template path or name as the rename writes it in the CityPulse copies.
 */
function renamed(name: string): string {
  return name.replaceAll(placeholders.id, 'CityPulse').replaceAll(`${placeholders.prefix}-`, 'cp-');
}

async function findTraces(mod: InitializedCopy, removal: Removal): Promise<string[]> {
  const matches = await Promise.all(
    removal.traces.map(trace => grep(mod, typeof trace == 'string' ? renamed(trace) : trace))
  );

  return matches.flat();
}

/**
 * The folders holding nothing, `.git` left out.
 */
async function findEmptyFolders(root: string): Promise<string[]> {
  const entries = await readdir(root, { recursive: true, withFileTypes: true });

  const folders = entries
    .filter(entry => entry.isDirectory())
    .map(entry => path.relative(root, path.join(entry.parentPath, entry.name)))
    .filter(folder => folder != '.git' && !folder.startsWith('.git/'));

  const empty: string[] = [];

  for (const folder of folders) {
    const children = await readdir(path.join(root, folder));

    if (!children.length) {
      empty.push(folder);
    }
  }

  return empty.toSorted();
}

async function taskNames(root: string): Promise<string[]> {
  const mise = await text(root, 'mise.toml');

  return [...mise.matchAll(/^\[tasks\."(?<task>[^"]+)"\]$/gmu)].map(
    match => match.groups?.task ?? ''
  );
}

/**
 * The relative links of every Markdown file whose target does not exist.
 */
async function findBrokenLinks(mod: InitializedCopy): Promise<string[]> {
  const broken: string[] = [];

  for (const file of mod.files.filter(candidate => candidate.endsWith('.md'))) {
    const markdown = await text(mod.root, file);

    for (const match of markdown.matchAll(/\]\((?<target>[^)\s]+)\)/gu)) {
      const target = match.groups?.target ?? '';

      const [targetPath = ''] = target.split('#');

      const isRelative = !/^(?:[a-z]+:|#|\/)/u.test(target);

      if (isRelative && !existsSync(path.join(mod.root, path.dirname(file), targetPath))) {
        broken.push(`${file}: ${target}`);
      }
    }
  }

  return broken;
}
