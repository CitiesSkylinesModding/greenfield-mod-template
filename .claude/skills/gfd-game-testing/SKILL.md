---
name: gfd-game-testing
description: Write and run the mod's in-game test scenarios, which the game's own test framework runs in the live game. Use when a check needs the running game (systems over live ECS state, a city loaded), when writing or changing a scenario, or when a scenario run fails.
---

# In-game testing

An in-game **scenario** is a class the game's test framework (`Colossal.TestFramework`) runs inside the game: it loads what it needs, drives the mod's systems, and logs one line per check to `Logs/TestScenarios.log` in the game's user data folder.
It is the slowest layer, a full game boot per run: pin here only what needs the live game, and test pure logic off-engine.
The `cs2-modding` skill's test-framework reference holds the framework's traps, the scenarios it reports a success without running a test among them: read it before writing a scenario or reading a run.

## Run

1. Deploy a Debug build of the current sources, the only build carrying the scenarios: `stop` the game when it runs, then `mise build`.
2. Call the `cs2-dev` `test` tool with `mod` set to `Greenfield` and `sources` to this repository's `Greenfield` folder, as an absolute path. Its default `category` is the mod's.

`keepOpen` leaves the game running after the run, for a look with the unity eval or at what the scenario left.

Two other ways start a scenario in a game already running a Debug build:

- the developer menu (launched with `--developerMode --qaDeveloperMode`): its Test Scenarios tab lists the mod's scenarios under the category's number;
- the unity eval: `Colossal.TestFramework.TestScenarioSystem.instance.RunScenario("Greenfield: Entity counter", System.Threading.CancellationToken.None)`.

## Writing a scenario

Copy the shape of [`EntityCounterScenario`](../../../Greenfield/Scenarios/EntityCounterScenario.cs):

- A class under `Greenfield/Scenarios/`, derived from `ModTestScenario`, with `[TestDescriptor("Greenfield: <name>", ScenarioRegistry.ScenarioCategory)]`.
  The csproj compiles that folder in Debug only, and [`ScenarioRegistry`](../../../Greenfield/Scenarios/ScenarioRegistry.cs), called from `Mod.OnLoad`, adds every scenario of the assembly to the framework.
- The framework runs, in order: the constructor, `OnPrepare`, then for each `[Test]` method its `[TestPrepare]` method, the test and its `[TestCleanup]` method, then `OnCleanup`, whatever failed before.
  Test methods are private, return `void` or `Task` (a returned task is awaited, and the exception it holds fails the test) and carry `[UsedImplicitly]`.
  The framework takes one `[TestPrepare]` method per scenario, and `ModTestScenario` holds it: what a test needs first goes at the start of the test.
- Start a new city with `await this.StartNewCity(<map guid>, <city name>)`, after setting what a new city reads at creation, `TimeSystem.startingYear` for one; Archipelago, `bf8036b291428535b986c757fda3e627`, is in the base game. No save ships with the mod.
- **Start every other load from the game loop**, as `StartNewCity` does: `await this.WaitFrames(2)` before `GameManager.instance.Load`. A load started from the scenario's caller, the unity eval for one, holds the main thread the load needs, and the game must be killed.
- Put back in `OnCleanup` whatever the scenario changed that outlives it (a setting, a saved value), then return `base.OnCleanup()`, which returns to the main menu.
- [`ModTestScenario`](../../../Greenfield/Scenarios/ModTestScenario.cs) dismisses in its constructor the errors pending from before the scenario, which would abort it, and logs how many; an error of the mod's among them still fails the `test` run.
- Report each check with `this.Check(<passed>, <what was read>)`, which logs a `[PASSED]` or `[FAILED]` line, and end each test on `this.Finish()`, which fails it when one of its checks failed: a run reports every check and not only the first.
- Keep a check's expected values in the mod's code, beside the logic, when an off-engine test can check them too: one table that the off-engine tests and the scenario both read.

## The category

Every scenario carries `ScenarioRegistry.ScenarioCategory`, `1 << 20`, the `test` tool's default `category`: a bit no category of the game's uses, so the run leaves out the game's scenarios and other mods' `Category.QA` ones.
On a change of that bit, pass the new number as `category`.
