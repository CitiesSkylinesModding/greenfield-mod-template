# 🌱 Greenfield Mod Template — by [@toverux](https://github.com/toverux)

A starter for Cities: Skylines II mods, with its C# half and React UI half, built so that a coding agent can develop and test a mod end to end.

It is also tests-oriented, which is rarely seen in the modding community. The template provide a complete solution for off-engine testing (unit tests without having the game running), and in-game test scenarios to validate deep and end-to-end behavior.

It works on Windows and Linux alike: build, deploy, UI build, git hooks, and every test layer.

It is opinionated: it runs on [mise](https://mise.jdx.dev) and [bun](https://bun.sh), and it picks one way of doing each thing.
The official template is barebone (as it should be). This one adds the tooling, tests, and infrastructure that a good and robust mod deserves.

The setup wizard, from a copy of the template to a committed mod, in two minutes:

https://github.com/user-attachments/assets/94ce3af0-f23e-4fea-bf89-7c48d2f9f20c

**Contents**

- [What you get](#-what-you-get)
- [Start a mod](#-start-a-mod)
- [How it differs from the official template, and why](#-how-it-differs-from-the-official-template-and-why)
- [Deleting the sample feature](#-deleting-the-sample-feature)
- [Updating a mod from the template](#-updating-a-mod-from-the-template)
- [Contributing](#-contributing) and [License](#-license)

## 📦 What you get

- **A mod bootstrap that handles the usual failures.** Fatal errors are caught and shown to the player in their language, a settings string stored as null gets its default back instead of breaking the whole options page, and JavaScript errors from the UI reach the game's error dialog.
- **Typed C# ↔ UI bindings**, one module per binding group. They are created lazily, so importing a component never touches the game's UI engine.
- **UI built from the game's own components**, including ones the game does not export. The mod looks native, and a game update that moves a component degrades the UI instead of breaking it.
- **Three test layers:** C# tests off-engine (on plain .NET, without the game), UI tests against the game's real UI bundle, and in-game scenarios run by the game's own test framework.
- **All 12 game languages**, with an optional [Crowdin](https://crowdin.com) flow for volunteer translators.
- **A release flow** with one version source, and a changelog that Paradox Mods and GitHub render the same way.
- **An agent setup:** an `AGENTS.md`, code-style rules, and skills for testing, translating, releasing, and updating after a game patch. It relies on the [csmodding plugins](https://github.com/CitiesSkylinesModding/agents-plugins), installed separately, which let an agent see and drive the running game.
- **A small sample feature** that shows how the pieces connect, with a list of its files for when you delete it.

## 🚀 Start a mod

You need:

- The game.
- git.
- mise, which installs bun and the .NET SDK for you.
- The game's modding toolchain. On Windows, install it from the game's Options, Modding tab. On Linux, run `mise setup:linux` in your copy of the template, after launching the game from Steam once and closing it.

The setup checks all of this and tells you what is missing.

### With an agent (recommended)

1. Get the template: clone it or download it as an archive.

   ```sh
   git clone https://github.com/CitiesSkylinesModding/greenfield-mod-template MyMod
   ```

2. Open [Claude Code](https://claude.com/claude-code) in the folder and run `/gfd-setup`.
   With Codex, which loads skills from `.agents/`, rename the `.claude/` directory to `.agents` first.
3. Answer the wizard. It asks what you are building, checks your machine, takes your mod's name and choices one at a time, then renames everything, removes the parts you declined, writes your licence, builds, tests, and makes your first commit.

The wizard explains each choice as it goes.

### The parts you can leave out

`mise init` keeps every part unless you pass its switch; the wizard recommends which to keep from what you are building:

- The sample feature.
- The UI tests.
- The in-game test layer.
- Crowdin.
- The Linux toolchain setup script.
- The float64 test pass (see [C# tests](#c-tests-run-on-net-10-not-mono)).
- jb cleanupcode as the C# formatter, which `dotnet format` can replace (see [A C# formatter](#a-c-formatter)).

Init deletes a declined part entirely, but the mod's history starts with a commit of the template unmodified, so an agent can get a part back from it later.

### Without an agent

`mise init` makes the renames and removals; the wizard collects its flags and does the steps around it.
`mise init -- --help` lists the flags: the mod's ID, name, author and description, and options for the versioning scheme, the agent directory, the Paradox Mods links, Crowdin, the template commit, and one switch per part to leave out.

1. Commit the template unmodified: init records the commit the mod starts from, and refuses uncommitted changes.
   A clone keeping the template's history already has that commit. To start a history of your own instead:
   1. Note the template commit: `git rev-parse HEAD` in a clone, before deleting its `.git`; `git ls-remote https://github.com/CitiesSkylinesModding/greenfield-mod-template HEAD` for a download, which gives the latest commit: for an older download, use the commit it was taken from.
   2. `git init`, then commit the template unmodified.
   3. Pass the noted commit to init as `--template-commit`.
2. Run `mise init` with your flags.
3. Init replaces this README with your mod's, and deletes the template's licence.
   The new README's closing note lists what is left before committing the mod: add a `LICENSE`, run `mise fix:cs` if you chose `dotnet format`, run `bunx lefthook install`, and delete the wizard's folder, `<agent dir>/skills/<prefix>-setup/` (`.claude` unless you passed `--agent-dir`).

## 🧭 How it differs from the official template, and why

The official toolchain creates a project with a csproj importing the toolchain's build, a sample `Mod.cs` and settings class, and a webpack UI from `create-csii-ui-mod`.
This template keeps the toolchain's build and changes most of what sits around it.

### Toolchain and layout

#### mise and bun are required

mise pins bun and the .NET SDK and runs every task, so a fresh clone builds with the same versions everywhere; `mise tasks` lists the tasks.
Each step of a task is a single command or a bun script, because mise runs tasks through `cmd` on Windows, where shell syntax breaks.
There is no Node fallback: one toolchain keeps the scripts, the UI build, and the tests in one language and one runtime.

#### One repository layout

A folder named after the mod holds the C# project and its UI; the C# tests sit in a sibling project.
The JS tooling (`package.json`, `tsconfig.json`, the linter and formatter configs) sits at the root, beside `mise.toml` and the git hooks' `lefthook.yml`, so one install and one TypeScript config cover the UI, its tests, and the scripts.

#### The UI builds with a bun script, not webpack

[`build.ts`](Greenfield/UI/build.ts) builds the UI and deploys it next to the mod's DLL.
It compiles the SCSS itself rather than through bun's CSS bundler, which rewrites declarations into shorthands the game's UI engine, Coherent Gameface, ignores, such as `inset` and `flex-flow`.
It fails the build, naming the cause, on CSS the game cannot use: a stylesheet that is not a CSS module, a relative `url()`, a reference to another stylesheet.
It reads the version from the csproj, so the version lives in one place.

#### sass and React are pinned

sass stays at 1.78: later versions emit CSS Color 4 syntax, which Gameface cannot parse. The build still passes; the colors break only once the game renders them.
React stays at 18.3.1 because the game supplies React at runtime and the mod's copy only exists to compile against it.
[`docs/agents/dependency-updates.md`](docs/agents/dependency-updates.md) records both, so a dependency sweep leaves them alone.

#### oxlint and bun fmt

TypeScript is linted by [oxlint](https://oxc.rs) and formatted by [`bun fmt`](https://bun.com/docs/runtime/format), Bun's built-in port of oxfmt, both on a shared configuration. The rules that push DOM APIs Gameface lacks, such as `append()` and `dataset`, are turned off.
A pre-commit hook runs the type check, the linter, and the formatter check. A pre-push hook runs the tests whose files changed, all but the in-game scenarios.
Commit messages follow [Conventional Commits](https://www.conventionalcommits.org), which the release skill writes the changelog from.

### The C# build

#### C# 14, strict, and style-checked on every build

Both C# projects share their settings: C# 14 with [PolySharp](https://github.com/Sergio0694/PolySharp) for the newer features `net48` lacks, nullable references, warnings as errors, explicit `using`s.
A violation of any `.editorconfig` code-style rule at `warning` severity fails the build.
The C# version lives in `Directory.Build.targets` rather than `Directory.Build.props`, because the toolchain's `Mod.props` sets 9.0 after the props are read.

#### A C# formatter

`mise fix:cs` reformats the C# with JetBrains' `jb cleanupcode`, the engine Rider uses, to the full style of the template's `.editorconfig` and Rider settings. It takes minutes, and has no read-only check.
The setup offers `dotnet format` instead: faster, with a read-only check in the pre-commit hook, but it leaves line wrapping alone.

#### Build switches for the tests

Two MSBuild properties, which `mise test:cs` passes to `dotnet test`, skip what the tests do not need.
`-p:SkipBuildUI=true` skips the UI build.
`-p:SkipModPostProcess=true` skips the toolchain's post-processor, which generates the mod's ECS and Burst code, and the deploy, leaving a DLL the game never sees.

#### Debug builds compile Burst for Windows only

Burst is Unity's compiler for performance-critical jobs. Compiling it for one platform shortens every Debug iteration.
Release builds and publishing keep every platform, and Linux players run the Windows build through Proton, Steam's layer for running Windows games on Linux.

#### One version source

The csproj's `<Version>` is the only place the version is written.
Every build writes it into `Properties/PublishConfiguration.xml`, the Paradox Mods publish configuration, along with `ChangeLog.md` and `LongDescription.md` from beside the csproj; the UI bundle's banner carries it too.

### Tests

#### C# tests run on .NET 10, not Mono

The off-engine tests are an xUnit v3 project on .NET 10, which runs the same on Linux and Windows.
Mono, the runtime the game itself runs on, is unmaintained on Windows. On Linux, the .NET 11 SDK refuses the VSTest setup that runs tests under Mono, which would block the next SDK upgrade.

Two things bring .NET 10 close to the game:

- A shim redirects Unity's native memory calls to managed code at load time, so tests can allocate `NativeArray`, `NativeList`, hash maps and queues like the systems they test.
- The game computes `float` two ways: its Burst jobs in single precision, its other managed code in double precision, narrowed on each store. The tests run twice, in a float32 pass matching Burst, then in an optional float64 pass that rewrites the assemblies to match the managed code.

`mise test:cs` runs both passes and deploys nothing.
`dotnet test` and an IDE's test explorer also run the tests, on Windows and Linux, but only the float32 pass, and they build and deploy the full mod first, which fails while the game is running.
[`runtime-differences.md`](.claude/skills/gfd-cs-offengine-testing/runtime-differences.md) lists where .NET still behaves differently from the game.

#### UI tests against the real game UI

Component tests render the mod's components with bun, [happy-dom](https://github.com/capricorn86/happy-dom) and Testing Library, against the game's own UI bundle loaded from your install, with a mock engine standing in for the bindings.
Tests of pure logic run without the game.

#### In-game scenarios

Debug builds register scenarios with the game's own test framework.
The `cs2-modding` plugin's `test` tool launches the game unattended, on Linux or Windows, and reports how each scenario went. A run takes minutes.

### Locales and platforms

#### Twelve locales, as JSON

The mod's texts live in `Locales/`, one JSON file per game language, embedded in the DLL, with English as the source and the fallback.
A community language pack can add a language the game does not ship: add a `Locales/<locale ID>.json` for it, and the mod loads it when a player picks that language.

#### Linux support built in

The csproj reads `CSII_TOOLPATH` from the Windows user scope, where the toolchain writes it, then from the process environment, which is where Linux has it; on Linux, it also builds against the game's own `mscorlib`.
`mise setup:linux` installs the toolchain on Linux, where the toolchain installer in the game's Options cannot run.

### Ready for agents

`AGENTS.md` sets a contract that lets one agent build a feature and check it in the running game:

- Every C# action has a Debug-only entry point the agent can call from the game's debugger.
- Every interactive UI element has a stable class the agent can select.
- Every UI ↔ C# path is a named binding.

The skills cover testing on each layer, translating, releasing and game updates, and the `cs2-modding` plugin's tools restart the game and read its logs. The code-style rules sit in [`.claude/rules`](.claude/rules).

### What it leaves out

No Harmony, the library that patches game code at runtime: `AGENTS.md` sends you to the `cs2-modding` skill's patching reference for when a patch is warranted and how to add one.
No CI: a build needs the game's own assemblies, and the component tests need its UI bundle.

## 🧹 Deleting the sample feature

The entity counter is a mods-menu button that opens a panel from the game's own UI, showing the city's entity count and the simulation date. It exists to show how a setting, a Burst-compiled system, a UI system (the C# system owning the bindings), a binding, a panel, a key binding, the locales, and the tests on every layer connect.
The setup can leave it out; to delete it later, remove these files:

- `<Mod>/Systems/EntityCounterSystem.cs` and `<Mod>/Systems/EntityCounterUISystem.cs`
- `<Mod>/Utils/Writers/EntityCountValueWriter.cs`
- `<Mod>/Scenarios/EntityCounterScenario.cs`
- `<Mod>.Tests/Systems/EntityCounterSystemTests.cs` and `<Mod>.Tests/Utils/Writers/EntityCountValueWriterTests.cs`
- `<Mod>/UI/src/entity-counter/` and `<Mod>/UI/src/utils/bindings/entity-counter.ts`

Then this search lists every line left to edit, in `Mod.cs`, `Settings.cs`, the binding modules, `UI/src/index.tsx`, the locale files, `AGENTS.md` and the skills:

```sh
git grep -inE "entity.?count|counted.?entit|entity.?kind|mods menu button"
```

Three things to know while editing:

- In the locale files, the `Options.INPUT_MAP[...]` keys of the key binding go too.
- In `UI/src/utils/bindings/common.ts`, keep `ModSettings` as an empty interface for the next setting, with the `oxlint-disable-next-line typescript/no-empty-interface, typescript/no-empty-object-type` comment above it: `mise check` refuses an empty interface otherwise.
- `mise build` and `mise test` then confirm no code still uses the feature.

## 🔄 Updating a mod from the template

A mod records the template commit it started from in `.template.json`.
To bring later template improvements into it, open your agent in a full clone of this template, pulled to the latest, and run `/gfd-template-update <path to the mod>`.
It walks you through each template commit since, translated into your mod's names, and skips what belongs to parts you left out.

## 🤝 Contributing

Changes to the template follow [`template/MAINTAINING.md`](template/MAINTAINING.md).

## 📄 License

[MIT-0](LICENSE): use it for anything, with no attribution required. Your mod's licence is your own: the wizard writes the one you pick, and without the wizard you add a `LICENSE` yourself.
