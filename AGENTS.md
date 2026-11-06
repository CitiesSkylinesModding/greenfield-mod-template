<!-- Version: 1.1.0 -->

# AGENTS.md

## Project overview

Greenfield is a C# mod for Cities: Skylines II.
A mod has two halves talking over cohtml bindings: the C# logic in `Greenfield`, running as ECS systems in the game's world, and the React UI in `Greenfield/UI/src`, hooking onto the game's own React UI.

## Tech stack

- [mise-en-place](https://mise.jdx.dev): manages dev tools, env vars, and tasks for this repo.
- C# 14 on `net48`, built with the CS2 modding toolchain; the off-engine tests are xUnit v3 on .NET 10, the in-game scenarios run in the game's own test framework.
- React 18 and TypeScript with SCSS modules, bundled, packaged and tested with bun (`Greenfield/UI/build.ts`), formatted with `bun fmt` on an oxfmt configuration, and linted with oxlint.
- The UI runs in Coherent Gameface (cohtml), not a browser: web features can be missing or behave differently, so check the `gameface` skill before relying on one.
- The csmodding plugins are a prerequisite: `coherent-gameface` (the `gameface` skills and the `game_*` MCP tools), `cs2-modding`, and `unity-devtools`. When any of them is missing from a session that touches the game, the UI, or the decompile, stop before starting work and ask the user to load it.

## Project settings

C#, same in `Greenfield` and `Greenfield.Tests` (`Directory.Build.props` and `Directory.Build.targets`):

- `LangVersion` 14, overriding the toolchain's 9.0. The mod targets `net48`, PolySharp polyfilling what it lacks; the tests target `net10.0`.
- `Nullable` and `TreatWarningsAsErrors` enabled: fix a warning or suppress it inline with a justification.
- `ImplicitUsings` off: write every `using` explicitly.
- Every build fails on a `:warning` IDE rule of `.editorconfig` (`EnforceCodeStyleInBuild`).
- Never `ConfigureAwait(false)`: continuations touch ECS and cohtml bindings, so awaits resume on Unity's main thread.

TypeScript, one root `tsconfig.json` covering `Greenfield/UI` and `scripts`:

- TypeScript 7, tsconfig strictest, minus `noPropertyAccessFromIndexSignature`.
- `verbatimModuleSyntax` off, `isolatedModules` on.
- The bundle runs in Coherent Gameface; tests and scripts run under bun, the UI tests with happy-dom.

## Repository structure

- `Greenfield`: the mod's C# project. `Mod.cs` and `Settings.cs` are its entry point and settings.
  - `Systems`: ECS systems, the UI systems among them, which own the C# side of the bindings.
  - `Logging`: the mod-owned logging seam (`IModLog` + `ModLog`, reached through `Mod.Log`), testable off-engine.
  - `Reflection`: accessors reaching into private game internals by reflection.
  - `Utils`: helpers and extensions (localization, input bindings), with `Writers/` for the outbound C# to cohtml binding writers.
  - `Scenarios`: the in-game test scenarios, compiled in Debug only.
  - `Locales`: one JSON per game locale, `en-US.json` the source.
  - `Properties`: the Paradox Mods publish configuration, its profiles and images; `ChangeLog.md` and `LongDescription.md` beside the csproj are the sources the build copies into it.
- `Greenfield/UI/src`: the React frontend. `utils/bindings` is the typed C#↔TS binding facade, one module per binding group; `vanilla-modules` holds typed stubs for game UI internals; `components` the shared components; `testing` the UI test harness. UI tests are colocated `*.test.ts` / `*.test.tsx` files.
- `Greenfield/UI/cs2-types`: the game's own `cs2/*` type declarations, copied as they are. Copy them again after a game update, never edit them by hand.
- `Greenfield.Tests`: the off-engine C# tests, with the native-call shim (`Shim`) and the float64 pass (`Float64`).
- `scripts`: bun scripts behind mise tasks, their tests colocated.
- `docs/agents`: `dependency-updates.md`, the packages a sweep left behind and why; `cantrips-loop.md`, where the cantrips skills keep their specs and tickets.

## Commands

- `mise build`: Build and deploy the whole mod, C# and UI both (the csproj runs `build:ui` itself). The game must be closed, since it holds the deployed assembly open. Anything outside `UI/src` needs this, locale files included.
- `mise build:ui`: Build the UI alone and deploy it to the game's Mods folder. This is the one to run while iterating with the game open: reload the UI afterwards and the change is live.
- `mise build:css-types`: Regenerate the gitignored `*.module.scss.d.ts` files. `mise check` and `mise fix` run this automatically.
- `mise check:agents`: Verify type checking, linting, and formatting read-only, with optimized output. Writes nothing.
- `mise check:agents:tsc`: Only type-checks the code, optimized output.
- `mise check:agents:oxlint`: Only lints the code, optimized output.
- `mise fix`: Apply the auto-fixes in place (oxlint `--fix`, oxfmt, then the C# cleanup of `fix:cs`).
- `mise fix:cs`: Format the C# code in place with jb (ReSharper) cleanupcode. There is no read-only C# formatting check; the build gates the IDE rules.
  Run it right before each commit that touches C#, and only then, as it is slow. Files it reformats outside your change go in their own `style` commit.
- `mise dev`: Watch and rebuild the UI (bundle and CSS module types) on change.
- `mise test`: Run the off-engine C#, UI and scripts tests.
- `mise test:cs`: Run the C# tests, in a float32 pass then a float64 pass. Always run them this way, never with a bare `dotnet test` or the IDE: those build the mod in full, post-processed and deployed, which fails while the game holds the DLL, and run the float32 pass alone. `mise test:cs:float32` and `mise test:cs:float64` run one pass, a test filter appended.
- `mise test:ui`: Run the UI tests.
- `mise setup:linux`: Install the modding toolchain on Linux, where the in-game installer cannot run. Idempotent, rerun it after a game update; the game must be closed.
- `mise l10n:pull`: Preview Crowdin's current translations of the source keys added or changed since `--base`, or of every key with `--all`; `--write` puts them into the files. Needs `CROWDIN_PROJECT_ID` and `CROWDIN_PERSONAL_TOKEN`.
- `mise l10n:push`: Preview which locale-file edits would be pushed to Crowdin; `--push` writes them, which the Boundaries below gate. Needs `CROWDIN_PROJECT_ID` and `CROWDIN_PERSONAL_TOKEN`.
- `mise images:optimize`: Shrink the Paradox Mods images in `Greenfield/Properties`, previews quantized by pngquant, everything recompressed by oxipng. Rerunning changes no pixel.
- `mise publish:page`: Push `PublishConfiguration.xml` to the Paradox Mods page (description, tags, thumbnail, screenshots) without shipping a version; runs `images:optimize` first.
- `mise publish`: Build in Release and publish a new version on Paradox Mods.
- `mise dev:deps-upgrade`: Upgrade the tools and packages interactively; record a package left behind in `docs/agents/dependency-updates.md`.

Run `mise tasks` to see the full shortcut list; append arguments freely, mise passes them through (ex. `mise some:task --some-arg`).
Do NOT use npx to run commands; prefer mise shortcuts, or bun/bunx when no shortcut exists.

Always run the appropriate check/test commands after changes, at the end of the editing session rather than mid-flight.

## Glossary

- **Vanilla**: the unmodded game's own code and UI (`vanilla-modules`, `vanilla-vars.scss`).
- **Debug entry point**: a Debug-only static member an agent calls from the unity eval to run a C# action or read its state.

## End-to-end contract

One agent builds a feature and verifies it in the running game, so every feature exposes what that takes:

- Every C# action has a Debug entry point, `#if DEBUG` and static, callable from the unity eval, and the state it changes is readable from there too, as `EntityCounterSystem.DebugCount` is.
- Every interactive UI element carries a stable class from its stylesheet, which an agent or a test selects by its prefixed BEM name with the hash left out: `[class*="gfd-<block>-<element>_"]`. No test ids.
- Every UI↔C# path is a named binding, declared in a `utils/bindings` module on the TS side and in a UI system on the C# side.
- A feature is done when an agent has driven it in the running game (the unity eval for C#, the gameface `game_*` tools for the UI, the `cs2-dev` tools around both) and pinned what is stable as an in-game scenario or a UI test.

Drive the running game yourself to verify a change, during a review or simplify pass as much as during the work itself.
The `cs2-dev` tools restart the game and read its logs, `mod` set to `Greenfield`: read the `cs2-modding` skill's game-cycle reference before the first call.
The mod logs to `Logs/Greenfield.log` in the game's user data folder, and `mise build` deploys it to `Greenfield/` in the local Mods folder.
When the game's debugger port (unity) or its UI debugging port (gameface) is unavailable, the `cs2-modding-setup` skill sets them up.

## Guidelines

- Build UI from the game's own components and chrome: the `cs2/ui` exports, and the components and class modules the game does not export, reached through `utils/vanilla-modules.ts` with a typed stub under `vanilla-modules` added on demand (its module path from the `cs2-modding-ui` skill). Write custom SCSS only for what vanilla cannot express, so the mod looks native and follows the game's restyles.
- Every C#↔TS binding goes through a `Greenfield/UI/src/utils/bindings` module, which owns its `const GROUP`, keeps its `bindValue`/`trigger` calls private, and exports typed hooks and command functions. Components call those, never raw `bindValue`/`trigger`.
- Create value bindings with `lazyBindValue` (not eager `bindValue`) so that importing a module or component does not instantiate engine bindings; call the returned accessor inside the hook, e.g. `useValue(foo$())`.
- A type's outbound UI wire format lives in a `Greenfield/Utils/Writers` writer. A writer whose properties vary between writes encodes which are present in its `TypeBegin` name: cohtml caches one shape per type name and crashes the game on another (`gameface` skill, data binding).
- One `*.module.scss` per component file, colocated with its `*.tsx`, class names following the BEM-derived convention in `.claude/rules/css-modules-bem.md`.
- Every layout length is in `rem` or `em`, which scale with the viewport: `px` is only correct at 1920 wide, where `1rem` happens to equal `1px`, and drifts both ways at every other resolution.
- SCSS reaches a vanilla color only through its `vanilla.$…` variable in `Greenfield/UI/src/vanilla-vars.scss`, never a raw `var(--…)` nor its value copied as a literal: add a missing one there with its latest known value in a trailing comment, so a game update that moves a color shows in one file. A tint is `color.change(vanilla.$…, $alpha: …)`, which Sass computes at build time: the variable it tints holds the literal value, its `var(--…)` in the comment.
- Tooltips come from `Greenfield/UI/src/components/tooltip.tsx`, never from `cs2/ui`: the vanilla one silently drops `direction` and `alignment`, so every tooltip placed through it opens upwards.
- Focus keys are compared by value, so a plain string like `` `row-${id}` `` keeps a list row attached across re-renders, where a `FocusSymbol` memoized per row costs more for the same result.
- A `vanilla-modules` stub may declare more of the vanilla API than the mod calls today: its unused members are kept on purpose, for the next consumer.
- User-facing strings are localized: add their keys to `Greenfield/Locales/en-US.json`. Every change to `en-US.json`, a key added, removed or reworded, is ported to the other 11 locale files in the same change, through the `gfd-translate` skill.
- With Crowdin set up, nothing moves between Crowdin and the repo but `mise l10n:push`, which carries the source and the repo's translations out, and `mise l10n:pull`, which brings volunteers' work in.
- The decompiled game source, the third-party mod corpus, and the readable copy of the game's UI bundle are machine-local: read their paths from `~/.cs2-modding/setup.md` instead of hardcoding them here. A missing key or a `(none)` value means that source does not exist.
- Reading that source settles what the engine does, never what it costs. Measure a claim about the running game before asserting one.
- The mod patches no game code. When a change cannot be made through systems, prefabs or bindings, read the `cs2-modding` skill's patching reference before adding Harmony.
- The toolchain's `CSII_*` variables are Windows user-scope environment variables, a scope Linux lacks: read one from the user scope with a process-environment fallback, the shape `Greenfield.csproj` and `Greenfield.Tests.csproj` use.
- Commit messages follow [Conventional Commits](https://www.conventionalcommits.org): `<type>(<optional scope>): <summary>`, with the types `feat`, `fix`, `perf`, `refactor`, `test`, `docs`, `style`, `build`, `chore`. The release changelog is written from them.

## Boundaries

Never:

- Commit secrets, tokens, `.env` files, dumps, credentials (`CROWDIN_PERSONAL_TOKEN` belongs in the environment or `mise.local.toml`).
- Modify generated files unless the generation command was run.

Ask first before:

- Changing the bindings wire format shared with the UI.
- Running `mise l10n:push --push`. It writes to the shared Crowdin project, and the approvals it adds stamp a proofreading verdict volunteer translators see and cannot easily undo. Preview first, and keep `--base` to the commits you wrote: a base reaching back across a pull commit pushes volunteers' translations as though they were yours.
- Running `mise publish` or `mise publish:page`: both write to the live Paradox Mods page every player sees.

<!-- template-maintenance:start -->

## Template maintenance

This repository is the mod template itself, and `mise init` strips this section from every mod made from it.
Before changing anything a mod inherits (a file, a task, a part the wizard can prune, a README rationale), read `template/MAINTAINING.md`.
Where an option trades the modder's or the player's experience against effort or scope, take the one with the better experience.
<!-- template-maintenance:end -->
