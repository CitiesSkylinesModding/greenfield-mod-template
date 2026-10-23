---
name: tmt-game-testing
description: Write and run the mod's in-game test scenarios, which the game's own test framework runs in the live game. Use when a check needs the running game (systems over live ECS state, a city loaded), when writing or changing a scenario, when running `mise test:game`, or when a scenario fails or a run ends died, stuck or timed out.
---

# In-game testing

An in-game **scenario** is a class the game's test framework (`Colossal.TestFramework`) runs inside the game: it loads what it needs, drives the mod's systems, and logs one line per check to `Logs/TestScenarios.log` in the game's user data folder.
It is the slowest layer, a full game boot per run: pin here only what needs the live game, and test pure logic off-engine.

## Run

```
mise build        # a Debug build: only Debug carries the scenarios
mise test:game
```

`mise test:game` refuses to start while the game runs, and checks the deployed mod is a Debug build (it warns when a source changed after that build).
It launches the game with the mod's category as the framework's `--categoryFilter`, which makes the game run every scenario of that category five seconds after its first main menu, and watches the logs until the run is:

- **finished**: the game logged the end of its scenarios;
- **died**: the game's process is gone before that (read the crash dumps, see the `tmt-game-cycle` skill);
- **stuck**: a scenario logged nothing for 6 minutes (one loading a city logs nothing until the load ends);
- **timed out**: no scenario started within 10 minutes of the launch, or the run passed 30 minutes.

It then stops the game, prints each scenario's lines, from `START TEST SCENARIO` to `FINISH TEST SCENARIO`, and the mod's errors, and exits non-zero unless the run finished and every scenario passed.
The game is stopped however the run ends, Ctrl+C and a SIGTERM included; a launch that fails stops what it started and deletes `runOnce.txt`, so the next launch runs no scenario.
`mise test:game --keep-open` leaves the game running instead, a hung one included, for a look with the unity eval or at what the scenario left; every other argument is a game option (mise drops a `--`).

Two other ways start a scenario in a game already running a Debug build:

- the developer menu (launched with `--developerMode --qaDeveloperMode`): its Test Scenarios tab lists the mod's scenarios under the category's number;
- the unity eval: `Colossal.TestFramework.TestScenarioSystem.instance.RunScenario("ToveruxModTemplate: Entity counter", System.Threading.CancellationToken.None)`.

## The verdict

A scenario passes when the game reports it a success, at least one of its tests finished, and nothing in it was logged at an error level; the run also fails on any error of the mod's since the launch: in its own log, or in another log that names it (a system's exception is in `Logs/SceneFlow.log`, where only its stack trace names the mod), an error at the main menu included.
The game's own verdict falls short twice, and `mise test:game` covers both:

- **Any logged error fails the test under way**, from any logger: the mod's, the game's, another mod's. A scenario that triggers an error dialog has failed, whatever its checks say.
- **An exception in `OnPrepare` runs no test**, and the game still reports the scenario a success. Its error is in the scenario's lines.

The game also aborts a scenario that starts while errors logged since the previous one are pending, the game's and other mods' boot errors included. [`ModTestScenario`](../../../ToveruxModTemplate/Scenarios/ModTestScenario.cs), the base class of every scenario, dismisses those in its constructor and logs how many; an error of the mod's among them still fails the run, as above.

## Writing a scenario

Copy the shape of [`EntityCounterScenario`](../../../ToveruxModTemplate/Scenarios/EntityCounterScenario.cs):

- A class under `ToveruxModTemplate/Scenarios/`, derived from `ModTestScenario`, with `[TestDescriptor("ToveruxModTemplate: <name>", ScenarioRegistry.ScenarioCategory)]`.
  The csproj compiles that folder in Debug only, and [`ScenarioRegistry`](../../../ToveruxModTemplate/Scenarios/ScenarioRegistry.cs), called from `Mod.OnLoad`, adds every scenario of the assembly to the framework.
- The framework runs, in order: the constructor, `OnPrepare`, then for each `[Test]` method its `[TestPrepare]` method, the test and its `[TestCleanup]` method, then `OnCleanup`, whatever failed before.
  Test methods are private, return `void` or `Task` (a returned task is awaited, and the exception it holds fails the test) and carry `[UsedImplicitly]`.
  The framework takes one `[TestPrepare]` method per scenario, and `ModTestScenario` holds it: what a test needs first goes at the start of the test.
- Start a new city with `await this.StartNewCity(<map guid>, <city name>)`, after setting what a new city reads at creation, `TimeSystem.startingYear` for one; Archipelago, `bf8036b291428535b986c757fda3e627`, is in the base game. No save ships with the mod.
- **Start every other load from the game loop**, as `StartNewCity` does: `await this.WaitFrames(2)` before `GameManager.instance.Load`. A load started from the scenario's caller, the unity eval for one, holds the main thread the load needs, and the game must be killed.
- Put back in `OnCleanup` whatever the scenario changed that outlives it (a setting, a saved value), then return `base.OnCleanup()`, which returns to the main menu.
- Report each check with `this.Check(<passed>, <what was read>)`, which logs a `[PASSED]` or `[FAILED]` line, and end each test on `this.Finish()`, which fails it when one of its checks failed: a run reports every check and not only the first.
- Keep a check's expected values in the mod's code, beside the logic, when an off-engine test can check them too: NetworkTools keeps one table of expected tunnel mouths that its off-engine tests and its scenario both read ([`ProvingGround.cs`](https://github.com/lucarager/CS2-NetworkTools/blob/main/NetworkTools.Mod/Tests/Utils/ProvingGround.cs), [`ProvingGroundTests.cs`](https://github.com/lucarager/CS2-NetworkTools/blob/main/NetworkTools.Tests/Tunnel/ProvingGroundTests.cs)).

## The category

Every scenario carries `ScenarioRegistry.ScenarioCategory`, a bit no category of the game's uses, so the filter runs the mod's scenarios alone: neither the game's nor another mod's `Category.QA` ones.
[`scripts/test-game.ts`](../../../scripts/test-game.ts) holds the same number: change both together.
A finished run with no scenario is that mismatch, a registry that failed (its error is in the mod's log), or no scenario written yet.
