// oxlint-disable no-console -- a CLI talks on stdout.
// oxlint-disable import/no-nodejs-modules -- the init script runs on Bun, not in the game.
// oxlint-disable no-await-in-loop -- the tree is read and written one file at a time, in order.
// oxlint-disable no-sync -- git and the existence checks run before anything else can.

// Turns the template into a named mod: `mise init --id <ModId> --name <...> ...`, with
// `mise init -- --help` for the flags. It prunes the parts declined, renames everything, records
// where the mod came from, and deletes the template-only material, as template/manifest.ts
// declares.
// Every change is computed in memory first: a failure writes nothing.

import { existsSync } from 'node:fs';
import { mkdir, readdir, rename as movePath, rm, rmdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { parseArgs } from 'node:util';
import {
  AGENT_DIRECTORY as TEMPLATE_AGENT_DIRECTORY,
  type Edit,
  escapeRegExp,
  type PartId,
  parts,
  placeholders,
  type Removal,
  templateOnly,
  templateOnlyIfPresent,
  TEMPLATE_NAME_TAIL,
  TEMPLATE_REPOSITORY,
  WIZARD_SKILL
} from './manifest';

export interface InitOptions {
  /**
   * The PascalCase mod ID.
   */
  readonly id: string;

  /**
   * The display name players see.
   */
  readonly name: string;

  readonly author: string;

  /**
   * The one-line description of the publish configuration and the README.
   */
  readonly description: string;

  /**
   * The short prefix of CSS classes and skill names.
   */
  readonly prefix: string;

  readonly versioning: 'calver' | 'semver';

  readonly pruned: ReadonlySet<PartId>;

  readonly crowdinProjectId?: string | undefined;

  /**
   * Where the skills and rules live, `<dir>/skills` and `<dir>/rules`.
   */
  readonly agentDirectory: string;

  readonly forumLink?: string | undefined;

  readonly githubUrl?: string | undefined;

  /**
   * The template commit the mod starts from, when HEAD is not the template's.
   */
  readonly templateCommit?: string | undefined;
}

export interface InitReport {
  readonly templateCommit: string;

  readonly initialCommit: string;

  readonly deleted: number;

  readonly written: number;

  /**
   * Whether bun.lock matches the packages kept, updated offline when a part dropped some.
   */
  readonly isLockfileCurrent: boolean;

  /**
   * Whether `bun fmt` reformatted the result, which needs the packages its configuration loads.
   */
  readonly isFormatted: boolean;
}

/**
 * A failure the user can act on, printed without a stack trace.
 */
export class InitError extends Error {}

/**
 * Where the usage text's descriptions start, past the flags.
 */
const USAGE_COLUMN = 29;

const USAGE = `Usage: mise init --id <ModId> --name <display name> --author <name> --description <text> [options]

Turns this template into a named mod. Run it once, on a clean tree with at least one commit.

  --id <ModId>                 PascalCase mod ID, a valid C# identifier (ex. HallOfFame)
  --name <text>                Display name players see
  --author <text>              Author written into mod.json
  --description <text>         One-line description (Paradox Mods, README)
  --prefix <prefix>            Short CSS class and skill prefix (default: the ID's initials)
  --versioning calver|semver   Version scheme (default: calver)
  --agent-dir <dir>            Where skills and rules live (default: ${TEMPLATE_AGENT_DIRECTORY})
  --forum-link <url>           Paradox forum thread of the mod
  --github-url <url>           GitHub repository of the mod
  --crowdin-project-id <id>    Numeric Crowdin project ID
  --template-commit <sha>      Template commit the mod starts from, when HEAD is not it (a fresh
                               history, an archive)
${parts.map(part => `  ${part.flag.padEnd(USAGE_COLUMN)}Prune: ${part.title}`).join('\n')}
`;

/**
 * Parses the command line, or returns `undefined` for `--help`.
 */
export function parseArguments(args: readonly string[]): InitOptions | undefined {
  const flags = parse(args);

  if (flags.help) {
    return undefined;
  }

  const id = parseId(required(flags.id, '--id'));

  const prefix = flags.prefix ?? derivePrefix(id);

  if (!/^[a-z][a-z0-9]{1,7}$/u.test(prefix)) {
    throw new InitError(`--prefix must be 2 to 8 lowercase letters and digits: "${prefix}".`);
  }

  const versioning = flags.versioning ?? 'calver';

  if (versioning != 'calver' && versioning != 'semver') {
    throw new InitError(`--versioning must be calver or semver: "${versioning}".`);
  }

  const pruned = parsePruned(flags);

  const templateCommit = flags['template-commit'];

  if (templateCommit != null && !/^[0-9a-f]{7,40}$/u.test(templateCommit)) {
    throw new InitError(`--template-commit must be a commit hash: "${templateCommit}".`);
  }

  return {
    id,
    name: singleLine(required(flags.name, '--name'), '--name'),
    author: singleLine(required(flags.author, '--author'), '--author'),
    description: singleLine(required(flags.description, '--description'), '--description'),
    prefix,
    versioning,
    pruned,
    crowdinProjectId: parseCrowdinProjectId(flags['crowdin-project-id'], pruned),
    agentDirectory: parseAgentDirectory(flags['agent-dir'] ?? TEMPLATE_AGENT_DIRECTORY),
    forumLink: url(flags['forum-link'], '--forum-link'),
    githubUrl: url(flags['github-url'], '--github-url'),
    templateCommit
  };
}

/**
 * Applies init to the template checkout at `root`, in place.
 */
export async function initialize(root: string, options: InitOptions): Promise<InitReport> {
  const { initialCommit, templateCommit } = readCommits(root, options);

  const originalPaths = git(root, ['ls-files', '-z']).split('\0').filter(Boolean);

  if (!originalPaths.some(file => file.startsWith('template/'))) {
    throw new InitError(`This repository holds no template/ folder: init already ran here.`);
  }

  const tree = new Map<string, string | Uint8Array>();

  for (const file of originalPaths) {
    tree.set(file, await readContent(path.join(root, file)));
  }

  const original: ReadonlyMap<string, string | Uint8Array> = new Map(tree);

  const kept = new Set(parts.map(part => part.id).filter(id => !options.pruned.has(id)));

  const pruning = new Pruning(tree, kept);

  for (const part of parts) {
    if (options.pruned.has(part.id)) {
      pruning.prune(part);
    }
  }

  pruning.prune(templateOnly);

  for (const file of templateOnlyIfPresent) {
    pruning.deleteIfPresent(file);
  }

  writeTemplateOrigin(tree);

  const modNames = { id: options.id, camelId: camelCase(options.id), prefix: options.prefix };

  const rename = renamer(modNames);

  const renamed = new Map(
    [...tree].map(([file, content]) => [
      rename(file),
      typeof content == 'string' ? rename(content) : content
    ])
  );

  writeModFields(renamed, tree, options, rename);

  const moved = relocateAgentFiles(renamed, options.agentDirectory);

  moved.set('README.md', modReadme(options, kept));

  moved.set(
    '.template.json',
    `${JSON.stringify(
      {
        template: TEMPLATE_REPOSITORY,
        templateCommit,
        initialCommit,
        parts: Object.fromEntries(parts.map(part => [part.id, kept.has(part.id)])),
        names: {
          [placeholders.id]: modNames.id,
          [placeholders.camelId]: modNames.camelId,
          [placeholders.prefix]: modNames.prefix
        },
        skills: `${options.agentDirectory}/skills`,
        rules: `${options.agentDirectory}/rules`
      },
      null,
      2
    )}\n`
  );

  const report = await writeTree(root, {
    original,
    final: moved,
    pruned: pruning.deletedPaths,
    rename
  });

  const isLockfileCurrent = !pruning.hasRemovedPackages || updateLockfile(root);

  return { templateCommit, initialCommit, ...report, isLockfileCurrent, isFormatted: format(root) };
}

/**
 * How many letters of a one-word ID make its prefix.
 */
const SINGLE_WORD_PREFIX_LENGTH = 3;

/**
 * Derives the short prefix from the ID's word initials: `HallOfFame` gives `hof`.
 */
export function derivePrefix(id: string): string {
  const initials = words(id)
    .map(word => word[0] ?? '')
    .join('')
    .toLowerCase();

  return initials.length >= 2 ? initials : id.slice(0, SINGLE_WORD_PREFIX_LENGTH).toLowerCase();
}

/**
 * The ID with its first word lowercased: `UIThing` gives `uiThing`.
 */
export function camelCase(id: string): string {
  const [first = '', ...rest] = words(id);

  return first.toLowerCase() + rest.join('');
}

function words(id: string): string[] {
  return id.match(/[A-Z]+(?![a-z])|[A-Z][a-z0-9]*|[a-z0-9]+/gu) ?? [];
}

/**
 * One `--no-<id>` switch per part, but jb, which `--formatter` chooses.
 */
const pruneOptions = Object.fromEntries(
  parts.filter(part => part.id != 'jb').map(part => [`no-${part.id}`, { type: 'boolean' }])
) as Record<`no-${Exclude<PartId, 'jb'>}`, { readonly type: 'boolean' }>;

const flagConfig = {
  strict: true,
  allowPositionals: false,
  options: {
    'help': { type: 'boolean', short: 'h' },
    'id': { type: 'string' },
    'name': { type: 'string' },
    'author': { type: 'string' },
    'description': { type: 'string' },
    'prefix': { type: 'string' },
    'versioning': { type: 'string' },
    'formatter': { type: 'string' },
    'agent-dir': { type: 'string' },
    'forum-link': { type: 'string' },
    'github-url': { type: 'string' },
    'crowdin-project-id': { type: 'string' },
    'template-commit': { type: 'string' },
    ...pruneOptions
  }
} as const;

type Flags = ReturnType<typeof parseArgs<typeof flagConfig>>['values'];

function parse(args: readonly string[]): Flags {
  try {
    return parseArgs({ ...flagConfig, args: [...args] }).values;
  } catch (error) {
    // A mistake on the command line carries a parseArgs code; anything else is a bug, kept with its
    // stack.
    const isUsageError =
      error instanceof Error &&
      'code' in error &&
      typeof error.code == 'string' &&
      error.code.startsWith('ERR_PARSE_ARGS_');

    if (!isUsageError) {
      throw error;
    }

    throw new InitError(`${error.message}\n\n${USAGE}`, { cause: error });
  }
}

function parseId(id: string): string {
  if (!/^[A-Z][A-Za-z0-9]*$/u.test(id)) {
    throw new InitError(`--id must be PascalCase letters and digits, as a C# identifier: "${id}".`);
  }

  if (id == placeholders.id) {
    throw new InitError(`--id is the template's own name: give the mod a name of its own.`);
  }

  return id;
}

function parsePruned(flags: Flags): Set<PartId> {
  const formatter = flags.formatter ?? 'jb';

  if (formatter != 'jb' && formatter != 'dotnet-format') {
    throw new InitError(`--formatter must be jb or dotnet-format: "${formatter}".`);
  }

  return new Set(
    parts
      .filter(part => (part.id == 'jb' ? formatter == 'dotnet-format' : flags[`no-${part.id}`]))
      .map(part => part.id)
  );
}

function parseCrowdinProjectId(
  projectId: string | undefined,
  pruned: ReadonlySet<PartId>
): string | undefined {
  if (projectId != null && !/^\d+$/u.test(projectId)) {
    throw new InitError(`--crowdin-project-id must be the numeric project ID: "${projectId}".`);
  }

  if (projectId != null && pruned.has('crowdin')) {
    throw new InitError(`--crowdin-project-id and --no-crowdin contradict each other.`);
  }

  return projectId;
}

function parseAgentDirectory(directory: string): string {
  const trimmed = directory.replace(/\/+$/u, '');

  const isInside =
    !path.posix.isAbsolute(trimmed) &&
    !trimmed.includes('\\') &&
    trimmed.split('/').every(segment => segment != '' && segment != '.' && segment != '..');

  if (!isInside) {
    throw new InitError(`--agent-dir must be a relative path inside the repository: "${trimmed}".`);
  }

  if (/['"]/u.test(trimmed)) {
    throw new InitError(
      `--agent-dir cannot hold quotes, written into oxfmt.config.ts: "${trimmed}".`
    );
  }

  return trimmed;
}

function required(value: string | undefined, flag: string): string {
  if (!value?.trim()) {
    throw new InitError(`${flag} is required.\n\n${USAGE}`);
  }

  return value.trim();
}

function singleLine(value: string, flag: string): string {
  if (/[\n\r]/u.test(value)) {
    throw new InitError(`${flag} must fit on one line.`);
  }

  return value;
}

function url(value: string | undefined, flag: string): string | undefined {
  if (value != null && !/^https:\/\/\S+$/u.test(value)) {
    throw new InitError(`${flag} must be an https:// URL: "${value}".`);
  }

  return value;
}

/**
 * Reads the commit to record as the mod's initial one (HEAD, the template unmodified) and the
 * template commit it was made from (HEAD again, unless HEAD is a commit of the mod's own history).
 */
function readCommits(
  root: string,
  options: InitOptions
): { initialCommit: string; templateCommit: string } {
  const head = tryGit(root, ['rev-parse', '--verify', '--quiet', 'HEAD^{commit}']);

  if (!head) {
    throw new InitError(
      `This repository has no commit to record. Init records the commit of the unmodified ` +
        `template it starts from: commit the template as it is first (\`git init\`, ` +
        `\`git add -A\`, \`git commit -m "chore: start from Greenfield Mod Template"\`), and ` +
        `pass the template commit you started from as --template-commit ` +
        `(\`git ls-remote ${TEMPLATE_REPOSITORY} HEAD\` gives the latest).`
    );
  }

  if (git(root, ['status', '--porcelain'])) {
    throw new InitError(
      `The working tree has uncommitted changes. Commit or stash them first, so the initial ` +
        `commit init records holds every file it starts from.`
    );
  }

  if (options.templateCommit) {
    return { initialCommit: head, templateCommit: options.templateCommit };
  }

  const isShallow = git(root, ['rev-parse', '--is-shallow-repository']) == 'true';

  const isRoot = git(root, ['rev-list', '--parents', '-n', '1', 'HEAD']).split(' ').length == 1;

  if (isRoot && !isShallow) {
    throw new InitError(
      `HEAD is the first commit of a history of its own, not a template commit. Pass the ` +
        `template commit you started from as --template-commit (\`git ls-remote ` +
        `${TEMPLATE_REPOSITORY} HEAD\` gives the latest).`
    );
  }

  return { initialCommit: head, templateCommit: head };
}

function git(cwd: string, args: readonly string[]): string {
  const result = Bun.spawnSync(['git', ...args], { cwd, stderr: 'pipe' });

  if (!result.success) {
    throw new InitError(`git ${args.join(' ')} failed: ${result.stderr.toString().trim()}`);
  }

  return result.stdout.toString().trim();
}

function tryGit(cwd: string, args: readonly string[]): string | undefined {
  const result = Bun.spawnSync(['git', ...args], { cwd, stderr: 'ignore' });

  return result.success ? result.stdout.toString().trim() : undefined;
}

async function readContent(file: string): Promise<string | Uint8Array> {
  const bytes = await Bun.file(file).bytes();

  if (bytes.includes(0)) {
    return bytes;
  }

  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return bytes;
  }
}

/**
 * Prunes declared material from the in-memory tree, failing on any declaration that no longer
 * matches the template.
 */
class Pruning {
  // Set as a part drops packages, for init to update the lockfile once pruning is done.
  public hasRemovedPackages = false;

  private readonly tree: Map<string, string | Uint8Array>;

  private readonly kept: ReadonlySet<PartId>;

  // Grows as parts prune, so a later part skips what an earlier one deleted, and the write removes
  // each folder whole.
  public readonly deletedPaths: string[] = [];

  public constructor(tree: Map<string, string | Uint8Array>, kept: ReadonlySet<PartId>) {
    this.tree = tree;
    this.kept = kept;
  }

  public prune(removal: Removal): void {
    for (const file of removal.files) {
      if (!this.wasDeleted(file) && !this.delete(file)) {
        throw new InitError(`Declared file or folder not found: ${file}.`);
      }
    }

    for (const task of removal.tasks) {
      updateText(this.tree, 'mise.toml', toml => removeTask(toml, task));
    }

    if (removal.packages.length) {
      updateText(this.tree, 'package.json', json => removePackages(json, removal.packages));

      this.hasRemovedPackages = true;
    }

    if (removal.localeKeys) {
      updateLocales(this.tree, locale => {
        const keys = Object.keys(locale).filter(key => removal.localeKeys?.test(key));

        if (!keys.length) {
          throw new InitError(`No locale key matches ${String(removal.localeKeys)}.`);
        }

        return Object.fromEntries(Object.entries(locale).filter(([key]) => !keys.includes(key)));
      });
    }

    for (const edit of removal.edits) {
      if (edit.when && !edit.when(this.kept)) {
        continue;
      }

      if (!this.tree.has(edit.file) && this.wasDeleted(edit.file)) {
        continue;
      }

      updateText(this.tree, edit.file, content => applyEdit(content, edit));
    }
  }

  public deleteIfPresent(file: string): void {
    this.delete(file);
  }

  private delete(file: string): boolean {
    const matches = [...this.tree.keys()].filter(
      candidate => candidate == file || candidate.startsWith(`${file}/`)
    );

    for (const match of matches) {
      this.tree.delete(match);
    }

    this.deletedPaths.push(file);

    return matches.length > 0;
  }

  private wasDeleted(file: string): boolean {
    return this.deletedPaths.some(deleted => file == deleted || file.startsWith(`${deleted}/`));
  }
}

/**
 * Changes a text file of the tree, naming the file in any InitError the change throws.
 */
function updateText(
  tree: Map<string, string | Uint8Array>,
  file: string,
  change: (content: string) => string
): void {
  const content = tree.get(file);

  if (typeof content != 'string') {
    throw new InitError(`Declared text file not found: ${file}.`);
  }

  try {
    tree.set(file, change(content));
  } catch (error) {
    throw error instanceof InitError
      ? new InitError(`${file}: ${error.message}`, { cause: error })
      : error;
  }
}

function applyEdit(content: string, edit: Edit): string {
  if (typeof edit.find == 'string') {
    const pieces = content.split(edit.find);

    assertOneMatch(pieces.length - 1, edit.find);

    return pieces.join(edit.replace);
  }

  const global = new RegExp(edit.find.source, `${edit.find.flags.replace('g', '')}g`);

  assertOneMatch([...content.matchAll(global)].length, edit.find);

  // A single match makes the global replace the same as a first-match one.
  return content.replace(global, edit.replace);
}

function assertOneMatch(count: number, find: string | RegExp): void {
  if (count != 1) {
    throw new InitError(
      `expected one match of ${typeof find == 'string' ? JSON.stringify(find) : String(find)}, ` +
        `found ${count}.`
    );
  }
}

/**
 * Removes a mise task: the blank-line-separated paragraph holding its header, with the comments
 * right above it, and a section heading left with no task under it.
 */
function removeTask(toml: string, task: string): string {
  const header = `[tasks."${task}"]`;

  const paragraphs = toml.trimEnd().split('\n\n');

  const index = paragraphs.findIndex(paragraph => paragraph.split('\n').includes(header));

  if (index == -1) {
    throw new InitError(`no task ${header}.`);
  }

  paragraphs.splice(index, 1);

  const isHeading = (paragraph: string | undefined): boolean =>
    paragraph == null || /^# [^\n]+\n# =+$/u.test(paragraph);

  const remaining = paragraphs.filter(
    (paragraph, i) => !(isHeading(paragraph) && isHeading(paragraphs[i + 1]))
  );

  return `${remaining.join('\n\n')}\n`;
}

function removePackages(json: string, names: readonly string[]): string {
  const manifest = JSON.parse(json) as {
    dependencies?: Record<string, string> | undefined;
    devDependencies?: Record<string, string> | undefined;
    trustedDependencies?: string[] | undefined;
  };

  for (const name of names) {
    if (manifest.dependencies?.[name] == null && manifest.devDependencies?.[name] == null) {
      throw new InitError(`no package ${name}.`);
    }
  }

  const without = (
    dependencies: Record<string, string> | undefined
  ): Record<string, string> | undefined =>
    dependencies &&
    Object.fromEntries(Object.entries(dependencies).filter(([name]) => !names.includes(name)));

  manifest.dependencies = without(manifest.dependencies);
  manifest.devDependencies = without(manifest.devDependencies);
  manifest.trustedDependencies = manifest.trustedDependencies?.filter(
    trusted => !names.includes(trusted)
  );

  return `${JSON.stringify(manifest, null, 2)}\n`;
}

function updateLocales(
  tree: Map<string, string | Uint8Array>,
  change: (locale: Record<string, string>) => Record<string, string>
): void {
  const pattern = new RegExp(`^${placeholders.id}/Locales/[^/]+\\.json$`, 'u');

  for (const [file, content] of tree) {
    if (pattern.test(file) && typeof content == 'string') {
      const locale = JSON.parse(content) as Record<string, string>;

      tree.set(file, `${JSON.stringify(change(locale), null, 2)}\n`);
    }
  }
}

/**
 * Replaces AGENTS.md's template-maintenance section with the pointer to where the mod came from.
 */
function writeTemplateOrigin(tree: Map<string, string | Uint8Array>): void {
  const agents = tree.get('AGENTS.md');

  if (typeof agents != 'string') {
    throw new InitError(`AGENTS.md not found.`);
  }

  const section =
    `## Template origin\n` +
    `\n` +
    `This mod was made from [Greenfield Mod Template](${TEMPLATE_REPOSITORY}).\n` +
    `\`.template.json\` records the template commit it was made from, the parts it kept, the ` +
    `template names it replaced, and where its skills and rules live; the update skill, run ` +
    `from a clone of the template, reads it.\n` +
    `A part this mod lacks may exist in its initial commit, \`initialCommit\` there, the template ` +
    `unmodified: \`git ls-tree -r --name-only <initialCommit>\` lists its files and ` +
    `\`git show <initialCommit>:<path>\` reads one, under the template names \`names\` maps to ` +
    `this mod's.\n`;

  tree.set(
    'AGENTS.md',
    applyEdit(agents, {
      file: 'AGENTS.md',
      find: /<!-- template-maintenance:start -->\n[\s\S]*<!-- template-maintenance:end -->\n/u,
      replace: section
    })
  );
}

/**
 * Resets the fields each mod sets for itself: version, publish configuration and its mod ID,
 * changelog, description, author, display name in the locales, Crowdin project.
 *
 * It writes into the renamed tree, so the user's text, which may hold a template name, never meets
 * the rename; the locales are rebuilt from the `template` tree's, where the display name is still
 * the placeholder.
 */
function writeModFields(
  tree: Map<string, string | Uint8Array>,
  template: ReadonlyMap<string, string | Uint8Array>,
  options: InitOptions,
  rename: (text: string) => string
): void {
  // The replacements carry user text, whose `$` sequences a pattern replace would expand.
  const edit = (file: string, find: string | RegExp, replace: string): void => {
    updateText(tree, file, content =>
      applyEdit(content, {
        file,
        find,
        replace: typeof find == 'string' ? replace : literal(replace)
      })
    );
  };

  const version = options.versioning == 'calver' ? `${new Date().getFullYear()}.0.0` : '1.0.0';

  const publish = rename(`${placeholders.id}/Properties/PublishConfiguration.xml`);

  edit(
    rename(`${placeholders.id}/${placeholders.id}.csproj`),
    /<Version>[^<]*<\/Version>/u,
    `<Version>${version}</Version>`
  );

  edit(publish, /<DisplayName Value="[^"]*" \/>/u, `<DisplayName Value="${xml(options.name)}" />`);

  edit(
    publish,
    /<ShortDescription Value="[^"]*" \/>/u,
    `<ShortDescription Value="${xml(options.description)}" />`
  );

  edit(
    publish,
    /<LongDescription>[\s\S]*?<\/LongDescription>/u,
    `<LongDescription>${xml(longDescription(options))}</LongDescription>`
  );

  edit(publish, /<ModId Value="[^"]*" \/>/u, '<ModId Value="" />');

  edit(publish, /<ModVersion Value="[^"]*" \/>/u, `<ModVersion Value="${version}" />`);

  edit(publish, /<ChangeLog>[\s\S]*?<\/ChangeLog>/u, `<ChangeLog>- First release.</ChangeLog>`);

  edit(
    publish,
    /<ForumLink Value="[^"]*" \/>/u,
    `<ForumLink Value="${xml(options.forumLink ?? '')}" />${
      options.githubUrl ? `\n  <ExternalLink Type="github" Url="${xml(options.githubUrl)}" />` : ''
    }`
  );

  tree.set(rename(`${placeholders.id}/ChangeLog.md`), '- First release.\n');

  tree.set(rename(`${placeholders.id}/LongDescription.md`), `${longDescription(options)}\n`);

  edit(
    rename(`${placeholders.id}/UI/mod.json`),
    /"author": "[^"]*"/u,
    `"author": ${JSON.stringify(options.author)}`
  );

  // The mod's name in the locale texts becomes its display name, and the rename reaches the text
  // around it; a `Greenfield.` stays an ID, as in a `{KEY=...}` reference, which the rename turns
  // into the mod's.
  const nameInText = new RegExp(`${placeholders.id}(?!\\.|${TEMPLATE_NAME_TAIL})`, 'u');

  const localePattern = new RegExp(`^${placeholders.id}/Locales/[^/]+\\.json$`, 'u');

  for (const [file, content] of template) {
    if (localePattern.test(file) && typeof content == 'string') {
      const locale = JSON.parse(content) as Record<string, string>;

      const named = Object.entries(locale).map(([key, text]) => [
        rename(key),
        text
          .split(nameInText)
          .map(part => rename(part))
          .join(options.name)
      ]);

      tree.set(rename(file), `${JSON.stringify(Object.fromEntries(named), null, 2)}\n`);
    }
  }

  if (options.crowdinProjectId) {
    edit(
      'mise.toml',
      'CROWDIN_PROJECT_ID = ""',
      `CROWDIN_PROJECT_ID = "${options.crowdinProjectId}"`
    );
  }

  if (options.versioning == 'semver') {
    edit(
      rename('.claude/skills/gfd-release/SKILL.md'),
      /`<year>\.<feature>\.<patch>`, read off the last tag:\n\n[\s\S]*?\n\n/u,
      '`<major>.<minor>.<patch>`, read off the last tag, never with a pre-release suffix: the game parses the version as a `System.Version`.\n' +
        '\n' +
        '- Some change breaks what players rely on (a feature removed, settings or saved data no longer read) → major + 1, minor and patch 0.\n' +
        '- Some change in the log is a new capability the player can see → minor + 1, patch 0.\n' +
        '- Fixes, translations and internals only → patch + 1.\n' +
        '\n'
    );
  }
}

function longDescription(options: InitOptions): string {
  return `# ${options.name}\n\n${options.description}`;
}

/**
 * A text as a `String.replace` replacement, its `$` sequences taken literally.
 */
function literal(text: string): string {
  return text.replaceAll('$', '$$$$');
}

function xml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

/**
 * Replaces the template names in a text or a path.
 */
function renamer(
  names: Readonly<Record<keyof typeof placeholders, string>>
): (text: string) => string {
  const replacements: ReadonlyArray<[RegExp, string]> = [
    [new RegExp(`${placeholders.id}(?!${TEMPLATE_NAME_TAIL})`, 'gu'), names.id],
    [new RegExp(`${placeholders.camelId}(?!${TEMPLATE_NAME_TAIL})`, 'gu'), names.camelId],
    [new RegExp(`\\b${placeholders.prefix}-`, 'gu'), `${names.prefix}-`]
  ];

  return text =>
    replacements.reduce((renamed, [pattern, name]) => renamed.replaceAll(pattern, name), text);
}

/**
 * Moves the skills and rules to the mod's agent directory, rewriting every path to them and the
 * relative links of every moved or linking Markdown file.
 */
function relocateAgentFiles(
  tree: Map<string, string | Uint8Array>,
  agentDirectory: string
): Map<string, string | Uint8Array> {
  if (agentDirectory == TEMPLATE_AGENT_DIRECTORY) {
    return tree;
  }

  const oldPrefix = new RegExp(
    `^${escapeRegExp(TEMPLATE_AGENT_DIRECTORY)}/(?<kind>skills|rules)/`,
    'u'
  );

  const move = (file: string): string =>
    file.replace(oldPrefix, (_, kind: string) => `${agentDirectory}/${kind}/`);

  const reference = new RegExp(
    `${escapeRegExp(TEMPLATE_AGENT_DIRECTORY)}/(?<kind>skills|rules)\\b`,
    'gu'
  );

  const relocated = new Map<string, string | Uint8Array>();

  for (const [file, content] of tree) {
    if (typeof content != 'string') {
      relocated.set(move(file), content);

      continue;
    }

    let text = content.replaceAll(reference, (_, kind: string) => `${agentDirectory}/${kind}`);

    if (file.endsWith('.md')) {
      text = rewriteLinks(text, file, move(file), move);
    }

    relocated.set(move(file), text);
  }

  // The skills and rules keep their own layout wherever they live.
  const ignored = `'${agentDirectory}/skills', '${agentDirectory}/rules'`;

  updateText(relocated, 'oxfmt.config.ts', config =>
    applyEdit(config, {
      file: 'oxfmt.config.ts',
      find: "ignorePatterns: ['.claude', ",
      replace: `ignorePatterns: ['.claude', ${ignored}, `
    })
  );

  // Rider shows the agent directory in its tree only when the index layout includes it.
  const indexLayout = [...relocated.keys()].find(file => file.endsWith('/.idea/indexLayout.xml'));

  if (indexLayout == null) {
    throw new InitError(`No Rider index layout (.idea/.idea.*/.idea/indexLayout.xml) to update.`);
  }

  const [topDirectory] = agentDirectory.split('/');

  const marker = `      <Path>${TEMPLATE_AGENT_DIRECTORY}</Path>\n`;

  updateText(relocated, indexLayout, layout =>
    layout.includes(`<Path>${topDirectory}</Path>`)
      ? layout
      : applyEdit(layout, {
          file: indexLayout,
          find: marker,
          replace: `${marker}      <Path>${topDirectory}</Path>\n`
        })
  );

  return relocated;
}

function rewriteLinks(
  text: string,
  oldFile: string,
  newFile: string,
  move: (file: string) => string
): string {
  return text.replaceAll(/\]\((?<target>[^)\s]+)\)/gu, (link, target: string) => {
    if (/^(?:[a-z]+:|#|\/)/u.test(target)) {
      return link;
    }

    const [targetPath = '', anchor] = target.split('#');

    const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(oldFile), targetPath));

    const relative = path.posix.relative(path.posix.dirname(newFile), move(resolved)) || '.';

    return `](${relative}${anchor == null ? '' : `#${anchor}`})`;
  });
}

/**
 * The mod's README: its name and description, and a development setup for the parts it kept.
 */
export function modReadme(options: InitOptions, kept: ReadonlySet<PartId>): string {
  const wizard = WIZARD_SKILL.replace(`${placeholders.prefix}-`, `${options.prefix}-`).replace(
    `${TEMPLATE_AGENT_DIRECTORY}/`,
    () => `${options.agentDirectory}/`
  );

  const commands = [
    '- `mise build`: Builds the mod and deploys it to the game, which must be closed.',
    '- `mise build:ui`: Builds and deploys the UI alone, with the game open.',
    '- `mise dev`: Rebuilds the UI on every change.',
    '- `mise check`: Type-checks the UI, lints it, and checks its formatting.',
    ...(kept.has('jb') ? [] : ['- `mise check:cs`: Checks the C# formatting.']),
    '- `mise fix`: Applies the lint fixes, then formats the TypeScript and the C#.',
    `- \`mise test\`: Runs the off-engine C# tests${
      kept.has('float64') ? ' (a float32 pass, then a float64 pass)' : ''
    }${kept.has('ui-tests') ? ', the UI tests,' : ''} and the scripts' tests.`,
    ...(kept.has('crowdin')
      ? [
          "- `mise l10n:pull`, `mise l10n:push`: Pull translations from Crowdin and push the repo's edits to it."
        ]
      : []),
    '- `mise publish`: Publishes a new version on Paradox Mods.'
  ];

  const toolchain = kept.has('linux-setup')
    ? `- The game's modding toolchain, installed from the game's Modding options. On Linux, where that installer cannot run, \`mise setup:linux\` installs it.`
    : `- The game's modding toolchain, installed from the game's Modding options.`;

  return [
    `# ${options.name}`,
    '',
    options.description,
    '',
    '## Development',
    '',
    `This mod started from [Greenfield Mod Template](${TEMPLATE_REPOSITORY}), whose README explains its tooling and the reasons behind it.`,
    '',
    '### Setup',
    '',
    '- [mise](https://mise.jdx.dev), then `mise install` for the pinned bun and .NET SDK.',
    toolchain,
    '- `bun install`, then `bunx lefthook install` for the git hooks.',
    '',
    '### Commands',
    '',
    ...commands,
    '',
    'Run `mise tasks` for the full list.',
    '',
    kept.has('game-tests')
      ? "An agent restarts the game and runs the in-game scenarios with the `cs2-modding` plugin's `cs2-dev` tools."
      : "An agent restarts the game with the `cs2-modding` plugin's `cs2-dev` tools.",
    ...(kept.has('sample-slice')
      ? [
          '',
          "The entity counter is a sample: it shows how the C# systems, the bindings and the UI connect. The template's README lists its files, for when you delete it."
        ]
      : []),
    '',
    '<!-- setup-note:start -->',
    '',
    '> [!NOTE]',
    `> If you ran \`mise init\` by hand rather than through the setup wizard: delete \`${wizard}/\`, add a \`LICENSE\`, ${kept.has('jb') ? '' : 'run `mise fix:cs`, '}and run \`bunx lefthook install\` before committing the mod, then delete this note.`,
    '',
    '<!-- setup-note:end -->',
    ''
  ].join('\n');
}

/**
 * Writes the new tree over the checkout: deletes what is gone, writes what changed, then moves the
 * untracked leftovers of each renamed folder (build output, IDE state) to its new name.
 */
async function writeTree(
  root: string,
  changes: {
    readonly original: ReadonlyMap<string, string | Uint8Array>;
    readonly final: ReadonlyMap<string, string | Uint8Array>;
    readonly pruned: readonly string[];
    readonly rename: (file: string) => string;
  }
): Promise<{ deleted: number; written: number }> {
  const { original, final, pruned, rename } = changes;

  const originalPaths = [...original.keys()];

  let deleted = 0;

  let written = 0;

  for (const file of originalPaths) {
    if (!final.has(file)) {
      await rm(path.join(root, file));

      deleted++;
    }
  }

  // A pruned folder goes whole, with what the tree does not track in it (generated types, build
  // output), so the rename moves only what the mod keeps.
  // It runs before the writes, which can put the agent directory inside a pruned folder.
  for (const declared of pruned) {
    await rm(path.join(root, declared), { recursive: true, force: true });
  }

  for (const [file, content] of final) {
    const target = path.join(root, file);

    const isUnchanged =
      original.has(file) && (typeof content != 'string' || content == original.get(file));

    if (!isUnchanged) {
      await mkdir(path.dirname(target), { recursive: true });

      await Bun.write(target, content);

      written++;
    }
  }

  for (const file of originalPaths) {
    if (!final.has(file)) {
      await removeEmptyParents(root, path.dirname(file));
    }
  }

  for (const folder of renamedFolders(originalPaths)) {
    await moveLeftovers(path.join(root, folder), path.join(root, rename(folder)));
  }

  return { deleted, written };
}

/**
 * The outermost folders whose name holds the template ID, which the rename moves.
 */
function renamedFolders(originalPaths: readonly string[]): Set<string> {
  const folders = new Set<string>();

  for (const file of originalPaths) {
    const segments = file.split('/');

    const index = segments.findIndex(segment => segment.includes(placeholders.id));

    if (index != -1 && index < segments.length - 1) {
      folders.add(segments.slice(0, index + 1).join('/'));
    }
  }

  return folders;
}

async function moveLeftovers(from: string, to: string): Promise<void> {
  if (!existsSync(from)) {
    return;
  }

  for (const entry of await readdir(from, { withFileTypes: true })) {
    const source = path.join(from, entry.name);

    const target = path.join(to, entry.name);

    if (!existsSync(target)) {
      await mkdir(to, { recursive: true });

      await movePath(source, target);
    } else if (entry.isDirectory()) {
      await moveLeftovers(source, target);
    }
  }

  try {
    await rmdir(from);
  } catch {
    // Something untracked had nowhere to go: the old folder stays for the user to sort.
  }
}

async function removeEmptyParents(root: string, directory: string): Promise<void> {
  for (let current = directory; current != '.'; current = path.dirname(current)) {
    try {
      await rmdir(path.join(root, current));
    } catch {
      return;
    }
  }
}

/**
 * Drops the removed packages from bun.lock, offline: bun resolves what remains from the lockfile.
 */
function updateLockfile(root: string): boolean {
  return Bun.spawnSync([process.execPath, 'install', '--lockfile-only'], {
    cwd: root,
    stdout: 'ignore',
    stderr: 'ignore'
  }).success;
}

/**
 * Formats the result with `bun fmt`, once the packages oxfmt.config.ts loads are installed: the
 * rename changes line lengths, which moves where the formatter wraps.
 */
function format(root: string): boolean {
  if (!existsSync(path.join(root, 'node_modules', 'oxfmt'))) {
    return false;
  }

  return Bun.spawnSync([process.execPath, 'fmt'], {
    cwd: root,
    stdout: 'ignore',
    stderr: 'ignore'
  }).success;
}

// Last, so every module-level constant the CLI reads is initialized when it runs.
if (import.meta.main) {
  try {
    const options = parseArguments(process.argv.slice(2));

    if (options) {
      const report = await initialize(path.join(import.meta.dir, '..'), options);

      console.log(
        `Initialized ${options.id}: ${report.written} files written, ${report.deleted} deleted, ` +
          `from template commit ${report.templateCommit}.`
      );

      if (!report.isLockfileCurrent) {
        console.log(`Run \`bun install\` to update bun.lock.`);
      }

      if (!report.isFormatted) {
        console.log(`Run \`bun install\`, then \`mise fix:oxfmt\`, to format the renamed files.`);
      }
    } else {
      console.log(USAGE);
    }
  } catch (error) {
    if (!(error instanceof InitError)) {
      throw error;
    }

    console.error(`mise init: ${error.message}`);

    process.exitCode = 1;
  }
}
