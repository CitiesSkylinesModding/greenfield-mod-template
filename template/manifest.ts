// What `mise init` changes, as data: the template's placeholder names, the optional parts a mod can
// prune, and the template-only material every mod sheds. template/init.ts applies it, and
// template/init.test.ts checks every part against it.
//
// Every path is the template's own, before the rename. An edit's `find` must match exactly once in
// its file at the moment it applies, or init fails and writes nothing: a template change that moves
// a declared text breaks the tests instead of a mod.

/**
 * The template's names init replaces with the mod's, in file contents and paths.
 */
export const placeholders = {
  /**
   * The PascalCase mod ID: folders, projects, namespace, locale keys.
   */
  id: 'Greenfield',
  /**
   * The camelCase ID: the binding groups.
   */
  camelId: 'greenfield',
  /**
   * The short prefix: the CSS class prefix and the skill names.
   */
  prefix: 'gfd'
} as const;

/**
 * What follows a placeholder in the template's own name and repository slug, which name the
 * template in a mod and so keep it: `Greenfield Mod Template`, `greenfield-mod-template`.
 */
export const TEMPLATE_NAME_TAIL = ' Mod Template|-mod-template';

/**
 * Where the template keeps the skills and rules, which init moves to the mod's agent directory.
 */
export const AGENT_DIRECTORY = '.claude';

/**
 * The setup wizard skill: it survives init, and deletes itself after the first run.
 */
export const WIZARD_SKILL = '.claude/skills/gfd-setup';

/**
 * The update skill, which brings template changes into a mod from the template repository alone.
 */
export const UPDATE_SKILL = '.claude/skills/gfd-template-update';

/**
 * Where the template is published, recorded in `.template.json` for the update skill.
 */
export const TEMPLATE_REPOSITORY =
  'https://github.com/CitiesSkylinesModding/greenfield-mod-template';

export type PartId =
  | 'sample-slice'
  | 'ui-tests'
  | 'game-tests'
  | 'crowdin'
  | 'linux-setup'
  | 'float64'
  | 'jb';

export interface Edit {
  readonly file: string;

  /**
   * Matches exactly once; a RegExp replaces with its `$n` groups.
   */
  readonly find: string | RegExp;

  readonly replace: string;

  /**
   * Applies the edit only for these kept parts, for a text two parts share.
   */
  readonly when?: (kept: ReadonlySet<PartId>) => boolean;
}

/**
 * What pruning a part removes or rewrites. Edits to a file another pruned part deletes are skipped.
 */
export interface Removal {
  /**
   * Files and folders deleted.
   */
  readonly files: readonly string[];

  /**
   * Mise tasks deleted from `mise.toml`, with the comments above them.
   */
  readonly tasks: readonly string[];

  /**
   * Npm packages dropped from `package.json`, the lockfile updated.
   */
  readonly packages: readonly string[];

  /**
   * Locale keys dropped from every `Locales/*.json`.
   */
  readonly localeKeys?: RegExp;

  /**
   * Csproj items, AGENTS.md sections, lefthook entries, and every other line the part owns.
   */
  readonly edits: readonly Edit[];

  /**
   * Texts left nowhere in the mod once the part is pruned, which the init tests assert.
   */
  readonly traces: ReadonlyArray<string | RegExp>;
}

export interface Part extends Removal {
  readonly id: PartId;

  /**
   * The `mise init` flag pruning it.
   */
  readonly flag: string;

  readonly title: string;
}

const AGENTS_MD = 'AGENTS.md';

const MISE_TOML = 'mise.toml';

const LEFTHOOK_YML = 'lefthook.yml';

const CSPROJ = 'Greenfield/Greenfield.csproj';

const TESTS_CSPROJ = 'Greenfield.Tests/Greenfield.Tests.csproj';

const EDITORCONFIG = '.editorconfig';

const INDEX_LAYOUT = '.idea/.idea.Greenfield/.idea/indexLayout.xml';

const BUNFIG_TOML = 'bunfig.toml';

const OFF_ENGINE_SKILL = '.claude/skills/gfd-cs-offengine-testing/SKILL.md';

const GAME_TESTING_SKILL = '.claude/skills/gfd-game-testing/SKILL.md';

const GAME_UPDATE_SKILL = '.claude/skills/gfd-game-update/SKILL.md';

const RELEASE_SKILL = '.claude/skills/gfd-release/SKILL.md';

const TRANSLATE_SKILL = '.claude/skills/gfd-translate/SKILL.md';

const UI_TESTING_SKILL = '.claude/skills/gfd-ui-testing/SKILL.md';

const WIZARD_SKILL_MD = `${WIZARD_SKILL}/SKILL.md`;

/**
 * The wizard's steps before init, which the mod never runs again.
 */
const WIZARD_INTERVIEW = `${WIZARD_SKILL}/interview.md`;

/**
 * Removes a whole line, its newline included.
 */
function line(start: string): RegExp {
  return new RegExp(`^${escapeRegExp(start)}.*\\n`, 'mu');
}

export function escapeRegExp(text: string): string {
  return text.replaceAll(/[.*+?^${}()|[\]\\]/gu, String.raw`\$&`);
}

const sampleSlice: Part = {
  id: 'sample-slice',
  flag: '--no-sample-slice',
  title: 'Sample slice (the entity counter)',
  files: [
    'Greenfield/Systems/EntityCounterSystem.cs',
    'Greenfield/Systems/EntityCounterUISystem.cs',
    'Greenfield/Utils/Writers/EntityCountValueWriter.cs',
    'Greenfield/Scenarios/EntityCounterScenario.cs',
    'Greenfield.Tests/Systems/EntityCounterSystemTests.cs',
    'Greenfield.Tests/Utils/Writers/EntityCountValueWriterTests.cs',
    'Greenfield/UI/src/entity-counter',
    'Greenfield/UI/src/utils/bindings/entity-counter.ts'
  ],
  tasks: [],
  packages: [],
  localeKeys: /EntityCounter|ENTITYKIND|CountedEntity|INPUT_MAP/u,
  edits: [
    {
      file: 'Greenfield/Mod.cs',
      find:
        '      updateSystem.UpdateAt<EntityCounterSystem>(SystemUpdatePhase.ModificationEnd);\n' +
        '      updateSystem.UpdateAt<EntityCounterUISystem>(SystemUpdatePhase.UIUpdate);\n',
      replace: ''
    },
    { file: 'Greenfield/Settings.cs', find: 'using System;\n', replace: '' },
    { file: 'Greenfield/Settings.cs', find: 'using Game.Input;\n', replace: '' },
    {
      file: 'Greenfield/Settings.cs',
      find:
        '[SettingsUIGroupOrder(Settings.GroupEntityCounter, Settings.GroupAdvanced)]\n' +
        '[SettingsUIShowGroupName(Settings.GroupEntityCounter, Settings.GroupAdvanced)]\n' +
        '[SettingsUIKeyboardAction(\n' +
        '  nameof(Settings.KeyBindingToggleEntityCounter),\n' +
        '  Usages.kDefaultUsage,\n' +
        '  Usages.kToolUsage\n' +
        ')]\n',
      replace:
        '[SettingsUIGroupOrder(Settings.GroupAdvanced)]\n' +
        '[SettingsUIShowGroupName(Settings.GroupAdvanced)]\n'
    },
    {
      file: 'Greenfield/Settings.cs',
      find: '  private const string GroupEntityCounter = "EntityCounter";\n\n',
      replace: ''
    },
    {
      file: 'Greenfield/Settings.cs',
      find: / {2}\/\/\/ <summary>\n {2}\/\/\/ What the entity counter panel counts\.[\s\S]*?KeyBindingToggleEntityCounter \{ get; set; \}\n\n/u,
      replace: ''
    },
    {
      file: 'Greenfield/Settings.cs',
      find: '  public override void SetDefaults() => this.CountedEntity = EntityKind.Buildings;\n',
      replace:
        '  public override void SetDefaults() {\n' +
        "    // Each setting's default goes here.\n" +
        '  }\n'
    },
    {
      file: 'Greenfield/Settings.cs',
      find: /\n\n {4}writer\.PropertyName\("countedEntity"\);[\s\S]*?\n {4}\);\n\n/u,
      replace: '\n'
    },
    {
      file: 'Greenfield/Settings.cs',
      find: /\n\n {2}\/\/\/ <summary>\n {2}\/\/\/ The entities the entity counter counts[\s\S]*?\n {2}\}\n/u,
      replace: '\n'
    },
    {
      file: 'Greenfield/UI/src/utils/bindings/common.ts',
      find:
        'export interface ModSettings {\n' +
        '  readonly countedEntity: CountedEntity;\n' +
        '}\n' +
        '\n' +
        '/**\n' +
        ' * Serialization of C# `Greenfield.Settings.CountedEntity`, camelCase.\n' +
        ' */\n' +
        "export type CountedEntity = 'buildings' | 'citizens' | 'vehicles';\n" +
        '\n' +
        "const settings$ = lazyBindValue<ModSettings>(GROUP, 'settings', {\n" +
        "  countedEntity: 'buildings'\n" +
        '});\n',
      replace:
        '// oxlint-disable-next-line typescript/no-empty-interface, typescript/no-empty-object-type - the next setting the UI reads goes here.\n' +
        'export interface ModSettings {}\n' +
        '\n' +
        "const settings$ = lazyBindValue<ModSettings>(GROUP, 'settings', {});\n"
    },
    {
      file: 'Greenfield/UI/src/utils/bindings/index.ts',
      find: "export * from './entity-counter';\n",
      replace: ''
    },
    {
      file: 'Greenfield/UI/src/index.tsx',
      find: "import { register as registerEntityCounter } from './entity-counter';\n",
      replace: ''
    },
    {
      file: 'Greenfield/UI/src/index.tsx',
      find: 'const registrars: readonly ModRegistrar[] = [registerEntityCounter];',
      replace: 'const registrars: readonly ModRegistrar[] = [];'
    },
    {
      file: AGENTS_MD,
      find: ', as `EntityCounterSystem.DebugCount` is.',
      replace: '.'
    },
    {
      file: OFF_ENGINE_SKILL,
      find:
        ', as [`EntityCounterSystem.CountChunkEntities`](../../../Greenfield/Systems/EntityCounterSystem.cs) ' +
        'and its [tests](../../../Greenfield.Tests/Systems/EntityCounterSystemTests.cs) do.',
      replace: '.'
    },
    {
      file: UI_TESTING_SKILL,
      find: ', as [`entity-counter.test.tsx`](../../../Greenfield/UI/src/entity-counter/entity-counter.test.tsx) does.',
      replace: '.'
    },
    {
      file: UI_TESTING_SKILL,
      find: 'See `entity-counter.test.tsx` for a binding-driven render and input action, and [`game-setup.test.tsx`]',
      replace: 'See [`game-setup.test.tsx`]'
    },
    {
      file: GAME_UPDATE_SKILL,
      find: ' or the mods menu button breaks after a patch.',
      replace: " or the mod's UI anchors break after a patch."
    },
    {
      file: GAME_UPDATE_SKILL,
      find: line('- **The mods menu.**'),
      replace:
        "- **The UI anchors.** Every location the mod's registrars append to or extend is still a registry location in the bundle, and what the mod adds there shows in the game (step 5).\n"
    },
    {
      file: GAME_TESTING_SKILL,
      find: 'Copy the shape of [`EntityCounterScenario`](../../../Greenfield/Scenarios/EntityCounterScenario.cs):',
      replace: 'A scenario takes this shape:'
    },
    {
      file: GAME_TESTING_SKILL,
      find: 'RunScenario("Greenfield: Entity counter",',
      replace: 'RunScenario("Greenfield: <name>",'
    }
  ],
  traces: [/entity.?count/iu, /counted.?entit/iu, /entity.?kind/iu, 'mods menu button']
};

const uiTests: Part = {
  id: 'ui-tests',
  flag: '--no-ui-tests',
  title: 'UI tests',
  files: [
    'Greenfield/UI/src/testing',
    'Greenfield/UI/src/components/tooltip.test.tsx',
    'Greenfield/UI/src/entity-counter/entity-counter.test.tsx',
    '.claude/skills/gfd-ui-testing'
  ],
  tasks: ['test:ui'],
  packages: [
    '@happy-dom/global-registrator',
    '@testing-library/dom',
    '@testing-library/react',
    'happy-dom'
  ],
  edits: [
    {
      file: MISE_TOML,
      find: "the off-engine C# tests, the UI tests, and the scripts' tests",
      replace: "the off-engine C# tests and the scripts' tests"
    },
    { file: MISE_TOML, find: '"test:ui", ', replace: '' },
    {
      file: LEFTHOOK_YML,
      find: '    - name: test:ui\n      glob: "*.{ts,tsx,scss}"\n      run: mise test:ui\n',
      replace: ''
    },
    {
      file: AGENTS_MD,
      find: '; tests and scripts run under bun, the UI tests with happy-dom.',
      replace: '; the scripts and their tests run under bun.'
    },
    {
      file: AGENTS_MD,
      find: '; `testing` the UI test harness. UI tests are colocated `*.test.ts` / `*.test.tsx` files.',
      replace: '.'
    },
    {
      file: AGENTS_MD,
      find: 'Run the off-engine C#, UI and scripts tests.',
      replace: 'Run the off-engine C# and scripts tests.'
    },
    { file: AGENTS_MD, find: line('- `mise test:ui`:'), replace: '' },
    {
      file: AGENTS_MD,
      find: ' as an in-game scenario or a UI test.',
      replace: ' as an in-game scenario.',
      when: kept => kept.has('game-tests')
    },
    {
      file: GAME_UPDATE_SKILL,
      find: 'when the UI harness, a vanilla module',
      replace: 'when a vanilla module'
    },
    {
      file: GAME_UPDATE_SKILL,
      find: line('- **The UI test harness.**'),
      replace: ''
    },
    {
      file: BUNFIG_TOML,
      find: /\n(?:#.*\n)*\[test\]\npreload = .*\n/u,
      replace: ''
    }
  ],
  traces: [
    'test:ui',
    'game-setup',
    'happy-dom',
    'testing-library',
    'gfd-ui-testing',
    'UI test',
    'UI harness'
  ]
};

const gameTests: Part = {
  id: 'game-tests',
  flag: '--no-game-tests',
  title: 'In-game test scenarios',
  files: ['Greenfield/Scenarios', '.claude/skills/gfd-game-testing'],
  tasks: [],
  packages: [],
  edits: [
    {
      file: CSPROJ,
      find: '    <Reference Include="Colossal.TestFramework">\n      <Private>false</Private>\n    </Reference>\n',
      replace: ''
    },
    {
      file: CSPROJ,
      find: / {2}<!-- The in-game test scenarios are Debug-only[\s\S]*?<\/ItemGroup>\n\n/u,
      replace: ''
    },
    {
      file: 'Greenfield/Mod.cs',
      find: 'using Greenfield.Scenarios;\n',
      replace: ''
    },
    {
      file: 'Greenfield/Mod.cs',
      find:
        '      #if DEBUG\n' +
        "      // Make the in-game test scenarios available to the game's test framework.\n" +
        '      ScenarioRegistry.Register();\n' +
        '      #endif\n\n',
      replace: ''
    },
    {
      file: 'Greenfield/Systems/EntityCounterSystem.cs',
      find: '  internal EntityQuery GetQuery(',
      replace: '  private EntityQuery GetQuery('
    },
    {
      file: MISE_TOML,
      find: " The in-game scenarios run apart, through the `cs2-dev` MCP server's `test` tool.",
      replace: ''
    },
    {
      file: AGENTS_MD,
      find: ", the in-game scenarios run in the game's own test framework.",
      replace: '.'
    },
    { file: AGENTS_MD, find: line('  - `Scenarios`:'), replace: '' },
    {
      file: AGENTS_MD,
      find: ' as an in-game scenario or a UI test.',
      replace: ' as a UI test.',
      when: kept => kept.has('ui-tests')
    },
    {
      file: AGENTS_MD,
      find: ' as an in-game scenario or a UI test.',
      replace: ' as an off-engine test.',
      when: kept => !kept.has('ui-tests')
    },
    {
      file: OFF_ENGINE_SKILL,
      find: 'is an in-game scenario: the `gfd-game-testing` skill.',
      replace: "is checked in the running game: the `cs2-modding` skill's game-cycle reference."
    },
    { file: OFF_ENGINE_SKILL, find: line("- Where a check's expected values"), replace: '' },
    {
      file: '.claude/skills/gfd-cs-offengine-testing/runtime-differences.md',
      find: ', through the unity eval or a scenario.',
      replace: ', through the unity eval.'
    },
    {
      file: GAME_UPDATE_SKILL,
      find: 'Then the in-game scenarios, through the `cs2-dev` `test` tool (the `gfd-game-testing` skill).\n\n',
      replace: ''
    }
  ],
  traces: [
    'TestFramework',
    'gfd-game-testing',
    'ScenarioRegistry',
    'TestScenarios.log',
    /in-game (?:test )?scenario/iu
  ]
};

const crowdin: Part = {
  id: 'crowdin',
  flag: '--no-crowdin',
  title: 'Crowdin sync',
  files: [
    'scripts/crowdin.ts',
    'scripts/crowdin-pull-translations.ts',
    'scripts/crowdin-push-translations.ts'
  ],
  tasks: ['l10n:pull', 'l10n:push'],
  packages: [],
  edits: [
    { file: MISE_TOML, find: /\[env\]\n(?:#.*\n)*CROWDIN_PROJECT_ID = ".*"\n\n/u, replace: '' },
    {
      file: '.gitignore',
      find: ' (ex. the CROWDIN_PERSONAL_TOKEN `mise l10n:push` needs)',
      replace: ''
    },
    { file: AGENTS_MD, find: line('- `mise l10n:pull`:'), replace: '' },
    { file: AGENTS_MD, find: line('- `mise l10n:push`:'), replace: '' },
    { file: AGENTS_MD, find: line('- With Crowdin set up,'), replace: '' },
    {
      file: AGENTS_MD,
      find: ' (`CROWDIN_PERSONAL_TOKEN` belongs in the environment or `mise.local.toml`)',
      replace: ''
    },
    { file: AGENTS_MD, find: /^- Running `mise l10n:push --push`.*\n(?: {2}.*\n)*/mu, replace: '' },
    { file: TRANSLATE_SKILL, find: ', or when a Crowdin pull or push is wanted', replace: '' },
    { file: TRANSLATE_SKILL, find: /^\*\*Crowdin\*\* is set up when.*\n\n/mu, replace: '' },
    {
      file: TRANSLATE_SKILL,
      find: /## 2\. The volunteers' pending work \(Crowdin\)\n[\s\S]*?\n(?=## 3\. )/u,
      replace: ''
    },
    { file: TRANSLATE_SKILL, find: "## 3. The game's terms", replace: "## 2. The game's terms" },
    { file: TRANSLATE_SKILL, find: '## 4. One translator', replace: '## 3. One translator' },
    { file: TRANSLATE_SKILL, find: '## 5. Cross-review', replace: '## 4. Cross-review' },
    {
      file: TRANSLATE_SKILL,
      find: '## 6. Preview in the game',
      replace: '## 5. Preview in the game'
    },
    {
      file: TRANSLATE_SKILL,
      find: "The game's terms from step 3",
      replace: "The game's terms from step 2"
    },
    { file: TRANSLATE_SKILL, find: 'briefed as in step 4.', replace: 'briefed as in step 3.' },
    { file: TRANSLATE_SKILL, find: line('Volunteer strings go in with'), replace: '' },
    {
      file: TRANSLATE_SKILL,
      find: 'the step 4 check still passes',
      replace: 'the step 3 check still passes'
    },
    { file: TRANSLATE_SKILL, find: /\n## 7\. The push \(Crowdin\)\n[\s\S]*$/u, replace: '' },
    {
      file: RELEASE_SKILL,
      find: /## 2\. Pull the pending Crowdin translations[\s\S]*?\n(?=## 3\. )/u,
      replace: ''
    },
    { file: RELEASE_SKILL, find: '## 3. Build Release', replace: '## 2. Build Release' },
    { file: RELEASE_SKILL, find: '## 4. Choose the version', replace: '## 3. Choose the version' },
    {
      file: RELEASE_SKILL,
      find: '## 5. Rewrite the changelog',
      replace: '## 4. Rewrite the changelog'
    },
    {
      file: RELEASE_SKILL,
      find: '## 6. Gate: the user reviews',
      replace: '## 5. Gate: the user reviews'
    },
    { file: RELEASE_SKILL, find: '## 7. Bump the version', replace: '## 6. Bump the version' },
    { file: RELEASE_SKILL, find: '## 8. Commit and push', replace: '## 7. Commit and push' },
    {
      file: RELEASE_SKILL,
      find: '## 9. Tag and publish the GitHub release',
      replace: '## 8. Tag and publish the GitHub release'
    },
    {
      file: RELEASE_SKILL,
      find: ', thanking the translators by the handles step 2 noted.',
      replace: '.'
    }
  ],
  traces: [/crowdin/iu, 'l10n:', /volunteer/iu]
};

const linuxSetup: Part = {
  id: 'linux-setup',
  flag: '--no-linux-setup',
  title: 'Linux toolchain setup script',
  files: ['scripts/setup-linux-toolchain.sh'],
  tasks: ['setup:linux'],
  packages: [],
  edits: [
    { file: AGENTS_MD, find: line('- `mise setup:linux`:'), replace: '' },
    { file: GAME_UPDATE_SKILL, find: line('- On Linux, `mise setup:linux`'), replace: '' },
    {
      file: WIZARD_SKILL_MD,
      find: line('  - On Linux, where that installer cannot run, offer `mise setup:linux`'),
      replace: ''
    },
    {
      file: 'scripts/environment.ts',
      find: '`correctly (on Linux, \\`mise setup:linux\\`).`',
      replace: '`correctly.`'
    }
  ],
  traces: ['setup:linux', 'setup-linux']
};

const float64: Part = {
  id: 'float64',
  flag: '--no-float64',
  title: 'float64 test pass',
  files: [
    'Greenfield.Tests/Float64',
    'scripts/check-float64-output.ts',
    'scripts/check-float64-output.test.ts',
    'scripts/environment.ts'
  ],
  tasks: ['test:cs:float32', 'test:cs:float64', 'test:cs:float64:check'],
  packages: [],
  edits: [
    {
      file: TESTS_CSPROJ,
      find: '\n\n  <Import Project="Float64\\Float64.targets" />\n',
      replace: '\n'
    },
    {
      file: MISE_TOML,
      find: /\[tasks\."test:cs"\]\n[\s\S]*?\nrun = .*\n/u,
      replace:
        '[tasks."test:cs"]\n' +
        'description = "Runs the off-engine C# tests on .NET 10 with xUnit. Skips the UI build, the mod post-processor, and the deploy step (none are needed by the tests)."\n' +
        'raw = true\n' +
        'run = "dotnet test --project Greenfield.Tests -p:SkipBuildUI=true -p:SkipModPostProcess=true"\n'
    },
    {
      file: AGENTS_MD,
      find: /Run the C# tests, in a float32 pass then a float64 pass\. (?<rule>.*), and run the float32 pass alone\. .*/u,
      replace: 'Run the C# tests. $<rule>. A test filter appended reaches `dotnet test`.'
    },
    {
      file: AGENTS_MD,
      find: ' and the float64 pass (`Float64`).',
      replace: '.'
    },
    {
      file: OFF_ENGINE_SKILL,
      find: ', when a result differs between the float32 and float64 passes,',
      replace: ','
    },
    {
      file: OFF_ENGINE_SKILL,
      find: 'It runs two passes, float32 then float64 (see Floats), and skips',
      replace: 'It skips'
    },
    {
      file: OFF_ENGINE_SKILL,
      find: /For a focused run, append a filter to one pass,.*\n\n```\n[\s\S]*?```\n/u,
      replace:
        'For a focused run, append a filter, which mise hands to `dotnet test`:\n' +
        '\n' +
        '```\n' +
        "mise test:cs --filter-class '*ModLogTests'\n" +
        '```\n'
    },
    {
      file: OFF_ENGINE_SKILL,
      find: /## Floats\n[\s\S]*?\n(?=## )/u,
      replace:
        '## Floats\n' +
        '\n' +
        'The game computes `float` two ways: Burst code in single precision, managed code under its Mono in double precision, narrowed to single precision each time a value is stored (a local, a field, an array element).\n' +
        'CoreCLR computes in single precision throughout, as Burst does: managed code the tests pass can still round otherwise in game.\n' +
        'The classic bug is a **read-back comparison**, a value stored, then compared with the same expression computed again: equal here, off by a rounding in game. Compare floats the main thread computes with a tolerance.\n' +
        '\n'
    },
    {
      file: GAME_UPDATE_SKILL,
      find: line('The first `mise test:cs` after an update is slower'),
      replace: ''
    }
  ],
  traces: [/float64/iu, /float32/iu, 'FloatWiden', 'FloatMode', 'FloatPass']
};

const jb: Part = {
  id: 'jb',
  flag: '--formatter dotnet-format',
  title: 'jb cleanupcode as the C# formatter (pruned: `dotnet format`)',
  files: ['.config/dotnet-tools.json'],
  tasks: [],
  packages: [],
  edits: [
    { file: INDEX_LAYOUT, find: '      <Path>.config</Path>\n', replace: '' },
    {
      file: '.idea/.idea.Greenfield/.idea/jsonSchemas.xml',
      find: / {8}<entry key="dotnet-tools\.json">[\s\S]*?<\/entry>\n/u,
      replace: ''
    },
    {
      file: MISE_TOML,
      find: '"Auto-fix in place: oxlint --fix, oxfmt, then the C# cleanup. `mise check` is the read-only counterpart, minus the C# part it cannot verify."',
      replace:
        '"Auto-fix in place: oxlint --fix, oxfmt, then the C# formatting. `mise check` and `mise check:cs` are the read-only counterparts."'
    },
    {
      file: MISE_TOML,
      find: /# No check:cs: jb cleanupcode[\s\S]*?\n\n/u,
      replace:
        '[tasks."check:cs"]\n' +
        'description = "Verifies the C# formatting with dotnet format (read-only, `mise fix:cs` writes). The build itself gates the :warning IDE rules."\n' +
        'raw = true\n' +
        'run = [\n' +
        '  "dotnet format style Greenfield.slnx --verify-no-changes",\n' +
        '  "dotnet format whitespace Greenfield.slnx --verify-no-changes"\n' +
        ']\n' +
        '\n'
    },
    {
      file: MISE_TOML,
      find: /\[tasks\."fix:cs"\]\n[\s\S]*?\n\]\n/u,
      replace:
        '[tasks."fix:cs"]\n' +
        'description = "Formats the C# code in place with dotnet format: code style, then whitespace."\n' +
        'raw = true\n' +
        '# Style first: its fixes leave formatting the whitespace pass then settles, so one combined run\n' +
        '# is not idempotent.\n' +
        'run = [\n' +
        '  "dotnet format style Greenfield.slnx",\n' +
        '  "dotnet format whitespace Greenfield.slnx"\n' +
        ']\n'
    },
    {
      file: LEFTHOOK_YML,
      find: '          # Wider than oxlint',
      replace:
        '          - name: check:cs\n' +
        '            glob: "*.cs"\n' +
        '            run: mise check:cs\n' +
        '          # Wider than oxlint'
    },
    {
      file: EDITORCONFIG,
      find: '# Usage: $ dotnet jb cleanupcode csharp.slnx --profile="AutoCleanup" --settings="csharp.sln.DotSettings"\n',
      replace:
        '# This mod formats with `dotnet format` instead (`mise fix:cs`, `mise check:cs`), the resharper_*\n' +
        '# keys driving Rider alone; the keys marked below keep Rider from undoing what dotnet format does.\n'
    },
    {
      file: EDITORCONFIG,
      find:
        'resharper_csharp_indent_preprocessor_if = usual_indent\n' +
        'resharper_csharp_indent_preprocessor_region = usual_indent\n' +
        'resharper_csharp_indent_preprocessor_other = usual_indent\n',
      replace:
        '# Matches dotnet format, which puts every directive but #region at column 0.\n' +
        'resharper_csharp_indent_preprocessor_if = no_indent\n' +
        'resharper_csharp_indent_preprocessor_region = usual_indent\n' +
        'resharper_csharp_indent_preprocessor_other = no_indent\n'
    },
    {
      file: EDITORCONFIG,
      find: 'resharper_csharp_space_within_empty_braces = false\n',
      replace:
        '# Matches dotnet format, which writes `{ }`.\n' +
        'resharper_csharp_space_within_empty_braces = true\n'
    },
    {
      file: EDITORCONFIG,
      find: 'csharp_preserve_single_line_blocks = false\ncsharp_preserve_single_line_statements = false\n',
      replace:
        '# Matches dotnet format, which joins and splits lines otherwise than Rider.\n' +
        'csharp_preserve_single_line_blocks = true\n' +
        'csharp_preserve_single_line_statements = true\n'
    },
    {
      file: EDITORCONFIG,
      find: 'dotnet_style_prefer_auto_properties = true:warning\n',
      replace:
        '# A suggestion, so `dotnet format style` leaves IDE0032 alone: its fixer turns a type-qualified\n' +
        '# static backing field into infinite recursion (a Roslyn bug), and a getter-only property the\n' +
        '# game needs into `{ get; private set; }`.\n' +
        'dotnet_style_prefer_auto_properties = true:suggestion\n'
    },
    {
      file: EDITORCONFIG,
      find: "# Formatting is jb's job: IDE0055 (Roslyn formatter) fights the resharper_* keys, so disable it.\n",
      replace:
        "# Formatting is `mise fix:cs`'s job, checked by `mise check:cs`: IDE0055 would fail the build on\n" +
        '# every line it leaves unformatted.\n'
    },
    {
      file: AGENTS_MD,
      find: 'Format the C# code in place with jb (ReSharper) cleanupcode. There is no read-only C# formatting check; the build gates the IDE rules.',
      replace: 'Format the C# code in place with `dotnet format`, code style then whitespace.'
    },
    {
      file: AGENTS_MD,
      find: /(?<last>Files it reformats outside your change go in their own `style` commit\.\n)/u,
      replace:
        '$<last>- `mise check:cs`: Verify the C# formatting read-only, as the pre-commit hook does; the build gates the IDE rules.\n'
    }
  ],
  traces: [
    'jetbrains.resharper.globaltools',
    'dotnet jb',
    'dotnet tool restore',
    'dotnet-tools',
    'jb (ReSharper)'
  ]
};

/**
 * Every optional part, in the order init prunes them.
 */
export const parts: readonly Part[] = [
  sampleSlice,
  uiTests,
  gameTests,
  crowdin,
  linuxSetup,
  float64,
  jb
];

/**
 * Every part's flag, as command-line arguments: init with them prunes everything.
 */
export const pruneFlags: readonly string[] = parts.flatMap(part => part.flag.split(' '));

/**
 * The material that exists only for the template, which every mod sheds. The update skill goes if
 * present; AGENTS.md's maintenance section is replaced by init itself.
 */
export const templateOnly: Removal = {
  files: ['template', 'LICENSE', WIZARD_INTERVIEW],
  tasks: ['init', 'test:template', 'template:self-test'],
  packages: [],
  edits: [
    { file: WIZARD_SKILL_MD, find: line('Otherwise, read [`interview.md`]'), replace: '' },
    { file: MISE_TOML, find: ', "test:template"', replace: '' },
    {
      file: LEFTHOOK_YML,
      find:
        '    # Init edits files all over the repository, so any change can break it.\n' +
        '    - name: test:template\n      run: mise test:template\n',
      replace: ''
    },
    { file: 'tsconfig.json', find: '    "template/**/*",\n', replace: '' },
    { file: INDEX_LAYOUT, find: '      <Path>template</Path>\n', replace: '' }
  ],
  traces: [
    'MAINTAINING.md',
    'template-maintenance',
    'template:self-test',
    'test:template',
    'gfd-template-update',
    'template/init',
    'template/manifest',
    'interview.md'
  ]
};

/**
 * Template-only files deleted when present, absent from a template checkout that predates them.
 */
export const templateOnlyIfPresent: readonly string[] = [UPDATE_SKILL];
