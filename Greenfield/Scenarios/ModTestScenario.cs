using System.Threading.Tasks;
using Colossal;
using Colossal.Serialization.Entities;
using Colossal.TestFramework;
using Game;
using Game.City;
using Game.SceneFlow;
using JetBrains.Annotations;

namespace Greenfield.Scenarios;

/// <summary>
/// Base class of the mod's in-game test scenarios.
/// A scenario fails on any error logged while it runs, by any logger, as the game's runner rules.
/// The runner also aborts a scenario, before it runs a single test and while still reporting it a
/// success, when an error was logged since the previous one ended: at boot, any of the game's or
/// another mod's.
/// The runner constructs a scenario right before it runs it, so the constructor dismisses those
/// earlier errors, and logs how many it dismissed.
/// The cs2-dev <c>test</c> tool still fails the run on an error of the mod's, in its own log or in
/// another log that names it.
/// </summary>
internal abstract class ModTestScenario : TestScenario {
  // Counted by Check, reset before each test by ResetChecks.
  private int failedChecks;

  protected ModTestScenario() {
    var dismissed = TestScenarioSystem.ConsumeErrorCount();

    if (dismissed > 0) {
      ModTestScenario.log.Warn(
        $"Dismissed {dismissed} errors logged before the scenario started, by the game or a " +
        "mod: see Player.log and the mods' logs."
      );
    }
  }

  /// <summary>
  /// Returns to the main menu after a scenario that loaded a city.
  /// </summary>
  protected override async Task OnCleanup() {
    if (GameManager.instance.gameMode is GameMode.Game) {
      await GameManager.instance.MainMenu();
    }
  }

  /// <summary>
  /// Starts a new city on a map, with the options a new game takes from the new game screen, as the
  /// game's own scenarios set them.
  /// Settings a new city reads at creation, the starting year of the time system for one, are set
  /// before it.
  /// </summary>
  protected async Task StartNewCity(Hash128 map, string cityName) {
    // The load must start from the game's own loop: a load started from the caller of the scenario,
    // the unity eval for one, holds the main thread the load needs.
    await this.WaitFrames(2);

    var cityConfiguration = this.World.GetExistingSystemManaged<CityConfigurationSystem>();

    cityConfiguration.overrideLoadedOptions = true;
    cityConfiguration.overrideCityName = cityName;
    cityConfiguration.overrideThemeName = "European";
    cityConfiguration.overrideLeftHandTraffic = false;

    if (!await GameManager.instance.Load(GameMode.Game, Purpose.NewGame, map)) {
      throw new TestScenarioException($"The new city on map {map} did not load.");
    }
  }

  /// <summary>
  /// Runs before each test, so that each test counts its own failed checks.
  /// The runner takes one <see cref="TestPrepareAttribute"/> method per scenario, and fails a
  /// scenario that declares a second: what a test needs first goes at the start of the test.
  /// </summary>
  [TestPrepare]
  [UsedImplicitly]
  protected void ResetChecks() => this.failedChecks = 0;

  /// <summary>
  /// Logs a check as passed or failed, so that a test reports every check and not only the first
  /// failed one.
  /// </summary>
  protected void Check(bool passed, string text) {
    ModTestScenario.log.Info($"  [{(passed ? "PASSED" : "FAILED")}] {text}");

    this.failedChecks += passed ? 0 : 1;
  }

  /// <summary>
  /// Fails the test when one of its checks failed: a test returns it at its end.
  /// The runner awaits a test returning a task, and reports the exception the task holds.
  /// </summary>
  protected Task Finish() =>
    this.failedChecks is 0
      ? Task.CompletedTask
      : Task.FromException(
        new TestScenarioException($"{this.failedChecks} checks failed, see the lines above.")
      );
}
