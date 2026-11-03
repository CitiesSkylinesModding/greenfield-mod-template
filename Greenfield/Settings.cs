using System;
using Colossal.IO.AssetDatabase;
using Colossal.UI.Binding;
using Game.Input;
using Game.Modding;
using Game.Settings;
using Greenfield.Utils;
using JetBrains.Annotations;

namespace Greenfield;

[FileLocation($"ModsSettings/{nameof(Greenfield)}/{nameof(Greenfield)}")]
[SettingsUIGroupOrder(Settings.GroupEntityCounter, Settings.GroupAdvanced)]
[SettingsUIShowGroupName(Settings.GroupEntityCounter, Settings.GroupAdvanced)]
[SettingsUIKeyboardAction(
  nameof(Settings.KeyBindingToggleEntityCounter),
  Usages.kDefaultUsage,
  Usages.kToolUsage
)]
public sealed class Settings : ModSetting, IJsonWritable {
  private const string GroupEntityCounter = "EntityCounter";

  private const string GroupAdvanced = "Advanced";

  public Settings(IMod mod) : base(mod) {
    this.SetDefaults();
  }

  /// <summary>
  /// What the entity counter panel counts.
  /// </summary>
  [SettingsUISection(Settings.GroupEntityCounter)]
  public EntityKind CountedEntity { get; set; }

  /// <summary>
  /// Keyboard shortcut opening and closing the entity counter panel.
  /// </summary>
  [SettingsUISection(Settings.GroupEntityCounter)]
  [SettingsUIKeyboardBinding(
    BindingKeyboard.K,
    nameof(Settings.KeyBindingToggleEntityCounter),
    ctrl: true
  )]
  public ProxyBinding KeyBindingToggleEntityCounter { get; set; }

  [SettingsUIButton]
  [SettingsUIConfirmation]
  [SettingsUISection(Settings.GroupAdvanced)]
  [UsedImplicitly]
  public bool ResetSettings {
    // ReSharper disable once ValueParameterNotUsed
    set {
      this.SetDefaults();
      // SetDefaults leaves key bindings alone: only this restores them to their attribute defaults
      // (decompile, ModSetting.ResetKeyBindings).
      this.ResetKeyBindings();
      this.ApplyAndSave();
    }
  }

  /// <summary>
  /// Applies default values to every setting.
  /// Do NOT initialize the properties inline instead, as this method is also the reset path of
  /// <see cref="ResetSettings"/>.
  /// </summary>
  public override void SetDefaults() => this.CountedEntity = EntityKind.Buildings;

  /// <summary>
  /// Restores the default of every string setting that came back null from the settings file.
  /// Call it right after loading, passing an instance that has only been through
  /// <see cref="SetDefaults"/>; <see cref="NullStrings.Restore{T}"/> tells why.
  /// </summary>
  internal void RestoreNullStrings(Settings defaults) => NullStrings.Restore(this, defaults);

  internal Settings Clone() => (Settings) this.MemberwiseClone();

  /// <summary>
  /// The settings the UI reads, through the common UI system's settings binding: a curated subset,
  /// each setting the UI needs written as a camelCase property between the type markers.
  /// </summary>
  void IJsonWritable.Write(IJsonWriter writer) {
    writer.TypeBegin(this.GetType().FullName);

    writer.PropertyName("countedEntity");
    writer.Write(
      this.CountedEntity switch {
        EntityKind.Buildings => "buildings",
        EntityKind.Citizens => "citizens",
        EntityKind.Vehicles => "vehicles",
        _ => throw new InvalidOperationException($"Unknown entity kind {this.CountedEntity}.")
      }
    );

    writer.TypeEnd();
  }

  /// <summary>
  /// The entities the entity counter counts, by the component that identifies them.
  /// </summary>
  public enum EntityKind {
    Buildings,

    Citizens,

    Vehicles
  }
}
