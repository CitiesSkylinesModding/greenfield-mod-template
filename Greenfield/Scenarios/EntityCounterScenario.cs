using System;
using System.Threading.Tasks;
using Colossal;
using Colossal.TestFramework;
using Game.Simulation;
using Greenfield.Systems;
using JetBrains.Annotations;

namespace Greenfield.Scenarios;

/// <summary>
/// Starts a new city on Archipelago and checks what <see cref="EntityCounterSystem"/> computes: the
/// count of each kind of entity, against the count of the same query on the main thread, and the
/// simulation date, against the starting year the scenario sets.
/// </summary>
[TestDescriptor(
  $"{nameof(Greenfield)}: Entity counter",
  ScenarioRegistry.ScenarioCategory
)]
[UsedImplicitly]
internal sealed class EntityCounterScenario : ModTestScenario {
  /// <summary>
  /// A year no map starts in, so the date check cannot pass on the map's own starting year.
  /// </summary>
  private const int StartingYear = 2042;

  /// <summary>
  /// Archipelago, a map of the base game, by the guid the game's own scenarios load it with.
  /// </summary>
  private static readonly Hash128 ArchipelagoGuid = Hash128.Parse(
    "bf8036b291428535b986c757fda3e627"
  );

  // Set in OnPrepare, which the runner awaits before any test: hence mutable, and null! until then.
  private EntityCounterSystem entityCounterSystem = null!;

  /// <summary>
  /// The counted entity kind the user set, put back when the scenario ends.
  /// Null until the preparation changes it.
  /// </summary>
  private Settings.EntityKind? savedCountedEntity;

  protected override async Task OnPrepare() {
    this.entityCounterSystem = this.World.GetExistingSystemManaged<EntityCounterSystem>();
    this.savedCountedEntity = Mod.Settings.CountedEntity;

    this.World.GetExistingSystemManaged<TimeSystem>().startingYear =
      EntityCounterScenario.StartingYear;

    await this.StartNewCity(EntityCounterScenario.ArchipelagoGuid, nameof(EntityCounterScenario));

    // Paused, so no entity comes or goes between the system's count and the check's.
    this.World.GetExistingSystemManaged<SimulationSystem>().selectedSpeed = 0f;

    await this.WaitFrames(60);
  }

  protected override Task OnCleanup() {
    if (this.savedCountedEntity is {} countedEntity) {
      Mod.Settings.CountedEntity = countedEntity;
    }

    return base.OnCleanup();
  }

  [Test]
  [UsedImplicitly]
  private async Task CountsEachKindOfEntity() {
    foreach (Settings.EntityKind kind in Enum.GetValues(typeof(Settings.EntityKind))) {
      Mod.Settings.CountedEntity = kind;

      // The system shows the count of the job it scheduled the frame before.
      await this.WaitFrames(3);

      var counted = this.entityCounterSystem.Count;
      var expected = this.entityCounterSystem.GetQuery(kind).CalculateEntityCount();

      this.Check(counted == expected, $"{kind}: counted {counted}, the query holds {expected}");
    }

    await this.Finish();
  }

  [Test]
  [UsedImplicitly]
  private Task ReadsTheSimulationDate() {
    var year = this.entityCounterSystem.Date.Year;

    this.Check(
      year is EntityCounterScenario.StartingYear,
      $"year {year}, the city started in {EntityCounterScenario.StartingYear}"
    );

    return this.Finish();
  }
}
