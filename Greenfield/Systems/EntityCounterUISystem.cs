using System;
using Colossal.UI.Binding;
using Game;
using Game.UI;
using Greenfield.Utils;
using Greenfield.Utils.Writers;

namespace Greenfield.Systems;

/// <summary>
/// UI System exposing what <see cref="EntityCounterSystem"/> computes to the entity counter panel,
/// and the key binding toggling it.
/// The panel's visibility is the UI's own state: nothing on the C# side reads it.
/// </summary>
internal sealed partial class EntityCounterUISystem : UISystemBase {
  private const string BindingGroup = "greenfield.entityCounter";

  // Set in OnCreate, which the game runs before any other member: hence mutable, and null! until
  // then.
  private EntityCounterSystem entityCounterSystem = null!;

  public override GameMode gameMode => GameMode.Game;

  protected override void OnCreate() {
    base.OnCreate();

    try {
      this.entityCounterSystem = this.World.GetOrCreateSystemManaged<EntityCounterSystem>();

      this.AddUpdateBinding(
        new GetterValueBinding<EntityCount>(
          EntityCounterUISystem.BindingGroup,
          "entityCount",
          this.GetEntityCount,
          new EntityCountValueWriter()
        )
      );

      this.AddBinding(
        new InputActionBinding(
          EntityCounterUISystem.BindingGroup,
          "toggleInputAction",
          Mod.Settings.KeyBindingToggleEntityCounter
        )
      );
    }
    catch (Exception ex) {
      Mod.Log.ErrorFatal(ex);
    }
  }

  private EntityCount GetEntityCount() {
    var date = this.entityCounterSystem.Date;

    // The day of the year holds the in-game month, and the frontend's dates count months from zero
    // (decompile, MenuUISystem builds its save dates the same way).
    return new EntityCount(this.entityCounterSystem.Count, date.Year, date.DayOfYear - 1);
  }

  /// <summary>
  /// What the entity counter panel shows: the count, and the simulation date in the shape of the
  /// vanilla <c>LocalizedDate</c>'s value.
  /// </summary>
  internal readonly record struct EntityCount(int Count, int Year, int Month);
}
