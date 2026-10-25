using System;
using Game;
using Game.Buildings;
using Game.Citizens;
using Game.Common;
using Game.Simulation;
using Game.Tools;
using Game.Vehicles;
using Unity.Burst;
using Unity.Burst.Intrinsics;
using Unity.Collections;
using Unity.Entities;
using Unity.Jobs;
using Unity.Mathematics;
using Purpose = Colossal.Serialization.Entities.Purpose;

namespace Greenfield.Systems;

/// <summary>
/// Counts the city's entities of the kind <see cref="Settings.CountedEntity"/> selects, with a
/// Burst job, and reads the simulation date.
/// Runs every frame of a game, paused or not, so the count follows a setting change within a frame.
/// </summary>
internal sealed partial class EntityCounterSystem : GameSystemBase {
  // Created in OnCreate, which the game runs before any other member: hence mutable, and the time
  // system null! until then.
  private TimeSystem timeSystem = null!;

  private EntityQuery buildingsQuery;

  private EntityQuery citizensQuery;

  private EntityQuery vehiclesQuery;

  private NativeReference<int> countResult;

  // The job scheduled each frame, completed the next.
  private JobHandle countJobHandle;

  /// <summary>
  /// The count of the last finished job, one frame behind the city.
  /// </summary>
  internal int Count { get; private set; }

  /// <summary>
  /// The simulation date, as <see cref="TimeSystem.GetCurrentDateTime"/> builds it: the
  /// <see cref="DateTime.DayOfYear"/> holds the in-game month, one-based.
  /// </summary>
  internal DateTime Date { get; private set; }

  #if DEBUG
  /// <summary>
  /// Counts the given entities now, on the main thread, with the same job as the panel's count.
  /// Debug entry point for the unity eval, e.g.
  /// <c>Greenfield.Systems.EntityCounterSystem.DebugCount(Greenfield.Settings.EntityKind.Citizens)</c>.
  /// </summary>
  internal static int DebugCount(Settings.EntityKind kind) {
    var system = World.DefaultGameObjectInjectionWorld
      .GetExistingSystemManaged<EntityCounterSystem>();

    using var count = new NativeReference<int>(Allocator.TempJob);

    new CountEntitiesJob {
      count = count
    }.Run(system.GetQuery(kind));

    return count.Value;
  }
  #endif

  /// <summary>
  /// The number of entities of a chunk a query selects: all of them, or, when the query filters on
  /// an enableable component, only those the chunk's enabled mask has a bit for, as the
  /// <see cref="IJobChunk"/> contract requires.
  /// </summary>
  internal static int CountChunkEntities(
    int chunkEntityCount,
    bool useEnabledMask,
    in v128 chunkEnabledMask
  ) =>
    useEnabledMask
      ? math.countbits(chunkEnabledMask.ULong0) + math.countbits(chunkEnabledMask.ULong1)
      : chunkEntityCount;

  internal EntityQuery GetQuery(Settings.EntityKind kind) =>
    kind switch {
      Settings.EntityKind.Buildings => this.buildingsQuery,
      Settings.EntityKind.Citizens => this.citizensQuery,
      Settings.EntityKind.Vehicles => this.vehiclesQuery,
      _ => throw new ArgumentOutOfRangeException(nameof(kind), kind, null)
    };

  protected override void OnCreate() {
    base.OnCreate();

    this.timeSystem = this.World.GetOrCreateSystemManaged<TimeSystem>();

    this.buildingsQuery = this.CreateCountQuery<Building>();
    this.citizensQuery = this.CreateCountQuery<Citizen>();
    this.vehiclesQuery = this.CreateCountQuery<Vehicle>();

    this.countResult = new NativeReference<int>(Allocator.Persistent);

    // Enabled for games only, by OnGameLoadingComplete: the time system has no date to give in the
    // main menu or the editor.
    this.Enabled = false;
  }

  protected override void OnDestroy() {
    this.countJobHandle.Complete();
    this.countResult.Dispose();

    base.OnDestroy();
  }

  protected override void OnGameLoadingComplete(Purpose purpose, GameMode mode) {
    base.OnGameLoadingComplete(purpose, mode);

    this.Enabled = mode is GameMode.Game;

    // Forget the previous city's count.
    this.countJobHandle.Complete();
    this.countResult.Value = 0;
    this.Count = 0;
  }

  protected override void OnUpdate() {
    // The job scheduled last frame has had a whole frame to finish, so completing it rarely waits.
    this.countJobHandle.Complete();
    this.Count = this.countResult.Value;

    this.countResult.Value = 0;

    this.countJobHandle = new CountEntitiesJob {
      count = this.countResult
    }.Schedule(
      this.GetQuery(Mod.Settings.CountedEntity),
      this.Dependency
    );

    this.Dependency = this.countJobHandle;

    this.Date = this.timeSystem.GetCurrentDateTime();
  }

  /// <summary>
  /// A query on the entities carrying <typeparamref name="T"/>, leaving out those deleted this
  /// frame and the previews of a tool in use.
  /// </summary>
  private EntityQuery CreateCountQuery<T>() =>
    this.GetEntityQuery(
      ComponentType.ReadOnly<T>(),
      ComponentType.Exclude<Deleted>(),
      ComponentType.Exclude<Temp>()
    );

  /// <summary>
  /// Adds the number of entities the query selects to <see cref="count"/>.
  /// Scheduled single-threaded, so the chunks add up without atomics.
  /// </summary>
  [BurstCompile]
  private struct CountEntitiesJob : IJobChunk {
    public NativeReference<int> count;

    public void Execute(
      in ArchetypeChunk chunk,
      int unfilteredChunkIndex,
      bool useEnabledMask,
      in v128 chunkEnabledMask
    ) {
      this.count.Value += EntityCounterSystem.CountChunkEntities(
        chunk.Count,
        useEnabledMask,
        chunkEnabledMask
      );
    }
  }
}
