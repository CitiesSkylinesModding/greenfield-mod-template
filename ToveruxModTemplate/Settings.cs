using Colossal.IO.AssetDatabase;
using Colossal.UI.Binding;
using Game.Modding;
using Game.Settings;
using JetBrains.Annotations;
using ToveruxModTemplate.Utils;

namespace ToveruxModTemplate;

[FileLocation($"ModsSettings/{nameof(ToveruxModTemplate)}/{nameof(ToveruxModTemplate)}")]
[SettingsUIShowGroupName(Settings.GroupAdvanced)]
public sealed class Settings : ModSetting, IJsonWritable {
  private const string GroupAdvanced = "Advanced";

  [SettingsUIButton]
  [SettingsUIConfirmation]
  [SettingsUISection(Settings.GroupAdvanced)]
  [UsedImplicitly]
  public bool ResetSettings {
    // ReSharper disable once ValueParameterNotUsed
    set {
      this.SetDefaults();
      this.ApplyAndSave();
    }
  }

  public Settings(IMod mod) : base(mod) {
    this.SetDefaults();
  }

  /// <summary>
  /// Applies default values to every setting.
  /// Do NOT initialize the properties inline instead, as this method is also the reset path of
  /// <see cref="ResetSettings"/>.
  /// </summary>
  public override void SetDefaults() {
  }

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
    writer.TypeEnd();
  }
}
